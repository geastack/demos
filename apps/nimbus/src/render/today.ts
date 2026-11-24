import { MARGIN, px, SQUARE, STACKED, W } from "../layout";
import { easeOut, progress } from "../motion";
import { forecast } from "../stores/forecast";
import { indoor, SPARK_COUNT } from "../stores/indoor";
import { shell } from "../stores/shell";
import { sun } from "../stores/sun";
import type { Painter } from "./painter";
import {
  BODY_FONT,
  CAPTION_FONT,
  LIVE_GREEN,
  NUMERAL_FONT,
  SMALL_ICON,
  SPARK_ORANGE,
  SUN_GOLD,
  type Theme,
  TITLE_FONT,
  UI_BOLT,
  UI_SUNRISE,
  UI_SUNSET,
} from "./palette";
import { paintSheet, panelEnter } from "./panel";

const TITLE = "Today";
// The sun arc: a half circle on the horizon, a dot every 10 degrees.
// The square panel squeezes the two columns into its width: the type is
// 1.4x, the columns are not.
const ARC_CX = STACKED ? Math.floor(W / 2) : SQUARE ? 132 : 124;
const ARC_DY = px(140); // the horizon below the sheet's top
const ARC_R = SQUARE ? 76 : 80;
const TIMES_DX = SQUARE ? 104 : 100; // sunrise / sunset either side of the arc
const DOT_COUNT = 19;
const RISE_DELAY = 260;
const RISE_MS = 1200;
// This device, right of the divider.
const DIVIDER_X = SQUARE ? 250 : 244;
const DEVICE_W = SQUARE ? 186 : 200;
const DEVICE_X = STACKED ? Math.floor((W - DEVICE_W) / 2) : DIVIDER_X + 20;
// Stacked panels put this device's readings under the sun arc.
const DEVICE_DY = STACKED ? 196 : 0;
const SPARK_STEP = SQUARE ? 7 : 8;
const SPARK_BAR = SQUARE ? 5 : 6;
const SPARK_MAX = px(24);

// Sunrise to sunset as a dotted half circle: when the panel opens the sun
// travels from sunrise to the current time and the dots behind it light up.
// Beside it, live readings from this board.
class TodayView {
  private readonly dotX = new Float32Array(DOT_COUNT);
  private readonly dotY = new Float32Array(DOT_COUNT);
  private measured = -1;
  private titleWidth = 0;
  private sunsetWidth = 0;
  private nextWidth = 0;
  private daylightWidth = 0;
  private caption = "";

  init() {
    for (let i = 0; i < DOT_COUNT; i++) {
      const angle = Math.PI - (i * Math.PI) / (DOT_COUNT - 1);
      this.dotX[i] = ARC_CX + ARC_R * Math.cos(angle);
      this.dotY[i] = -ARC_R * Math.sin(angle);
    }
  }

  paint(p: Painter, theme: Theme, now: number, top: number) {
    this.measure(p);
    paintSheet(p, theme, top, TITLE, this.caption, this.titleWidth);
    this.paintSun(p, theme, now, top);
    if (STACKED) p.rect(MARGIN + 4, top + 52 + DEVICE_DY - 12, W - 2 * (MARGIN + 4), 1, theme.mute, theme.muteAlpha);
    else p.rect(DIVIDER_X, top + px(52), 1, px(164), theme.mute, theme.muteAlpha);
    this.paintDevice(p, theme, now, top);
  }

  private measure(p: Painter) {
    if (this.measured === forecast.moment) return;

    this.measured = forecast.moment;
    this.caption = `Montecielo · ${forecast.date}`;
    this.titleWidth = p.width(TITLE, TITLE_FONT);
    this.sunsetWidth = p.width(sun.sunset, BODY_FONT);
    this.nextWidth = p.width(sun.next, BODY_FONT);
    this.daylightWidth = p.width(sun.daylight, CAPTION_FONT);
  }

