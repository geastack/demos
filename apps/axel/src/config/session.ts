export interface TurnDetectionConfig {
  type: "semantic_vad" | "server_vad";
  eagerness?: "low" | "medium" | "high" | "auto";
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  create_response: boolean;
  interrupt_response: boolean;
}

export interface RealtimeSessionConfig {
  type: "realtime";
  model: string;
  max_output_tokens?: number;
  instructions: string;
  audio: {
    input: {
      format: { type: "audio/pcm"; rate: 24000 };
      noise_reduction: { type: "far_field" };
      transcription: { model: string; language?: string; prompt?: string };
      turn_detection: TurnDetectionConfig;
    };
    output: { format: { type: "audio/pcm"; rate: 24000 }; voice: string; speed: number };
  };
}

export const AXEL_INSTRUCTIONS = `You are Axel, a curious, warm visual companion. Speak naturally. You receive occasional camera images, not a continuous video feed. Treat them as quiet background context: mention or describe what you see only when the user asks about it. When they do, ground your answer in the newest image, say when details are unclear, and never invent things outside the frame. Never suggest tilting, moving, turning or repositioning the camera, or changing the view so you can see more, unless the user asks how to get a better view.

Give complete answers in one or two brief sentences, within about fifteen seconds of speech. Listen to the actual question and avoid narrating every new image. For a larger topic, explain one useful part and offer to continue. You have no external tools: do not claim to have sent messages, saved reminders, or checked live facts.

A conversation starts when the user says your wake phrase, "Hey Axel"; follow-ups in that conversation need no wake phrase. Answer what the user says; do not comment on the wake phrase itself.`;

// Axel replies only to an utterance that opens with its wake phrase. The
// transcript is approximate, so accept the spellings it tends to produce.
// Quiet speech transcribes loosely: look for the name among the first few
// words, with or without the greeting before it.
export const WAKE_PHRASE =
  /^\W*(?:\S+\W+){0,3}?(?:(?:hey|hi|hay|ey)\W+(?:accel|excel|hexel)|axel|axl|axle|axil|aksel|aksal|ax[ei]l+)\b/i;

export function createSessionConfig(
  cameraEnabled = true,
  // The server never answers on its own: the session replies only after the
  // transcript shows the wake phrase, or inside an open conversation.
  turnDetection: TurnDetectionConfig = {
    type: "server_vad",
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 600,
    create_response: false,
    interrupt_response: true,
  },
): string {
  const session: RealtimeSessionConfig = {
    type: "realtime",
    model: "gpt-realtime-2.1",
    max_output_tokens: 480,
    instructions: `${AXEL_INSTRUCTIONS}\n\n${
      cameraEnabled
        ? "The camera is on. New images arrive periodically; use them only to answer questions about what you see."
        : "The camera is off. You cannot see the current environment. Do not describe a live view or rely on earlier images; explain that the camera must be enabled for visual questions."
    }`,
    audio: {
      input: {
        format: { type: "audio/pcm", rate: 24000 },
        noise_reduction: { type: "far_field" },
        transcription: { model: "gpt-4o-mini-transcribe", language: "en", prompt: "Hey Axel," },
        turn_detection: turnDetection,
      },
      output: {
        format: { type: "audio/pcm", rate: 24000 },
        voice: "marin",
        speed: 1,
      },
    },
  };

  return JSON.stringify(session);
}
