#pragma once

// Classic demoscene effects rendered natively into a surface.
namespace disco::demoscene {

// Colour plasma: four sine fields summed through a cycling palette.
void plasma(double surfaceId, double timeMs);

}  // namespace disco::demoscene
