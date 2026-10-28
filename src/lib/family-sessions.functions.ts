import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callCreditCommand } from "./family.server";

export const getFamilyPool = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    z
      .object({
        familyId: z.string(),
        role: z.string(),
        totalSessions: z.number(),
        totalUsed: z.number(),
        members: z.array(
          z.object({
            user_id: z.string(),
            display_name: z.string(),
            allocated: z.number(),
            used: z.number(),
          }),
        ),
      })
      .nullable()
      .parse(await callCreditCommand(context.userId, "pool")),
  );

export const setAllocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        allocations: z
          .array(
            z.object({
              member_user_id: z.string().uuid(),
              allocated: z.number().int().min(0).max(30),
            }),
          )
          .max(5),
      })
      .parse(input),
  )
  .handler(({ context, data }) => callCreditCommand(context.userId, "allocate", data));
