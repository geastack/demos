import "../styles/ready.css";
import { Hero } from "../components/art";
import { Glow } from "../components/glow";
import { GLOW_X, GLOW_Y, HERO_H, HERO_X, PAD, READY_BADGE_Y, READY_COPY_Y, W } from "../layout";
import { doneCooking } from "../navigation";
import { cook } from "../stores/cook";

// Ember sparks drifting up over the dish, on staggered loops.
function Sparks() {
  return (
    <div class="sparks" style={{ left: HERO_X }}>
      <div class="spark-dot sd-1" />
      <div class="spark-dot sd-2" />
      <div class="spark-dot sd-3" />
      <div class="spark-dot sd-4" />
      <div class="spark-dot sd-5" />
      <div class="spark-dot sd-6" />
      <div class="spark-dot sd-7" />
      <div class="spark-dot sd-8" />
      <div class="spark-dot sd-9" />
      <div class="spark-dot sd-10" />
    </div>
  );
}

// The Ready moment: the dish pushes in, a check pops in a burst of rings,
// sparks rise, and "Ready" settles with a summary. Done returns to the
// recipe; Keep warm holds the oven at 70 °C.
export function ReadyScreen() {
  return (
    <div class="screen">
      {cook.manual ? <Glow place="glow-ready" left={GLOW_X} top={GLOW_Y} /> : null}
      {cook.manual ? null : (
        <div class="push-in" style={{ width: W, height: HERO_H }}>
          <Hero dish={cook.dish} />
        </div>
      )}
      <Sparks />

      <div class="badge-burst" style={{ left: PAD, top: READY_BADGE_Y }} />
      <div class="badge-burst badge-burst-late" style={{ left: PAD, top: READY_BADGE_Y }} />
      <div class="badge" style={{ left: PAD, top: READY_BADGE_Y }}>
        <img src="icons/check.png" />
      </div>

      <div class="ready-copy" style={{ left: PAD, top: READY_COPY_Y }}>
        <span class="t-display ready-word">Ready</span>
        <span class="t-strong enter-3">{cook.manual ? cook.name : `${cook.name} · Enjoy`}</span>
        <span class="t-caption enter-4">{cook.summaryText}</span>
      </div>

      <div class="ready-actions lift-2" style={{ left: PAD, bottom: PAD }}>
        <div class="cta" onClick={() => doneCooking()}>
          <span class="t-button">Done</span>
        </div>
        <div class={cook.keepWarm ? "ghost warm warm-on" : "ghost warm"} onClick={() => cook.toggleKeepWarm()}>
          <div class={cook.keepWarm ? "warm-dot warm-dot-on" : "warm-dot"} />
          <span class="t-strong">{cook.keepWarm ? "Keeping warm" : "Keep warm"}</span>
        </div>
      </div>
    </div>
  );
}
