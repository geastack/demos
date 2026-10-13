#include "chrome.h"

#include <cmath>

namespace terra {

namespace {

namespace pixel = gea::framework::graphics::pixel;

constexpr int kTickStep = 5;

// RGB565 boards take the cheap 5-bit blend; other formats the engine's blend.
void blendRun(Pixel *row, int from, int to, Pixel colour, int alpha)
{
	if constexpr (sizeof(Pixel) == 2) {
		const std::uint16_t tint = pixel::toRgb565(colour);
		const int weight = (alpha + 4) >> 3;
		for (int x = from; x < to; ++x) row[x] = pixel::fromRgb565(blend565(pixel::toRgb565(row[x]), tint, weight));
	} else {
		for (int x = from; x < to; ++x) row[x] = pixel::blendNative(colour, row[x], alpha);
	}
}

}  // namespace

void Overlays::addPanel(const Panel &panel)
{
	if (count_ < kCapacity && panel.alpha > 0) panels_[count_++] = panel;
}

void Overlays::addTape(const Tape &tape)
{
	const Pixel white = pixel::nativeColor(255, 255, 255);
	const int first = static_cast<int>(std::ceil((tape.heading - tape.halfSpan) / kTickStep)) * kTickStep;

	for (int bearing = first; bearing <= tape.heading + tape.halfSpan; bearing += kTickStep) {
		const float offset = static_cast<float>(bearing) - tape.heading;
		const float edge = std::fabs(offset) / tape.halfSpan;
		const int step = ((bearing % 360) + 360) % 360;
		const int length = step % 45 == 0 ? 7 : (step % 15 == 0 ? 5 : 3);
		const float strength = (length > 3 ? 0.95f : 0.5f) * (1.0f - edge * edge);
		const int x = tape.centerX + static_cast<int>(std::lround(offset * tape.pxPerDegree));
		addPanel({x, tape.top, 1, length, 0, white, static_cast<int>(strength * static_cast<float>(tape.alpha))});
	}
}

int Overlays::pick(int left, int right, const Panel **picked) const
{
	int count = 0;
	for (int i = 0; i < count_; ++i) {
		const Panel &panel = panels_[i];
		if (panel.x < right && panel.x + panel.width > left) picked[count++] = &panel;
	}
	return count;
}

void blendPanelRow(Pixel *row, int y, int left, int right, const Panel &panel)
{
	if (y < panel.y || y >= panel.y + panel.height) return;

	// Distance into a corner's circle, measured at the pixel centre.
	const float radius = static_cast<float>(panel.radius);
	const float fromTop = static_cast<float>(panel.y + panel.radius - y) - 0.5f;
	const float fromBottom = static_cast<float>(y - (panel.y + panel.height - panel.radius)) + 0.5f;
	const float dy = fromTop > 0.0f ? fromTop : (fromBottom > 0.0f ? fromBottom : 0.0f);
	const float inset = dy > 0.0f ? radius - std::sqrt(radius * radius - dy * dy) : 0.0f;

	// Whole pixels inside, plus an antialiased pixel at each rounded edge.
	const float edgeLeft = static_cast<float>(panel.x) + inset;
	const float edgeRight = static_cast<float>(panel.x + panel.width) - inset;
	const int innerLeft = static_cast<int>(std::ceil(edgeLeft));
	const int innerRight = static_cast<int>(std::floor(edgeRight));
	const int edgeAlpha = static_cast<int>(static_cast<float>(panel.alpha) * (static_cast<float>(innerLeft) - edgeLeft));
	const auto run = [&](int from, int to, int alpha) {
		blendRun(row, from < left ? left : from, to > right ? right : to, panel.colour, alpha);
	};

	run(innerLeft, innerRight, panel.alpha);
	if (edgeAlpha > 0) {
		run(innerLeft - 1, innerLeft, edgeAlpha);
		run(innerRight, innerRight + 1, edgeAlpha);
	}
}

}  // namespace terra
