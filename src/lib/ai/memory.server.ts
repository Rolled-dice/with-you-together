import { AiProviderFactory } from "./factory.server";
import { resolveSubjectId } from "./subject.server";
import { sanitizeSummaryText } from "./summary-pipeline.server";

export async function getCompanionSummary(userId: string) {
  try {
    const subjectId = await resolveSubjectId(userId);
    const record = await AiProviderFactory.getUserSummaryStore().getSummary(subjectId);
    return {
      success: true,
      summary: record
        ? {
            summaryText: record.summaryText,
            updatedAt: record.updatedAt,
            version: record.summaryVersion,
          }
        : null,
      memoryEnabled: true,
    };
  } catch {
    return {
      success: false,
      error: "Unable to fetch summary at this time.",
      summary: null,
      memoryEnabled: true,
    };
  }
}

export async function updateCompanionSummary(userId: string, summaryText: string) {
  const subjectId = await resolveSubjectId(userId);
  const store = AiProviderFactory.getUserSummaryStore();
  const existing = await store.getSummary(subjectId);
  const now = new Date().toISOString();
  await store.saveSummary({
    schemaVersion: 1,
    subjectId,
    summaryVersion: (existing?.summaryVersion ?? 0) + 1,
    summaryText: sanitizeSummaryText(summaryText),
    sourceConversationCount: existing?.sourceConversationCount ?? 1,
    generatedAt: existing?.generatedAt ?? now,
    updatedAt: now,
  });
  return { success: true };
}

export async function clearCompanionSummary(userId: string) {
  try {
    const subjectId = await resolveSubjectId(userId);
    await AiProviderFactory.getUserSummaryStore().deleteUserSummary(subjectId);
    await AiProviderFactory.getSafetyLogSink().deleteUserEvents(subjectId);
    return { success: true, message: "Companion memory cleared successfully." };
  } catch (error) {
    console.error("[memory] Clear failed:", error);
    return {
      success: false,
      message: "Could not complete memory clear request. Please try again shortly.",
    };
  }
}
