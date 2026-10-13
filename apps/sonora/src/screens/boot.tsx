import "../styles/boot.css";
import { BOOT_X, BOOT_Y } from "../layout";
import { showNow } from "../navigation";
import { player } from "../stores/player";

function skip() {
  if (!player.playing) player.toggle();
  showNow();
}

// The first two seconds: five equaliser bars bounce up inside two rippling
// rings, then the wordmark and the tagline rise beneath. A tap skips ahead.
export function BootScreen() {
  return (
    <div class="screen boot" onClick={() => skip()}>
      <div class="boot-stage" style={{ left: BOOT_X, top: BOOT_Y }}>
        <div class="boot-ring boot-ring-1" />
        <div class="boot-ring boot-ring-2" />
        <div class="boot-mark">
          <div class="boot-bar boot-bar-1" />
          <div class="boot-bar boot-bar-2" />
          <div class="boot-bar boot-bar-3" />
          <div class="boot-bar boot-bar-4" />
          <div class="boot-bar boot-bar-5" />
        </div>
        <div class="boot-row boot-word">
          <span class="t-word">Sonora</span>
        </div>
        <div class="boot-row boot-tagline">
          <span class="t-body">Sound for every room</span>
        </div>
      </div>
    </div>
  );
}
