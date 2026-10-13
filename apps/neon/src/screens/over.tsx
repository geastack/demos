import { game } from "../stores/game";

// The crash flash, then the score card, centred on the screen.
export function OverCard() {
  return (
    <div class="layer">
      {game.flashing ? <div class="layer flash" /> : null}
      <div class="layer centre">
        <div class={`stack${game.sz}`}>
          <div class={`card-glow${game.sz}`} />
          <div class={`card${game.sz}`}>
            <span class="caption accent">RUN OVER</span>
            <span class={`final${game.sz}`}>{game.score}</span>
            {game.newBest ? <span class="caption badge">NEW BEST</span> : <span class="caption">BEST {game.best}</span>}
            <span class="body retry">TAP TO RETRY</span>
          </div>
        </div>
      </div>
    </div>
  );
}
