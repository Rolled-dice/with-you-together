import { z } from 'zod';

// ============================================================================
// 1. Generation Provider Contracts
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerationRequest {
  messages: ChatMessage[];
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  userContext?: {
    subjectId: string;
    summaryText?: string;
  };
}

export interface GenerationResult {
  text: string;
  finishReason: 'stop' | 'length' | 'safety' | 'other';
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface GenerationProvider {
  readonly id: string;
  generate(input: GenerationRequest): Promise<GenerationResult>;
}

// ============================================================================
// 2. Safety Provider Contracts
// ============================================================================

export type SafetyCategory =
  | 'allowed_wellbeing'
  | 'emotional_distress'
  | 'passive_self_harm_risk'
  | 'immediate_crisis'
  | 'medical_or_diagnostic_request'
  | 'dosage_or_prescription_request'
  | 'prompt_injection'
  | 'unrelated_personal_use'
  | 'abusive_automation'
  | 'safety_service_unavailable';

export type SafetyAction = 'allow' | 'crisis' | 'refuse' | 'unavailable';

export interface SafetyInput {
  text: string;
  subjectId: string;
  direction: 'input';
}

export interface SafetyOutput {
  text: string;
  subjectId: string;
  direction: 'output';
}

export interface SafetyDecision {
  action: SafetyAction;
  category: SafetyCategory;
  sanitizedReason?: string;
  latencyMs?: number;
  estimatedCostUsd?: number;
}

export interface SafetyProvider {
  readonly id: string;
  evaluateInput(input: SafetyInput): Promise<SafetyDecision>;
  evaluateOutput(input: SafetyOutput): Promise<SafetyDecision>;
}

// ============================================================================
// 3. User Summary Contracts & Schemas
// ============================================================================

export const UserSummarySchema = z
  .object({
    schemaVersion: z.literal(1),
    subjectId: z.string().min(1),
    summaryVersion: z.number().int().nonnegative(),
    summaryText: z.string().max(2000),
    sourceConversationCount: z.number().int().nonnegative(),
    generatedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    expiresAt: z.number().optional(),
  })
  .strict();

export type UserSummary = z.infer<typeof UserSummarySchema>;

export interface UserSummaryStore {
  readonly id: string;
  getSummary(subjectId: string): Promise<UserSummary | null>;
  saveSummary(summary: UserSummary): Promise<void>;
  deleteUserSummary(subjectId: string): Promise<void>;
}

// Provider-neutral portability export format
export const ExportedUserSummarySchema = z
  .object({
    schemaVersion: z.literal(1),
    subjectId: z.string().min(1),
    summaryVersion: z.number().int().nonnegative(),
    summaryText: z.string().max(2000),
    sourceConversationCount: z.number().int().nonnegative(),
    generatedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    exportedAt: z.string().datetime(),
  })
  .strict();

export type ExportedUserSummary = z.infer<typeof ExportedUserSummarySchema>;

// ============================================================================
// 4. Safety Audit Log Contracts & Schemas
// ============================================================================

export const SafetyAuditEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: z.string().min(1),
    subjectId: z.string().min(1),
    occurredAt: z.string().datetime(),
    direction: z.enum(['input', 'output']),
    category: z.enum([
      'allowed_wellbeing',
      'emotional_distress',
      'passive_self_harm_risk',
      'immediate_crisis',
      'medical_or_diagnostic_request',
      'dosage_or_prescription_request',
      'prompt_injection',
      'unrelated_personal_use',
      'abusive_automation',
      'safety_service_unavailable',
    ]),
    action: z.enum(['allow', 'crisis', 'refuse', 'unavailable']),
    inputCharacters: z.number().optional(),
    outputCharacters: z.number().optional(),
    estimatedTextUnits: z.number().optional(),
    estimatedCostUsd: z.number().optional(),
    providerLatencyMs: z.number().optional(),
    sanitizedErrorCode: z.string().optional(),
  })
  .strict();

export type SafetyAuditEvent = z.infer<typeof SafetyAuditEventSchema>;

export interface SafetyLogSink {
  readonly id: string;
  write(event: SafetyAuditEvent): Promise<void>;
  deleteUserEvents(subjectId: string): Promise<void>;
}

// ============================================================================
// 5. Health Check Types
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unavailable';

export interface ProviderHealthReport {
  generation: { provider: string; status: HealthStatus; error?: string };
  safety: { provider: string; status: HealthStatus; error?: string };
  summaryStore: { provider: string; status: HealthStatus; error?: string };
  safetyLogSink: { provider: string; status: HealthStatus; error?: string };
  circuitBreaker: { active: boolean; budgetSpentUsd: number; budgetLimitUsd: number };
}
