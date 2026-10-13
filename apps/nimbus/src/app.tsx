import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { H, W } from "./layout";
import { back, pointerDown, pointerMove, pointerUp } from "./navigation";
import { CANVAS_ID } from "./render/renderer";

// One full-screen canvas paints everything (see render/renderer.ts); a
// transparent layer over it takes the touches, which navigation.ts hit-tests.
// The USER button arrives as a key and means "back".
export class App extends ReactiveComponent {
  template() {
    return (
      <div class="app" style={{ width: W, height: H }} onKeyDown={(event) => back(event.keyCode)}>
        <canvas id={CANVAS_ID} class="frame" width={W} height={H} style={{ width: W, height: H }} />
        <div
          class="touch"
          style={{ width: W, height: H }}
          onPointerDown={(event) => pointerDown(event.clientX, event.clientY)}
          onPointerMove={(event) => pointerMove(event.clientX, event.clientY)}
          onPointerUp={(event) => pointerUp(event.clientX, event.clientY)}
        />
      </div>
    );
  }
}
