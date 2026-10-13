# Nimbus

The touch UI of a home weather station: the same hillside town illustrated
in six weathers (clear day, sunset, clear night, overcast, rain, snow), alive
with drifting clouds, rain, snow, twinkling stars and a breathing sun or moon
glow, under glass panels with the current conditions, an hourly strip you can
scrub, a seven-day outlook, the sun's arc and live readings from the board.

## Run on a board

Install Git, Node.js 22.18+ (22.x) or 24+, npm, Python 3, CMake and Ninja.
Run these commands from the **demos repository root**.

```sh
git clone https://github.com/geastack/demos.git
cd demos
npm ci
```

Connect a powered-on board with a USB data cable.

### Set up Mosaico

Mosaico requires ESP-IDF **6.2-dev** with ESP32-S31 support. Install its toolchain
into the directory Gea searches for this target:

```sh
npx --no-install gea setup --esp-idf --idf-version master --idf-dir "$HOME/esp32/esp-idf-v6.2-dev"
npx --no-install gea setup
```

In the second command, choose **Known supported board**, select **ESP32-S31
Mosaico**, select its USB identity, and save the alias as **mosaico**. If setup
offers to build or flash an app, you can skip that step and use the commands
below. On Windows, use a native
PowerShell terminal and `$env:USERPROFILE/esp32/esp-idf-v6.2-dev` in place of
`$HOME/esp32/esp-idf-v6.2-dev`.

Confirm the saved board and check the toolchain:

```sh
npx --no-install gea boards show mosaico
npx --no-install gea doctor
```

### Build, flash, and monitor

```sh
npx --no-install gea run --board mosaico --app nimbus
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app nimbus
npx --no-install gea flash --board mosaico --app nimbus
npx --no-install gea monitor --board mosaico
```

`flash` builds before flashing. Stop the monitor before using another command
that accesses the board's USB connection. To capture the screen:

```sh
npx --no-install gea screenshot --board mosaico
```

If Gea requests download mode because the running firmware cannot accept an
update, hold **BOOT** while resetting or powering on the board, then release it
once the downloader connects. Gea resolves the saved board identity.

### Use the AMOLED 2.06 instead

Run `npx --no-install gea setup`, choose the supported AMOLED 2.06 board and its
USB identity, and save the alias as **amoled**. Follow setup's ESP-IDF installation
prompt for that board. Then run:

