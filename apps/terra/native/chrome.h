#pragma once

#include "voxel.h"

// HUD primitives blended into the frame by the renderer as it writes each
// row out (the row is still in cache then): translucent rounded plates and
// the ticks of the heading tape. No UI node has to sit over the view.
namespace terra {

struct Panel {
	int x;
	int y;
	int width;
	int height;
	int radius;
	Pixel colour;
	int alpha;  // 0..255
};

struct Tape {
	int centerX;       // px where the heading sits
	int top;           // px of the ticks' top
	float heading;     // degrees
	float halfSpan;    // degrees shown either side
	float pxPerDegree;
	int alpha;         // 0..255
};

// Overlays queued for the next rendered frame.
class Overlays {
public:
	static constexpr int kCapacity = 48;

	void addPanel(const Panel &panel);
	// White ticks every 5 degrees, taller every 15 and 45, fading at the ends.
	void addTape(const Tape &tape);
	void clear() { count_ = 0; }

	// Collects the overlays touching columns [left, right); returns how many.
	int pick(int left, int right, const Panel **picked) const;

private:
	Panel panels_[kCapacity];
	int count_ = 0;
};

// Blends the part of a panel on row `y`, columns [left, right), into `row`
// (the surface row's first pixel).
void blendPanelRow(Pixel *row, int y, int left, int right, const Panel &panel);

}  // namespace terra
