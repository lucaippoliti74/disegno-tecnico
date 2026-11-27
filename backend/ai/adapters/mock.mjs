/** @returns {import('../port.mjs').AIAdapter} */
export function mockAdapter(reply) {
  if (typeof reply !== 'function') throw new Error('AI_PROVIDER=mock richiede una fixture iniettata nei test.');
  return {
    async generate(request, signal) {
      return {text: JSON.stringify(await reply(request, signal))};
    },
  };
}
