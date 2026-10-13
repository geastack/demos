import { HEIGHT, WIDTH } from "./frame";

// The latest touch: `down` while a finger is on the glass, and the drag
// since an effect last consumed it.
export class Touch {
  down = false;
  x = WIDTH / 2;
  y = HEIGHT / 2;
  dragX = 0;
  dragY = 0;

  press(x: number, y: number) {
    this.down = true;
    this.x = x;
    this.y = y;
  }

  move(x: number, y: number) {
    if (!this.down) return;

    this.dragX += x - this.x;
    this.dragY += y - this.y;
    this.x = x;
    this.y = y;
  }

  release() {
    this.down = false;
  }

  consumeDrag() {
    this.dragX = 0;
    this.dragY = 0;
  }
}

export const touch = new Touch();
