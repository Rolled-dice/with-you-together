import type {
  SafetyProvider,
  SafetyInput,
  SafetyOutput,
  SafetyDecision,
  SafetyCategory,
  SafetyAction,
} from '../types';
import { signAwsRequest, getAwsCredentials } from '../aws-sigv4.server';
import { AiBudgetManager } from '../budget.server';

export class BedrockSafetyProvider implements SafetyProvider {
  public readonly id = 'bedrock';

  private async callApplyGuardrail(
    text: string,
    source: 'INPUT' | 'OUTPUT'
  ): Promise<SafetyDecision> {
    // 1. Budget Circuit Breaker check: fail closed if tripped
    if (AiBudgetManager.isCircuitBreakerTripped()) {
      console.warn('[bedrock-safety] Circuit breaker active. Failing closed.');
      return {
        action: 'unavailable',
        category: 'safety_service_unavailable',
        sanitizedReason: 'Safety service budget ceiling reached.',
      };
    }

    const credentials = getAwsCredentials();
    const region = process.env.AWS_REGION || 'us-east-1';
    const guardrailId = process.env.AWS_BEDROCK_GUARDRAIL_ID;
    const guardrailVersion = process.env.AWS_BEDROCK_GUARDRAIL_VERSION || 'DRAFT';

    if (!credentials || !guardrailId) {
      console.warn('[bedrock-safety] AWS Bedrock credentials or guardrail ID missing.');
      return {
        action: 'unavailable',
        category: 'safety_service_unavailable',
        sanitizedReason: 'Safety service is not configured.',
      };
    }

    const url = `https://bedrock-runtime.${region}.amazonaws.com/guardrail/${encodeURIComponent(
      guardrailId
    )}/version/${encodeURIComponent(guardrailVersion)}/apply`;

    const body = JSON.stringify({
      source,
      content: [{ text: { text } }],
    });

    const startTime = Date.now();

    try {
      const signedHeaders = await signAwsRequest({
        method: 'POST',
        url,
        region,
        service: 'bedrock',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
        credentials,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: signedHeaders,
        body,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        console.error(`[bedrock-safety] Bedrock API returned HTTP ${response.status}`);
        return {
          action: 'unavailable',
          category: 'safety_service_unavailable',
          sanitizedReason: 'Safety evaluation failed.',
          latencyMs,
        };
      }

      const data: any = await response.json();
      
      // Calculate estimated cost: $0.00075 per 1,000 text units (1 unit = 1,000 characters)
      const textUnits = Math.ceil(text.length / 1000);
      const estimatedCost = (textUnits * 0.00075) / 1000;
      AiBudgetManager.recordExpense(estimatedCost);

      const action = data.action === 'GUARDRAIL_INTERVENED' ? 'refuse' : 'allow';
      let category: SafetyCategory = 'allowed_wellbeing';

      if (action === 'refuse') {
        // Inspect assessments without leaking internal guardrail names
        const assessments = data.assessments || [];
        category = this.mapAssessmentToCategory(assessments, text);
        
        // If crisis/self-harm detected, upgrade to 'crisis' action
        if (category === 'immediate_crisis' || category === 'passive_self_harm_risk') {
          return {
            action: 'crisis',
            category,
            sanitizedReason: 'Crisis or self-harm risk detected.',
            latencyMs,
            estimatedCostUsd: estimatedCost,
          };
        }

        return {
          action: 'refuse',
          category,
          sanitizedReason: 'Content does not meet safety policies.',
          latencyMs,
          estimatedCostUsd: estimatedCost,
        };
      }

      return {
        action: 'allow',
        category: 'allowed_wellbeing',
        latencyMs,
        estimatedCostUsd: estimatedCost,
      };
    } catch (err: any) {
      console.error('[bedrock-safety] Request error:', err?.message || err);
      return {
        action: 'unavailable',
        category: 'safety_service_unavailable',
        sanitizedReason: 'Safety service unavailable.',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private mapAssessmentToCategory(assessments: any[], text: string): SafetyCategory {
    const textLower = text.toLowerCase();
    
    // Check for crisis indicators
    if (
      textLower.includes('suicide') ||
      textLower.includes('kill myself') ||
      textLower.includes('end my life') ||
      textLower.includes('overdose') ||
      textLower.includes('want to die')
    ) {
      return 'immediate_crisis';
    }

    if (
      textLower.includes('hopeless') ||
      textLower.includes('no reason to live') ||
      textLower.includes('hurting myself')
    ) {
      return 'passive_self_harm_risk';
    }

    // Check for prescription / medical dosage request
    if (
      textLower.includes('dose') ||
      textLower.includes('dosage') ||
      textLower.includes('prescribe') ||
      textLower.includes('mg of')
    ) {
      return 'dosage_or_prescription_request';
    }

    if (
      textLower.includes('diagnose') ||
      textLower.includes('do i have') ||
      textLower.includes('symptoms of cancer')
    ) {
      return 'medical_or_diagnostic_request';
    }

    // Check for prompt injection
    if (
      textLower.includes('ignore previous instructions') ||
      textLower.includes('system prompt') ||
      textLower.includes('jailbreak')
    ) {
      return 'prompt_injection';
    }

    return 'emotional_distress';
  }

  public async evaluateInput(input: SafetyInput): Promise<SafetyDecision> {
    return this.callApplyGuardrail(input.text, 'INPUT');
  }

  public async evaluateOutput(output: SafetyOutput): Promise<SafetyDecision> {
    return this.callApplyGuardrail(output.text, 'OUTPUT');
  }
}
