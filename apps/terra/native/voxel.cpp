#include "voxel.h"

#include "chrome.h"

#ifdef __APPLE__
#include <TargetConditionals.h>
#include <dispatch/dispatch.h>

#include <unistd.h>

#include <atomic>
#include <memory>
#endif

#if defined(__ARM_NEON)
#include <arm_neon.h>
#endif

#include <algorithm>
#include <cmath>
#include <cstring>

// Hot scratch buffers go in DTCM on the STM32 board: 0-wait, and outside the
// 16 KB D-cache, so they never evict map lines. (STM32-only: the ESP32 chips
// have no DTCM, their scratch lives in internal RAM, which is already
// uncontended by the PSRAM-resident maps.) The frame limits follow: the F746
// build keeps its 480 x 272 strip so its DTCM budget is unchanged; everything
// Apple hosts support a 4K display; other hosts take up to 800 x 512.
// The width only sizes the column-angle table.
#if defined(__arm__)
#define TERRA_TCM __attribute__((section(".dtcm")))
#define TERRA_MAX_WIDTH 480
#define TERRA_MAX_HEIGHT 272
#elif defined(__APPLE__)
#define TERRA_TCM
#define TERRA_MAX_WIDTH 3840
#define TERRA_MAX_HEIGHT 2160
#else
#define TERRA_TCM
#define TERRA_MAX_WIDTH 800
#define TERRA_MAX_HEIGHT 512
#endif

