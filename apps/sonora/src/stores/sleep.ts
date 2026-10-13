import { Store } from "@geastack/core";
import { player } from "./player";
import { SLEEP, shell } from "./shell";

const END_OF_TRACK = -1;
// Minutes per option; END_OF_TRACK stops when the playing track ends.
export const SLEEP_MINUTES = [0, 15, 30, 60, END_OF_TRACK];
export const SLEEP_LABELS = ["Off", "15 min", "30 min", "1 hour", "End of track"];

const CLOSE_MS = 420;
const TOAST_MS = 3200;

// The sleep timer: pick a duration and playback pauses when it runs out. The
// moon button shows what is left ("29m").
class SleepStore extends Store {
  choice = 0;
  badge = "";
  toast = "";

  private endsAt = 0;
  private toastTimer = 0;

  init() {
    setInterval(() => this.tick(), 1000);
  }

  open() {
    shell.show(SLEEP);
  }

  pick(choice: number) {
    this.choice = choice;
    const minutes = SLEEP_MINUTES[choice];
    const seconds = minutes === END_OF_TRACK ? player.length() - player.position() : minutes * 60;
    this.endsAt = minutes === 0 ? 0 : Date.now() + seconds * 1000;
    this.tick();
    setTimeout(() => {
      if (shell.overlay === SLEEP) shell.dismiss();
    }, CLOSE_MS);
  }

  private tick() {
    if (this.endsAt === 0) {
      if (this.badge !== "") this.badge = "";
      return;
    }

    const left = this.endsAt - Date.now();
    if (left <= 0) {
      this.expire();
      return;
    }

    const minutes = Math.ceil(left / 60_000);
    const badge = `${minutes}m`;
    if (badge !== this.badge) this.badge = badge;
  }

  private expire() {
    this.endsAt = 0;
    this.choice = 0;
    this.badge = "";
    player.pause();
    this.say("Sleep timer ended · paused");
  }

  private say(text: string) {
    this.toast = text;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = "";
    }, TOAST_MS);
  }
}

export const sleep = new SleepStore();
