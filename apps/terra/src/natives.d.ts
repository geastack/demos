// Terra's native functions (native/terra.h), bound by native/plugin.mjs.
// Map coordinates are texels on a 512 x 512 torus, heights are units 0..255,
// angles are radians clockwise from north.

/** Starts baking landscape `index` (0 Alps, 1 Dunes, 2 Glacier, 3 Mars): its sky draws at once. 1 on success. */
declare function terraSelect(index: number): number;

/** Bakes for up to `budgetMs`; 1 once the terrain is ready. */
declare function terraBake(budgetMs: number): number;

/** Renders the view into a panel-sized surface with the queued overlays. `horizon` is the horizon row, `visibility` 0..1. */
declare function terraRender(
  surfaceId: number,
  x: number,
  y: number,
  heading: number,
  altitude: number,
  horizon: number,
  bank: number,
  visibility: number,
): void;

/** Queues a rounded HUD plate for the next frame; `rgb` is 0xRRGGBB, `opacity` 0..1. */
declare function terraPanel(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  rgb: number,
  opacity: number,
): void;

/** Queues the heading tape's ticks for the next frame; `heading` in degrees, `opacity` 0..1. */
declare function terraTape(
  centerX: number,
  top: number,
  heading: number,
  halfSpan: number,
  pxPerDegree: number,
  opacity: number,
): void;

/** Terrain height under a point (0 while baking). */
declare function terraGround(x: number, y: number): number;

/** Highest terrain in a corridor `distance` texels ahead. */
declare function terraGroundAhead(x: number, y: number, heading: number, distance: number): number;

/** Where the current landscape's flight starts. */
declare function terraSpawnX(): number;
declare function terraSpawnY(): number;
