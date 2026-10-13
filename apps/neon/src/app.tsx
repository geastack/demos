import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { RunHud } from "./screens/hud";
import { OverCard } from "./screens/over";
import { TitleScreen } from "./screens/title";
import { game, OVER, RUN, TITLE } from "./stores/game";

// gea3d draws the scene underneath the retained UI, which composites on top
// in the same flush; only the open overlay is mounted. Touches anywhere
// steer (swipes and taps); the USER button returns to the title.
export class App extends ReactiveComponent {
  template() {
    return (
      <div
        class="app"
        onPointerDown={(event) => game.pointerDown(event.clientX, event.clientY)}
        onPointerMove={(event) => game.pointerMove(event.clientX, event.clientY)}
        onPointerUp={(event) => game.pointerUp(event.clientX, event.clientY)}
        onKeyDown={(event) => game.key(event.keyCode)}
      >
        {game.phase === TITLE ? <TitleScreen /> : null}
        {game.phase === RUN ? <RunHud /> : null}
        {game.phase === OVER ? <OverCard /> : null}
      </div>
    );
  }
}
