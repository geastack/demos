// The WASM simulator ships no GPIO backend, so an app that drives an LED fails
// to link there. These stubs give it the documented "this target has no GPIO"
// answer. On the board the file compiles to nothing and the board backend is used.
#ifdef __EMSCRIPTEN__

#include "host/backends.h"

namespace gea::framework::gpio {

bool GpioBackend::configureOutput(double) { return false; }

bool GpioBackend::configureInput(double, bool) { return false; }

bool GpioBackend::write(double, bool) { return false; }

bool GpioBackend::read(double) { return false; }

}  // namespace gea::framework::gpio

#endif
