import {test, expect} from '@playwright/test';
import {mkdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';

const origin = 'http://127.0.0.1:4273';
const endpoint = 'http://127.0.0.1:4274/api/valuta';
const token = 'A'.repeat(43);
const codeFor = info => info.project.name === 'mobile' ? 'B'.repeat(43) : token;

async function drawing(page) {
  const base64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1000;
    c.height = 707;
    const g = c.getContext('2d');
    g.fillStyle = 'white';
    g.fillRect(0,0,1000,707);
    g.strokeRect(60,60,880,587);
    g.beginPath();
    g.moveTo(200,400);
    g.lineTo(650,400);
    g.lineTo(800,250);
    g.lineTo(350,250);
    g.closePath();
    g.moveTo(200,400);
    g.lineTo(200,100);
    g.lineTo(650,100);
    g.lineTo(650,400);
    g.stroke();
    return c.toDataURL('image/jpeg').split(',')[1];
  });
  return {name:'tavola-sintetica.jpg',mimeType:'image/jpeg',buffer:Buffer.from(base64,'base64')};
}

function pdfFixture() {
  const stream = '20 20 m 280 180 l S\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /Resources << >> /MediaBox [0 0 300 200] /Contents 4 0 R >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream',
    '<< /Type /Page /Parent 2 0 R /Resources << >> /MediaBox [0 0 300 200] /Contents 4 0 R >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
    return String(offset).padStart(10,'0') + ' 00000 n \n';
  });
  const xref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n' + offsets.join('') +
    'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return {name:'riferimento-sintetico.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)};
}

async function screenshot(page, info, suffix) {
  const dir = process.env.SCREENSHOT_DIR;
  if (!dir) return;
  await mkdir(dir, {recursive:true});
  const path = join(dir, info.project.name + '-' + suffix + '.png');
  if (suffix === 'sovrapposizione') {
    await page.locator('.provamod').screenshot({path, animations:'disabled'});
  } else {
    await page.locator('#toast').waitFor({state:'hidden'});
    await page.evaluate(() => scrollTo({top:0, behavior:'instant'}));
    await page.screenshot({path, fullPage:true, animations:'disabled'});
  }
}

test('griglie, profili, foto, salvataggio e CSV', async ({page}, info) => {
  const issues = [];
  page.on('pageerror', error => issues.push(error.message));
  page.on('console', msg => {if (msg.type() === 'error' && /Content Security Policy/.test(msg.text())) issues.push(msg.text())});
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page.locator('#preset option')).not.toHaveCount(0);
  await expect(page.locator('#tot')).toHaveText('Totale 100%');
  const width = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(width[0]).toBeLessThanOrEqual(width[1] + 1);
  await page.locator('#fFile').setInputFiles(await drawing(page));
  await expect(page.locator('#vbox')).toBeVisible();
  await page.locator('[data-t=ok]').click();
  await expect(page.locator('#pbox')).toBeVisible();
  await page.locator('#prof').selectOption('pei-diff');
  await expect(page.locator('#valuta')).toBeDisabled();
  await page.locator('#prof').selectOption('pdp');
  await page.locator('#pEs').selectOption('dispensata');
  await expect(page.locator('#pw-esecutiva')).toHaveValue('0');
  await page.locator('#valuta').click();
  await expect(page.locator('#err')).toContainText('Inserisci il codice');
  await page.locator('#token').fill(codeFor(info));
  await page.locator('#anonimo').check();
  await page.locator('#valuta').click();
  await expect(page.locator('#giud')).toHaveValue(/Buona costruzione/);
  await expect(page.locator('#scheda')).toContainText('Valutazione secondo PDP');
  await page.locator('#codice').fill('CODICE-LOCALE');
  await page.locator('[data-a=piu]').first().click();
  await expect(page.locator('#saveSt')).toContainText('Salvata');
  await expect(page.locator('#rlist')).toContainText('CODICE-LOCALE');
  await screenshot(page, info, 'scheda');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#rCsv').click();
  const download = await downloadPromise;
  expect(await readFile(await download.path(), 'utf8')).toContain('CODICE-LOCALE');
  await page.reload();
  await expect(page.locator('#token')).toHaveValue('');
  await page.locator('#rlist summary').click();
  await page.locator('[data-r=apri]').click();
  await expect(page.locator('#codice')).toHaveValue('CODICE-LOCALE');
  await page.locator('#rf').fill('INESISTENTE');
  await expect(page.locator('#rlist')).toContainText('Nessuna tavola trovata');
  await page.locator('#rf').fill('');
  await page.locator('[data-a=elimina]').click();
  await page.locator('[data-a=elimina]').click();
  await expect(page.locator('#rlist')).not.toContainText('CODICE-LOCALE');
  expect(issues).toEqual([]);
});

test('PDF multipagina e controprova geometrica', async ({page}, info) => {
  await page.goto('/');
  await page.locator('#fRef').setInputFiles(pdfFixture());
  await page.getByRole('button',{name:'Pagina 2',exact:true}).click();
  await expect(page.locator('#refName')).toContainText('pagina 2');
  const image = await drawing(page);
  await page.evaluate(() => {
    const events = [];
    const toast = document.querySelector('#toast');
    document.querySelector('#fRef').addEventListener('change', event => events.push(event.target.files[0]?.type));
    new MutationObserver(() => {if (!toast.hidden) events.push(toast.textContent)}).observe(toast, {attributes:true, childList:true});
    window.testReferenceEvents = events;
  });
  await page.locator('#fRef').setInputFiles(image);
  try {
    await expect(page.locator('#refName')).toContainText(image.name);
  } catch (error) {
    console.log('Eventi di sostituzione del riferimento:', await page.evaluate(() => window.testReferenceEvents));
    throw error;
  }
  const asso = await page.evaluate(() => Object.keys(window.CT.PRESETS).find(key => window.CT.PRESETS[key].asso));
  await page.locator('#preset').selectOption(asso);
  await page.locator('#fFile').setInputFiles(image);
  await page.locator('[data-t=ok]').click();
  await page.locator('#accesso summary').click();
  await page.locator('#token').fill(codeFor(info));
  await page.locator('#anonimo').check();
  await page.locator('#valuta').click();
  await expect(page.locator('.provamod')).toBeVisible();
  await expect(page.locator('.provamod img')).toBeVisible();
  await page.locator('[data-pv=man]').click();
  await expect(page.locator('.sovmod canvas')).toBeVisible();
  await page.locator('#sa').click();
  await expect(page.locator('.provamod')).toContainText('Allineata a mano');
  await screenshot(page, info, 'sovrapposizione');
  await page.locator('[data-pv=go]').click();
  await expect(page.locator('.ver')).toContainText('Misure sulle assonometrie');
});

test('il backend blocca origini, codici e corpi non validi', async ({request}) => {
  const post = (origin, code, data) => request.post(endpoint, {
    headers:{Origin:origin, Authorization:'Bearer ' + code, 'Content-Type':'application/json'}, data,
  });
  expect((await post('https://esempio.invalid',token,{})).status()).toBe(403);
  expect((await post(origin,'Z'.repeat(43),{})).status()).toBe(401);
  expect((await post(origin,token,{prompt:'test',tier:'complex',images:['abc!']})).status()).toBe(400);
});
