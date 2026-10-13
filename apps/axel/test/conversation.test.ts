import assert from "node:assert/strict";
import test from "node:test";
import { Conversation } from "../src/services/Conversation.ts";

function setup(t: test.TestContext) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  const commands: string[] = [];
  let terminated = 0;
  const worker = {
    onmessage: null as ((event: { data: string }) => void) | null,
    onerror: null as ((event: { message: string }) => void) | null,
    postMessage(message: string) { commands.push(message); },
    terminate() { terminated++; },
  };
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: function () { return worker; },
  });
  const updates: { type: string; phase?: string; frames?: number }[] = [];
  const conversation = new Conversation((update) => updates.push(update));
  t.after(() => {
    conversation.cleanup();
    if (original) Object.defineProperty(globalThis, "Worker", original);
    else Reflect.deleteProperty(globalThis, "Worker");
  });
  return { conversation, worker, updates, commands, count: () => terminated };
}

test("start requires credentials and sends one configured worker command", (t) => {
  const { conversation, commands } = setup(t);
  conversation.start("", "{}", true);
  assert.equal(conversation.phase, "error");
  assert.equal(commands.length, 0);
  conversation.start("test-key", "{}", true);
  conversation.start("test-key", "{}", true);
  assert.deepEqual(commands.map((command) => JSON.parse(command)), [{
    type: "start", apiKey: "test-key", sessionConfig: "{}", sampleRate: 24000, cameraEnabled: true,
  }]);
});

test("stop waits for native cleanup acknowledgement and ignores queued state", (t) => {
  const { conversation, worker, commands, count } = setup(t);
  conversation.start("test-key", "{}", true);
  const lateHandler = worker.onmessage!;
  conversation.stop();
  assert.equal(conversation.phase, "closing");
  assert.equal(count(), 0);
  worker.onmessage!({ data: JSON.stringify({ type: "state", phase: "speaking" }) });
  assert.equal(conversation.phase, "closing");
  conversation.start("test-key", "{}", true);
  assert.equal(commands.length, 2);
  worker.onmessage!({ data: JSON.stringify({ type: "state", phase: "idle" }) });
  assert.equal(conversation.phase, "idle");
  assert.equal(count(), 1);
  lateHandler({ data: JSON.stringify({ type: "state", phase: "speaking" }) });
  assert.equal(conversation.phase, "idle");
});

test("camera acknowledgements propagate while audio levels remain local", (t) => {
  const { conversation, worker, updates, commands } = setup(t);
  conversation.start("test-key", "{}", true);
  worker.onmessage!({ data: JSON.stringify({ type: "level", level: 0.42 }) });
  worker.onmessage!({ data: JSON.stringify({ type: "frame", frames: 2, ready: true }) });
  assert.equal(conversation.level, 0.42);
  assert.equal(updates.at(-1)?.frames, 2);
  conversation.setCameraEnabled(false);
  assert.deepEqual(JSON.parse(commands.at(-1)!), { type: "camera", enabled: false });
});

test("worker errors release lifecycle and prevent stale callbacks", (t) => {
  const { conversation, worker, count } = setup(t);
  conversation.start("test-key", "{}", true);
  const lateHandler = worker.onmessage!;
  worker.onerror!({ message: "Worker crashed" });
  assert.equal(conversation.phase, "error");
  assert.equal(conversation.worker, null);
  assert.equal(count(), 1);
  lateHandler({ data: JSON.stringify({ type: "state", phase: "listening" }) });
  assert.equal(conversation.phase, "error");
});

test("a dead worker cannot leave Stop permanently disabled", (t) => {
  const { conversation, worker } = setup(t);
  conversation.start("test-key", "{}", true);
  worker.postMessage = () => { throw new Error("Worker is closed"); };
  conversation.stop();
  assert.equal(conversation.phase, "error");
  assert.equal(conversation.closeTimeout, null);
  assert.equal(conversation.worker, null);
});
