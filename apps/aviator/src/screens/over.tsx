import { BADGE, CAPTION, HERO, PROMPT_OVER } from "../game/screen";
import { game } from "../stores/game";

// The plane is down: how far it flew, and a tap to fly again.
export function OverCard() {
  return (
    <div class="layer over">
      <span class={CAPTION}>DISTANCE</span>
      <span class={HERO}>{game.distance}</span>
      {game.newBest ? (
        <span class={BADGE}>NEW BEST</span>
      ) : (
        <div class="over-row">
          <span class={CAPTION}>LEVEL {game.level}</span>
          <span class={CAPTION}>BEST {game.best}</span>
        </div>
      )}
      <span class={PROMPT_OVER}>TAP TO REPLAY</span>
    </div>
  );
}
