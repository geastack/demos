import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { MediaStream, PcmAudioStream, WebSocketInstance } from '@geastack/core'
import { createSessionConfig, type RealtimeSessionConfig } from '../src/config/session.ts'
import {
  FRAME_ACK_TIMEOUT_MS,
  MAX_FRAME_BUFFER_BYTES,
  MAX_FRAME_DATA_URL_LENGTH,
  OPENING_TIMEOUT_MS,
  RealtimeSession,
} from '../src/services/RealtimeSession.ts'

const frame = 'data:image/jpeg;base64,/9j/AA=='

interface ClientEvent {
  type: string
  event_id?: string
  item_id?: string
  audio_end_ms?: number
  item?: {
    id: string
    type: string
    role: string
    content: { type: string; image_url: string }[]
  }
  response?: { instructions: string }
  session?: RealtimeSessionConfig
}

interface Update {
  type: string
  frames?: number
  ready?: boolean
  message?: string
  phase?: string
}

function setup(t: TestContext) {
  const outbound: ClientEvent[] = []
  const updates: Update[] = []
  const received: string[] = []
  const resets: boolean[] = []
  let attachments = 0
  let pipes = 0
  let audioClosed = 0
  let socketClosed = 0
  let microphoneStopped = 0
  const microphoneTrack = { enabled: true, stop: () => ++microphoneStopped }
  const audio = {
    playedMs: 100,
    queuedMs: 0,
    audioLevel: 0,
    drained: false,
    capturePackets: 0,
    capturePendingMs: 0,
    captureDroppedSamples: 0,
    setInput() {
      ++attachments
    },
    pipeTo(_socket: WebSocketInstance, prefix: string, suffix: string) {
      ++pipes
      assert.deepEqual(JSON.parse(prefix + 'AAAA' + suffix), {
        type: 'input_audio_buffer.append',
        audio: 'AAAA',
      })
    },
    readBase64() {
      return ''
    },
    receiveFrom() {
      throw new Error('Protocol owns playback writes')
    },
    writeBase64(data: string) {
      received.push(data)
    },
    resetPlayback(interrupted = false) {
      resets.push(interrupted)
    },
    close() {
      ++audioClosed
    },
  } as PcmAudioStream
  const socket = {
    readyState: 1,
    bufferedAmount: 0,
    send(message: string) {
      outbound.push(JSON.parse(message) as ClientEvent)
    },
    close() {
      ++socketClosed
    },
  } as WebSocketInstance
  const session = new RealtimeSession((message) => updates.push(JSON.parse(message) as Update))
  session.fullDuplex = false

  session.audio = audio
  session.microphone = {
    getAudioTracks() {
      return [microphoneTrack]
    },
    getTracks() {
      return [microphoneTrack]
    },
  } as unknown as MediaStream
  session.socket = socket
  session.phase = 'connecting'
  session.sessionConfig = JSON.parse(createSessionConfig()) as RealtimeSessionConfig
  t.after(() => session.stop())

  return {
    session,
    audio,
    socket,
    outbound,
    updates,
    received,
    resets,
    microphoneTrack,
    counts: () => ({ attachments, pipes, audioClosed, socketClosed, microphoneStopped }),
  }
}

function acceptFrame(session: RealtimeSession): string {
  assert.equal(session.sendFrame(frame), true)
  const itemId = session.pendingFrameId

  session.receive({ type: 'conversation.item.added', item: { id: itemId } })

  return itemId
}

test('configuration selects gpt-realtime-2.1, PCM24 and explicit camera availability', () => {
  const on = JSON.parse(createSessionConfig()) as RealtimeSessionConfig
  const off = JSON.parse(createSessionConfig(false)) as RealtimeSessionConfig

  assert.equal(on.model, 'gpt-realtime-2.1')
  assert.deepEqual(on.audio.input.noise_reduction, { type: 'far_field' })
  assert.deepEqual(on.audio.input.turn_detection, {
    type: 'server_vad', threshold: 0.75, prefix_padding_ms: 300,
    silence_duration_ms: 600, create_response: true, interrupt_response: true,
  })
  assert.deepEqual(on.audio.input.format, { type: 'audio/pcm', rate: 24000 })
  assert.deepEqual(on.audio.output.format, { type: 'audio/pcm', rate: 24000 })
  assert.match(on.instructions, /occasional camera images, not a continuous video feed/)
  assert.match(off.instructions, /camera is off/)
  assert.match(off.instructions, /Do not describe a live view or rely on earlier images/)
  const serverVad = { type: 'server_vad', create_response: true, interrupt_response: true } as const

  assert.deepEqual(
    (JSON.parse(createSessionConfig(true, serverVad)) as RealtimeSessionConfig).audio.input
      .turn_detection,
    serverVad,
  )
})

