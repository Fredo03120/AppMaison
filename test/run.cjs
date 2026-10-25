// Lancer : node test/run.cjs (il faut une fois : npm i -D playwright && npx playwright install chromium)
// Vérifie les 6 fonctions de priorité 1 dans un vrai navigateur, avec un faux Supabase.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.argv[2] || path.join(__dirname, '..', 'public'); const MOCK = fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8');
const OUT = path.join(require('os').tmpdir(), 'nos-recettes-test'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p === '/vendor/supabase-2.45.4.js') { res.setHeader('content-type', 'text/javascript'); return res.end(MOCK); }
  if (p === '/sw.js') { res.statusCode = 404; return res.end(); }
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
});
const ok = (c, m) => { if (!c) throw new Error('ÉCHEC : ' + m); console.log('ok  ' + m); };
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, locale: 'fr-FR' });
  const page = await ctx.newPage(); const errors = [];
  await page.goto(base); await page.evaluate(() => localStorage.clear());
  await page.addInitScript(() => { try { window.__offline = localStorage.getItem('mockOffline') === '1'; } catch (e) {} });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: true });
  await page.goto(base); await page.waitForSelector('#app .card', { timeout: 10000 });
  await shot('01-recettes');

  // Menu : ajouter deux recettes, poser l'une sur mardi soir.
  await page.click('[data-toggle="boeuf"]'); await page.click('[data-toggle="crepes"]'); await page.click('[data-view="menu"]');
  await page.waitForSelector('.slot'); ok(await page.locator('.week-sec').count() === 1, 'menu : tout est « à caser » au départ');
  await page.selectOption('[data-slot="boeuf"]', '1-soir'); await page.waitForTimeout(300);
  ok(await page.locator('.week-sec[data-key="w:1"] .mrow').count() === 1, 'planning : le bœuf est sur mardi');
  ok(await page.locator('.week-sec').count() === 8, 'planning : la semaine s’affiche (à caser + 7 jours)');
  const plan = window => window; await shot('02-menu-semaine');
  ok(await page.evaluate(() => __T.docs.find(d => d.path.endsWith('state/menu')).data.plan.boeuf === '1-soir'), 'planning : enregistré');

  // Courses : ordre des rayons, « on en a toujours », habituels.
  await page.click('[data-view="courses"]'); await page.waitForSelector('.shop section');
  const first = async () => page.locator('.shop section h2 span').first().innerText();
  ok((await first()).includes('Fruits'), 'rayons : Fruits & légumes en premier par défaut');
  await page.click('[data-act="rayons"]'); await page.waitForSelector('#rayons[open]');
  await page.click('[data-ray="Crèmerie & fromages"][data-d="-1"]'); await page.click('[data-ray="Crèmerie & fromages"][data-d="-1"]'); await page.click('[data-ray="Crèmerie & fromages"][data-d="-1"]');
  await shot('03-rayons'); await page.click('#rayons [data-close]'); await page.waitForTimeout(500);
  ok((await first()).includes('Crèmerie'), 'rayons : Crèmerie passé en premier');
  ok(await page.evaluate(() => __T.docs.find(d => d.path.endsWith('state/rayons')).data.order[0] === 'Crèmerie & fromages'), 'rayons : ordre enregistré pour le groupe');
  ok(await page.locator('.item[data-key="sel"]').count() === 1, 'placard : le sel est dans la liste');
  await page.click('.item[data-key="sel"] [data-always]'); await page.waitForTimeout(200);
  ok(await page.locator('.item[data-key="sel"]').count() === 0, 'on en a toujours : le sel a disparu');
  ok(await page.locator('.always .chip').count() === 1, 'on en a toujours : le sel est dans l’encart');
  await page.click('[data-act="habits"]'); await page.waitForSelector('#habituels[open]');
  await page.fill('#hab-in', 'Lait'); await page.press('#hab-in', 'Enter'); await page.fill('#hab-in', 'Papier toilette'); await page.press('#hab-in', 'Enter'); await page.fill('#hab-in', 'Pain'); await page.press('#hab-in', 'Enter');
  await page.waitForTimeout(200);
  ok(await page.locator('#hab-list .item.done').count() === 1, 'habituels : le lait (déjà dans les crêpes) est marqué « déjà dans la liste »');
  await page.check('#hab-list input[data-hab]:not(:disabled) >> nth=0'); await page.check('#hab-list input[data-hab]:not(:disabled) >> nth=1');
  ok((await page.locator('#hab-go').innerText()).includes('2 articles'), 'habituels : le bouton compte 2 articles');
  await shot('04-habituels'); await page.click('#hab-go'); await page.waitForTimeout(300);
  ok(await page.locator('.item[data-key^="x:"]').count() === 2, 'habituels : 2 articles ajoutés à la liste');
  await shot('05-courses');

  // Hors ligne : cocher, ajouter, puis revenir en ligne.
  await ctx.setOffline(true); await page.evaluate(() => { window.__offline = true; window.dispatchEvent(new Event('offline')); });
  await page.waitForSelector('.offline'); await page.check('.item[data-key="farine"] input'); await page.waitForTimeout(200);
  await page.fill('#xt', 'Café'); await page.press('#xt', 'Enter'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => pendingWrites()) >= 2, 'hors ligne : les modifications attendent (' + await page.evaluate(() => pendingWrites()) + ')');
  ok((await page.locator('.offline').innerText()).includes('en attente'), 'hors ligne : le bandeau compte les modifications en attente');
  ok(await page.locator('.item[data-key="farine"].done').count() === 1, 'hors ligne : la farine reste cochée');
  await shot('06-hors-ligne');
  // Rechargement sans réseau : la liste doit toujours être là.
  await ctx.setOffline(false); await page.evaluate(() => localStorage.setItem('mockOffline', '1'));
  await page.reload();
  await page.waitForSelector('#app .card', { timeout: 10000 }); await page.click('[data-view="courses"]'); await page.waitForSelector('.shop section');
  ok(await page.locator('.item[data-key="farine"].done').count() === 1, 'hors ligne : après rechargement, la liste et la coche sont toujours là');
  await page.evaluate(() => { localStorage.removeItem('mockOffline'); window.__offline = false; }); await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => pendingWrites() === 0, null, { timeout: 5000 });
  ok(await page.evaluate(() => { const c = __T.docs.find(d => d.path.endsWith('state/courses')).data; return c.checked.farine === true && Object.values(c.extras).some(x => x.t === 'Café'); }), 'retour du réseau : tout est envoyé au serveur');
  ok(await page.locator('.offline').count() === 0, 'retour du réseau : le bandeau disparaît');

  // Corbeille et sauvegarde.
  await page.click('[data-view="recettes"]'); await page.click('[data-open="salade"]'); await page.click('[data-act="askdel"]'); await page.click('[data-act="del"]'); await page.waitForTimeout(300);
  ok(await page.locator('[data-open="salade"]').count() === 0, 'corbeille : la salade n’est plus dans le carnet');
  ok((await page.locator('.trash-link').innerText()).includes('1 recette'), 'corbeille : le lien indique 1 recette');
  await page.click('[data-act="trash"]'); await page.waitForSelector('[data-restore="salade"]'); await shot('07-corbeille');
  await page.click('[data-restore="salade"]'); await page.waitForTimeout(300);
  ok(await page.locator('.dtitle').innerText() === 'Salade de tomates', 'corbeille : la salade est restaurée et ouverte');
  await page.click('#acct-btn'); await page.waitForSelector('#acct[open]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exp-btn')]);
  const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); console.log('    recettes:', Object.keys(json.recipes).length, 'habituels:', JSON.stringify(json.habituels));
  ok(json.app === 'nos-recettes' && Object.keys(json.recipes).length === 4 && json.habituels && Object.keys(json.habituels).length === 3, 'sauvegarde : fichier avec 4 recettes et 3 habituels (' + dl.suggestedFilename() + ')');
  ok((await page.locator('#exp-last').innerText()).includes('Dernière sauvegarde'), 'sauvegarde : la date s’affiche');
  await shot('08-compte');
  // Import : une recette nouvelle dans le fichier.
  json.recipes.nouvelle = { title: 'Gratin dauphinois', cat: 'Plats', portions: 4, groups: [{ g: '', ing: [{ t: '1 kg de pommes de terre' }] }], steps: [] };
  const tmp = path.join(OUT, 'import.json'); fs.writeFileSync(tmp, JSON.stringify(json));
  await page.setInputFiles('#imp-file', tmp); await page.waitForTimeout(500); await page.click('[data-view="recettes"]'); await page.waitForTimeout(200);
  ok(await page.locator('[data-open="nouvelle"]').count() === 1, 'import : la recette nouvelle est arrivée, les autres ignorées');

  // Ordinateur.
  await page.setViewportSize({ width: 1280, height: 900 }); await page.click('[data-view="menu"]'); await page.waitForTimeout(200); await shot('09-menu-ordi');
  await page.click('[data-view="courses"]'); await page.waitForTimeout(200); await shot('10-courses-ordi');
  ok(errors.length === 0, 'aucune erreur JavaScript' + (errors.length ? ' : ' + errors.join(' | ') : ''));
  await browser.close(); srv.close(); console.log('\nTout est bon.');
})().catch(e => { console.error(e); process.exit(1); });
