import "../styles/overlays.css";
import { H, SHEET_PAD, SHEET_SLEEP_Y, W } from "../layout";
import { shell } from "../stores/shell";
import { SLEEP_LABELS, sleep } from "../stores/sleep";
import { tint } from "../stores/tint";

// The chosen duration fills with the accent and pops.
function Option({ choice }: { choice: number }) {
  return (
    <div class="option-place">
      {sleep.choice === choice ? (
        <div class="option option-on" style={{ backgroundColor: tint.accent }} onClick={() => sleep.pick(choice)}>
          <span class="t-strong c-ink">{SLEEP_LABELS[choice]}</span>
        </div>
      ) : (
        <div class="option glass" onClick={() => sleep.pick(choice)}>
          <span class="t-strong">{SLEEP_LABELS[choice]}</span>
        </div>
      )}
    </div>
  );
}

// The sleep timer: a short sheet of durations; the pick pops, the sheet goes.
export function SleepSheet() {
  return (
    <div class="overlay">
      <div class={shell.closing ? "scrim scrim-out" : "scrim"} onClick={() => shell.dismiss()} />
      <div
        class={shell.closing ? "sheet sheet-sleep sheet-out" : "sheet sheet-sleep sheet-in"}
        style={{ top: SHEET_SLEEP_Y, height: H - SHEET_SLEEP_Y + 20 }}
      >
        <div class="sheet-glass" style={{ backgroundColor: tint.bg }}>
          <div class="handle" style={{ left: Math.floor(W / 2) - 18 }} />
          <div class="sheet-head" style={{ left: SHEET_PAD }}>
            <span class="t-title">Sleep timer</span>
            <span class="t-caption">{sleep.badge === "" ? "Pause the music after" : `${sleep.badge} left`}</span>
          </div>
          <div class="options lift-1" style={{ left: SHEET_PAD, width: W - 2 * SHEET_PAD }}>
            <Option choice={0} />
            <Option choice={1} />
            <Option choice={2} />
            <Option choice={3} />
            <Option choice={4} />
          </div>
        </div>
      </div>
    </div>
  );
}
