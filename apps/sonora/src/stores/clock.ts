import { Store } from "@geastack/core";

const MINUTE_MS = 60_000;
// Before the board's RTC is set, the clock reads the early 1970s.
const SYNCED_AFTER_MS = 1_600_000_000_000;
// The gallery's display offset from UTC (the board RTC keeps UTC).
const OFFSET_KEY = "disco.utcOffset";

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

// Wall time for the ambient screen, once the board's clock has been set.
class ClockStore extends Store {
  time = "";
  synced = false;

  private offsetMinutes = 0;

  init() {
    const saved = localStorage.getItem(OFFSET_KEY);
    if (saved) this.offsetMinutes = Number(saved);

    this.tick();
    setInterval(() => this.tick(), 1000);
  }

  private tick() {
    const now = Date.now();
    const local = new Date(now + this.offsetMinutes * MINUTE_MS);
    const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
    const synced = now > SYNCED_AFTER_MS;
    if (time !== this.time) this.time = time;
    if (synced !== this.synced) this.synced = synced;
  }
}

export const clock = new ClockStore();
