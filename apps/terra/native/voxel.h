#pragma once

#include "pixel.h"
#include "world.h"

// Voxel-space renderer (the NovaLogic Comanche technique): each screen column
// marches a ray front to back over the height map and draws only what rises
// above everything nearer (a y-buffer), with coarser steps and mips far away.
namespace terra {

using Pixel = gea::framework::graphics::pixel::native_t;

struct Camera {
	float x;           // map texels
	float y;
	float heading;     // radians clockwise from north (-y)
	float altitude;    // height units
	float horizon;     // horizon row at the screen centre (pitch)
	float bank;        // radians; shears the horizon (the classic fake roll)
	float visibility;  // 0..1 share of the draw distance (fog)
};

class Overlays;

// Renders a view into a width x height frame (width a multiple of the column
// step, at most 480 x 272 on the STM32 build and 512 x 512 elsewhere), with the HUD overlays blended in. Draws only the sky
// while the terrain is still baking.
void renderFrame(const World &world, const Camera &camera, const Overlays &overlays, Pixel *out, int width, int height);

}  // namespace terra
