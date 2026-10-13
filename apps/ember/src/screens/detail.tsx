import "../styles/detail.css";
import { Hero, ModeIcon } from "../components/art";
import {
  DETAIL_HEAD_Y,
  DETAIL_SPECS_Y,
  HERO_H,
  PAD,
  START_Y,
  STEP_GAP,
  STEP_PITCH,
  STEPS_W,
  STEPS_Y,
  W,
} from "../layout";
import { showRecipes, startCooking } from "../navigation";
import { recipe } from "../stores/recipe";

// The recipe: the photo pushes in full-bleed with the dish on the right; on
// the dark left, the title, time / temperature / mode and the steps, and a
// Start button floating over the photo.
export function DetailScreen() {
  return (
    <div class="screen">
      <div class="push-in" style={{ width: W, height: HERO_H }}>
        <Hero dish={recipe.index} />
      </div>

      <div class="round" style={{ left: PAD, top: PAD }} onClick={() => showRecipes()}>
        <img src="icons/back.png" />
      </div>

      <div class="detail-head enter-1" style={{ left: PAD, top: DETAIL_HEAD_Y }}>
        <span class="t-title">{recipe.name}</span>
        <span class="t-caption">{recipe.tagline}</span>
      </div>

      <div class="specs enter-2" style={{ left: PAD, top: DETAIL_SPECS_Y }}>
        <img src="icons/clock.png" />
        <span class="t-label c-text">{recipe.timeText}</span>
        <div class="spec-gap" />
        <img src="icons/thermo.png" />
        <span class="t-label c-text">{recipe.tempText}</span>
        <div class="spec-gap" />
        <ModeIcon mode={recipe.mode} on={false} />
        <span class="t-label c-text">{recipe.modeName}</span>
      </div>

      <div class="steps" style={{ left: PAD, top: STEPS_Y, width: STEPS_W, gap: STEP_GAP }}>
        <div class="steps-line" style={{ height: recipe.rows[4].shown ? 4 * STEP_PITCH : 3 * STEP_PITCH }} />
        {recipe.rows.map((row) => (
          <div class={row.shown ? row.cls : "hide"}>
            <div class={row.first ? "step-number step-number-first" : "step-number"}>
              <span class="t-label">{row.number}</span>
            </div>
            <span class="t-body">{row.text}</span>
          </div>
        ))}
      </div>

      <div class="start lift-2" style={{ right: PAD, top: START_Y }}>
        <div class="cta" onClick={() => startCooking()}>
          <span class="t-button">Start cooking</span>
          <img src="icons/arrow.png" />
        </div>
      </div>
    </div>
  );
}
