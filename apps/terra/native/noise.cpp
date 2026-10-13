#include "noise.h"

#include <cmath>

namespace terra {

float sinTurns(float turns)
{
	constexpr int kSize = 256;
	static float table[kSize + 1];
	static bool built = false;
	if (!built) {
		for (int i = 0; i <= kSize; ++i) table[i] = std::sin(2.0f * kPi * static_cast<float>(i) / kSize);
		built = true;
	}

	const float u = (turns + 16.0f) * kSize;
	const int whole = static_cast<int>(u);
	const float fraction = u - static_cast<float>(whole);
	const int i = whole & (kSize - 1);
	return table[i] + (table[i + 1] - table[i]) * fraction;
}

}  // namespace terra

namespace terra::noise {

void DiamondSquare::start(float *field, std::uint32_t seed, int step, float roughness)
{
	field_ = field;
	rng_ = Rng(seed);
	range_ = Range{};
	step_ = step;
	row_ = 0;
	square_ = false;
	amplitude_ = roughness;
	roughness_ = roughness;

	for (int y = 0; y < kFieldSize; y += step) {
		for (int x = 0; x < kFieldSize; x += step) {
			const float value = rng_.signedUnit();
			field_[index(x, y)] = value;
			range_.add(value);
		}
	}
}

void DiamondSquare::advance()
{
	const int half = step_ / 2;

	// Diamond: each square's centre from its four corners.
	if (!square_) {
		const int y = half + row_ * step_;
		float *row = field_ + index(0, y);
		const float *above = field_ + index(0, y - half);
		const float *below = field_ + index(0, y + half);
		for (int x = half; x < kFieldSize; x += step_) {
			const int left = (x - half) & kFieldMask;
			const int right = (x + half) & kFieldMask;
			const float corners = above[left] + above[right] + below[left] + below[right];
			const float value = corners * 0.25f + amplitude_ * rng_.signedUnit();
			row[x] = value;
			range_.add(value);
		}
		++row_;
		if (half + row_ * step_ >= kFieldSize) {
			square_ = true;
			row_ = 0;
		}
		return;
	}

	// Square: each edge midpoint from its four diamond neighbours.
	const int y = row_ * half;
	float *row = field_ + index(0, y);
	const float *above = field_ + index(0, y - half);
	const float *below = field_ + index(0, y + half);
	for (int x = (y + half) % step_; x < kFieldSize; x += step_) {
		const float sides = row[(x - half) & kFieldMask] + row[(x + half) & kFieldMask] + above[x] + below[x];
		const float value = sides * 0.25f + amplitude_ * rng_.signedUnit();
		row[x] = value;
		range_.add(value);
	}
	++row_;
	if (row_ * half >= kFieldSize) {
		square_ = false;
		row_ = 0;
		step_ = half;
		amplitude_ *= roughness_;
	}
}

void Blur::start(float *field)
{
	field_ = field;
	range_ = Range{};
	row_ = 0;
	blurAcross(kFieldSize - 1, ring_[2]);  // row -1
	blurAcross(0, ring_[0]);
	for (int x = 0; x < kFieldSize; ++x) firstRow_[x] = ring_[0][x];
}

void Blur::advance()
{
	const int y = row_;
	const float *above = ring_[(y + 2) % 3];
	const float *centre = ring_[y % 3];
	float *below = ring_[(y + 1) % 3];

	// Row y + 1 is still untouched in the field (the last row wraps to row 0).
	if (y + 1 < kFieldSize) {
		blurAcross(y + 1, below);
	} else {
		for (int x = 0; x < kFieldSize; ++x) below[x] = firstRow_[x];
	}

	float *out = field_ + index(0, y);
	for (int x = 0; x < kFieldSize; ++x) {
		const float value = (above[x] + 2.0f * centre[x] + below[x]) * 0.25f;
		out[x] = value;
		range_.add(value);
	}
	++row_;
}

void Blur::blurAcross(int y, float *out) const
{
	const float *row = field_ + index(0, y);
	for (int x = 0; x < kFieldSize; ++x) {
		out[x] = (row[(x - 1) & kFieldMask] + 2.0f * row[x] + row[(x + 1) & kFieldMask]) * 0.25f;
	}
}

float grain(int x, int y, std::uint32_t seed)
{
	std::uint32_t h = static_cast<std::uint32_t>(x) * 374761393u + static_cast<std::uint32_t>(y) * 668265263u + seed;
	h = (h ^ (h >> 13)) * 1274126177u;
	h ^= h >> 16;
	return static_cast<float>(h & 0xFFFFu) * (2.0f / 65535.0f) - 1.0f;
}

}  // namespace terra::noise
