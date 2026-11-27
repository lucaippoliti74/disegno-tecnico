import {cpSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const endpoint = process.env.ANALYSIS_ENDPOINT?.trim() || '';
let connect = "'self'";
if (endpoint) {
  const url = new URL(endpoint);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.pathname !== '/api/valuta' || url.username || url.password || url.search || url.hash ||
      !/^[a-z\d.-]+$/i.test(url.hostname)) {
    throw Error('ANALYSIS_ENDPOINT deve essere l’indirizzo del backend con percorso /api/valuta.');
  }
  connect += ' ' + url.origin;
}

mkdirSync('dist/vendor', {recursive: true});
for (const file of ['app.js', 'api.js', 'geometria.js']) cpSync('site/' + file, 'dist/' + file);
const html = readFileSync('site/index.html', 'utf8').replace(/connect-src [^;]+;/, 'connect-src ' + connect + ';');
writeFileSync('dist/index.html', html);
writeFileSync('dist/config.js', 'window.CT_ENDPOINT = ' + JSON.stringify(endpoint) + ';\n');
const pdf = 'node_modules/pdfjs-dist/';
for (const file of ['pdf.min.mjs', 'pdf.worker.min.mjs']) cpSync(pdf + 'legacy/build/' + file, 'dist/vendor/' + file);
for (const file of ['LICENSE', 'cmaps', 'standard_fonts']) cpSync(pdf + file, 'dist/vendor/' + file, {recursive: true});

mkdirSync('dist/fonts', {recursive: true});
const fontCss = [];
for (const [name, family, weights] of [
  ['barlow', 'Barlow', [400, 500, 600]],
  ['barlow-semi-condensed', 'Barlow Semi Condensed', [500, 600]],
  ['caveat', 'Caveat', [700]],
]) {
  const source = 'node_modules/@fontsource/' + name;
  cpSync(source + '/LICENSE', 'dist/fonts/' + name + '-LICENSE');
  for (const weight of weights) {
    const file = name + '-latin-' + weight + '-normal.woff2';
    cpSync(source + '/files/' + file, 'dist/fonts/' + file);
    fontCss.push(`@font-face {font-family: "${family}"; font-weight: ${weight}; font-display: swap; src: url("./${file}") format("woff2");}`);
  }
}
writeFileSync('dist/fonts/fonts.css', fontCss.join('\n'));
