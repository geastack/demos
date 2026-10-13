import "../styles/discover.css";
import { Hero } from "../components/art";
import { CHIPS_TOP, COPY_TOP, DOTS_TOP, H, HERO_FONT, px, RETURN_CLASS, SAVED_TOP, STACKED, W } from "../layout";
import { showDetail } from "../navigation";
import { carousel } from "../stores/carousel";
import { destination } from "../stores/destination";
import { DETAIL, shell } from "../stores/shell";
import { trips } from "../stores/trips";

function release() {
  if (carousel.up()) showDetail();
}

function click() {
  if (carousel.click()) showDetail();
}

// Title and tagline in the sky; mounts (and rises) when the strip lands.
function HeroCopy() {
  return (
    <div class="copy" style={{ top: px(COPY_TOP) }}>
      <span class={HERO_FONT} style={{ color: destination.ink }}>
        {destination.name}
      </span>
      <span class="t-body copy-tagline" style={{ color: destination.soft }}>
        {destination.tagline}
      </span>
    </div>
  );
}

// Opaque dark-glass pills: season, flight time and price level.
function HeroChips() {
  return (
    <div class="chips" style={{ top: px(CHIPS_TOP) }}>
      <div class="pill chip chip-1" style={{ backgroundColor: destination.pill, borderColor: destination.pillEdge }}>
        <img src="icons/season.png" />
        <span class="t-caption c-light">{destination.season}</span>
      </div>
      <div class="pill chip chip-2" style={{ backgroundColor: destination.pill, borderColor: destination.pillEdge }}>
        <img src="icons/flight.png" />
        <span class="t-caption c-light">{`${destination.flight} flight`}</span>
      </div>
      <div class="pill chip chip-3" style={{ backgroundColor: destination.pill, borderColor: destination.pillEdge }}>
        <img src="icons/price.png" />
        <span class="t-caption c-light">{destination.price}</span>
      </div>
    </div>
  );
}

// The active dot stretches into a bar that fills over the attract countdown.
function Dot({ index }: { index: number }) {
  return (
    <div class={destination.index === index ? "dot dot-on" : "dot"}>
      {destination.index === index && carousel.counting ? <div class="dot-fill" /> : null}
    </div>
  );
}

// Right-aligned on the chips' row, or (narrow panels) centred on a row of its own.
function Dots() {
  if (STACKED) {
    return (
      <div class="dots-row" style={{ top: px(DOTS_TOP), width: px(W) }}>
        <div class="pill dots-centred" style={{ backgroundColor: destination.pill, borderColor: destination.pillEdge }}>
          <Dot index={0} />
          <Dot index={1} />
          <Dot index={2} />
          <Dot index={3} />
          <Dot index={4} />
        </div>
      </div>
    );
  }

  return (
    <div
      class="pill dots"
      style={{ top: px(DOTS_TOP), backgroundColor: destination.pill, borderColor: destination.pillEdge }}
    >
      <Dot index={0} />
      <Dot index={1} />
      <Dot index={2} />
      <Dot index={3} />
      <Dot index={4} />
    </div>
  );
}

// Full-bleed posters on a two-slot strip. Swipe to travel, tap to open; left
// alone it advances every 7 s. The touch layer is last so it is topmost.
export function DiscoverScreen() {
  return (
    <div class="screen" style={{ width: px(W), height: px(H) }}>
      <div class={shell.previous === DETAIL ? RETURN_CLASS : "stage"} style={{ width: px(W), height: px(H) }}>
        <div class="slot" style={{ width: px(W), height: px(H), transform: `translate(${carousel.leftX}px, 0px)` }}>
          <Hero place={carousel.leftPlace} />
        </div>
        <div
          class="slot"
          style={{
            width: px(W),
            height: px(H),
            display: carousel.rightShown ? "flex" : "none",
            transform: `translate(${carousel.rightX}px, 0px)`,
          }}
        >
          <Hero place={carousel.rightPlace} />
        </div>
      </div>

      {carousel.settled ? <HeroCopy /> : null}

      {carousel.settled && trips.count > 0 ? (
        <div
          class="pill saved"
          style={{ top: px(SAVED_TOP), backgroundColor: destination.pill, borderColor: destination.pillEdge }}
        >
          <img src="icons/bookmark.png" />
          <span class="t-caption c-light">{`${trips.count} saved`}</span>
        </div>
      ) : null}

      {carousel.settled ? <HeroChips /> : null}

      <Dots />

      <div
        class="touch"
        style={{ width: px(W), height: px(H) }}
        onPointerDown={(event) => carousel.down(event.clientX)}
        onPointerMove={(event) => carousel.move(event.clientX)}
        onPointerUp={() => release()}
        onClick={() => click()}
      />
    </div>
  );
}
