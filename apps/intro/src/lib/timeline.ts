// The intro's running order, in seconds from the start. Every frame is drawn
// from the clock alone, so each playback looks the same at any frame rate.

// 1. Boot: a cursor blinks, a flash command types, its status line answers.
export const CURSOR_IN = 0.3;
export const TYPE_START = 0.95;
export const TYPE_RATE = 34; // characters per second
export const STATUS_DELAY = 0.16; // after the command finishes typing
export const BOOT_CLEAR = 2.05;
export const BLINK_S = 0.5;

// 2. A board's dot grid fades up, circuit traces race in from the edges
// (cues in lib/traces.ts) and draw the base bar from its ends to the stem's
// root, then dim.
export const GRID_IN = 1.9;
export const GRID_FADE_S = 0.6;
export const BAR_START = 3.02;
export const BAR_S = 0.42;
export const TRACES_DIM_START = 3.5;
export const TRACES_DIM_S = 0.8;
export const TRACES_OUT_START = 5.3;
export const TRACES_OUT_S = 0.9;
export const TRACE_REMNANT = 0.18;

// 3. The sprout grows along its strokes from the root.
export const SPROUT_START = 3.44;
export const SPROUT_S = 1.5;

// 4. The star ignites.
export const SPARK = 4.98;
export const SPARK_FLASH_S = 0.4;
export const STAR_REVEAL_S = 0.2;
export const DOTS_START = 0.14; // after the spark
export const DOTS_S = 0.36;
export const BLOOM_S = 1.3;
export const BURST_S = 1.1;

// 5. The wordmark dissolves in, a sheen crosses the chrome, and the name,
// tagline and hairline settle.
export const WORD_START = 5.55;
export const WORD_S = 0.9;
export const SHEEN_START = 6.45;
export const SHEEN_S = 0.8;
export const RULE_START = 6.75;
export const RULE_S = 0.65;
export const NAME_IN = 6.9;
export const TAGLINE_IN = 7.1;
export const STRONG_IN = 7.25;
export const RISE_S = 0.5;
export const TYPE_SETTLED = 7.8; // every line of type in place from here on

// 6. Hold: the star twinkles, dust drifts, the hairline's gradient flows.
export const DUST_IN = 7.2;
export const DUST_FADE_S = 1.2;
export const TWINKLE_S = 2.4;
export const FLOW_S = 6; // one pass of the flowing gradient

// Revealed cells start white-hot and cool to their colour.
export const HOT_MS = 280;
