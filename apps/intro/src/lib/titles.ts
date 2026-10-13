import {
  COMMAND_HEIGHT,
  COMMAND_MASK,
  COMMAND_STOPS,
  COMMAND_WIDTH,
  LEAD_HEIGHT,
  LEAD_MASK,
  LEAD_WIDTH,
  NAME_HEIGHT,
  NAME_MASK,
  NAME_WIDTH,
  STATUS_HEIGHT,
  STATUS_MASK,
  STATUS_STOPS,
  STATUS_WIDTH,
  STRONG_HEIGHT,
  STRONG_MASK,
  STRONG_WIDTH,
  TAGLINE_GAP,
} from "../data/type";
import { CYAN, ease, MINT, OY, PIXEL_MASK, TEXT, TEXT_SECONDARY, TEXT_TERTIARY, WIDTH } from "./frame";
import {
  BLINK_S,
  BOOT_CLEAR,
  CURSOR_IN,
  NAME_IN,
  RISE_S,
  STATUS_DELAY,
  STRONG_IN,
  TAGLINE_IN,
  TYPE_RATE,
  TYPE_START,
} from "./timeline";
import { GRADIENT, TypeLine } from "./type";

// The boot kicker: a flash command types out and the board answers. Ink
// centres, and the left edge that centres the longer status line (350 px).
// Rows are on the 480x272 stage, OY rows down the panel.
const KICKER_LEFT = (WIDTH - 350) >> 1;
const COMMAND_Y = (127 + OY) | 0;
const STATUS_Y = (145 + OY) | 0;
const STATUS_RATE = 110; // characters per second
const PROMPT_COLUMNS = COMMAND_STOPS[1] + 1; // "> " in cyan
const MARK_COLUMNS = STATUS_STOPS[2] + 1; // "OK" in mint
const CHARACTER_PITCH = 8;
const CURSOR_W = 6;
const CURSOR_H = 10;

// The name and the website's hero line (website/index.html, h1.hero-title)
// under the hairline.
const NAME_Y = (194 + OY) | 0;
const TAGLINE_Y = (223 + OY) | 0;
const TAGLINE_LEFT = (WIDTH - (LEAD_WIDTH + TAGLINE_GAP + STRONG_WIDTH)) >> 1; // centred (253 px wide)
const RISE_PX = 10;

// Draws the type into the frame: the boot kicker behind a cyan block cursor,
// then the name and tagline rising into place.
export class Titles {
  private readonly pixels: Uint16Array;
  private readonly command = new TypeLine(COMMAND_WIDTH, COMMAND_HEIGHT, COMMAND_MASK);
  private readonly status = new TypeLine(STATUS_WIDTH, STATUS_HEIGHT, STATUS_MASK);
  private readonly name = new TypeLine(NAME_WIDTH, NAME_HEIGHT, NAME_MASK);
  private readonly lead = new TypeLine(LEAD_WIDTH, LEAD_HEIGHT, LEAD_MASK);
  private readonly strong = new TypeLine(STRONG_WIDTH, STRONG_HEIGHT, STRONG_MASK);

  constructor(pixels: Uint16Array) {
    this.pixels = pixels;
  }

  draw(time: number) {
    if (time >= CURSOR_IN && time < BOOT_CLEAR) this.boot(time);
    if (time >= NAME_IN) this.names(time);
  }

  // The command types at TYPE_RATE, the status line answers faster; the
  // cursor is solid while typing and blinks while it waits.
  private boot(time: number) {
    const pixels = this.pixels;
    const commandLength = COMMAND_STOPS.length - 1;
    const statusLength = STATUS_STOPS.length - 1;
    const typed = Math.min(commandLength, Math.max(0, Math.floor((time - TYPE_START) * TYPE_RATE)));
    const statusAt = TYPE_START + commandLength / TYPE_RATE + STATUS_DELAY;
    const answered = Math.min(statusLength, Math.max(0, Math.floor((time - statusAt) * STATUS_RATE)));

    const commandTop = COMMAND_Y - (COMMAND_HEIGHT >> 1);
    const typedColumns = COMMAND_STOPS[typed];
    this.command.draw(pixels, KICKER_LEFT, commandTop, CYAN, 32, 0, Math.min(typedColumns, PROMPT_COLUMNS));
    this.command.draw(pixels, KICKER_LEFT, commandTop, TEXT_SECONDARY, 32, PROMPT_COLUMNS, typedColumns);

    const statusTop = STATUS_Y - (STATUS_HEIGHT >> 1);
    const answeredColumns = STATUS_STOPS[answered];
    this.status.draw(pixels, KICKER_LEFT, statusTop, MINT, 32, 0, Math.min(answeredColumns, MARK_COLUMNS));
    this.status.draw(pixels, KICKER_LEFT, statusTop, TEXT_TERTIARY, 32, MARK_COLUMNS, answeredColumns);

    const typing = (typed > 0 && typed < commandLength) || (answered > 0 && answered < statusLength);
    const blinkOn = Math.floor((time - CURSOR_IN) / (BLINK_S / 2)) % 2 === 0;
    if (!typing && !blinkOn) return;

    const onStatus = answered > 0;
    const column = onStatus ? answered : typed;
    const x = (KICKER_LEFT + column * CHARACTER_PITCH) | 0;
    const top = ((onStatus ? STATUS_Y : COMMAND_Y) - (CURSOR_H >> 1)) | 0;
    for (let y = top; y < top + CURSOR_H; y++) {
      for (let dx = 0; dx < CURSOR_W; dx++) pixels[(y * WIDTH + x + dx) & PIXEL_MASK] = CYAN;
    }
  }

  // Each line eases up RISE_PX while it fades in.
  private names(time: number) {
    const pixels = this.pixels;
    const name = ease((time - NAME_IN) / RISE_S);
    const nameRise = ((1 - name) * RISE_PX) | 0;
    const nameOpacity = (name * 32) | 0;
    const nameLeft = (WIDTH - NAME_WIDTH) >> 1;
    this.name.draw(pixels, nameLeft, NAME_Y - (NAME_HEIGHT >> 1) + nameRise, TEXT, nameOpacity, 0, NAME_WIDTH);

    const lead = ease((time - TAGLINE_IN) / RISE_S);
    const leadRise = ((1 - lead) * RISE_PX) | 0;
    const leadOpacity = (lead * 32) | 0;
    const leadTop = TAGLINE_Y - (LEAD_HEIGHT >> 1) + leadRise;
    this.lead.draw(pixels, TAGLINE_LEFT, leadTop, TEXT_SECONDARY, leadOpacity, 0, LEAD_WIDTH);

    const strong = ease((time - STRONG_IN) / RISE_S);
    const strongRise = ((1 - strong) * RISE_PX) | 0;
    const strongOpacity = (strong * 32) | 0;
    const strongTop = TAGLINE_Y - (STRONG_HEIGHT >> 1) + strongRise;
    const strongLeft = TAGLINE_LEFT + LEAD_WIDTH + TAGLINE_GAP;
    this.strong.draw(pixels, strongLeft, strongTop, GRADIENT, strongOpacity, 0, STRONG_WIDTH);
  }
}
