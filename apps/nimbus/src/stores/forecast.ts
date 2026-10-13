import {
  conditionName,
  type Forecast,
  forecastAt,
  HOUR_COUNT,
  MOMENTS,
  SCENE_CLOUDY,
  SCENE_DAY,
  SCENE_SNOW,
  weekdayName,
} from "../data/weather";
import { sky } from "../render/sky";

const ROLL_MS = 420; // the hero numeral rolls through the degrees between
const PER_MINUTE = 0.000016666666666666667; // 1 / 60000, written out (integer division otherwise)

// Bright scenes take dark ink and frosted glass; the rest white type on smoked glass.
function isLight(scene: number): boolean {
  return scene === SCENE_DAY || scene === SCENE_CLOUDY || scene === SCENE_SNOW;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

// The station's reading at the selected hour: the hero numbers, the chips,
// the hourly strip's cells and the theme the scene asks for. `select` moves
// the reading along the next 30 hours; `load` switches to another moment.
// Plain fields: the canvas reads them every frame.
class ForecastStore {
  moment = 0;
  dark = false;
  condition = "";
  when = "";
  details = "";
  wind = "";
  humidity = "";
  precip = "";
  clock = "";
  date = "";
  selected = 0;
  // Bumps whenever the reading changes, so the view re-measures its text.
  version = 0;
  readonly labels: string[] = [];
  readonly icons: number[] = [];
  readonly temps: string[] = [];
  readonly midnight: boolean[] = [];

  private data: Forecast = forecastAt(MOMENTS[0]);
  private loadedAt = 0;
  private rollFrom = 0;
  private rollTo = 0;
  private rollStart = 0;

  init() {
    for (let i = 0; i < HOUR_COUNT; i++) {
      this.labels.push("");
      this.icons.push(0);
      this.temps.push("");
      this.midnight.push(false);
    }

    this.load(0);
    this.rollFrom = this.rollTo;
    const hour = this.data.hours[0];
    sky.set(hour.scene, hour.condition, hour.night);
  }

  current(): Forecast {
    return this.data;
  }

  /** Switches to another moment (the demo steps through them). */
  load(moment: number) {
    this.moment = moment;
    this.data = forecastAt(MOMENTS[moment]);
    this.loadedAt = Date.now();
    for (let i = 0; i < HOUR_COUNT; i++) {
      const hour = this.data.hours[i];
      this.labels[i] = hour.label;
      this.icons[i] = hour.icon;
      this.temps[i] = `${hour.temp}°`;
      this.midnight[i] = hour.hour === 0 && i > 0;
    }

    this.date = `${weekdayName(this.data.weekday)} ${this.data.date}`;
    this.tick();
    this.selected = -1;
    this.select(0);
  }

  /** Shows the reading at an hour of the strip (0 = now). */
  select(index: number) {
    if (index === this.selected) return;

    this.selected = index;
    const hour = this.data.hours[index];
    const day = this.data.days[hour.day];
    const dayName = hour.day === 0 ? "Today" : weekdayName((this.data.weekday + 1) % 7);
    this.condition = conditionName(hour);
    this.when = index === 0 ? "" : `${dayName} ${pad(hour.hour)}:00`;
    this.details = `Feels like ${hour.feels}°  ·  H ${day.high}°  L ${day.low}°`;
    this.wind = `${hour.wind} km/h ${this.data.windDir}`;
    this.humidity = `${hour.humidity}%`;
    this.precip = hour.precip >= 10 ? `${hour.precip}%` : "";
    this.dark = !isLight(hour.scene);
    this.version = this.version + 1;
    sky.show(hour.scene, hour.condition, hour.night);

    this.rollFrom = this.shownTemp(Date.now());
    this.rollTo = hour.temp;
    this.rollStart = Date.now();
  }

  /** The hero numeral at a time: it counts through the degrees in between. */
  shownTemp(now: number): number {
    const t = Math.min(1, (now - this.rollStart) / ROLL_MS);
    const eased = 1 - (1 - t) * (1 - t);
    return Math.round(this.rollFrom + (this.rollTo - this.rollFrom) * eased);
  }

  /** The moment's wall clock, running on from when it was loaded. */
  tick() {
    const moment = MOMENTS[this.moment];
    const elapsed = Math.floor((Date.now() - this.loadedAt) * PER_MINUTE);
    const minutes = moment.hour * 60 + moment.minute + elapsed;
    const clock = `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
    if (clock !== this.clock) this.clock = clock;
  }
}

export const forecast = new ForecastStore();
