import { Store } from "@geastack/core";

const MINUTE_MS = 60_000;
// Before the board's RTC is set, the clock reads the early 1970s.
const SYNCED_AFTER_MS = 1_600_000_000_000;
// The gallery's display offset from UTC (the board RTC keeps UTC).
const OFFSET_KEY = "disco.utcOffset";

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Wall time and a greeting for the idle screen and the recipes bar.
class ClockStore extends Store {
  time = "";
  greeting = "Hello";
  synced = false;

  private offsetMinutes = 0;

  init() {
    const saved = localStorage.getItem(OFFSET_KEY);
    if (saved) this.offsetMinutes = Number(saved);

    this.tick();
    setInterval(() => this.tick(), 1000);
  }

  /** The wall time `minutes` from now, as HH:MM. */
  after(minutes: number): string {
    return this.format(Date.now() + minutes * MINUTE_MS);
  }

  private format(ms: number): string {
    const local = new Date(ms + this.offsetMinutes * MINUTE_MS);
    return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
  }

  private tick() {
    const now = Date.now();
    const local = new Date(now + this.offsetMinutes * MINUTE_MS);
    const time = this.format(now);
    const synced = now > SYNCED_AFTER_MS;
    const greeting = synced ? greetingFor(local.getUTCHours()) : "Ready when you are";
    if (time !== this.time) this.time = time;
    if (synced !== this.synced) this.synced = synced;
    if (greeting !== this.greeting) this.greeting = greeting;
  }
}

export const clock = new ClockStore();
