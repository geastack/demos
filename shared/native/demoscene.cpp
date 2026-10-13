#include "demoscene.h"

#include "surface.h"

#include <array>
#include <cmath>
#include <cstdint>

namespace disco::demoscene {

namespace {

using gea::framework::graphics::pixel::nativeColor;

constexpr float kTau = 6.2831853f;

// 256-entry sine table in 0..63, indexed with wrapping byte arithmetic.
const std::array<std::uint8_t, 256> &sineTable() {
	static std::array<std::uint8_t, 256> table = [] {
		std::array<std::uint8_t, 256> t{};
		for (int i = 0; i < 256; ++i) t[static_cast<std::size_t>(i)] = static_cast<std::uint8_t>(31.5f + 31.5f * std::sin(kTau * static_cast<float>(i) / 256.0f));
		return t;
	}();
	return table;
}

// A soft neon palette: cyan -> indigo -> magenta -> amber and back.
const std::array<surface::Pixel, 256> &palette() {
	static std::array<surface::Pixel, 256> table = [] {
		std::array<surface::Pixel, 256> p{};
		for (int i = 0; i < 256; ++i) {
			const float a = kTau * static_cast<float>(i) / 256.0f;
			const int r = static_cast<int>(128.0f + 127.0f * std::sin(a + 2.2f));
			const int g = static_cast<int>(96.0f + 90.0f * std::sin(a * 2.0f + 0.4f));
			const int b = static_cast<int>(150.0f + 105.0f * std::sin(a + 0.1f));
			p[static_cast<std::size_t>(i)] = nativeColor(r, g, b);
		}
		return p;
	}();
	return table;
}

}  // namespace

void plasma(double surfaceId, double timeMs) {
	const int id = static_cast<int>(surfaceId);
	surface::Pixel *out = surface::pixels(id);
	if (!out) return;

	// Computed at half resolution and written as 2x2 blocks: a smooth field
	// loses nothing, and the surface stays full size for a plain blit.
	const int w = surface::width(id);
	const int h = surface::height(id);
	const auto &sine = sineTable();
	const auto &colors = palette();
	const auto t = static_cast<std::uint32_t>(timeMs * 0.06);
	for (int y = 0; y + 1 < h; y += 2) {
		const int hy = y >> 1;
		const std::uint8_t rowA = sine[(hy * 3 + t) & 255];
		const std::uint8_t rowB = sine[(hy * 2 - t * 2) & 255];
		surface::Pixel *top = out + static_cast<std::size_t>(y) * static_cast<std::size_t>(w);
		surface::Pixel *bottom = top + w;
		for (int x = 0; x + 1 < w; x += 2) {
			const int hx = x >> 1;
			const int v = sine[(hx * 2 + t) & 255] + sine[(hx + hy + t * 3) & 255] + rowA + rowB;
			const surface::Pixel c = colors[static_cast<std::size_t>((v + t) & 255)];
			top[x] = c;
			top[x + 1] = c;
			bottom[x] = c;
			bottom[x + 1] = c;
		}
	}
}

}  // namespace disco::demoscene
