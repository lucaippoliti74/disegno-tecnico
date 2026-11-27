/**
 * @typedef {{mimeType: 'image/jpeg', base64: string}} AIImage
 * @typedef {{systemPrompt: string, userPrompt: string, images: AIImage[],
 *   tier: 'default'|'complex'}} AIRequest
 * @typedef {{inputTokens?: number, outputTokens?: number, totalTokens?: number}} AIUsage
 * @typedef {{data: object, usage?: AIUsage}} AIResult
 * @typedef {{generateStructured(request: AIRequest, signal: AbortSignal): Promise<AIResult>}} AIProvider
 * @typedef {{generate(request: AIRequest, signal: AbortSignal): Promise<{text: string, usage?: AIUsage}>}} AIAdapter
 */

export class AIProviderError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AIProviderError';
    this.code = code;
  }
}

export class AIRateLimitError extends AIProviderError {
  constructor() {
    super('rate_limited');
    this.name = 'AIRateLimitError';
  }
}

export class AIAuthError extends AIProviderError {
  constructor() {
    super('authentication');
    this.name = 'AIAuthError';
  }
}
