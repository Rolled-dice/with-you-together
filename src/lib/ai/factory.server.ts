import type {
  GenerationProvider,
  SafetyProvider,
  UserSummaryStore,
  SafetyLogSink,
} from './types';
import { GeminiGenerationProvider } from './adapters/gemini.server';
import { BedrockSafetyProvider } from './adapters/bedrock-safety.server';
import { AwsUserSummaryStore } from './adapters/aws-summary-store.server';
import { AwsSafetyLogSink } from './adapters/aws-safety-sink.server';
import {
  MockGenerationProvider,
  MockSafetyProvider,
  MockUserSummaryStore,
  MockSafetyLogSink,
} from './adapters/mock-adapters.server';

// Server-controlled strict allowlists
const ALLOWED_GENERATION_PROVIDERS = ['gemini', 'mock'] as const;
const ALLOWED_SAFETY_PROVIDERS = ['bedrock', 'mock'] as const;
const ALLOWED_SUMMARY_STORES = ['aws', 'mock'] as const;
const ALLOWED_SAFETY_SINKS = ['aws', 'mock'] as const;

export type AllowedGeneration = (typeof ALLOWED_GENERATION_PROVIDERS)[number];
export type AllowedSafety = (typeof ALLOWED_SAFETY_PROVIDERS)[number];
export type AllowedSummaryStore = (typeof ALLOWED_SUMMARY_STORES)[number];
export type AllowedSafetySink = (typeof ALLOWED_SAFETY_SINKS)[number];

// Configurable test overrides for testing environments
let _testGenerationOverride: GenerationProvider | null = null;
let _testSafetyOverride: SafetyProvider | null = null;
let _testSummaryStoreOverride: UserSummaryStore | null = null;
let _testSafetySinkOverride: SafetyLogSink | null = null;

export class AiProviderFactory {
  public static setTestOverrides(overrides: {
    generation?: GenerationProvider | null;
    safety?: SafetyProvider | null;
    summaryStore?: UserSummaryStore | null;
    safetySink?: SafetyLogSink | null;
  }): void {
    if (overrides.generation !== undefined) _testGenerationOverride = overrides.generation;
    if (overrides.safety !== undefined) _testSafetyOverride = overrides.safety;
    if (overrides.summaryStore !== undefined) _testSummaryStoreOverride = overrides.summaryStore;
    if (overrides.safetySink !== undefined) _testSafetySinkOverride = overrides.safetySink;
  }

  public static getGenerationProvider(): GenerationProvider {
    if (_testGenerationOverride) return _testGenerationOverride;

    const rollback = process.env.AI_PROVIDER_ROLLBACK === 'true';
    const raw = rollback ? 'gemini' : (process.env.AI_GENERATION_PROVIDER || 'gemini').toLowerCase().trim();

    if (!ALLOWED_GENERATION_PROVIDERS.includes(raw as any)) {
      console.error(`[ai-factory] Security alert: Unsupported generation provider attempted: "${raw}"`);
      throw new Error('[ai-configuration] An internal AI configuration error occurred. Request failed closed.');
    }

    switch (raw as AllowedGeneration) {
      case 'gemini':
        return new GeminiGenerationProvider();
      case 'mock':
        return new MockGenerationProvider();
    }
  }

  public static getSafetyProvider(): SafetyProvider {
    if (_testSafetyOverride) return _testSafetyOverride;

    const rollback = process.env.AI_PROVIDER_ROLLBACK === 'true';
    const raw = rollback ? 'bedrock' : (process.env.AI_SAFETY_PROVIDER || 'bedrock').toLowerCase().trim();

    if (!ALLOWED_SAFETY_PROVIDERS.includes(raw as any)) {
      console.error(`[ai-factory] Security alert: Unsupported safety provider attempted: "${raw}"`);
      throw new Error('[ai-configuration] An internal safety configuration error occurred. Request failed closed.');
    }

    switch (raw as AllowedSafety) {
      case 'bedrock':
        return new BedrockSafetyProvider();
      case 'mock':
        return new MockSafetyProvider();
    }
  }

  public static getUserSummaryStore(): UserSummaryStore {
    if (_testSummaryStoreOverride) return _testSummaryStoreOverride;

    const rollback = process.env.AI_PROVIDER_ROLLBACK === 'true';
    const raw = rollback ? 'aws' : (process.env.AI_SUMMARY_STORE || 'aws').toLowerCase().trim();

    if (!ALLOWED_SUMMARY_STORES.includes(raw as any)) {
      console.error(`[ai-factory] Security alert: Unsupported summary store attempted: "${raw}"`);
      throw new Error('[ai-configuration] An internal storage configuration error occurred. Request failed closed.');
    }

    switch (raw as AllowedSummaryStore) {
      case 'aws':
        return new AwsUserSummaryStore();
      case 'mock':
        return new MockUserSummaryStore();
    }
  }

  public static getSafetyLogSink(): SafetyLogSink {
    if (_testSafetySinkOverride) return _testSafetySinkOverride;

    const rollback = process.env.AI_PROVIDER_ROLLBACK === 'true';
    const raw = rollback ? 'aws' : (process.env.AI_SAFETY_LOG_SINK || 'aws').toLowerCase().trim();

    if (!ALLOWED_SAFETY_SINKS.includes(raw as any)) {
      console.error(`[ai-factory] Security alert: Unsupported safety sink attempted: "${raw}"`);
      throw new Error('[ai-configuration] An internal audit configuration error occurred. Request failed closed.');
    }

    switch (raw as AllowedSafetySink) {
      case 'aws':
        return new AwsSafetyLogSink();
      case 'mock':
        return new MockSafetyLogSink();
    }
  }
}
