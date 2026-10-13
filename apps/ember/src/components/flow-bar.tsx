import { BAR_TITLE_X, DEMO_TOP, PAD } from "../layout";
import { closeCooking } from "../navigation";
import { cook } from "../stores/cook";

// The cooking flow's top bar: close (the first press arms it, the second
// stops), what is cooking and where in the flow, and the demo speed chip.
export function FlowBar({ label }: { label: string }) {
  return (
    <div class="flow-bar">
      <div
        class={cook.arming ? "round close-armed" : "round"}
        style={{ left: PAD, top: PAD }}
        onClick={() => closeCooking()}
      >
        <div class="close-row">
          <img src="icons/close.png" />
          {cook.arming ? <span class="t-strong">Tap to stop</span> : null}
        </div>
      </div>

      {cook.arming ? null : (
        <div class="flow-title enter-1" style={{ left: BAR_TITLE_X, top: PAD }}>
          <span class="t-label c-amber">{label}</span>
          <span class="t-strong">{cook.name}</span>
        </div>
      )}

      <div
        class={cook.demo ? "demo demo-on" : "demo"}
        style={{ right: PAD, top: DEMO_TOP }}
        onClick={() => cook.toggleDemo()}
      >
        {cook.demo ? <img src="icons/demo.png" /> : <img src="icons/demo-off.png" />}
        <span class={cook.demo ? "t-label c-amber" : "t-label"}>{cook.demo ? "Demo speed" : "Real time"}</span>
      </div>
    </div>
  );
}
