import { Store } from "@geastack/core";
import { PLACES } from "../data/places";

// The destination on show, copied into flat fields for the templates.
class DestinationStore extends Store {
  index = 0;
  name = "";
  country = "";
  tagline = "";
  season = "";
  flight = "";
  price = "";
  zone = "";
  copyTop = "";
  copyBottom = "";
  firstLabel = "";
  firstName = "";
  secondLabel = "";
  secondName = "";
  accent = "";
  inkButton = false;
  ink = "";
  soft = "";
  pill = "";
  pillEdge = "";

  init() {
    this.select(0);
  }

  select(index: number) {
    const place = PLACES[index];
    this.index = index;
    this.name = place.name;
    this.country = place.country;
    this.tagline = place.tagline;
    this.season = place.season;
    this.flight = place.flight;
    this.price = place.price;
    this.zone = place.zone;
    this.copyTop = place.copyTop;
    this.copyBottom = place.copyBottom;
    this.firstLabel = place.firstLabel;
    this.firstName = place.firstName;
    this.secondLabel = place.secondLabel;
    this.secondName = place.secondName;
    this.accent = place.accent;
    this.inkButton = place.inkButton;
    this.ink = place.ink;
    this.soft = place.soft;
    this.pill = place.pill;
    this.pillEdge = place.pillEdge;
  }
}

export const destination = new DestinationStore();
