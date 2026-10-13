// The audio lifecycle is adapted from Geastack Spark (GPL-3.0-only).
import type { MediaStream, PcmAudioStream, WebSocketConstructor, WebSocketInstance } from "@geastack/core";
import type { RealtimeSessionConfig, TurnDetectionConfig } from "../config/session.js";
import { createSessionConfig, AXEL_INSTRUCTIONS } from "../config/session.ts";
import type { ConversationPhase } from "./phases.js";

declare const WebSocket: WebSocketConstructor;

interface RealtimeEvent {
  type: string;
  delta?: string;
  item_id?: string;
  response_id?: string;
  content_index?: number;
  item?: { id?: string };
  error?: { code?: string; message?: string; event_id?: string };
  response?: { id?: string; status?: "completed" | "cancelled" | "failed" | "incomplete" };
  session?: { audio?: { input?: { turn_detection?: TurnDetectionConfig } } };
}

export interface SessionStart {
  type: "start";
  apiKey: string;
  sessionConfig: string;
  sampleRate: number;
  cameraEnabled?: boolean;
  captureMicrophone?: boolean;
  fullDuplex?: boolean;
  /** Optional diagnostic gateway; production connects directly to OpenAI. */
  realtimeUrl?: string;
}

interface PlaybackItem {
  itemId: string;
  contentIndex: number;
  startFrame: number;
  frames: number;
}

export const MAX_FRAME_BUFFER_BYTES = 64 * 1024;
export const MAX_FRAME_DATA_URL_LENGTH = 256 * 1024;
export const FRAME_ACK_TIMEOUT_MS = 10000;
export const OPENING_TIMEOUT_MS = 20000;

export class RealtimeSession {
  socket: WebSocketInstance | null = null;
  audio: PcmAudioStream | null = null;
  microphone: MediaStream | null = null;
  audioTimer: ReturnType<typeof setInterval> | null = null;
  phase: ConversationPhase = "idle";
  generation = 0;
  ready = false;
  opening = false;
  greetingRequested = false;
  cameraEnabled = true;
  fullDuplex = true;
  sessionConfig: RealtimeSessionConfig | null = null;
  instructions = AXEL_INSTRUCTIONS;
  playing = false;
  outputDone = false;
  responseId = "";
  cancelledResponseId = "";
  itemId = "";
  playbackItems: PlaybackItem[] = [];
  playedFrames = 0;
  sampleRate = 24000;
  receivedAudioFrames = 0;
  timeout: ReturnType<typeof setTimeout> | null = null;
  openingTimeout: ReturnType<typeof setTimeout> | null = null;
  frameTimeout: ReturnType<typeof setTimeout> | null = null;
  pendingFrameId = "";
  pendingFrameEventId = "";
  frameSequence = 0;
  frames = 0;
  frameItemIds: string[] = [];
  readonly notify: (message: string) => void;

  constructor(notify: (message: string) => void) {
    this.notify = notify;
  }

  get canSendFrame(): boolean {
    const socket = this.socket;

    return (
      this.cameraEnabled &&
      this.ready &&
      !this.pendingFrameId &&
      socket !== null &&
      socket.readyState === 1 &&
      socket.bufferedAmount <= MAX_FRAME_BUFFER_BYTES
    );
  }

  update(phase: ConversationPhase, message: string): void {
    this.phase = phase;
    this.notify(JSON.stringify({ type: "state", phase, message }));
  }

  frameUpdate(message = "", itemId = ""): void {
    this.notify(
      JSON.stringify({
        type: "frame",
        frames: this.frames,
        ready: this.canSendFrame,
        message,
        itemId,
      }),
    );
  }

