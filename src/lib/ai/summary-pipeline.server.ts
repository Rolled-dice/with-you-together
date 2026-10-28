import type { UserSummary, ChatMessage } from './types';
import { UserSummarySchema } from './types';
import { AiProviderFactory } from './factory.server';
import { resolveSubjectId } from './subject.server';

const MAX_SUMMARY_LENGTH = 1500;
const MIN_CONVERSATION_TURNS = 4;

/**
 * 10-Step Sanitization and Safety Verification Pipeline
 */
export function sanitizeSummaryText(rawText: string): string {
  let cleaned = rawText;

  // 1. Remove credentials, API keys, tokens, passwords
  cleaned = cleaned.replace(
    /(?:api[_-]?key|secret|password|bearer|token|access[_-]?key)[\s:=]+[\w\-.~+/]+=*/gi,
    '[REDACTED]'
  );

  // 2. Remove email addresses
  cleaned = cleaned.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[EMAIL]');

  // 3. Remove phone numbers
  cleaned = cleaned.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');

  // 4. Remove medical diagnoses / clinical claims
  cleaned = cleaned.replace(
    /\b(?:diagnosed with|has been diagnosed|suffers from bipolar|clinical depression|schizophrenia|cancer prognosis)\b/gi,
    'health topic discussed'
  );

  // 5. Remove medication dosage recommendations
  cleaned = cleaned.replace(
    /\b(?:prescribed|take|dosage of)\s+\d+\s*(?:mg|ml|tablets|pills)\b/gi,
    'medication discussed'
  );

  // 6. Remove crisis quotations / active self-harm statements
  cleaned = cleaned.replace(
    /\b(?:wants to kill|plans to commit suicide|cutting themselves|overdosing)\b/gi,
    '[CRISIS CONTEXT REDACTED]'
  );

  // 7. Remove unsupported speculative inferences
  cleaned = cleaned.replace(/\b(?:clearly has|undoubtedly exhibits|likely has borderline)\b/gi, 'expressed');

  // 8. Trim and enforce strict maximum length
  cleaned = cleaned.trim();
  if (cleaned.length > MAX_SUMMARY_LENGTH) {
    cleaned = cleaned.slice(0, MAX_SUMMARY_LENGTH) + '...';
  }

  return cleaned;
}

export class UserSummaryPipeline {
  /**
   * Evaluates if a conversation qualifies for summary update.
   */
  public static shouldGenerateSummary(messages: ChatMessage[], explicitRemember: boolean = false): boolean {
    if (explicitRemember) return true;
    if (messages.length < MIN_CONVERSATION_TURNS) return false;
    return true;
  }

  /**
   * Generates, sanitizes, safety-evaluates, and stores a summary.
   */
  public static async processAndSaveSummary({
    userId,
    messages,
    explicitNote,
  }: {
    userId: string;
    messages: ChatMessage[];
    explicitNote?: string;
  }): Promise<UserSummary | null> {
    const subjectId = await resolveSubjectId(userId);
    const store = AiProviderFactory.getUserSummaryStore();
    const safetyProvider = AiProviderFactory.getSafetyProvider();
    const generationProvider = AiProviderFactory.getGenerationProvider();

    const existing = await store.getSummary(subjectId);

    // Build extraction prompt for neutral non-clinical preferences
    const conversationSample = messages
      .slice(-10)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = `Extract non-clinical personal communication preferences, explicitly stated wellbeing goals, or topics the user explicitly asked to remember.
DO NOT include medical diagnoses, prescription advice, phone numbers, emails, full message quotes, or clinical inferences.
Write a concise, neutral bulleted summary in under 150 words.

Conversation:
${conversationSample}
${explicitNote ? `User explicit note: ${explicitNote}` : ''}`;

    let generatedText = '';
    try {
      const genResult = await generationProvider.generate({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You extract neutral, non-clinical conversational continuity notes. Be factual and brief.',
      });
      generatedText = genResult.text;
    } catch (err) {
      console.warn('[summary-pipeline] Summary generation call failed. Proceeding without update.');
      return null;
    }

    // 1-8. Apply Sanitization Pipeline
    const sanitized = sanitizeSummaryText(generatedText);
    if (!sanitized) return null;

    // 9. Apply Safety Provider Inspection on the candidate summary
    const safetyDecision = await safetyProvider.evaluateOutput({
      text: sanitized,
      subjectId,
      direction: 'output',
    });

    if (safetyDecision.action !== 'allow') {
      console.warn(
        `[summary-pipeline] Generated summary rejected by safety provider: ${safetyDecision.category}`
      );
      return null;
    }

    // 10. Construct structured record and validate with Zod
    const now = new Date().toISOString();
    const summaryPayload: UserSummary = {
      schemaVersion: 1,
      subjectId,
      summaryVersion: (existing?.summaryVersion ?? 0) + 1,
      summaryText: sanitized,
      sourceConversationCount: (existing?.sourceConversationCount ?? 0) + 1,
      generatedAt: existing?.generatedAt ?? now,
      updatedAt: now,
    };

    const validated = UserSummarySchema.parse(summaryPayload);

    // Save exclusively to the approved UserSummaryStore
    await store.saveSummary(validated);
    console.log(`[summary-pipeline] Successfully saved updated summary for ${subjectId} (v${validated.summaryVersion})`);

    return validated;
  }
}
