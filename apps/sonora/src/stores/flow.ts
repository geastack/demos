import { Store } from "@geastack/core";
import { ALBUM_COUNT, ALBUMS } from "../data/albums";
import { FLOW_BIG, FLOW_CX, FLOW_CY, FLOW_FAR, FLOW_FAR_GAP, FLOW_NEAR_GAP, FLOW_SMALL } from "../layout";
import { tint } from "./tint";

export const CENTER_X = FLOW_CX;
export const CENTER_Y = FLOW_CY;
export const BIG = FLOW_BIG; // the centred cover (144 landscape, 192 stacked)
export const SMALL = FLOW_SMALL; // its neighbours at rest
const FAR = FLOW_FAR; // two away, partly off screen
const NEAR_GAP = FLOW_NEAR_GAP; // centre-to-centre, the centre cover to a neighbour
const FAR_GAP = FLOW_FAR_GAP; // a neighbour to the next one
const FLOW_PX = 144; // art/flow-*
const SIDE_PX = 96; // art/side-*
const DIM_PER_STEP = 0.36;
const MAX_DIM = 0.62;

// Which image a slot shows: exact sizes blit 1:1, anything between scales
// down from the next bigger image (never up).
export const ART_NP = 0;
export const ART_FLOW = 1;
export const ART_SIDE = 2;

const TAP_SLOP = 10;
const CLICK_AFTER_MS = 300; // a click this soon after a handled gesture is its echo
const SETTLE_MS = 110; // time constant of the exponential settle
const FLING_MS = 260; // how far a release velocity carries the covers
const RUBBER = 0.3; // drag resistance past either end
const LAST = ALBUM_COUNT - 1;
const ENTER_MS = 460; // the cover lands from Now Playing
const FAN_MS = 700; // the neighbours fan out (their entrance classes go after)

// One of the five mounted covers: the centred album and two either side, in
// paint order (furthest first, so the centred cover draws on top).
type Slot = {
  offset: number;
  album: number;
  art: number;
  shown: boolean;
  left: number;
  top: number;
  size: number;
  dim: number;
};

function clamp(index: number): number {
  return Math.max(0, Math.min(LAST, index));
}

function rubberBand(position: number): number {
  if (position < 0) return position * RUBBER;
  if (position > LAST) return LAST + (position - LAST) * RUBBER;
  return position;
}

// Centre x of a cover `offset` albums from the middle.
function centreX(offset: number): number {
  const away = Math.abs(offset);
  const distance = away <= 1 ? away * NEAR_GAP : NEAR_GAP + (away - 1) * FAR_GAP;
  return CENTER_X + (offset < 0 ? -distance : distance);
}

function sizeAt(offset: number): number {
  const away = Math.abs(offset);
  if (away <= 1) return BIG + (SMALL - BIG) * away;
  return SMALL + (FAR - SMALL) * Math.min(1, away - 1);
}

// The cover flow. `position` is the fractional album index at the centre;
// dragging, the momentum flick and the settle all move that one number and
// the slots follow it. Covers are sized by layout (each <img> fills its
// slot), so nothing is ever rotated.
class FlowStore extends Store {
  // Spelled out: a field computed with .map() does not lower to native code.
  slots: Slot[] = [
    { offset: -2, album: 0, art: ART_SIDE, shown: false, left: 0, top: 0, size: FAR, dim: 0 },
    { offset: 2, album: 0, art: ART_SIDE, shown: false, left: 0, top: 0, size: FAR, dim: 0 },
    { offset: -1, album: 0, art: ART_SIDE, shown: false, left: 0, top: 0, size: SMALL, dim: 0 },
    { offset: 1, album: 0, art: ART_SIDE, shown: false, left: 0, top: 0, size: SMALL, dim: 0 },
    { offset: 0, album: 0, art: ART_FLOW, shown: false, left: 0, top: 0, size: BIG, dim: 0 },
  ];
  index = 0;
  title = ALBUMS[0].title;
  meta = "";
  // At rest on a whole album: the play badge and the copy show.
  settled = true;
  // The centred cover is landing from Now Playing; the neighbours fan out.
  // (An entrance class must not outlive its entrance: a slot hidden at mount
  // would otherwise hold its first keyframe when it shows.)
  entering = false;
  fanning = false;
  // Flips on every change of album so the copy's entrance restarts.
  flip = false;

  private position = 0;
  private target = 0;
  private dragging = false;
  private startX = 0;
  private startPosition = 0;
  private lastX = 0;
  private lastTime = 0;
  private velocity = 0; // px per ms
  private lastFrame = 0;
  private handledAt = 0;
  private loop = 0; // bumps to cancel a running settle

