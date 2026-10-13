import {
  type Box,
  CHIP_GAP,
  CHIP_HEIGHT,
  CHIP_LEFT,
  CHIP_TOP,
  CHIP_WIDTH,
  COMPASS,
  chipLeft,
  PX_PER_DEGREE,
  TAPE_CENTER,
  TAPE_HALF_SPAN,
  TAPE_TOP,
  TELEMETRY,
  TITLE,
} from "./layout";
import { clamp, easeOutCubic } from "./motion";
import { KMH_PER_SPEED, METRES_PER_UNIT, PLACES } from "./places";

const PLATE = 0x080c18;
const ACCENT = 0xf8d078;
const PLATE_OPACITY = 0.42;
const PRESSED = 0x3c4660;

const READOUT_INTERVAL_MS = 120;
const CHROME_DELAY_MS = 400; // the instruments settle in just after the title
const CHROME_FADE_MS = 700;
const TITLE_IN_MS = 480;
const TITLE_HOLD_MS = 1800; // after the terrain appears
const TITLE_OUT_MS = 680;
const PRESS_MS = 160;
const LONG_AGO = -1e12;
const NEVER = 1e12;

function pad3(value: number): string {
  return value < 10 ? `00${value}` : value < 100 ? `0${value}` : String(value);
}

// "12 480", "−3 120": grouped thousands with a true minus sign.
function grouped(value: number): string {
  const whole = Math.round(Math.abs(value));
  const thousands = Math.floor(whole / 1000);
  const digits = thousands > 0 ? `${thousands} ${pad3(whole % 1000)}` : String(whole);
  return value < 0 ? `−${digits}` : digits;
}

// The instruments' state and their plates. Plates are blended natively into
// the frame (queued before it renders); the text goes on the canvas
// (HudPainter). Nothing sits over the canvas as a UI node, so it presents
// without a compositing copy.
export class Hud {
  place = 0;
  heading = "000°";
  altitude = "0";
  speed = "0";

  private startedAt = -1;
  private titlePending = false;
  private titleAt = LONG_AGO;
  private titleOutAt = LONG_AGO;
  private readoutAt = -1e9;
  private pressedChip = -1;
  private pressedAt = -1e9;

  // The active chip (and the altitude datum) follow a tap at once.
  selectPlace(index: number) {
    this.place = index;
  }

  // The title card rises on the next frame and holds until released.
  showTitle() {
    this.titlePending = true;
  }

  releaseTitle(now: number) {
    this.titleOutAt = now + TITLE_HOLD_MS;
  }

  // The chip under a point, or -1.
  chipAt(x: number, y: number): number {
    if (y < CHIP_TOP || y >= CHIP_TOP + CHIP_HEIGHT || x < CHIP_LEFT) return -1;

    const slot = Math.floor((x - CHIP_LEFT) / (CHIP_WIDTH + CHIP_GAP));
    const inside = x - chipLeft(slot) < CHIP_WIDTH;
    return slot < PLACES.length && inside ? slot : -1;
  }

  press(chip: number, now: number) {
    this.pressedChip = chip;
    this.pressedAt = now;
  }

  // `heading` in degrees, `altitude` in height units, `speed` in texels/s.
  update(heading: number, altitude: number, speed: number, now: number) {
    if (this.startedAt < 0) this.startedAt = now;
    if (this.titlePending) {
      this.titlePending = false;
      this.titleAt = now;
      this.titleOutAt = NEVER;
    }

    if (now - this.readoutAt < READOUT_INTERVAL_MS) return;

    this.readoutAt = now;
    this.heading = `${pad3(Math.round(heading) % 360)}°`;
    this.altitude = grouped(PLACES[this.place].baseElevation + altitude * METRES_PER_UNIT);
    this.speed = grouped(speed * KMH_PER_SPEED);
  }

  // Queues plates, tape ticks and caret for the next rendered frame;
  // `heading` in degrees.
  queueChrome(heading: number, now: number) {
    const chrome = this.chromeOpacity(now);
    if (chrome > 0) {
      const plate = PLATE_OPACITY * chrome;
      this.plate(COMPASS, 0, PLATE, plate);
      terraTape(TAPE_CENTER, TAPE_TOP, heading, TAPE_HALF_SPAN, PX_PER_DEGREE, chrome);
      terraPanel(TAPE_CENTER - 1, TAPE_TOP - 5, 2, 4, 0, ACCENT, chrome);
      this.plate(TELEMETRY, 0, PLATE, plate);
      for (let chip = 0; chip < PLACES.length; chip++) {
        const active = chip === this.place;
        const pressed = chip === this.pressedChip && now - this.pressedAt < PRESS_MS;
        const colour = active ? 0xffffff : pressed ? PRESSED : PLATE;
        const opacity = active ? 0.94 * chrome : pressed ? 0.8 * chrome : plate;
        terraPanel(chipLeft(chip), CHIP_TOP, CHIP_WIDTH, CHIP_HEIGHT, CHIP_HEIGHT / 2, colour, opacity);
      }
    }

    const title = this.titleOpacity(now);
    if (title > 0) this.plate(TITLE, this.titleOffset(now), PLATE, PLATE_OPACITY * title);
  }

  chromeOpacity(now: number): number {
    if (this.startedAt < 0) return 0;

    return easeOutCubic(clamp((now - this.startedAt - CHROME_DELAY_MS) / CHROME_FADE_MS, 0, 1));
  }

  // The title card fades up, holds while released, then drifts out.
  titleOpacity(now: number): number {
    const fadeIn = easeOutCubic(clamp((now - this.titleAt) / TITLE_IN_MS, 0, 1));
    const fadeOut = clamp((now - this.titleOutAt) / TITLE_OUT_MS, 0, 1);
    return Math.min(fadeIn, 1 - fadeOut);
  }

  titleOffset(now: number): number {
    const rise = 10 * (1 - easeOutCubic(clamp((now - this.titleAt) / TITLE_IN_MS, 0, 1)));
    const drift = -6 * clamp((now - this.titleOutAt) / TITLE_OUT_MS, 0, 1);
    return Math.round(rise + drift);
  }

  private plate(box: Box, offset: number, colour: number, opacity: number) {
    terraPanel(box.x, box.y + offset, box.width, box.height, box.radius, colour, opacity);
  }
}
