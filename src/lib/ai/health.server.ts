import type { ProviderHealthReport, HealthStatus } from './types';
import { AiProviderFactory } from './factory.server';
import { AiBudgetManager } from './budget.server';

export class AiHealthService {
  /**
   * Runs synthetic server-side health checks for configured adapters.
   * Safe to call by administrators only. Never exposes secrets or resource names.
   */
  public static async runHealthCheck(): Promise<ProviderHealthReport> {
    const genProvider = AiProviderFactory.getGenerationProvider();
    const safetyProvider = AiProviderFactory.getSafetyProvider();
    const summaryStore = AiProviderFactory.getUserSummaryStore();
    const safetySink = AiProviderFactory.getSafetyLogSink();

    // 1. Check Generation Provider
    let genStatus: HealthStatus = 'healthy';
    let genError: string | undefined;
    try {
      if (genProvider.id === 'gemini' && !process.env.GEMINI_API_KEY) {
        genStatus = 'unavailable';
        genError = 'Configuration missing.';
      }
    } catch {
      genStatus = 'unavailable';
      genError = 'Provider unavailable.';
    }

    // 2. Check Safety Provider (Fail closed if unavailable)
    let safetyStatus: HealthStatus = 'healthy';
    let safetyError: string | undefined;
    try {
      if (AiBudgetManager.isCircuitBreakerTripped()) {
        safetyStatus = 'unavailable';
        safetyError = 'Safety budget circuit breaker active.';
      } else if (
        safetyProvider.id === 'bedrock' &&
        (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_BEDROCK_GUARDRAIL_ID)
      ) {
        safetyStatus = 'unavailable';
        safetyError = 'Configuration missing.';
      }
    } catch {
      safetyStatus = 'unavailable';
      safetyError = 'Safety check unavailable.';
    }

    // 3. Check Summary Store
    let storeStatus: HealthStatus = 'healthy';
    let storeError: string | undefined;
    try {
      if (summaryStore.id === 'aws' && (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SUMMARY_TABLE_NAME)) {
        storeStatus = 'degraded';
        storeError = 'AWS storage configuration missing (conversations proceed safely without memory).';
      }
    } catch {
      storeStatus = 'degraded';
      storeError = 'Storage service degraded.';
    }

    // 4. Check Safety Log Sink
    let sinkStatus: HealthStatus = 'healthy';
    let sinkError: string | undefined;
    try {
      if (safetySink.id === 'aws' && (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SAFETY_TABLE_NAME)) {
        sinkStatus = 'degraded';
        sinkError = 'Audit logging configuration missing.';
      }
    } catch {
      sinkStatus = 'degraded';
      sinkError = 'Audit log sink degraded.';
    }

    return {
      generation: { provider: genProvider.id, status: genStatus, error: genError },
      safety: { provider: safetyProvider.id, status: safetyStatus, error: safetyError },
      summaryStore: { provider: summaryStore.id, status: storeStatus, error: storeError },
      safetyLogSink: { provider: safetySink.id, status: sinkStatus, error: sinkError },
      circuitBreaker: {
        active: AiBudgetManager.isCircuitBreakerTripped(),
        budgetSpentUsd: AiBudgetManager.getSpentAmount(),
        budgetLimitUsd: AiBudgetManager.getConfig().circuitBreakerLimitUsd,
      },
    };
  }
}
