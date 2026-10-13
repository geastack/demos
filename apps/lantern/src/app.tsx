import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { EndCard } from "./screens/end";
import { RunHud } from "./screens/hud";
import { TitleScreen } from "./screens/title";
import { game, OVER, RUN, TITLE } from "./stores/game";

// gea3d draws the river underneath the retained UI, which composites on top
// in the same flush; only the open overlay is mounted. A drag anywhere
// steers, a tap starts; the USER button returns to the title.
export class App extends ReactiveComponent {
  template() {
    return (
      <div
        class="app"
        onPointerDown={(event) => game.pointerDown(event.clientX)}
        onPointerMove={(event) => game.pointerMove(event.clientX)}
        onPointerUp={() => game.pointerUp()}
        onKeyDown={(event) => game.key(event.keyCode)}
      >
        {game.phase === TITLE ? <TitleScreen /> : null}
        {game.phase === RUN ? <RunHud /> : null}
        {game.phase === OVER ? <EndCard /> : null}
      </div>
    );
  }
}
