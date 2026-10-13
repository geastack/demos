import { nativePlugin, SHARED_FUNCTIONS } from "../../../shared/native/plugin.mjs";

// The board sensors (shared/native/sensors.cpp).
export const geatscPlugin = nativePlugin("nimbus", SHARED_FUNCTIONS);
