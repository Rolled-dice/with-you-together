import type {
  GenerationProvider,
  GenerationRequest,
  GenerationResult,
  SafetyProvider,
  SafetyInput,
  SafetyOutput,
  SafetyDecision,
  UserSummary,
  UserSummaryStore,
  SafetyAuditEvent,
  SafetyLogSink,
} from '../types';
import { UserSummarySchema, SafetyAuditEventSchema } from '../types';

export class MockGenerationProvider implements GenerationProvider {
  public readonly id = 'mock';

  constructor(private cannedResponse: string = 'Hello! I am here to listen.') {}

  public setCannedResponse(text: string): void {
    this.cannedResponse = text;
  }

  public async generate(request: GenerationRequest): Promise<GenerationResult> {
    return {
      text: this.cannedResponse,
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
    };
  }
}

export class MockSafetyProvider implements SafetyProvider {
  public readonly id = 'mock';
  private forceDecision?: SafetyDecision;

  public setDecision(decision: SafetyDecision): void {
    this.forceDecision = decision;
  }

  public clearDecision(): void {
    this.forceDecision = undefined;
  }

  public async evaluateInput(input: SafetyInput): Promise<SafetyDecision> {
    if (this.forceDecision) return this.forceDecision;

    const lower = input.text.toLowerCase();
    if (lower.includes('suicide') || lower.includes('kill myself') || lower.includes('want to die')) {
      return {
        action: 'crisis',
        category: 'immediate_crisis',
        sanitizedReason: 'Self-harm indicator detected.',
      };
    }

    if (lower.includes('dose') || lower.includes('prescribe')) {
      return {
        action: 'refuse',
        category: 'dosage_or_prescription_request',
        sanitizedReason: 'Prescription advice refused.',
      };
    }

    return { action: 'allow', category: 'allowed_wellbeing' };
  }

  public async evaluateOutput(output: SafetyOutput): Promise<SafetyDecision> {
    if (this.forceDecision) return this.forceDecision;
    return { action: 'allow', category: 'allowed_wellbeing' };
  }
}

export class MockUserSummaryStore implements UserSummaryStore {
  public readonly id = 'mock';
  private store = new Map<string, UserSummary>();

  public async getSummary(subjectId: string): Promise<UserSummary | null> {
    return this.store.get(subjectId) || null;
  }

  public async saveSummary(summary: UserSummary): Promise<void> {
    const validated = UserSummarySchema.parse(summary);
    this.store.set(validated.subjectId, validated);
  }

  public async deleteUserSummary(subjectId: string): Promise<void> {
    this.store.delete(subjectId);
  }

  public clear(): void {
    this.store.clear();
  }
}

export class MockSafetyLogSink implements SafetyLogSink {
  public readonly id = 'mock';
  public events: SafetyAuditEvent[] = [];

  public async write(event: SafetyAuditEvent): Promise<void> {
    const validated = SafetyAuditEventSchema.parse(event);
    this.events.push(validated);
  }

  public async deleteUserEvents(subjectId: string): Promise<void> {
    this.events = this.events.filter((e) => e.subjectId !== subjectId);
  }

  public clear(): void {
    this.events = [];
  }
}
