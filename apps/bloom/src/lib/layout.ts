// Everything on screen derives from the panel size, read once at startup
// (CSS px = panel px: `cssDevicePixelRatio` is 1).
//
//   board              panel     grid (4 px cells)  field image   font class
//   mosaico            480x480   120x120            480x480       large
//   amoled             410x502   102x125            408x500       large
//   STM32F746G-Disc.   480x272   120x68             480x272       small
//
// The field image is a whole number of cells, so on the amoled it is 2 px
// narrower and shorter than the panel and sits centred with a 1 px margin of
// background (putImageData blits a whole image: it cannot crop).
export const PANEL_W = Math.floor(window.innerWidth);
export const PANEL_H = Math.floor(window.innerHeight);

export const CELL_SIZE = 4; // panel pixels per grid cell
export const GRID_W = Math.floor(PANEL_W / CELL_SIZE);
export const GRID_H = Math.floor(PANEL_H / CELL_SIZE);
export const IMAGE_W = GRID_W * CELL_SIZE;
export const IMAGE_H = GRID_H * CELL_SIZE;

export const FIELD_X = (PANEL_W - IMAGE_W) >> 1;
export const FIELD_Y = (PANEL_H - IMAGE_H) >> 1;

export const LARGE = Math.min(PANEL_W, PANEL_H) >= 400;
export const PORTRAIT = PANEL_H > PANEL_W * 1.1;
