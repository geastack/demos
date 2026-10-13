#include "noise.h"
#include "world.h"

#include <cmath>

// The four places: how each shapes its noise into land (a row at a time),
// what it is made of, and the light and sky it sits under. Height units run
// 0..255; one map texel is one unit across.
namespace terra {

namespace {

// ---- Alps: sharp peaks over flat valleys, pine forest, snow, a lake ----

void shapeAlps(float *height, const float *detail, int)
{
	for (int i = 0; i < kFieldSize; ++i) {
		const float base = height[i];
		const float ridges = 1.0f - std::fabs(2.0f * detail[i] - 1.0f);
		const float peaks = base * base + ridges * 0.05f * smoothstep(0.3f, 0.8f, base);
		height[i] = 6.0f + 140.0f * peaks;
	}
}

Rgb alps(const Ground &g)
{
	if (g.water) return mix(Rgb{20, 58, 78}, Rgb{34, 82, 100}, g.detail);

	// Jittered height makes the tree and snow lines ragged.
	const float h = g.height + (g.detail - 0.5f) * 30.0f + g.grain * 3.0f;
	const Rgb meadow = mix(Rgb{84, 132, 46}, Rgb{128, 156, 64}, g.detail);
	const Rgb forest = mix(Rgb{24, 60, 36}, Rgb{40, 80, 44}, 0.5f + 0.5f * g.grain);
	const Rgb rock = mix(Rgb{108, 100, 94}, Rgb{150, 140, 128}, 0.5f + 0.5f * g.grain);
	const Rgb snow{238, 244, 252};

	const float woods = smoothstep(0.42f, 0.58f, g.detail) * (1.0f - smoothstep(90.0f, 120.0f, h));
	Rgb c = mix(meadow, forest, woods);
	c = mix(c, Rgb{156, 146, 122}, 1.0f - smoothstep(19.5f, 23.0f, g.height));
	c = mix(c, rock, std::fmax(smoothstep(1.5f, 2.6f, g.slope), smoothstep(110.0f, 140.0f, h)));
	return mix(c, snow, smoothstep(135.0f, 155.0f, h) * (1.0f - smoothstep(1.8f, 2.8f, g.slope)));
}

// ---- Dunes: long crescent ridges on a rolling erg, low sun ----

void shapeDunes(float *height, const float *, int y)
{
	// Integer wave counts across the map keep the ridges tileable; the smooth
	// base noise and a slow meander bend them into crescents.
	constexpr float kWavesX = 11.0f;
	constexpr float kWavesY = 4.0f;
	constexpr float kWarp = 2.6f;
	constexpr float kMeander = 0.35f;
	constexpr float kCrest = 0.78f;  // share of a wave on the gentle windward side

	const float fy = static_cast<float>(y) / kFieldSize;
	for (int x = 0; x < kFieldSize; ++x) {
		const float base = height[x];
		const float fx = static_cast<float>(x) / kFieldSize;
		const float meander = kMeander * sinTurns(3.0f * fy - 2.0f * fx);
		const float phase = kWavesX * fx + kWavesY * fy + kWarp * base + meander;  // > -1
		const float p = phase + 1.0f - static_cast<float>(static_cast<int>(phase + 1.0f));
		const float windward = sinTurns(0.25f * p / kCrest);
		const float lee = sinTurns(0.25f + 0.25f * (p - kCrest) / (1.0f - kCrest));
		const float profile = p < kCrest ? windward * windward : lee * lee;
		height[x] = 8.0f + 46.0f * base + profile * (6.0f + 18.0f * base);
	}
}

Rgb dunes(const Ground &g)
{
	const float h = g.height + g.grain * 2.0f;
	const Rgb low = mix(Rgb{176, 104, 62}, Rgb{196, 122, 72}, g.detail);
	const Rgb high = mix(Rgb{232, 170, 104}, Rgb{244, 190, 122}, g.detail);
	const Rgb c = mix(low, high, smoothstep(20.0f, 70.0f, h));
	return mix(c, Rgb{150, 92, 60}, smoothstep(1.4f, 2.4f, g.slope) * 0.35f);
}

// ---- Glacier: terraced ice shelves, dark rock at the steps, frozen lake ----

void shapeGlacier(float *height, const float *detail, int)
{
	constexpr float kTerraces = 7.0f;
	for (int i = 0; i < kFieldSize; ++i) {
		const float base = height[i];
		const float t = base * kTerraces;
		const float step = static_cast<float>(static_cast<int>(t));
		const float terrace = (step + smoothstep(0.3f, 0.7f, t - step)) / kTerraces;
		const float shelf = base + (terrace - base) * 0.65f;
		const float lowered = shelf * (0.7f + 0.3f * shelf);  // ~shelf^1.3
		height[i] = 4.0f + 150.0f * lowered + (detail[i] - 0.5f) * 6.0f;
	}
}

Rgb glacier(const Ground &g)
{
	if (g.water) return mix(Rgb{150, 200, 226}, Rgb{178, 218, 236}, g.detail);

	const Rgb snow = mix(Rgb{226, 236, 248}, Rgb{244, 248, 255}, 0.5f + 0.5f * g.grain);
	const Rgb ice = mix(Rgb{104, 170, 222}, Rgb{140, 196, 236}, g.detail);
	const Rgb rock = mix(Rgb{56, 62, 78}, Rgb{84, 88, 104}, 0.5f + 0.5f * g.grain);
	Rgb c = mix(snow, ice, smoothstep(0.35f, 0.9f, g.slope) * 0.8f + (1.0f - smoothstep(20.0f, 40.0f, g.height)) * 0.2f);
	return mix(c, rock, smoothstep(1.3f, 2.2f, g.slope));
}

// ---- Mars: buttes and mesas, impact craters, rust and ochre dust ----

void shapeMars(float *height, const float *detail, int)
{
	for (int i = 0; i < kFieldSize; ++i) {
		const float b = height[i];
		// Stretch one band of the noise into cliffs under flat-topped mesas.
		const float mesa = b < 0.52f ? b * 0.6f : (b < 0.6f ? 0.312f + (b - 0.52f) * 4.0f : 0.632f + (b - 0.6f) * 0.3f);
		height[i] = 10.0f + 150.0f * mesa + (detail[i] - 0.5f) * 5.0f;
	}
}

constexpr int kCraters = 22;

// An impact crater: a bowl with a raised lip, placed by its index.
void crater(float *height, std::uint32_t seed, int index)
{
	noise::Rng rng((seed ^ 0x9E3779B9u) + static_cast<std::uint32_t>(index) * 2654435761u);
	const float cx = rng.unit() * kFieldSize;
	const float cy = rng.unit() * kFieldSize;
	const float size = rng.unit();
	const float radius = 3.0f + 22.0f * size * size;  // field texels
	const float depth = 0.35f * kFieldTexel * radius;
	const float rim = 0.12f * kFieldTexel * radius;
	const int reach = static_cast<int>(radius * 1.8f) + 1;

	for (int dy = -reach; dy <= reach; ++dy) {
		for (int dx = -reach; dx <= reach; ++dx) {
			const float d = std::sqrt(static_cast<float>(dx * dx + dy * dy)) / radius;
			if (d > 1.8f) continue;

			const float bowl = d < 1.0f ? -(1.0f - d * d) * depth : 0.0f;
			const float lip = (d - 1.0f) / 0.22f;
			const int i = noise::index(static_cast<int>(cx) + dx, static_cast<int>(cy) + dy);
			height[i] += bowl + rim * expNeg(lip * lip);
		}
	}
}

Rgb mars(const Ground &g)
{
	const float h = g.height + (g.detail - 0.5f) * 16.0f;
	const Rgb lowland = mix(Rgb{112, 52, 30}, Rgb{136, 64, 36}, g.detail);
	const Rgb highland = mix(Rgb{188, 110, 60}, Rgb{206, 130, 72}, 0.5f + 0.5f * g.grain);
	const Rgb dust{222, 156, 96};
	const Rgb basalt = mix(Rgb{66, 40, 34}, Rgb{88, 54, 42}, 0.5f + 0.5f * g.grain);

	Rgb c = mix(lowland, highland, smoothstep(40.0f, 90.0f, h));
	c = mix(c, dust, (1.0f - smoothstep(0.15f, 0.5f, g.slope)) * smoothstep(0.55f, 0.8f, g.detail) * 0.7f);
	return mix(c, basalt, smoothstep(1.2f, 2.4f, g.slope));
}

// Seeds and suns were picked by eye. Every sun sits within 45 degrees of
// east or west (the shadow sweep runs across columns).
const Landscape kLandscapes[kLandscapeCount] = {
	{
		.seed = 46051u,
		.baseStep = 64,
		.roughness = 0.52f,
		.smoothing = 1,
		.shape = shapeAlps,
		.features = 0,
		.feature = nullptr,
		.waterLevel = 19.0f,
		.material = alps,
		.sunAzimuth = 250.0f,
		.sunElevation = 14.0f,
		.sunLight = {1.05f, 1.0f, 0.9f},
		.ambientLight = {0.5f, 0.56f, 0.7f},
		.zenith = {36, 92, 196},
		.midSky = {92, 156, 228},
		.horizon = {206, 226, 242},
		.haze = {255, 234, 196},
		.sunDisc = {255, 250, 236},
		.waterSky = {150, 190, 226},
	},
	{
		.seed = 23417u,
		.baseStep = 128,
		.roughness = 0.45f,
		.smoothing = 2,
		.shape = shapeDunes,
		.features = 0,
		.feature = nullptr,
		.waterLevel = 0.0f,
		.material = dunes,
		.sunAzimuth = 285.0f,
		.sunElevation = 9.0f,
		.sunLight = {1.15f, 0.95f, 0.74f},
		.ambientLight = {0.5f, 0.42f, 0.56f},
		.zenith = {52, 68, 140},
		.midSky = {150, 128, 172},
		.horizon = {250, 196, 144},
		.haze = {255, 168, 92},
		.sunDisc = {255, 238, 204},
		.waterSky = {250, 196, 144},
	},
	{
		.seed = 78213u,
		.baseStep = 64,
		.roughness = 0.5f,
		.smoothing = 1,
		.shape = shapeGlacier,
		.features = 0,
		.feature = nullptr,
		.waterLevel = 20.0f,
		.material = glacier,
		.sunAzimuth = 110.0f,
		.sunElevation = 5.0f,
		.sunLight = {1.08f, 0.96f, 0.9f},
		.ambientLight = {0.4f, 0.5f, 0.72f},
		.zenith = {40, 64, 132},
		.midSky = {120, 136, 204},
		.horizon = {236, 200, 214},
		.haze = {255, 192, 168},
		.sunDisc = {255, 244, 232},
		.waterSky = {220, 206, 230},
	},
	{
		.seed = 4589u,
		.baseStep = 64,
		.roughness = 0.55f,
		.smoothing = 1,
		.shape = shapeMars,
		.features = kCraters,
		.feature = crater,
		.waterLevel = 0.0f,
		.material = mars,
		.sunAzimuth = 80.0f,
		.sunElevation = 10.0f,
		.sunLight = {1.1f, 1.0f, 0.9f},
		.ambientLight = {0.46f, 0.34f, 0.3f},
		.zenith = {100, 66, 58},
		.midSky = {176, 120, 88},
		.horizon = {226, 178, 134},
		.haze = {172, 198, 230},
		.sunDisc = {232, 242, 255},
		.waterSky = {226, 178, 134},
	},
};

}  // namespace

const Landscape &landscape(int index)
{
	const int clamped = index < 0 ? 0 : (index >= kLandscapeCount ? kLandscapeCount - 1 : index);
	return kLandscapes[clamped];
}

}  // namespace terra
