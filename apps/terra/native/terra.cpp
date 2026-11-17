#include "terra.h"

#include "bake.h"
#include "chrome.h"
#include "surface.h"
#include "voxel.h"

#include <cmath>

#ifdef __APPLE__
#include "canvas.h"
#include "ui/document.h"
#include "ui/tree_internal.h"
#endif

namespace terra {

namespace {

constexpr int kAheadSamples = 8;
constexpr float kAheadHalfWidth = 12.0f;  // texels either side of the flight path

World gWorld;
#ifdef __APPLE__
constexpr const char *kViewId = "terra-view";  // VIEW_ID in src/stores/flight.ts
#endif
Baker gBaker;
Overlays gOverlays;

int alphaOf(double opacity) { return static_cast<int>(255.0 * (opacity < 0 ? 0 : (opacity > 1 ? 1 : opacity)) + 0.5); }

float heightAt(int x, int y) { return static_cast<float>(texelHeight(gWorld.mips[0][(y & kMapMask) * kMapSize + (x & kMapMask)])); }

float interpolatedHeight(float x, float y)
{
	const float fx = std::floor(x);
	const float fy = std::floor(y);
	const int ix = static_cast<int>(fx);
	const int iy = static_cast<int>(fy);
	const float tx = x - fx;
	const float ty = y - fy;
	const float top = heightAt(ix, iy) + (heightAt(ix + 1, iy) - heightAt(ix, iy)) * tx;
	const float bottom = heightAt(ix, iy + 1) + (heightAt(ix + 1, iy + 1) - heightAt(ix, iy + 1)) * tx;
	return top + (bottom - top) * ty;
}

}  // namespace

double selectLandscape(double index) { return gBaker.begin(gWorld, landscape(static_cast<int>(index))) ? 1 : 0; }

double bakeStep(double budgetMs) { return gBaker.advance(gWorld, static_cast<float>(budgetMs)) ? 1 : 0; }

double renderView(double surfaceId, double x, double y, double heading, double altitude, double horizon, double bank,
                  double visibility)
{
	const Camera camera{static_cast<float>(x),        static_cast<float>(y),       static_cast<float>(heading),
	                    static_cast<float>(altitude), static_cast<float>(horizon), static_cast<float>(bank),
	                    static_cast<float>(visibility)};
#ifdef __APPLE__
	// Apple hosts present the <canvas> element's own pixels, so render straight
	// into them: drawing a separate surface into the canvas is a full-frame
	// copy, 33 MB a frame at 4K. The HUD then draws on top.
	{
		auto &tree = gea::embedded::ui::Tree::instance();
		const int node = gea::embedded::ui::Document::instance().getElementById(kViewId).id();
		const int sid = static_cast<int>(surfaceId);
		const int w = disco::surface::width(sid);
		const int h = disco::surface::height(sid);
		auto *canvas = node >= 0 ? tree.ensureCanvas(node, w, h) : nullptr;
		if (canvas && canvas->pixels() && canvas->width() == w && canvas->height() == h) {
			renderFrame(gWorld, camera, gOverlays, canvas->pixels(), w, h);
			gOverlays.clear();
			canvas->markDirty(0, 0, w - 1, h - 1);
			tree.markCanvasDirty(node);
			return 1;
		}
	}
#endif
	const int id = static_cast<int>(surfaceId);
	Pixel *out = disco::surface::pixels(id);
	if (!out) return 0;
	renderFrame(gWorld, camera, gOverlays, out, disco::surface::width(id), disco::surface::height(id));
	gOverlays.clear();
	return 0;
}

void queuePanel(double x, double y, double width, double height, double radius, double rgb, double opacity)
{
	const auto channels = static_cast<std::uint32_t>(rgb);
	const Pixel colour = gea::framework::graphics::pixel::nativeColor(static_cast<int>((channels >> 16) & 0xFFu),
	                                                                  static_cast<int>((channels >> 8) & 0xFFu),
	                                                                  static_cast<int>(channels & 0xFFu));
	gOverlays.addPanel({static_cast<int>(x), static_cast<int>(y), static_cast<int>(width), static_cast<int>(height),
	                    static_cast<int>(radius), colour, alphaOf(opacity)});
}

void queueTape(double centerX, double top, double heading, double halfSpan, double pxPerDegree, double opacity)
{
	gOverlays.addTape({static_cast<int>(centerX), static_cast<int>(top), static_cast<float>(heading),
	                   static_cast<float>(halfSpan), static_cast<float>(pxPerDegree), alphaOf(opacity)});
}

double groundHeight(double x, double y)
{
	if (!gWorld.ready) return 0;
	return interpolatedHeight(static_cast<float>(x), static_cast<float>(y));
}

double groundAhead(double x, double y, double heading, double distance)
{
	if (!gWorld.ready) return 0;

	const float forwardX = std::sin(static_cast<float>(heading));
	const float forwardY = -std::cos(static_cast<float>(heading));
	float highest = 0.0f;
	for (int i = 0; i <= kAheadSamples; ++i) {
		const float d = static_cast<float>(distance) * static_cast<float>(i) / kAheadSamples;
		const float cx = static_cast<float>(x) + forwardX * d;
		const float cy = static_cast<float>(y) + forwardY * d;
		for (const float side : {-kAheadHalfWidth, 0.0f, kAheadHalfWidth}) {
			const float h = interpolatedHeight(cx - forwardY * side, cy + forwardX * side);
			if (h > highest) highest = h;
		}
	}
	return highest;
}

double spawnX() { return gWorld.spawnX; }

double spawnY() { return gWorld.spawnY; }

}  // namespace terra
