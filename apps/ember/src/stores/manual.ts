import { Store } from "@geastack/core";
import { CONVECTION, durationText } from "../data/recipes";
import { CHIP_COL_PITCH, CHIP_ROW_PITCH, CX, DIAL_CY, LAND } from "../layout";
import { clock } from "./clock";
import { cook } from "./cook";
import { ARC_RADIUS, arcView, SWEEP_DEG } from "./rings";
import { MANUAL, shell } from "./shell";

const MIN_TEMP = 50;
const MAX_TEMP = 250;
const TEMP_STEP = 5;
const STEPS = (MAX_TEMP - MIN_TEMP) / TEMP_STEP;
const DEG_PER_STEP = 6.75; // SWEEP_DEG / STEPS, as a fraction
const MIN_MINUTES = 5;
const MAX_MINUTES = 180;
const MINUTE_STEP = 5;
const ROOM = 24;
const PREHEAT_S_PER_DEGREE = 2.4;

// The dial: centred on the arc canvas.
const DIAL_X = CX;
const DIAL_Y = DIAL_CY;
const KNOB_HALF = 14;
const GRAB_RADIUS = 44; // the numeral in the middle is not a handle
const ARC_HALF = 135;
const DEG = Math.PI / 180;

// The arc chases the set temperature on a spring with a slight overshoot.
const STIFFNESS = 160;
const DAMPING = 17;
const SPRING_STEP_S = 1 / 120;
const GLOW_COLD = 30;
const GLOW_HOT = 210;
const BREATH = 28;
const BREATH_MS = 2600;
// Mode chips: the highlight slides between them (a column in landscape, a
// two by two grid when stacked).
const SLIDE_MS = 70; // time constant of the highlight's slide

// Manual mode: drag the dial to set the temperature, pick a mode, set a timer.
class ManualStore extends Store {
  temp = 180;
  mode = CONVECTION;
  minutes = 30;
  tempText = "180";
  timerText = "30 min";
  endText = "";
  // Each 5° step rolls the numeral from the direction of travel; two
  // identical keyframes per direction let consecutive steps restart it.
  readoutCls = "dial-readout";
  knobX = 0;
  knobY = 0;
  highlightLeft = 0;
  highlightTop = 0;

  private sweep = 0; // displayed, degrees
  private velocity = 0;
  private dragging = false;
  private rollFlip = false;
  private lastFrame = 0;
  private startedAt = 0;
  private run = 0;

  enter() {
    this.readoutCls = "dial-readout";
    this.highlightLeft = this.modeLeft();
    this.highlightTop = this.modeTop();
    this.sweep = 0;
    this.velocity = 0;
    this.describe();
    this.placeKnob();
    arcView.attach();
    this.run = this.run + 1;
    this.lastFrame = Date.now();
    this.startedAt = this.lastFrame;
    const run = this.run;
    requestAnimationFrame(() => this.frame(run));
  }

  // A touch on the dial, in screen px. The first contact decides whether the
  // gesture turns the dial at all (not on the numeral in the middle).
  point(x: number, y: number, first: boolean) {
    const dx = x - DIAL_X;
    const dy = y - DIAL_Y;
    if (first) this.dragging = dx * dx + dy * dy >= GRAB_RADIUS * GRAB_RADIUS;
    if (!this.dragging) return;

    const angle = Math.atan2(dx, -dy) / DEG;
    const step = this.stepIndex();
    // In the gap under the arc, stick to the end the dial is nearer.
    const inGap = Math.abs(angle) > ARC_HALF;
    const nearEnd = step > STEPS / 2 ? STEPS : 0;
    const index = inGap ? nearEnd : Math.round(((angle + ARC_HALF) * STEPS) / SWEEP_DEG);
    this.setTemp(MIN_TEMP + index * TEMP_STEP);
  }

  release() {
    this.dragging = false;
  }

  setMode(mode: number) {
    this.mode = mode;
  }

  changeTimer(delta: number) {
    this.minutes = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, this.minutes + delta * MINUTE_STEP));
    this.describe();
  }

  start() {
    this.run = this.run + 1;
    cook.startManual(this.temp, this.mode, this.minutes);
  }

  private stepIndex(): number {
    return Math.round((this.temp - MIN_TEMP) / TEMP_STEP);
  }

  private setTemp(temp: number) {
    if (temp === this.temp) return;

    const rising = temp > this.temp;
    this.temp = temp;
    this.tempText = String(temp);
    this.rollFlip = !this.rollFlip;
    this.readoutCls = `dial-readout ${rising ? "roll-up" : "roll-down"}-${this.rollFlip ? "a" : "b"}`;
    this.describe();
  }

  private describe() {
    this.timerText = durationText(this.minutes);
    const preheat = Math.ceil(((this.temp - ROOM) * PREHEAT_S_PER_DEGREE) / 60);
    this.endText = clock.synced ? `Done by ${clock.after(preheat + this.minutes)}` : `+ ${preheat} min preheat`;
  }

  private frame(run: number) {
    if (run !== this.run || shell.screen !== MANUAL) return;

    const now = Date.now();
    const dt = Math.min(48, now - this.lastFrame) * 0.001;
    this.lastFrame = now;
    const goal = this.stepIndex() * DEG_PER_STEP;
    for (let t = 0; t < dt; t += SPRING_STEP_S) {
      const h = Math.min(SPRING_STEP_S, dt - t);
      this.velocity += (STIFFNESS * (goal - this.sweep) - DAMPING * this.velocity) * h;
      this.sweep += this.velocity * h;
    }
    this.sweep = Math.max(0, Math.min(SWEEP_DEG, this.sweep));
    this.placeKnob();
    this.slideHighlight(dt);

    const warmth = GLOW_COLD + ((GLOW_HOT - GLOW_COLD) * this.sweep) / SWEEP_DEG;
    const breath = BREATH * Math.sin(((now - this.startedAt) * 2 * Math.PI) / BREATH_MS);
    arcView.show(this.sweep, warmth + breath);
    requestAnimationFrame(() => this.frame(run));
  }

  private placeKnob() {
    const angle = (ARC_HALF + this.sweep) * DEG;
    const x = Math.round(DIAL_X + ARC_RADIUS * Math.cos(angle)) - KNOB_HALF;
    const y = Math.round(DIAL_Y + ARC_RADIUS * Math.sin(angle)) - KNOB_HALF;
    if (x !== this.knobX) this.knobX = x;
    if (y !== this.knobY) this.knobY = y;
  }

  private modeLeft(): number {
    return LAND ? 0 : (this.mode % 2) * CHIP_COL_PITCH;
  }

  private modeTop(): number {
    return (LAND ? this.mode : Math.floor(this.mode / 2)) * CHIP_ROW_PITCH;
  }

  private slideHighlight(dt: number) {
    const goalLeft = this.modeLeft();
    const goalTop = this.modeTop();
    const k = 1 - Math.exp((-dt * 1000) / SLIDE_MS);
    const deltaLeft = goalLeft - this.highlightLeft;
    const deltaTop = goalTop - this.highlightTop;
    if (deltaLeft !== 0) this.highlightLeft = Math.abs(deltaLeft) < 0.5 ? goalLeft : this.highlightLeft + deltaLeft * k;
    if (deltaTop !== 0) this.highlightTop = Math.abs(deltaTop) < 0.5 ? goalTop : this.highlightTop + deltaTop * k;
  }
}

export const manual = new ManualStore();
