#pragma once

// The board's sensors for TS (see the target's board_sensors.h for native
// access).
namespace disco::sensors {

// Die temperature in °C (NaN without a sensor).
double temperature();
// Supply voltage in volts (NaN where it cannot be measured).
double supply();
// A true random number in [0, 1).
double random();

}  // namespace disco::sensors
