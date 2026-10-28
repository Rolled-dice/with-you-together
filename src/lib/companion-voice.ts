import { z } from "zod";

export const VOICE_LANGUAGES = [
  { code: "en-IN", label: "English (India)" },
  { code: "en-US", label: "English (US)" },
  { code: "hi-IN", label: "Hindi" },
] as const;

export const voiceLanguageSchema = z.enum(["en-IN", "en-US", "hi-IN"]);
export type VoiceLanguage = z.infer<typeof voiceLanguageSchema>;
export const MAX_VOICE_SECONDS = 120;
export const MAX_VOICE_BYTES = 3 * 1024 * 1024;
export const MAX_COMPANION_TEXT = 8000;

export class VoiceTranscriptionError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "VoiceTranscriptionError";
  }
}

export const transcriptionSchema = z.object({
  text: z.string().max(MAX_COMPANION_TEXT),
});

export function appendDictation(draft: string, spoken: string) {
  const words = spoken.trim();
  if (!words) return draft;
  return `${draft}${draft && !/\s$/.test(draft) ? " " : ""}${words}`;
}