  private paintSun(p: Painter, theme: Theme, now: number, top: number) {
    const enter = panelEnter(now, 80);
    const horizon = top + ARC_DY;
    const travel = shell.closing ? 1 : easeOut(progress(now, shell.panelAt, RISE_DELAY, RISE_MS));
    const position = sun.position * travel;
    const lit = sun.up ? Math.floor(position * (DOT_COUNT - 1) + 0.001) : -1;
    for (let i = 0; i < DOT_COUNT; i++) {
      if (i <= lit) p.circle(this.dotX[i], horizon + this.dotY[i], px(2), SUN_GOLD, enter);
      else p.circle(this.dotX[i], horizon + this.dotY[i], px(2), theme.mute, theme.muteAlpha * enter);
    }
    p.rect(ARC_CX - ARC_R - 16, horizon, 2 * ARC_R + 32, 1, theme.mute, theme.muteAlpha * enter);

    const angle = Math.PI - position * Math.PI;
    const x = ARC_CX + ARC_R * Math.cos(angle);
    const y = horizon - ARC_R * Math.sin(angle);
    const glow = sun.up ? 1 : 0.45;
    p.circle(x, y, px(16), SUN_GOLD, 0.28 * glow * enter);
    p.circle(x, y, px(9), SUN_GOLD, glow * enter);

    const timesY = horizon + px(8);
    const gap = SMALL_ICON + px(2);
    p.image(theme.ui[UI_SUNRISE], ARC_CX - TIMES_DX, timesY + px(2), enter);
    p.text(sun.sunrise, ARC_CX - TIMES_DX + gap, timesY, BODY_FONT, theme.ink, enter);
    const sunsetX = ARC_CX + TIMES_DX - gap - this.sunsetWidth;
    p.text(sun.sunset, sunsetX, timesY, BODY_FONT, theme.ink, enter);
    p.image(theme.ui[UI_SUNSET], ARC_CX + TIMES_DX - SMALL_ICON, timesY + px(2), enter);
    p.text(sun.next, ARC_CX - this.nextWidth * 0.5, horizon + px(32), BODY_FONT, theme.ink, enter);
    p.text(sun.daylight, ARC_CX - this.daylightWidth * 0.5, horizon + px(52), CAPTION_FONT, theme.soft, enter);
  }

  // The die temperature, labelled as what it is, a 24-second sparkline and
  // the supply voltage; the live dot pulses once a second.
  private paintDevice(p: Painter, theme: Theme, now: number, top: number) {
    const enter = panelEnter(now, 160);
    const y = top + DEVICE_DY + Math.round((1 - enter) * px(12));
    const pulse = 0.5 + 0.5 * Math.cos((now % 1000) * 0.006283);
    p.circle(DEVICE_X + px(4), y + px(57), px(2) + pulse * px(2), LIVE_GREEN, enter);
    p.text("Live from this device", DEVICE_X + px(14), y + px(50), CAPTION_FONT, theme.soft, enter);
    p.text(indoor.temp, DEVICE_X - px(2), y + px(64), NUMERAL_FONT, theme.ink, enter);
    p.text("MCU die temperature", DEVICE_X, y + px(112), CAPTION_FONT, theme.soft, enter);

    const base = y + px(160);
    const first = SPARK_COUNT - indoor.count;
    for (let i = 0; i < SPARK_COUNT; i++) {
      const x = DEVICE_X + i * SPARK_STEP;
      if (i < first) {
        p.rect(x, base - 2, SPARK_BAR, 2, theme.mute, theme.muteAlpha * enter);
        continue;
      }

      const height = Math.round(4 + indoor.levels[i] * (SPARK_MAX - 4));
      p.rect(x, base - height, SPARK_BAR, height, SPARK_ORANGE, enter * (0.55 + 0.45 * indoor.levels[i]));
    }

    p.text(indoor.range, DEVICE_X, base + px(6), CAPTION_FONT, theme.soft, enter);
    if (indoor.volts === "") {
      p.text(indoor.uptime, DEVICE_X, base + px(28), BODY_FONT, theme.ink, enter);
      return;
    }

    p.image(theme.ui[UI_BOLT], DEVICE_X, base + px(30), enter);
    p.text(indoor.volts, DEVICE_X + SMALL_ICON + px(4), base + px(28), BODY_FONT, theme.ink, enter);
    const uptimeWidth = p.width(indoor.uptime, CAPTION_FONT);
    p.text(indoor.uptime, DEVICE_X + DEVICE_W - uptimeWidth, base + px(30), CAPTION_FONT, theme.soft, enter);
  }
}

export const todayView = new TodayView();
