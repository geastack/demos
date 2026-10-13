#pragma once

#include "noise.h"
#include "world.h"

#include <memory>

// Bakes a landscape into render-ready maps: fractal heights shaped per place
// on a kFieldSize field, lit by a low sun with cast shadows, then painted
// into the kMapSize map with interpolation; a mip chain for distant samples,
// and the sky gradients the fog blends into.
//
// The work is sliced (at most a field row or column, or a map row, at a
// time) so frames keep flowing while it runs: begin() builds the sky at
// once, advance() works through the terrain until its time budget is spent.
namespace terra {

class Baker {
public:
	// False when memory runs out.
	bool begin(World &world, const Landscape &land);

	// True once the terrain is ready to draw.
	bool advance(World &world, float budgetMs);

private:
	enum class Phase { BaseNoise, BaseBlur, DetailNoise, Shape, Features, Flood, Shadows, Paint, Mips, Done };

	void step(World &world);
	void shapeRow();
	void floodRow();
	void shadowColumn();
	void paintRow(World &world);
	void mipRow(World &world);
	void finish(World &world);

	const Landscape *land_ = nullptr;
	std::unique_ptr<float[]> height_;  // fields, kFieldArea each
	std::unique_ptr<float[]> detail_;
	std::unique_ptr<float[]> shadow_;
	float rays_[2][kFieldSize];         // light rays of the last two swept columns
	noise::DiamondSquare noise_;
	noise::Blur blur_;
	noise::Range baseRange_;
	noise::Range detailRange_;
	Phase phase_ = Phase::Done;
	int row_ = 0;
	int pass_ = 0;
	int level_ = 0;

	// Light: sun direction, and the shadow sweep across columns.
	float sunX_ = 0.0f;
	float sunY_ = 0.0f;
	float sunZ_ = 0.0f;
	int sweepStep_ = 1;
	float rowsPerColumn_ = 0.0f;
	float dropPerColumn_ = 0.0f;
	int sweepX_ = 0;
};

}  // namespace terra
