import { type GeaCanvasElement, type GeaEmbeddedImage, imageFromId } from "@geastack/core";
import { Controls } from "../lib/controls";
import { Hud } from "../lib/hud";
import { PANEL_H, PANEL_W } from "../lib/layout";
import { clamp, DEGREE, easeOutCubic } from "../lib/motion";
import { HudPainter } from "../lib/painter";
import { Pilot } from "../lib/pilot";
import { PLACES } from "../lib/places";

export const VIEW_ID = "terra-view";
export const VIEW_WIDTH = PANEL_W;
export const VIEW_HEIGHT = PANEL_H;

const USER_BUTTON = 27;
const MAX_DT = 0.05;
const LEAVE_MS = 380; // fog closes in before a landscape switch
const BAKE_BUDGET_MS = 14; // bake time per frame; the sky keeps drawing meanwhile
const ARRIVE_MS = 2200; // fog opens up again as the camera climbs out

// The frame loop: flies the pilot, renders the terrain and the HUD plates
// natively into a surface, then blits it with the HUD text on top.
class Flight {
  readonly controls = new Controls();
  readonly pilot = new Pilot();
  readonly hud = new Hud();

  private surface = -1;
  private image: GeaEmbeddedImage | null = null;
  private painter: HudPainter | null = null;
  private now = 0;
  private place = 0;
  private next = 0;
  private visibility = 0;
  private baking = false;
  private arrivedAt = 0;
  private leavingAt = -1; // -1: not leaving

  start() {
    this.surface = surfaceCreate(VIEW_WIDTH, VIEW_HEIGHT);
    if (this.surface < 0) return;

    this.image = imageFromId(this.surface);
    this.bake(0);
    requestAnimationFrame((timestamp) => this.frame(timestamp));
  }

  select(index: number) {
    if (index === this.place || this.leavingAt >= 0 || this.baking) return;

    this.next = index;
    this.leavingAt = this.now;
    this.hud.selectPlace(index);
  }

  onKey(keyCode: number) {
    if (keyCode === USER_BUTTON) this.select((this.place + 1) % PLACES.length);
  }

  touchDown(id: number, x: number, y: number) {
    const chip = this.hud.chipAt(x, y);
    if (chip < 0) {
      this.controls.down(id, x, y, this.now);
      return;
    }

    this.hud.press(chip, this.now);
    this.select(chip);
  }

  touchMove(id: number, x: number, y: number) {
    this.controls.move(id, x, y);
  }

  touchUp(id: number) {
    this.controls.up(id, this.now);
  }

  // Starts baking a landscape. Its sky shows at once; the terrain is baked a
  // slice per frame behind the fog, under the title card.
  private bake(index: number) {
    terraSelect(index);
    this.place = index;
    this.baking = true;
    this.leavingAt = -1;
    this.visibility = 0;
    this.hud.showTitle();
  }

  // Once baked, the camera drops into the lowest valley and climbs out.
  private advanceBake() {
    if (!this.baking || terraBake(BAKE_BUDGET_MS) === 0) return;

    this.baking = false;
    this.arrivedAt = this.now;
    this.pilot.spawn(terraSpawnX(), terraSpawnY(), PLACES[this.place].startHeading * DEGREE);
    this.hud.releaseTitle(this.now);
  }

  private frame(timestamp: number) {
    const dt = clamp((timestamp - this.now) / 1000, 0, MAX_DT);
    this.now = timestamp;
    this.advanceBake();
    this.updateVisibility();
    this.pilot.fly(dt, timestamp, this.controls);
    this.hud.update(this.pilot.heading / DEGREE, this.pilot.altitude, this.pilot.speed, timestamp);
    this.draw();

    requestAnimationFrame((next) => this.frame(next));
  }

  private updateVisibility() {
    if (this.leavingAt >= 0) {
      const t = clamp((this.now - this.leavingAt) / LEAVE_MS, 0, 1);
      this.visibility = Math.min(this.visibility, 1 - t * t);
      if (t >= 1) this.bake(this.next);
      return;
    }

    if (this.baking) {
      this.visibility = 0;
      return;
    }

    this.visibility = easeOutCubic(clamp((this.now - this.arrivedAt) / ARRIVE_MS, 0, 1));
  }

  // Chrome is queued first: the renderer blends it in as it writes rows.
  private draw() {
    const pilot = this.pilot;
    this.hud.queueChrome(pilot.heading / DEGREE, this.now);
    terraRender(
      this.surface,
      pilot.x,
      pilot.y,
      pilot.heading,
      pilot.altitude,
      pilot.horizon(),
      pilot.bank,
      this.visibility,
    );

    const painter = this.painter ?? this.attach();
    const image = this.image;
    if (painter && image) painter.paint(image, this.hud, pilot.heading / DEGREE, this.now);
  }

  // The canvas exists once the screen has been laid out.
  private attach(): HudPainter | null {
    const canvas = document.getElementById(VIEW_ID) as unknown as GeaCanvasElement | null;
    if (!canvas) return null;

    this.painter = new HudPainter(canvas.getContext("2d"));
    return this.painter;
  }
}

export const flight = new Flight();
