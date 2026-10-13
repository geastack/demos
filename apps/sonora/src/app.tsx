import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { H, W } from "./layout";
import { back } from "./navigation";
import { AmbientScreen } from "./screens/ambient";
import { BootScreen } from "./screens/boot";
import { BrowseScreen } from "./screens/browse";
import { NowScreen } from "./screens/now";
import { QueueScreen } from "./screens/queue";
import { AMBIENT, BOOT, BROWSE, NOW, QUEUE, shell } from "./stores/shell";

// Only the open screen is mounted: the engine keeps animating and repainting a
// hidden subtree every frame. Every touch bubbles to the root to reset the
// idle timer; the USER button arrives as a key and means "back".
export class App extends ReactiveComponent {
  template() {
    return (
      <div
        class="app"
        style={{ width: W, height: H }}
        onPointerDown={() => shell.poke()}
        onKeyDown={(event) => back(event.keyCode)}
      >
        {shell.screen === BOOT ? <BootScreen /> : null}
        {shell.screen === NOW ? <NowScreen /> : null}
        {shell.screen === BROWSE ? <BrowseScreen /> : null}
        {shell.screen === QUEUE ? <QueueScreen /> : null}
        {shell.screen === AMBIENT ? <AmbientScreen /> : null}
      </div>
    );
  }
}
