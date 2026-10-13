import type { PcmAudioStreamConstructor } from "@geastack/core";

declare global {
  const process: {
    readonly env: { readonly OPENAI_API_KEY: string };
  };
  const PcmAudioStream: PcmAudioStreamConstructor;
}