  async start(options: SessionStart): Promise<void> {
    this.cleanup();
    const generation = this.generation;
    const config = JSON.parse(options.sessionConfig) as RealtimeSessionConfig;

    this.sessionConfig = config;
    this.cameraEnabled = options.cameraEnabled !== false;
    this.fullDuplex = options.fullDuplex !== false;
    this.instructions = config.instructions || AXEL_INSTRUCTIONS;
    this.sampleRate = options.sampleRate;
    const microphone =
      options.captureMicrophone === false ? null : await navigator.mediaDevices.getUserMedia({ audio: true });

    if (generation !== this.generation) {
      for (const track of microphone?.getTracks() || []) {
        track.stop();
      }

      return;
    }

    this.microphone = microphone;
    // Train AEC locally during the greeting, without uploading microphone audio.
    this.opening = true;
    this.setMicrophoneEnabled(false);
    this.audio = new PcmAudioStream(options.sampleRate);
    if (this.fullDuplex && microphone) this.audio.setInput(microphone);
    this.audioTimer = setInterval(() => this.pollAudio(), 40);
    this.update("connecting", "Connecting to Axel…");
    const socket = new WebSocket(options.realtimeUrl ?? `wss://api.openai.com/v1/realtime?model=${config.model}`, [
      "realtime",
      `openai-insecure-api-key.${options.apiKey}`,
    ]);

    this.socket = socket;
    socket.onopen = () => {
      if (generation === this.generation) {
        socket.send(JSON.stringify({ type: "session.update", session: this.sessionConfig || config }));
      }
    };

    socket.onmessage = (event) => {
      if (generation !== this.generation || typeof event.data !== "string") {
        return;
      }

      try {
        this.receive(JSON.parse(event.data) as RealtimeEvent);
      } catch (error) {
        this.fail(error instanceof Error ? error.message : "Invalid realtime event.");
      }
    };

    socket.onerror = (event) => {
      if (generation === this.generation) {
        this.fail(event.message && event.message !== "error" ? event.message : "Connection failed. Tap Start to retry.");
      }
    };

    socket.onclose = () => {
      if (generation === this.generation) {
        this.fail("Connection closed. Tap Start to reconnect.");
      }
    };

    this.timeout = setTimeout(() => {
      if (generation === this.generation && !this.ready) {
        this.fail("Connection timed out. Tap Start to retry.");
      }
    }, 20000);
  }

  /** Appends visual context; user speech, rather than each frame, triggers replies. */
  sendFrame(imageUrl: string): boolean {
    const socket = this.socket;

    if (!this.canSendFrame || !socket) {
      this.frameUpdate();

      return false;
    }

    if (
      imageUrl.length > MAX_FRAME_DATA_URL_LENGTH ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(imageUrl)
    ) {
      this.frameUpdate("Camera frame must be a bounded JPEG data URL.");

      return false;
    }

    const generation = this.generation;
    const itemId = `axel-frame-${generation}-${++this.frameSequence}`;
    const eventId = `${itemId}-create`;

    this.pendingFrameId = itemId;
    this.pendingFrameEventId = eventId;
    this.frameTimeout = setTimeout(() => {
      if (generation === this.generation && this.pendingFrameId === itemId) {
        // An unknown acknowledgement state cannot safely be retried: close the
        // session rather than accumulate untracked images in model context.
        this.fail("Camera upload timed out. Tap Start to reconnect.");
      }
    }, FRAME_ACK_TIMEOUT_MS);
    try {
      socket.send(
        JSON.stringify({
          type: "conversation.item.create",
          event_id: eventId,
          item: {
            id: itemId,
            type: "message",
            role: "user",
            content: [{ type: "input_image", image_url: imageUrl }],
          },
        }),
      );
    } catch (error) {
      this.fail(error instanceof Error ? error.message : "Could not upload the camera frame.");

      return false;
    }

    return true;
  }

  /** Camera pause also removes visual context and changes the agent's instructions. */
  setCameraEnabled(enabled: boolean): void {
    if (enabled === this.cameraEnabled) {
      return;
    }

    this.cameraEnabled = enabled;
    const config = JSON.parse(createSessionConfig(enabled)) as RealtimeSessionConfig;

    this.instructions = config.instructions;
    if (this.sessionConfig) {
      this.sessionConfig.instructions = this.instructions;
    }

    if (!enabled) {
      const pending = this.pendingFrameId;

      this.clearPendingFrame();
      if (pending) {
        this.socket?.send(JSON.stringify({ type: "conversation.item.delete", item_id: pending }));
      }

      for (const itemId of this.frameItemIds) {
        this.socket?.send(JSON.stringify({ type: "conversation.item.delete", item_id: itemId }));
      }

      this.frameItemIds = [];
    }

    if (this.socket?.readyState === 1) {
      this.socket.send(JSON.stringify({ type: "session.update", session: this.sessionConfig || config }));
      if (this.ready && enabled) {
        this.notify(JSON.stringify({ type: "frame-request" }));
      } else if (this.ready) {
        this.startGreeting();
      }
    }

    this.frameUpdate();
  }

