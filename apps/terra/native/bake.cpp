#include "bake.h"

#include <chrono>
#include <cmath>
#include <new>
#include <utility>

namespace terra {

namespace {

using Clock = std::chrono::steady_clock;

constexpr int kDetailStep = 16;  // field texels
constexpr float kDetailRoughness = 0.6f;
constexpr float kShadowSoftness = 4.0f;  // height units over which a shadow edge fades
constexpr float kSkyGradientRows = 300.0f;
constexpr float kMidSkyAt = 0.22f;       // share of the gradient from horizon to mid sky
constexpr float kHazeFalloff = 60.0f;    // rows over which the sun haze fades up the sky

// 4x4 Bayer thresholds: the baked colours are dithered down to RGB565.
constexpr float kBayer[16] = {0.03f, 0.53f, 0.16f, 0.66f, 0.78f, 0.28f, 0.91f, 0.41f,
                              0.22f, 0.72f, 0.09f, 0.59f, 0.97f, 0.47f, 0.84f, 0.34f};

std::unique_ptr<float[]> allocateField() { return std::unique_ptr<float[]>(new (std::nothrow) float[kFieldArea]); }

// A field value between texels (bilinear, wrapping); `u`, `v` in field texels.
float sample(const float *field, float u, float v)
{
	const float fu = u + kFieldSize;  // positive, so truncation floors
	const float fv = v + kFieldSize;
	const int x = static_cast<int>(fu);
	const int y = static_cast<int>(fv);
	const float tx = fu - static_cast<float>(x);
	const float ty = fv - static_cast<float>(y);
	const float *top = field + noise::index(0, y);
	const float *bottom = field + noise::index(0, y + 1);
	const int left = x & kFieldMask;
	const int right = (x + 1) & kFieldMask;
	const float upper = top[left] + (top[right] - top[left]) * tx;
	const float lower = bottom[left] + (bottom[right] - bottom[left]) * tx;
	return upper + (lower - upper) * ty;
}

bool allocateMaps(World &world)
{
	for (int level = 0; level < kMipLevels; ++level) {
		const int size = kMapSize >> level;
		if (!world.mips[level]) world.mips[level].reset(new (std::nothrow) Texel[static_cast<std::size_t>(size * size)]);
		if (!world.mips[level]) return false;
	}
	return true;
}

Rgb skyGradient(const Landscape &land, int row)
{
	const float t = static_cast<float>(row) / kSkyGradientRows;
	return t < kMidSkyAt ? mix(land.horizon, land.midSky, smoothstep(0.0f, kMidSkyAt, t))
	                     : mix(land.midSky, land.zenith, smoothstep(kMidSkyAt, 1.0f, t));
}

void packSky(std::uint16_t *variants, Rgb colour)
{
	for (int variant = 0; variant < kSkyDither; ++variant) variants[variant] = pack565(colour, kSkyDitherThresholds[variant]);
}

// Horizon to mid sky to zenith, plus a haze that warms the horizon toward
// the sun (one gradient per sun bucket) and has faded out by kHazeRows.
void buildSky(World &world, const Landscape &land)
{
	for (int bucket = 0; bucket < kSunBuckets; ++bucket) {
		const float angle = kPi * static_cast<float>(bucket) / static_cast<float>(kSunBuckets - 1);
		const float toward = 0.5f + 0.5f * std::cos(angle);
		const float strength = toward * toward * toward * toward;

		for (int row = 0; row < kHazeRows; ++row) {
			const float fade = 1.0f - smoothstep(0.5f * kHazeRows, static_cast<float>(kHazeRows), static_cast<float>(row));
			const float haze = strength * expNeg(static_cast<float>(row) / kHazeFalloff) * fade;
			packSky(world.hazeSky[bucket][row], mix(skyGradient(land, row), land.haze, haze));
		}
	}

	for (int row = 0; row < kUpperSkyRows; ++row) packSky(world.upperSky[row], skyGradient(land, kHazeRows + row));

	world.sunColour = pack565(land.sunDisc, 0.5f);
	world.waterSky = pack565(land.waterSky, 0.5f);
	world.sunAzimuth = land.sunAzimuth * kDegrees;
	world.sunElevation = land.sunElevation * kDegrees;
}

// Each mip texel averages 2x2 texels of the level above: colour, height and
// water. Builds one row of `level`.
void buildMipRow(World &world, int level, int y)
{
	const int size = kMapSize >> level;
	const int sourceSize = size * 2;
	const Texel *source = world.mips[level - 1].get() + (y * 2) * sourceSize;
	Texel *target = world.mips[level].get() + y * size;

	for (int x = 0; x < size; ++x) {
		const Texel *pair = source + x * 2;
		const Texel quad[4] = {pair[0], pair[1], pair[sourceSize], pair[sourceSize + 1]};
		std::uint32_t r = 0, g = 0, b = 0, h = 0, water = 0;
		for (const Texel t : quad) {
			r += (t >> 11) & 0x1Fu;
			g += (t >> 5) & 0x3Fu;
			b += t & 0x1Fu;
			h += (t >> 16) & 0xFFu;
			water += (t & kWaterFlag) ? 1u : 0u;
		}
		const std::uint32_t colour = (((r + 2) >> 2) << 11) | (((g + 2) >> 2) << 5) | ((b + 2) >> 2);
		target[x] = colour | (((h + 2) >> 2) << 16) | (water >= 2 ? kWaterFlag : 0u);
	}
}

// The camera starts in the lowest valley and rises out of it.
void findSpawn(World &world)
{
	const int level = kMipLevels - 1;
	const int size = kMapSize >> level;
	const Texel *map = world.mips[level].get();
	int lowest = 0;
	for (int i = 1; i < size * size; ++i) {
		if (texelHeight(map[i]) < texelHeight(map[lowest])) lowest = i;
	}

	const float cell = static_cast<float>(1 << level);
	world.spawnX = (static_cast<float>(lowest % size) + 0.5f) * cell;
	world.spawnY = (static_cast<float>(lowest / size) + 0.5f) * cell;
}

}  // namespace

bool Baker::begin(World &world, const Landscape &land)
{
	world.ready = false;
	world.skyReady = false;
	phase_ = Phase::Done;
	if (!allocateMaps(world)) return false;

	height_ = allocateField();
	detail_ = allocateField();
	shadow_ = allocateField();
	if (!height_ || !detail_ || !shadow_) return false;

	land_ = &land;
	buildSky(world, land);
	world.skyReady = true;

	const float azimuth = land.sunAzimuth * kDegrees;
	const float elevation = land.sunElevation * kDegrees;
	sunX_ = std::sin(azimuth) * std::cos(elevation);
	sunY_ = -std::cos(azimuth) * std::cos(elevation);
	sunZ_ = std::sin(elevation);

	// Shadows sweep columns away from the sun (within 45 degrees of east or
	// west), carrying the lowest unblocked light ray per row.
	const float travelX = -std::sin(azimuth);
	sweepStep_ = travelX > 0.0f ? 1 : -1;
	rowsPerColumn_ = std::cos(azimuth) / std::fabs(travelX);
	dropPerColumn_ = std::tan(elevation) * kFieldTexel * std::sqrt(1.0f + rowsPerColumn_ * rowsPerColumn_);

	noise_.start(height_.get(), land.seed, land.baseStep, land.roughness);
	phase_ = Phase::BaseNoise;
	row_ = 0;
	return true;
}

bool Baker::advance(World &world, float budgetMs)
{
	const auto deadline = Clock::now() + std::chrono::microseconds(static_cast<int>(budgetMs * 1000.0f));
	while (phase_ != Phase::Done && Clock::now() < deadline) step(world);
	return world.ready;
}

void Baker::step(World &world)
{
	switch (phase_) {
	case Phase::BaseNoise:
		if (!noise_.done()) {
			noise_.advance();
			return;
		}
		baseRange_ = noise_.range();
		phase_ = Phase::BaseBlur;
		pass_ = 0;
		if (land_->smoothing > 0) blur_.start(height_.get());
		return;

	// Each pass records the range the shape step normalises by.
	case Phase::BaseBlur:
		if (pass_ < land_->smoothing && !blur_.done()) {
			blur_.advance();
			return;
		}
		if (++pass_ < land_->smoothing) {
			blur_.start(height_.get());
			return;
		}
		if (land_->smoothing > 0) baseRange_ = blur_.range();
		noise_.start(detail_.get(), land_->seed * 7919u + 17u, kDetailStep, kDetailRoughness);
		phase_ = Phase::DetailNoise;
		return;

	case Phase::DetailNoise:
		if (!noise_.done()) {
			noise_.advance();
			return;
		}
		detailRange_ = noise_.range();
		phase_ = Phase::Shape;
		row_ = 0;
		return;

	case Phase::Shape:
		shapeRow();
		return;

	case Phase::Features:
		if (row_ < land_->features) {
			land_->feature(height_.get(), land_->seed, row_++);
			return;
		}
		phase_ = Phase::Flood;
		row_ = 0;
		return;

	case Phase::Flood:
		floodRow();
		return;

	case Phase::Shadows:
		shadowColumn();
		return;

	case Phase::Paint:
		paintRow(world);
		return;

	case Phase::Mips:
		mipRow(world);
		return;

	case Phase::Done:
		return;
	}
}

void Baker::shapeRow()
{
	float *heights = height_.get() + noise::index(0, row_);
	float *details = detail_.get() + noise::index(0, row_);
	for (int x = 0; x < kFieldSize; ++x) {
		heights[x] = baseRange_.normalise(heights[x]);
		details[x] = detailRange_.normalise(details[x]);
	}
	land_->shape(heights, details, row_);

	if (++row_ < kFieldSize) return;

	phase_ = Phase::Features;
	row_ = 0;
}

void Baker::floodRow()
{
	const float level = land_->waterLevel;
	float *heights = height_.get() + noise::index(0, row_);
	for (int x = 0; x < kFieldSize && level > 0.0f; ++x) {
		if (heights[x] < level) heights[x] = level;
	}

	if (++row_ < kFieldSize) return;

	for (float *ray = rays_[0]; ray < rays_[0] + 2 * kFieldSize; ++ray) *ray = 0.0f;
	phase_ = Phase::Shadows;
	row_ = 0;
	sweepX_ = 0;
}

// One field column of the sweep. The torus has no edge to start from, so the
// first lap only settles the rays; the second records shadows.
void Baker::shadowColumn()
{
	const float *ray = rays_[row_ & 1];
	float *nextRay = rays_[(row_ + 1) & 1];
	const bool record = row_ >= kFieldSize;

	// Row y takes its light from row y - rowsPerColumn_ of the previous column.
	const float offset = std::floor(-rowsPerColumn_);
	const int shift = static_cast<int>(offset);
	const float fraction = -rowsPerColumn_ - offset;

	for (int y = 0; y < kFieldSize; ++y) {
		const float below = ray[(y + shift) & kFieldMask];
		const float light = below + (ray[(y + shift + 1) & kFieldMask] - below) * fraction - dropPerColumn_;
		const float ground = height_[noise::index(sweepX_, y)];
		if (record) shadow_[noise::index(sweepX_, y)] = clamp01((light - ground) * (1.0f / kShadowSoftness));
		nextRay[y] = light > ground ? light : ground;
	}

	sweepX_ = (sweepX_ + sweepStep_) & kFieldMask;
	if (++row_ < 2 * kFieldSize) return;

	phase_ = Phase::Paint;
	row_ = 0;
}

// One map row: heights, slope, detail and shadow interpolated from the
// field, lit and coloured per texel.
void Baker::paintRow(World &world)
{
	const Landscape &land = *land_;
	const float *height = height_.get();
	const float *detail = detail_.get();
	const float *shadow = shadow_.get();
	constexpr float kStep = 1.0f / kFieldTexel;  // one map texel, in field texels
	const int y = row_;
	const float v = (static_cast<float>(y) + 0.5f) * kStep - 0.5f;
	Texel *map = world.mips[0].get() + y * kMapSize;

	for (int x = 0; x < kMapSize; ++x) {
		const float u = (static_cast<float>(x) + 0.5f) * kStep - 0.5f;
		const float h = sample(height, u, v);
		const float gx = (sample(height, u + kStep, v) - sample(height, u - kStep, v)) * 0.5f;
		const float gy = (sample(height, u, v + kStep) - sample(height, u, v - kStep)) * 0.5f;
		const float slope = std::sqrt(gx * gx + gy * gy);
		const bool water = land.waterLevel > 0.0f && h <= land.waterLevel;

		const float facing = (-gx * sunX_ - gy * sunY_ + sunZ_) / std::sqrt(slope * slope + 1.0f);
		const float direct = (facing > 0.0f ? facing : 0.0f) * (1.0f - sample(shadow, u, v));
		const Rgb light = land.ambientLight + land.sunLight * direct;

		const Ground ground{h, slope, sample(detail, u, v), noise::grain(x, y, land.seed), water};
		const Rgb colour = land.material(ground) * light;
		const int quantised = static_cast<int>(h + 0.5f);
		const auto texelHeight = static_cast<Texel>(quantised < 0 ? 0 : (quantised > 255 ? 255 : quantised));
		map[x] = pack565(colour, kBayer[((y & 3) << 2) | (x & 3)]) | (texelHeight << 16) | (water ? kWaterFlag : 0u);
	}

	if (++row_ < kMapSize) return;

	phase_ = Phase::Mips;
	level_ = 1;
	row_ = 0;
}

void Baker::mipRow(World &world)
{
	buildMipRow(world, level_, row_);
	if (++row_ < (kMapSize >> level_)) return;

	row_ = 0;
	if (++level_ == kMipLevels) finish(world);
}

void Baker::finish(World &world)
{
	findSpawn(world);
	height_.reset();
	detail_.reset();
	shadow_.reset();
	phase_ = Phase::Done;
	world.ready = true;
}

}  // namespace terra
