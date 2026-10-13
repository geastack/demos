import { Camera, type DedicatedWorkerGlobalScope } from "@geastack/core";
import { RealtimeSession, type SessionStart } from "../services/RealtimeSession.js";

const workerScope: DedicatedWorkerGlobalScope = self;

interface Command {
  type: string;
  enabled?: boolean;
}

let cameraEnabled = false;
let timer: ReturnType<typeof setInterval> | null = null;
let nextFrameAt = 0;
let lastFrameAt = 0;

function closeCamera(): void {
  cameraEnabled = false;
  if (timer !== null) clearInterval(timer);
  timer = null;
  Camera.close();
}

function cameraUpdate(ready: boolean, message = ""): void {
  workerScope.postMessage(JSON.stringify({ type: "camera", ready, enabled: cameraEnabled, message }));
}

const session = new RealtimeSession((message) => {
  const update = JSON.parse(message) as { type: string; phase?: string };
  if (update.type === "frame-request") {
    if (cameraEnabled) {
      lastFrameAt = Date.now();
      captureFrame();
    } else session.startGreeting();
  } else {
    if (update.phase === "error" || update.phase === "idle") closeCamera();
    workerScope.postMessage(message);
  }
});

function captureFrame(): void {
  if (cameraEnabled && session.ready && lastFrameAt > 0 && Date.now() - lastFrameAt > 15000) {
    closeCamera();
    session.fail("Camera frames stopped. Check the left-slot module and retry.");
    return;
  }
  if (!cameraEnabled || !session.canSendFrame || Date.now() < nextFrameAt) return;
  const imageUrl = Camera.captureFrame();
  if (imageUrl && session.sendFrame(imageUrl)) {
    lastFrameAt = Date.now();
    nextFrameAt = Date.now() + 2000;
  }
}

function openCamera(): boolean {
  if (!Camera.isAvailable() || !Camera.open({ facing: "back", width: 320, height: 240 })) return false;
  cameraEnabled = true;
  nextFrameAt = 0;
  lastFrameAt = session.ready ? Date.now() : 0;
  timer = setInterval(captureFrame, 150);
  cameraUpdate(false, "Camera warming up…");
  return true;
}

workerScope.onmessage = async (event) => {
  if (typeof event.data !== "string") return;
  try {
    const command = JSON.parse(event.data) as Command;
    if (command.type === "start") {
      const options = JSON.parse(event.data) as SessionStart;
      closeCamera();
      if (options.cameraEnabled !== false && !openCamera()) {
        session.fail("Camera unavailable. Check the left slot, or turn camera off to talk.");
        return;
      }
      await session.start(options);
    } else if (command.type === "camera") {
      if (command.enabled) {
        if (!cameraEnabled && !openCamera()) {
          cameraUpdate(false, "Camera unavailable. Check the left slot.");
          return;
        }
      } else {
        closeCamera();
        cameraUpdate(false, "Camera off. Voice is still connected.");
      }
      session.setCameraEnabled(cameraEnabled);
    } else if (command.type === "stop") {
      closeCamera();
      session.stop();
      workerScope.close();
    }
  } catch (error) {
    closeCamera();
    session.fail(error instanceof Error ? error.message : "Conversation worker failed.");
  }
};
