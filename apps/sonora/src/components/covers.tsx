import { ART_FLOW, ART_NP, ART_SIDE } from "../stores/flow";

// The album art, one literal <img> per album and size (the build embeds each
// source, so it must be a string literal); only the requested one mounts.
// Each image fills its box: at its own size it blits 1:1, smaller it scales.

/** 192 px, Now Playing. */
export function NowCover({ album }: { album: number }) {
  return (
    <div class="cover">
      {album === 0 ? <img class="cover-img" src="art/np-1.png" /> : null}
      {album === 1 ? <img class="cover-img" src="art/np-2.png" /> : null}
      {album === 2 ? <img class="cover-img" src="art/np-3.png" /> : null}
      {album === 3 ? <img class="cover-img" src="art/np-4.png" /> : null}
      {album === 4 ? <img class="cover-img" src="art/np-5.png" /> : null}
      {album === 5 ? <img class="cover-img" src="art/np-6.png" /> : null}
    </div>
  );
}

/** 144 px, the cover flow's centre and the queue's now-playing card. */
export function FlowCover({ album }: { album: number }) {
  return (
    <div class="cover">
      {album === 0 ? <img class="cover-img" src="art/flow-1.png" /> : null}
      {album === 1 ? <img class="cover-img" src="art/flow-2.png" /> : null}
      {album === 2 ? <img class="cover-img" src="art/flow-3.png" /> : null}
      {album === 3 ? <img class="cover-img" src="art/flow-4.png" /> : null}
      {album === 4 ? <img class="cover-img" src="art/flow-5.png" /> : null}
      {album === 5 ? <img class="cover-img" src="art/flow-6.png" /> : null}
    </div>
  );
}

/** 96 px, the cover flow's neighbours. */
export function SideCover({ album }: { album: number }) {
  return (
    <div class="cover">
      {album === 0 ? <img class="cover-img" src="art/side-1.png" /> : null}
      {album === 1 ? <img class="cover-img" src="art/side-2.png" /> : null}
      {album === 2 ? <img class="cover-img" src="art/side-3.png" /> : null}
      {album === 3 ? <img class="cover-img" src="art/side-4.png" /> : null}
      {album === 4 ? <img class="cover-img" src="art/side-5.png" /> : null}
      {album === 5 ? <img class="cover-img" src="art/side-6.png" /> : null}
    </div>
  );
}

/** 32 px, queue rows and the ambient card. */
export function ThumbCover({ album }: { album: number }) {
  return (
    <div class="cover">
      {album === 0 ? <img class="cover-img" src="art/thumb-1.png" /> : null}
      {album === 1 ? <img class="cover-img" src="art/thumb-2.png" /> : null}
      {album === 2 ? <img class="cover-img" src="art/thumb-3.png" /> : null}
      {album === 3 ? <img class="cover-img" src="art/thumb-4.png" /> : null}
      {album === 4 ? <img class="cover-img" src="art/thumb-5.png" /> : null}
      {album === 5 ? <img class="cover-img" src="art/thumb-6.png" /> : null}
    </div>
  );
}

/** A cover flow slot: the image size that scales down to the slot's size. */
export function SlotCover({ album, art }: { album: number; art: number }) {
  return (
    <div class="cover">
      {art === ART_NP ? <NowCover album={album} /> : null}
      {art === ART_FLOW ? <FlowCover album={album} /> : null}
      {art === ART_SIDE ? <SideCover album={album} /> : null}
    </div>
  );
}
