import { Display, mount } from "@geastack/core";
import "../../../shared";
import { App } from "./app";
import { start } from "./navigation";

Display.setAA(4);
start();
mount(App);
