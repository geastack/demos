// Native functions the disco-native compiler plugin binds (shared/native).

/** A native pixel surface; returns an image id for imageFromId(), or -1. */
declare function surfaceCreate(width: number, height: number): number;

/** Renders the colour plasma into a surface at the given time. */
declare function fxPlasma(surfaceId: number, timeMs: number): void;

// Board sensors (shared/native/sensors.cpp; add it to the app's nativeSources).

/** Die temperature in °C (NaN when the chip has no sensor). */
declare function boardTemperature(): number;

/** Supply voltage in volts (NaN where the chip cannot measure it). */
declare function boardSupply(): number;

/** A true random number in [0, 1) from the hardware generator. */
declare function boardRandom(): number;
