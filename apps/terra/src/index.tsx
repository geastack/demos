import { Display, mount } from "@geastack/core";
import "../../../shared";
import { App } from "./app";
import { flight } from "./stores/flight";

Display.setAA(4);
// Flight runs near 30 fps; a fixed rate keeps the pacing even.
Display.setFrameRate(30);
flight.start();
mount(App);