```sh
npx --no-install gea run --board amoled --app nimbus
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## Screens

- **Boot** (~2 s): on night blue a sun rises behind a paper cloud, "Nimbus"
  and "Weather, at home" rise under it, then the scene fades in and the
  readings rise into place. Tap to skip.
- **Now**: the clock, the temperature (80 px Outfit ExtraLight, rolling
  through the degrees when it changes), the condition, feels-like and the
  day's high/low, and glass chips for wind, humidity and (when likely) rain or
  snow. Along the bottom the hourly strip: drag to scrub (it follows the
  finger and rubber-bands at the ends), fling to glide, tap an hour to bring
  it into the focus slot. The hour in the slot drives the whole screen: the
  scene cross-fades to that hour's weather, the numeral rolls, a tag shows
  the hour. Midnight is marked with tomorrow's weekday.
- **Next 7 days** (calendar button): a sheet rises with each day's condition,
  chance of rain or snow, and its low-to-high bar on the week's range, cut
  from one week-wide gradient (cold, mild or warm); today's bar has a "now"
  dot. Rows rise in one after another.
- **Today** (sun-horizon button): the sun's arc from sunrise to sunset, with
  the sun travelling to the current time and the dots behind it lighting up,
  time to sunset (or sunrise) and the day length; beside it **Live from this
  device**: the MCU's die temperature from `Board.temperature()` (labelled as
  the chip's temperature, not the room's), a 24-second sparkline, and the
  supply voltage from `Board.supplyVoltage()`.
- **Demo** (play button): steps through six moments, one per scene, every
  7 s (a bar under the button fills toward the next): a summer day at 11:24,
  an autumn day at 10:12 and 15:36, the summer evening at 20:31 and 23:08,
  and a winter morning at 09:40. Tap again to stop.

Tap above an open sheet, its close button or the USER button to close it;
the USER button otherwise glides the strip back to now. After 45 s untouched
the app closes panels and returns to now.

## How it works

- **One canvas, nothing else drawing** (`src/render`): every frame redraws
  the illustration, the weather layers and the whole UI into a full-screen
  canvas. A retained node over a full-screen canvas forces a compositing
  copy, and on the board canvas-plus-overlay frames showed half-drawn
  overlays, so text, glass and icons are painted with `fillText`,
  `drawImage` and `fillRect`; a transparent layer on top takes the touches
  (`src/navigation.ts` hit-tests them).
- **Glass**: the canvas has no rounded rectangles and a translucent
  rectangle plus circles double-blends where they overlap, so pills, the
  focus slot and the sheet's corners are pre-drawn alpha pieces
  (`scripts/make-glass.py`) joined by rectangles of the same tone; alphas
  are multiples of 0.2 so both land on the same byte.
- **Sky** (`src/render/sky.ts`): a new scene cross-fades in (700 ms) while
  each layer (sun, moon, stars, golden-hour glow, rain, snow, a navy wash for
  wet nights, five cloud tints) eases toward the new look's level, so a
  scrub across sunset, night and rain blends layer by layer. Clouds are
  paper-cut sprites (`scripts/make-clouds.py`) drifting at their own speeds;
  stars twinkle from a sine table; a shooting star crosses every ~10 s.
- **Data** (`src/data/weather.ts`): three deterministic days (summer, autumn,
  winter), each an hourly condition track, a temperature curve, wind,
  humidity, sunrise/sunset and a seven-day outlook; scenes follow from the
  condition and the sun (golden hour at the sunrise and sunset hours).

## Assets

- `public/art/`: the six scenes, generated with OpenAI `gpt-image-1` by
  `scripts/generate-art.py` (it reads `OPENAI_API_KEY` from the environment),
  cropped to 480x272 and dithered to RGB565 by the same script.
- `public/sky/` (clouds) and `public/ui/` (glass pieces) are drawn by the
  two Python scripts; `npm run icons` renders the Phosphor icons in
  `icons.config.json`, in dark ink and white.

## Not yet

- Frame rate is 22-28 fps on the calm scenes and 15-17 fps with rain or
  snow, not 60: alpha blending of the large glass areas and per-call canvas
  overhead dominate. Pre-blending the glass bands per scene and batching the
  snow would be the next steps.

## Boards and layout

One codebase, three panel shapes. `src/layout.ts` reads `window.innerWidth/innerHeight`
once; every position derives from it (the canvas, the buttons, hero numeral, chips,
strip, sheets, boot, and where the sun, moon, glow, stars and clouds sit).

| Panel | Shape | Now | Panels |
|---|---|---|---|
| 480x272 (STM32F746G-Discovery, not buildable yet) | landscape | the original: hero 80 px at y 24, strip at y 204 | week sheet 220 px (7 x 24 px rows), Today side by side (220 px) |
| 480x480 (mosaico) | square | hero 112 px (`font-hero-l`) at y 40, condition, details and chips stacked under it, strip at the bottom over the town | week sheet 7 x 32 px rows, Today side by side (236 px) |
| 410x502 (amoled) | portrait, rounded corners | as square, content 14 px lower, strip 14 px above the bottom edge | week narrower track (114 px), Today stacked: sun arc, then this device (424 px) |

480x272 worked out from the same code: `WIDE` is true, so the hero font is 80 px at
y 24 (`HERO_Y`), condition 118, details 146, chips 170 (`HERO_LINE` 94), the strip
at 272 - 68 = 204, `ROW_H` 24 and `WEEK_H` 220, `TODAY_H` 220 side by side
(`STACKED` false), the week track `W - 296` = 184 px, and the scene at
`SCENE_Y = 0` shows the original 480x272 art. That is the original design, number
for number.

Artwork: each scene is one 480x502 image, the 480x272 scene at the bottom and a
synthetic sky above it (`scripts/extend-art.py`; flat gradient or mirrored top band
per scene). The panel shows its bottom `H` rows and middle `W` columns; the sun,
moon halo, golden-hour glow and clouds are positioned against `SCENE_X/SCENE_Y`
(where the original scene lands), stars and the shooting star spread over the
extended sky. The build reports 58% of the app partition free.

The amoled layout was reviewed by arithmetic only (the canvas does not draw in the
DOM simulator and the board was taken off limits before it could be flashed).

## Live from this device

The Today panel's readings come from `shared/native/sensors.cpp` (listed in
`nativeSources`, bound by `native/plugin.mjs`): on ESP32 the die temperature from
ESP-IDF's `driver/temperature_sensor.h` (installed and enabled on first use, guarded
by `SOC_TEMP_SENSOR_SUPPORTED`, so it builds for the S3 and the S31), the supply
voltage is NaN (the row is hidden), on the STM32 the target's `board_sensors.h`.
`gea.targets.esp32` adds `esp_driver_tsens` and `-Wl,-u,` for the four sensor calls
(the app archive links after the IDF components). Native sources make the build use
the full runtime instead of the canvas-only one.

## Performance

- mosaico (480x480): PRODFPS 24 on the calm scene (full runtime, native sensors).
- amoled: not measured (board not flashed).

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
