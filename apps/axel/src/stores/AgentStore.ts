import { Camera, Store } from "@geastack/core";
import { createSessionConfig } from "../config/session.js";
import { Conversation } from "../services/Conversation.js";
import type { ConversationPhase } from "../services/phases.js";

class AgentStore extends Store {
  phase: ConversationPhase = "idle";
  message = "";
  level = 0;
  frames = 0;
  cameraReady = false;
  cameraEnabled = true;
  preview = false;
  previewHeight = 126;

  togglePreview(): void {
    if (this.phase === "closing" || this.phase === "connecting") return;
    if (!this.preview) {
      if (!Camera.open({ facing: "back" })) {
        this.message = "Camera unavailable. Check the left slot.";
        return;
      }
      this.previewHeight = Math.round(224 * Camera.height / Camera.width);
      this.preview = true;
    } else {
      this.preview = false;
      if (!this.active || !this.cameraEnabled) Camera.close();
    }
  }
  cameraFresh = false;
  lastAcceptedFrameAt = 0;

  get active(): boolean {
    return this.phase !== "idle" && this.phase !== "error";
  }

  get sharing(): boolean {
    return this.active && this.phase !== "closing" && this.cameraEnabled && this.cameraFresh;
  }

  animate(elapsed: number): void {
    this.cameraFresh = this.lastAcceptedFrameAt > 0 && Date.now() - this.lastAcceptedFrameAt < 6000;
    const target = this.phase === "speaking" ? Math.min(1, conversation.level * 5) : 0;
    const next = target >= this.level ? target : target + (this.level - target) * Math.exp(-elapsed / 80);
    this.level = Math.round(next * 255) / 255;
  }

  toggle(): void {
    if (this.phase === "closing") return;
    if (this.active) {
      conversation.stop();
    } else {
      this.frames = 0;
      this.cameraReady = false;
      this.cameraFresh = false;
      this.lastAcceptedFrameAt = 0;
      conversation.start(process.env.OPENAI_API_KEY, createSessionConfig(this.cameraEnabled), this.cameraEnabled);
    }
  }

  toggleCamera(): void {
    if (this.phase === "closing" || this.phase === "connecting") return;
    this.cameraEnabled = !this.cameraEnabled;
    this.cameraReady = false;
    this.cameraFresh = false;
    this.lastAcceptedFrameAt = 0;
    if (this.active) conversation.setCameraEnabled(this.cameraEnabled);
  }
}

const agent = new AgentStore();
const conversation = new Conversation((update) => {
  if (update.type === "state" && update.phase) {
    agent.phase = update.phase;
    agent.message = update.message || "";
    if (update.phase === "idle" || update.phase === "error") {
      agent.level = 0;
      agent.cameraReady = false;
      agent.cameraFresh = false;
      agent.lastAcceptedFrameAt = 0;
    }
  } else if (update.type === "frame") {
    if (update.frames !== undefined && update.frames > agent.frames) {
      agent.lastAcceptedFrameAt = Date.now();
      if (agent.message === "Camera warming up…") agent.message = "I’m listening.";
    }
    agent.frames = update.frames ?? agent.frames;
    agent.cameraReady = update.ready ?? false;
    if (update.message) agent.message = update.message;
  } else if (update.type === "camera") {
    agent.cameraReady = update.ready ?? false;
    agent.cameraEnabled = update.enabled ?? agent.cameraEnabled;
    if (!agent.cameraEnabled) agent.lastAcceptedFrameAt = 0;
    if (update.message) agent.message = update.message;
  }
});
export default agent;
