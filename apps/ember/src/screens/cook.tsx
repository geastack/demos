import "../styles/cook.css";
import { ModeIcon } from "../components/art";
import { FlowBar } from "../components/flow-bar";
import { ADD } from "../data/recipes";
import {
  CONTENT_W,
  LAND,
  PAD,
  PROMPT_ART_X,
  PROMPT_ART_Y,
  PROMPT_COPY_W,
  PROMPT_COPY_X,
  PROMPT_COPY_Y,
  SEGMENTS_Y,
  STEP_CONTROLS_Y,
  STEP_COPY_Y,
  TIMER_SIZE,
  TIMER_X,
  TIMER_Y,
} from "../layout";
import { cook, PROMPT } from "../stores/cook";
import { TIMER_ID } from "../stores/rings";

// A timed step: what to expect on the left with pause and +1 min, the
// countdown ring on the right.
function TimedStep() {
  return (
    <div class="step-body">
      <div
        class={`${cook.flip ? "step-copy slide-a" : "step-copy slide-b"}${LAND ? "" : " copy-center"}`}
        style={{ left: PAD, top: STEP_COPY_Y, width: LAND ? 256 : CONTENT_W }}
      >
        <span class="t-title">{cook.title}</span>
        <span class="t-body step-detail">{cook.detail}</span>
        <div class="step-chips">
          <ModeIcon mode={cook.mode} on={false} />
          <span class="t-label">{cook.modeName}</span>
          <div class="chip-gap" />
          <img src="icons/thermo.png" />
          <span class="t-label">{`Oven ${cook.ovenText}`}</span>
        </div>
      </div>

      <div
        class={LAND ? "step-controls enter-3" : "step-controls controls-center enter-3"}
        style={{ left: PAD, top: STEP_CONTROLS_Y, width: LAND ? 256 : CONTENT_W }}
      >
        <div class="ghost control" onClick={() => cook.togglePause()}>
          {cook.paused ? <img src="icons/play.png" /> : <img src="icons/pause.png" />}
          <span class="t-strong">{cook.paused ? "Resume" : "Pause"}</span>
        </div>
        <div class="ghost control" onClick={() => cook.addMinute()}>
          <img src="icons/plus.png" />
          <span class="t-strong">1 min</span>
        </div>
      </div>

      <canvas
        id={TIMER_ID}
        class="timer-ring"
        width={TIMER_SIZE}
        height={TIMER_SIZE}
        style={{ left: TIMER_X, top: TIMER_Y, width: TIMER_SIZE, height: TIMER_SIZE }}
      />
      <div class="timer-readout" style={{ left: TIMER_X, top: TIMER_Y + TIMER_SIZE / 2 - 32, width: TIMER_SIZE }}>
        <span class={cook.paused ? "t-timer timer-paused" : "t-timer"}>{cook.timeText}</span>
      </div>
      <div class="timer-caption" style={{ left: TIMER_X, top: TIMER_Y + TIMER_SIZE / 2 + 24, width: TIMER_SIZE }}>
        <span class={cook.paused ? "t-label c-amber" : "t-caption"}>
          {cook.paused ? "Paused" : `of ${cook.totalText}`}
        </span>
      </div>
    </div>
  );
}

// A prompt waits for the cook: an animated tile (food going in, or turning),
// what to do, and the button that carries on.
function PromptStep() {
  return (
    <div class="step-body">
      <div
        class={cook.flip ? "prompt-art pop-a" : "prompt-art pop-b"}
        style={{ left: PROMPT_ART_X, top: PROMPT_ART_Y }}
      >
        <div class="prompt-glow-outer" />
        <div class="prompt-glow-inner" />
        <div class="prompt-ring" />
        <div class="prompt-tile">
          {cook.promptKind === ADD ? <img class="prompt-oven" src="icons/oven.png" /> : null}
          {cook.promptKind === ADD ? <img class="prompt-drop" src="icons/drop.png" /> : null}
          {cook.promptKind === ADD ? null : <img class="prompt-flip" src="icons/flip.png" />}
        </div>
      </div>

      <div
        class={`${cook.flip ? "prompt-copy slide-a" : "prompt-copy slide-b"}${LAND ? "" : " copy-center"}`}
        style={{ left: PROMPT_COPY_X, top: PROMPT_COPY_Y, width: PROMPT_COPY_W }}
      >
        <span class="t-label c-amber">{cook.promptKind === ADD ? "The oven is ready" : "Your move"}</span>
        <span class="t-title prompt-title">{cook.title}</span>
        <span class="t-body">{cook.detail}</span>
        <div class={LAND ? "prompt-actions" : "prompt-actions controls-center"}>
          <div class="cta" onClick={() => cook.confirm()}>
            <span class="t-button">{cook.promptAction}</span>
            <img src="icons/arrow.png" />
          </div>
          <span class="t-caption">{`Holding ${cook.targetText}`}</span>
        </div>
      </div>
    </div>
  );
}

// The guided steps after the preheat: a segment per step across the top,
// then the step itself. The bar is last: the full-screen step body would
// otherwise cover its buttons in hit testing.
export function CookScreen() {
  return (
    <div class="screen">
      <div class="segments enter-1" style={{ left: PAD, top: SEGMENTS_Y, width: CONTENT_W }}>
        {cook.segments.map((segment) => (
          <div class={segment.shown ? segment.cls : "hide"} style={{ width: cook.segmentWidth }}>
            <div class="segment-fill" style={{ width: segment.fill }} />
          </div>
        ))}
      </div>
      {cook.phase === PROMPT ? <PromptStep /> : <TimedStep />}
      <FlowBar label={cook.stepLabel} />
    </div>
  );
}
