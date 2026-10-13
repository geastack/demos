import { ReactiveComponent } from "@geastack/core";
import "./styles/app.css";
import { orbit } from "./lib/orbit";

// gea3d draws the scene underneath the retained UI, which composites on top in
// the same flush: the only UI is a touch layer and one small caption.
export class App extends ReactiveComponent {
  template() {
    return (
      <div
        class="app"
        onPointerDown={(event) => orbit.down(event.pointerId, event.clientX, event.clientY)}
        onPointerMove={(event) => orbit.move(event.pointerId, event.clientX, event.clientY)}
        onPointerUp={(event) => orbit.up(event.pointerId)}
      >
        <span class="caption">ORBIT</span>
      </div>
    );
  }
}
