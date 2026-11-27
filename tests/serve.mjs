import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {createBackend} from '../backend/server.mjs';

const endpoint = 'http://127.0.0.1:4274/api/valuta';
process.env.ANALYSIS_ENDPOINT = endpoint;
await import('../scripts/build.mjs');
const tokens = ['A', 'B'].map(letter => letter.repeat(43));
const origin = 'http://127.0.0.1:4273';
const axes = {x:[200,400,650,400], y:[200,400,350,250], z:[200,400,200,100]};
const points = [[200,400],[650,400],[350,250],[200,100],[500,250],[500,400],[350,400],[500,100]];
const measure = {
  tipo:'cavaliera', tavola:axes, base:{fonte:'riferimento', tipo:'cavaliera', ...axes},
  origine:{tavola:[200,400], base:[200,400], come:'segnata'},
  punti:points.map((value, i) => ({nome: String.fromCharCode(65 + i), tavola:value, base:value})),
  reali:{x:80,y:40,z:60},
};
createBackend({
  FRONTEND_ORIGIN: origin,
  OPENAI_API_KEY: 'server-test',
  TEACHER_TOKEN_HASHES: tokens.map(token => createHash('sha256').update(token).digest('hex')).join(','),
  QUOTA_DB: ':memory:',
}, async (url, request) => {
  const body = JSON.parse(request.body);
  const [text, ...images] = body.input[0].content;
  if (url !== 'https://api.openai.com/v1/responses' || request.headers.Authorization !== 'Bearer server-test' ||
      body.store !== false || !images.every(img => img.image_url.startsWith('data:image/jpeg;base64,')) ||
      /CODICE-LOCALE|Valutazione secondo PDP|Valutazione secondo PEI/.test(text.text)) {
    throw Error('Contratto del servizio non rispettato');
  }
  const test = text.text.startsWith('FASE PRELIMINARE');
  if (test && images.length !== 4) throw Error('Immagini della controprova incomplete');
  const result = test ? {misure:[measure]} : {
    giudizio: 'Buona costruzione. Verifica le linee di proiezione.',
    criteri: ['metodo','norme','completezza','esecutiva'].map(id => ({id, punteggio: 8})),
    leggibile: true,
    misure: [measure],
  };
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});
}).listen(4274, '127.0.0.1');

const root = resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
createServer(async (req,res) => {
  const file = resolve(root, '.' + (req.url === '/' ? '/index.html' : req.url));
  try {
    if (!file.startsWith(root + sep)) throw Error();
    const data = await readFile(file);
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4273, '127.0.0.1');
