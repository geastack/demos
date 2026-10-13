import "../styles/manual.css";
import { ModeIcon } from "../components/art";
import { AIR_FRY, BAKE, CONVECTION, GRILL, MODE_NAMES } from "../data/recipes";
import {
  ARC_X,
  BAR_TITLE_X,
  BOTTOM_ROW_Y,
  CHIP_H,
  CHIP_W,
  CONTENT_W,
  DIAL_CY,
  DIAL_Y,
  LAND,
  MANUAL_END_Y,
  MODES_H,
  MODES_W,
  MODES_X,
  MODES_Y,
  PAD,
  W,
} from "../layout";
import { showRecipes } from "../navigation";
import { cook } from "../stores/cook";
import { manual } from "../stores/manual";
import { ARC_ID, ARC_SIZE } from "../stores/rings";

function ModeChip({ mode }: { mode: number }) {
  return (
    <div
      class={LAND ? "mode-chip" : "mode-chip mode-chip-big"}
      style={{ width: CHIP_W, height: CHIP_H }}
      onClick={() => manual.setMode(mode)}
    >
      <ModeIcon mode={mode} on={manual.mode === mode} />
      <span class={manual.mode === mode ? "t-label c-ink" : "t-label"}>{MODE_NAMES[mode]}</span>
    </div>
  );
}

function TimerButtons() {
  return (
    <div class="timer-buttons">
      <div class="round step-button" onClick={() => manual.changeTimer(-1)}>
        <img src="icons/minus.png" />
      </div>
      <div class="round step-button step-plus" onClick={() => manual.changeTimer(1)}>
        <img src="icons/plus.png" />
      </div>
    </div>
  );
}

// Manual mode: drag the dial around the heat arc to set the temperature (the
// arc follows on a spring and its inside glows warmer), pick a mode chip
// (the highlight slides over), set the timer, start.
export function ManualScreen() {
  return (
    <div class="screen">
      <canvas
        id={ARC_ID}
        class="dial"
        width={ARC_SIZE}
        height={ARC_SIZE}
        style={{ left: ARC_X, top: DIAL_Y, width: ARC_SIZE, height: ARC_SIZE }}
      />
      <div class="round" style={{ left: PAD, top: PAD }} onClick={() => showRecipes()}>
        <img src="icons/back.png" />
      </div>
      <div class="flow-title enter-1" style={{ left: BAR_TITLE_X, top: PAD }}>
        <span class="t-label c-amber">Manual</span>
        <span class="t-strong">Set your oven</span>
      </div>
      <span class="t-caption oven-now enter-1" style={{ right: PAD, top: PAD + 12 }}>
        {`Oven ${cook.ovenText}`}
      </span>

      <div class="dial-mode enter-2" style={{ left: ARC_X, top: DIAL_CY - 58, width: ARC_SIZE }}>
        <span class="t-label">{MODE_NAMES[manual.mode]}</span>
      </div>
      <div class={manual.readoutCls} style={{ left: ARC_X + 8, top: DIAL_CY - 44, width: ARC_SIZE }}>
        <span class="t-hero">{`${manual.tempText}°`}</span>
      </div>
      <div class="dial-hint enter-3" style={{ left: ARC_X, top: DIAL_CY + 40, width: ARC_SIZE }}>
        <span class="t-caption">Drag to set</span>
      </div>
      <div class="knob" style={{ left: manual.knobX, top: manual.knobY }}>
        <div class="knob-core" />
      </div>

      {LAND ? (
        <div class="timer-set enter-2">
          <span class="t-caption">Timer</span>
          <span class="t-number">{manual.timerText}</span>
          <TimerButtons />
          <span class="t-caption timer-end">{manual.endText}</span>
        </div>
      ) : (
        <div class="timer-end-row enter-2" style={{ top: MANUAL_END_Y, width: W }}>
          <span class="t-caption">{manual.endText}</span>
        </div>
      )}
      {LAND ? null : (
        <div class="timer-row enter-3" style={{ left: PAD, top: BOTTOM_ROW_Y, width: CONTENT_W }}>
          <div class="timer-label">
            <span class="t-caption">Timer</span>
            <span class="t-number">{manual.timerText}</span>
          </div>
          <TimerButtons />
        </div>
      )}

      <div
        class={LAND ? "modes enter-3" : "modes modes-grid enter-3"}
        style={{ left: MODES_X, top: MODES_Y, width: MODES_W, height: MODES_H }}
      >
        <div
          class={LAND ? "mode-highlight" : "mode-highlight mode-highlight-big"}
          style={{ left: manual.highlightLeft, top: manual.highlightTop, width: CHIP_W, height: CHIP_H }}
        />
        <ModeChip mode={BAKE} />
        <ModeChip mode={CONVECTION} />
        <ModeChip mode={GRILL} />
        <ModeChip mode={AIR_FRY} />
      </div>

      <div class="manual-start lift-2" style={LAND ? { right: PAD, bottom: PAD } : { right: PAD, top: BOTTOM_ROW_Y }}>
        <div class="cta" onClick={() => manual.start()}>
          <span class="t-button">Start</span>
          <img src="icons/arrow.png" />
        </div>
      </div>

      <div
        class="dial-touch"
        style={{ left: ARC_X, top: DIAL_Y, width: ARC_SIZE, height: ARC_SIZE }}
        onPointerDown={(event) => manual.point(event.clientX, event.clientY, true)}
        onPointerMove={(event) => manual.point(event.clientX, event.clientY, false)}
        onPointerUp={() => manual.release()}
      />
    </div>
  );
}
