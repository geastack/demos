import "../styles/detail.css";
import { FirstThumb, Hero, SecondThumb } from "../components/art";
import { BACK_TOP, BAND_CLASS, BODY_DY, H, PORTRAIT, px, SHEET_HEIGHT, SHEET_TOP, W } from "../layout";
import { showDiscover } from "../navigation";
import { destination } from "../stores/destination";
import { trips } from "../stores/trips";

// The plan button spans the sheet's left column (216 px), or the whole width on a narrow panel.
const ACTION_W = PORTRAIT ? W - 32 : 216;
const ACTION_TOP = PORTRAIT ? 340 : 124;

function PlanButton() {
  return (
    <div
      class="button"
      style={{ width: px(ACTION_W), backgroundColor: destination.accent }}
      onClick={() => trips.toggle()}
    >
      <span class={destination.inkButton ? "t-button c-ink" : "t-button c-white"}>Plan my trip</span>
      {destination.inkButton ? <img src="icons/arrow-ink.png" /> : <img src="icons/arrow-white.png" />}
    </div>
  );
}

function SavedButton() {
  return (
    <div class="button button-saved" style={{ width: px(ACTION_W) }} onClick={() => trips.toggle()}>
      <div class="saved-check">
        <img src="icons/check.png" />
      </div>
      <span class="t-button saved-label">Saved to your trips</span>
    </div>
  );
}

// Landscape and square: story, facts and the plan button on the left, a taste
// and a sight as cards on the right.
function ColumnsBody() {
  return (
    <div class="body" style={{ top: px(BODY_DY), width: px(W) }}>
      <div class="title-row enter-1">
        <span class="t-title">{destination.name}</span>
        <span class="t-body country">{destination.country}</span>
      </div>
      <div class="story enter-2">
        <span class="t-body">{destination.copyTop}</span>
        <span class="t-body">{destination.copyBottom}</span>
      </div>
      <div class="facts enter-3">
        <div class="fact">
          <img src="icons/season-ink.png" />
          <span class="t-caption c-soft">{destination.season}</span>
        </div>
        <div class="fact">
          <img src="icons/flight-ink.png" />
          <span class="t-caption c-soft">{destination.flight}</span>
        </div>
        <div class="fact">
          <img src="icons/zone-ink.png" />
          <span class="t-caption c-soft">{destination.zone}</span>
        </div>
      </div>

      <div class="card card-first">
        <FirstThumb place={destination.index} />
        <span class="t-label card-label">{destination.firstLabel}</span>
        <span class="t-caption">{destination.firstName}</span>
      </div>
      <div class="card card-second">
        <SecondThumb place={destination.index} />
        <span class="t-label card-label">{destination.secondLabel}</span>
        <span class="t-caption">{destination.secondName}</span>
      </div>

      <div class="action enter-4" style={{ width: px(ACTION_W) }}>
        {trips.focusSaved ? <SavedButton /> : <PlanButton />}
      </div>
    </div>
  );
}

// Portrait: one column; the taste and the sight are full-width rows.
function StackedBody() {
  return (
    <div class="body" style={{ width: px(W) }}>
      <div class="title-row enter-1">
        <span class="t-title">{destination.name}</span>
        <span class="t-body country">{destination.country}</span>
      </div>
      <div class="story enter-2">
        <span class="t-body">{destination.copyTop}</span>
        <span class="t-body">{destination.copyBottom}</span>
      </div>
      <div class="facts enter-3">
        <div class="fact">
          <img src="icons/season-ink.png" />
          <span class="t-caption c-soft">{destination.season}</span>
        </div>
        <div class="fact">
          <img src="icons/flight-ink.png" />
          <span class="t-caption c-soft">{destination.flight}</span>
        </div>
        <div class="fact">
          <img src="icons/zone-ink.png" />
          <span class="t-caption c-soft">{destination.zone}</span>
        </div>
      </div>

      <div class="card-row" style={{ top: px(124), width: px(W - 32 - 8) }}>
        <FirstThumb place={destination.index} />
        <div class="card-text">
          <span class="t-label">{destination.firstLabel}</span>
          <span class="t-body c-ink">{destination.firstName}</span>
        </div>
      </div>
      <div class="card-row card-row-second" style={{ top: px(228), width: px(W - 32 - 8) }}>
        <SecondThumb place={destination.index} />
        <div class="card-text">
          <span class="t-label">{destination.secondLabel}</span>
          <span class="t-body c-ink">{destination.secondName}</span>
        </div>
      </div>

      <div class="action enter-4" style={{ top: px(ACTION_TOP), width: px(ACTION_W) }}>
        {trips.focusSaved ? <SavedButton /> : <PlanButton />}
      </div>
    </div>
  );
}

// The poster lifts into a top band while a cream sheet rises over it.
export function DetailScreen() {
  return (
    <div class="screen" style={{ width: px(W), height: px(H) }}>
      <div class={BAND_CLASS} style={{ width: px(W), height: px(H) }}>
        <Hero place={destination.index} />
      </div>

      <div class="sheet" style={{ top: px(SHEET_TOP), width: px(W), height: px(SHEET_HEIGHT) }}>
        <div class="handle" style={{ left: px(Math.floor((W - 36) / 2)) }} />
        {PORTRAIT ? <StackedBody /> : <ColumnsBody />}
      </div>

      <div
        class="back"
        style={{ top: px(BACK_TOP), backgroundColor: destination.pill, borderColor: destination.pillEdge }}
        onClick={() => showDiscover()}
      >
        <img src="icons/back.png" />
      </div>
    </div>
  );
}
