import { Store } from "@geastack/core";
import { ADD, durationText, MODE_NAMES, RECIPES, type Step, TIMED } from "../data/recipes";
import { CONTENT_W as SEGMENTS_W } from "../layout";
import { arcView, SWEEP_DEG, timerView } from "./rings";
import { COOK, PREHEAT, READY, shell } from "./shell";

// Session phases.
export const HEATING = 0;
export const PROMPT = 1;
export const TIMER = 2;
export const DONE = 3;

const ROOM = 24; // °C
const PREHEAT_S_PER_DEGREE = 2.4; // a real oven: ~7 min to 200 °C
const DEMO_PREHEAT_S = 7; // demo: every preheat takes this long
const DEMO_STEP_S = 10; // demo: every timed step takes this long
const HOLD_S = 40; // time constant of the oven settling on a new setpoint
const REACHED_MS = 1500; // the "preheated" beat before the first prompt
const STEP_DONE_MS = 700; // a finished timer's beat before the next step
const ARM_MS = 3000; // the close button stays armed this long
const ADD_MINUTE_S = 60;
const SEGMENTS = 5;
const SEGMENT_GAP = 6;
const STORAGE_KEY = "ember.demo";
// The inner glow: brighter as the oven heats, breathing on top.
const GLOW_COLD = 40;
const GLOW_HOT = 200;
const BREATH = 36;
const BREATH_MS = 2600;

type Segment = { shown: boolean; cls: string; fill: number };
type FlowRow = { shown: boolean; done: boolean; cls: string; text: string };

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

