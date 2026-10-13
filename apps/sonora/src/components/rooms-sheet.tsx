import "../styles/overlays.css";
import { H, ROOM_W, SHEET_PAD, SHEET_ROOMS_Y, W } from "../layout";
import { player } from "../stores/player";
import { BEDROOM, KITCHEN, LIVING, ROOM_NAMES, ROOM_SPEAKERS, rooms } from "../stores/rooms";
import { shell } from "../stores/shell";
import { tint } from "../stores/tint";
import { MiniEq } from "./mini-eq";

// The card's corner: a spinner while the music moves to a room, a check once
// it has, and the playing room's equaliser.
function RoomState({ room }: { room: number }) {
  return (
    <div class="room-state">
      {rooms.connecting === room ? (
        <div class="spinner-box">
          <div class="spinner" style={{ borderColor: tint.accent }} />
          <div class="spinner-orbit">
            <div class="spinner-dot" style={{ backgroundColor: tint.accent }} />
          </div>
        </div>
      ) : null}
      {rooms.joined === room ? (
        <div class="joined" style={{ backgroundColor: tint.accent }}>
          <img src="icons/check.png" />
        </div>
      ) : null}
      {rooms.active === room && rooms.joined !== room ? <MiniEq playing={player.playing} /> : null}
    </div>
  );
}

function RoomCard({ room, slot }: { room: number; slot: string }) {
  return (
    <div class={`room ${slot}`} style={{ width: ROOM_W }} onClick={() => rooms.pick(room)}>
      {rooms.active === room ? <div class="room-ring" style={{ width: ROOM_W, borderColor: tint.accent }} /> : null}
      <div class="room-head">
        {room === LIVING ? <img src="icons/living.png" /> : null}
        {room === KITCHEN ? <img src="icons/kitchen.png" /> : null}
        {room === BEDROOM ? <img src="icons/bedroom.png" /> : null}
        <RoomState room={room} />
      </div>
      <span class="t-strong">{ROOM_NAMES[room]}</span>
      <span class="t-caption">{rooms.active === room ? "Playing here" : ROOM_SPEAKERS[room]}</span>
    </div>
  );
}

// "Play on": a sheet with the three speakers; tap one to move the music there.
export function RoomsSheet() {
  return (
    <div class="overlay">
      <div class={shell.closing ? "scrim scrim-out" : "scrim"} onClick={() => shell.dismiss()} />
      <div
        class={shell.closing ? "sheet sheet-rooms sheet-out" : "sheet sheet-rooms sheet-in"}
        style={{ top: SHEET_ROOMS_Y, height: H - SHEET_ROOMS_Y + 20 }}
      >
        <div class="sheet-glass" style={{ backgroundColor: tint.bg }}>
          <div class="handle" style={{ left: Math.floor(W / 2) - 18 }} />
          <div class="sheet-head" style={{ left: SHEET_PAD }}>
            <span class="t-title">Play on</span>
            <span class="t-caption">3 speakers · home Wi-Fi</span>
          </div>
          <div class="rooms" style={{ left: SHEET_PAD }}>
            <RoomCard room={LIVING} slot="lift-1" />
            <RoomCard room={KITCHEN} slot="lift-2" />
            <RoomCard room={BEDROOM} slot="lift-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
