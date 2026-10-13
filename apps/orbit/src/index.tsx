import { Display, mount } from "@geastack/core";
import "../../../shared";
import { App } from "./app";
import { orbit } from "./lib/orbit";

Display.setAA(4);
mount(App);
orbit.start();
