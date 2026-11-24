import { H, SQUARE, W } from "../layout";
import type { Painter } from "./painter";
import { BUTTON_ICON, type Theme } from "./palette";

// Sprite sizes: keep in step with scripts/make-glass.py.
export const PILL_H = SQUARE ? 34 : 24;
const CAP_W = PILL_H / 2;
export const BUTTON_R = SQUARE ? 25 : 18;
const SHEET_CORNER = SQUARE ? 25 : 18;

// Glass shapes built from pieces that never overlap (a translucent
// rectangle and a circle would double-blend where they meet): sprite caps
// with the middle filled by a rectangle of the same tone and alpha.

/** A frosted pill, PILL_H tall. `bright` uses the lighter focus tone. */
export function pill(p: Painter, theme: Theme, x: number, y: number, width: number, bright: boolean, alpha: number) {
  const color = bright ? theme.hi : theme.glass;
  const tone = bright ? theme.hiAlpha : theme.glassAlpha;
  p.image(bright ? theme.hiLeft : theme.capLeft, x, y, alpha);
  p.rect(x + CAP_W, y, width - 2 * CAP_W, PILL_H, color, tone * alpha);
  p.image(bright ? theme.hiRight : theme.capRight, x + width - CAP_W, y, alpha);
}

/** A round glass button with an icon; `on` while its panel is open or it is pressed. */
export function button(p: Painter, theme: Theme, cx: number, cy: number, icon: number, on: boolean, alpha: number) {
  if (on) p.circle(cx, cy, BUTTON_R, theme.hi, theme.hiAlpha * alpha);
  else p.circle(cx, cy, BUTTON_R, theme.glass, theme.glassAlpha * alpha);
  p.image(theme.ui[icon], cx - BUTTON_ICON / 2, cy - BUTTON_ICON / 2, alpha);
}

/** The bottom sheet from `top` to the panel's bottom edge, rounded on top. */
export function sheet(p: Painter, theme: Theme, top: number) {
  const corner = SHEET_CORNER;
  p.image(theme.cornerLeft, 0, top, 1);
  p.rect(corner, top, W - 2 * corner, corner, theme.sheet, theme.sheetAlpha);
  p.image(theme.cornerRight, W - corner, top, 1);
  p.rect(0, top + corner, W, H - top - corner, theme.sheet, theme.sheetAlpha);
}
