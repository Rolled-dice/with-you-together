/**
 * Pseudonymous Subject ID generator.
 *
 * Maps a user's internal account ID to a deterministic, pseudonymous
 * partition key (`subj_<64-hex>`).
 * Ensures no email, phone number, name, or raw account ID is ever used in AWS partition keys.
 */

export async function resolveSubjectId(userId: string): Promise<string> {
  const salt = process.env.AI_SUBJECT_SALT || 'someonenear-ai-salt-v1';
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${userId}`);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `subj_${hex.slice(0, 32)}`;
}
