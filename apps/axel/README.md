# Axel

A camera-aware voice companion for the 480×480 ESP-Mosaico display. Its cyan
dot matrix face blinks, looks around, thinks, and moves its mouth with the
actual speaker amplitude. Tap **Start talking**, point the camera, and ask a
question about what it sees. Tap **Stop** to close the camera, microphone, and
connection. **Camera off** pauses image sharing while leaving voice connected.
Tap **Preview camera** at the top right to show a local live view beside the smaller face;
**Hide camera** restores the large face. Preview preserves the sensor's capture
aspect ratio and samples pixels on a 100 ms cadence using nearest-neighbor
sampling. The actual refresh rate depends on the camera and audio workload.
The native preview corrects the camera's upside-down mounting;
`Camera.orientation` exposes the configured 180° mounting correction, not a live
measurement of the camera hinge. The display and touch
coordinates use Gea's native 90° counterclockwise orientation.
The dot inside **Camera on/off** shows its status: muted when off, green when
ready or sharing, amber while waiting for images, and red on a connection error.

Axel uses native Realtime audio transport and a background worker with
`gpt-realtime-2.1`. Camera images arrive as JPEG image items in the same session,
approximately once every two seconds. Only the newest two image items are kept
in conversation context; frames are skipped when the socket is busy. Frames
do not trigger replies on their own. This is sampled vision, rather than a
video upload.

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

### Configure Axel

Use Mosaico V1.2 with its camera in the left expansion slot (`H2`), a Wi-Fi
network, and an OpenAI API key with access to the configured Realtime model.
Copy the configuration template from the repository root:

```sh
cp apps/axel/.env.example apps/axel/.env
```

On Windows, use `Copy-Item apps/axel/.env.example apps/axel/.env`.
Edit `apps/axel/.env` and fill in all three values:

```dotenv
OPENAI_API_KEY=your-openai-api-key
GEA_WIFI_SSID=your-network-name
GEA_WIFI_PASSWORD=your-network-password
```

Credentials are embedded in firmware. Keep `.env` and build output private and
out of Git. Rebuild and flash after changing these values.

### Build, flash, and monitor

```sh
npx --no-install gea run --board mosaico --app axel
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app axel
npx --no-install gea flash --board mosaico --app axel
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

## Hardware

The current Mosaico kit includes an SC101IOT DVP camera expansion module;
the driver also detects the older OV3640 module. The camera must be in the
left expansion slot (`H2`). See [Espressif's kit FAQ](https://mosaico.espressif.com/guide/faq/)
and [camera module guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s31/esp-mosaico/user_guide_camera.html).

Axel uses full-duplex audio with ESP-SR acoustic echo cancellation. The
echo canceller runs locally during the greeting, but microphone audio is not
uploaded until the greeting finishes playing. Afterward, the microphone remains
active during replies, so you can interrupt Axel by speaking.

The board driver uses Espressif's pinned
`mosaico_module_camera` component to capture DVP frames and the S31 JPEG
hardware to encode an upright image bounded by 320×240 (128×240 for the
SC101IOT, 176×240 for OV3640). Camera work runs off the UI thread.

Axel disables hardware AES and SHA in `sdkconfig.defaults`: camera and audio
occupy the S31 GDMA channels, so TLS uses software cryptography while they run.
The camera retains the SDK's one-second frame timeout, including stream startup.

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Shared fonts retain their SIL Open Font License notices.
