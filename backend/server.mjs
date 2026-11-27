import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';

import {evaluate} from './application/evaluate.mjs';
import {AIProviderError} from './ai/port.mjs';
import {createAIProvider} from './ai/factory.mjs';

const MiB = 1024 * 1024;
const maxBody = 12 * MiB;
const hash = token => createHash('sha256').update(token).digest('hex');

class RequestError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

async function readInput(req) {
  if (req.headers['content-type'] !== 'application/json') {
    throw new RequestError(415, 'invalid_json');
  }
  if (Number(req.headers['content-length']) > maxBody) {
    throw new RequestError(413, 'prompt_too_large');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({destroyOnReturn: false})) {
    size += chunk.length;
    if (size > maxBody) throw new RequestError(413, 'prompt_too_large');
    chunks.push(chunk);
  }
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'invalid_json');
  }
  if (!input || typeof input.prompt !== 'string' || !input.prompt.trim() ||
      input.prompt.length > 24000 || !['default','complex'].includes(input.tier) ||
      !Array.isArray(input.images) || !input.images.length || input.images.length > 8) {
    throw new RequestError(400, 'invalid_json');
  }
  for (const image of input.images) {
    if (typeof image !== 'string' || image.length > Math.ceil(MiB / 3) * 4 ||
        image.length % 4 || /[^A-Za-z0-9+/=]/.test(image)) {
      throw new RequestError(400, 'image_rejected');
    }
    const jpeg = Buffer.from(image, 'base64');
    if (jpeg.length < 5 || jpeg.length > MiB || jpeg[0] !== 255 || jpeg[1] !== 216 ||
        jpeg.at(-2) !== 255 || jpeg.at(-1) !== 217 || jpeg.toString('base64') !== image) {
      throw new RequestError(400, 'image_rejected');
    }
  }
  return input;
}

export function createBackend(env = process.env, fetcher = fetch, {mockReply} = {}) {
  const url = new URL(env.FRONTEND_ORIGIN ?? '');
  const local = ['127.0.0.1','localhost'].includes(url.hostname);
  const teachers = new Set((env.TEACHER_TOKEN_HASHES ?? '').split(',').map(value => value.trim()));
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.origin !== env.FRONTEND_ORIGIN || !env.QUOTA_DB ||
      ![...teachers].every(value => /^[a-f0-9]{64}$/.test(value))) {
    throw new Error('Configura origine, hash dei docenti e database delle quote.');
  }
  const ai = createAIProvider(env, {fetcher, mockReply});
  const db = new DatabaseSync(env.QUOTA_DB, {timeout: 5000});
  db.exec('CREATE TABLE IF NOT EXISTS usage (bucket TEXT, subject TEXT, n INTEGER NOT NULL, PRIMARY KEY (bucket, subject))');
  const lookup = db.prepare('SELECT n FROM usage WHERE bucket=? AND subject=?');
  const increment = db.prepare('INSERT INTO usage VALUES (?, ?, 1) ON CONFLICT DO UPDATE SET n=n+1');
  const prune = db.prepare('DELETE FROM usage WHERE substr(bucket, 1, 10) < ?');
  const active = new Set();

  function reserve(id) {
    const now = new Date();
    const iso = now.toISOString();
    const rules = [[iso.slice(0, 16), id, 5], [iso.slice(0, 10), id, 30], [iso.slice(0, 10), '*', 120]];
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [bucket, subject, limit] of rules) {
        if ((lookup.get(bucket, subject)?.n ?? 0) >= limit) throw new RequestError(429, 'rate_limited');
        increment.run(bucket, subject);
      }
      prune.run(new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  const server = createServer({requestTimeout: 30000, headersTimeout: 10000}, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const send = (status, body) => {
      if (res.destroyed) return;
      res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(JSON.stringify(body));
    };
    if (req.url !== '/api/valuta') return send(404, {error:'not_found'});
    if (req.headers.origin !== url.origin) return send(403, {error:'not_granted'});
    res.setHeader('Access-Control-Allow-Origin', url.origin);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
      });
      return res.end();
    }
    if (req.method !== 'POST') return send(405, {error:'not_found'});
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '');
    const id = match && hash(match[1]);
    if (!teachers.has(id)) return send(401, {error:'not_granted'});
    if (active.has(id) || active.size >= 3) return send(429, {error:'rate_limited'});
    active.add(id);
    const abort = new AbortController();
    res.once('close', () => abort.abort());
    try {
      const input = await readInput(req);
      if (abort.signal.aborted) return;
      reserve(id);
      send(200, {result: await evaluate(ai, input, abort.signal)});
    } catch (error) {
      if (!abort.signal.aborted) {
        if (error instanceof RequestError) return send(error.status, {error: error.message});
        if (error instanceof AIProviderError) {
          if (error.code === 'rate_limited') return send(429, {error: error.code});
          if (error.code === 'refused') return send(422, {error: error.code});
          if (error.code === 'invalid_json') return send(502, {error: error.code});
        }
        send(502, {error: 'upstream_error'});
      }
    } finally {
      active.delete(id);
    }
  });
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createBackend().listen(Number(process.env.PORT ?? 8787), process.env.HOST ?? '127.0.0.1',
    () => console.log('Backend di Correzione tavole in ascolto'));
}
