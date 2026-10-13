import { Store } from "@geastack/core";
import { ALBUMS, formatTime } from "../data/albums";
import { LIST_W, ROW_H } from "../layout";
import { player } from "./player";

export const ROWS = 5; // up-next rows on screen
const HANDLE_W = 48; // the reorder grip at a row's right end
const SLOP = 10;
const REMOVE_AT = -96; // a swipe past this removes the row
const FLICK = -0.5; // px per ms: a quick flick removes it too
const EASE_MS = 70; // time constant rows glide to their places with
const CLICK_AFTER_MS = 300;

const IDLE = 0;
const PRESS = 1; // down, direction not known yet
const SWIPE = 2;
const REORDER = 3;

// One row on screen: the up-next entry at its index, offset while it moves.
type Row = {
  shown: boolean;
  album: number;
  title: string;
  artist: string;
  time: string;
  x: number;
  y: number;
  lifted: boolean;
};

function emptyRow(index: number): Row {
  return { shown: false, album: 0, title: "", artist: "", time: "", x: 0, y: index * ROW_H, lifted: false };
}

// The up-next list's gestures. Tap a row to play it (the rows above it are
// skipped), swipe it left to remove it, or drag its grip to move it; the
// others glide out of the way. Rows are fixed slots refilled from the queue
// after every change, positioned by layout (`top`) so the list can clip them.
class QueueStore extends Store {
  rows: Row[] = [emptyRow(0), emptyRow(1), emptyRow(2), emptyRow(3), emptyRow(4)];
  summary = "";

  private mode = IDLE;
  private row = -1;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastTime = 0;
  private velocity = 0;
  private dropAt = 0; // where a dragged row lands
  private targetX: number[] = [0, 0, 0, 0, 0];
  private targetY: number[] = [0, 0, 0, 0, 0];
  private gliding = false;
  private lastFrame = 0;
  private after = 0; // what to do when the rows come to rest
  private handledAt = 0;

  /** Refills the rows from the queue, each in its own place. */
  sync() {
    const count = player.upNextCount();
    for (let i = 0; i < ROWS; i++) {
      const row = this.rows[i];
      const shown = i < count;
      row.shown = shown;
      row.x = 0;
      row.y = i * ROW_H;
      row.lifted = false;
      this.targetX[i] = 0;
      this.targetY[i] = i * ROW_H;
      if (!shown) continue;

      const albumIndex = player.upNextAlbum(i);
      const album = ALBUMS[albumIndex];
      const track = album.tracks[player.upNextTrack(i)];
      row.album = albumIndex;
      row.title = track.title;
      row.artist = album.artist;
      row.time = formatTime(track.seconds);
    }

    this.summary = `${count} tracks · ${player.queueMinutes()} min`;
  }

  down(x: number, y: number) {
    if (this.gliding) return;

    const row = Math.floor(y / ROW_H);
    if (row < 0 || row >= ROWS || !this.rows[row].shown) return;

    this.row = row;
    this.startX = x;
    this.startY = y;
    this.lastX = x;
    this.lastTime = Date.now();
    this.velocity = 0;
    this.mode = x >= LIST_W - HANDLE_W ? REORDER : PRESS;
    if (this.mode === REORDER) {
      this.rows[row].lifted = true;
      this.dropAt = row;
    }
  }

  move(x: number, y: number) {
    if (this.mode === IDLE) return;

    const now = Date.now();
    this.velocity = 0.6 * this.velocity + (0.4 * (x - this.lastX)) / Math.max(1, now - this.lastTime);
    this.lastX = x;
    this.lastTime = now;
    const dx = x - this.startX;
    const dy = y - this.startY;
    if (this.mode === PRESS) {
      if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) this.mode = SWIPE;
      else if (Math.abs(dy) > SLOP) this.mode = IDLE;
    }

