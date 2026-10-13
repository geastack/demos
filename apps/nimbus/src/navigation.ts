import { MOMENTS } from "./data/weather";
import { BUTTON_X, BUTTON_Y, CLOSE_DY, CLOSE_X } from "./layout";
import { sheetRest } from "./render/panel";
import { sky } from "./render/sky";
import { forecast } from "./stores/forecast";
import {
  BUTTON_CLOSE,
  BUTTON_DEMO,
  BUTTON_NONE,
  BUTTON_TODAY,
  BUTTON_WEEK,
  NONE,
  shell,
  TODAY,
  WEEK,
} from "./stores/shell";
import { STRIP_TOP, strip } from "./stores/strip";
import { sun } from "./stores/sun";
import { week } from "./stores/week";

const BOOT_MS = 1900; // the wordmark has risen; the scene starts to show
const DEMO_STEP_MS = 7000;
const IDLE_MS = 45_000;
const CLOCK_TICK_MS = 5000;
const ESCAPE_KEY = 27;
const HIT = 22; // half a button's touch target

let demoTimer = -1;
let stripTouch = false;
let outsideTouch = false;

// Screen flow that spans stores: the boot, touch routing, the panels, the
// demo cycle, the USER button as "back", and drifting home when left alone.

export function start() {
  setTimeout(() => finishBoot(), BOOT_MS);
  setInterval(() => checkIdle(), 1000);
  setInterval(() => forecast.tick(), CLOCK_TICK_MS);
}

function finishBoot() {
  if (!shell.booting) return;

  shell.booting = false;
  shell.bootedAt = Date.now();
  shell.poke();
  sky.reveal();
}

// ---- Touch: one full-screen layer, hit-tested here ----

export function pointerDown(x: number, y: number) {
  shell.poke();
  if (shell.booting) {
    finishBoot();
    return;
  }

  shell.pressed = buttonAt(x, y);
  if (shell.pressed !== BUTTON_NONE) return;

  if (shell.panel !== NONE) {
    outsideTouch = y < sheetRest(shell.panel);
    return;
  }

  if (y >= STRIP_TOP) {
    stripTouch = true;
    strip.down(x);
  }
}

export function pointerMove(x: number, _y: number) {
  if (stripTouch) strip.move(x);
}

export function pointerUp(x: number, y: number) {
  if (stripTouch) {
    stripTouch = false;
    strip.up(x);
    return;
  }

  const pressed = shell.pressed;
  shell.pressed = BUTTON_NONE;
  if (pressed !== BUTTON_NONE && buttonAt(x, y) === pressed) {
    press(pressed);
    return;
  }

  if (outsideTouch && y < sheetRest(shell.shownPanel)) closePanel();
  outsideTouch = false;
}

function near(x: number, y: number, cx: number, cy: number): boolean {
  return Math.abs(x - cx) <= HIT && Math.abs(y - cy) <= HIT;
}

function buttonAt(x: number, y: number): number {
  if (near(x, y, BUTTON_X[0], BUTTON_Y)) return BUTTON_WEEK;
  if (near(x, y, BUTTON_X[1], BUTTON_Y)) return BUTTON_TODAY;
  if (near(x, y, BUTTON_X[2], BUTTON_Y)) return BUTTON_DEMO;
  if (shell.panel !== NONE && near(x, y, CLOSE_X, sheetRest(shell.panel) + CLOSE_DY)) return BUTTON_CLOSE;
  return BUTTON_NONE;
}

function press(button: number) {
  if (button === BUTTON_WEEK) togglePanel(WEEK);
  if (button === BUTTON_TODAY) togglePanel(TODAY);
  if (button === BUTTON_DEMO) toggleDemo();
  if (button === BUTTON_CLOSE) closePanel();
}

// ---- Panels ----

function togglePanel(panel: number) {
  if (shell.panel === panel) {
    closePanel();
    return;
  }

  fillPanel(panel);
  shell.panel = panel;
  shell.shownPanel = panel;
  shell.closing = false;
  shell.panelAt = Date.now();
}

function fillPanel(panel: number) {
  if (panel === WEEK) week.load(forecast.current());
  if (panel === TODAY) sun.load(forecast.current(), forecast.moment);
}

function closePanel() {
  if (shell.panel === NONE) return;

  shell.panel = NONE;
  shell.closing = true;
  shell.panelAt = Date.now();
}

// ---- Demo: steps through the six moments, one per scene ----

function toggleDemo() {
  if (shell.demo) {
    shell.demo = false;
    clearInterval(demoTimer);
    return;
  }

  shell.demo = true;
  closePanel();
  nextMoment();
  demoTimer = setInterval(() => nextMoment(), DEMO_STEP_MS);
}

function nextMoment() {
  shell.demoAt = Date.now();
  strip.reset();
  forecast.load((forecast.moment + 1) % MOMENTS.length);
  if (shell.panel !== NONE) fillPanel(shell.panel);
}

export function back(keyCode: number) {
  if (keyCode !== ESCAPE_KEY) return;

  shell.poke();
  if (shell.panel !== NONE) {
    closePanel();
    return;
  }

  strip.home();
}

function checkIdle() {
  if (shell.demo || shell.booting || shell.quietFor() < IDLE_MS) return;

  closePanel();
  if (forecast.selected !== 0) strip.home();
}
