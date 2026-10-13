import "../styles/idle.css";
import { EmberMark } from "../components/ember-mark";
import { Glow } from "../components/glow";
import {
  IDLE_COPY_W,
  IDLE_COPY_X,
  IDLE_COPY_Y,
  IDLE_GLOW_X,
  IDLE_GLOW_Y,
  IDLE_MARK_X,
  IDLE_MARK_Y,
  LAND,
} from "../layout";
import { showRecipes } from "../navigation";
import { clock } from "../stores/clock";
import { cook } from "../stores/cook";

// The attract state after a quiet minute: a breathing ember, the time and a
// greeting. Any touch wakes it.
export function IdleScreen() {
  return (
    <div class="screen" onClick={() => showRecipes()}>
      <Glow place="glow-idle" left={IDLE_GLOW_X} top={IDLE_GLOW_Y} />
      <EmberMark place="mark-idle" left={IDLE_MARK_X} top={IDLE_MARK_Y} />
      <div
        class={LAND ? "idle-copy" : "idle-copy copy-center"}
        style={{ left: IDLE_COPY_X, top: IDLE_COPY_Y, width: IDLE_COPY_W }}
      >
        {clock.synced ? <span class="t-hero">{clock.time}</span> : <span class="t-display">Ember</span>}
        <span class="t-title idle-greeting">{clock.greeting}</span>
        <span class="t-caption">{`What shall we cook? · Oven ${cook.ovenText}`}</span>
      </div>
    </div>
  );
}
