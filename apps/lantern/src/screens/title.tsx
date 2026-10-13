import { BEST_CORNER, BODY, CAPTION, KICKER, PROMPT_LEFT, WORDMARK_BOTTOM, WORDMARK_TOP } from "../game/screen";
import { game } from "../stores/game";

// Attract mode: the boat drifts downriver on its own behind the title,
// catching lanterns, until a tap.
export function TitleScreen() {
  return (
    <div class="layer title">
      <span class={KICKER}>A PAPER BOAT AT DUSK</span>
      <span class={WORDMARK_TOP}>Lantern</span>
      <span class={WORDMARK_BOTTOM}>River</span>
      <span class={PROMPT_LEFT}>Tap to set sail</span>
      <div class={BEST_CORNER}>
        <span class={CAPTION}>BEST SKY</span>
        <span class={BODY}>{game.best}</span>
      </div>
    </div>
  );
}
