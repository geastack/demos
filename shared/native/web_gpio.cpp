// Intentionally empty. The WASM simulator used to ship no GPIO backend, and this
// file supplied the "this target has no GPIO" stubs so an app that drives an LED
// still linked there. The framework now provides that fallback itself
// (host/gpio_unavailable.cpp, built for every target without a GPIO driver), and
// a second copy here is a duplicate-symbol link error. The file stays so the
// apps that list it in gea.nativeSources keep building unchanged.
