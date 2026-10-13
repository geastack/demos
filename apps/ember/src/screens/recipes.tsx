import "../styles/recipes.css";
import { CardPhoto, Corners, ModeIcon } from "../components/art";
import { BAR_Y, CARD_H, DOTS_Y, LABEL_Y, PAD, STAGE_Y, W } from "../layout";
import { showDetail, showManual } from "../navigation";
import { carousel, OPEN_DELAY_MS } from "../stores/carousel";
import { clock } from "../stores/clock";
import { cook } from "../stores/cook";
import { recipe } from "../stores/recipe";

function release() {
  if (carousel.up()) setTimeout(() => showDetail(), OPEN_DELAY_MS);
}

function click() {
  if (carousel.click()) setTimeout(() => showDetail(), OPEN_DELAY_MS);
}

function Dot({ index }: { index: number }) {
  return <div class={recipe.index === index ? "dot dot-on" : "dot"} />;
}

// The recipe carousel: swipe or flick (it snaps on a spring), tap a side card
// to bring it over, tap the centre card to open it. Only the centre card and
// its neighbours are mounted; the touch layer is last so it is topmost.
export function RecipesScreen() {
  return (
    <div class="screen">
      <div class="bar enter-1" style={{ left: PAD, top: BAR_Y, width: W - 2 * PAD }}>
        <div class="brand">
          <div class="brand-coal" />
          <span class="t-strong">Ember</span>
          <span class="t-caption">{clock.synced ? clock.time : ""}</span>
        </div>
        <div class="bar-right">
          <div class="oven-dot" />
          <span class="t-caption">{`Oven ${cook.ovenText}`}</span>
          <div class="ghost manual-button" onClick={() => showManual()}>
            <img src="icons/manual.png" />
            <span class="t-strong">Manual</span>
          </div>
        </div>
      </div>

      <div class="stage" style={{ top: STAGE_Y, width: W, height: CARD_H }}>
        {carousel.slots.map((slot) => (
          <div
            class="card"
            style={{
              display: slot.shown ? "flex" : "none",
              left: slot.left,
              top: slot.top,
              width: slot.width,
              height: slot.height,
            }}
          >
            <CardPhoto dish={slot.dish} left={slot.photoLeft} top={slot.photoTop} />
            <div class="card-veil" style={{ opacity: slot.dim }} />
            <Corners />
          </div>
        ))}
      </div>

      <div class="label-area enter-3" style={{ top: LABEL_Y, width: W }}>
        <div class={carousel.flip ? "label label-a" : "label label-b"}>
          <span class="t-title">{recipe.name}</span>
          <div class="meta">
            <img src="icons/clock.png" />
            <span class="t-label">{recipe.timeText}</span>
            <div class="meta-gap" />
            <img src="icons/thermo.png" />
            <span class="t-label">{recipe.tempText}</span>
            <div class="meta-gap" />
            <ModeIcon mode={recipe.mode} on={false} />
            <span class="t-label">{recipe.modeName}</span>
          </div>
        </div>
      </div>

      <div class="dots enter-4" style={{ top: DOTS_Y, width: W }}>
        <Dot index={0} />
        <Dot index={1} />
        <Dot index={2} />
        <Dot index={3} />
        <Dot index={4} />
        <Dot index={5} />
      </div>

      <div
        class="stage-touch"
        style={{ top: STAGE_Y, width: W, height: CARD_H }}
        onPointerDown={(event) => carousel.down(event.clientX)}
        onPointerMove={(event) => carousel.move(event.clientX)}
        onPointerUp={() => release()}
        onClick={() => click()}
      />
    </div>
  );
}
