import {AIProviderError} from '../port.mjs';
import {dataUrl, postJson} from './http.mjs';

/** @returns {import('../port.mjs').AIAdapter} */
export function openAICompatibleAdapter({apiKey, baseUrl, models, maxOutputTokens, tokenField, jsonMode, fetcher}) {
  return {
    async generate({systemPrompt, userPrompt, images, tier}, signal) {
      const headers = apiKey ? {Authorization: 'Bearer ' + apiKey} : {};
      const result = await postJson(fetcher, baseUrl + '/chat/completions', {
        model: models[tier],
        [tokenField]: maxOutputTokens,
        ...(jsonMode && {response_format: {type: 'json_object'}}),
        messages: [
          {role: 'system', content: systemPrompt},
          {role: 'user', content: [
            {type: 'text', text: userPrompt},
            ...images.map(image => ({type: 'image_url', image_url: {url: dataUrl(image)}})),
          ]},
        ],
      }, headers, signal);

      const choice = result?.choices?.[0];
      if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') {
        throw new AIProviderError('refused');
      }
      if (choice?.finish_reason != null && choice.finish_reason !== 'stop') {
        throw new AIProviderError('invalid_json');
      }
      const usage = result?.usage;
      return {
        text: choice?.message?.content,
        usage: usage && {inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, totalTokens: usage.total_tokens},
      };
    },
  };
}
