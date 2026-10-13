import "../styles/boot.css";
import { Glow } from "../components/glow";
import { BOOT_X, BOOT_Y } from "../layout";
import { showRecipes } from "../navigation";

// The first two seconds: the glow blooms, the coal ignites in its ring and
// sparks drift up, the wordmark and tagline rise, and an ember line draws
// beneath them. A tap skips ahead.
export function BootScreen() {
  return (
    <div class="screen" onClick={() => showRecipes()}>
      <div class="boot-stage" style={{ left: BOOT_X, top: BOOT_Y }}>
        <Glow place="glow-boot" left={144} top={-16} />
        <div class="spark spark-a" />
        <div class="spark spark-b" />
        <div class="spark spark-c" />
        <div class="boot">
          <div class="mark mark-boot">
            <div class="mark-coal" />
          </div>
          <span class="t-display boot-word">Ember</span>
          <span class="t-body boot-tagline">Guided cooking, perfected</span>
          <div class="boot-line" />
        </div>
      </div>
    </div>
  );
}
