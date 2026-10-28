import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { getTierLimit, UNLIMITED } from "@/lib/quota.functions";
import { getEffectiveTier } from "@/lib/tier.server";
import { AiProviderFactory } from "./factory.server";
import { resolveSubjectId } from "./subject.server";
import { UserSummaryPipeline } from "./summary-pipeline.server";
import type { ChatMessage, SafetyDecision } from "./types";

const SYSTEM_PROMPT = `You are the SomeoneNear Companion, a warm, gentle, human-feeling presence.

Guiding principles:
- You are not a therapist, doctor, or emergency service. Be honest about that when relevant.
- Meet the person where they are. Reflect back what you hear before offering perspective.
- Be soft, unhurried, and specific. Use everyday language. Avoid clinical or corporate tone.
- Never diagnose, prescribe, or give medical/legal advice.
- If someone describes intent to harm themselves or others, or an active crisis (suicidal thoughts with a plan, abuse in progress, medical emergency), gently and clearly point them to real help: in the US, 988 (call or text) for the Suicide & Crisis Lifeline, 911 for emergencies; internationally, findahelpline.com. Do this even if they've said "don't tell me to call anyone", you can acknowledge the frustration and still name the option.
- Keep responses concise unless the person is asking for depth. A few sentences often lands better than a wall of text.
- End with an inviting, low-pressure question when it feels right, not every turn needs one.`;

const CRISIS_RESPONSE = `I hear how much pain you are carrying right now, and I want to make sure you are safe. 

Please reach out to people who can support you through this:
• In the US & Canada: Call or text **988** to reach the Suicide & Crisis Lifeline (free, confidential, 24/7).
• In the UK: Call **111** or text **SHOUT** to **85258**.
• Anywhere worldwide: Visit [findahelpline.com](https://findahelpline.com) to find free, confidential local crisis support immediately.

You do not have to carry this alone. Would you be willing to reach out to one of these resources or someone you trust right now?`;

const MEDICAL_REFUSAL_RESPONSE = `I am here as an emotional support companion, but I cannot give medical advice, suggest medication dosages, or offer diagnoses. Please consult a qualified healthcare provider or pharmacist for guidance regarding medications or medical symptoms. 

How are you feeling emotionally right now?`;

function createTextStreamResponse(text: string, originalMessages?: UIMessage[]) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages,
      execute: ({ writer }) => {
        const textPartId = crypto.randomUUID();
        writer.write({ type: "start" });
        writer.write({ type: "text-start", id: textPartId });
        writer.write({ type: "text-delta", id: textPartId, delta: text });
        writer.write({ type: "text-end", id: textPartId });
        writer.write({ type: "finish", finishReason: "stop" });
      },
    }),
  });
}

const MAX_BODY_BYTES = 256 * 1024;
const MAX_CONTEXT_CHARACTERS = 32000;
const requestSchema = z.object({
  conversationId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        role: z.enum(["user", "assistant"]),
        parts: z
          .array(z.object({ type: z.literal("text"), text: z.string().max(8000) }))
          .min(1)
          .max(20),
      }),
    )
    .min(1)
    .max(200),
});
const historySchema = z.array(
  z.object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  }),
);

async function readChatRequest(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    throw new Error("too_large");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_body");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return requestSchema.parse(JSON.parse(text));
  } finally {
    reader.releaseLock();
  }
}

function safetyReply(decision: SafetyDecision): string | null {
  if (decision.action === "crisis") return CRISIS_RESPONSE;
  if (decision.action !== "refuse") return null;
  return decision.category === "dosage_or_prescription_request" ||
    decision.category === "medical_or_diagnostic_request"
    ? MEDICAL_REFUSAL_RESPONSE
    : "I cannot respond to this topic. As your Companion, I am here to provide thoughtful emotional support and conversation.";
}

