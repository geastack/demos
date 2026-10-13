#include "sensors.h"

#include <cmath>
#include <cstdint>

#if defined(ESP_PLATFORM)
// ESP32 family: the die temperature sensor driver (S3, S31 and the other chips
// with SOC_TEMP_SENSOR_SUPPORTED), esp_random() for the hardware generator.
// Supply voltage has no on-chip measurement here: NaN, which TS hides.
#include "esp_random.h"
#include "sdkconfig.h"
#include "soc/soc_caps.h"

#if defined(SOC_TEMP_SENSOR_SUPPORTED) && SOC_TEMP_SENSOR_SUPPORTED
#include "driver/temperature_sensor.h"
#define DISCO_HAS_TSENS 1
#endif

namespace disco::sensors {

#if defined(DISCO_HAS_TSENS)
namespace {
temperature_sensor_handle_t g_tsens = nullptr;
bool g_tsens_tried = false;

// Installed and enabled once, on first use; a failure leaves the reading NaN.
void ensureSensor()
{
	if (g_tsens_tried) return;

	g_tsens_tried = true;
	temperature_sensor_config_t config = TEMPERATURE_SENSOR_CONFIG_DEFAULT(-10, 80);
	if (temperature_sensor_install(&config, &g_tsens) != ESP_OK) {
		g_tsens = nullptr;
		return;
	}
	if (temperature_sensor_enable(g_tsens) != ESP_OK) {
		temperature_sensor_uninstall(g_tsens);
		g_tsens = nullptr;
	}
}
}  // namespace
#endif

double temperature()
{
#if defined(DISCO_HAS_TSENS)
	ensureSensor();
	if (g_tsens) {
		float celsius = 0.0f;
		if (temperature_sensor_get_celsius(g_tsens, &celsius) == ESP_OK) return static_cast<double>(celsius);
	}
#endif
	return std::nan("");
}

double supply() { return std::nan(""); }

double random() { return static_cast<double>(esp_random()) / 4294967296.0; }

}  // namespace disco::sensors

#elif defined(__EMSCRIPTEN__) || defined(__APPLE__) || defined(__linux__) || defined(_WIN32)
// Web simulator (WASM) and desktop hosts: no die temperature or supply
// measurement exists, so both read NaN -- the same "no reading" the ESP32 path
// returns where the chip cannot measure, and the contract natives.d.ts states.
// Random comes from the platform's entropy source: std::random_device, which
// Emscripten backs with the browser's crypto.getRandomValues.
#include <random>

namespace disco::sensors {

double temperature() { return std::nan(""); }

double supply() { return std::nan(""); }

double random()
{
	static std::random_device device;
	return static_cast<double>(device()) / 4294967296.0;
}

}  // namespace disco::sensors

#else
// STM32: the target's board_sensors.h.
#include "board_sensors.h"

namespace disco::sensors {

double temperature() { return gea::stm32::sensors::temperatureC(); }

double supply() { return gea::stm32::sensors::supplyVolts(); }

double random() { return static_cast<double>(gea::stm32::sensors::random32()) / 4294967296.0; }

}  // namespace disco::sensors
#endif