test('readiness requests one first frame and the opening waits for its acknowledgement', (t) => {
  const { session, outbound, updates, counts } = setup(t)

  assert.equal(session.canSendFrame, false)
  assert.equal(session.sendFrame(frame), false)
  session.receive({ type: 'session.updated' })
  session.receive({ type: 'session.updated' })
  assert.equal(updates.filter((event) => event.type === 'frame-request').length, 1)
  assert.equal(outbound.length, 0, 'waiting for visual context must not start an ungrounded greeting')
  assert.equal(counts().pipes, 0, 'greeting audio must never upload')
  assert.equal(session.canSendFrame, true)
  assert.equal(session.sendFrame(frame), true)
  assert.equal(session.canSendFrame, false)
  assert.equal(outbound.filter((event) => event.type === 'response.create').length, 0)
  session.receive({ type: 'conversation.item.added', item: { id: session.pendingFrameId } })
  assert.equal(outbound.filter((event) => event.type === 'response.create').length, 1)
  assert.match(outbound.at(-1)?.response?.instructions || '', /grounded observation/)
  assert.equal(session.frames, 1)
  assert.equal(session.canSendFrame, true)
  assert.equal(counts().attachments, 0)
})

test('image items follow the Realtime user input_image schema and stay single-flight', (t) => {
  const { session, outbound } = setup(t)

  session.receive({ type: 'session.updated' })
  session.sendFrame(frame)
  const pending = session.pendingFrameId
  const event = outbound[0]!

  assert.deepEqual(event, {
    type: 'conversation.item.create',
    event_id: `${pending}-create`,
    item: {
      id: pending,
      type: 'message',
      role: 'user',
      content: [{ type: 'input_image', image_url: frame }],
    },
  })
  assert.equal(session.sendFrame(frame), false)
  assert.equal(outbound.length, 1)
  session.receive({ type: 'conversation.item.added', item: { id: 'unrelated-user-item' } })
  assert.equal(session.pendingFrameId, pending)
})

test('socket backpressure, closed transport and invalid images skip upload without losing readiness', (t) => {
  const { session, socket, outbound } = setup(t)

  session.receive({ type: 'session.updated' })
  Object.assign(socket, { bufferedAmount: MAX_FRAME_BUFFER_BYTES + 1 })
  assert.equal(session.canSendFrame, false)
  assert.equal(session.sendFrame(frame), false)
  Object.assign(socket, { bufferedAmount: 0, readyState: 0 })
  assert.equal(session.sendFrame(frame), false)
  Object.assign(socket, { readyState: 1 })
  assert.equal(session.sendFrame('https://example.com/image.jpg'), false)
  assert.equal(session.sendFrame('data:image/png;base64,AAAA'), false)
  assert.equal(session.sendFrame('data:image/jpeg;base64,'), false)
  assert.equal(
    session.sendFrame('data:image/jpeg;base64,' + 'A'.repeat(MAX_FRAME_DATA_URL_LENGTH)),
    false,
  )
  assert.equal(outbound.length, 0)
  assert.equal(session.canSendFrame, true)
  assert.equal(session.sendFrame(frame), true)
})

test('only acknowledged images count and the last two are retained with idempotent legacy ACKs', (t) => {
  const { session, outbound, updates } = setup(t)

  session.receive({ type: 'session.updated' })
  const first = acceptFrame(session)

  session.receive({ type: 'conversation.item.created', item: { id: first } })
  assert.equal(session.frames, 1, 'duplicate GA and legacy events must not acknowledge twice')
  const second = acceptFrame(session)

  assert.equal(outbound.filter((event) => event.type === 'conversation.item.delete').length, 0)
  session.sendFrame(frame)
  const third = session.pendingFrameId

  session.receive({ type: 'conversation.item.added', item: { id: first } })
  assert.deepEqual(session.frameItemIds, [first, second])
  assert.equal(session.frames, 2, 'out-of-order stale acknowledgements must not prune context')
  session.receive({ type: 'conversation.item.created', item: { id: third } })
  assert.deepEqual(session.frameItemIds, [second, third])
  assert.deepEqual(
    outbound.filter((event) => event.type === 'conversation.item.delete'),
    [{ type: 'conversation.item.delete', item_id: first }],
  )
  assert.equal(outbound.filter((event) => event.type === 'response.create').length, 1)
  assert.equal(updates.filter((event) => event.type === 'frame').at(-1)?.frames, 3)
  assert.equal(updates.filter((event) => event.type === 'frame').at(-1)?.ready, true)
})

