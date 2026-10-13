import { game } from "../stores/game";

// The run HUD: score and best, plus a "+25" that pops on every shard.
export function RunHud() {
  return (
    <div class="layer">
      <div class={`hud-block hud-left${game.sz}`}>
        <span class="caption">SCORE</span>
        <span class={`score${game.sz}`}>{game.score}</span>
      </div>
      <div class={`hud-block hud-right${game.sz}`}>
        <span class="caption">BEST</span>
        <span class={`score${game.sz}`}>{game.score > game.best ? game.score : game.best}</span>
      </div>
      {game.bonusTick === 1 ? <span class={`bonus pop${game.sz}`}>+25</span> : null}
      {game.bonusTick === 2 ? <span class={`bonus pop${game.sz}`}>+25</span> : null}
    </div>
  );
}
