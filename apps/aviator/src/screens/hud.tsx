import { CAPTION, VALUE } from "../game/screen";
import { game } from "../stores/game";

// The flight HUD: level with its progress, distance, and the energy bar
// (red and blinking when low). The two bars are separate nodes: a class
// change alone leaves the blink running on the node.
export function RunHud() {
  return (
    <div class="layer">
      <div class="stat stat-left">
        <span class={CAPTION}>LEVEL</span>
        <span class={VALUE}>{game.level}</span>
        <div class="track level-track">
          <div class="fill level-fill" style={{ width: `${game.levelProgress}px` }} />
        </div>
      </div>
      <div class="stat stat-center">
        <span class={CAPTION}>DISTANCE</span>
        <span class={VALUE}>{game.distance}</span>
      </div>
      <div class="stat stat-right">
        <span class={CAPTION}>ENERGY</span>
        <div class="track energy-track">
          {game.energyLow ? (
            <div class="fill energy-low" style={{ width: `${game.energy}px` }} />
          ) : (
            <div class="fill energy-fill" style={{ width: `${game.energy}px` }} />
          )}
        </div>
      </div>
    </div>
  );
}