namespace terra {

namespace {

using gea::framework::graphics::pixel::fromRgb565;
using gea::framework::graphics::pixel::toNative;

// ---- Quality and cost knobs ----
constexpr float kFieldOfView = 70.0f * kDegrees;  // horizontal
constexpr float kNearStep = 1.0f;                 // ray step near the camera, texels
#if defined(__APPLE__) && TARGET_OS_TV
// A 4K TV shows the far terrain in detail, so it sees further and the fog
// starts later: at the panel's distances only the ground under the camera reads.
constexpr float kDrawDistance = 640.0f;           // texels
constexpr float kFogStart = 0.5f;                 // share of the visible distance before fog begins
// A 4K screen: one ray per pixel through the voxel grid walk (the step march,
// with heights interpolated throughout, stays for kSmoothDistance > 0).
constexpr float kStepGrowth = 0.008f;
constexpr int kColumnStep = 1;
constexpr float kSmoothDistance = 0.0f;
#else
constexpr float kDrawDistance = 400.0f;           // texels
constexpr float kFogStart = 0.3f;                 // share of the visible distance before fog begins
constexpr float kStepGrowth = 0.035f;             // step = max(kNearStep, distance * kStepGrowth)
constexpr int kColumnStep = 2;                    // px per ray; 1 doubles the ray work for full detail
constexpr float kSmoothDistance = 0.0f;           // texels of interpolated heights near the camera (0: off)
#endif
constexpr float kMipStep = 2.0f;                  // ray step (texels) that moves sampling to mip 1, then doubling
constexpr float kWaterFresnelDistance = 200.0f;   // texels until water mirrors the sky most
constexpr float kSunGlowRadius = 90.0f;           // px at kSunReferenceWidth
constexpr float kSunDiscRadius = 7.0f;            // px at kSunReferenceWidth
constexpr float kSunReferenceWidth = 480.0f;      // the sun scales with the frame's width

constexpr int kMaxSteps = 320;
constexpr int kMaxWidth = TERRA_MAX_WIDTH;
constexpr int kMaxHeight = TERRA_MAX_HEIGHT;
// Rays render into a column-major strip in DTCM, flushed row by row into the
// (row-major, SDRAM) surface: columns straight into SDRAM cost a cache line
// per pixel. Apple hosts flush wider strips: a 4K row is nearly a page, so
// each flushed row costs a TLB miss, and wider strips write more per miss.
#if defined(__APPLE__)
constexpr int kStripRays = 64;
#else
constexpr int kStripRays = 16;
#endif
constexpr int kGlowLevels = 1024;
// Dithers the sun-haze bucket across columns so bucket edges do not band.
constexpr float kColumnDither[4] = {0.125f, 0.625f, 0.375f, 0.875f};
// Keeps sample coordinates positive so truncation floors; a multiple of the map size.
constexpr float kWrapOffset = 4096.0f;

// One distance along every column's ray: shared by all columns of a frame.
struct Step {
	float z;
	float scale;  // screen px per height unit at this distance
	std::uint8_t fog;    // 0..32
	std::uint8_t water;  // 0..32 sky reflection
};

// Level-of-detail distances of the grid walk: a cell of mip L > 0 whose centre
// lies nearer than kGridSplit[L - 1] texels to the camera splits into its four
// mip L-1 children, so the walk draws mip 0 out to 32 texels, mip 1 to 64,
// mip 2 to 128 and mip 3 beyond. The 4K TV keeps the finest cells twice as
// far: at the panel's distances they only show right under the camera.
#if defined(__APPLE__) && TARGET_OS_TV
constexpr float kGridSplit[kMipLevels - 1] = {64.0f, 128.0f, 256.0f};
#else
constexpr float kGridSplit[kMipLevels - 1] = {32.0f, 64.0f, 128.0f};
#endif
constexpr int kDepthTable = static_cast<int>(kDrawDistance) + 2;

struct Steps {
	Step at[kMaxSteps];
	int smoothEnd;             // steps [0, smoothEnd) interpolate heights
	int levelEnd[kMipLevels];  // then steps up to levelEnd[L] sample mip L
	// The grid walk's view of the same frame: draw distance, focal length, and
	// fog / water weights by whole texel of depth.
	float far;
	float focal;
	std::uint8_t fogAt[kDepthTable];
	std::uint8_t waterAt[kDepthTable];
};

TERRA_TCM Steps gSteps;
using Strip = Pixel[kStripRays][kMaxHeight];
#ifndef __APPLE__
TERRA_TCM Strip gStrip;
#endif

struct ColumnRay {
	float x;
	float y;
	float dx;
	float dy;
	float altitude;
	float horizon;
	std::uint16_t fog;
};

struct Sun {
	bool visible;
	int x;
	int y;
	int radiusSquared;
	int glowScale;  // d^2 -> glow level, 16.16
	const std::uint8_t *glow;  // the glow levels for this frame's sun size
};

inline Pixel toPixel(std::uint16_t rgb565) { return toNative(fromRgb565(rgb565)); }

inline float wrapAngle(float a)
{
	while (a > kPi) a -= 2.0f * kPi;
	while (a < -kPi) a += 2.0f * kPi;
	return a;
}

// Sun disc, corona and a wide soft halo, by squared distance; 0..32.
const std::uint8_t *glowTable(float sunScale)
{
	static std::uint8_t table[kGlowLevels];
	static float builtFor = 0.0f;
	if (builtFor == sunScale) return table;

	const float glowRadius = kSunGlowRadius * sunScale;
	const float discRadius = kSunDiscRadius * sunScale;
	for (int i = 0; i < kGlowLevels; ++i) {
		const float r = std::sqrt(static_cast<float>(i) / (kGlowLevels - 1));
		const float px = r * glowRadius;
		const float disc = 1.0f - smoothstep(discRadius - 0.75f, discRadius + 0.75f, px);
		const float corona = px > discRadius ? 0.5f * expNeg((px - discRadius) / (9.0f * sunScale)) : 0.5f;
		const float halo = 0.24f * (1.0f - r) * (1.0f - r);
		table[i] = static_cast<std::uint8_t>(32.0f * clamp01(disc + corona + halo) + 0.5f);
	}
	builtFor = sunScale;
	return table;
}

// Each column's angle off the view axis, for picking its sun-haze bucket.
const float *columnAngles(int width, float focal)
{
	static float angles[kMaxWidth];
	static int builtFor = 0;
	if (builtFor == width) return angles;

	for (int x = 0; x < width; ++x) angles[x] = std::atan((static_cast<float>(x) + 0.5f - 0.5f * width) / focal);
	builtFor = width;
	return angles;
}

void buildSteps(Steps &steps, float focal, float visibility)
{
	const float far = kDrawDistance * (visibility > 0.02f ? visibility : 0.02f);
	const float fogFrom = far * kFogStart;
	for (int &end : steps.levelEnd) end = 0;
	steps.smoothEnd = 0;
	steps.far = far;
	steps.focal = focal;
	for (int z = 0; z < kDepthTable; ++z) {
		const float fog = clamp01((static_cast<float>(z) - fogFrom) / (far - fogFrom));
		const float fresnel = clamp01(static_cast<float>(z) / kWaterFresnelDistance);
		steps.fogAt[z] = static_cast<std::uint8_t>(32.0f * fog * (2.0f - fog) + 0.5f);
		steps.waterAt[z] = static_cast<std::uint8_t>(32.0f * (0.25f + 0.65f * fresnel) + 0.5f);
	}

	int count = 0;
	for (float z = kNearStep; z < far && count < kMaxSteps; ++count) {
		const float dz = z * kStepGrowth > kNearStep ? z * kStepGrowth : kNearStep;
		const int level = dz < kMipStep ? 0 : (dz < 2.0f * kMipStep ? 1 : (dz < 4.0f * kMipStep ? 2 : 3));
		const float fog = clamp01((z - fogFrom) / (far - fogFrom));
		const float fresnel = clamp01(z / kWaterFresnelDistance);
		steps.at[count] = {z, focal / z, static_cast<std::uint8_t>(32.0f * fog * (2.0f - fog) + 0.5f),
		                   static_cast<std::uint8_t>(32.0f * (0.25f + 0.65f * fresnel) + 0.5f)};
		if (z < kSmoothDistance) steps.smoothEnd = count + 1;
		for (int l = level; l < kMipLevels; ++l) steps.levelEnd[l] = count + 1;
		z += dz;
	}
}

Sun placeSun(const World &world, const Camera &camera, float focal, float tanBank, int width, int height)
{
	const float off = wrapAngle(world.sunAzimuth - camera.heading);
	if (std::cos(off) < 0.2f) return {};

	const float x = 0.5f * width + std::tan(off) * focal;
	const float y = camera.horizon + (x - 0.5f * width) * tanBank - std::tan(world.sunElevation) * focal;
	const float sunScale = static_cast<float>(width) / kSunReferenceWidth;
	const float glowRadius = kSunGlowRadius * sunScale;
	const bool visible = x > -glowRadius && x < width + glowRadius && y > -glowRadius && y < height + glowRadius;
	const int radius = static_cast<int>(glowRadius);
	return {visible, static_cast<int>(x), static_cast<int>(y), radius * radius, ((kGlowLevels - 1) << 16) / (radius * radius), glowTable(sunScale)};
}

inline void fillSpan(Pixel *p, int rows, Pixel colour)
{
	for (; rows > 0; --rows) *p++ = colour;
}

inline std::uint16_t shade(Texel texel, const Step &step, std::uint16_t fog, std::uint16_t waterSky)
{
	std::uint16_t colour = texelColour(texel);
	if (texel & kWaterFlag) colour = blend565(colour, waterSky, step.water);
	return blend565(colour, fog, step.fog);
}

// Height between four texels: smooths the blocky steps close to the camera.
inline float bilinearHeight(const Texel *map, float x, float y, Texel *nearest)
{
	const int ix = static_cast<int>(std::floor(x));
	const int iy = static_cast<int>(std::floor(y));
	const float tx = x - static_cast<float>(ix);
	const float ty = y - static_cast<float>(iy);
	const int row = (iy & kMapMask) << kMapBits;
	const int nextRow = ((iy + 1) & kMapMask) << kMapBits;
	const int col = ix & kMapMask;
	const int nextCol = (ix + 1) & kMapMask;
	*nearest = map[row | col];
	const auto h = [map](int i) { return static_cast<float>(texelHeight(map[i])); };
	const float top = h(row | col) + (h(row | nextCol) - h(row | col)) * tx;
	const float bottom = h(nextRow | col) + (h(nextRow | nextCol) - h(nextRow | col)) * tx;
	return top + (bottom - top) * ty;
}

// Front-to-back walk of one ray through the height grid, cell by cell (a 2D
// DDA), drawing each cell's front face at the exact depth the ray enters it
// and its top face out to the depth it leaves.
// Returns the top row the terrain reached, early once the column is full.
//
// Sampling at fixed distances from the camera instead (the step march below)
// slides every sample across the map as the camera moves, so each frame lands
// on different texels and the column spans pop up and down: the terrain
// shimmers in motion. A cell entered at its own boundary projects to the same
// place frame to frame and moves smoothly.
//
// The level of detail is decided per cell, from the distance of the cell's own
// centre to the camera, so every ray agrees on it: a coarse cell is drawn whole
// or split whole into its four children. Switching levels at a fixed depth
// along each ray instead cuts through the middle of coarse cells, and that cut
// sweeps across the terrain as the camera moves, replacing big cells with small
// ones a slice at a time.
//
// The ray's direction has a forward component of 1, so distance along it is
// view depth z, and a cell entered at z projects with scale focal / z.
namespace {

struct CellWalk {
	const World &world;
	const Steps &steps;
	const ColumnRay &ray;
	Pixel *column;
	int bottom;
	float adx;
	float ady;
	int stepX;
	int stepY;

