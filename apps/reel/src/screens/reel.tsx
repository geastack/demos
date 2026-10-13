import { HEIGHT, WIDTH } from "../lib/frame";
import { CANVAS_ID, reel } from "../stores/reel";

// One full-panel canvas and nothing else: effects are rendered into its
// pixels and the captions and progress bar drawn in its batch, so it
// presents straight to the display with no compositing.
export function ReelScreen() {
  return (
    <canvas
      id={CANVAS_ID}
      class="frame"
      width={WIDTH}
      height={HEIGHT}
      onPointerDown={(event) => reel.down(event.pointerId, event.clientX, event.clientY)}
      onPointerMove={(event) => reel.move(event.pointerId, event.clientX, event.clientY)}
      onPointerUp={(event) => reel.up(event.pointerId)}
    />
  );
}
