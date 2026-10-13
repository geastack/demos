import { Display, mount } from "@geastack/core";
import "../../../shared";
import { App } from "./app";
import { intro } from "./stores/intro";

Display.setAA(4);
mount(App);
intro.start();
