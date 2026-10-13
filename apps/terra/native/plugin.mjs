import { nativePlugin, SHARED_FUNCTIONS } from "../../../shared/native/plugin.mjs";

export const geatscPlugin = nativePlugin("terra", {
  ...SHARED_FUNCTIONS,
  terraSelect: ["terra::selectLandscape", "terra.h"],
  terraBake: ["terra::bakeStep", "terra.h"],
  terraRender: ["terra::renderView", "terra.h"],
  terraPanel: ["terra::queuePanel", "terra.h"],
  terraTape: ["terra::queueTape", "terra.h"],
  terraGround: ["terra::groundHeight", "terra.h"],
  terraGroundAhead: ["terra::groundAhead", "terra.h"],
  terraSpawnX: ["terra::spawnX", "terra.h"],
  terraSpawnY: ["terra::spawnY", "terra.h"],
});
