import { Display, mount } from "@geastack/core";
import "../../../shared";
import { App } from "./app";
import { start } from "./navigation";
import { bootView } from "./render/boot";
import { renderer } from "./render/renderer";
import { sky } from "./render/sky";
import { todayView } from "./render/today";
import { forecast } from "./stores/forecast";
import { indoor } from "./stores/indoor";
import { week } from "./stores/week";

Display.setAA(4);

// The sky first: the forecast sets its opening scene.
sky.init();
week.init();
forecast.init();
indoor.init();
todayView.init();
bootView.start();
start();
mount(App);
renderer.start();
