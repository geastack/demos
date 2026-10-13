// geatsc plugins binding native functions to TS. Each app's own
// native/plugin.mjs builds one from the shared table plus its own entries:
//
//   export const geatscPlugin = nativePlugin("fluid", { ...SHARED_FUNCTIONS, fluidStep: ["fluid::step", "fluid.h"] });
//
// An entry maps a TS function name to [C++ symbol, header]. The header goes in
// the generated unit before the call (the compiler keys preambles by symbol).
import { inertPluginInstance } from "@geastack/compiler/plugin";

export const SHARED_FUNCTIONS = {
  surfaceCreate: ["disco::surface::create", "surface.h"],
  fxPlasma: ["disco::demoscene::plasma", "demoscene.h"],
  boardTemperature: ["disco::sensors::temperature", "sensors.h"],
  boardSupply: ["disco::sensors::supply", "sensors.h"],
  boardRandom: ["disco::sensors::random", "sensors.h"],
};

export function nativePlugin(name, functions) {
  const entries = Object.entries(functions);
  return () => ({
    name,
    instantiate() {
      return {
        ...inertPluginInstance,
        capabilities: {
          ...inertPluginInstance.capabilities,
          hostFunctions: new Map(entries.map(([ts, [symbol]]) => [ts, symbol])),
          hostPreambles: new Map(entries.map(([, [symbol, header]]) => [symbol, [`#include "${header}"`]])),
        },
      };
    },
  });
}

export const geatscPlugin = nativePlugin("disco-native", SHARED_FUNCTIONS);