	// Draws the cell's front face (its height at the entry depth) and, seen from
	// above, its top face out to the exit depth: up to whichever projects higher.
	// Fog and water take the distance of the cell's centre, so a cell is one
	// colour in every column: the depth where each ray enters it differs per
	// column and per frame, and fog by that depth ripples across the terrain.
	// The fog distance is that of the cell's far corner (its centre's distance,
	// from `distanceSquared`, plus half its diagonal), so fog is complete at the
	// draw distance and the far cut never shows. It is only taken once the cell
	// is known to show.
	// Returns true once the column is full.
	bool draw(Texel texel, float entry, float exit, float distanceSquared, float cell)
	{
		// The higher of the two projections: the top face's far edge for ground
		// below the eye, the front face for ground above it.
		const float rise = (ray.altitude - static_cast<float>(texelHeight(texel))) * steps.focal;
		const int y = static_cast<int>(rise / (rise > 0.0f ? exit : entry) + ray.horizon);
		if (y >= bottom) return false;
		const int distance = static_cast<int>(std::sqrt(distanceSquared) + 0.7072f * cell);
		const int depth = distance < kDepthTable - 1 ? distance : kDepthTable - 1;
		std::uint16_t colour = texelColour(texel);
		if (texel & kWaterFlag) colour = blend565(colour, world.waterSky, steps.waterAt[depth]);
		colour = blend565(colour, ray.fog, steps.fogAt[depth]);
		const int top = y > 0 ? y : 0;
		fillSpan(column + top, bottom - top, toPixel(colour));
		bottom = top;
		return bottom == 0;
	}

