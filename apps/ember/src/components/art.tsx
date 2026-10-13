import { CARD_H, CARD_W, HERO_X, HERO_Y } from "../layout";

// The photography, one literal <img> per dish (the build embeds each source,
// so it must be a string literal); only the requested one mounts.

/** A carousel photo, placed inside its card window by left/top. */
export function CardPhoto({ dish, left, top }: { dish: number; left: number; top: number }) {
  return (
    <div class="card-photo" style={{ left: left, top: top, width: CARD_W, height: CARD_H }}>
      {dish === 0 ? <img class="fill" src="art/card-chicken.png" /> : null}
      {dish === 1 ? <img class="fill" src="art/card-pizza.png" /> : null}
      {dish === 2 ? <img class="fill" src="art/card-sourdough.png" /> : null}
      {dish === 3 ? <img class="fill" src="art/card-salmon.png" /> : null}
      {dish === 4 ? <img class="fill" src="art/card-lasagna.png" /> : null}
      {dish === 5 ? <img class="fill" src="art/card-lava-cake.png" /> : null}
    </div>
  );
}

/** Full-bleed: the dish on the right, the left third fading into the background. */
export function Hero({ dish }: { dish: number }) {
  return (
    <div class="hero" style={{ left: HERO_X, top: HERO_Y }}>
      {dish === 0 ? <img src="art/hero-chicken.png" /> : null}
      {dish === 1 ? <img src="art/hero-pizza.png" /> : null}
      {dish === 2 ? <img src="art/hero-sourdough.png" /> : null}
      {dish === 3 ? <img src="art/hero-salmon.png" /> : null}
      {dish === 4 ? <img src="art/hero-lasagna.png" /> : null}
      {dish === 5 ? <img src="art/hero-lava-cake.png" /> : null}
    </div>
  );
}

/** A 56 px rounded tile, baked on the card surface. */
export function Thumb({ dish }: { dish: number }) {
  return (
    <div class="thumb">
      {dish === 0 ? <img src="art/thumb-chicken.png" /> : null}
      {dish === 1 ? <img src="art/thumb-pizza.png" /> : null}
      {dish === 2 ? <img src="art/thumb-sourdough.png" /> : null}
      {dish === 3 ? <img src="art/thumb-salmon.png" /> : null}
      {dish === 4 ? <img src="art/thumb-lasagna.png" /> : null}
      {dish === 5 ? <img src="art/thumb-lava-cake.png" /> : null}
    </div>
  );
}

/** The four background-coloured corner masks that round a card window. */
export function Corners() {
  return (
    <div class="corners">
      <img class="corner corner-tl" src="art/corner-tl.png" />
      <img class="corner corner-tr" src="art/corner-tr.png" />
      <img class="corner corner-bl" src="art/corner-bl.png" />
      <img class="corner corner-br" src="art/corner-br.png" />
    </div>
  );
}

/** The oven mode's icon, in the chip-off colour or ink for a lit chip. */
export function ModeIcon({ mode, on }: { mode: number; on: boolean }) {
  return (
    <div class="mode-icon">
      {mode === 0 && !on ? <img src="icons/bake.png" /> : null}
      {mode === 0 && on ? <img src="icons/bake-on.png" /> : null}
      {mode === 1 && !on ? <img src="icons/convection.png" /> : null}
      {mode === 1 && on ? <img src="icons/convection-on.png" /> : null}
      {mode === 2 && !on ? <img src="icons/grill.png" /> : null}
      {mode === 2 && on ? <img src="icons/grill-on.png" /> : null}
      {mode === 3 && !on ? <img src="icons/airfry.png" /> : null}
      {mode === 3 && on ? <img src="icons/airfry-on.png" /> : null}
    </div>
  );
}
