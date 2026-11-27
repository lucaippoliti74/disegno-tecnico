import {readFileSync} from 'node:fs';
import {AIProviderError} from '../ai/port.mjs';

const systemPrompt = readFileSync(new URL('../prompts/system.md', import.meta.url), 'utf8').trim();

/** @param {import('../ai/port.mjs').AIProvider} ai */
export async function evaluate(ai, input, signal) {
  const {data} = await ai.generateStructured({
    systemPrompt,
    userPrompt: input.prompt,
    images: input.images.map(base64 => ({mimeType: 'image/jpeg', base64})),
    tier: input.tier,
  }, signal);
  if (!Array.isArray(data.criteri) && !Array.isArray(data.misure)) {
    throw new AIProviderError('invalid_json');
  }
  return data;
}
