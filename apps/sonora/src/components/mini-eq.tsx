import { tint } from "../stores/tint";

// Three accent bars that dance while `playing` and rest low when paused.
export function MiniEq({ playing }: { playing: boolean }) {
  return (
    <div class="mini-eq">
      <div class={playing ? "mini-bar mini-bar-1" : "mini-bar mini-rest"} style={{ backgroundColor: tint.accent }} />
      <div class={playing ? "mini-bar mini-bar-2" : "mini-bar mini-rest"} style={{ backgroundColor: tint.accent }} />
      <div class={playing ? "mini-bar mini-bar-3" : "mini-bar mini-rest"} style={{ backgroundColor: tint.accent }} />
    </div>
  );
}