    if (this.mode === SWIPE) this.rows[this.row].x = Math.round(dx < 0 ? dx : dx * 0.25);
    if (this.mode === REORDER) this.reorderTo(dy);
  }

  /** Ends a gesture; true when it was a tap that should play its row. */
  up(): boolean {
    const mode = this.mode;
    this.mode = IDLE;
    this.handledAt = Date.now();
    if (mode === PRESS) {
      this.play(this.row);
      return true;
    }

    if (mode === SWIPE) this.endSwipe();
    if (mode === REORDER) this.drop();
    return false;
  }

  /** Fallback for a tap that arrives only as a click; ignores gesture echoes. */
  click(): boolean {
    if (Date.now() - this.handledAt < CLICK_AFTER_MS || this.row < 0) return false;

    this.handledAt = Date.now();
    this.play(this.row);
    return true;
  }

  private play(row: number) {
    player.playQueued(row);
    this.sync();
  }

  // The dragged row follows the finger; the rows it passes step aside.
  private reorderTo(dy: number) {
    const from = this.row;
    const last = Math.min(ROWS, player.upNextCount()) - 1;
    const y = Math.max(0, Math.min(last * ROW_H, from * ROW_H + dy));
    this.rows[from].y = Math.round(y);
    const at = Math.round(y / ROW_H);
    if (at === this.dropAt) return;

    this.dropAt = at;
    for (let i = 0; i <= last; i++) {
      if (i === from) continue;

      let slot = i;
      if (from < at && i > from && i <= at) slot = i - 1;
      if (from > at && i < from && i >= at) slot = i + 1;
      this.targetY[i] = slot * ROW_H;
    }

    this.glide(0);
  }

  private drop() {
    this.targetY[this.row] = this.dropAt * ROW_H;
    this.glide(REORDER);
  }

  private endSwipe() {
    const row = this.rows[this.row];
    if (row.x < REMOVE_AT || this.velocity < FLICK) {
      this.targetX[this.row] = -LIST_W;
      this.glide(SWIPE);
      return;
    }

    this.targetX[this.row] = 0;
    this.glide(0);
  }

  // Eases every row toward its target, then finishes the gesture.
  private glide(after: number) {
    this.after = after;
    if (this.gliding) return;

    this.gliding = true;
    this.lastFrame = Date.now();
    requestAnimationFrame(() => this.step());
  }

  private step() {
    const now = Date.now();
    const dt = Math.min(48, now - this.lastFrame);
    this.lastFrame = now;
    const k = 1 - Math.exp(-dt / EASE_MS);
    let moving = false;
    for (let i = 0; i < ROWS; i++) {
      const row = this.rows[i];
      if (i === this.row && this.mode === REORDER) continue;

      const x = this.approach(row.x, this.targetX[i], k);
      const y = this.approach(row.y, this.targetY[i], k);
      if (x !== row.x) row.x = x;
      if (y !== row.y) row.y = y;
      if (x !== this.targetX[i] || y !== this.targetY[i]) moving = true;
    }

    if (moving) {
      requestAnimationFrame(() => this.step());
      return;
    }

    this.gliding = false;
    this.finish();
  }

  // One eased step in whole pixels; the last couple of pixels snap (a
  // rounded step that no longer moves would never arrive).
  private approach(value: number, target: number, k: number): number {
    const next = Math.round(value + (target - value) * k);
    return next === value ? target : next;
  }

  private finish() {
    const after = this.after;
    this.after = 0;
    if (after === REORDER) {
      if (this.dropAt !== this.row) player.moveQueued(this.row, this.dropAt);
      this.sync();
    }

    if (after === SWIPE) this.collapse(this.row);
  }

  // Removes a row; the rows below it slide up into the gap.
  private collapse(removed: number) {
    player.removeQueued(removed);
    this.sync();
    for (let i = removed; i < ROWS; i++) this.rows[i].y = (i + 1) * ROW_H;
    this.glide(0);
  }
}

export const queue = new QueueStore();
