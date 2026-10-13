import { Audio, Display, mount, WiFi } from "@geastack/core";
import { paint, prime } from "./animations/face.js";
import App from "./components/App.js";
import agent from "./stores/AgentStore.js";
import "./styles/main.css";
import "../../../shared";

Audio.setVolume(70);
Display.setBrightness(80);
Display.setAutoRotate(false);
Display.setOrientation("landscape-primary");
Display.setFlushConfig({ rows: 2, depth: 2 });
WiFi.setEnabled(true);
mount(App);

let lastFrame = 0;
function animate(): void {
  const now = Date.now();
  const elapsed = lastFrame ? Math.min(100, now - lastFrame) : 33;
  lastFrame = now;
  agent.animate(elapsed);
  if (prime()) paint(elapsed / 1000, agent.phase, agent.level, agent.preview);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
