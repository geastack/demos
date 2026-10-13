import "../styles/browse.css";
import "../styles/halo.css";
import { SlotCover } from "../components/covers";
import { MiniEq } from "../components/mini-eq";
import {
  FLOW_BIG,
  FLOW_COPY_Y,
  FLOW_CX,
  FLOW_CY,
  FLOW_DOTS_Y,
  FLOW_TOUCH_H,
  FLOW_TOUCH_Y,
  H,
  HEAD_X,
  HEAD_Y,
  LAND,
  PAD,
  W,
} from "../layout";
import { playAlbum, showNow } from "../navigation";
import { flow } from "../stores/flow";
import { player } from "../stores/player";
import { tint } from "../stores/tint";

function release() {
  const album = flow.up();
  if (album >= 0) playAlbum(album);
}

function click() {
  const album = flow.click();
  if (album >= 0) playAlbum(album);
}

// The centred cover lands from Now Playing; the others fan out from behind it.
function slotClass(offset: number): string {
  if (offset !== 0) return flow.fanning ? `slot slot-in-${offset + 2}` : "slot";
  return flow.entering ? (LAND ? "slot slot-landing" : "slot slot-landing-here") : "slot";
}

function Dot({ index }: { index: number }) {
  return (
    <div class="dot-place">
      {flow.index === index ? <div class="dot dot-on" style={{ backgroundColor: tint.accent }} /> : <div class="dot" />}
    </div>
  );
}

// The centred cover's badges once it rests: "Playing" on the album playing,
// and a play button that pops in on its corner.
function Badges() {
  return (
    <div
      class="badges"
      style={{ left: FLOW_CX - FLOW_BIG / 2, top: FLOW_CY - FLOW_BIG / 2, width: FLOW_BIG, height: FLOW_BIG }}
    >
      {flow.index === player.album ? (
        <div class="playing-badge">
          <MiniEq playing={player.playing} />
          <span class="t-caption c-text">Playing</span>
        </div>
      ) : null}
      <div class="play-badge" style={{ left: FLOW_BIG - 44, top: FLOW_BIG - 44, backgroundColor: tint.accent }}>
        <img class="play-icon" src="icons/play-small.png" />
      </div>
    </div>
  );
}

// The library as a cover flow: swipe with momentum, tap a side cover to bring
// it over, tap the centred one to play it (its cover flies into Now Playing).
// The touch layer is last so it is topmost.
export function BrowseScreen() {
  return (
    <div class="screen" style={{ backgroundColor: tint.bg }}>
      {flow.settled ? (
        <div class={`browse-halo halo-${flow.index + 1}`} style={{ left: FLOW_CX - 160, top: FLOW_CY - 160 }} />
      ) : null}

      <div class="round glass" style={{ left: PAD, top: PAD }} onClick={() => showNow()}>
        <img src="icons/back.png" />
      </div>
      <span class="t-strong browse-head enter-1" style={{ left: HEAD_X, top: HEAD_Y }}>
        Library
      </span>

      <div class="stage" style={{ width: W, height: H }}>
        {flow.slots.map((slot) => (
          <div
            class={slotClass(slot.offset)}
            style={{
              display: slot.shown ? "flex" : "none",
              left: slot.left,
              top: slot.top,
              width: slot.size,
              height: slot.size,
            }}
          >
            <SlotCover album={slot.album} art={slot.art} />
            <div class="slot-veil" style={{ opacity: slot.dim }} />
          </div>
        ))}
        {flow.settled && !flow.entering ? <Badges /> : null}
      </div>

      <div class="browse-copy" style={{ top: FLOW_COPY_Y, width: W }}>
        <div class={flow.flip ? "copy copy-a" : "copy copy-b"}>
          <span class="t-title">{flow.title}</span>
          <span class="t-body">{flow.meta}</span>
        </div>
      </div>

      <div class="dots" style={{ top: FLOW_DOTS_Y, width: W }}>
        <Dot index={0} />
        <Dot index={1} />
        <Dot index={2} />
        <Dot index={3} />
        <Dot index={4} />
        <Dot index={5} />
      </div>

      <div
        class="browse-touch"
        style={{ top: FLOW_TOUCH_Y, width: W, height: FLOW_TOUCH_H }}
        onPointerDown={(event) => flow.down(event.clientX)}
        onPointerMove={(event) => flow.move(event.clientX)}
        onPointerUp={() => release()}
        onClick={() => click()}
      />
    </div>
  );
}
