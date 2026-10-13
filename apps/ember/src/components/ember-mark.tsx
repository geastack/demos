// The Ember mark: a glowing coal in a thin ring.
export function EmberMark({ place, left, top }: { place: string; left: number; top: number }) {
  return (
    <div class={`mark ${place}`} style={{ left: left, top: top }}>
      <div class="mark-coal" />
    </div>
  );
}
