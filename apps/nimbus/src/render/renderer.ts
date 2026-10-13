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
    sky.paint(p, now);
    if (!shell.booting) this.paintApp(p, now);
    bootView.paint(p, now);
    p.present();
    requestAnimationFrame(() => this.frame());
  }

  private paintApp(p: Painter, now: number) {
    const theme = this.themes[forecast.dark ? 1 : 0];
    let rise = 0;
    if (shell.shownPanel !== NONE) {
      rise = panelRise(now);
      if (shell.closing && rise <= 0) {
        shell.shownPanel = NONE;
        shell.closing = false;
      }
    }

    nowView.paint(p, theme, now, rise);
    if (shell.shownPanel === NONE) return;

    const top = sheetTop(shell.shownPanel, rise);
    if (shell.shownPanel === WEEK) weekView.paint(p, theme, now, top);
    else todayView.paint(p, theme, now, top);
  }
}

export const renderer = new Renderer();
