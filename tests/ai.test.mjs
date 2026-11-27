import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createAIProvider} from '../backend/ai/factory.mjs';
import {AIAuthError, AIRateLimitError} from '../backend/ai/port.mjs';
import {evaluate} from '../backend/application/evaluate.mjs';

const signal = () => new AbortController().signal;
const input = {prompt:'Richiesta di prova', images:['/9j/2Q=='], tier:'complex'};
const request = {
  systemPrompt:'Rispondi in italiano con JSON.',
  userPrompt:input.prompt,
  images:input.images.map(base64 => ({mimeType:'image/jpeg', base64})),
  tier:'complex',
};
const grading = {criteri:[{id:'metodo', punteggio:8}]};
const networkForbidden = () => assert.fail('chiamata di rete inattesa');

test('la valutazione e la controprova usano la stessa porta con il mock', async () => {
  for (const expected of [grading, {misure:[]}]) {
    const ai = createAIProvider({AI_PROVIDER:'mock'}, {
      fetcher:networkForbidden,
      mockReply: actual => {
        assert.match(actual.systemPrompt, /tavole scolastiche/);
        assert.equal(actual.userPrompt, input.prompt);
        assert.deepEqual(actual.images, request.images);
        assert.equal(actual.tier, 'complex');
        return expected;
      },
    });
    assert.deepEqual(await evaluate(ai, input, signal()), expected);
  }
});

test('oggetti JSON estranei alla valutazione e alla controprova vengono respinti', async () => {
  const ai = createAIProvider({AI_PROVIDER:'mock'}, {mockReply: () => ({voto:8})});
  await assert.rejects(evaluate(ai, input, signal()), {code:'invalid_json'});
});

test('Responses mantiene configurazione preesistente, immagini, privacy e utilizzo', async () => {
  const ai = createAIProvider({
    OPENAI_API_KEY:'secret', OPENAI_ACCURATE_MODEL:'vision-previous',
  }, {fetcher: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer secret');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'vision-previous');
    assert.equal(body.instructions, request.systemPrompt);
    assert.equal(body.max_output_tokens, 6500);
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, 'json_object');
    assert.deepEqual(body.input[0].content, [
      {type:'input_text', text:input.prompt},
      {type:'input_image', image_url:'data:image/jpeg;base64,/9j/2Q==', detail:'high'},
    ]);
    return Response.json({
      status:'completed', output:[{type:'message', content:[{type:'output_text', text:JSON.stringify(grading)}]}],
      usage:{input_tokens:2, output_tokens:3, total_tokens:5},
    });
  }});
  assert.deepEqual(await ai.generateStructured(request, signal()), {
    data:grading, usage:{inputTokens:2, outputTokens:3, totalTokens:5},
  });
});

const compatibleEnv = {
  AI_PROVIDER:'openai-compatible', AI_BASE_URL:'http://127.0.0.1:11434/v1/',
  AI_MODEL:'vision', AI_CHAT_JSON_MODE:'false', AI_CHAT_TOKEN_FIELD:'max_completion_tokens',
};

test('lo stesso caso d’uso funziona con Chat Completions, configurando endpoint e modello', async () => {
  const ai = createAIProvider(compatibleEnv, {fetcher: async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/v1/chat/completions');
    assert.equal(options.headers.Authorization, undefined);
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'vision');
    assert.equal(body.max_completion_tokens, 6500);
    assert.equal(body.response_format, undefined);
    assert.match(body.messages[0].content, /tavole scolastiche/);
    assert.deepEqual(body.messages[1].content, [
      {type:'text', text:input.prompt},
      {type:'image_url', image_url:{url:'data:image/jpeg;base64,/9j/2Q=='}},
    ]);
    return Response.json({choices:[{finish_reason:'stop', message:{content:JSON.stringify(grading)}}]});
  }});
  assert.deepEqual(await evaluate(ai, input, signal()), grading);
});

test('gli adattatori normalizzano autenticazione, rate limit e rifiuto', async () => {
  for (const env of [compatibleEnv, {AI_API_KEY:'secret'}]) {
    for (const [status, type] of [[401, AIAuthError], [429, AIRateLimitError]]) {
      const ai = createAIProvider(env, {fetcher:async () => new Response('detail', {status})});
      await assert.rejects(ai.generateStructured(request, signal()), type);
    }
    const body = env === compatibleEnv
      ? {choices:[{message:{refusal:'no'}}]}
      : {status:'completed', output:[{type:'message', content:[{type:'refusal'}]}]};
    const ai = createAIProvider(env, {fetcher:async () => Response.json(body)});
    await assert.rejects(ai.generateStructured(request, signal()), {code:'refused'});
  }
});

test('le risposte troncate e il JSON malformato generano lo stesso errore pubblico', async () => {
  for (const choice of [
    {finish_reason:'length', message:{content:'{}'}},
    {finish_reason:'stop', message:{content:'non JSON'}},
  ]) {
    const ai = createAIProvider(compatibleEnv, {
      fetcher:async () => Response.json({choices:[choice]}),
    });
    await assert.rejects(ai.generateStructured(request, signal()), {code:'invalid_json'});
  }
});

test('il timeout è comune e l’annullamento del chiamante viene preservato', async () => {
  const ai = createAIProvider({...compatibleEnv, AI_TIMEOUT_MS:'10'}, {
    fetcher:async (url, options) => {
      const keepAlive = setTimeout(() => {}, 1000);
      try {
        await new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), {once:true});
        });
      } finally {
        clearTimeout(keepAlive);
      }
    },
  });
  await assert.rejects(ai.generateStructured(request, signal()), {code:'timeout'});
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(ai.generateStructured(request, controller.signal), {name:'AbortError'});
});

test('la factory respinge configurazioni invalide all’avvio', () => {
  assert.throws(() => createAIProvider({AI_PROVIDER:'toString'}), /AI_PROVIDER/);
  assert.throws(() => createAIProvider({...compatibleEnv, AI_BASE_URL:'http://remote.test/v1'}), /HTTPS/);
  assert.throws(() => createAIProvider({...compatibleEnv, AI_BASE_URL:'https://user:pass@remote.test/v1'}), /HTTPS/);
  assert.throws(() => createAIProvider({...compatibleEnv, AI_MODEL:''}), /AI_MODEL/);
});
