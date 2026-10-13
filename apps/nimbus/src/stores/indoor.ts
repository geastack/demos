export const SPARK_COUNT = 24;
const SAMPLE_MS = 1000;
const SMOOTHING = 0.3; // the die sensor is noisy: an exponential average

function hms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds - h * 3600) / 60);
  const s = Math.floor(seconds - h * 3600 - m * 60);
  return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}

// Live readings from this board: the MCU's die temperature (shown as what it
// is, the chip's own temperature, not the room's), the supply voltage, and
// the last 24 seconds as a sparkline (0..1 within the window's own range).
// Sampled every second from boot.
class IndoorStore {
  temp = "--";
  volts = "";
  range = "";
  uptime = "";
  count = 0;
  readonly levels = new Float32Array(SPARK_COUNT);

  private readonly history = new Float32Array(SPARK_COUNT);
  private smoothed = 0;
  private bootedAt = 0;

  init() {
    this.bootedAt = Date.now();
    this.sample();
    setInterval(() => this.sample(), SAMPLE_MS);
  }

  private sample() {
    this.uptime = `Up ${hms((Date.now() - this.bootedAt) * 0.001)}`;
    const volts = boardSupply();
    // NaN where the chip cannot measure its supply: the row stays hidden.
    if (!Number.isNaN(volts)) this.volts = `${volts.toFixed(2)} V supply`;

    const reading = boardTemperature();
    if (Number.isNaN(reading)) return; // NaN: no sensor (no sensor on this chip)

    this.smoothed = this.count === 0 ? reading : this.smoothed + (reading - this.smoothed) * SMOOTHING;
    for (let i = 0; i < SPARK_COUNT - 1; i++) this.history[i] = this.history[i + 1];
    this.history[SPARK_COUNT - 1] = this.smoothed;
    this.count = Math.min(SPARK_COUNT, this.count + 1);
    this.temp = `${this.smoothed.toFixed(1)}°`;
    this.chart();
  }

  // Levels scaled to the window's own range (at least 1 °C), oldest left.
  private chart() {
    const first = SPARK_COUNT - this.count;
    let low = this.history[first];
    let high = low;
    for (let i = first + 1; i < SPARK_COUNT; i++) {
      low = Math.min(low, this.history[i]);
      high = Math.max(high, this.history[i]);
    }

    const span = Math.max(1, high - low);
    const base = (low + high) * 0.5 - span * 0.5;
    for (let i = 0; i < SPARK_COUNT; i++) {
      this.levels[i] = i < first ? 0 : (this.history[i] - base) / span;
    }

    this.range = `${low.toFixed(1)}° – ${high.toFixed(1)}° in 24 s`;
  }
}

export const indoor = new IndoorStore();