// m:ss, or h:mm:ss from an hour up.
function clockText(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  const rest = whole % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

function easeOut(u: number): number {
  return 1 - (1 - u) * (1 - u);
}

// One cooking session, simulated: the preheat (the temperature rises with an
// easing curve), then each step in turn (prompts wait for a tap, timers count
// down), then the Ready moment. Demo mode compresses every phase to a few
// seconds. Per-frame state is in plain fields; store fields change only when
// what they show changes.
class CookStore extends Store {
  manual = false;
  dish = 0;
  name = "";
  phase = DONE;
  stepLabel = "";
  title = "";
  detail = "";
  promptKind = ADD;
  promptAction = "";
  modeName = "";
  mode = 0;
  targetText = "";
  tempText = "24";
  ovenText = "24 °C";
  etaText = "";
  timeText = "0:00";
  totalText = "";
  nextText = "";
  summaryText = "";
  paused = false;
  demo = true;
  arming = false;
  reached = false;
  keepWarm = false;
  // Flips on every new step so its entrance restarts.
  flip = false;
  segments: Segment[] = [
    { shown: true, cls: "segment", fill: 0 },
    { shown: true, cls: "segment", fill: 0 },
    { shown: true, cls: "segment", fill: 0 },
    { shown: true, cls: "segment", fill: 0 },
    { shown: true, cls: "segment", fill: 0 },
  ];
  segmentWidth = 0;
  // The same steps as a vertical list (Preheat).
  flow: FlowRow[] = [
    { shown: true, done: false, cls: "flow-row", text: "Preheat" },
    { shown: true, done: false, cls: "flow-row", text: "" },
    { shown: true, done: false, cls: "flow-row", text: "" },
    { shown: true, done: false, cls: "flow-row", text: "" },
    { shown: true, done: false, cls: "flow-row", text: "" },
  ];

  private steps: Step[] = [];
  private stepIndex = -1;
  private temperature = ROOM;
  private fromTemp = ROOM;
  private setpoint = ROOM;
  private preheatS = 1;
  private stepS = 1;
  private elapsedS = 0; // simulated seconds into the phase
  private lastFrame = 0;
  private startedAt = 0;
  private run = 0; // bumps to stop the frame loop
  private stepDone = false;
  private armedAt = 0;

  init() {
    this.demo = localStorage.getItem(STORAGE_KEY) !== "off";
    setInterval(() => this.cool(), 1000);
  }

  /** Starts a guided recipe. */
  startRecipe(index: number) {
    const recipe = RECIPES[index];
    this.manual = false;
    this.dish = index;
    this.name = recipe.name;
    this.steps = recipe.steps;
    this.begin(recipe.temp, recipe.mode);
  }

  /** Starts a manual bake: preheat, put the food in, then the timer. */
  startManual(temp: number, mode: number, minutes: number) {
    this.manual = true;
    this.name = `${MODE_NAMES[mode]} · ${temp} °C`;
    this.steps = [
      {
        kind: ADD,
        title: "Put your food in",
        detail: "The oven is at temperature.",
        minutes: 0,
        mode: mode,
        temp: temp,
      },
      {
        kind: TIMED,
        title: MODE_NAMES[mode],
        detail: `${durationText(minutes)} at ${temp} °C.`,
        minutes: minutes,
        mode: mode,
        temp: temp,
      },
    ];
    this.begin(temp, mode);
  }

  toggleDemo() {
    this.demo = !this.demo;
    localStorage.setItem(STORAGE_KEY, this.demo ? "on" : "off");
  }

  togglePause() {
    this.paused = !this.paused;
  }

  addMinute() {
    this.stepS = this.stepS + ADD_MINUTE_S;
    this.totalText = durationText(Math.round(this.stepS / 60));
  }

  /** The prompt's button: the cook has done it. */
  confirm() {
    if (this.phase === PROMPT) this.advance();
  }

  /**
   * Close button and USER button: the first press arms, the second stops
   * the session. True when it stopped.
   */
  close(): boolean {
    const now = Date.now();
    if (this.arming && now - this.armedAt < ARM_MS) {
      this.stop();
      return true;
    }

    this.arming = true;
    this.armedAt = now;
    setTimeout(() => this.disarm(now), ARM_MS);
    return false;
  }

  toggleKeepWarm() {
    this.keepWarm = !this.keepWarm;
  }

  /** Leaves the Ready screen. */
  finish() {
    this.keepWarm = false;
  }

  private begin(temp: number, mode: number) {
    this.stepIndex = -1;
    this.fromTemp = this.temperature;
    this.setpoint = temp;
    this.preheatS = Math.max(20, (temp - this.temperature) * PREHEAT_S_PER_DEGREE);
    this.elapsedS = 0;
    this.phase = HEATING;
    this.reached = false;
    this.paused = false;
    this.arming = false;
    this.mode = mode;
    this.modeName = MODE_NAMES[mode];
    this.targetText = `${temp} °C`;
    this.title = "Preheating";
    this.stepLabel = this.labelFor(0);
    this.nextText = this.steps[0].title;
    this.layoutSegments();
    this.readTemperature();
    shell.open(PREHEAT);
    arcView.attach();
    this.loop();
  }

  private loop() {
    this.run = this.run + 1;
    this.lastFrame = Date.now();
    this.startedAt = this.lastFrame;
    const run = this.run;
    requestAnimationFrame(() => this.frame(run));
  }

  private frame(run: number) {
    if (run !== this.run) return;

    const now = Date.now();
    const dt = Math.min(64, now - this.lastFrame) * 0.001;
    this.lastFrame = now;
    if (this.phase === HEATING) this.heat(dt, now);
    else if (this.phase === TIMER) this.time(dt);
    else this.hold(dt);
    if (this.phase !== DONE) requestAnimationFrame(() => this.frame(run));
  }

  private heat(dt: number, now: number) {
    if (!this.reached) {
      const speed = this.demo ? this.preheatS / DEMO_PREHEAT_S : 1;
      this.elapsedS = Math.min(this.preheatS, this.elapsedS + dt * speed);
      const u = this.elapsedS / this.preheatS;
      this.temperature = this.fromTemp + (this.setpoint - this.fromTemp) * easeOut(u);
      this.readTemperature();
      const minutes = Math.ceil((this.preheatS - this.elapsedS) / 60);
      const eta = u >= 1 ? "Ready" : `${minutes} min`;
      if (eta !== this.etaText) this.etaText = eta;
      if (u >= 1) this.reach(now);
    }

    const span = Math.max(1, this.setpoint - this.fromTemp);
    const sweep = (SWEEP_DEG * (this.temperature - this.fromTemp)) / span;
    const warmth = GLOW_COLD + ((GLOW_HOT - GLOW_COLD) * (this.temperature - this.fromTemp)) / span;
    arcView.show(sweep, warmth + this.breath(now));
  }

  private time(dt: number) {
    const step = this.steps[this.stepIndex];
    this.settleTemperature(dt, step.temp);
    if (!this.paused) {
      const speed = this.demo ? (step.minutes * 60) / DEMO_STEP_S : 1;
      this.elapsedS = Math.min(this.stepS, this.elapsedS + dt * speed);
    }

    const left = this.stepS - this.elapsedS;
    const text = clockText(left);
    if (text !== this.timeText) this.timeText = text;
    this.segmentFill(this.stepIndex + 1, this.elapsedS / this.stepS);
    timerView.show((SWEEP_DEG * left) / this.stepS, GLOW_HOT + this.breath(Date.now()));
    if (left > 0 || this.stepDone) return;

    this.stepDone = true;
    const run = this.run;
    setTimeout(() => {
      if (run === this.run) this.advance();
    }, STEP_DONE_MS);
  }

  // Prompts and the Ready screen: the oven holds its setpoint.
  private hold(dt: number) {
    const stepping = this.stepIndex >= 0 && this.stepIndex < this.steps.length;
    this.settleTemperature(dt, stepping ? this.steps[this.stepIndex].temp : this.setpoint);
  }

  private reach(now: number) {
    this.reached = true;
    this.startedAt = now;
    const run = this.run;
    setTimeout(() => {
      if (run === this.run && this.phase === HEATING) this.advance();
    }, REACHED_MS);
  }

  // The next step, or Ready after the last.
  private advance() {
    this.stepIndex = this.stepIndex + 1;
    this.markSegments();
    if (this.stepIndex >= this.steps.length) {
      this.ready();
      return;
    }

    const step = this.steps[this.stepIndex];
    this.title = step.title;
    this.detail = step.detail;
    this.mode = step.mode;
    this.modeName = MODE_NAMES[step.mode];
    this.targetText = `${step.temp} °C`;
    this.stepLabel = this.labelFor(this.stepIndex + 1);
    this.nextText = this.stepIndex + 1 < this.steps.length ? this.steps[this.stepIndex + 1].title : "Ready";
    this.flip = !this.flip;
    this.paused = false;
    this.stepDone = false;
    this.elapsedS = 0;
    if (step.kind === TIMED) {
      this.stepS = step.minutes * 60;
      this.totalText = durationText(step.minutes);
      this.timeText = clockText(this.stepS);
      this.phase = TIMER;
    } else {
      this.promptKind = step.kind;
      this.promptAction = step.kind === ADD ? "It's in" : "Done";
      this.phase = PROMPT;
    }

    if (shell.screen !== COOK) {
      arcView.detach();
      shell.open(COOK);
    }

    if (step.kind === TIMED) timerView.attach();
    else timerView.detach();
  }

  private ready() {
    this.run = this.run + 1;
    this.phase = DONE;
    const recipe = RECIPES[this.dish];
    this.summaryText = this.manual
      ? `${this.name} · ${this.totalText}`
      : `${durationText(recipe.minutes)} at ${recipe.temp} °C · ${this.steps.length} steps`;
    shell.open(READY);
  }

  private stop() {
    this.run = this.run + 1;
    this.arming = false;
    this.phase = DONE;
    timerView.detach();
    arcView.detach();
  }

  private disarm(armedAt: number) {
    if (this.armedAt === armedAt) this.arming = false;
  }

  // The oven drifts toward room temperature when nothing is cooking, and is
  // held warm on the Ready screen when asked.
  private cool() {
    if (this.phase !== DONE || shell.screen === PREHEAT || shell.screen === COOK) return;

    const goal = this.keepWarm ? 70 : ROOM;
    this.temperature = this.temperature + (goal - this.temperature) * 0.06;
    this.readTemperature();
  }

  private settleTemperature(dt: number, goal: number) {
    const speed = this.demo ? 8 : 1;
    this.temperature += (goal - this.temperature) * (1 - Math.exp((-dt * speed) / HOLD_S));
    this.readTemperature();
  }

  private readTemperature() {
    const whole = Math.round(this.temperature);
    const text = String(whole);
    if (text === this.tempText) return;

    this.tempText = text;
    this.ovenText = `${whole} °C`;
  }

  private breath(now: number): number {
    return BREATH * Math.sin(((now - this.startedAt) * 2 * Math.PI) / BREATH_MS);
  }

  private labelFor(step: number): string {
    return `Step ${step + 1} of ${this.steps.length + 1}`;
  }

  // Segments: one for the preheat and one per step.
  private layoutSegments() {
    const count = Math.min(SEGMENTS, this.steps.length + 1);
    this.segmentWidth = Math.floor((SEGMENTS_W - SEGMENT_GAP * (count - 1)) / count);
    for (let i = 0; i < SEGMENTS; i++) {
      const segment = this.segments[i];
      segment.shown = i < count;
      segment.cls = i === 0 ? "segment segment-now" : "segment";
      segment.fill = 0;
      const row = this.flow[i];
      row.shown = i < count;
      row.cls = i === 0 ? "flow-row flow-now" : "flow-row";
      row.done = false;
      if (i > 0 && i < count) row.text = this.steps[i - 1].title;
    }
  }

  private markSegments() {
    const now = this.stepIndex + 1;
    for (let i = 0; i < SEGMENTS; i++) {
      const segment = this.segments[i];
      const cls = i < now ? "segment segment-done" : i === now ? "segment segment-now" : "segment";
      if (cls !== segment.cls) segment.cls = cls;
      segment.fill = i < now ? this.segmentWidth : 0;
      const row = this.flow[i];
      row.cls = i < now ? "flow-row flow-done" : i === now ? "flow-row flow-now" : "flow-row";
      row.done = i < now;
    }
  }

  private segmentFill(index: number, amount: number) {
    if (index >= SEGMENTS) return;

    const fill = Math.round(this.segmentWidth * Math.min(1, amount));
    const segment = this.segments[index];
    if (fill !== segment.fill) segment.fill = fill;
  }
}

export const cook = new CookStore();
