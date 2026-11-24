import type { GeaCanvasElement } from "@geastack/core";
import { forecast } from "../stores/forecast";
import { NONE, shell, WEEK } from "../stores/shell";
import { strip } from "../stores/strip";
import { bootView } from "./boot";
import { nowView } from "./now";
import { Painter } from "./painter";
import { Theme } from "./palette";
import { panelRise, sheetTop } from "./panel";
import { sky } from "./sky";
import { todayView } from "./today";
import { weekView } from "./week";

export const CANVAS_ID = "nimbus";
const ATTACH_TRIES = 10;

// One full-screen canvas and nothing else that draws: a retained node over a
// full-screen canvas forces a compositing copy every frame, so the whole UI
// is painted into the canvas, over the sky, and presented once per frame.
class Renderer {
  private painter: Painter | null = null;
  private readonly themes: Theme[] = [];

  start() {
    requestAnimationFrame(() => this.attach(0));
  }

  // The canvas exists once the app has been laid out.
  private attach(tries: number) {
    const canvas = document.getElementById(CANVAS_ID) as unknown as GeaCanvasElement | null;
    if (!canvas) {
      if (tries < ATTACH_TRIES) requestAnimationFrame(() => this.attach(tries + 1));
      return;
    }

    const painter = new Painter(canvas.getContext("2d"));
    this.painter = painter;
    this.themes.push(new Theme(false));
    this.themes.push(new Theme(true));
    sky.load();
    weekView.load(painter);
    bootView.load();
    requestAnimationFrame(() => this.frame());
  }

  private frame() {
    const p = this.painter;
    if (!p) return;

    const now = Date.now();
    strip.update(now);
    sky.step(now);
    const theme = this.themes[forecast.dark ? 1 : 0];
    const app = !shell.booting;
    const rise = app ? this.rise(now) : 0;
    sky.paintBackdrop(p, now);
    if (app) nowView.paintGlass(p, theme, now, rise);
    sky.paintLayers(p, now);
    if (app) this.paintApp(p, theme, now, rise);
    bootView.paint(p, now);
    p.present();
    requestAnimationFrame(() => this.frame());
  }

  // How far the shown panel has risen (0..1); closes it once it is down.
  private rise(now: number): number {
    if (shell.shownPanel === NONE) return 0;

    const rise = panelRise(now);
    if (shell.closing && rise <= 0) {
      shell.shownPanel = NONE;
      shell.closing = false;
    }
    return rise;
  }

  private paintApp(p: Painter, theme: Theme, now: number, rise: number) {
    nowView.paint(p, theme, now, rise);
    if (shell.shownPanel === NONE) return;

    const top = sheetTop(shell.shownPanel, rise);
    if (shell.shownPanel === WEEK) weekView.paint(p, theme, now, top);
    else todayView.paint(p, theme, now, top);
  }
}

export const renderer = new Renderer();
