import { hex } from "./geometry";

// Lantern River's palette: dusk indigo, teal water, paper white, lantern
// amber and vermilion. Every colour sits on the RGB565 grid (R and B
// multiples of 8, G of 4). Sky colours come in pairs: deep dusk, and the
// lantern-lit amber the scene warms toward as the sky fills.

// Sky, zenith to horizon, dusk then lantern-lit.
export const DUSK_SKY = [0x080c28, 0x141c48, 0x2c3068, 0x4c4480, 0x6c5c8c];
export const LIT_SKY = [0x201438, 0x482858, 0x904868, 0xd07858, 0xe8a060];
// Fog and the far ground fade into the horizon's colour.
export const DUSK_HAZE = DUSK_SKY[4];
export const LIT_HAZE = LIT_SKY[4];

// Far ridges, dusk then lit: back and front layer.
export const DUSK_RIDGES = [0x383c68, 0x1c2040];
export const LIT_RIDGES = [0x985868, 0x482c48];

export const MOON = hex(0xf0e8d0);
export const STAR = hex(0xc8d0f0);

// Water and land (lit by the scene's lights).
export const WATER_DEEP = hex(0x084448);
export const WATER = hex(0x187068);
export const FOAM = hex(0x88c8c0);
export const SHORE = hex(0x384838);
export const BANK = hex(0x386850);
export const MEADOW = hex(0x285440);
export const FAR_LAND = hex(0x203c40);

export const PAPER = hex(0xf0ece0);
export const PAPER_SHADE = hex(0xc8c8c8);
export const AMBER = hex(0xf8b048);
export const LANTERN_HOT = hex(0xf8e0a0);
export const VERMILION = hex(0xe84828);
export const LACQUER = hex(0x201c18);
export const STONE = hex(0x606470);
export const MOSS_STONE = hex(0x506058);
export const BARK = hex(0x684830);
export const HEARTWOOD = hex(0xb08858);
export const REED = hex(0x3c6c48);
export const REED_TIP = hex(0x90a060);
export const WHIRL_EYE = hex(0x082830);

// Lights: ambient and the moon, dusk then lit; the lanterns' warm light.
export const DUSK_AMBIENT = [0.3, 0.34, 0.6];
export const LIT_AMBIENT = [0.42, 0.33, 0.36];
export const DUSK_MOON = [0.62, 0.68, 0.9];
export const LIT_MOON = [0.4, 0.42, 0.55];
export const WARM_LIGHT = [1, 0.66, 0.36];
