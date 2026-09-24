import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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

        const body = (await request.json()) as {
          messages?: UIMessage[];
          conversationId?: string;
        };
        if (!Array.isArray(body.messages) || !body.conversationId) {
          return new Response("Bad request", { status: 400 });
        }

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


        // Persist the latest user message
        const lastMessage = body.messages[body.messages.length - 1];
        if (lastMessage && lastMessage.role === "user") {
          const text = lastMessage.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          if (text.trim()) {
            await supabase.from("messages").insert({
              conversation_id: body.conversationId,
              user_id: userId,
              role: "user",
              content: text,
            });
            // Set title from first user message if still default
            if (convo.title === "New conversation") {
              const title = text.slice(0, 60);
              await supabase
                .from("conversations")
                .update({ title })
                .eq("id", body.conversationId);
            }
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

        const google = createGoogleGenerativeAI({ apiKey: geminiKey });
        const result = streamText({
          model: google("gemini-3-flash-preview"),
          system: SYSTEM_PROMPT + nameLine + memoryBlock,
          messages: await convertToModelMessages(body.messages),
          maxRetries: 0,
          onError: ({ error }) => {
            console.error("[chat] stream error", error);
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onError: (error) =>
            error instanceof Error
              ? error.message
              : "Gemini could not respond. Please try again shortly.",
          onFinish: async ({ responseMessage }) => {
            const text = responseMessage.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            if (!text.trim()) return;
            await supabase.from("messages").insert({
              conversation_id: body.conversationId!,
              user_id: userId,
              role: "assistant",
              content: text,
            });
            await supabase
              .from("conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", body.conversationId!);
          },
        });
      },
    },
  },
});
