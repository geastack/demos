import type { ImageData565 } from "@geastack/core";
import { DAY_COUNT } from "../data/weather";
import { HIGH_RIGHT, MARGIN, ROW_H, ROWS_DY, TRACK_X } from "../layout";
import { forecast } from "../stores/forecast";
import { BAR_H, PALETTE_COUNT, paintGradient, TRACK_W, week } from "../stores/week";
import type { Painter } from "./painter";
import { BODY_FONT, CAPTION_FONT, type Theme, TITLE_FONT } from "./palette";
import { paintSheet, panelEnter } from "./panel";

const TITLE = "Next 7 days";
const NAME_X = MARGIN + 4;
const ICON_X = 84;
const PRECIP_X = 110;
const LOW_RIGHT = 196;
const DOT_RING = "rgb(24,36,48)";
const DOT_FILL = "rgb(248,252,248)";

// The seven-day outlook on a sheet: per day the name, condition icon,
// chance of rain or snow, and the low-to-high bar on the week's scale (a
// window onto one week-wide gradient, with round ends); today's bar carries
// a "now" dot. Rows rise in one after another.
class WeekView {
  private readonly gradients: ImageData565[] = [];
  private measured = -1;
  private titleWidth = 0;
  private readonly lowWidth = new Float32Array(DAY_COUNT);
  private readonly highWidth = new Float32Array(DAY_COUNT);

  /** Builds the gradient bars (once the canvas exists). */
  load(p: Painter) {
    for (let i = 0; i < PALETTE_COUNT; i++) {
      const image = p.createImage(TRACK_W, BAR_H);
      paintGradient(image.data16, i);
      this.gradients.push(image);
    }
  }

  paint(p: Painter, theme: Theme, now: number, top: number) {
    this.measure(p);
    paintSheet(p, theme, top, TITLE, week.summary, this.titleWidth);
    const gradient = this.gradients[week.palette];
    for (let i = 0; i < DAY_COUNT; i++) {
      const enter = panelEnter(now, 120 + i * 35);
      if (enter < 0.01) continue;

      const y = top + ROWS_DY + i * ROW_H + Math.floor((ROW_H - 24) / 2) + Math.round((1 - enter) * 8);
      p.text(week.names[i], NAME_X, y + 3, BODY_FONT, theme.ink, enter);
      p.image(theme.icons[week.icons[i]], ICON_X, y + 1, enter);
      p.text(week.precips[i], PRECIP_X, y + 5, CAPTION_FONT, theme.soft, enter);
      p.text(week.lows[i], LOW_RIGHT - this.lowWidth[i], y + 3, BODY_FONT, theme.soft, enter);
      p.text(week.highs[i], HIGH_RIGHT - this.highWidth[i], y + 3, BODY_FONT, theme.ink, enter);
      p.rect(TRACK_X, y + 9, TRACK_W, BAR_H, theme.mute, theme.muteAlpha * 0.6 * enter);
      if (enter < 0.5) continue;

      // The bar is opaque: its middle is copied from the gradient, its ends are discs.
      const left = week.barLeft[i];
      const width = week.barWidth[i];
      const radius = BAR_H * 0.5;
      p.put(gradient, TRACK_X, y + 9, left + radius, 0, width - BAR_H, BAR_H);
      p.circle(TRACK_X + left + radius, y + 9 + radius, radius, week.startColor[i], 1);
      p.circle(TRACK_X + left + width - radius, y + 9 + radius, radius, week.endColor[i], 1);
      if (i === 0) {
        p.circle(TRACK_X + week.nowLeft, y + 9 + radius, 6, DOT_RING, 1);
        p.circle(TRACK_X + week.nowLeft, y + 9 + radius, 4, DOT_FILL, 1);
      }
    }
  }

  private measure(p: Painter) {
    if (this.measured === forecast.moment) return;

    this.measured = forecast.moment;
    this.titleWidth = p.width(TITLE, TITLE_FONT);
    for (let i = 0; i < DAY_COUNT; i++) {
      this.lowWidth[i] = p.width(week.lows[i], BODY_FONT);
      this.highWidth[i] = p.width(week.highs[i], BODY_FONT);
    }
  }
}

export const weekView = new WeekView();
