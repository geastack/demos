# GeaStack demos

Showcase demos written once in TypeScript and run natively on very different
microcontroller boards, each laying itself out for the screen it is on.
Current deployment targets:

- **ESP32-S31 Mosaico** — 480x480
- **ESP32-S3 AMOLED 2.06"** — 410x502
The original **STM32F746G-Discovery** layout (480x272) is retained, but this
repository does not provide an STM32 deployment target.

Every demo is its own package under `apps/` with a `gea` manifest in its
`package.json`, like [geastack/examples](https://github.com/geastack/examples).
`shared/` holds fonts, styles and shared native modules. The 3D demos use
[`@geastack/gea3d`](https://github.com/geastack/gea3d), installed from npm
and licensed GPL-3.0-only.

| Demo | What it is |
|---|---|
| [bloom](apps/bloom) | Reaction-diffusion |
| [neon](apps/neon) | Synthwave 3D runner |
| [ripple](apps/ripple) | Multi-touch fluid |
| [reel](apps/reel) | Demoscene reel |
| [terra](apps/terra) | Voxel terrain flyover |
| [intro](apps/intro) | Animated GeaStack logo opener |
| [lantern](apps/lantern) | Paper-boat river journey on gea3d |
| [aviator](apps/aviator) | The Aviator, on gea3d |
| [orbit](apps/orbit) | 3D showcase on gea3d |
| [wander](apps/wander) | Travel inspiration with generated artwork |
| [nimbus](apps/nimbus) | Weather station over an illustrated town |
| [sonora](apps/sonora) | Smart speaker / music player |
| [ember](apps/ember) | Smart oven with guided cooking |
| [axel](apps/axel) | Camera-aware voice companion for Mosaico, with a dot matrix face |

The demos started life in the STM32F746G-Discovery gallery.

## On the STM32F746G-Discovery

Framebuffer grabs from the board (480x272), taken in the original gallery.

| Demo | Screens |
|---|---|
| [bloom](apps/bloom) | <img src="docs/shots/stm32f746g-disco/bloom-coral.png" width="300" alt="bloom coral"> |
| [neon](apps/neon) | <img src="docs/shots/stm32f746g-disco/neon-title.png" width="300" alt="neon title"> <img src="docs/shots/stm32f746g-disco/neon-run.png" width="300" alt="neon run"> |
| [ripple](apps/ripple) | <img src="docs/shots/stm32f746g-disco/ripple-bloom.png" width="300" alt="ripple bloom"> <img src="docs/shots/stm32f746g-disco/ripple-ink.png" width="300" alt="ripple ink"> |
| [reel](apps/reel) | <img src="docs/shots/stm32f746g-disco/reel-rotozoom.png" width="300" alt="reel rotozoom"> <img src="docs/shots/stm32f746g-disco/reel-vortex.png" width="300" alt="reel vortex"> |
| [terra](apps/terra) | <img src="docs/shots/stm32f746g-disco/terra-alps.png" width="300" alt="terra alps"> <img src="docs/shots/stm32f746g-disco/terra-dunes.png" width="300" alt="terra dunes"> |
| [intro](apps/intro) | <img src="docs/shots/stm32f746g-disco/intro-traces.png" width="300" alt="intro traces"> <img src="docs/shots/stm32f746g-disco/intro-spark.png" width="300" alt="intro spark"> <img src="docs/shots/stm32f746g-disco/intro-final.png" width="300" alt="intro final"> |
| [lantern](apps/lantern) | <img src="docs/shots/stm32f746g-disco/lantern-run.png" width="300" alt="lantern run"> <img src="docs/shots/stm32f746g-disco/lantern-end.png" width="300" alt="lantern end"> |
| [aviator](apps/aviator) | <img src="docs/shots/stm32f746g-disco/aviator-fly.png" width="300" alt="aviator fly"> <img src="docs/shots/stm32f746g-disco/aviator-over.png" width="300" alt="aviator over"> |
| [orbit](apps/orbit) | <img src="docs/shots/stm32f746g-disco/orbit.png" width="300" alt="orbit"> |
| [wander](apps/wander) | <img src="docs/shots/stm32f746g-disco/wander-discover.png" width="300" alt="wander discover"> <img src="docs/shots/stm32f746g-disco/wander-detail.png" width="300" alt="wander detail"> |
| [nimbus](apps/nimbus) | <img src="docs/shots/stm32f746g-disco/nimbus-now.png" width="300" alt="nimbus now"> <img src="docs/shots/stm32f746g-disco/nimbus-week.png" width="300" alt="nimbus week"> |
| [sonora](apps/sonora) | <img src="docs/shots/stm32f746g-disco/sonora-playing.png" width="300" alt="sonora playing"> <img src="docs/shots/stm32f746g-disco/sonora-browse.png" width="300" alt="sonora browse"> |
| [ember](apps/ember) | <img src="docs/shots/stm32f746g-disco/ember-recipes.png" width="300" alt="ember recipes"> <img src="docs/shots/stm32f746g-disco/ember-cook.png" width="300" alt="ember cook"> |

## Working here

Install the released dependencies from the repository root:

```sh
npm ci
npx --no-install gea setup
npx --no-install gea boards list
npx --no-install gea run --board mosaico --app lantern
npx --no-install gea screenshot --board mosaico
```

Register the board as `mosaico` during setup. Mosaico needs ESP-IDF 6.2-dev
with ESP32-S31 support. Each app's README includes toolchain installation,
board registration, build, flash, monitor and capture steps. Follow that
README before the first deployment; Axel also needs network and API credentials.

- [docs/PORTING.md](docs/PORTING.md): boards, responsive rules, build/flash flow.
- [docs/APP-GUIDE.md](docs/APP-GUIDE.md): engine rules, fast TypeScript, design bar.

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
