// The reel's running order. Scene i renders effect i (effects/scenes.ts)
// for SECONDS[i], then hands over to the next scene with EXITS[i]. Caption
// cards (text and layout in lib/captions.ts) show on the cues below.

export const CROSSFADE = 0;
export const IRIS = 1;
export const WIPE = 2;
export const FLASH = 3;

export const TITLE = 0;
export const FINALE = 5;
export const SCENE_COUNT = 6;

export const SECONDS = [3.4, 12, 10, 12, 12, 14];
export const EXITS = [FLASH, IRIS, CROSSFADE, FLASH, WIPE, CROSSFADE];

// Seconds an incoming scene overlaps the outgoing one (crossfade, iris,
// wipe), and the rise and decay of a flash cut.
export const BLEND = 0.9;
export const FLASH_IN = 0.22;
export const FLASH_OUT = 0.55;

// Caption cards: the title for the whole title scene, each scene's label
// for a while after it arrives, and the credits during the finale.
export const TITLE_CARD = 0;
export const CREDITS_CARD = 6;
export const LABEL_IN = 0.5;
export const LABEL_OUT = 4.6;
export const CREDITS_IN = 7;
export const CREDITS_OUT = 12.6;
