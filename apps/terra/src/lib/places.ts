// The four landscapes, in the native index order (native/landscapes.cpp).
export type Place = {
  index: number;
  name: string;
  title: string;
  coordinates: string;
  baseElevation: number; // metres at height 0
  startHeading: number; // degrees; the sun sits just left of the view
};

export const PLACES: Place[] = [
  { index: 0, name: "Alps", title: "ALPS", coordinates: "46.5°N · 8.0°E", baseElevation: 1200, startHeading: 270 },
  { index: 1, name: "Dunes", title: "DUNES", coordinates: "23.4°N · 11.8°E", baseElevation: 320, startHeading: 305 },
  { index: 2, name: "Glacier", title: "GLACIER", coordinates: "78.9°N · 16.0°E", baseElevation: 40, startHeading: 130 },
  { index: 3, name: "Mars", title: "MARS", coordinates: "4.6°S · 137.4°E", baseElevation: -4500, startHeading: 100 },
];

// Height units to metres and texels per second to km/h, for the HUD.
export const METRES_PER_UNIT = 14;
export const KMH_PER_SPEED = 9;