	// Walks the mip `level` cells the ray crosses between depths z0 and z1,
	// within cells [loX, loX + span) x [loY, loY + span) of that level.
	bool walk(int level, float z0, float z1, int loX, int loY, int span)
	{
		const float cell = static_cast<float>(1 << level);
		const float px = ray.x + ray.dx * z0;
		const float py = ray.y + ray.dy * z0;
		int cx = static_cast<int>(std::floor(px / cell));
		int cy = static_cast<int>(std::floor(py / cell));
		// The entry point lies on the parent's boundary: rounding may land it in
		// the neighbour, so keep it inside the parent.
		cx = cx < loX ? loX : (cx >= loX + span ? loX + span - 1 : cx);
		cy = cy < loY ? loY : (cy >= loY + span ? loY + span - 1 : cy);
		const float deltaX = adx > 1e-6f ? cell / adx : 1e30f;
		const float deltaY = ady > 1e-6f ? cell / ady : 1e30f;
		float nextX = adx > 1e-6f ? z0 + ((stepX > 0 ? (cx + 1) * cell - px : px - cx * cell) / adx) : 1e30f;
		float nextY = ady > 1e-6f ? z0 + ((stepY > 0 ? (cy + 1) * cell - py : py - cy * cell) / ady) : 1e30f;
		if (nextX < z0) nextX = z0;
		if (nextY < z0) nextY = z0;

		const Texel *map = world.mips[level].get();
		const int bits = kMapBits - level;
		const int mask = (1 << bits) - 1;
		const float split = level > 0 ? kGridSplit[level - 1] : 0.0f;
		const float splitSquared = split * split;

		float z = z0;
		while (z < z1) {
			const float boundary = nextX < nextY ? nextX : nextY;
			const float exit = boundary < z1 ? boundary : z1;
			if (exit > z) {
				const float ox = (static_cast<float>(cx) + 0.5f) * cell - ray.x;
				const float oy = (static_cast<float>(cy) + 0.5f) * cell - ray.y;
				const float distanceSquared = ox * ox + oy * oy;
				if (distanceSquared < splitSquared) {
					if (walk(level - 1, z, exit, cx * 2, cy * 2, 2)) return true;
				} else if (draw(map[((cy & mask) << bits) | (cx & mask)], z, exit, distanceSquared, cell)) {
					return true;
				}
			}
			if (boundary >= z1) break;
			if (nextX < nextY) {
				nextX += deltaX;
				cx += stepX;
				if (cx < loX || cx >= loX + span) break;
			} else {
				nextY += deltaY;
				cy += stepY;
				if (cy < loY || cy >= loY + span) break;
			}
			z = boundary;
		}
		return false;
	}
};

}  // namespace

int walkColumn(const World &world, const Steps &steps, const ColumnRay &ray, Pixel *column, int bottom)
{
	CellWalk walk{world, steps, ray, column, bottom, std::fabs(ray.dx), std::fabs(ray.dy),
	              ray.dx < 0 ? -1 : 1, ray.dy < 0 ? -1 : 1};
	constexpr int kWide = 1 << 30;  // the top level is unbounded (the map wraps)
	walk.walk(kMipLevels - 1, kNearStep, steps.far, -kWide / 2, -kWide / 2, kWide);
	return walk.bottom;
}

// Front-to-back march of one ray into a strip column; returns the top row
// the terrain reached. Returns early once the column is full.
int marchColumn(const World &world, const Steps &steps, const ColumnRay &ray, Pixel *column, int bottom)
{
	int i = 0;
	const auto draw = [&](int y, Texel texel, const Step &step) {
		const int top = y > 0 ? y : 0;
		fillSpan(column + top, bottom - top, toPixel(shade(texel, step, ray.fog, world.waterSky)));
		bottom = top;
	};

	const Texel *nearMap = world.mips[0].get();
	for (const int end = steps.smoothEnd; i < end; ++i) {
		const Step &step = steps.at[i];
		Texel texel;
		const float ground = bilinearHeight(nearMap, ray.x + ray.dx * step.z, ray.y + ray.dy * step.z, &texel);
		const int y = static_cast<int>((ray.altitude - ground) * step.scale + ray.horizon);
		if (y >= bottom) continue;

		draw(y, texel, step);
		if (bottom == 0) return 0;
	}

	for (int level = 0; level < kMipLevels; ++level) {
		const Texel *map = world.mips[level].get();
		const int bits = kMapBits - level;
		const int mask = (1 << bits) - 1;

		for (const int end = steps.levelEnd[level]; i < end; ++i) {
			const Step &step = steps.at[i];
			const int mx = static_cast<int>(ray.x + ray.dx * step.z) >> level;
			const int my = static_cast<int>(ray.y + ray.dy * step.z) >> level;
			const Texel texel = map[((my & mask) << bits) | (mx & mask)];
			const float rise = ray.altitude - static_cast<float>(texelHeight(texel));
			const int y = static_cast<int>(rise * step.scale + ray.horizon);
			if (y >= bottom) continue;

			draw(y, texel, step);
			if (bottom == 0) return 0;
		}
	}
	return bottom;
}

// Sky above the terrain: the column's gradient, ordered-dithered (`ray`
// picks the horizontal phase), with the sun's glow where the sky shows.
void fillSky(const World &world, Pixel *column, int ray, int x, int rows, int horizonRow, int bucket, const Sun &sun)
{
	const int dx = x + kColumnStep / 2 - sun.x;
	const int dx2 = dx * dx;
	const bool glowing = sun.visible && dx2 < sun.radiusSquared;
	const std::uint8_t *glow = sun.glow;

	// Rows the glow can reach (a superset; each row still tests its distance).
	int litTop = rows;
	int litBottom = rows;
	if (glowing) {
		const int reach = static_cast<int>(std::sqrt(static_cast<float>(sun.radiusSquared - dx2))) + 1;
		litTop = std::clamp(sun.y - reach, 0, rows);
		litBottom = std::clamp(sun.y + reach + 1, litTop, rows);
	}

	// Unlit rows. Above the last gradient row the sky is one dithered colour
	// pair, so those rows skip the row lookup and the conversion.
	const auto plain = [&](int y, int end) {
		const int flatEnd = std::min(end, horizonRow - (kHazeRows + kUpperSkyRows - 1) + 1);
		if (y < flatEnd) {
			const std::uint16_t *top = world.upperSky[kUpperSkyRows - 1];
			const Pixel even = toPixel(top[skyDither(ray, 0)]);
			const Pixel odd = toPixel(top[skyDither(ray, 1)]);
			for (; y < flatEnd; ++y) column[y] = (y & 1) ? odd : even;
		}
		for (; y < end; ++y) column[y] = toPixel(skyRow(world, bucket, horizonRow - y)[skyDither(ray, y)]);
	};

	plain(0, litTop);
	for (int y = litTop; y < litBottom; ++y) {
		const std::uint16_t sky = skyRow(world, bucket, horizonRow - y)[skyDither(ray, y)];
		const int d2 = dx2 + (y - sun.y) * (y - sun.y);
		column[y] = toPixel(d2 < sun.radiusSquared ? blend565(sky, world.sunColour, glow[(d2 * sun.glowScale) >> 16]) : sky);
	}
	plain(litBottom, rows);
}

// Copies a strip's columns into the surface row by row, each ray kColumnStep
// pixels wide (sequential writes, whole cache lines), and blends the HUD
// overlays into each row while it is still in cache.
void flushStrip(const Strip &strip, const Overlays &overlays, Pixel *out, int stride, int height, int left, int rays)
{
	const Panel *picked[Overlays::kCapacity];
	const int overlayCount = overlays.pick(left, left + rays * kColumnStep, picked);

	int y = 0;
#if defined(__ARM_NEON)
	// One pixel per ray: transpose 4x4 tiles (four rays by four rows) in
	// registers, so each load and store moves four pixels.
	if constexpr (kColumnStep == 1 && sizeof(Pixel) == 4) {
		for (; y + 4 <= height; y += 4) {
			auto *row0 = reinterpret_cast<std::uint32_t *>(out + y * stride + left);
			auto *row1 = row0 + stride;
			auto *row2 = row1 + stride;
			auto *row3 = row2 + stride;
			int r = 0;
			for (; r + 4 <= rays; r += 4) {
				const uint32x4_t a = vld1q_u32(reinterpret_cast<const std::uint32_t *>(&strip[r][y]));
				const uint32x4_t b = vld1q_u32(reinterpret_cast<const std::uint32_t *>(&strip[r + 1][y]));
				const uint32x4_t c = vld1q_u32(reinterpret_cast<const std::uint32_t *>(&strip[r + 2][y]));
				const uint32x4_t d = vld1q_u32(reinterpret_cast<const std::uint32_t *>(&strip[r + 3][y]));
				const uint32x4x2_t ab = vtrnq_u32(a, b);
				const uint32x4x2_t cd = vtrnq_u32(c, d);
				vst1q_u32(row0 + r, vcombine_u32(vget_low_u32(ab.val[0]), vget_low_u32(cd.val[0])));
				vst1q_u32(row1 + r, vcombine_u32(vget_low_u32(ab.val[1]), vget_low_u32(cd.val[1])));
				vst1q_u32(row2 + r, vcombine_u32(vget_high_u32(ab.val[0]), vget_high_u32(cd.val[0])));
				vst1q_u32(row3 + r, vcombine_u32(vget_high_u32(ab.val[1]), vget_high_u32(cd.val[1])));
			}
			for (; r < rays; ++r) {
				row0[r] = strip[r][y];
				row1[r] = strip[r][y + 1];
				row2[r] = strip[r][y + 2];
				row3[r] = strip[r][y + 3];
			}
			for (int k = 0; k < 4; ++k) {
				for (int i = 0; i < overlayCount; ++i)
					blendPanelRow(out + (y + k) * stride, y + k, left, left + rays * kColumnStep, *picked[i]);
			}
		}
	}
#endif
	for (; y < height; ++y) {
		Pixel *row = out + y * stride;
		Pixel *p = row + left;
		for (int r = 0; r < rays; ++r) {
			const Pixel colour = strip[r][y];
			if constexpr (kColumnStep == 2 && sizeof(Pixel) == 2) {
				const std::uint32_t pair = colour | (static_cast<std::uint32_t>(colour) << 16);
				std::memcpy(p, &pair, sizeof pair);
				p += 2;
			} else {
				for (int i = 0; i < kColumnStep; ++i) *p++ = colour;
			}
		}

		for (int i = 0; i < overlayCount; ++i) blendPanelRow(row, y, left, left + rays * kColumnStep, *picked[i]);
	}
}

}  // namespace

void renderFrame(const World &world, const Camera &camera, const Overlays &overlays, Pixel *out, int width, int height)
{
	if (!world.skyReady || width > kMaxWidth || height > kMaxHeight || width % kColumnStep != 0) return;

	const float halfWidth = 0.5f * static_cast<float>(width);
	const float focal = halfWidth / std::tan(0.5f * kFieldOfView);
	const float *angles = columnAngles(width, focal);
	buildSteps(gSteps, focal, camera.visibility);

	const float forwardX = std::sin(camera.heading);
	const float forwardY = -std::cos(camera.heading);
	const float tanBank = std::tan(camera.bank);
	const Sun sun = placeSun(world, camera, focal, tanBank, width, height);
	const float originX = std::fmod(camera.x, static_cast<float>(kMapSize)) + kWrapOffset;
	const float originY = std::fmod(camera.y, static_cast<float>(kMapSize)) + kWrapOffset;
	const int stripWidth = kStripRays * kColumnStep;

	// One strip: its rays into `strip`, then out to the frame. Strips share
	// only read-only state (the tables above are built before any strip runs).
	const auto renderStrip = [&](int left, Strip &strip) {
		const int rays = (width - left < stripWidth ? width - left : stripWidth) / kColumnStep;
		for (int r = 0; r < rays; ++r) {
			const int x = left + r * kColumnStep;
			const int ray = x / kColumnStep;
			const float offset = static_cast<float>(x) + 0.5f * kColumnStep - halfWidth;
			const float u = offset / focal;
			const float toSun = std::fabs(wrapAngle(camera.heading + angles[x] - world.sunAzimuth));
			const int bucket = static_cast<int>(toSun * (kSunBuckets - 1) / kPi + kColumnDither[ray & 3]);
			const float horizon = camera.horizon + offset * tanBank;
			const std::uint16_t fog = world.hazeSky[bucket][0][ray & 3];

			// Right is (-forwardY, forwardX); rays spread across a flat image plane.
			const ColumnRay column{originX, originY, forwardX - forwardY * u, forwardY + forwardX * u, camera.altitude, horizon, fog};
			const int top = !world.ready ? height
			                : kSmoothDistance > 0.0f ? marchColumn(world, gSteps, column, strip[r], height)
			                                         : walkColumn(world, gSteps, column, strip[r], height);
			fillSky(world, strip[r], ray, x, top, static_cast<int>(std::floor(horizon)), bucket, sun);
		}
		flushStrip(strip, overlays, out, width, height, left, rays);
	};

#ifdef __APPLE__
	// Apple hosts render a 4K frame: spread the strips over every core, each
	// worker with its own strip buffer, taking the next strip as it finishes
	// one (terrain cost varies a lot across the frame).
	static const int workers = [] {
		const long cores = sysconf(_SC_NPROCESSORS_ONLN);
		return cores > 1 ? static_cast<int>(cores) : 1;
	}();
	static std::unique_ptr<Strip[]> strips(new Strip[workers]);
	const int stripCount = (width + stripWidth - 1) / stripWidth;
	std::atomic<int> nextStrip{0};
	std::atomic<int> *next = &nextStrip;
	Strip *buffers = strips.get();
	dispatch_apply(static_cast<size_t>(workers), dispatch_get_global_queue(QOS_CLASS_USER_INTERACTIVE, 0), ^(size_t worker) {
		for (int i = next->fetch_add(1); i < stripCount; i = next->fetch_add(1)) renderStrip(i * stripWidth, buffers[worker]);
	});
#else
	for (int left = 0; left < width; left += stripWidth) renderStrip(left, gStrip);
#endif
}

}  // namespace terra

