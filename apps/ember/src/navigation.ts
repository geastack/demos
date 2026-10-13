import { carousel } from "./stores/carousel";
import { clock } from "./stores/clock";
import { cook } from "./stores/cook";
import { manual } from "./stores/manual";
import { recipe } from "./stores/recipe";
import { buildRings } from "./stores/rings";
import { BOOT, COOK, DETAIL, IDLE, MANUAL, PREHEAT, READY, RECIPES, shell } from "./stores/shell";

const BOOT_MS = 2600;
const IDLE_MS = 90_000;
const ESCAPE_KEY = 27;

// Screen flow that spans stores: boot, idle, and the USER button as "back".
// The cooking flow itself (Preheat, Cook, Ready) is driven by the cook store.

export function start() {
  clock.init();
  recipe.init();
  cook.init();
  buildRings();
  setTimeout(() => {
    if (shell.screen === BOOT) showRecipes();
  }, BOOT_MS);
  setInterval(() => checkIdle(), 1000);
}

export function showRecipes() {
  carousel.enter();
  shell.open(RECIPES);
}

export function showDetail() {
  shell.open(DETAIL);
}

export function showManual() {
  shell.open(MANUAL);
  manual.enter();
}

export function startCooking() {
  cook.startRecipe(recipe.index);
}

/** The close button: armed by the first press, stops on the second. */
export function closeCooking() {
  if (cook.close()) leaveCooking();
}

/** Ready's Done button. */
export function doneCooking() {
  cook.finish();
  leaveCooking();
}

function leaveCooking() {
  if (cook.manual) showManual();
  else showDetail();
}

export function back(keyCode: number) {
  if (keyCode !== ESCAPE_KEY) return;

  const screen = shell.screen;
  shell.poke();
  if (screen === PREHEAT || screen === COOK) closeCooking();
  else if (screen === READY) doneCooking();
  else if (screen !== RECIPES) showRecipes();
}

// Browsing screens fall back to the attract state after a quiet minute; a
// cooking session never does.
function checkIdle() {
  const screen = shell.screen;
  const idles = screen === RECIPES || screen === DETAIL || screen === MANUAL;
  if (idles && shell.quietFor() > IDLE_MS) shell.open(IDLE);
}
