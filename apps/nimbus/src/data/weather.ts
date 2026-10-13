// The simulated weather: three days at the station (summer, autumn, winter),
// each with an hourly condition track and a seven-day outlook, and six
// "moments" on them that the demo button steps through, one per scene.
// Everything is deterministic: the same moment always shows the same data.

// Conditions.
export const CLEAR = 0;
export const PARTLY = 1;
export const OVERCAST = 2;
export const RAIN = 3;
export const SNOW = 4;

// Scenes (one illustration each, in public/art).
export const SCENE_DAY = 0;
export const SCENE_SUNSET = 1;
export const SCENE_NIGHT = 2;
export const SCENE_CLOUDY = 3;
export const SCENE_RAIN = 4;
export const SCENE_SNOW = 5;
export const SCENE_COUNT = 6;

// Icons (see components/icon.tsx).
export const ICON_SUN = 0;
export const ICON_MOON = 1;
export const ICON_SUN_CLOUD = 2;
export const ICON_MOON_CLOUD = 3;
export const ICON_CLOUD = 4;
export const ICON_RAIN = 5;
export const ICON_SNOW = 6;
export const ICON_HORIZON = 7;

export const HOUR_COUNT = 30;
export const DAY_COUNT = 7;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CODES = "CPORS";
// One hour of the day as an angle (a double constant: an integer divided by an
// integer literal would lower to integer division).
const HOUR_ANGLE = Math.PI / 12;

type Season = {
  weekday: number;
  date: string;
  sunrise: number; // minutes after midnight
  sunset: number;
  mean: number; // daily mean temperature, °C
  swing: number; // half the day's range
  humidity: number;
  wind: number; // km/h
  windDir: string;
  hours: string; // one condition code per hour of the day, 0..23
  week: string; // condition codes, today first
  lows: number[];
  highs: number[];
};

const SUMMER: Season = {
  weekday: 6,
  date: "12 July",
  sunrise: 362,
  sunset: 1258,
  mean: 24,
  swing: 6,
  humidity: 46,
  wind: 9,
  windDir: "NE",
  hours: "CCCCCCCCCCCCCCCPPPCCCCCC",
  week: "CCPORPC",
  lows: [18, 19, 20, 18, 16, 16, 17],
  highs: [30, 31, 30, 26, 22, 25, 28],
};

const AUTUMN: Season = {
  weekday: 4,
  date: "16 October",
  sunrise: 451,
  sunset: 1122,
  mean: 13,
  swing: 3,
  humidity: 74,
  wind: 18,
  windDir: "SW",
  hours: "PPPPPPPOOOOOORRRRRRROOOP",
  week: "ROPCPRO",
  lows: [9, 8, 7, 6, 8, 9, 7],
  highs: [15, 13, 14, 15, 15, 13, 12],
};

const WINTER: Season = {
  weekday: 2,
  date: "13 January",
  sunrise: 478,
  sunset: 1032,
  mean: -1,
  swing: 2.5,
  humidity: 86,
  wind: 12,
  windDir: "N",
  hours: "OOOOOSSSSSSSSSSSOOOOPPPP",
  week: "SSOPCCO",
  lows: [-3, -4, -5, -6, -7, -5, -2],
  highs: [1, 0, -1, 1, 2, 3, 4],
};

export type Moment = { season: number; hour: number; minute: number; name: string };

// Demo order: a summer day from morning to night, an autumn day turning to
// rain, then snow.
export const MOMENTS: Moment[] = [
  { season: 0, hour: 11, minute: 24, name: "Clear day" },
  { season: 1, hour: 10, minute: 12, name: "Cloudy" },
  { season: 1, hour: 15, minute: 36, name: "Rain" },
  { season: 0, hour: 20, minute: 31, name: "Sunset" },
  { season: 0, hour: 23, minute: 8, name: "Clear night" },
  { season: 2, hour: 9, minute: 40, name: "Snow" },
];

export type Hour = {
  hour: number;
  day: number; // 0 today, 1 tomorrow
  condition: number;
  scene: number;
  night: boolean;
  icon: number;
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  precip: number;
  label: string;
};

export type Day = { name: string; condition: number; icon: number; low: number; high: number; precip: number };

export type Forecast = {
  date: string;
  weekday: number;
  sunrise: number;
  sunset: number;
  windDir: string;
  hours: Hour[];
  days: Day[];
};

function seasonOf(index: number): Season {
  if (index === 1) return AUTUMN;
  if (index === 2) return WINTER;
  return SUMMER;
}

function conditionOf(code: string): number {
  return CODES.indexOf(code);
}