test('a frame-specific rejection releases single-flight upload while a session error closes it', (t) => {
  const { session, updates } = setup(t)

  session.receive({ type: 'session.updated' })
  session.sendFrame(frame)
  session.receive({
    type: 'error',
    error: { event_id: session.pendingFrameEventId, message: 'Image rejected' },
  })
  assert.equal(session.phase, 'listening')
  assert.equal(session.frames, 0)
  assert.equal(session.canSendFrame, true)
  assert.equal(session.frameTimeout, null)
  assert.match(updates.at(-1)?.message || '', /Image rejected/)
  acceptFrame(session)
  session.receive({ type: 'error', error: { message: 'Authentication expired' } })
  assert.equal(session.phase, 'error')
  assert.equal(session.socket, null)
})

test('uncertain image acknowledgement times out and closes rather than accumulating model context', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { session, counts } = setup(t)

  session.receive({ type: 'session.updated' })
  session.sendFrame(frame)
  t.mock.timers.tick(FRAME_ACK_TIMEOUT_MS)
  assert.equal(session.phase, 'error')
  assert.equal(session.frameTimeout, null)
  assert.equal(session.openingTimeout, null)
  assert.equal(session.canSendFrame, false)
  assert.equal(counts().socketClosed, 1)
})

test('missing initial images and missing greeting completion have bounded lifetimes', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const first = setup(t)

  first.session.receive({ type: 'session.updated' })
  t.mock.timers.tick(OPENING_TIMEOUT_MS)
  assert.equal(first.session.phase, 'error')
  assert.match(first.updates.at(-1)?.message || '', /No camera frame/)
  const second = setup(t)

  second.session.receive({ type: 'session.updated' })
  acceptFrame(second.session)
  t.mock.timers.tick(OPENING_TIMEOUT_MS)
  assert.equal(second.session.phase, 'error')
  assert.match(second.updates.at(-1)?.message || '', /Axel did not answer/)
})

test('camera pause removes pending and retained images, ignores late ACKs, and updates instructions', (t) => {
  const { session, outbound, updates } = setup(t)

  session.receive({ type: 'session.updated' })
  const first = acceptFrame(session)

  session.sendFrame(frame)
  const pending = session.pendingFrameId

  session.setCameraEnabled(false)
  assert.equal(session.canSendFrame, false)
  assert.equal(session.frameTimeout, null)
  assert.deepEqual(session.frameItemIds, [])
  assert.deepEqual(
    outbound.filter((event) => event.type === 'conversation.item.delete').map((event) => event.item_id),
    [pending, first],
  )
  assert.match(outbound.at(-1)?.session?.instructions || '', /camera is off/)
  session.receive({ type: 'conversation.item.added', item: { id: pending } })
  assert.equal(session.frames, 1)
  assert.deepEqual(session.frameItemIds, [])
  session.setCameraEnabled(true)
  assert.equal(session.canSendFrame, true)
  assert.match(outbound.at(-1)?.session?.instructions || '', /camera is on/)
  assert.equal(updates.filter((event) => event.type === 'frame-request').length, 2)
  assert.equal(outbound.filter((event) => event.type === 'response.create').length, 1)
})

test('camera-disabled sessions still greet without claiming vision', (t) => {
  const { session, outbound, updates } = setup(t)

  session.cameraEnabled = false
  session.instructions = (JSON.parse(createSessionConfig(false)) as RealtimeSessionConfig).instructions
  session.receive({ type: 'session.updated' })
  assert.equal(session.startGreeting(), false, 'an explicit worker call must not duplicate the greeting')
  assert.equal(session.canSendFrame, false)
  assert.equal(updates.filter((event) => event.type === 'frame-request').length, 0)
  assert.equal(outbound.filter((event) => event.type === 'response.create').length, 1)
  assert.match(outbound.at(-1)?.response?.instructions || '', /do not claim to see anything/)
})

