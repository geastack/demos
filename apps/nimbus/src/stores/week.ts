import { DAY_COUNT, type Forecast } from "../data/weather";
import { TRACK_W } from "../layout";

export { TRACK_W };

export const BAR_H = 6;

// Week gradients, cold to hot along the track: per palette three
// RGB565-snapped stops (left end, middle, right end).
export const PALETTE_COLD = 0;
export const PALETTE_MILD = 1;
export const PALETTE_WARM = 2;
export const PALETTE_COUNT = 3;
const STOPS_R = [160, 136, 120, 120, 184, 240, 240, 248, 240];
const STOPS_G = [196, 216, 220, 220, 216, 212, 212, 160, 96];
const STOPS_B = [248, 240, 184, 184, 128, 96, 96, 72, 72];
const HALF = TRACK_W * 0.5;
const PER_HALF = 1 / HALF; // HALF is a double, so this divides in floating point

function channel(stops: number[], palette: number, column: number): number {
  const base = palette * 3;
  const left = column < HALF;
  const t = left ? column * PER_HALF : (column - HALF) * PER_HALF;
  const from = left ? stops[base] : stops[base + 1];
  const to = left ? stops[base + 1] : stops[base + 2];
  return Math.round(from + (to - from) * t);
}

/** Fills an RGB565 image TRACK_W x BAR_H with a palette's gradient. */
export function paintGradient(pixels: Uint16Array, palette: number) {
  for (let x = 0; x < TRACK_W; x++) {
    const r = channel(STOPS_R, palette, x) & 0xf8;
    const g = channel(STOPS_G, palette, x) & 0xfc;
    const b = channel(STOPS_B, palette, x) & 0xf8;
    const pixel = (r << 8) | (g << 3) | (b >> 3);
    for (let y = 0; y < BAR_H; y++) pixels[y * TRACK_W + x] = pixel;
  }
}

function colorAt(palette: number, column: number): string {
  const r = channel(STOPS_R, palette, column) & 0xf8;
  const g = channel(STOPS_G, palette, column) & 0xfc;
  const b = channel(STOPS_B, palette, column) & 0xf8;
  return `rgb(${r},${g},${b})`;
}

// The seven-day outlook: each day's low-to-high bar placed on the week's
// overall range (a window onto one week-wide gradient), with today's "now"
// dot. Plain fields: the canvas reads them every frame.
class WeekStore {
  readonly names: string[] = [];
  readonly icons: number[] = [];
  readonly precips: string[] = [];
  readonly lows: string[] = [];
  readonly highs: string[] = [];
  readonly barLeft: number[] = [];
  readonly barWidth: number[] = [];
  readonly startColor: string[] = [];
  readonly endColor: string[] = [];
  palette = PALETTE_MILD;
  nowLeft = 0;
  summary = "";

  init() {
    for (let i = 0; i < DAY_COUNT; i++) {
      this.names.push("");
      this.icons.push(0);
      this.precips.push("");
      this.lows.push("");
      this.highs.push("");
      this.barLeft.push(0);
      this.barWidth.push(0);
      this.startColor.push("");
      this.endColor.push("");
    }
  }

  load(data: Forecast) {
    let min = data.days[0].low;
    let max = data.days[0].high;
    for (let i = 1; i < DAY_COUNT; i++) {
      min = Math.min(min, data.days[i].low);
      max = Math.max(max, data.days[i].high);
    }

    this.palette = max <= 6 ? PALETTE_COLD : max <= 20 ? PALETTE_MILD : PALETTE_WARM;
    const scale = TRACK_W / Math.max(1, max - min);
    for (let i = 0; i < DAY_COUNT; i++) {
      const day = data.days[i];
      const left = Math.round((day.low - min) * scale);
      const width = Math.max(BAR_H, Math.round((day.high - day.low) * scale));
      this.names[i] = day.name;
      this.icons[i] = day.icon;
      this.precips[i] = day.precip >= 20 ? `${day.precip}%` : "";
      this.lows[i] = `${day.low}°`;
      this.highs[i] = `${day.high}°`;
      this.barLeft[i] = left;
      this.barWidth[i] = width;
      this.startColor[i] = colorAt(this.palette, left);
      this.endColor[i] = colorAt(this.palette, Math.min(TRACK_W - 1, left + width - 1));
    }

    this.nowLeft = Math.round((data.hours[0].temp - min) * scale);
    this.summary = `${min}° to ${max}° this week`;
  }
}

export const week = new WeekStore();
