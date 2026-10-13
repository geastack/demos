import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { PANEL_H, PANEL_W } from "./lib/layout";
import { CANVAS_ID, ripple } from "./lib/ripple";

// One full-screen canvas and nothing over it: a retained node above a
// full-screen canvas costs a compositing copy every frame, so the chrome is
// painted into the canvas (lib/painter.ts).
export class App extends ReactiveComponent {
  template() {
    return (
      <div class="app">
        <canvas
          id={CANVAS_ID}
          class="fluid"
          width={PANEL_W}
          height={PANEL_H}
          onPointerDown={(event) => ripple.down(event.pointerId, event.clientX, event.clientY)}
          onPointerMove={(event) => ripple.move(event.pointerId, event.clientX, event.clientY)}
          onPointerUp={(event) => ripple.up(event.pointerId)}
        />
      </div>
    );
  }
}
