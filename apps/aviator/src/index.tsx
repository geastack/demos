import { Display, mount } from "@geastack/core";
import "../../../shared";
import { App } from "./app";
import { game } from "./stores/game";

Display.setAA(4);
// The large title text sits over the moving 3D view.
Display.setTextRasterCache(true);
Display.setVSync(false);
mount(App);
game.start();
