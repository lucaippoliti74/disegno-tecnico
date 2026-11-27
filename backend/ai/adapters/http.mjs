import {AIAuthError, AIProviderError, AIRateLimitError} from '../port.mjs';

export async function postJson(fetcher, url, body, headers, signal) {
  const response = await fetcher(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...headers},
    body: JSON.stringify(body),
    redirect: 'error',
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 429) throw new AIRateLimitError();
    if (response.status === 401 || response.status === 403) throw new AIAuthError();
    throw new AIProviderError('upstream_error');
  }
  try {
    return await response.json();
  } catch {
    throw new AIProviderError('invalid_json');
  }
}

export const dataUrl = image => `data:${image.mimeType};base64,${image.base64}`;
