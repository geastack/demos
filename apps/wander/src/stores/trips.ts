import { Store } from "@geastack/core";

const STORAGE_KEY = "wander.trips";

// Saved trips, persisted as a comma-separated list of destination indices.
class TripsStore extends Store {
  count = 0;
  // Whether the destination open in Detail is saved.
  focusSaved = false;

  private saved: boolean[] = [false, false, false, false, false];
  private focusIndex = 0;

  init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const indices = stored ? stored.split(",") : [];
    for (const index of indices) {
      this.saved[Number(index)] = true;
    }

    this.count = indices.length;
  }

  focus(index: number) {
    this.focusIndex = index;
    this.focusSaved = this.saved[index];
  }

  toggle() {
    const saved = !this.saved[this.focusIndex];
    this.saved[this.focusIndex] = saved;
    this.focusSaved = saved;
    this.count = this.count + (saved ? 1 : -1);
    this.persist();
  }

  private persist() {
    const indices: string[] = [];
    for (let i = 0; i < this.saved.length; i++) {
      if (this.saved[i]) indices.push(String(i));
    }

    localStorage.setItem(STORAGE_KEY, indices.join(","));
  }
}

export const trips = new TripsStore();
