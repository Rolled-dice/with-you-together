import { z } from "zod";
export const ParsedMedication = z.object({
  name: z.string().nullable().optional(),
  dosage: z.string().nullable().optional(),
  form: z.string().nullable().optional(),
  frequency: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  times_per_day: z.number().int().min(1).max(6).nullable().optional(),
  when_to_take: z
    .union([
      z.enum(["morning", "afternoon", "evening", "night"]),
      z.array(z.enum(["morning", "afternoon", "evening", "night"])),
    ])
    .nullable()
    .optional(),
});

export const ParsedPrescription = z.object({
  doctor: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  medications: z.array(ParsedMedication).default([]),
});
