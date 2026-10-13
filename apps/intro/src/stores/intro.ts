import type { GeaCanvasElement } from "@geastack/core";
import { Painter } from "../lib/painter";
import { Presenter } from "../lib/presenter";

export const CANVAS_ID = "intro-frame";

const ATTACH_TRIES = 10;

// Plays the intro: each frame paints the scene at the time since the start
// and presents it. The timeline ends on the lockup, which keeps idling; a
// tap plays it again from the start.
class Intro {
  private readonly tick = (nowMs: number) => this.frame(nowMs);
  private presenter: Presenter | null = null;
  private painter: Painter | null = null;
  private startMs = -1;

  start() {
    requestAnimationFrame(() => this.attach(0));
  }

  replay() {
    this.startMs = -1;
  }

  // The canvas exists once the screen has been laid out.
  private attach(tries: number) {
    const canvas = document.getElementById(CANVAS_ID) as unknown as GeaCanvasElement | null;
    if (!canvas) {
      if (tries < ATTACH_TRIES) requestAnimationFrame(() => this.attach(tries + 1));
      return;
    }

    const presenter = new Presenter(canvas.getContext("2d"));
    this.presenter = presenter;
    this.painter = new Painter(presenter.pixels);
    requestAnimationFrame(this.tick);
  }

  private frame(nowMs: number) {
    const presenter = this.presenter;
    const painter = this.painter;
    if (!presenter || !painter) return;

    if (this.startMs < 0) this.startMs = nowMs;
    painter.paint((nowMs - this.startMs) / 1000);
    presenter.present();
    requestAnimationFrame(this.tick);
  }
}

export const intro = new Intro();
