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
      turn_detection: TurnDetectionConfig;
    };
    output: { format: { type: "audio/pcm"; rate: 24000 }; voice: string; speed: number };
  };
}

export const AXEL_INSTRUCTIONS = `You are Axel, a curious, warm visual companion on a small camera device. Speak naturally and help the user understand what they point the camera at. You receive occasional camera images, not a continuous video feed: ground visual observations in the newest image, say when details are unclear, and never invent things outside the frame. Ask the user to move the camera closer when necessary.

Give complete answers in one or two brief sentences, within about fifteen seconds of speech. Listen to the actual question and avoid narrating every new image. For a larger topic, explain one useful part and offer to continue. You have no external tools: do not claim to have sent messages, saved reminders, or checked live facts.`;

export function createSessionConfig(
  cameraEnabled = true,
  turnDetection: TurnDetectionConfig = {
    type: "server_vad",
    threshold: 0.75,
    prefix_padding_ms: 300,
    silence_duration_ms: 600,
    create_response: true,
    interrupt_response: true,
  },
): string {
  const session: RealtimeSessionConfig = {
    type: "realtime",
    model: "gpt-realtime-2.1",
    max_output_tokens: 480,
    instructions: `${AXEL_INSTRUCTIONS}\n\n${
      cameraEnabled
        ? "The camera is on. New images arrive periodically; describe the view only when an image is available."
        : "The camera is off. You cannot see the current environment. Do not describe a live view or rely on earlier images; explain that the camera must be enabled for visual questions."
    }`,
    audio: {
      input: {
        format: { type: "audio/pcm", rate: 24000 },
        noise_reduction: { type: "far_field" },
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
