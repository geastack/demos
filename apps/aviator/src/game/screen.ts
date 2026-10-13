// The panel, read once at startup (CSS px = panel px), and everything that
// follows from its shape. 480x272 (landscape) is the shape the game was
// tuned on; square and portrait panels widen the vertical field of view so
// the same stretch of sky and sea stays in view across the screen.

export const WIDTH = window.innerWidth;
export const HEIGHT = window.innerHeight;
export const ASPECT = WIDTH / HEIGHT;
// Large type and roomier HUD from this shorter side up (272 stays small).
export const BIG = Math.min(WIDTH, HEIGHT) >= 400;

const REF_ASPECT = 1.76;
const REF_FOV = 52;
// How much of the wider view a narrower screen takes: 0 keeps the vertical
// field of view (the plane would crowd the left edge), 1 keeps the
// horizontal one (the plane would shrink).
const WIDEN = 0.6;

// Vertical field of view, degrees. 480x272: 52. 480x480: ~68. 410x502: ~76.
export const FOV_BASE =
  ASPECT >= REF_ASPECT
    ? REF_FOV
    : (2 * Math.atan(Math.tan((REF_FOV * Math.PI) / 360) * (REF_ASPECT / ASPECT) ** WIDEN) * 180) / Math.PI;

// Type classes by tier (each is one single-class rule in app.css).
export const CAPTION = BIG ? "caption-l" : "caption";
export const BODY = BIG ? "body-l" : "body";
export const VALUE = BIG ? "value-l" : "value";
export const WORDMARK = BIG ? "wordmark-l" : "wordmark";
export const HERO = BIG ? "hero-l" : "hero";
export const BADGE = BIG ? "caption-l badge" : "caption badge";
export const PROMPT_OVER = BIG ? "body-l prompt-over" : "body prompt-over";
export const TAGLINE = BIG ? "body-l tagline" : "body tagline";
export const PULSE = BIG ? "body-l pulse" : "body pulse";
