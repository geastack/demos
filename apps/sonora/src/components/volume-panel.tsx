import "../styles/overlays.css";
import { H, PILL_H, PILL_Y, VOL_W, VOL_X } from "../layout";
import { rooms } from "../stores/rooms";
import { shell } from "../stores/shell";
import { tint } from "../stores/tint";
import { ICON_HIGH, ICON_LOW, ICON_MUTE, volume } from "../stores/volume";

// The volume overlay: it slides over the right column with the level as a big
// numeral and a tall pill whose accent fill follows the finger. Drag anywhere
// on it (or on the art) vertically; it slides away shortly after.
export function VolumePanel() {
  return (
    <div
      class={shell.closing ? "volume volume-out" : "volume volume-in"}
      style={{ left: VOL_X, width: VOL_W, height: H, backgroundColor: tint.bg }}
    >
      <span class="t-caption volume-caption" style={{ top: PILL_Y + 16 }}>
        Volume
      </span>
      <span class="t-hero volume-number" style={{ top: PILL_Y + 30 }}>
        {String(volume.shown)}
      </span>
      <span class="t-caption volume-room" style={{ top: PILL_Y + PILL_H - 12 }}>
        {rooms.name}
      </span>

      <div class="volume-pill" style={{ top: PILL_Y, height: PILL_H }}>
        <div
          class="volume-fill"
          style={{ height: volume.fill, backgroundColor: volume.shown === 0 ? tint.accentSoft : tint.accent }}
        />
        <div class="volume-icon">
          {volume.icon === ICON_MUTE ? <img src="icons/vol-mute.png" /> : null}
          {volume.icon === ICON_LOW ? <img src="icons/vol-low.png" /> : null}
          {volume.icon === ICON_HIGH ? <img src="icons/vol-high.png" /> : null}
        </div>
      </div>

      <div
        class="volume-touch"
        style={{ width: VOL_W, height: H }}
        onPointerDown={(event) => volume.grab(event.clientY)}
        onPointerMove={(event) => volume.drag(event.clientY)}
        onPointerUp={() => volume.release()}
      />
    </div>
  );
}
