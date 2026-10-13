import { ACCENT_COUNT, BANNER, CAPTION, COUNT, HUD_LEFT, HUD_RIGHT, PIPS, PLUS } from "../game/screen";
import { game } from "../stores/game";

// The run HUD: lanterns kept (left), distance and the boat's three folds
// of paper (right; a lost one flares vermilion), a "+1" on every catch and
// a banner as the rapids begin.
export function RunHud() {
  return (
    <div class="layer">
      <div class={HUD_LEFT}>
        <span class={ACCENT_COUNT}>{game.lanterns}</span>
        <span class={CAPTION}>LANTERNS</span>
      </div>
      <div class={HUD_RIGHT}>
        <span class={COUNT}>{game.meters}</span>
        <span class={CAPTION}>METRES</span>
      </div>
      <div class={PIPS}>
        <div class={game.hull > 0 ? "pip" : "pip pip-lost"} />
        <div class={game.hull > 1 ? "pip" : "pip pip-lost"} />
        <div class={game.hull > 2 ? "pip" : "pip pip-lost"} />
      </div>
      {game.catchTick === 1 ? <span class={PLUS}>+1</span> : null}
      {game.catchTick === 2 ? <span class={PLUS}>+1</span> : null}
      {game.rapidsTick === 1 ? <span class={BANNER}>RAPIDS AHEAD</span> : null}
      {game.rapidsTick === 2 ? <span class={BANNER}>RAPIDS AHEAD</span> : null}
    </div>
  );
}
