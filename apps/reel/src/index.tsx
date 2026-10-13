import { Display, mount } from "@geastack/core";
import "../../../shared";
import { App } from "./app";
import { reel } from "./stores/reel";

Display.setAA(4);
mount(App);
reel.start();
