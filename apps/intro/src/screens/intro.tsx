import { HEIGHT, WIDTH } from "../lib/frame";
import { CANVAS_ID, intro } from "../stores/intro";

// One full-panel canvas and nothing else: the scene is painted into its
// pixels and the type drawn in its batch, so it presents straight to the
// display with no compositing. A tap replays the intro.
export function IntroScreen() {
  return <canvas id={CANVAS_ID} class="frame" width={WIDTH} height={HEIGHT} onPointerDown={() => intro.replay()} />;
}