  /** Opens on an album; `fromNow` lands its cover from the Now Playing pose. */
  enter(album: number, fromNow: boolean) {
    this.loop = this.loop + 1;
    this.position = album;
    this.target = album;
    this.dragging = false;
    this.settled = true;
    this.entering = fromNow;
    this.fanning = fromNow;
    this.select(album);
    this.layout();
    if (!fromNow) return;

    setTimeout(() => this.landed(), ENTER_MS);
    setTimeout(() => {
      this.fanning = false;
    }, FAN_MS);
  }

  down(x: number) {
    this.loop = this.loop + 1;
    this.dragging = true;
    this.startX = x;
    this.startPosition = this.position;
    this.lastX = x;
    this.lastTime = Date.now();
    this.velocity = 0;
  }

  move(x: number) {
    if (!this.dragging) return;

    const now = Date.now();
    const sample = (x - this.lastX) / Math.max(1, now - this.lastTime);
    this.velocity = 0.6 * this.velocity + 0.4 * sample;
    this.lastX = x;
    this.lastTime = now;
    if (Math.abs(x - this.startX) < TAP_SLOP && this.settled) return;

    this.settled = false;
    this.position = rubberBand(this.startPosition - (x - this.startX) / NEAR_GAP);
    this.layout();
  }

  /** Ends a gesture; returns the album to play when it was a tap on the centred cover, else -1. */
  up(): number {
    if (!this.dragging) return -1;

    this.dragging = false;
    this.handledAt = Date.now();
    if (Math.abs(this.lastX - this.startX) < TAP_SLOP) return this.tap(this.startX);

    const flung = this.position - (this.velocity * FLING_MS) / NEAR_GAP;
    this.settle(clamp(Math.round(flung)));
    return -1;
  }

  /** Fallback for a tap that arrives only as a click; ignores gesture echoes. */
  click(): number {
    if (Date.now() - this.handledAt < CLICK_AFTER_MS) return -1;

    this.handledAt = Date.now();
    return this.tap(this.startX);
  }

  // The centred cover plays; a side cover slides to the centre.
  private tap(x: number): number {
    const offset = x - CENTER_X;
    if (Math.abs(offset) > BIG / 2) {
      const steps = Math.abs(offset) > NEAR_GAP + SMALL / 2 ? 2 : 1;
      this.settle(clamp(this.index + (offset < 0 ? -steps : steps)));
      return -1;
    }

    if (!this.settled) {
      this.settle(this.index);
      return -1;
    }

    return this.index;
  }

  private landed() {
    this.entering = false;
    this.layout();
  }

  private settle(target: number) {
    this.target = target;
    this.settled = false;
    this.loop = this.loop + 1;
    this.lastFrame = Date.now();
    const loop = this.loop;
    requestAnimationFrame(() => this.step(loop));
  }

  private step(loop: number) {
    if (loop !== this.loop) return;

    const now = Date.now();
    const dt = Math.min(48, now - this.lastFrame);
    this.lastFrame = now;
    const delta = this.target - this.position;
    const done = Math.abs(delta) < 0.004;
    this.position = done ? this.target : this.position + delta * (1 - Math.exp(-dt / SETTLE_MS));
    this.layout();
    if (!done) {
      requestAnimationFrame(() => this.step(loop));
      return;
    }

    this.settled = true;
    tint.fade(this.index);
  }

  // Fields are written only when they change.
  private layout() {
    const base = clamp(Math.round(this.position));
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const album = base + slot.offset;
      const shown = album >= 0 && album <= LAST;
      if (shown !== slot.shown) slot.shown = shown;
      if (!shown) continue;

      const offset = album - this.position;
      const size = Math.round(sizeAt(offset));
      const left = Math.round(centreX(offset) - size / 2);
      const top = Math.round(CENTER_Y - size / 2);
      const dim = Math.round(Math.min(MAX_DIM, Math.abs(offset) * DIM_PER_STEP) * 50) / 50;
      const art = this.artFor(size, slot.offset === 0);
      if (album !== slot.album) slot.album = album;
      if (art !== slot.art) slot.art = art;
      if (size !== slot.size) slot.size = size;
      if (left !== slot.left) slot.left = left;
      if (top !== slot.top) slot.top = top;
      if (dim !== slot.dim) slot.dim = dim;
    }

    if (base !== this.index) this.select(base);
  }

  private artFor(size: number, centre: boolean): number {
    if (centre && this.entering) return ART_NP;
    if (size <= SIDE_PX) return ART_SIDE;
    if (size <= FLOW_PX) return ART_FLOW;
    return ART_NP;
  }

  private select(index: number) {
    const album = ALBUMS[index];
    this.index = index;
    this.title = album.title;
    this.meta = `${album.artist} · ${album.year} · ${album.tracks.length} tracks`;
    this.flip = !this.flip;
  }
}

export const flow = new FlowStore();
