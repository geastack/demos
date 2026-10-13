import "../styles/ambient.css";
import { FlowCover, NowCover } from "../components/covers";
import { MiniEq } from "../components/mini-eq";
import {
  AMB_ART,
  AMB_ART_X,
  AMB_ART_Y,
  AMB_COPY_W,
  AMB_COPY_X,
  AMB_COPY_Y,
  AMB_LINE_X,
  AMB_LINE_Y,
  LAND,
} from "../layout";
import { showNow } from "../navigation";
import { clock } from "../stores/clock";
import { player } from "../stores/player";
import { tint } from "../stores/tint";

// The ambient screen after a quiet spell: the cover, the time (or the track's
// elapsed time before the clock is set), the track and a hairline of progress.
// Any touch wakes Now Playing.
export function AmbientScreen() {
  return (
    <div class="screen" style={{ backgroundColor: tint.bg }} onClick={() => showNow()}>
      <div class="ambient-art lift-1" style={{ left: AMB_ART_X, top: AMB_ART_Y, width: AMB_ART, height: AMB_ART }}>
        {LAND ? <FlowCover album={player.album} /> : <NowCover album={player.album} />}
      </div>
      <div
        class={LAND ? "ambient-copy enter-2" : "ambient-copy ambient-center enter-2"}
        style={{ left: AMB_COPY_X, top: AMB_COPY_Y, width: AMB_COPY_W }}
      >
        <span class="t-hero">{clock.synced ? clock.time : player.elapsedText}</span>
        <div class="ambient-track">
          <MiniEq playing={player.playing} />
          <span class="t-strong">{player.title}</span>
        </div>
        <span class="t-body">{player.artist}</span>
      </div>
      <div class="ambient-line enter-3" style={{ left: AMB_LINE_X, top: AMB_LINE_Y }}>
        <div class="ambient-fill" style={{ width: player.progress, backgroundColor: tint.accent }} />
      </div>
    </div>
  );
}
