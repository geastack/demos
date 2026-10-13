#pragma once

#include "world.h"

#include <cstdint>

// Tileable noise fields on the kFieldSize x kFieldSize torus (the world
// wraps), built a row at a time so a bake can be spread across frames.
namespace terra::noise {

// xorshift32: small, fast and repeatable per seed.
class Rng {
public:
	explicit Rng(std::uint32_t seed = 1) : state_(seed ? seed : 1u) {}

	std::uint32_t next()
	{
		state_ ^= state_ << 13;
		state_ ^= state_ >> 17;
		state_ ^= state_ << 5;
		return state_;
	}

	float unit() { return static_cast<float>(next() >> 8) * (1.0f / 16777216.0f); }
	float signedUnit() { return unit() * 2.0f - 1.0f; }

private:
	std::uint32_t state_;
};

inline int index(int x, int y) { return ((y & kFieldMask) << kFieldBits) | (x & kFieldMask); }

// The lowest and highest value seen, for normalising a field later.
struct Range {
	float low = 1e30f;
	float high = -1e30f;

	void add(float v)
	{
		low = v < low ? v : low;
		high = v > high ? v : high;
	}

	float normalise(float v) const { return high > low ? (v - low) / (high - low) : 0.0f; }
};

// Diamond-square fractal noise, one row of one pass per advance(). `step` is
// the spacing of the random seed grid (a power of two up to kFieldSize),
// `roughness` the amplitude kept per halving. Values are left raw; `range()`
// says how to normalise them.
class DiamondSquare {
public:
	void start(float *field, std::uint32_t seed, int step, float roughness);
	bool done() const { return step_ <= 1; }
	void advance();
	const Range &range() const { return range_; }

private:
	float *field_ = nullptr;
	Rng rng_;
	Range range_;
	int step_ = 0;
	int row_ = 0;
	bool square_ = false;
	float amplitude_ = 0.0f;
	float roughness_ = 0.0f;
};

// An in-place 1-2-1 blur, one output row per advance(). The rows still
// needed (blurred across, around the output row) live in a small ring, so
// the field is never copied.
class Blur {
public:
	void start(float *field);
	bool done() const { return row_ >= kFieldSize; }
	void advance();
	const Range &range() const { return range_; }

private:
	void blurAcross(int y, float *out) const;

	float *field_ = nullptr;
	Range range_;
	int row_ = 0;
	float ring_[3][kFieldSize];  // rows y - 1, y, y + 1, by (y + k) % 3
	float firstRow_[kFieldSize];  // row 0 across, needed again by the last row
};

// Per-texel hash noise in -1..1.
float grain(int x, int y, std::uint32_t seed);

}  // namespace terra::noise
