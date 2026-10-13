import { Store } from "@geastack/core";
import { durationText, MODE_NAMES, RECIPES, TIMED } from "../data/recipes";

const ROWS = 5;

type Row = { shown: boolean; first: boolean; number: string; cls: string; text: string };

// The recipe on show (carousel centre, Detail), copied into flat fields for
// the templates.
class RecipeStore extends Store {
  index = 0;
  name = "";
  tagline = "";
  timeText = "";
  tempText = "";
  mode = 0;
  modeName = "";
  // Spelled out: a field computed with .map() does not lower to native code.
  rows: Row[] = [
    { shown: true, first: true, number: "1", cls: "step-row enter-2", text: "" },
    { shown: true, first: false, number: "2", cls: "step-row enter-3", text: "" },
    { shown: true, first: false, number: "3", cls: "step-row enter-4", text: "" },
    { shown: true, first: false, number: "4", cls: "step-row enter-5", text: "" },
    { shown: true, first: false, number: "5", cls: "step-row enter-6", text: "" },
  ];

  init() {
    this.select(0);
  }

  select(index: number) {
    const recipe = RECIPES[index];
    this.index = index;
    this.name = recipe.name;
    this.tagline = recipe.tagline;
    this.timeText = durationText(recipe.minutes);
    this.tempText = `${recipe.temp} °C`;
    this.mode = recipe.mode;
    this.modeName = MODE_NAMES[recipe.mode];
    this.rows[0].text = `Preheat to ${recipe.temp} °C`;
    for (let i = 1; i < ROWS; i++) {
      const row = this.rows[i];
      row.shown = i <= recipe.steps.length;
      if (!row.shown) continue;

      const step = recipe.steps[i - 1];
      row.text = step.kind === TIMED ? `${step.title} · ${step.minutes} min` : step.title;
    }
  }
}

export const recipe = new RecipeStore();
