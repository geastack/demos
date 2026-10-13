import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { bloom, CANVAS_ID } from "./lib/bloom";
import { PANEL_H, PANEL_W } from "./lib/layout";

// One full-screen canvas and nothing over it: a retained node above a
// full-screen canvas costs a compositing copy every frame, so the chrome is
// painted into the canvas (lib/painter.ts).
export class App extends ReactiveComponent {
  template() {
    return (
      <div class="app">
        <canvas
          id={CANVAS_ID}
          class="field"
          width={PANEL_W}
          height={PANEL_H}
          onPointerDown={(event) => bloom.down(event.clientX, event.clientY)}
          onPointerMove={(event) => bloom.move(event.clientX, event.clientY)}
        />
      </div>
    );
  }
}
