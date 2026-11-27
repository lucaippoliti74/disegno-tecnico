import {AIProviderError} from '../port.mjs';
import {dataUrl, postJson} from './http.mjs';

/** @returns {import('../port.mjs').AIAdapter} */
export function openAIResponsesAdapter({apiKey, baseUrl, models, maxOutputTokens, fetcher}) {
  return {
    async generate({systemPrompt, userPrompt, images, tier}, signal) {
      const result = await postJson(fetcher, baseUrl + '/responses', {
        model: models[tier],
        store: false,
        max_output_tokens: maxOutputTokens,
        text: {format: {type: 'json_object'}},
        instructions: systemPrompt,
        input: [{role: 'user', content: [
          {type: 'input_text', text: userPrompt},
          ...images.map(image => ({type: 'input_image', image_url: dataUrl(image), detail: 'high'})),
        ]}],
      }, {Authorization: 'Bearer ' + apiKey}, signal);

      const parts = (result?.output ?? []).flatMap(item => item.type === 'message' ? item.content : []);
      if (parts.some(part => part.type === 'refusal')) throw new AIProviderError('refused');
      if (result?.status !== 'completed') throw new AIProviderError('invalid_json');
      const usage = result.usage;
      return {
        text: parts.filter(part => part.type === 'output_text').map(part => part.text).join(''),
        usage: usage && {inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, totalTokens: usage.total_tokens},
      };
    },
  };
}
