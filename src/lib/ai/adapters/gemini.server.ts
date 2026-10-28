import type { GenerationProvider, GenerationRequest, GenerationResult } from '../types';

export class GeminiGenerationProvider implements GenerationProvider {
  public readonly id = 'gemini';

  public async generate(request: GenerationRequest): Promise<GenerationResult> {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('[ai-generation] Generation service is not properly configured.');
    }

    const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Inject user summary context into the system instructions if available
    let systemInstruction = request.systemPrompt;
    if (request.userContext?.summaryText) {
      systemInstruction += `\n\nContinuity Context (Approved user-stated preferences and non-clinical memory):\n${request.userContext.summaryText}`;
    }

    // Convert messages to Gemini contents structure
    const contents = request.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const payload = {
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 1024,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error(`[ai-generation] Provider HTTP error ${response.status}: ${errBody}`);
        throw new Error('[ai-generation] Provider failed to produce a valid response.');
      }

      const data: any = await response.json();
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || '';
      
      let finishReason: GenerationResult['finishReason'] = 'stop';
      if (candidate?.finishReason === 'MAX_TOKENS') finishReason = 'length';
      else if (candidate?.finishReason === 'SAFETY') finishReason = 'safety';

      return {
        text,
        finishReason,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
          totalTokens: data.usageMetadata?.totalTokenCount,
        },
      };
    } catch (err: any) {
      console.error('[ai-generation] Provider request failed:', err?.message || err);
      throw new Error('[ai-generation] An error occurred while generating the response.');
    }
  }
}
