import {AIProviderError} from './port.mjs';

/** @returns {import('./port.mjs').AIProvider} */
export function withResilience(adapter, timeoutMs) {
  return {
    async generateStructured(request, callerSignal) {
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = AbortSignal.any([callerSignal, timeout]);
      let result;
      try {
        signal.throwIfAborted();
        result = await adapter.generate(request, signal);
        signal.throwIfAborted();
      } catch (error) {
        if (callerSignal.aborted) throw callerSignal.reason;
        if (timeout.aborted) throw new AIProviderError('timeout');
        if (error instanceof AIProviderError) throw error;
        throw new AIProviderError('upstream_error');
      }

      try {
        if (typeof result.text !== 'string') throw new TypeError();
        const data = JSON.parse(result.text);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError();
        return {data, usage: result.usage};
      } catch {
        throw new AIProviderError('invalid_json');
      }
    },
  };
}
