import { Display, mount } from "@geastack/core";
import "../../../shared";
import { App } from "./app";
import { start } from "./navigation";
import { clock } from "./stores/clock";
import { player } from "./stores/player";
import { sleep } from "./stores/sleep";
import { tint } from "./stores/tint";
import { volume } from "./stores/volume";

Display.setAA(4);
tint.init();
player.init();
volume.init();
sleep.init();
clock.init();
start();
mount(App);
