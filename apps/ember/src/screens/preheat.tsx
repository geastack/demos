import "../styles/preheat.css";
import { ModeIcon } from "../components/art";
import { FlowBar } from "../components/flow-bar";
import { ARC_CY, ARC_X, ARC_Y, PREHEAT_COL_Y, PREHEAT_FLOW_X, PREHEAT_STATS_X } from "../layout";
import { cook } from "../stores/cook";
import { ARC_ID, ARC_SIZE } from "../stores/rings";

// Preheat: the big heat arc fills as the oven warms (its inside glows warmer
// and breathes), with the live temperature in the middle; the flow ahead on
// the left, the time left and the setpoint on the right. On reaching the
// setpoint a ring bursts out and the first prompt follows.
export function PreheatScreen() {
  return (
    <div class="screen">
      <FlowBar label={cook.reached ? "Preheated" : "Preheating"} />

      <canvas
        id={ARC_ID}
        class="arc"
        width={ARC_SIZE}
        height={ARC_SIZE}
        style={{ left: ARC_X, top: ARC_Y, width: ARC_SIZE, height: ARC_SIZE }}
      />
      {cook.reached ? (
        <div class="burst" style={{ left: ARC_X, top: ARC_Y, width: ARC_SIZE, height: ARC_SIZE }} />
      ) : null}
      {cook.reached ? (
        <div class="burst burst-late" style={{ left: ARC_X, top: ARC_Y, width: ARC_SIZE, height: ARC_SIZE }} />
      ) : null}

      <div class="arc-mode enter-2" style={{ left: ARC_X, top: ARC_CY - 60, width: ARC_SIZE }}>
        <ModeIcon mode={cook.mode} on={false} />
        <span class="t-label">{cook.modeName}</span>
      </div>
      <div class="arc-readout" style={{ left: ARC_X + 8, top: ARC_CY - 44, width: ARC_SIZE }}>
        <span class="t-hero">{`${cook.tempText}°`}</span>
      </div>
      <div class="arc-target enter-3" style={{ left: ARC_X, top: ARC_CY + 40, width: ARC_SIZE }}>
        <span class={cook.reached ? "t-label c-amber" : "t-caption"}>
          {cook.reached ? "Ready for your food" : `Heating to ${cook.targetText}`}
        </span>
      </div>

      <div class="flow enter-2" style={{ left: PREHEAT_FLOW_X, top: PREHEAT_COL_Y }}>
        {cook.flow.map((row) => (
          <div class={row.shown ? row.cls : "hide"}>
            <div class="flow-dot">{row.done ? <img src="icons/check-small.png" /> : null}</div>
            <span class="t-caption flow-text">{row.text}</span>
          </div>
        ))}
      </div>

      <div class="side-stats enter-3" style={{ left: PREHEAT_STATS_X, top: PREHEAT_COL_Y }}>
        <span class="t-caption">Time left</span>
        <span class="t-number">{cook.etaText}</span>
        <span class="t-caption side-gap">Next</span>
        <span class="t-strong">{cook.nextText}</span>
      </div>
    </div>
  );
}
