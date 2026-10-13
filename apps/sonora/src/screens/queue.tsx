import "../styles/queue.css";
import { FlowCover, SideCover, ThumbCover } from "../components/covers";
import { MiniEq } from "../components/mini-eq";
import {
  LAND,
  LIST_H,
  LIST_W,
  LIST_X,
  LIST_Y,
  PAD,
  QUEUE_ART,
  QUEUE_ART_X,
  QUEUE_ART_Y,
  QUEUE_HEAD_X,
  QUEUE_HEAD_Y,
  QUEUE_NOW_W,
  QUEUE_NOW_X,
  QUEUE_NOW_Y,
  ROW_H,
  ROW_TEXT_W,
} from "../layout";
import { showNow } from "../navigation";
import { player } from "../stores/player";
import { queue } from "../stores/queue";
import { tint } from "../stores/tint";

// The queue: what is playing on the left (its cover came from Now Playing),
// up next on the right. Tap a row to play it, swipe it left to remove it, or
// drag its grip to move it.
export function QueueScreen() {
  return (
    <div class="screen" style={{ backgroundColor: tint.bg }}>
      <div class="round glass" style={{ left: PAD, top: PAD }} onClick={() => showNow()}>
        <img src="icons/back.png" />
      </div>

      <div
        class={LAND ? "queue-art queue-art-fly" : "queue-art"}
        style={{ left: QUEUE_ART_X, top: QUEUE_ART_Y, width: QUEUE_ART, height: QUEUE_ART }}
      >
        <div
          class={player.artSwap === "" ? "queue-cover" : `queue-cover ${player.artSwap}`}
          style={{ width: QUEUE_ART, height: QUEUE_ART }}
        >
          {LAND ? <FlowCover album={player.album} /> : <SideCover album={player.album} />}
        </div>
      </div>
      <div class="queue-now enter-2" style={{ left: QUEUE_NOW_X, top: QUEUE_NOW_Y, width: QUEUE_NOW_W }}>
        <div class="queue-now-head">
          <MiniEq playing={player.playing} />
          <span class="t-caption">Now playing</span>
        </div>
        <div class={`queue-now-text ${player.textSwap}`}>
          <span class="t-strong">{player.title}</span>
          <span class="t-caption">{player.artist}</span>
        </div>
      </div>

      <div class="queue-head enter-1" style={{ left: QUEUE_HEAD_X, top: QUEUE_HEAD_Y, width: LIST_W }}>
        <span class="t-title">Up next</span>
        <span class="t-caption">{queue.summary}</span>
      </div>

      <div class="list" style={{ left: LIST_X, top: LIST_Y, width: LIST_W, height: LIST_H }}>
        {queue.rows.map((row) => (
          <div
            class={row.lifted ? "row row-lifted" : "row"}
            style={{ display: row.shown ? "flex" : "none", left: row.x, top: row.y, width: LIST_W, height: ROW_H }}
          >
            <div class="row-thumb">
              <ThumbCover album={row.album} />
            </div>
            <div class="row-text" style={{ width: ROW_TEXT_W }}>
              <span class="t-strong">{row.title}</span>
              <span class="t-caption">{row.artist}</span>
            </div>
            <span class="t-caption row-time">{row.time}</span>
            <img class="row-grip" src="icons/handle.png" />
          </div>
        ))}
      </div>

      <div
        class="list-touch"
        style={{ left: LIST_X, top: LIST_Y, width: LIST_W, height: LIST_H }}
        onPointerDown={(event) => queue.down(event.clientX - LIST_X, event.clientY - LIST_Y)}
        onPointerMove={(event) => queue.move(event.clientX - LIST_X, event.clientY - LIST_Y)}
        onPointerUp={() => queue.up()}
        onClick={() => queue.click()}
      />
    </div>
  );
}