  /** Called after the first accepted frame, or explicitly for a camera-disabled session. */
  startGreeting(): boolean {
    const socket = this.socket;

    if (!this.ready || !socket || socket.readyState !== 1 || this.greetingRequested) {
      return false;
    }

    this.greetingRequested = true;
    this.opening = true;
    this.setMicrophoneEnabled(false);
    this.waitForOpening("Axel did not answer. Tap Start to retry.");
    socket.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions: `${this.instructions}\n\nOpening turn: introduce yourself as Axel in one brief sentence.${
            this.cameraEnabled && this.frameItemIds.length
              ? " Add one short, grounded observation about the latest camera image."
              : " The camera is unavailable; explain that you can still talk, and do not claim to see anything."
          }`,
        },
      }),
    );
    this.update("thinking", "Axel is waking up…");

    return true;
  }

  waitForOpening(message: string): void {
    if (this.openingTimeout !== null) {
      clearTimeout(this.openingTimeout);
    }

    const generation = this.generation;

    this.openingTimeout = setTimeout(() => {
      if (generation === this.generation && this.opening) {
        this.fail(message);
      }
    }, OPENING_TIMEOUT_MS);
  }

  acknowledgeFrame(itemId: string): void {
    if (!itemId || itemId !== this.pendingFrameId) {
      return;
    }

    this.clearPendingFrame();
    this.frames++;
    this.frameItemIds.push(itemId);
    while (this.frameItemIds.length > 2) {
      const expired = this.frameItemIds.shift();

      this.socket?.send(JSON.stringify({ type: "conversation.item.delete", item_id: expired }));
    }

    if (!this.greetingRequested) {
      this.startGreeting();
    }

    this.frameUpdate("", itemId);
  }

  clearPendingFrame(): void {
    if (this.frameTimeout !== null) {
      clearTimeout(this.frameTimeout);
    }

    this.frameTimeout = null;
    this.pendingFrameId = this.pendingFrameEventId = "";
  }

  setMicrophoneEnabled(enabled: boolean): void {
    if (this.fullDuplex && !enabled) return;
    for (const track of this.microphone?.getAudioTracks() || []) {
      track.enabled = enabled;
    }
  }

  pollAudio(): void {
    const audio = this.audio;

    if (!audio) {
      return;
    }

    this.playedFrames = Math.floor((audio.playedMs * this.sampleRate) / 1000);
    this.notify(JSON.stringify({ type: "level", level: audio.audioLevel }));
    if (this.opening && this.fullDuplex) {
      // Drain locally so the capture ring cannot retain greeting echo or overflow.
      for (let packet = 0; packet < 8; packet++) {
        if (!audio.readBase64()) break;
      }
    }
    if (this.opening && this.greetingRequested && this.outputDone && audio.drained) {
      // Discard captured greeting echo before enabling microphone upload.
      if (!this.fullDuplex && this.microphone) {
        audio.setInput(this.microphone);
      }
      if (this.socket) audio.pipeTo(this.socket, '{"type":"input_audio_buffer.append","audio":"', '"}');

      this.opening = false;
      this.setMicrophoneEnabled(true);
      if (this.openingTimeout !== null) {
        clearTimeout(this.openingTimeout);
        this.openingTimeout = null;
      }

      if (!this.playing) {
        this.update("listening", "I’m listening.");
      }
    }

    if ((this.playing || this.phase === "thinking") && this.outputDone && audio.drained) {
      this.playing = false;
      this.itemId = "";
      this.setMicrophoneEnabled(true);
      this.update("listening", "I’m listening.");
    }
  }

  resetPlayback(interrupted = false): void {
    this.playedFrames = 0;
    this.receivedAudioFrames = 0;
    this.playbackItems = [];
    this.audio?.resetPlayback(interrupted);
    this.notify(JSON.stringify({ type: "level", level: 0 }));
  }

  interrupt(resumeMicrophone = true): void {
    const playedFrames = Math.floor(((this.audio?.playedMs || 0) * this.sampleRate) / 1000);
    const items = this.playbackItems;

    this.cancelledResponseId = this.responseId;
    this.resetPlayback(true);
    if (this.playing && items.length) {
      let audibleIndex = 0;

      for (let index = 1; index < items.length; index++) {
        if (items[index]!.startFrame <= playedFrames) {
          audibleIndex = index;
        }
      }

      const audible = items[audibleIndex]!;
      const heardFrames = Math.max(0, Math.min(audible.frames, playedFrames - audible.startFrame));
      const audioEndMs = Math.floor((heardFrames * 1000) / this.sampleRate);

      this.socket?.send(
        JSON.stringify({
          type: "conversation.item.truncate",
          item_id: audible.itemId,
          content_index: audible.contentIndex,
          audio_end_ms: audioEndMs,
        }),
      );

      let lastDeletedItem = audible.itemId;

      for (let index = audibleIndex + 1; index < items.length; index++) {
        const later = items[index]!;

        if (later.itemId !== lastDeletedItem && later.itemId !== audible.itemId) {
          this.socket?.send(JSON.stringify({ type: "conversation.item.delete", item_id: later.itemId }));
          lastDeletedItem = later.itemId;
        }
      }
    }

    this.itemId = "";
    this.playing = false;
    this.outputDone = false;
    if (resumeMicrophone) {
      if (this.opening && this.greetingRequested) {
        if (!this.fullDuplex && this.microphone) {
          this.audio?.setInput(this.microphone);
        }
        if (this.audio && this.socket) this.audio.pipeTo(this.socket, '{"type":"input_audio_buffer.append","audio":"', '"}');

        this.opening = false;
        if (this.openingTimeout !== null) {
          clearTimeout(this.openingTimeout);
          this.openingTimeout = null;
        }
      }

      this.setMicrophoneEnabled(true);
    }

    this.update("listening", "I’m listening.");
  }

  receive(event: RealtimeEvent): void {
    if (this.phase === "idle" || this.phase === "closing" || this.phase === "error") {
      return;
    }

    if (event.type === "session.updated" && !this.ready) {
      this.ready = true;
      if (this.timeout !== null) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }

      this.opening = true;

      this.waitForOpening("No camera frame arrived. Tap Start to retry.");
      this.update("listening", "Waiting for the first camera image…");
      if (this.cameraEnabled) {
        this.notify(JSON.stringify({ type: "frame-request" }));
      } else {
        this.startGreeting();
      }
    } else if (event.type === "conversation.item.added" || event.type === "conversation.item.created") {
      this.acknowledgeFrame(event.item?.id || "");
    } else if (event.type === "input_audio_buffer.speech_started" && !this.opening) {
      this.interrupt();
    } else if (event.type === "response.created") {
      if (this.playing) {
        this.interrupt(false);
      }

      this.setMicrophoneEnabled(false);
      this.responseId = event.response?.id || "";
      this.outputDone = false;
      this.update("thinking", "One moment…");
    } else if (event.type === "response.output_audio.delta") {
      if (
        !event.delta ||
        (event.response_id && (event.response_id === this.cancelledResponseId || event.response_id !== this.responseId))
      ) {
        return;
      }

      if (!this.playing) {
        this.resetPlayback();
        this.itemId = event.item_id || "";
        this.playing = true;
        this.update("speaking", "");
      }

      const padding = event.delta.endsWith("==") ? 2 : event.delta.endsWith("=") ? 1 : 0;
      const frames = Math.floor((Math.floor((event.delta.length * 3) / 4) - padding) / 2);
      const lastIndex = this.playbackItems.length - 1;
      let item = this.playbackItems[lastIndex];
      const itemId = event.item_id || this.itemId;
      const contentIndex = event.content_index || 0;

      if (!item || item.itemId !== itemId || item.contentIndex !== contentIndex) {
        item = { itemId, contentIndex, startFrame: this.receivedAudioFrames, frames: 0 };
        this.playbackItems.push(item);
      }

      item.frames += frames;
      this.receivedAudioFrames += frames;
      this.audio?.writeBase64(event.delta);
    } else if (
      event.type === "response.done" &&
      (event.response?.status === "completed" || event.response?.status === "incomplete") &&
      event.response.id === this.responseId &&
      this.responseId !== this.cancelledResponseId
    ) {
      this.outputDone = true;
    } else if (
      (event.type === "response.cancelled" ||
        (event.type === "response.done" && event.response?.status === "cancelled")) &&
      (event.response?.id || event.response_id) === this.responseId &&
      this.responseId !== this.cancelledResponseId
    ) {
      this.interrupt();
    } else if (event.type === "response.done" && event.response?.status === "failed") {
      this.fail("The model could not complete its reply. Tap Start to retry.");
    } else if (event.type === "error") {
      if (this.pendingFrameEventId && event.error?.event_id === this.pendingFrameEventId) {
        const itemId = this.pendingFrameId;

        this.clearPendingFrame();
        this.frameUpdate(event.error.message || "The model rejected the camera image.", itemId);
      } else {
        this.fail(event.error?.message || "The realtime session reported an error.");
      }
    }
  }

  fail(message: string): void {
    this.cleanup();
    this.update("error", message);
  }

  stop(): void {
    this.cleanup();
    this.update("idle", "Ready when you are.");
  }

  cleanup(): void {
    this.generation++;
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.openingTimeout !== null) {
      clearTimeout(this.openingTimeout);
      this.openingTimeout = null;
    }

    this.clearPendingFrame();
    const socket = this.socket;
    const audio = this.audio;
    const microphone = this.microphone;

    if (this.audioTimer !== null) {
      clearInterval(this.audioTimer);
    }

    this.audioTimer = null;
    this.socket = null;
    this.audio = null;
    this.microphone = null;
    this.ready = this.opening = this.greetingRequested = this.playing = this.outputDone = false;
    this.responseId = this.cancelledResponseId = this.itemId = "";
    this.playedFrames = this.receivedAudioFrames = 0;
    this.playbackItems = [];
    this.frames = this.frameSequence = 0;
    this.frameItemIds = [];
    this.sessionConfig = null;
    audio?.close();
    for (const track of microphone?.getTracks() || []) {
      track.stop();
    }

    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      socket.close();
    }
  }
}
