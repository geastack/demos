import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { H, px, W } from "./layout";
import { back } from "./navigation";
import { BootScreen } from "./screens/boot";
import { DetailScreen } from "./screens/detail";
import { DiscoverScreen } from "./screens/discover";
import { BOOT, DETAIL, DISCOVER, shell } from "./stores/shell";

// Only the open screen is mounted: the engine keeps animating and repainting a
// hidden subtree every frame. Every touch bubbles to the root to reset the
// idle timer; the USER button arrives as a key and means "back".
export class App extends ReactiveComponent {
  template() {
    return (
      <div
        class="app"
        style={{ width: px(W), height: px(H) }}
        onPointerDown={() => shell.poke()}
        onKeyDown={(event) => back(event.keyCode)}
      >
        {shell.screen === BOOT ? <BootScreen /> : null}
        {shell.screen === DISCOVER ? <DiscoverScreen /> : null}
        {shell.screen === DETAIL ? <DetailScreen /> : null}
      </div>
    );
  }
}
