// The panel, read once at startup (CSS px = panel px), and everything that
// follows from its shape. 480x272 (landscape) is the shape the journey was
// tuned on; square and portrait panels widen the vertical field of view and
// pull the camera back a little, so the river still fits across the screen
// and the chain of lanterns still fits across the sky.

export const WIDTH = window.innerWidth;
export const HEIGHT = window.innerHeight;
export const ASPECT = WIDTH / HEIGHT;
// Large type and roomier overlays from this shorter side up (272 stays small).
export const BIG = Math.min(WIDTH, HEIGHT) >= 400;

const REF_ASPECT = 1.76;
const REF_FOV = 52;
const REF_TAN = Math.tan((REF_FOV * Math.PI) / 360);
// How much of the wider view a narrower screen takes (0 keeps the vertical
// field of view, 1 keeps the horizontal one).
const WIDEN = 0.6;
// How much further the camera sits back per unit of narrowing.
const PULL = 0.35;

const NARROW = ASPECT >= REF_ASPECT ? 1 : REF_ASPECT / ASPECT;
const TAN_HALF = REF_TAN * NARROW ** WIDEN;

// Vertical field of view, degrees. 480x272: 52. 480x480: ~68. 410x502: ~76.
export const FOV = (2 * Math.atan(TAN_HALF) * 180) / Math.PI;
// Pixels per radian at the screen centre.
export const FOCAL = HEIGHT / 2 / TAN_HALF;
// Camera distance behind the boat, relative to the landscape's.
export const BACK_SCALE = NARROW ** PULL;
// The chain of lanterns spans the width at the landscape's azimuths; a
// narrower view squeezes it to fit.
export const AZIMUTH_SCALE = Math.min(1, Math.atan(TAN_HALF * ASPECT) / Math.atan(REF_TAN * REF_ASPECT));
// Steering: a drag across the whole width moves the boat as far as it does
// on 480 px.
export const STEER_SCALE = 480 / WIDTH;

// Type classes by tier (each is one single-class rule in app.css).
export const CAPTION = BIG ? "caption-l" : "caption";
export const BODY = BIG ? "body-l" : "body";
export const COUNT = BIG ? "count-l" : "count";
export const WORDMARK_TOP = BIG ? "wordmark-l title-top title-top-l" : "wordmark title-top";
export const WORDMARK_BOTTOM = BIG ? "wordmark-l title-bottom title-bottom-l" : "wordmark title-bottom";
export const HERO = BIG ? "hero-l" : "hero";
export const KICKER = BIG ? "caption-l kicker kicker-l" : "caption kicker";
export const PROMPT_LEFT = BIG ? "body-l prompt prompt-left prompt-l" : "body prompt prompt-left";
export const PROMPT_END = BIG ? "body-l prompt prompt-end prompt-end-l" : "body prompt prompt-right";
export const ACCENT_COUNT = BIG ? "count-l accent" : "count accent";
export const PLUS = BIG ? "body-l accent plus plus-l" : "body accent plus";
export const BANNER = BIG ? "caption-l banner banner-l" : "caption banner";
export const BADGE = BIG ? "caption-l badge" : "caption badge";
export const BEST_CORNER = BIG ? "best-corner best-corner-l" : "best-corner";
export const TALLY = BIG ? "tally tally-l" : "tally";
export const HUD_LEFT = BIG ? "hud-block hud-left hud-l" : "hud-block hud-left";
export const HUD_RIGHT = BIG ? "hud-block hud-right hud-l" : "hud-block hud-right";
export const PIPS = BIG ? "pips pips-l" : "pips";
