import { Store } from "@geastack/core";
import { ALBUM_COUNT, ALBUMS, formatTime } from "../data/albums";
import { COL_W } from "../layout";
import { tint } from "./tint";

export const SCRUB_W = COL_W; // the scrubber track, px
const TICK_MS = 250;
const MAX_STEP_S = 1; // a clock jump (setting the RTC) is not playback
const RESTART_AFTER_S = 3; // "previous" this far in restarts the track instead
const QUEUE_LOW = 9; // top the queue up with another album below this

type Item = {
  album: number;
  track: number;
};

// The simulated playback: what is playing, where in it, and what comes next.
// Time advances in real time while playing; nothing is heard. Shown values are
// written only when they change, so a playing track refreshes its texts once
// a second and the scrubber once a pixel.
class PlayerStore extends Store {
  album = 0;
  track = 0;
  title = "";
  artist = "";
  albumTitle = "";
  playing = false;
  scrubbing = false;
  elapsedText = "0:00";
  remainText = "-0:00";
  progress = 0; // scrubber px
  // Swap animations for the art and the title. Each change alternates between
  // two identical keyframes so the animation restarts, and the title enters
  // from the side it was skipped toward. Empty while a screen plays its own
  // entrance.
  artSwap = "";
  textSwap = "";

  private upNext: Item[] = []; // in play order
  private seconds = 0; // position in the track
  private duration = 1;
  private lastTick = 0;
  private flip = false;

  init() {
    this.load(0, 0, 1);
    this.queueAlbum(0, 1);
    this.queueAlbum(1, 0);
    this.settle();
    setInterval(() => this.tick(), TICK_MS);
  }

  /** The playing track's length, in seconds. */
  length(): number {
    return this.duration;
  }

  /** Seconds into the playing track. */
  position(): number {
    return this.seconds;
  }

  /** A screen is opening: its entrance replaces the swap animations. */
  settle() {
    this.artSwap = "";
    this.textSwap = "";
  }

  toggle() {
    this.lastTick = Date.now();
    this.playing = !this.playing;
  }

  pause() {
    this.playing = false;
  }

  next() {
    const item = this.upNext.shift();
    if (!item) {
      this.playAlbum((this.album + 1) % ALBUM_COUNT);
      return;
    }

    this.load(item.album, item.track, 1);
    this.topUp();
  }

  previous() {
    if (this.seconds > RESTART_AFTER_S || this.track === 0) {
      this.seek(0);
      return;
    }

    this.upNext.unshift({ album: this.album, track: this.track });
    this.load(this.album, this.track - 1, -1);
  }

  /** Plays an album from its first track; the next album queues after it. */
  playAlbum(album: number) {
    this.upNext = [];
    this.load(album, 0, 1);
    this.queueAlbum(album, 1);
    this.topUp();
    this.play();
  }

  /** Plays an up-next entry now; the entries before it are skipped. */
  playQueued(index: number) {
    const item = this.upNext[index];
    this.upNext.splice(0, index + 1);
    this.load(item.album, item.track, 1);
    this.topUp();
    this.play();
  }

  removeQueued(index: number) {
    this.upNext.splice(index, 1);
    this.topUp();
  }

  moveQueued(from: number, to: number) {
    const item = this.upNext[from];
    this.upNext.splice(from, 1);
    this.upNext.splice(to, 0, item);
  }

  upNextCount(): number {
    return this.upNext.length;
  }

  upNextAlbum(index: number): number {
    return this.upNext[index].album;
  }

  upNextTrack(index: number): number {
    return this.upNext[index].track;
  }

  /** Total length of everything up next, in minutes. */
  queueMinutes(): number {
    let seconds = 0;
    for (const item of this.upNext) seconds += ALBUMS[item.album].tracks[item.track].seconds;
    return Math.round(seconds / 60);
  }

  // ---- Scrubbing: the scrubber follows the finger, playback jumps on release.

  scrubStart(fraction: number) {
    this.scrubbing = true;
    this.scrubTo(fraction);
  }

  scrubTo(fraction: number) {
    this.show(Math.max(0, Math.min(1, fraction)) * this.duration);
  }

  scrubEnd(fraction: number) {
    this.scrubbing = false;
    this.seek(Math.max(0, Math.min(1, fraction)) * this.duration);
  }

  seek(seconds: number) {
    this.seconds = seconds;
    this.lastTick = Date.now();
    this.show(seconds);
  }

  private play() {
    this.lastTick = Date.now();
    this.playing = true;
  }

  private tick() {
    const now = Date.now();
    const dt = Math.min(MAX_STEP_S, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (!this.playing) return;

    this.seconds = this.seconds + dt;
    if (this.seconds >= this.duration) {
      this.next();
      return;
    }

    if (!this.scrubbing) this.show(this.seconds);
  }

  // `direction` is +1 for a skip forward, -1 for back.
  private load(album: number, track: number, direction: number) {
    const record = ALBUMS[album];
    const albumChanged = album !== this.album || this.title === "";
    this.album = album;
    this.track = track;
    this.title = record.tracks[track].title;
    this.artist = record.artist;
    this.albumTitle = record.title;
    this.duration = record.tracks[track].seconds;
    this.seconds = 0;
    this.flip = !this.flip;
    const side = this.flip ? "a" : "b";
    this.textSwap = direction > 0 ? `next-${side}` : `prev-${side}`;
    if (albumChanged) this.artSwap = `swap-${side}`;
    this.show(0);
    tint.fade(album);
  }

  private queueAlbum(album: number, from: number) {
    const tracks = ALBUMS[album].tracks;
    for (let i = from; i < tracks.length; i++) this.upNext.push({ album, track: i });
  }

  // Keeps at least an album's worth queued, adding the album after the last.
  private topUp() {
    if (this.upNext.length >= QUEUE_LOW) return;

    const count = this.upNext.length;
    const last = count > 0 ? this.upNext[count - 1].album : this.album;
    this.queueAlbum((last + 1) % ALBUM_COUNT, 0);
  }

  private show(seconds: number) {
    const elapsed = formatTime(seconds);
    const remain = `-${formatTime(this.duration - Math.floor(seconds))}`;
    const progress = Math.round((seconds / this.duration) * SCRUB_W);
    if (elapsed !== this.elapsedText) this.elapsedText = elapsed;
    if (remain !== this.remainText) this.remainText = remain;
    if (progress !== this.progress) this.progress = progress;
  }
}

export const player = new PlayerStore();
