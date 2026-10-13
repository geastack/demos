// The library: six fictional albums, one per cover in public/art. `bpm` and
// `energy` (0-1) shape the visualiser's synthetic spectrum for each record.

export type Track = {
  title: string;
  seconds: number;
};

export type Album = {
  title: string;
  artist: string;
  year: number;
  genre: string;
  bpm: number;
  energy: number;
  tracks: Track[];
};

export const ALBUMS: Album[] = [
  {
    title: "Afterglow Coast",
    artist: "Vela Marin",
    year: 2024,
    genre: "Synthwave",
    bpm: 104,
    energy: 0.85,
    tracks: [
      { title: "Coastline Drive", seconds: 218 },
      { title: "Palm Static", seconds: 196 },
      { title: "Magenta Hour", seconds: 243 },
      { title: "Low Tide Radio", seconds: 205 },
      { title: "Sunset Protocol", seconds: 262 },
    ],
  },
  {
    title: "Blue Hour Sessions",
    artist: "The Orla Quartet",
    year: 2022,
    genre: "Jazz",
    bpm: 92,
    energy: 0.55,
    tracks: [
      { title: "Brass Moon", seconds: 287 },
      { title: "Quiet Orbit", seconds: 241 },
      { title: "Cream & Cobalt", seconds: 312 },
      { title: "Late Set", seconds: 228 },
      { title: "Half Circle", seconds: 269 },
    ],
  },
  {
    title: "Rain on Glass",
    artist: "Moth & Lamp",
    year: 2023,
    genre: "Lo-fi",
    bpm: 76,
    energy: 0.5,
    tracks: [
      { title: "Desk Lamp", seconds: 154 },
      { title: "Window Seat", seconds: 171 },
      { title: "3 AM Tea", seconds: 148 },
      { title: "Drizzle Tape", seconds: 166 },
      { title: "Soft Static", seconds: 183 },
    ],
  },
  {
    title: "Paper Valleys",
    artist: "Wren Hollow",
    year: 2021,
    genre: "Folk",
    bpm: 88,
    energy: 0.6,
    tracks: [
      { title: "Fold the Hills", seconds: 224 },
      { title: "Small Sun", seconds: 197 },
      { title: "Meadow Letters", seconds: 238 },
      { title: "Green Hours", seconds: 212 },
      { title: "Walking Home", seconds: 251 },
    ],
  },
  {
    title: "Liquid Chrome",
    artist: "Kairo Vex",
    year: 2025,
    genre: "Electronic",
    bpm: 124,
    energy: 1,
    tracks: [
      { title: "Mercury Rise", seconds: 233 },
      { title: "Iridescent", seconds: 254 },
      { title: "Wavefold", seconds: 219 },
      { title: "Prism Drift", seconds: 276 },
      { title: "Night Signal", seconds: 241 },
    ],
  },
  {
    title: "Nocturnes in Red",
    artist: "Ilse Marlowe",
    year: 2020,
    genre: "Piano",
    bpm: 66,
    energy: 0.4,
    tracks: [
      { title: "Velvet Room", seconds: 276 },
      { title: "Spotlight Waltz", seconds: 238 },
      { title: "Ember Prelude", seconds: 302 },
      { title: "Lid & String", seconds: 259 },
      { title: "Curtain Call", seconds: 284 },
    ],
  },
];

export const ALBUM_COUNT = ALBUMS.length;

/** "3:07" */
export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const rest = whole % 60;
  return `${Math.floor(whole / 60)}:${rest < 10 ? "0" : ""}${rest}`;
}
