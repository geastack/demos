import type { CanvasRenderingContext2D, GeaCanvasElement } from "@geastack/core";

const WIDTH = 352;
const HEIGHT = 264;
const COLUMNS = 40;
const ROWS = 26;
let pitch = 8;
let left = 16;
let top = 28;
let compact = false;
const BACKGROUND = "#071315";
const COLORS = ["#10292c", "#225052", "#79e5df", "#d7fffa", "#efbe79"];
const previous = new Uint8Array(COLUMNS * ROWS);
const outline = new Uint8Array(COLUMNS * ROWS);

let context: CanvasRenderingContext2D | null = null;
let time = 0;
let mouthLevel = 0;

function prepare(): void {
  previous.fill(255);

  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      // A softly rounded head, expressed on the same grid as the features.
      const dx = Math.max(0, Math.abs(column - 19.5) - 8.5);
      const dy = Math.max(0, Math.abs(row - 12.5) - 5.5);
      const distance = dx * dx + dy * dy;

      outline[row * COLUMNS + column] = distance >= 20.25 && distance <= 30.25 ? 1 : 0;
    }
  }
}

function drawDot(ctx: CanvasRenderingContext2D, column: number, row: number, color: number): void {
  const x = left + column * pitch;
  const y = top + row * pitch;

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(x, y, pitch, pitch);
  ctx.fillStyle = COLORS[color] ?? "#10292c";
  ctx.beginPath();
  ctx.arc(x + pitch / 2, y + pitch / 2, (color === 0 ? 1.25 : color === 1 ? 1.8 : 2.75) * pitch / 8, 0, Math.PI * 2);
  ctx.fill();
}

function draw(ctx: CanvasRenderingContext2D, phase: string): void {
  const speaking = phase === "speaking";
  const thinking = phase === "thinking";
  const connecting = phase === "connecting" || phase === "closing";
  const error = phase === "error";
  const blinkTime = time % 5.7;
  const blink = blinkTime > 4.85 && blinkTime < 5.05 ? Math.abs(blinkTime - 4.95) / 0.1 : 1;
  const gazeX = connecting ? Math.sin(time * 2.3) * 1.4 : Math.sin(time * 0.7) * 0.55;
  const gazeY = thinking ? -0.9 : Math.sin(time * 0.45) * 0.25;
  const eyeY = 9.5 + gazeY;
  const eyeHeight = Math.max(0.45, (error ? 2.8 : phase === "listening" ? 4.1 : 3.6) * blink);
  const eyeColor = error ? 4 : 2;
  const mouthHeight = 0.9 + mouthLevel * 3.5;
  const thoughtDot = Math.floor(time * 2.5) % 3;

  ctx.beginBatch();

  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const index = row * COLUMNS + column;
      let color = outline[index] ?? 0;
      const leftX = (column - 12 - gazeX) / 3.1;
      const rightX = (column - 27 - gazeX) / 3.1;
      const eyeDY = (row - eyeY) / eyeHeight;
      const inLeftEye = leftX * leftX + eyeDY * eyeDY <= 1;
      const inRightEye = rightX * rightX + eyeDY * eyeDY <= 1;

      if (inLeftEye || inRightEye) {
        color = eyeColor;
        // A few brighter dots make the eyes feel alive within the dot grid.
        if (!error && blink > 0.6 && row < eyeY - 1 && ((inLeftEye && leftX < -0.2) || (inRightEye && rightX < -0.2))) {
          color = 3;
        }
      }

      if ((column === 8 || column === 31) && row === 15) color = 1;
      if ((column === 9 || column === 30) && row === 16) color = 1;

      if (thinking || connecting) {
        if (row === 18 && (column === 16 || column === 20 || column === 24)) {
          color = Math.floor((column - 16) / 4) === thoughtDot ? 3 : 1;
        }
      } else if (speaking && mouthLevel > 0.06) {
        const mx = (column - 19.5) / 5.2;
        const my = (row - 18.5) / mouthHeight;
        const distance = mx * mx + my * my;

        if (distance >= 0.5 && distance <= 1.3) color = 2;
      } else if (column >= 14 && column <= 25) {
        const mx = (column - 19.5) / 5.5;
        const smileY = error ? 17.5 + 1.5 * mx * mx : 19 - 2.2 * mx * mx;

        if (Math.abs(row - smileY) < 0.6) color = eyeColor;
      }

      if (previous[index] !== color) {
        previous[index] = color;
        drawDot(ctx, column, row, color);
      }
    }
  }

  ctx.endBatch();
}

/** Attach once the native canvas has mounted. The face stays local to the display. */
export function prime(): boolean {
  if (context) return true;

  const canvas = document.getElementById("axel-face") as unknown as GeaCanvasElement | null;
  if (!canvas) return false;

  context = canvas.getContext("2d");
  prepare();
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  draw(context, "idle");
  return true;
}

/** elapsedSeconds is the interval since the preceding paint, not a wall clock. */
export function paint(elapsedSeconds: number, phase: string, level: number, preview = false): void {
  if (!context && !prime()) return;
  if (compact !== preview && context) {
    compact = preview;
    pitch = preview ? 4 : 8;
    left = preview ? 12 : 16;
    top = preview ? 80 : 28;
    const canvas = document.getElementById(preview ? "axel-face-compact" : "axel-face") as unknown as GeaCanvasElement | null;
    if (canvas) context = canvas.getContext("2d");
    previous.fill(255);
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, preview ? 184 : WIDTH, HEIGHT);
  }

  const elapsed = Math.max(0, Math.min(0.1, elapsedSeconds));
  time += elapsed;
  const target = phase === "speaking" ? Math.max(0, Math.min(1, level)) : 0;
  const response = Math.min(1, elapsed * (target > mouthLevel ? 24 : 12));
  mouthLevel += (target - mouthLevel) * response;

  const ctx = context;
  if (ctx) draw(ctx, phase);
}
