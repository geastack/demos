#pragma once

// Terra's native API, bound to TS by native/plugin.mjs. Map coordinates are
// texels on a 512 x 512 torus; heights are units 0..255; angles in radians
// unless noted.
namespace terra {

// Starts baking landscape `index` (0 Alps, 1 Dunes, 2 Glacier, 3 Mars): its
// sky is drawable at once, its terrain once terraBake reports ready.
// Returns 1 on success, 0 when memory runs out.
double selectLandscape(double index);

// Bakes for up to `budgetMs`; returns 1 once the terrain is ready.
double bakeStep(double budgetMs);

// Renders the view into a surface the size of the panel, with the overlays
// queued since the last frame.
void renderView(double surfaceId, double x, double y, double heading, double altitude, double horizon, double bank,
                double visibility);

// Queues a rounded HUD plate for the next frame; `rgb` is 0xRRGGBB, `opacity` 0..1.
void queuePanel(double x, double y, double width, double height, double radius, double rgb, double opacity);

// Queues the heading tape's ticks for the next frame; `heading` in degrees.
void queueTape(double centerX, double top, double heading, double halfSpan, double pxPerDegree, double opacity);

// Terrain height under a point, interpolated (0 while baking).
double groundHeight(double x, double y);

// Highest terrain in a corridor `distance` texels ahead: what to clear.
double groundAhead(double x, double y, double heading, double distance);

// Where the current landscape's flight starts (its lowest valley).
double spawnX();
double spawnY();

}  // namespace terra
