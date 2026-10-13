import { CLOSE_DY, CLOSE_X, H, MARGIN, TODAY_H, WEEK_H } from "../layout";
import { easeOut, progress } from "../motion";
import { BUTTON_CLOSE, shell, WEEK } from "../stores/shell";
import { button, sheet } from "./glass";
import type { Painter } from "./painter";
import { CAPTION_FONT, type Theme, TITLE_FONT, UI_CLOSE } from "./palette";

export { CLOSE_DY, CLOSE_X };

const OPEN_MS = 420;
const CLOSE_MS = 300;

/** How far the open (or closing) panel has risen, 0..1. */
export function panelRise(now: number): number {
  if (shell.closing) return 1 - easeOut(progress(now, shell.panelAt, 0, CLOSE_MS));

  return easeOut(progress(now, shell.panelAt, 0, OPEN_MS));
}

/** A panel's height: the sheet reaches from here to the panel's bottom edge. */
export function panelHeight(panel: number): number {
  return panel === WEEK ? WEEK_H : TODAY_H;
}

/** The open sheet's top edge once risen. */
export function sheetRest(panel: number): number {
  return H - panelHeight(panel);
}

/** The sheet's top edge at a rise. */
export function sheetTop(panel: number, rise: number): number {
  const height = panelHeight(panel);
  return Math.round(H - height + (1 - rise) * height);
}

/** Staggered entrance of a panel's content (rows, cards). */
export function panelEnter(now: number, delay: number): number {
  if (shell.closing) return 1;

  return easeOut(progress(now, shell.panelAt, delay, 380));
}

/** The sheet, its title and caption, and the close button. */
export function paintSheet(p: Painter, theme: Theme, top: number, title: string, caption: string, titleWidth: number) {
  sheet(p, theme, top);
  p.text(title, MARGIN + 4, top + 12, TITLE_FONT, theme.ink, 1);
  p.text(caption, MARGIN + 4 + titleWidth + 10, top + 19, CAPTION_FONT, theme.soft, 1);
  button(p, theme, CLOSE_X, top + CLOSE_DY, UI_CLOSE, shell.pressed === BUTTON_CLOSE, 1);
}
