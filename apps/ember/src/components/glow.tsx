// A warm glow without blur: three stacked opaque discs. `place` is the class
// that positions it (and may animate it).
export function Glow({ place, left, top }: { place: string; left: number; top: number }) {
  return (
    <div class={`glow ${place}`} style={{ left: left, top: top }}>
      <div class="glow-disc glow-outer" />
      <div class="glow-disc glow-middle" />
      <div class="glow-disc glow-inner" />
    </div>
  );
}
