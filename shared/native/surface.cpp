#include "surface.h"

#include "image.h"

#include <array>
#include <new>

namespace disco::surface {

namespace {

struct Surface {
	Pixel *pixels = nullptr;
	int width = 0;
	int height = 0;
};

// Image ids are small slot numbers; a surface is found by its id.
constexpr int kMaxSurfaces = 16;
std::array<int, kMaxSurfaces> gIds{};
std::array<Surface, kMaxSurfaces> gSurfaces{};
int gCount = 0;

const Surface *find(int id) {
	for (int i = 0; i < gCount; ++i) {
		if (gIds[static_cast<std::size_t>(i)] == id) return &gSurfaces[static_cast<std::size_t>(i)];
	}
	return nullptr;
}

}  // namespace

double create(double width, double height) {
	const int w = static_cast<int>(width);
	const int h = static_cast<int>(height);
	if (w <= 0 || h <= 0 || gCount >= kMaxSurfaces) return -1;

	auto *buffer = new (std::nothrow) Pixel[static_cast<std::size_t>(w) * static_cast<std::size_t>(h)]();
	if (!buffer) return -1;

	const int id = gea::framework::graphics::ImageStore::instance().registerBuffer(buffer, w, h);
	if (id < 0) {
		delete[] buffer;
		return -1;
	}
	gIds[static_cast<std::size_t>(gCount)] = id;
	gSurfaces[static_cast<std::size_t>(gCount)] = {buffer, w, h};
	++gCount;
	return id;
}

Pixel *pixels(int id) {
	const Surface *surface = find(id);
	return surface ? surface->pixels : nullptr;
}

int width(int id) {
	const Surface *surface = find(id);
	return surface ? surface->width : 0;
}

int height(int id) {
	const Surface *surface = find(id);
	return surface ? surface->height : 0;
}

}  // namespace disco::surface
