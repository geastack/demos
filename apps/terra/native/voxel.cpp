#include "voxel.h"

#include "chrome.h"

#include <cmath>
#include <cstring>

// Hot scratch buffers go in DTCM on the STM32 board: 0-wait, and outside the
// 16 KB D-cache, so they never evict map lines. (STM32-only: the ESP32 chips
// have no DTCM, their scratch lives in internal RAM, which is already
// uncontended by the PSRAM-resident maps.) The frame limits follow: the F746
// build keeps its 480 x 272 strip so its DTCM budget is unchanged; everything
// else takes up to 512 x 512.
#if defined(__arm__)
#define TERRA_TCM __attribute__((section(".dtcm")))
#define TERRA_MAX_WIDTH 480
#define TERRA_MAX_HEIGHT 272
#else
#define TERRA_TCM
#define TERRA_MAX_WIDTH 512
#define TERRA_MAX_HEIGHT 512
#endif

namespace terra {

namespace {

using gea::framework::graphics::pixel::fromRgb565;
using gea::framework::graphics::pixel::toNative;

// ---- Quality and cost knobs ----
constexpr float kFieldOfView = 70.0f * kDegrees;  // horizontal
constexpr float kDrawDistance = 400.0f;           // texels
constexpr float kNearStep = 1.0f;                 // ray step near the camera, texels
constexpr float kStepGrowth = 0.035f;             // step = max(kNearStep, distance * kStepGrowth)
constexpr int kColumnStep = 2;                    // px per ray; 1 doubles the ray work for full detail
constexpr float kMipStep = 2.0f;                  // ray step (texels) that moves sampling to mip 1, then doubling
constexpr float kFogStart = 0.3f;                 // share of the visible distance before fog begins
constexpr float kWaterFresnelDistance = 200.0f;   // texels until water mirrors the sky most
constexpr float kSmoothDistance = 0.0f;           // texels of interpolated heights near the camera (0: off)
constexpr float kSunGlowRadius = 90.0f;           // px at kSunReferenceWidth
constexpr float kSunDiscRadius = 7.0f;            // px at kSunReferenceWidth
constexpr float kSunReferenceWidth = 480.0f;      // the sun scales with the frame's width

constexpr int kMaxSteps = 320;
constexpr int kMaxWidth = TERRA_MAX_WIDTH;
constexpr int kMaxHeight = TERRA_MAX_HEIGHT;
// Rays render into a column-major strip in DTCM, flushed row by row into the
// (row-major, SDRAM) surface: columns straight into SDRAM cost a cache line
// per pixel.
constexpr int kStripRays = 16;
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

struct Steps {
	Step at[kMaxSteps];
	int smoothEnd;             // steps [0, smoothEnd) interpolate heights
	int levelEnd[kMipLevels];  // then steps up to levelEnd[L] sample mip L
};

TERRA_TCM Steps gSteps;
TERRA_TCM Pixel gStrip[kStripRays][kMaxHeight];

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
	const int ix = static_cast<int>(x);
	const int iy = static_cast<int>(y);
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

	for (int y = 0; y < rows; ++y) {
		const std::uint16_t sky = skyRow(world, bucket, horizonRow - y)[skyDither(ray, y)];
		const int d2 = dx2 + (y - sun.y) * (y - sun.y);
		const bool lit = glowing && d2 < sun.radiusSquared;
		column[y] = toPixel(lit ? blend565(sky, world.sunColour, glow[(d2 * sun.glowScale) >> 16]) : sky);
	}
}

// Copies a strip's columns into the surface row by row, each ray kColumnStep
// pixels wide (sequential writes, whole cache lines), and blends the HUD
// overlays into each row while it is still in cache.
void flushStrip(const Overlays &overlays, Pixel *out, int stride, int height, int left, int rays)
{
	const Panel *picked[Overlays::kCapacity];
	const int overlayCount = overlays.pick(left, left + rays * kColumnStep, picked);

	for (int y = 0; y < height; ++y) {
		Pixel *row = out + y * stride;
		Pixel *p = row + left;
		for (int r = 0; r < rays; ++r) {
			const Pixel colour = gStrip[r][y];
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

	for (int left = 0; left < width; left += stripWidth) {
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
			const int top = world.ready ? marchColumn(world, gSteps, column, gStrip[r], height) : height;
			fillSky(world, gStrip[r], ray, x, top, static_cast<int>(std::floor(horizon)), bucket, sun);
		}
		flushStrip(overlays, out, width, height, left, rays);
	}
}

}  // namespace terra
