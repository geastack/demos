import { Display, mount } from "@geastack/core";
import "../../../shared";
import { App } from "./app";
import { start } from "./navigation";
import { carousel } from "./stores/carousel";
import { destination } from "./stores/destination";
import { trips } from "./stores/trips";

Display.setAA(4);
destination.init();
trips.init();
carousel.init();
start();
mount(App);
