import type { GeaEmbeddedImage } from "@geastack/core";
import { loadAssetImage } from "@geastack/core";

// Fonts: each (family, size) pair is baked by a rule in styles/app.css.
export const NUMERAL_FONT = "40px Outfit L";
export const WORDMARK_FONT = "48px Outfit L";
export const TITLE_FONT = "20px Outfit M";
export const BODY_FONT = "14px Outfit M";
export const CAPTION_FONT = "12px Outfit M";

// Glass alphas are multiples of 0.2 so rectangles match the sprite pieces
// (scripts/make-glass.py) to the byte.
const DARK_INK = "rgb(24,36,48)";
const LIGHT_INK = "rgb(248,252,248)";

export const SUN_GOLD = "rgb(248,192,80)";
export const LIVE_GREEN = "rgb(88,216,136)";
export const SPARK_ORANGE = "rgb(248,160,88)";
export const NIGHT_BLUE = "rgb(16,24,48)";

// In the order of the ICON_* ids in data/weather.ts.
const CONDITION_ICONS = ["sun", "moon", "sun-cloud", "moon-cloud", "cloud", "rain", "snow", "horizon"];

// UI icon ids.
export const UI_WIND = 0;
export const UI_DROP = 1;
export const UI_UMBRELLA = 2;
export const UI_CHIP = 3;
export const UI_BOLT = 4;
export const UI_SUNRISE = 5;
export const UI_SUNSET = 6;
export const UI_WEEK = 7;
export const UI_TODAY = 8;
export const UI_PLAY = 9;
export const UI_PAUSE = 10;
export const UI_CLOSE = 11;
const UI_ICONS = [
  "wind",
  "drop",
  "umbrella",
  "chip",
  "bolt",
  "sunrise",
  "sunset",
  "week",
  "today",
  "play",
  "pause",
  "close",
];

// The ink, glass and icons of one theme. Bright scenes take dark ink on
// frosted glass; sunset, night and rain take white type on smoked glass.
export class Theme {
  readonly ink: string;
  readonly soft: string;
  readonly mute: string;
  readonly muteAlpha: number;
  readonly glass: string;
  readonly glassAlpha = 0.4;
  readonly hi = LIGHT_INK;
  readonly hiAlpha: number;
  readonly sheet: string;
  readonly sheetAlpha = 0.8;
  readonly icons: GeaEmbeddedImage[] = [];
  readonly ui: GeaEmbeddedImage[] = [];
  readonly capLeft: GeaEmbeddedImage;
  readonly capRight: GeaEmbeddedImage;
  readonly hiLeft: GeaEmbeddedImage;
  readonly hiRight: GeaEmbeddedImage;
  readonly focus: GeaEmbeddedImage;
  readonly cornerLeft: GeaEmbeddedImage;
  readonly cornerRight: GeaEmbeddedImage;

  constructor(dark: boolean) {
    const suffix = dark ? "l" : "d";
    this.ink = dark ? LIGHT_INK : DARK_INK;
    this.soft = dark ? "rgb(192,204,216)" : "rgb(56,72,88)";
    this.mute = dark ? LIGHT_INK : DARK_INK;
    this.muteAlpha = dark ? 0.28 : 0.2;
    this.glass = dark ? "rgb(8,16,32)" : LIGHT_INK;
    this.hiAlpha = dark ? 0.2 : 0.8;
    this.sheet = dark ? "rgb(8,16,32)" : "rgb(240,244,240)";
    for (let i = 0; i < CONDITION_ICONS.length; i++) {
      this.icons.push(loadAssetImage(`icons/${CONDITION_ICONS[i]}-${suffix}.png`));
    }
    for (let i = 0; i < UI_ICONS.length; i++) this.ui.push(loadAssetImage(`icons/${UI_ICONS[i]}-${suffix}.png`));
    this.capLeft = loadAssetImage(`ui/cap-left-glass-${suffix}.png`);
    this.capRight = loadAssetImage(`ui/cap-right-glass-${suffix}.png`);
    this.hiLeft = loadAssetImage(`ui/cap-left-hi-${suffix}.png`);
    this.hiRight = loadAssetImage(`ui/cap-right-hi-${suffix}.png`);
    this.focus = loadAssetImage(`ui/focus-hi-${suffix}.png`);
    this.cornerLeft = loadAssetImage(`ui/corner-left-sheet-${suffix}.png`);
    this.cornerRight = loadAssetImage(`ui/corner-right-sheet-${suffix}.png`);
  }
}
