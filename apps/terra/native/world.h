#pragma once

#include <cstdint>
#include <memory>

// Internal types shared by the terrain baker and the voxel renderer.
namespace terra {

constexpr int kMapBits = 9;
constexpr int kMapSize = 1 << kMapBits;
constexpr int kMapMask = kMapSize - 1;
constexpr int kMapArea = kMapSize * kMapSize;
constexpr int kMipLevels = 4;

// The bake shapes the land on a coarser field and paints the map from it
// with interpolation: a quarter of the memory traffic, same world size.
constexpr int kFieldBits = 8;
constexpr int kFieldSize = 1 << kFieldBits;
constexpr int kFieldMask = kFieldSize - 1;
constexpr int kFieldArea = kFieldSize * kFieldSize;
constexpr float kFieldTexel = static_cast<float>(kMapSize / kFieldSize);  // map texels per field texel

// Sky gradients, indexed by rows above the horizon, with a 2x2 ordered-dither
// variant per row (RGB565 bands otherwise). The rows near the horizon carry
// the sun haze and differ per sun-angle bucket; the rows above are shared.
constexpr int kSunBuckets = 32;
constexpr int kHazeRows = 128;
constexpr int kUpperSkyRows = 256;
constexpr int kSkyDither = 4;
constexpr float kSkyDitherThresholds[kSkyDither] = {0.125f, 0.625f, 0.875f, 0.375f};

// The dither variant for a pixel.
inline int skyDither(int x, int y) { return ((y & 1) << 1) | (x & 1); }

constexpr float kPi = 3.14159265f;
constexpr float kDegrees = kPi / 180.0f;

// A map texel packs everything one ray sample needs into one load:
// RGB565 colour (bits 0-15), height (16-23), water flag (24).
using Texel = std::uint32_t;
constexpr Texel kWaterFlag = 1u << 24;

inline int texelHeight(Texel texel) { return static_cast<int>((texel >> 16) & 0xFFu); }
inline std::uint16_t texelColour(Texel texel) { return static_cast<std::uint16_t>(texel); }

// A colour in 0..255 channels (materials, skies) or a light multiplier.
struct Rgb {
	float r;
	float g;
	float b;
};

inline float clamp01(float v) { return v < 0.0f ? 0.0f : (v > 1.0f ? 1.0f : v); }

inline float smoothstep(float edge0, float edge1, float x)
{
	// A reciprocal, so constant edges fold into a multiply (the bake calls
	// this millions of times).
	const float t = clamp01((x - edge0) * (1.0f / (edge1 - edge0)));
	return t * t * (3.0f - 2.0f * t);
}

// Transcendentals without libm: newlib's expf/sinf/powf work in double
// precision, which this single-precision FPU emulates in software (thousands
// of cycles a call). These are for per-texel loops.

// e^-x for x >= 0: the reciprocal of e^x's series to x^4 (within a few %).
inline float expNeg(float x)
{
	return 1.0f / (1.0f + x * (1.0f + x * (0.5f + x * (1.0f / 6.0f + x * (1.0f / 24.0f)))));
}

// sin(2 pi turns) for turns > -16, from a table.
float sinTurns(float turns);

inline Rgb mix(Rgb a, Rgb b, float t)
{
	return {a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t};
}

inline Rgb operator*(Rgb a, Rgb b) { return {a.r * b.r, a.g * b.g, a.b * b.b}; }
inline Rgb operator*(Rgb a, float s) { return {a.r * s, a.g * s, a.b * s}; }
inline Rgb operator+(Rgb a, Rgb b) { return {a.r + b.r, a.g + b.g, a.b + b.b}; }

// Packs to RGB565; `dither` in 0..1 is the ordered-dither threshold.
inline std::uint16_t pack565(Rgb c, float dither)
{
	const auto channel = [dither](float v, int levels) {
		const int q = static_cast<int>(v * (static_cast<float>(levels) * (1.0f / 255.0f)) + dither);
		return q < 0 ? 0 : (q > levels ? levels : q);
	};
	return static_cast<std::uint16_t>((channel(c.r, 31) << 11) | (channel(c.g, 63) << 5) | channel(c.b, 31));
}

// Blends two RGB565 colours; alpha 0..32 is the weight of `to`.
inline std::uint16_t blend565(std::uint16_t from, std::uint16_t to, int alpha)
{
	const std::uint32_t a = (from | (static_cast<std::uint32_t>(from) << 16)) & 0x07E0F81Fu;
	const std::uint32_t b = (to | (static_cast<std::uint32_t>(to) << 16)) & 0x07E0F81Fu;
	const std::uint32_t mixed = ((a * static_cast<std::uint32_t>(32 - alpha) + b * static_cast<std::uint32_t>(alpha)) >> 5) & 0x07E0F81Fu;
	return static_cast<std::uint16_t>(mixed | (mixed >> 16));
}

// What a material sees of one texel.
struct Ground {
	float height;  // height units (0..255)
	float slope;   // height units per texel
	float detail;  // mid-frequency noise, 0..1
	float grain;   // per-texel noise, -1..1
	bool water;
};

// One place's recipe: height shaping, materials, light and sky.
struct Landscape {
	std::uint32_t seed;
	int baseStep;        // diamond-square seed grid spacing (feature size), field texels
	float roughness;     // amplitude kept per octave
	int smoothing;       // 1-2-1 blur passes on the base noise
	// Turns one row of normalised base noise (0..1) into height units in place.
	void (*shape)(float *row, const float *detail, int y);
	// Optional features stamped over the whole field afterwards (craters).
	int features;
	void (*feature)(float *height, std::uint32_t seed, int index);
	float waterLevel;    // height units; 0 for none
	Rgb (*material)(const Ground &ground);
	// The shadow sweep needs the sun within 45 degrees of east or west.
	float sunAzimuth;    // degrees clockwise from north
	float sunElevation;  // degrees
	Rgb sunLight;
	Rgb ambientLight;
	Rgb zenith;
	Rgb midSky;
	Rgb horizon;
	Rgb haze;      // horizon glow toward the sun
	Rgb sunDisc;
	Rgb waterSky;  // what water reflects at grazing angles
};

constexpr int kLandscapeCount = 4;
const Landscape &landscape(int index);

// The baked, renderable world. The maps live on the (SDRAM) heap; the sky,
// read for every sky pixel, lives in the World itself: keep the World static
// so it lands in internal SRAM (~34 KB).
struct World {
	std::unique_ptr<Texel[]> mips[kMipLevels];
	std::uint16_t hazeSky[kSunBuckets][kHazeRows][kSkyDither];
	std::uint16_t upperSky[kUpperSkyRows][kSkyDither];
	std::uint16_t sunColour = 0;
	std::uint16_t waterSky = 0;
	float sunAzimuth = 0.0f;  // radians
	float sunElevation = 0.0f;
	float spawnX = 0.0f;
	float spawnY = 0.0f;
	bool skyReady = false;  // the sky can be drawn (the terrain may still be baking)
	bool ready = false;     // the terrain can be drawn
};

// The dither variants of one sky row; row 0 is the fog colour.
inline const std::uint16_t *skyRow(const World &world, int bucket, int rowsAboveHorizon)
{
	if (rowsAboveHorizon < kHazeRows) return world.hazeSky[bucket][rowsAboveHorizon < 0 ? 0 : rowsAboveHorizon];

	const int upper = rowsAboveHorizon - kHazeRows;
	return world.upperSky[upper < kUpperSkyRows ? upper : kUpperSkyRows - 1];
}

}  // namespace terra
