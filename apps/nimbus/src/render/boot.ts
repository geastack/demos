import type { GeaEmbeddedImage } from "@geastack/core";
import { loadAssetImage } from "@geastack/core";
import { BOOT_DY, W } from "../layout";
import { easeOut, progress } from "../motion";
import { shell } from "../stores/shell";
import type { Painter } from "./painter";
import { BODY_FONT, SUN_GOLD, WORDMARK_FONT } from "./palette";

const WORDMARK = "Nimbus";
const TAGLINE = "Weather, at home";
const WORD_COLOR = "rgb(248,252,248)";
const TAGLINE_COLOR = "rgb(168,184,208)";
const MARK_X = Math.floor(W / 2) - 8;
const MARK_Y = 66 + BOOT_DY;
const OUT_MS = 380;

// The first two seconds, on the night blue the sky starts from: a sun rises
// behind a paper cloud, the wordmark and tagline rise under it. When the
// boot ends it fades out while the scene is revealed.
class BootView {
  private wordWidth = -1;
  private taglineWidth = 0;
  private startedAt = 0;
  private readonly cloud: GeaEmbeddedImage[] = [];

  start() {
    this.startedAt = Date.now();
  }

  load() {
    this.cloud.push(loadAssetImage("sky/b-light.png"));
  }

  paint(p: Painter, now: number) {
    const out = shell.booting ? 0 : progress(now, shell.bootedAt, 0, OUT_MS);
    if (out >= 1) return;

    if (this.wordWidth < 0) {
      this.wordWidth = p.width(WORDMARK, WORDMARK_FONT);
      this.taglineWidth = p.width(TAGLINE, BODY_FONT);
    }

    const alpha = 1 - out;
    const sunRise = easeOut(progress(now, this.startedAt, 150, 760));
    const drift = easeOut(progress(now, this.startedAt, 0, 900));
    p.circle(MARK_X + 12 - (1 - sunRise) * 6, MARK_Y - 10 + (1 - sunRise) * 18, 13, SUN_GOLD, alpha * sunRise);
    p.image(this.cloud[0], MARK_X - 36 - 16 * (1 - drift), MARK_Y - 14, alpha * drift);

    const word = easeOut(progress(now, this.startedAt, 350, 520));
    p.text(
      WORDMARK,
      W * 0.5 - this.wordWidth * 0.5,
      98 + BOOT_DY + (1 - word) * 10,
      WORDMARK_FONT,
      WORD_COLOR,
      alpha * word,
    );
    const tagline = easeOut(progress(now, this.startedAt, 550, 520));
    p.text(
      TAGLINE,
      W * 0.5 - this.taglineWidth * 0.5,
      160 + BOOT_DY + (1 - tagline) * 10,
      BODY_FONT,
      TAGLINE_COLOR,
      alpha * tagline,
    );
  }
}

export const bootView = new BootView();
