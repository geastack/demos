#pragma once

#include "pixel.h"

// Native pixel surfaces an app draws like images: native code renders into
// one, TS wraps its id with imageFromId() and blits it with ctx.drawImage.
namespace disco::surface {

using Pixel = gea::framework::graphics::pixel::native_t;

// A width x height surface; returns its image id, or -1 when memory runs out.
double create(double width, double height);

// Direct access for native renderers; nullptr for an unknown id.
Pixel *pixels(int id);
int width(int id);
int height(int id);

}  // namespace disco::surface
