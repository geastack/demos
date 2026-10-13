import { BODY, CAPTION, PULSE, TAGLINE, WORDMARK } from "../game/screen";
import { game } from "../stores/game";

// Attract mode: the plane flies itself under the title until a touch.
export function TitleScreen() {
  return (
    <div class="layer title">
      <span class={WORDMARK}>The Aviator</span>
      <span class={TAGLINE}>fly it to the end</span>
      <div class="prompt">
        <span class={CAPTION}>GRAB THE BLUE, AVOID THE RED</span>
        <span class={PULSE}>TOUCH TO FLY</span>
      </div>
      <div class="best-corner">
        <span class={CAPTION}>BEST</span>
        <span class={BODY}>{game.best}</span>
      </div>
    </div>
  );
}
