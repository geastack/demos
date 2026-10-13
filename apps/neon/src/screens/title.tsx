import { game } from "../stores/game";

// One line of the wordmark.
function Word({ text, place }: { text: string; place: string }) {
  return <span class={`${place}`}>{text}</span>;
}

// Attract mode: the craft drives itself behind the title until a tap.
export function TitleScreen() {
  return (
    <div class="layer title">
      <span class={`caption tagline${game.sz}`}>SYNTHWAVE RUNNER</span>
      <Word text="NEON" place={`wordmark${game.sz} word word-top${game.sz}`} />
      <Word text="DRIFT" place={`wordmark${game.sz} word word-bottom${game.sz}`} />
      <span class={`body prompt${game.sz}`}>TAP TO START</span>
      <div class={`best-corner${game.sz}`}>
        <span class="caption">BEST</span>
        <span class="body">{game.best}</span>
      </div>
    </div>
  );
}
