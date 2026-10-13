// Caption cards: 0 the title, 1-5 the scenes' labels, 6 the credits. Each
// line rises into place after its delay; label cards also grow a gradient
// rule above the name. Fonts are baked by the rules in styles/app.css.
//
// The layout derives from the panel (lib/frame.ts): the large class
// (480x480, 410x502) takes bigger type than the small one (480x272), the
// margins grow on the portrait panel to clear its rounded corners, and the
// vertical positions are measured up from the bottom edge.
//
//   panel     class   hero  name       dots  caption  margin  name line  rule
//   480x480   large   72    56/48/40   20    14       16      H - 68     name - 36
//   410x502   large   72    56/48/40   20    14       28      H - 68     name - 36
//   480x272   small   72    48/40      16    12       16      H - 56     name - 31

import { HEIGHT, LARGE, PORTRAIT, WIDTH } from "./frame";

export const HERO = 0;
export const NAME = 1;
export const DOTS = 2;
export const CAPTION = 3;
export const NAME_SMALL = 4; // the name's fallbacks when a line is wider than the panel
export const NAME_SMALLER = 5;
export const FONTS = LARGE
  ? ["72px Outfit XL", "56px Outfit XL", "20px Doto", "14px Space Mono B", "48px Outfit XL", "40px Outfit XL"]
  : ["72px Outfit XL", "48px Outfit XL", "16px Doto", "12px Space Mono B", "40px Outfit XL", "40px Outfit XL"];
// A string whose ink spans each font's capitals, for centring lines.
export const INK_SAMPLES = ["GEASTCK", "T", "A", "A", "T", "T"];

export const LEFT = 0;
export const CENTRE = 1;
export const RIGHT = 2;

export type CaptionLine = {
  text: string;
  font: number;
  colour: string;
  align: number;
  centreY: number; // px of the ink's middle
  delay: number; // seconds after the card appears
};

export const MARGIN = PORTRAIT ? 28 : 16;
const BOTTOM = LARGE ? 33 : 23; // the last line's ink middle, up from the bottom edge
const NAME_UP = LARGE ? 68 : 56;
export const RULE_UP = LARGE ? 104 : 87; // the rule's row, up from the bottom edge
export const RULE_Y = HEIGHT - RULE_UP;
export const RULE_WIDTH = 32;
export const RULE_DELAY = 0.06;
// The darkened rows behind a label card reach above its index line.
export const SCRIM_ROWS = LARGE ? 132 : 104;

const TOP = PORTRAIT ? 36 : 22; // the hint's ink middle
const SUN_TOP = Math.round((HEIGHT * 172) / 272) - 10 - Math.round(Math.min(WIDTH * 0.15, HEIGHT * 0.235));
const HERO_Y = Math.round(SUN_TOP * 0.6);
const TITLE_DOTS_UP = LARGE ? 62 : 50;

const WHITE = "rgb(255,255,255)";
const TINT = "rgb(200,200,216)";
const WARM = "rgb(255,224,200)";

function label(index: string, name: string, tech: string, hint: string): CaptionLine[] {
  const nameY = HEIGHT - NAME_UP;
  return [
    { text: index, font: CAPTION, colour: TINT, align: LEFT, centreY: nameY - 44, delay: 0 },
    { text: name, font: NAME, colour: WHITE, align: LEFT, centreY: nameY, delay: 0.09 },
    { text: tech, font: CAPTION, colour: TINT, align: LEFT, centreY: HEIGHT - BOTTOM, delay: 0.16 },
    { text: hint, font: DOTS, colour: WARM, align: RIGHT, centreY: TOP, delay: 0.7 },
  ];
}

export const CARDS: CaptionLine[][] = [
  [
    { text: "GEASTACK", font: HERO, colour: WHITE, align: CENTRE, centreY: HERO_Y, delay: 0.25 },
    {
      text: `${WIDTH} × ${HEIGHT} · NO GPU`,
      font: DOTS,
      colour: WARM,
      align: CENTRE,
      centreY: HEIGHT - TITLE_DOTS_UP,
      delay: 0.52,
    },
    {
      text: "A REALTIME PRODUCTION · ALL TYPESCRIPT",
      font: CAPTION,
      colour: TINT,
      align: CENTRE,
      centreY: HEIGHT - BOTTOM,
      delay: 0.6,
    },
  ],
  label("01 / 05", "Tunnel", "ANGLE/DEPTH LUT · 256² TEXTURE", "DRAG TO STEER"),
  label("02 / 05", "Rotozoom", "16.16 FIXED POINT · TRUCHET TILES", "DRAG TO TURN AND ZOOM"),
  label("03 / 05", "Vortex", "PERSPECTIVE PARTICLES · TRAILS", "TOUCH TO MOVE THE EYE"),
  label("04 / 05", "Fire", "NOISE FLAMES · RISING HEAT PLUMES", "TOUCH TO FEED THE FIRE"),
  label("05 / 05", "Metaballs", "SIX FIELDS · ONE ISO-SURFACE", "DRAG A BALL"),
  label("NO GPU · ONE CODEBASE · THREE BOARDS", "All TypeScript.", "GEASTACK · THANKS FOR WATCHING", ""),
];

// The rule's brand gradient, cyan through indigo to magenta, in 2 px steps.
export const RULE_COLOURS = [
  "rgb(47,222,254)",
  "rgb(55,210,252)",
  "rgb(63,197,251)",
  "rgb(71,184,249)",
  "rgb(79,171,248)",
  "rgb(87,158,246)",
  "rgb(95,146,244)",
  "rgb(103,133,243)",
  "rgb(113,121,242)",
  "rgb(129,115,244)",
  "rgb(146,108,245)",
  "rgb(162,102,247)",
  "rgb(179,95,249)",
  "rgb(195,89,251)",
  "rgb(212,83,252)",
  "rgb(228,76,254)",
];
