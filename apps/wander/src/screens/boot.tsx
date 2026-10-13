import "../styles/boot.css";
import { Hero } from "../components/art";
import { BOOT_DY, H, px, W } from "../layout";
import { showDiscover } from "../navigation";

// The first two seconds: a sun rises over a drawn horizon, the wordmark and
// tagline rise under it, then the first poster slides up over the paper and
// Discover takes over from the same pose. A tap skips ahead.
export function BootScreen() {
  return (
    <div class="screen" style={{ width: px(W), height: px(H) }} onClick={() => showDiscover()}>
      <div class="boot-mark" style={{ left: px(Math.floor((W - 64) / 2)), top: px(56 + BOOT_DY) }}>
        <div class="boot-sun" />
        <div class="boot-ground" />
        <div class="boot-horizon" />
      </div>
      <div class="boot-row boot-word" style={{ width: px(W), top: px(100 + BOOT_DY) }}>
        <span class="t-wordmark">Wander</span>
      </div>
      <div class="boot-row boot-tagline" style={{ width: px(W), top: px(176 + BOOT_DY) }}>
        <span class="t-body">Go somewhere beautiful</span>
      </div>
      <div class="boot-hero" style={{ width: px(W), height: px(H) }}>
        <Hero place={0} />
      </div>
    </div>
  );
}
