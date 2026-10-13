import { Component } from "@geastack/core";
import agent from "../stores/AgentStore.js";

export default class App extends Component {
  template(): JSX.Element {
    return (
      <div class={agent.preview ? "axel-console previewing" : "axel-console"}>
        <canvas id="axel-face" class="axel-face" width={352} height={264} />
        <canvas id="axel-face-compact" class="axel-face-compact" width={184} height={264} />
        {agent.preview && <camera class="axel-preview" facing="back" fit="contain" mirror={false} style={{ height: agent.previewHeight }} />}
        <button class="axel-preview-control" disabled={agent.phase === "closing" || agent.phase === "connecting"} onClick={() => agent.togglePreview()}>
          {agent.preview ? "Hide camera" : "Preview camera"}
        </button>
        <div class="axel-readout">
          <div class={agent.phase === "error" ? "axel-status axel-status-error" : "axel-status"}>
            {agent.phase === "idle"
              ? "Hello, I’m Axel."
              : agent.phase === "connecting"
                ? "Connecting…"
                : agent.phase === "listening"
                  ? "I’m listening."
                  : agent.phase === "thinking"
                    ? "Let me think."
                    : agent.phase === "speaking"
                      ? "Talking…"
                      : agent.phase === "closing"
                        ? "Stopping…"
                        : "Couldn’t connect"}
          </div>
          <div class="axel-message">
            {agent.message ||
              (agent.active
                ? agent.cameraEnabled
                  ? "Talk to me about what’s in front of us."
                  : "Your camera is off. We can still talk."
                : "")}
          </div>
        </div>
        <div class="axel-controls">
          {/* biome-ignore lint/a11y/useButtonType: Native Gea buttons have no HTML form semantics. */}
          <button
            class={agent.active ? "axel-connect axel-connect-active" : "axel-connect"}
            disabled={agent.phase === "closing"}
            onClick={() => agent.toggle()}
          >
            {agent.phase === "closing" ? "Stopping…" : agent.active ? "Stop" : "Start talking"}
          </button>
          {/* biome-ignore lint/a11y/useButtonType: Native Gea buttons have no HTML form semantics. */}
          <button
            class={agent.cameraEnabled ? "axel-camera-control axel-camera-control-on" : "axel-camera-control"}
            disabled={agent.phase === "closing" || agent.phase === "connecting"}
            onClick={() => agent.toggleCamera()}
          >
            <div class={
              !agent.cameraEnabled ? "axel-camera-light" :
              agent.phase === "error" ? "axel-camera-light unavailable" :
              agent.active && !agent.sharing ? "axel-camera-light waiting" :
              "axel-camera-light ready"
            } />
            <div class="axel-camera-button-label">{agent.cameraEnabled ? "Camera on" : "Camera off"}</div>
          </button>
        </div>
      </div>
    );
  }
}
