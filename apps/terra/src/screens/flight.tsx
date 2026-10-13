import { flight, VIEW_HEIGHT, VIEW_ID, VIEW_WIDTH } from "../stores/flight";

// The whole app is one canvas: terrain and HUD are painted into it (a UI
// node over a full-screen canvas would force a compositing copy per frame).
export function FlightScreen() {
  return (
    <canvas
      id={VIEW_ID}
      class="view"
      width={VIEW_WIDTH}
      height={VIEW_HEIGHT}
      onPointerDown={(event) => flight.touchDown(event.pointerId, event.clientX, event.clientY)}
      onPointerMove={(event) => flight.touchMove(event.pointerId, event.clientX, event.clientY)}
      onPointerUp={(event) => flight.touchUp(event.pointerId)}
    />
  );
}
