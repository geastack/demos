import { carousel } from "./stores/carousel";
import { destination } from "./stores/destination";
import { BOOT, DETAIL, DISCOVER, shell } from "./stores/shell";
import { trips } from "./stores/trips";

const BOOT_MS = 1950; // the boot's hero has just slid into place
const DETAIL_IDLE_MS = 60_000;
const ESCAPE_KEY = 27;

// Screen flow that spans stores: boot, Discover <-> Detail, the USER button
// as "back", and Detail falling back to the attract carousel when left alone.

export function start() {
  setTimeout(() => {
    if (shell.screen === BOOT) showDiscover();
  }, BOOT_MS);
  setInterval(() => checkIdle(), 1000);
}

export function showDiscover() {
  carousel.enter();
  shell.open(DISCOVER);
}

export function showDetail() {
  trips.focus(destination.index);
  shell.open(DETAIL);
}

export function back(keyCode: number) {
  if (keyCode !== ESCAPE_KEY) return;

  if (shell.screen === DETAIL) showDiscover();
}

function checkIdle() {
  if (shell.screen === DETAIL && shell.quietFor() > DETAIL_IDLE_MS) showDiscover();
}
