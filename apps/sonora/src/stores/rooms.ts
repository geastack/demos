import { Store } from "@geastack/core";
import { ROOMS, shell } from "./shell";

export const LIVING = 0;
export const KITCHEN = 1;
export const BEDROOM = 2;

export const ROOM_NAMES = ["Living room", "Kitchen", "Bedroom"];
export const ROOM_SPEAKERS = ["Sonora One · pair", "Sonora Mini", "Sonora Mini"];

const CONNECT_MS = 900; // the hand-off to another speaker
const CLOSE_MS = 650; // the check shows, then the sheet goes

// Which speaker plays. Picking another room shows a short hand-off (a
// spinning ring on its card), then a check, then the sheet closes.
class RoomsStore extends Store {
  active = LIVING;
  name = ROOM_NAMES[LIVING];
  connecting = -1;
  joined = -1; // the room whose check just popped

  private busy = false;

  open() {
    this.joined = -1;
    shell.show(ROOMS);
  }

  pick(room: number) {
    if (this.busy) return;

    if (room === this.active) {
      shell.dismiss();
      return;
    }

    this.busy = true;
    this.connecting = room;
    setTimeout(() => this.connected(room), CONNECT_MS);
  }

  private connected(room: number) {
    this.connecting = -1;
    this.active = room;
    this.name = ROOM_NAMES[room];
    this.joined = room;
    setTimeout(() => {
      this.busy = false;
      if (shell.overlay === ROOMS) shell.dismiss();
    }, CLOSE_MS);
  }
}

export const rooms = new RoomsStore();
