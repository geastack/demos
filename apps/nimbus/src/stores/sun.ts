import { clockText, type Forecast, MOMENTS } from "../data/weather";

const DAY_MINUTES = 1440;

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return `${h} h ${m < 10 ? "0" : ""}${m} m`;
}

// Sunrise and sunset for the Today panel, and where the sun is between them
// (0 at sunrise, 1 at sunset). Plain fields: the canvas reads them.
class SunStore {
  sunrise = "";
  sunset = "";
  daylight = "";
  next = "";
  up = true;
  position = 0;

  load(data: Forecast, moment: number) {
    const now = MOMENTS[moment].hour * 60 + MOMENTS[moment].minute;
    const day = data.sunset - data.sunrise;
    this.sunrise = clockText(data.sunrise);
    this.sunset = clockText(data.sunset);
    this.daylight = `${duration(day)} of daylight`;
    this.up = now >= data.sunrise && now <= data.sunset;
    if (this.up) {
      this.next = `Sunset in ${duration(data.sunset - now)}`;
      this.position = (now - data.sunrise) / day;
      return;
    }

    const until = now < data.sunrise ? data.sunrise - now : data.sunrise + DAY_MINUTES - now;
    this.next = `Sunrise in ${duration(until)}`;
    this.position = now < data.sunrise ? 0 : 1;
  }
}

export const sun = new SunStore();
