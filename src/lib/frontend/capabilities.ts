import { z } from "zod";

// No config override can activate a capability without a reviewed main contract.
const schema = z.object({
  familyVaultSharing: z.literal(false),
  assistVoiceDispatch: z.literal(false),
  companionVoiceTranscription: z.literal(false),
  pushCheckIn: z.literal(false),
  outboundCallBooking: z.literal(false),
  callEscalation: z.literal(false),
  localDayDoses: z.literal(false),
  purchase: z.literal(false),
});
export const capabilities = Object.freeze(
  schema.parse({
    familyVaultSharing: false,
    assistVoiceDispatch: false,
    companionVoiceTranscription: false,
    pushCheckIn: false,
    outboundCallBooking: false,
    callEscalation: false,
    localDayDoses: false,
    purchase: false,
  }),
);
export type Capability = keyof typeof capabilities;
export function requireCapability(capability: Capability) {
  if (!capabilities[capability]) throw new Error("This action is not available.");
}
