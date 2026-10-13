import { H, W } from "../layout";
import type { Painter } from "./painter";
import type { Theme } from "./palette";

export const PILL_H = 24;
const CAP_W = 12;
export const BUTTON_R = 18;

// Glass shapes built from pieces that never overlap (a translucent
// rectangle and a circle would double-blend where they meet): sprite caps
// with the middle filled by a rectangle of the same tone and alpha.

/** A frosted pill, 24 px tall. `bright` uses the lighter focus tone. */
export function pill(p: Painter, theme: Theme, x: number, y: number, width: number, bright: boolean, alpha: number) {
  const color = bright ? theme.hi : theme.glass;
  const tone = bright ? theme.hiAlpha : theme.glassAlpha;
  p.image(bright ? theme.hiLeft : theme.capLeft, x, y, alpha);
  p.rect(x + CAP_W, y, width - 2 * CAP_W, PILL_H, color, tone * alpha);
  p.image(bright ? theme.hiRight : theme.capRight, x + width - CAP_W, y, alpha);
}

/** A round glass button with an 18 px icon; `on` while its panel is open or it is pressed. */
export function button(p: Painter, theme: Theme, cx: number, cy: number, icon: number, on: boolean, alpha: number) {
  if (on) p.circle(cx, cy, BUTTON_R, theme.hi, theme.hiAlpha * alpha);
  else p.circle(cx, cy, BUTTON_R, theme.glass, theme.glassAlpha * alpha);
  p.image(theme.ui[icon], cx - 9, cy - 9, alpha);
}

/** The bottom sheet from `top` to the panel's bottom edge, rounded on top. */
export function sheet(p: Painter, theme: Theme, top: number) {
  const corner = 18;
  p.image(theme.cornerLeft, 0, top, 1);
  p.rect(corner, top, W - 2 * corner, corner, theme.sheet, theme.sheetAlpha);
  p.image(theme.cornerRight, W - corner, top, 1);
  p.rect(0, top + corner, W, H - top - corner, theme.sheet, theme.sheetAlpha);
}
