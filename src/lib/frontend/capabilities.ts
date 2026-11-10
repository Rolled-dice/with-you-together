import { z } from "zod";

// All production capabilities activated.
const schema = z.object({
  familyVaultSharing: z.literal(true),
  assistVoiceDispatch: z.literal(true),
  companionVoiceTranscription: z.literal(true),
  pushCheckIn: z.literal(true),
  outboundCallBooking: z.literal(true),
  callEscalation: z.literal(true),
  localDayDoses: z.literal(true),
  purchase: z.literal(true),
});
export const capabilities = Object.freeze(
  schema.parse({
    familyVaultSharing: true,
    assistVoiceDispatch: true,
    companionVoiceTranscription: true,
    pushCheckIn: true,
    outboundCallBooking: true,
    callEscalation: true,
    localDayDoses: true,
    purchase: true,
  }),
);
export type Capability = keyof typeof capabilities;
export function requireCapability(capability: Capability) {
  if (!capabilities[capability]) throw new Error("This action is not available.");
}
