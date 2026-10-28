/**
 * AI & AWS Storage Cost Tracking and Circuit Breaker
 *
 * Enforces strict spending ceilings:
 * - Warning: $10
 * - Strong warning: $15
 * - Circuit breaker (hard cutoff): $20
 *
 * When the circuit breaker trips, all safety checks fail closed,
 * which intentionally halts AI generation to prevent unguarded output.
 */

export interface BudgetConfig {
  warningThresholdUsd: number;
  strongWarningThresholdUsd: number;
  circuitBreakerLimitUsd: number;
}

const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  warningThresholdUsd: 10.0,
  strongWarningThresholdUsd: 15.0,
  circuitBreakerLimitUsd: 20.0,
};

// In-memory monthly tracker with configurable override for testing / runtime
let _spentMonthUsd = 0.0;
let _circuitBreakerForced = false;

export class AiBudgetManager {
  private static config: BudgetConfig = { ...DEFAULT_BUDGET_CONFIG };

  public static setConfig(config: Partial<BudgetConfig>): void {
    AiBudgetManager.config = { ...AiBudgetManager.config, ...config };
  }

  public static getConfig(): BudgetConfig {
    return { ...AiBudgetManager.config };
  }

  public static recordExpense(amountUsd: number): void {
    if (amountUsd > 0) {
      _spentMonthUsd += amountUsd;
      if (_spentMonthUsd >= AiBudgetManager.config.circuitBreakerLimitUsd) {
        console.warn(
          `[ai-budget] CIRCUIT BREAKER TRIPPED! Spent $${_spentMonthUsd.toFixed(4)} >= $${AiBudgetManager.config.circuitBreakerLimitUsd}. Halting AI operations.`
        );
      } else if (_spentMonthUsd >= AiBudgetManager.config.strongWarningThresholdUsd) {
        console.warn(
          `[ai-budget] STRONG WARNING: Spent $${_spentMonthUsd.toFixed(4)} >= $${AiBudgetManager.config.strongWarningThresholdUsd}.`
        );
      } else if (_spentMonthUsd >= AiBudgetManager.config.warningThresholdUsd) {
        console.info(
          `[ai-budget] WARNING: Spent $${_spentMonthUsd.toFixed(4)} >= $${AiBudgetManager.config.warningThresholdUsd}.`
        );
      }
    }
  }

  public static getSpentAmount(): number {
    return _spentMonthUsd;
  }

  public static isCircuitBreakerTripped(): boolean {
    return (
      _circuitBreakerForced ||
      _spentMonthUsd >= AiBudgetManager.config.circuitBreakerLimitUsd
    );
  }

  public static forceCircuitBreaker(tripped: boolean): void {
    _circuitBreakerForced = tripped;
  }

  public static reset(): void {
    _spentMonthUsd = 0.0;
    _circuitBreakerForced = false;
    AiBudgetManager.config = { ...DEFAULT_BUDGET_CONFIG };
  }
}
