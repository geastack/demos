import { BADGE, BODY, CAPTION, HERO, KICKER, PROMPT_END, TALLY } from "../game/screen";
import { game } from "../stores/game";

// The end: the boat drifts to a stop and the view lifts to the sky of
// lanterns it sent up; the tally settles in below the horizon.
export function EndCard() {
  return (
    <div class="layer end">
      <span class={KICKER}>YOUR SKY</span>
      <div class={TALLY}>
        <span class={HERO}>{game.lanterns}</span>
        <div class="tally-lines">
          <span class={BODY}>lanterns kept</span>
          <span class={CAPTION}>{game.distanceText}</span>
          {game.newBest ? <span class={BADGE}>NEW BEST</span> : <span class={CAPTION}>BEST {game.best}</span>}
        </div>
      </div>
      <span class={PROMPT_END}>Tap to sail again</span>
    </div>
  );
}
