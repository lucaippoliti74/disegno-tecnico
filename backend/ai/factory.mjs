import {openAIResponsesAdapter} from './adapters/openai-responses.mjs';
import {openAICompatibleAdapter} from './adapters/openai-compatible.mjs';
import {mockAdapter} from './adapters/mock.mjs';
import {withResilience} from './resilience.mjs';

const adapters = {
  openai: openAIResponsesAdapter,
  'openai-compatible': openAICompatibleAdapter,
  mock: ({mockReply}) => mockAdapter(mockReply),
};

function positiveInteger(value, fallback, name) {
  const number = Number(value || fallback);
  if (!Number.isSafeInteger(number) || number < 1 || number > 2147483647) {
    throw new Error(name + ' deve essere un intero positivo valido.');
  }
  return number;
}

function normalizeBaseUrl(value) {
  if (!value) throw new Error('Configura AI_BASE_URL per il servizio compatibile.');
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('AI_BASE_URL deve usare HTTPS, oppure HTTP su loopback, e deve contenere solo origine e percorso.');
  }
  return url.href.replace(/\/+$/, '');
}

export function createAIProvider(env, {fetcher = fetch, mockReply} = {}) {
  const provider = env.AI_PROVIDER?.trim() || 'openai';
  if (!Object.hasOwn(adapters, provider)) throw new Error('AI_PROVIDER non riconosciuto.');
  const timeoutMs = positiveInteger(env.AI_TIMEOUT_MS, 100000, 'AI_TIMEOUT_MS');
  if (provider === 'mock') return withResilience(adapters.mock({mockReply}), timeoutMs);

  const openai = provider === 'openai';
  const model = env.AI_MODEL?.trim();
  const models = {
    default: model || (openai && (env.OPENAI_FAST_MODEL || 'gpt-4.1-mini')),
    complex: env.AI_COMPLEX_MODEL?.trim() || model || (openai && (env.OPENAI_ACCURATE_MODEL || 'gpt-4.1')),
  };
  if (!models.default) throw new Error('Configura AI_MODEL per il servizio compatibile.');
  const apiKey = env.AI_API_KEY?.trim() || (openai ? env.OPENAI_API_KEY?.trim() : undefined);
  if (openai && !apiKey) throw new Error('Configura AI_API_KEY.');
  const baseUrl = normalizeBaseUrl(env.AI_BASE_URL?.trim() || (openai && 'https://api.openai.com/v1'));
  const maxOutputTokens = positiveInteger(env.AI_MAX_OUTPUT_TOKENS, 6500, 'AI_MAX_OUTPUT_TOKENS');
  const tokenField = env.AI_CHAT_TOKEN_FIELD || 'max_tokens';
  const jsonMode = env.AI_CHAT_JSON_MODE || 'true';
  if (!openai && (!['max_tokens', 'max_completion_tokens'].includes(tokenField) ||
                  !['true', 'false'].includes(jsonMode))) {
    throw new Error('Configura AI_CHAT_TOKEN_FIELD e AI_CHAT_JSON_MODE con valori supportati.');
  }
  return withResilience(adapters[provider]({
    apiKey, baseUrl, models, maxOutputTokens, tokenField, jsonMode: jsonMode === 'true', fetcher,
  }), timeoutMs);
}