for (const fullDuplex of [false, true]) {
test(`greeting microphone holdoff requires completion and audible drain (full duplex: ${fullDuplex})`, (t) => {
  const { session, audio, counts, microphoneTrack } = setup(t)
  session.fullDuplex = fullDuplex

  session.receive({ type: 'session.updated' })
  acceptFrame(session)
  session.receive({ type: 'response.created', response: { id: 'opening' } })
  assert.equal(microphoneTrack.enabled, fullDuplex, 'full duplex trains AEC locally; half duplex detaches capture')
  session.receive({
    type: 'response.output_audio.delta',
    response_id: 'opening',
    item_id: 'greeting',
    delta: 'AAAA',
  })
  session.receive({ type: 'input_audio_buffer.speech_started' })
  assert.equal(session.playing, true, 'captured greeting echo must not interrupt the opening')
  session.receive({ type: 'response.done', response: { id: 'opening', status: 'completed' } })
  let greetingPackets = 2
  Object.assign(audio, { readBase64: () => greetingPackets > 0 ? (--greetingPackets, 'AAAA') : '' })
  session.pollAudio()
  assert.equal(greetingPackets, fullDuplex ? 0 : 2, 'local greeting audio must be discarded while AEC trains')
  assert.equal(counts().attachments, 0)
  assert.equal(microphoneTrack.enabled, fullDuplex)
  assert.equal(counts().pipes, 0, 'protocol completion must not upload before audible drain')
  assert.equal(session.phase, 'speaking')
  Object.assign(audio, { drained: true })
  session.pollAudio()
  session.pollAudio()
  assert.equal(counts().attachments, fullDuplex ? 0 : 1)
  assert.equal(counts().pipes, 1)
  assert.equal(microphoneTrack.enabled, true)
  assert.equal(session.openingTimeout, null)
  assert.equal(session.phase, 'listening')
  session.interrupt()
  assert.equal(counts().attachments, fullDuplex ? 0 : 1, 'barge-in must not restart native capture')
})
}

test('full duplex keeps capture enabled across three replies and permits barge-in', (t) => {
  const { session, audio, microphoneTrack } = setup(t)
  session.fullDuplex = true
  session.opening = false
  for (let turn = 1; turn <= 3; turn++) {
    const id = `reply-${turn}`
    session.receive({ type: 'response.created', response: { id } })
    assert.equal(microphoneTrack.enabled, true)
    session.receive({ type: 'response.output_audio.delta', response_id: id, item_id: id, delta: 'AAAA' })
    assert.equal(microphoneTrack.enabled, true)
    session.receive({ type: 'response.done', response: { id, status: 'completed' } })
    Object.assign(audio, { drained: true })
    session.pollAudio()
    assert.equal(session.phase, 'listening')
    assert.equal(microphoneTrack.enabled, true)
  }
  session.receive({ type: 'response.created', response: { id: 'interrupted' } })
  session.receive({ type: 'response.output_audio.delta', response_id: 'interrupted', item_id: 'interrupted', delta: 'AAAA' })
  session.receive({ type: 'input_audio_buffer.speech_started' })
  assert.equal(session.playing, false)
  assert.equal(session.cancelledResponseId, 'interrupted')
  assert.equal(session.phase, 'listening')
  assert.equal(microphoneTrack.enabled, true)
})

test('every reply detaches half-duplex capture until audible drain; cancellation resumes it', (t) => {
  const { session, audio, microphoneTrack } = setup(t)

  session.receive({ type: 'response.created', response: { id: 'reply' } })
  assert.equal(microphoneTrack.enabled, false)
  session.receive({
    type: 'response.output_audio.delta',
    response_id: 'reply',
    item_id: 'reply-item',
    delta: 'AAAA',
  })
  session.receive({ type: 'response.done', response: { id: 'reply', status: 'completed' } })
  session.pollAudio()
  assert.equal(microphoneTrack.enabled, false)
  Object.assign(audio, { drained: true })
  session.pollAudio()
  assert.equal(microphoneTrack.enabled, true)
  session.receive({ type: 'response.created', response: { id: 'cancelled' } })
  assert.equal(microphoneTrack.enabled, false)
  session.receive({ type: 'response.done', response: { id: 'cancelled', status: 'cancelled' } })
  assert.equal(microphoneTrack.enabled, true)
  assert.equal(session.phase, 'listening')
})

test('an empty completed response also releases half-duplex capture', (t) => {
  const { session, audio, microphoneTrack } = setup(t)

  session.receive({ type: 'response.created', response: { id: 'empty' } })
  session.receive({ type: 'response.done', response: { id: 'empty', status: 'completed' } })
  Object.assign(audio, { drained: true })
  session.pollAudio()
  assert.equal(microphoneTrack.enabled, true)
  assert.equal(session.phase, 'listening')
})

