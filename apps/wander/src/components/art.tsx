import { ART_TOP, artLeft, H, px, W } from "../layout";

// The artwork, one literal <img> per destination (the build embeds each
// source, so it must be a string literal); only the requested one mounts.
// Each is a 480x502 image shown through a panel-sized window (layout.ts).

export function Hero({ place }: { place: number }) {
  return (
    <div class="hero-art" style={{ width: px(W), height: px(H) }}>
      {place === 0 ? <img class="art" style={{ left: px(artLeft(0)), top: px(ART_TOP) }} src="art/kyoto.png" /> : null}
      {place === 1 ? (
        <img class="art" style={{ left: px(artLeft(1)), top: px(ART_TOP) }} src="art/santorini.png" />
      ) : null}
      {place === 2 ? (
        <img class="art" style={{ left: px(artLeft(2)), top: px(ART_TOP) }} src="art/iceland.png" />
      ) : null}
      {place === 3 ? (
        <img class="art" style={{ left: px(artLeft(3)), top: px(ART_TOP) }} src="art/marrakech.png" />
      ) : null}
      {place === 4 ? (
        <img class="art" style={{ left: px(artLeft(4)), top: px(ART_TOP) }} src="art/patagonia.png" />
      ) : null}
    </div>
  );
}

// A local taste (Iceland's is a geothermal soak).
export function FirstThumb({ place }: { place: number }) {
  return (
    <div class="thumb-art">
      {place === 0 ? <img src="art/kyoto-1.png" /> : null}
      {place === 1 ? <img src="art/santorini-1.png" /> : null}
      {place === 2 ? <img src="art/iceland-1.png" /> : null}
      {place === 3 ? <img src="art/marrakech-1.png" /> : null}
      {place === 4 ? <img src="art/patagonia-1.png" /> : null}
    </div>
  );
}

// A landmark detail.
export function SecondThumb({ place }: { place: number }) {
  return (
    <div class="thumb-art">
      {place === 0 ? <img src="art/kyoto-2.png" /> : null}
      {place === 1 ? <img src="art/santorini-2.png" /> : null}
      {place === 2 ? <img src="art/iceland-2.png" /> : null}
      {place === 3 ? <img src="art/marrakech-2.png" /> : null}
      {place === 4 ? <img src="art/patagonia-2.png" /> : null}
    </div>
  );
}
