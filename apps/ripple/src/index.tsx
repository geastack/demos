import { Display, mount } from "@geastack/core";
import "../../../shared";
import { App } from "./app";
import { ripple } from "./lib/ripple";

Display.setAA(4);
mount(App);
ripple.start();