// A small deterministic wobble so neighbouring hours are not perfectly smooth.
function wobble(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

function isNight(season: Season, hour: number): boolean {
  return hour < Math.floor(season.sunrise / 60) || hour > Math.floor(season.sunset / 60);
}

function isGolden(season: Season, hour: number): boolean {
  return hour === Math.floor(season.sunrise / 60) || hour === Math.floor(season.sunset / 60);
}

function sceneOf(condition: number, night: boolean, golden: boolean): number {
  if (condition === RAIN) return SCENE_RAIN;
  if (condition === SNOW) return SCENE_SNOW;
  if (night) return SCENE_NIGHT;
  if (condition === OVERCAST) return SCENE_CLOUDY;
  if (golden) return SCENE_SUNSET;
  return SCENE_DAY;
}

export function iconOf(condition: number, night: boolean, golden: boolean): number {
  if (condition === RAIN) return ICON_RAIN;
  if (condition === SNOW) return ICON_SNOW;
  if (condition === OVERCAST) return ICON_CLOUD;
  if (golden && !night) return ICON_HORIZON;
  if (condition === PARTLY) return night ? ICON_MOON_CLOUD : ICON_SUN_CLOUD;
  return night ? ICON_MOON : ICON_SUN;
}

// Wind chill below 10 °C, a humid heat bump above 26 °C.
function feelsLike(temp: number, wind: number, humidity: number): number {
  if (temp <= 10 && wind > 4.8) {
    const v = wind ** 0.16;
    return 13.12 + 0.6215 * temp - 11.37 * v + 0.3965 * temp * v;
  }

  if (temp >= 26) return temp + (humidity - 40) * 0.08;

  return temp - wind * 0.04;
}

function precipOf(condition: number, seed: number): number {
  if (condition === RAIN) return 70 + Math.round(wobble(seed) * 30 + 10);
  if (condition === SNOW) return 60 + Math.round(wobble(seed) * 30 + 15);
  if (condition === OVERCAST) return 20;
  if (condition === PARTLY) return 5;
  return 0;
}

function hourLabel(index: number, hour: number, weekday: number): string {
  if (index === 0) return "Now";

  if (hour === 0) return WEEKDAYS[weekday];

  return hour < 10 ? `0${hour}:00` : `${hour}:00`;
}

function buildHour(season: Season, index: number, startHour: number): Hour {
  const clock = startHour + index;
  const hour = clock % 24;
  const day = clock >= 24 ? 1 : 0;
  const condition = conditionOf(season.hours.charAt(hour));
  const night = isNight(season, hour);
  const golden = isGolden(season, hour);
  const wet = condition === RAIN || condition === SNOW ? 1.5 : 0;
  const raw = season.mean + season.swing * Math.cos((hour - 15) * HOUR_ANGLE) - wet + wobble(clock) * 0.8;
  const humidity = Math.round(season.humidity - (raw - season.mean) * 2 + wet * 6);
  const wind = Math.round(season.wind + 4 * Math.sin(clock * 0.7) + wet * 3);
  return {
    hour,
    day,
    condition,
    scene: sceneOf(condition, night, golden),
    night,
    icon: iconOf(condition, night, golden),
    temp: Math.round(raw),
    feels: Math.round(feelsLike(raw, wind, humidity)),
    humidity: Math.min(98, humidity),
    wind,
    precip: precipOf(condition, clock),
    label: hourLabel(index, hour, (season.weekday + 1) % 7),
  };
}

function buildDay(season: Season, index: number): Day {
  const condition = conditionOf(season.week.charAt(index));
  return {
    name: index === 0 ? "Today" : WEEKDAYS[(season.weekday + index) % 7],
    condition,
    icon: iconOf(condition, false, false),
    low: season.lows[index],
    high: season.highs[index],
    precip: precipOf(condition, index * 7 + season.weekday),
  };
}

/** The forecast as the station sees it at a moment: 30 hours from now and a week. */
export function forecastAt(moment: Moment): Forecast {
  const season = seasonOf(moment.season);
  const hours: Hour[] = [];
  for (let i = 0; i < HOUR_COUNT; i++) {
    hours.push(buildHour(season, i, moment.hour));
  }

  const days: Day[] = [];
  for (let i = 0; i < DAY_COUNT; i++) {
    days.push(buildDay(season, i));
  }

  return {
    date: season.date,
    weekday: season.weekday,
    sunrise: season.sunrise,
    sunset: season.sunset,
    windDir: season.windDir,
    hours,
    days,
  };
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday];
}

export function conditionName(hour: Hour): string {
  if (hour.condition === RAIN) return hour.precip > 85 ? "Rain" : "Light rain";
  if (hour.condition === SNOW) return "Snow";
  if (hour.condition === OVERCAST) return "Overcast";
  if (hour.scene === SCENE_SUNSET) return hour.hour < 12 ? "Sunrise" : "Sunset";
  if (hour.condition === PARTLY) return "Partly cloudy";
  return hour.night ? "Clear" : "Sunny";
}

export function dayCondition(day: Day): string {
  if (day.condition === RAIN) return "Rain";
  if (day.condition === SNOW) return "Snow";
  if (day.condition === OVERCAST) return "Overcast";
  if (day.condition === PARTLY) return "Partly cloudy";
  return "Sunny";
}

/** "06:02" from minutes after midnight. */
export function clockText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}
