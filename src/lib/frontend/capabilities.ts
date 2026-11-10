import { z } from "zod";

// No config override can activate a capability without a reviewed main contract.
const schema = z.object({
  familyVaultSharing: z.literal(false),
  assistVoiceDispatch: z.literal(false),
  companionVoiceTranscription: z.literal(false),
  pushCheckIn: z.literal(false),
  outboundCallBooking: z.literal(true),
  callEscalation: z.literal(false),
  localDayDoses: z.literal(true),
  purchase: z.literal(true),
});
export const capabilities = Object.freeze(
  schema.parse({
    familyVaultSharing: false,
    assistVoiceDispatch: false,
    companionVoiceTranscription: false,
    pushCheckIn: false,
    outboundCallBooking: true,
    callEscalation: false,
    localDayDoses: true,
    purchase: true,
  }),
);
export type Capability = keyof typeof capabilities;
export function requireCapability(capability: Capability) {
  if (!capabilities[capability]) throw new Error("This action is not available.");
}