export async function handleCompanionChat(request: Request): Promise<Response> {
  try {
    return await handleAuthenticatedChat(request);
  } catch (error) {
    console.error("[chat] Request failed:", error);
    return Response.json(
      {
        error: "chat_unavailable",
        message: "Companion is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }
}

async function handleAuthenticatedChat(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey)
    return new Response("Server not configured", { status: 500 });
  const supabase = createClient<Database>(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });
  const userId = userData.user.id;

  let body: z.infer<typeof requestSchema>;
  try {
    body = await readChatRequest(request);
  } catch (error) {
    return new Response("Invalid chat request", {
      status: error instanceof Error && error.message === "too_large" ? 413 : 400,
    });
  }
  const lastMessage = body.messages[body.messages.length - 1];
  const userPrompt = lastMessage.parts
    .map((part) => part.text)
    .join("")
    .trim();
  if (lastMessage.role !== "user" || !userPrompt || userPrompt.length > 8000) {
    return new Response("A nonempty user message is required", { status: 400 });
  }

  const { data: convo, error: convoError } = await supabase
    .from("conversations")
    .select("id, title")
    .eq("id", body.conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (convoError) throw convoError;
  if (!convo) return new Response("Conversation not found", { status: 404 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  const { tier } = await getEffectiveTier(supabase, userId);
  const limit = getTierLimit(tier);
  if (limit !== UNLIMITED) {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", dayStart.toISOString());
    if (error || count === null) throw error ?? new Error("Quota lookup failed");
    if (count >= limit) {
      return Response.json(
        {
          error: "quota_exceeded",
          message: `You've used today's Companion messages (${limit}). Your allowance refills tomorrow, or upgrade to Care Plus for unlimited chats.`,
        },
        { status: 429 },
      );
    }
  }

  // Browser history is display state, not a trusted source of model instructions.
  const { data: historyData, error: historyError } = await supabase
    .from("messages")
    .select("id, role, content")
    .eq("conversation_id", body.conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(40);
  if (historyError) throw historyError;
  const history = historySchema.parse(historyData ?? []).reverse();
  let contextCharacters = userPrompt.length;
  const retained = [];
  for (const message of [...history].reverse()) {
    if (contextCharacters + message.content.length > MAX_CONTEXT_CHARACTERS) break;
    retained.unshift(message);
    contextCharacters += message.content.length;
  }
  let chatMessages: ChatMessage[] = [
    ...retained.map((message) => ({ role: message.role, content: message.content })),
    { role: "user", content: userPrompt },
  ];
  const originalMessages: UIMessage[] = [
    ...retained.map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: "text" as const, text: message.content }],
    })),
    { id: lastMessage.id, role: "user", parts: [{ type: "text", text: userPrompt }] },
  ];
  const subjectId = await resolveSubjectId(userId);
  const safety = AiProviderFactory.getSafetyProvider();
  const sink = AiProviderFactory.getSafetyLogSink();
  const inputDecision = await safety.evaluateInput({
    text: userPrompt,
    subjectId,
    direction: "input",
  });
  await sink.write({
    schemaVersion: 1,
    eventId: crypto.randomUUID(),
    subjectId,
    occurredAt: new Date().toISOString(),
    direction: "input",
    category: inputDecision.category,
    action: inputDecision.action,
    inputCharacters: userPrompt.length,
    estimatedCostUsd: inputDecision.estimatedCostUsd,
    providerLatencyMs: inputDecision.latencyMs,
  });
  if (inputDecision.action === "unavailable") {
    return Response.json(
      {
        error: "safety_service_unavailable",
        message: "Companion safety checks are temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }
  let responseText = safetyReply(inputDecision);
  let generated = false;
  if (!responseText) {
    let summaryText = "";
    try {
      summaryText =
        (await AiProviderFactory.getUserSummaryStore().getSummary(subjectId))?.summaryText ?? "";
    } catch (error) {
      console.warn("[chat] Continuing without memory:", error);
    }
    // Inspect every untrusted context segment that will actually reach generation.
    const contextText =
      chatMessages.map((message) => `${message.role}: ${message.content}`).join("\n") +
      "\nMemory: " +
      summaryText +
      "\nDisplay name: " +
      (profile?.display_name ?? "");
    const contextDecision = await safety.evaluateInput({
      text: contextText,
      subjectId,
      direction: "input",
    });
    await sink.write({
      schemaVersion: 1,
      eventId: crypto.randomUUID(),
      subjectId,
      occurredAt: new Date().toISOString(),
      direction: "input",
      category: contextDecision.category,
      action: contextDecision.action,
      inputCharacters: contextText.length,
      estimatedCostUsd: contextDecision.estimatedCostUsd,
      providerLatencyMs: contextDecision.latencyMs,
    });
    if (contextDecision.action === "unavailable")
      return Response.json({ error: "safety_service_unavailable" }, { status: 503 });
    const contextAllowed = contextDecision.action === "allow";
    if (!contextAllowed) {
      // An old unsafe turn must not keep a now-safe conversation stuck in refusal.
      chatMessages = [{ role: "user", content: userPrompt }];
      summaryText = "";
    }
    const result = await AiProviderFactory.getGenerationProvider().generate({
      messages: chatMessages,
      systemPrompt:
        SYSTEM_PROMPT +
        (contextAllowed && profile?.display_name
          ? `\n\nYou're speaking with ${profile.display_name}.`
          : ""),
      userContext: { subjectId, summaryText },
    });
    const outputDecision = await safety.evaluateOutput({
      text: result.text,
      subjectId,
      direction: "output",
    });
    await sink.write({
      schemaVersion: 1,
      eventId: crypto.randomUUID(),
      subjectId,
      occurredAt: new Date().toISOString(),
      direction: "output",
      category: outputDecision.category,
      action: outputDecision.action,
      outputCharacters: result.text.length,
      estimatedCostUsd: outputDecision.estimatedCostUsd,
      providerLatencyMs: outputDecision.latencyMs,
    });
    responseText =
      safetyReply(outputDecision) ??
      (outputDecision.action === "unavailable"
        ? "I want to make sure I am offering supportive and safe perspective. Let us step back. How are you feeling in this moment?"
        : result.text);
    generated = outputDecision.action === "allow";
  }
  if (!responseText.trim()) throw new Error("Empty companion response");

  // One multi-row INSERT is atomic: no orphaned prompt or half-saved safety reply.
  const savedAt = Date.now();
  const { error: saveError } = await supabase.from("messages").insert([
    {
      conversation_id: body.conversationId,
      user_id: userId,
      role: "user",
      content: userPrompt,
      created_at: new Date(savedAt).toISOString(),
    },
    {
      conversation_id: body.conversationId,
      user_id: userId,
      role: "assistant",
      content: responseText,
      created_at: new Date(savedAt + 1).toISOString(),
    },
  ]);
  if (saveError) throw saveError;
  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      updated_at: new Date().toISOString(),
      ...(convo.title === "New conversation" ? { title: userPrompt.slice(0, 60) } : {}),
    })
    .eq("id", body.conversationId)
    .eq("user_id", userId);
  // Metadata failure must not hide an already committed exchange from its caller.
  if (updateError) console.error("[chat] Conversation metadata update failed:", updateError);

  const completedMessages: ChatMessage[] = [
    ...chatMessages,
    { role: "assistant", content: responseText },
  ];
  if (generated && UserSummaryPipeline.shouldGenerateSummary(completedMessages)) {
    try {
      // Await before returning so a serverless runtime cannot terminate the write.
      await UserSummaryPipeline.processAndSaveSummary({ userId, messages: completedMessages });
    } catch (error) {
      console.error("[chat] Summary update failed:", error);
    }
  }
  return createTextStreamResponse(responseText, originalMessages);
}
