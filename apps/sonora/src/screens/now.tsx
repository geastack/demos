import "../styles/now.css";
import "../styles/halo.css";
import { NowCover } from "../components/covers";
import { RoomsSheet } from "../components/rooms-sheet";
import { SleepSheet } from "../components/sleep-sheet";
import { VolumePanel } from "../components/volume-panel";
import { artGesture, scrubGesture } from "../gestures";
import {
  ART_X,
  ART_Y,
  COL_W,
  COL_X,
  CTRL_Y,
  HALO_H,
  HALO_W,
  HALO_X,
  HALO_Y,
  LAND,
  META_Y,
  SCRUB_Y,
  SPEC_Y,
  TOAST_X,
  TOAST_Y,
  TOP_W,
  TOP_X,
  TOP_Y,
} from "../layout";
import { showBrowse, showQueue } from "../navigation";
import { SPECTRUM_H, SPECTRUM_ID, SPECTRUM_W } from "../render/spectrum";
import { player } from "../stores/player";
import { rooms } from "../stores/rooms";
import { BROWSE, QUEUE, ROOMS, SLEEP, shell, VOLUME } from "../stores/shell";
import { sleep } from "../stores/sleep";
import { tint } from "../stores/tint";
import { volume } from "../stores/volume";

const KNOB_R = 6;

function artUp() {
  if (artGesture.up()) showBrowse();
}

function artClick() {
  if (artGesture.click()) showBrowse();
}

// The art lands from wherever it was on the previous screen.
// (The shared-element moves are landscape's; stacked layouts keep the cover
// where the library and queue put it, so they only drop in from the boot.)
function artEntrance(): string {
  if (!LAND) return shell.previous === BROWSE || shell.previous === QUEUE ? "art-place" : "art-place art-drop";
  if (shell.previous === BROWSE) return "art-place art-from-browse";
  if (shell.previous === QUEUE) return "art-place art-from-queue";
  return "art-place art-drop";
}

// Touch targets are 40 px when there is room (stacked layouts).
const CHIP = LAND ? "chip glass" : "chip chip-big glass";
const PILL = LAND ? "pill-button glass" : "pill-button pill-big glass";
const PILL_TIMER = LAND ? "pill-button pill-timer" : "pill-button pill-big pill-timer";

function TopRow() {
  return (
    <div class="top-row enter-1" style={{ left: TOP_X, top: TOP_Y, width: TOP_W }}>
      <div class={CHIP} onClick={() => rooms.open()}>
        <img src="icons/speaker.png" />
        <span class="t-caption c-text">{rooms.name}</span>
        <img class="chip-caret" src="icons/caret.png" />
      </div>
      <div class="top-actions">
        {sleep.badge === "" ? (
          <div class={PILL} onClick={() => sleep.open()}>
            <img src="icons/moon.png" />
          </div>
        ) : (
          <div class={PILL_TIMER} style={{ borderColor: tint.accent }} onClick={() => sleep.open()}>
            <span class="t-caption c-text">{sleep.badge}</span>
          </div>
        )}
        <div class={PILL} onClick={() => showBrowse()}>
          <img src="icons/library.png" />
        </div>
      </div>
    </div>
  );
}

function Scrubber() {
  return (
    <div class="scrubber enter-3" style={{ left: COL_X, top: SCRUB_Y, width: COL_W }}>
      <div class="track" style={{ width: COL_W }} />
      <div class="track-fill" style={{ width: player.progress, backgroundColor: tint.accent }} />
      <div class="knob-place" style={{ transform: `translate(${player.progress - KNOB_R}px, 0px)` }}>
        <div class={player.scrubbing ? "knob knob-held" : "knob"} />
      </div>
      <div class="times" style={{ width: COL_W }}>
        <span class="t-caption">{player.elapsedText}</span>
        <span class="t-caption">{player.remainText}</span>
      </div>
      <div
        class="scrub-touch"
        style={{ width: COL_W + 16 }}
        onPointerDown={(event) => scrubGesture.down(event.clientX)}
        onPointerMove={(event) => scrubGesture.move(event.clientX)}
        onPointerUp={() => scrubGesture.up()}
      />
    </div>
  );
}

function PlayButton() {
  return (
    <div class="play">
      <div class={player.playing ? "burst burst-a" : "burst burst-b"} style={{ borderColor: tint.accent }} />
      <div class="play-disc" style={{ backgroundColor: tint.accent }} onClick={() => player.toggle()}>
        {player.playing ? <img class="icon-pop" src="icons/pause.png" /> : null}
        {player.playing ? null : <img class="icon-pop play-icon" src="icons/play.png" />}
      </div>
    </div>
  );
}

function Controls() {
  return (
    <div class="controls enter-4" style={{ left: COL_X - 4, top: CTRL_Y, width: COL_W + 8 }}>
      <div class="control" onClick={() => showQueue()}>
        <img src="icons/queue.png" />
      </div>
      <div class="control control-skip" onClick={() => player.previous()}>
        <img src="icons/prev.png" />
      </div>
      <PlayButton />
      <div class="control control-skip" onClick={() => player.next()}>
        <img src="icons/next.png" />
      </div>
      <div class="control" onClick={() => volume.open()}>
        <img src="icons/volume.png" />
      </div>
    </div>
  );
}

// Now Playing: the art on its halo at the left; the room, the track, the
// equaliser, the scrubber and the transport on the right. Overlays (volume,
// rooms, sleep timer) mount on top.
export function NowScreen() {
  return (
    <div class="screen" style={{ backgroundColor: tint.bg }}>
      <div class={`halo halo-${tint.album + 1}`} style={{ left: HALO_X, top: HALO_Y, width: HALO_W, height: HALO_H }} />
      <div class={artEntrance()} style={{ left: ART_X, top: ART_Y }}>
        <div
          class={`art ${player.artSwap}`}
          onPointerDown={(event) => artGesture.down(event.clientY)}
          onPointerMove={(event) => artGesture.move(event.clientY)}
          onPointerUp={() => artUp()}
          onClick={() => artClick()}
        >
          <NowCover album={player.album} />
        </div>
      </div>

      <TopRow />

      <div class="meta enter-2" style={{ left: COL_X, top: META_Y, width: COL_W }}>
        <div class={LAND ? `meta-text ${player.textSwap}` : `meta-text meta-center ${player.textSwap}`}>
          <span class="t-title">{player.title}</span>
          <span class="t-body">{player.artist}</span>
        </div>
      </div>

      <canvas
        id={SPECTRUM_ID}
        class="spectrum"
        style={{ left: COL_X, top: SPEC_Y, width: SPECTRUM_W, height: SPECTRUM_H }}
        width={SPECTRUM_W}
        height={SPECTRUM_H}
      />
      <Scrubber />
      <Controls />

      {sleep.toast === "" ? null : (
        <div class="toast glass" style={{ left: TOAST_X, top: TOAST_Y }}>
          <span class="t-caption c-text">{sleep.toast}</span>
        </div>
      )}

      {shell.overlay === VOLUME ? <VolumePanel /> : null}
      {shell.overlay === ROOMS ? <RoomsSheet /> : null}
      {shell.overlay === SLEEP ? <SleepSheet /> : null}
    </div>
  );
}
