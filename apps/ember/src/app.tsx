import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { H, W } from "./layout";
import { back } from "./navigation";
import { BootScreen } from "./screens/boot";
import { CookScreen } from "./screens/cook";
import { DetailScreen } from "./screens/detail";
import { IdleScreen } from "./screens/idle";
import { ManualScreen } from "./screens/manual";
import { PreheatScreen } from "./screens/preheat";
import { ReadyScreen } from "./screens/ready";
import { RecipesScreen } from "./screens/recipes";
import { BOOT, COOK, DETAIL, IDLE, MANUAL, PREHEAT, READY, RECIPES, shell } from "./stores/shell";

// Only the open screen is mounted: the engine keeps animating and repainting a
// hidden subtree every frame. Every touch (and drag) bubbles to the root to
// reset the idle timer and hold back background work; the USER button
// arrives as a key and means "back".
export class App extends ReactiveComponent {
  template() {
    return (
      <div
        class="app"
        style={{ width: W, height: H }}
        onPointerDown={() => shell.poke()}
        onPointerMove={() => shell.poke()}
        onKeyDown={(event) => back(event.keyCode)}
      >
        {shell.screen === BOOT ? <BootScreen /> : null}
        {shell.screen === RECIPES ? <RecipesScreen /> : null}
        {shell.screen === DETAIL ? <DetailScreen /> : null}
        {shell.screen === MANUAL ? <ManualScreen /> : null}
        {shell.screen === PREHEAT ? <PreheatScreen /> : null}
        {shell.screen === COOK ? <CookScreen /> : null}
        {shell.screen === READY ? <ReadyScreen /> : null}
        {shell.screen === IDLE ? <IdleScreen /> : null}
      </div>
    );
  }
}
