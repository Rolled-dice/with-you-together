import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { generateCompanionReply } from "@/lib/companion-generation.server";
import { createClient } from "@supabase/supabase-js";
import { getTierLimit, UNLIMITED } from "@/lib/quota.functions";

const SYSTEM_PROMPT = `You are the SomeoneNear Companion, a warm, gentle, human-feeling presence.

Guiding principles:
- You are not a therapist, doctor, or emergency service. Be honest about that when relevant.
- Meet the person where they are. Reflect back what you hear before offering perspective.
- Be soft, unhurried, and specific. Use everyday language. Avoid clinical or corporate tone.
- Never diagnose, prescribe, or give medical/legal advice.
- If someone describes intent to harm themselves or others, or an active crisis (suicidal thoughts with a plan, abuse in progress, medical emergency), gently and clearly point them to real help: in the US, 988 (call or text) for the Suicide & Crisis Lifeline, 911 for emergencies; internationally, findahelpline.com. Do this even if they've said "don't tell me to call anyone", you can acknowledge the frustration and still name the option.
- Keep responses concise unless the person is asking for depth. A few sentences often lands better than a wall of text.
- End with an inviting, low-pressure question when it feels right, not every turn needs one.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env.SUPABASE_URL;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!supabaseUrl || !publishableKey || !geminiKey) {
          return new Response("Server not configured", { status: 500 });
        }

        const supabase = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = userData.user.id;

        const parsed = z
          .object({
            conversationId: z.string().uuid(),
            messages: z
              .array(
                z.object({
                  id: z.string().max(200),
                  role: z.enum(["user", "assistant"]),
                  parts: z
                    .array(z.object({ type: z.string(), text: z.string().max(12000).optional() }))
                    .max(100),
                }),
              )
              .min(1)
              .max(60),
          })
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const body = {
          ...parsed.data,
          messages: parsed.data.messages.map((message) => ({
            ...message,
            parts: message.parts
              .filter((part) => part.type === "text")
              .map((part) => ({ type: "text" as const, text: part.text ?? "" })),
          })),
        };
        const userMessage = body.messages.at(-1);
        const userText = userMessage?.parts
          .map((part) => part.text)
          .join("")
          ?.trim();
        if (
          userMessage?.role !== "user" ||
          !userText ||
          JSON.stringify(body.messages).length > 100000
        )
          return new Response("Bad request", { status: 400 });

        // Verify conversation ownership
        const { data: convo, error: convoError } = await supabase
          .from("conversations")
          .select("id, title")
          .eq("id", body.conversationId)
          .eq("user_id", userId)
          .maybeSingle();
        if (convoError || !convo) {
          return new Response("Conversation not found", { status: 404 });
        }
        // Enforce per-tier daily quota (Care Plus is unlimited)
        const { data: profile } = await supabase
          .from("profiles")
          .select("care_tier, display_name")
          .eq("id", userId)
          .maybeSingle();
        const limit = getTierLimit(profile?.care_tier);
        if (limit !== UNLIMITED) {
          const dayStart = new Date();
          dayStart.setUTCHours(0, 0, 0, 0);
          const { count: usedCount } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("role", "user")
            .gte("created_at", dayStart.toISOString());
          if ((usedCount ?? 0) >= limit) {
            return new Response(
              JSON.stringify({
                error: "quota_exceeded",
                message: `You've used today's Companion messages (${limit}). Your allowance refills tomorrow, or upgrade to Care Plus for unlimited chats.`,
              }),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        // Fetch user's saved companion memories to personalize
        const { data: memories } = await supabase
          .from("companion_memories")
          .select("content")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);
        const memoryBlock =
          memories && memories.length > 0
            ? `\n\nThings this person has asked you to remember:\n${memories
                .map((m: { content: string }) => `- ${m.content}`)
                .join("\n")}`
            : "";
        const displayName = profile && (profile as { display_name?: string }).display_name;
        const nameLine = displayName ? `\n\nYou're speaking with ${displayName}.` : "";

        let generated: Awaited<ReturnType<typeof generateCompanionReply>>;
        try {
          generated = await generateCompanionReply({
            environment: process.env,
            subjectId: userId,
            system: SYSTEM_PROMPT + nameLine + memoryBlock,
            messages: await convertToModelMessages(body.messages as UIMessage[]),
            userText,
          });
        } catch (error) {
          console.error(
            "[chat] Companion services unavailable",
            error instanceof Error ? error.name : "UnknownError",
          );
          return new Response("Companion is temporarily unavailable. Please try again shortly.", {
            status: 503,
          });
        }
        const { error: saveError } = await supabase.from("messages").insert([
          {
            conversation_id: body.conversationId,
            user_id: userId,
            role: "user",
            content: userText,
          },
          {
            conversation_id: body.conversationId,
            user_id: userId,
            role: "assistant",
            content: generated.text,
          },
        ]);
        if (saveError)
          return new Response("We could not save this conversation. Please try again.", {
            status: 503,
          });
        await generated.persistContinuity();
        const reply = generated.text;
        await supabase
          .from("conversations")
          .update({
            updated_at: new Date().toISOString(),
            ...(convo.title === "New conversation" ? { title: userText.slice(0, 60) } : {}),
          })
          .eq("id", body.conversationId)
          .eq("user_id", userId);
        // Emit only the completed, safety-checked reply. No unchecked token reaches the browser.
        return createUIMessageStreamResponse({
          stream: createUIMessageStream({
            originalMessages: body.messages as UIMessage[],
            execute: ({ writer }) => {
              writer.write({ type: "start", messageId: crypto.randomUUID() });
              writer.write({ type: "text-start", id: "reply" });
              writer.write({ type: "text-delta", id: "reply", delta: reply });
              writer.write({ type: "text-end", id: "reply" });
              writer.write({ type: "finish", finishReason: "stop" });
            },
          }),
        });
      },
    },
  },
});