test('barge-in truncates the audible item, deletes unheard items and rejects late audio', (t) => {
  const { session, audio, outbound, received, resets } = setup(t)

  session.receive({ type: 'response.created', response: { id: 'reply' } })
  for (const [itemId, milliseconds] of [
    ['first', 3900],
    ['second', 12000],
    ['third', 1000],
  ] as const) {
    session.receive({
      type: 'response.output_audio.delta',
      response_id: 'reply',
      item_id: itemId,
      delta: Buffer.alloc(milliseconds * 48).toString('base64'),
    })
  }

  Object.assign(audio, { playedMs: 9576 })
  session.receive({ type: 'input_audio_buffer.speech_started' })
  assert.equal(resets.at(-1), true)
  assert.deepEqual(outbound, [
    {
      type: 'conversation.item.truncate',
      item_id: 'second',
      content_index: 0,
      audio_end_ms: 5676,
    },
    { type: 'conversation.item.delete', item_id: 'third' },
  ])
  session.receive({ type: 'response.output_audio.delta', response_id: 'reply', delta: 'AAAA' })
  assert.equal(received.length, 3)
})

test('a new response preempts unplayed output and item completion excludes base64 padding', (t) => {
  const { session, audio, outbound, received, resets } = setup(t)

  session.receive({ type: 'response.created', response: { id: 'old' } })
  session.receive({
    type: 'response.output_audio.delta',
    response_id: 'old',
    item_id: 'old-item',
    delta: Buffer.alloc(4802).toString('base64'),
  })
  session.receive({ type: 'response.output_audio.done', response_id: 'old' })
  Object.assign(audio, { drained: true, playedMs: 9576 })
  session.pollAudio()
  assert.equal(session.phase, 'speaking', 'item completion is not response completion')
  assert.equal(session.receivedAudioFrames, 2401)
  session.receive({ type: 'response.created', response: { id: 'new' } })
  assert.equal(resets.at(-1), true)
  assert.equal(outbound[0]?.audio_end_ms, 100)
  session.receive({ type: 'response.output_audio.delta', response_id: 'old', delta: 'BBBB' })
  session.receive({
    type: 'response.output_audio.delta',
    response_id: 'new',
    item_id: 'new-item',
    delta: 'CCCC',
  })
  assert.equal(received.length, 2)
  assert.equal(received.at(-1), 'CCCC')
})

test('Stop releases resources and timers; late image acknowledgements cannot revive the session', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { session, counts, outbound } = setup(t)

  session.receive({ type: 'session.updated' })
  acceptFrame(session)
  session.sendFrame(frame)
  const pending = session.pendingFrameId
  const events = outbound.length

  session.stop()
  session.receive({ type: 'conversation.item.added', item: { id: pending } })
  t.mock.timers.tick(OPENING_TIMEOUT_MS + FRAME_ACK_TIMEOUT_MS)
  assert.equal(session.phase, 'idle')
  assert.equal(session.ready, false)
  assert.equal(session.frameTimeout, null)
  assert.equal(session.openingTimeout, null)
  assert.equal(session.socket, null)
  assert.equal(session.frames, 0)
  assert.deepEqual(session.frameItemIds, [])
  assert.equal(outbound.length, events)
  assert.deepEqual(counts(), {
    attachments: 0,
    pipes: 0,
    audioClosed: 1,
    socketClosed: 1,
    microphoneStopped: 1,
  })
})

test('Stop during microphone acquisition stops the late stream without opening transport', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  let resolve: ((stream: MediaStream) => void) | undefined
  let stopped = 0

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: () =>
          new Promise<MediaStream>((done) => {
            resolve = done
          }),
      },
    },
  })
  t.after(() => {
    if (descriptor) {
      Object.defineProperty(globalThis, 'navigator', descriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'navigator')
    }
  })
  const session = new RealtimeSession(() => {})
  const starting = session.start({
    type: 'start',
    apiKey: 'test-key',
    sessionConfig: createSessionConfig(),
    sampleRate: 24000,
  })

  session.stop()
  resolve?.({ getTracks: () => [{ stop: () => ++stopped }] } as unknown as MediaStream)
  await starting
  assert.equal(stopped, 1)
  assert.equal(session.audio, null)
  assert.equal(session.socket, null)
  assert.equal(session.phase, 'idle')
})
