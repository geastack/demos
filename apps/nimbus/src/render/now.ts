import { HOUR_COUNT } from "../data/weather";
import {
  BUTTON_X,
  BUTTON_Y,
  CHIPS_Y,
  CLOCK_Y,
  CONDITION_Y,
  DETAILS_Y,
  HERO_FONT,
  HERO_X,
  HERO_Y,
  MARGIN,
  STRIP_H,
  STRIP_PAD,
  W,
} from "../layout";
import { easeOut, progress } from "../motion";
import { forecast } from "../stores/forecast";
import { BUTTON_DEMO, BUTTON_TODAY, BUTTON_WEEK, shell, TODAY, WEEK } from "../stores/shell";
import { CELL_W, STRIP_LEFT, STRIP_TOP, strip } from "../stores/strip";
import { button, PILL_H, pill } from "./glass";
import type { Painter } from "./painter";
import {
  BODY_FONT,
  CAPTION_FONT,
  type Theme,
  TITLE_FONT,
  UI_DROP,
  UI_PAUSE,
  UI_PLAY,
  UI_TODAY,
  UI_UMBRELLA,
  UI_WEEK,
  UI_WIND,
} from "./palette";

// Layout (px, see layout.ts). The hero column sits over the sky on the left,
// clear of the moon at the top left; the panel buttons top right; the strip
// at the bottom.
const CHIP_GAP = 8;
const DEMO_STEP_MS = 7000;
const DEMO_BAR_W = 24;

// Entrances after the boot: delay and duration (ms) per group.
const ENTER_TOP = 200;
const ENTER_HERO = 40;
const ENTER_TEXT = 120;
const ENTER_CHIPS = 180;
const ENTER_STRIP = 100;
const ENTER_MS = 460;
const RISE = 10; // px a rising element travels

// The Now screen, drawn over the sky every frame: the clock and panel
// buttons, the temperature (rolling between readings), the condition with
// the scrubbed hour, feels-like and the day's range, the wind / humidity /
// precipitation chips and the hourly strip.
class NowView {
  private shownTemp = 99999;
  private tempText = "";
  private measured = -1;
  private conditionWidth = 0;
  private whenWidth = 0;
  private windWidth = 0;
  private humidityWidth = 0;
  private precipWidth = 0;
  private bodyCenter = 0;
  private captionCenter = 0;
  private readonly labelWidth = new Float32Array(HOUR_COUNT);
  private readonly tempWidth = new Float32Array(HOUR_COUNT);
  private cellsMeasured = -1;

  /** `covered` (0..1): how far a panel has risen over the screen. */
  paint(p: Painter, theme: Theme, now: number, covered: number) {
    this.measure(p);
    const enterTop = this.enter(now, ENTER_TOP);
    this.paintTop(p, theme, now, enterTop);

    const shown = 1 - covered;
    if (shown < 0.01) return;

    const enterHero = this.enter(now, ENTER_HERO);
    const temp = forecast.shownTemp(now);
    if (temp !== this.shownTemp) {
      this.shownTemp = temp;
      this.tempText = `${temp}°`;
    }

    p.text(this.tempText, HERO_X, HERO_Y + (1 - enterHero) * RISE, HERO_FONT, theme.ink, enterHero * shown);

    const enterText = this.enter(now, ENTER_TEXT);
    const textY = (1 - enterText) * RISE;
    const textAlpha = enterText * shown;
    p.text(forecast.condition, MARGIN, CONDITION_Y + textY, TITLE_FONT, theme.ink, textAlpha);
    if (forecast.when !== "") {
      const x = MARGIN + this.conditionWidth + 10;
      const width = this.whenWidth + 20;
      pill(p, theme, x, CONDITION_Y + 1 + textY, width, true, textAlpha);
      const y = CONDITION_Y + 1 + PILL_H * 0.5 - this.captionCenter + textY;
      p.text(forecast.when, x + 10, y, CAPTION_FONT, theme.ink, textAlpha);
    }

    p.text(forecast.details, MARGIN, DETAILS_Y + textY, BODY_FONT, theme.ink, textAlpha);
    this.paintChips(p, theme, now, shown);
    this.paintStrip(p, theme, now, shown);
  }

  private enter(now: number, delay: number): number {
    return easeOut(progress(now, shell.bootedAt, delay, ENTER_MS));
  }

