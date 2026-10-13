import type { GeaCanvasElement } from "@geastack/core";
import { Scenes } from "../effects/scenes";
import { WIDTH } from "../lib/frame";
import { Presenter } from "../lib/presenter";
import {
  BLEND,
  CREDITS_CARD,
  CREDITS_IN,
  CREDITS_OUT,
  EXITS,
  FINALE,
  FLASH,
  FLASH_IN,
  FLASH_OUT,
  LABEL_IN,
  LABEL_OUT,
  SCENE_COUNT,
  SECONDS,
  TITLE,
  TITLE_CARD,
} from "../lib/timeline";
import { touch } from "../lib/touch";

export const CANVAS_ID = "reel-frame";

const BOOT_FADE_S = 0.7;
const SKIP_FLASH_S = 0.35;
const TAP_SLOP_PX = 14;
const TAP_MS = 350;
const ATTACH_TRIES = 10;
const BAKE_BUDGET_MS = 9; // bake time per frame while the title plays

// Plays the reel: advances the clock, renders the scene (and the outgoing
// one during a transition) into the frame, and presents it with its caption
// card, flashes and progress bar. The scenes' tables bake a slice per frame
// behind the title card. Taps on the outer thirds skip; drags go to the
// effect.
class Reel {
  private readonly scenes = new Scenes();
  private readonly starts = new Float64Array(SCENE_COUNT);
  private readonly tick = (nowMs: number) => this.frame(nowMs);
  private presenter: Presenter | null = null;
  private scene = TITLE;
  private ready = false;
  private total = 0;
  private time = 0;
  private looped = false;
  private lastMs = -1;
  private elapsed = 0; // wall-clock seconds since the first frame
  private skipS = -1;
  private finger = -1;
  private downX = 0;
  private downY = 0;
  private downMs = 0;
  private lastX = 0;
  private lastY = 0;

  constructor() {
    for (let i = 0; i < SCENE_COUNT; i++) {
      this.starts[i] = this.total;
      this.total += SECONDS[i];
    }
  }

  start() {
    this.scenes.init();
    requestAnimationFrame(() => this.attach(0));
  }

  down(id: number, x: number, y: number) {
    if (this.finger >= 0) return;

    this.finger = id;
    this.downX = x;
    this.downY = y;
    this.downMs = Date.now();
    this.lastX = x;
    this.lastY = y;
    touch.press(x, y);
  }

  move(id: number, x: number, y: number) {
    if (id !== this.finger) return;

    this.lastX = x;
    this.lastY = y;
    touch.move(x, y);
  }

  up(id: number) {
    if (id !== this.finger) return;

    this.finger = -1;
    touch.release();
    const moved = Math.abs(this.lastX - this.downX) + Math.abs(this.lastY - this.downY);
    if (moved > TAP_SLOP_PX || Date.now() - this.downMs > TAP_MS) return;

    if (this.downX < WIDTH / 3) this.skip(-1);
    if (this.downX > (WIDTH * 2) / 3) this.skip(1);
  }

  // Jumps to the previous or next scene, past its incoming transition,
  // behind a short flash.
  private skip(step: number) {
    if (!this.ready) return;

    const target = (this.scene + step + SCENE_COUNT) % SCENE_COUNT;
    this.time = this.starts[target] + BLEND;
    this.skipS = this.elapsed;
  }

  // The canvas exists once the screen has been laid out.
  private attach(tries: number) {
    const canvas = document.getElementById(CANVAS_ID) as unknown as GeaCanvasElement | null;
    if (!canvas) {
      if (tries < ATTACH_TRIES) requestAnimationFrame(() => this.attach(tries + 1));
      return;
    }

    this.presenter = new Presenter(canvas.getContext("2d"));
    requestAnimationFrame(this.tick);
  }

  private frame(nowMs: number) {
    const presenter = this.presenter;
    if (!presenter) return;

    this.advance(nowMs);
    this.draw(presenter);
    requestAnimationFrame(this.tick);
  }

  private advance(nowMs: number) {
    // Real time, so the reel keeps its length whatever the frame rate; a
    // stall (the first frame, a long bake) counts as one frame.
    const dt = this.lastMs < 0 ? 0 : Math.min(0.1, (nowMs - this.lastMs) / 1000);
    this.lastMs = nowMs;
    this.elapsed += dt;
    this.time += dt;
    if (this.time >= this.total) {
      this.time -= this.total;
      this.looped = true;
    }

    // The title holds until every scene's tables are baked.
    if (!this.ready) {
      this.ready = this.scenes.prepare(BAKE_BUDGET_MS);
      this.time = Math.min(this.time, SECONDS[TITLE] - FLASH_IN - 0.1);
    }

    let scene = SCENE_COUNT - 1;
    while (scene > 0 && this.time < this.starts[scene]) scene--;
    this.scene = scene;
  }

  private draw(presenter: Presenter) {
    const scene = this.scene;
    const local = this.time - this.starts[scene];
    const previous = (scene + SCENE_COUNT - 1) % SCENE_COUNT;
    // The boot title has nothing before it.
    const entering = this.looped || scene !== TITLE;
    this.scenes.render(scene, presenter.pixels, presenter.words, local);

    const exit = EXITS[previous];
    if (entering && exit !== FLASH && local < BLEND) {
      const outgoing = local + SECONDS[previous];
      this.scenes.transition(previous, outgoing, local / BLEND, exit, presenter.pixels, presenter.words);
    }

    // A flash cut peaks on the boundary: rising at the end of one scene,
    // decaying into the next.
    let flash = 0;
    if (entering && exit === FLASH && local < FLASH_OUT) flash = 1 - local / FLASH_OUT;
    const remaining = SECONDS[scene] - local;
    if (EXITS[scene] === FLASH && remaining < FLASH_IN) flash = Math.max(flash, 1 - remaining / FLASH_IN);
    const sinceSkip = this.elapsed - this.skipS;
    if (this.skipS >= 0 && sinceSkip < SKIP_FLASH_S) flash = Math.max(flash, 1 - sinceSkip / SKIP_FLASH_S);
    const fade = this.elapsed < BOOT_FADE_S ? 1 - this.elapsed / BOOT_FADE_S : 0;
    const progress = this.time / this.total;

    // The caption card on cue at this point of the scene, if any.
    if (scene === TITLE) {
      presenter.present(TITLE_CARD, local, SECONDS[TITLE] - local, flash * flash, fade, progress);
    } else if (local >= LABEL_IN && local < LABEL_OUT) {
      presenter.present(scene, local - LABEL_IN, LABEL_OUT - local, flash * flash, fade, progress);
    } else if (scene === FINALE && local >= CREDITS_IN && local < CREDITS_OUT) {
      presenter.present(CREDITS_CARD, local - CREDITS_IN, CREDITS_OUT - local, flash * flash, fade, progress);
    } else {
      presenter.present(-1, 0, 0, flash * flash, fade, progress);
    }
  }
}

export const reel = new Reel();
