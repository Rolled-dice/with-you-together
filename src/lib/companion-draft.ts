type Draft = { userId: string; generation: number; threadId: string; text: string };
let pending: Draft | null = null;
export function prepareCompanionDraft(draft: Draft) {
  pending = draft;
}
export function consumeCompanionDraft(userId: string | null, generation: number, threadId: string) {
  if (!pending) return null;
  if (pending.userId !== userId || pending.generation !== generation) {
    pending = null;
    return null;
  }
  if (pending.threadId !== threadId) return null;
  const text = pending.text;
  pending = null;
  return text;
}
