import { Display, mount } from "@geastack/core";
import "../../../shared";
import { App } from "./app";
import { bloom } from "./lib/bloom";

Display.setAA(4);
mount(App);
bloom.start();
