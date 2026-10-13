import type { CanvasRenderingContext2D, GeaEmbeddedImage } from "@geastack/core";
import type { Hud } from "./hud";
import {
  CHIP_HEIGHT,
  CHIP_TOP,
  CHIP_WIDTH,
  COMPASS_LETTERS_Y,
  COMPASS_READOUT_Y,
  chipLeft,
  LARGE,
  PX_PER_DEGREE,
  TAPE_CENTER,
  TAPE_HALF_SPAN,
  TELEMETRY,
  TELEMETRY_ROW_ALT,
  TELEMETRY_ROW_SPEED,
  TELEMETRY_UNITS,
  TITLE,
  TITLE_ROW_COORDINATES,
  TITLE_ROW_NAME,
} from "./layout";
import { wrapDegrees } from "./motion";
import { PLACES } from "./places";

// Fonts: each (family, size) pair is baked by a rule in styles/app.css.
// The large class (480x480, 410x502) takes one size up from the small
// (480x272): 14/18/14/28 against 12/16/12/24.
const MONO_12 = LARGE ? "14px Plex Mono M" : "12px Plex Mono M";
const MONO_16 = LARGE ? "18px Plex Mono M" : "16px Plex Mono M";
const LABEL_12 = LARGE ? "14px Space Grotesk M" : "12px Space Grotesk M";
const TITLE_24 = LARGE ? "28px Space Grotesk B" : "24px Space Grotesk B";

const WHITE = "rgb(255,255,255)";
const MUTED = "rgb(176,184,204)";
const ACCENT = "rgb(248,208,120)";
const INK = "rgb(12,18,32)";

const MARKS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

// Blits the view and writes the HUD over it in one canvas batch.
//
// Every canvas call goes through the `ctx` field: generated code passes a
// context parameter by value, and a copy's recorded commands are lost. Style
// writes go through setters that skip repeats: each write also copies the
// context in generated code.
export class HudPainter {
  private readonly ctx: CanvasRenderingContext2D;
  private font = "";
  private fill = "";
  private alpha = -1;
  private monoAdvance = 0;
  private monoCentre = 0;
  private valueCentre = 0;
  private labelCentre = 0;
  private titleCentre = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.measure();
  }

  paint(image: GeaEmbeddedImage, hud: Hud, heading: number, now: number) {
    this.ctx.beginBatch();
    this.ctx.drawImage(image, 0, 0);

    const chrome = hud.chromeOpacity(now);
    if (chrome > 0) {
      this.compass(hud, heading, chrome);
      this.telemetry(hud, chrome);
      this.chips(hud, chrome);
    }

    const title = hud.titleOpacity(now);
    if (title > 0) this.title(hud, title, hud.titleOffset(now));

    this.setAlpha(1);
    this.ctx.endBatch();
  }

  // Ink centres per font, taken once: fillText anchors the line box's top.
  private measure() {
    this.setFont(MONO_12);
    this.monoAdvance = this.ctx.measureText("0");
    this.monoCentre = this.ctx.measureTextInkCenter("0");
    this.setFont(MONO_16);
    this.valueCentre = this.ctx.measureTextInkCenter("0");
    this.setFont(LABEL_12);
    this.labelCentre = this.ctx.measureTextInkCenter("A");
    this.setFont(TITLE_24);
    this.titleCentre = this.ctx.measureTextInkCenter("A");
  }

  private setFont(font: string) {
    if (font === this.font) return;

    this.font = font;
    this.ctx.font = font;
  }

  private setFill(fill: string) {
    if (fill === this.fill) return;

    this.fill = fill;
    this.ctx.fillStyle = fill;
  }

  private setAlpha(alpha: number) {
    if (alpha === this.alpha) return;

    this.alpha = alpha;
    this.ctx.globalAlpha = alpha;
  }

  private text(text: string, x: number, centreY: number, inkCentre: number) {
    this.ctx.fillText(text, Math.round(x), Math.round(centreY - inkCentre));
  }

  private compass(hud: Hud, heading: number, opacity: number) {
    this.setAlpha(opacity);
    this.setFont(MONO_12);
    this.setFill(WHITE);
    this.text(
      hud.heading,
      TAPE_CENTER - (this.monoAdvance * hud.heading.length) / 2,
      COMPASS_READOUT_Y,
      this.monoCentre,
    );

    this.setFont(LABEL_12);
    for (let i = 0; i < MARKS.length; i++) {
      const offset = wrapDegrees(i * 45 - heading);
      const edge = Math.abs(offset) / (TAPE_HALF_SPAN - 4);
      if (edge >= 1) continue;

      const mark = MARKS[i];
      this.setFill(i % 2 === 0 ? WHITE : MUTED);
      this.setAlpha(opacity * (1 - edge * edge));
      const x = TAPE_CENTER + offset * PX_PER_DEGREE - this.ctx.measureText(mark) / 2;
      this.text(mark, x, COMPASS_LETTERS_Y, this.labelCentre);
    }
  }

  // Two rows: label, right-aligned value, unit.
  private telemetry(hud: Hud, opacity: number) {
    const left = TELEMETRY.x + 12;
    const valueRight = TELEMETRY.x + TELEMETRY.width - TELEMETRY_UNITS;
    const unitLeft = valueRight + 6;
    const altitudeRow = TELEMETRY.y + TELEMETRY_ROW_ALT;
    const speedRow = TELEMETRY.y + TELEMETRY_ROW_SPEED;
    this.setAlpha(opacity);

    this.setFont(LABEL_12);
    this.setFill(MUTED);
    this.text("ALT", left, altitudeRow, this.labelCentre);
    this.text("SPD", left, speedRow, this.labelCentre);
    this.text("m", unitLeft, altitudeRow, this.labelCentre);
    this.text("km/h", unitLeft, speedRow, this.labelCentre);

    this.setFont(MONO_16);
    this.setFill(WHITE);
    this.text(hud.altitude, valueRight - this.ctx.measureText(hud.altitude), altitudeRow, this.valueCentre);
    this.text(hud.speed, valueRight - this.ctx.measureText(hud.speed), speedRow, this.valueCentre);
  }

  // White names on the dark chips, then the ink name on the active one:
  // grouped, since every style write costs a context copy in generated code.
  private chips(hud: Hud, opacity: number) {
    this.setFont(LABEL_12);
    this.setAlpha(opacity);
    this.setFill(WHITE);
    for (let chip = 0; chip < PLACES.length; chip++) {
      if (chip !== hud.place) this.chipName(chip);
    }

    this.setFill(INK);
    this.chipName(hud.place);
  }

  private chipName(chip: number) {
    const name = PLACES[chip].name;
    const centre = chipLeft(chip) + CHIP_WIDTH / 2;
    this.text(name, centre - this.ctx.measureText(name) / 2, CHIP_TOP + CHIP_HEIGHT / 2, this.labelCentre);
  }

  private title(hud: Hud, opacity: number, offset: number) {
    const place = PLACES[hud.place];
    const centre = TITLE.x + TITLE.width / 2;
    this.setAlpha(opacity);

    this.setFont(TITLE_24);
    this.setFill(WHITE);
    this.text(
      place.title,
      centre - this.ctx.measureText(place.title) / 2,
      TITLE.y + TITLE_ROW_NAME + offset,
      this.titleCentre,
    );

    this.setFont(MONO_12);
    this.setFill(ACCENT);
    const coordinates = place.coordinates;
    this.text(
      coordinates,
      centre - this.ctx.measureText(coordinates) / 2,
      TITLE.y + TITLE_ROW_COORDINATES + offset,
      this.monoCentre,
    );
  }
}
