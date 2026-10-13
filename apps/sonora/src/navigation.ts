import { spectrum } from "./render/spectrum";
import { flow } from "./stores/flow";
import { player } from "./stores/player";
import { queue } from "./stores/queue";
import { AMBIENT, BOOT, BROWSE, NONE, NOW, QUEUE, shell } from "./stores/shell";
import { tint } from "./stores/tint";

const BOOT_MS = 2400;
const AMBIENT_AFTER_MS = 45_000;
const ESCAPE_KEY = 27;

// Screen flow that spans stores: boot, the shared-element moves between Now
// Playing, the library and the queue, the USER button as "back", and the
// ambient screen after a quiet spell.

export function start() {
  shell.poke();
  setTimeout(() => {
    if (shell.screen === BOOT) {
      player.toggle();
      showNow();
    }
  }, BOOT_MS);
  setInterval(() => checkIdle(), 1000);
}

export function showNow() {
  player.settle();
  tint.fade(player.album);
  shell.open(NOW);
  spectrum.attach();
}

export function showBrowse() {
  spectrum.detach();
  player.settle();
  flow.enter(player.album, shell.screen === NOW);
  shell.open(BROWSE);
}

export function showQueue() {
  spectrum.detach();
  player.settle();
  queue.sync();
  shell.open(QUEUE);
}

/** Plays an album picked in the library; its cover flies into Now Playing. */
export function playAlbum(album: number) {
  player.playAlbum(album);
  showNow();
}

export function back(keyCode: number) {
  if (keyCode !== ESCAPE_KEY) return;

  shell.poke();
  if (shell.screen === NOW && shell.overlay !== NONE) {
    shell.dismiss();
  } else if (shell.screen !== NOW && shell.screen !== BOOT) {
    showNow();
  }
}

function checkIdle() {
  const quiet = shell.screen === NOW && shell.overlay === NONE;
  if (quiet && shell.quietFor() > AMBIENT_AFTER_MS) {
    spectrum.detach();
    shell.open(AMBIENT);
  }
}