  // Text widths change only with the reading: measure them then.
  private measure(p: Painter) {
    if (this.measured === forecast.version) return;

    this.measured = forecast.version;
    this.conditionWidth = p.width(forecast.condition, TITLE_FONT);
    this.whenWidth = p.width(forecast.when, CAPTION_FONT);
    this.windWidth = p.width(forecast.wind, BODY_FONT);
    this.humidityWidth = p.width(forecast.humidity, BODY_FONT);
    this.precipWidth = p.width(forecast.precip, BODY_FONT);
    this.bodyCenter = p.inkCenter("0", BODY_FONT);
    this.captionCenter = p.inkCenter("0", CAPTION_FONT);
    if (this.cellsMeasured === forecast.moment) return;

    this.cellsMeasured = forecast.moment;
    for (let i = 0; i < HOUR_COUNT; i++) {
      this.labelWidth[i] = p.width(forecast.labels[i], CAPTION_FONT);
      this.tempWidth[i] = p.width(forecast.temps[i], BODY_FONT);
    }
  }

  private paintTop(p: Painter, theme: Theme, now: number, enter: number) {
    const y = (1 - enter) * RISE;
    p.text(forecast.clock, MARGIN, CLOCK_Y + y, TITLE_FONT, theme.ink, enter);
    const pressed = shell.pressed;
    button(p, theme, BUTTON_X[0], BUTTON_Y + y, UI_WEEK, pressed === BUTTON_WEEK || shell.panel === WEEK, enter);
    button(p, theme, BUTTON_X[1], BUTTON_Y + y, UI_TODAY, pressed === BUTTON_TODAY || shell.panel === TODAY, enter);
    const demoIcon = shell.demo ? UI_PAUSE : UI_PLAY;
    button(p, theme, BUTTON_X[2], BUTTON_Y + y, demoIcon, pressed === BUTTON_DEMO || shell.demo, enter);
    if (!shell.demo) return;

    // Under the demo button: fills toward the next demo step.
    const fill = ((now - shell.demoAt) % DEMO_STEP_MS) / DEMO_STEP_MS;
    const left = BUTTON_X[2] - DEMO_BAR_W * 0.5;
    p.rect(left, BUTTON_Y + 22, DEMO_BAR_W, 3, theme.mute, theme.muteAlpha);
    p.rect(left, BUTTON_Y + 22, Math.round(DEMO_BAR_W * fill), 3, theme.ink, 1);
  }

  private paintChips(p: Painter, theme: Theme, now: number, shown: number) {
    let x = MARGIN;
    x = this.chip(p, theme, x, UI_WIND, forecast.wind, this.windWidth, this.chipAlpha(now, 0) * shown);
    x = this.chip(p, theme, x, UI_DROP, forecast.humidity, this.humidityWidth, this.chipAlpha(now, 1) * shown);
    if (forecast.precip !== "") {
      this.chip(p, theme, x, UI_UMBRELLA, forecast.precip, this.precipWidth, this.chipAlpha(now, 2) * shown);
    }
  }

  private chipAlpha(now: number, index: number): number {
    return this.enter(now, ENTER_CHIPS + index * 40);
  }

  // One chip: icon and value on a glass pill; returns where the next starts.
  private chip(p: Painter, theme: Theme, x: number, icon: number, text: string, textWidth: number, alpha: number) {
    const width = Math.round(textWidth) + 36;
    pill(p, theme, x, CHIPS_Y, width, false, alpha);
    p.image(theme.ui[icon], x + 9, CHIPS_Y + 5, alpha);
    p.text(text, x + 27, CHIPS_Y + PILL_H * 0.5 - this.bodyCenter, BODY_FONT, theme.ink, alpha);
    return x + width + CHIP_GAP;
  }

  // Glass band, the fixed focus slot, and the cells sliding under it.
  private paintStrip(p: Painter, theme: Theme, now: number, shown: number) {
    const enter = this.enter(now, ENTER_STRIP);
    const top = STRIP_TOP + Math.round((1 - enter) * (STRIP_H + STRIP_PAD));
    const alpha = shown;
    p.rect(0, top, W, STRIP_H + STRIP_PAD, theme.glass, theme.glassAlpha * alpha);
    p.rect(0, top, W, 1, theme.hi, theme.hiAlpha * 0.6 * alpha);
    p.image(theme.focus, STRIP_LEFT + 2, top + 4, alpha);

    const offset = strip.offset;
    for (let i = 0; i < HOUR_COUNT; i++) {
      const x = STRIP_LEFT + i * CELL_W - offset;
      if (x < -CELL_W || x > W) continue;

      const center = x + CELL_W * 0.5;
      const focused = i === forecast.selected;
      if (forecast.midnight[i]) p.rect(x, top + 12, 1, 46, theme.mute, theme.muteAlpha * alpha);
      const labelColor = focused ? theme.ink : theme.soft;
      p.text(forecast.labels[i], center - this.labelWidth[i] * 0.5, top + 8, CAPTION_FONT, labelColor, alpha);
      p.image(theme.icons[forecast.icons[i]], center - 10, top + 25, alpha);
      p.text(forecast.temps[i], center - this.tempWidth[i] * 0.5, top + 46, BODY_FONT, theme.ink, alpha);
    }
  }
}

export const nowView = new NowView();
