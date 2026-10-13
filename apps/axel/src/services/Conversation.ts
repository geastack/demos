// Adapted from Spark's worker lifecycle. Copyright 2026 Geastack contributors.
// SPDX-License-Identifier: GPL-3.0-only
import type { Worker } from "@geastack/core";
import type { ConversationPhase } from "./phases.js";

export interface ConversationUpdate {
  type: "state" | "level" | "frame" | "camera";
  phase?: ConversationPhase;
  message?: string;
  level?: number;
  frames?: number;
  ready?: boolean;
  enabled?: boolean;
}

export class Conversation {
  phase: ConversationPhase = "idle";
  generation = 0;
  level = 0;
  worker: Worker | null = null;
  closeTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly onChange: (update: ConversationUpdate) => void;

  constructor(onChange: (update: ConversationUpdate) => void) {
    this.onChange = onChange;
  }

  update(phase: ConversationPhase, message: string): void {
    this.phase = phase;
    this.onChange({ type: "state", phase, message });
  }

  start(apiKey: string, sessionConfig: string, cameraEnabled: boolean): void {
    if (this.worker || (this.phase !== "idle" && this.phase !== "error")) return;
    if (!apiKey) {
      this.update("error", "Set OPENAI_API_KEY in .env and rebuild.");
      return;
    }
    const generation = ++this.generation;
    this.update("connecting", "Waking up Axel…");
    try {
      const worker = new Worker(new URL("../workers/conversation.worker.ts", import.meta.url), {
        type: "module",
        name: "axel-conversation",
      });
      this.worker = worker;
      worker.onmessage = (event) => {
        if (generation !== this.generation || typeof event.data !== "string") return;
        try {
          const update = JSON.parse(event.data) as ConversationUpdate;
          if (this.phase === "closing" && update.phase !== "idle" && update.phase !== "error") return;
          if (update.type === "level") {
            this.level = update.level || 0;
          } else if (update.type === "state" && update.phase) {
            if (update.phase === "idle" || update.phase === "error") this.cleanup();
            this.update(update.phase, update.message || "");
          } else if (update.type === "camera" || update.type === "frame") {
            this.onChange(update);
          }
        } catch {
          this.fail("Invalid conversation update.");
        }
      };
      worker.onerror = (event) => {
        if (generation === this.generation) this.fail(event.message || "Conversation worker failed.");
      };
      worker.postMessage(JSON.stringify({ type: "start", apiKey, sessionConfig, sampleRate: 24000, cameraEnabled }));
    } catch (error) {
      if (generation === this.generation) this.fail(error instanceof Error ? error.message : "Could not connect.");
    }
  }

  setCameraEnabled(enabled: boolean): void {
    try {
      if (this.phase !== "closing") this.worker?.postMessage(JSON.stringify({ type: "camera", enabled }));
    } catch {
      this.fail("Camera control failed. Tap Start to reconnect.");
    }
  }

  fail(message: string): void {
    this.cleanup();
    this.update("error", message);
  }

  stop(): void {
    if (this.phase === "closing") return;
    this.level = 0;
    this.update("closing", "Going to sleep…");
    if (!this.worker) {
      this.update("idle", "Ready when you are.");
      return;
    }
    // A crashed worker must not leave the Stop control permanently locked.
    this.closeTimeout = setTimeout(() => this.fail("Stop timed out. Tap Start to retry."), 5000);
    try {
      this.worker.postMessage(JSON.stringify({ type: "stop" }));
    } catch {
      this.fail("Could not stop the worker. Tap Start to retry.");
    }
  }

  cleanup(): void {
    ++this.generation;
    if (this.closeTimeout !== null) clearTimeout(this.closeTimeout);
    this.closeTimeout = null;
    const worker = this.worker;
    this.worker = null;
    this.level = 0;
    worker?.terminate();
  }
}
