/* Importer une recette depuis un lien (données schema.org de la page, sinon Claude) ou une photo (Claude).
   POST /api/import  { url } ou { image: <base64 jpeg>, mediaType }  — en-tête Authorization: Bearer <jeton Supabase>.
   Réponse : { recipe: { title, sub, cat, ptxt, prep, cook, ingredients: [{ group, lines }], steps, notes, img, source }, via } */
import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 60 };

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jajhvlpweusxiwlmaueq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_W5ShxdvNLQZT1IYanovw0A_8Gl8k9pC';
const CATS = ['Plats', 'Salades', 'Soupes & entrées', 'Desserts', 'Petit-déj & goûter', 'Bases'];

// Seuls les comptes de l'appli peuvent importer (chaque photo lue par Claude est facturée).
async function signedIn(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_KEY, Authorization: auth } });
  return r.ok;
}

/* ---------- Lien : données structurées de la page ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ccedil: 'ç', ocirc: 'ô', icirc: 'î', ugrave: 'ù', oelig: 'œ', deg: '°', rsquo: '’', lsquo: '‘', hellip: '…' };
const decode = s => String(s ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function isoMinutes(d) {
  const m = String(d || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return '';
  const min = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
  if (!min) return '';
  return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + String(min % 60).padStart(2, '0') : '');
}

function guessCat(text) {
  const t = text.toLowerCase();
  if (/dessert|gâteau|gateau|tarte sucrée|cookie|biscuit|crème|mousse|glace|sucré/.test(t)) return 'Desserts';
  if (/salade/.test(t)) return 'Salades';
  if (/soupe|velouté|potage|entrée|apéritif|apero|amuse/.test(t)) return 'Soupes & entrées';
  if (/petit[- ]d[ée]j|brunch|goûter|gouter|pancake|crêpe|crepe/.test(t)) return 'Petit-déj & goûter';
  if (/sauce|pâte |pate |condiment|marinade|base/.test(t)) return 'Bases';
  return 'Plats';
}

function findRecipe(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  const type = [].concat(node['@type'] || []);
  if (type.some(t => String(t).toLowerCase() === 'recipe')) return node;
  return findRecipe(node['@graph']) || findRecipe(node.mainEntity);
}

function steps(instr) {
  const out = [];
  const walk = x => {
    if (!x) return;
    if (typeof x === 'string') { decode(x).split(/\n+|(?<=\.)\s{2,}/).map(s => s.trim()).filter(Boolean).forEach(s => out.push(s)); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    const type = [].concat(x['@type'] || []).join(' ');
    if (/HowToSection/i.test(type)) { if (x.name) out.push('## ' + decode(x.name)); walk(x.itemListElement); return; }
    walk(x.text || x.name);
  };
  walk(instr);
  return out;
}

function fromJsonLd(html, url) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let data; try { data = JSON.parse(b[1].trim()); } catch (e) { continue; }
    const r = findRecipe(data);
    if (!r || !r.recipeIngredient) continue;
    const img = [].concat(r.image || [])[0];
    const yieldTxt = decode([].concat(r.recipeYield || [])[0] || '');
    const title = decode(r.name);
    return {
      title,
      sub: '',
      cat: guessCat([title, decode([].concat(r.recipeCategory || []).join(' ')), decode(r.keywords || '')].join(' ')),
      ptxt: /^\d+$/.test(yieldTxt) ? yieldTxt + ' personnes' : yieldTxt,
      prep: isoMinutes(r.prepTime),
      cook: isoMinutes(r.cookTime),
      ingredients: [{ group: '', lines: [].concat(r.recipeIngredient).map(decode).filter(Boolean) }],
      steps: steps(r.recipeInstructions),
      notes: [],
      img: typeof img === 'string' ? img : img && img.url || '',
      source: 'Source : ' + new URL(url).hostname.replace(/^www\./, ''),
    };
  }
  return null;
}

/* ---------- Claude : photo, ou page sans données structurées ---------- */
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['found', 'title', 'sub', 'cat', 'ptxt', 'prep', 'cook', 'ingredients', 'steps', 'notes'],
  properties: {
    found: { type: 'boolean', description: 'false si aucune recette lisible' },
    title: { type: 'string' },
    sub: { type: 'string', description: 'sous-titre court, ou vide' },
    cat: { type: 'string', enum: CATS },
    ptxt: { type: 'string', description: 'pour combien, ex. « 4 personnes », ou vide' },
    prep: { type: 'string', description: 'temps de préparation, ex. « 20 min », ou vide' },
    cook: { type: 'string', description: 'temps de cuisson, ex. « 1 h 15 », ou vide' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['group', 'lines'],
        properties: {
          group: { type: 'string', description: 'sous-titre du groupe (ex. « Pâte »), ou vide' },
          lines: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    notes: { type: 'array', items: { type: 'string' } },
  },
};

const INSTRUCTIONS = `Tu recopies une recette de cuisine pour un carnet familial en français.
- Recopie fidèlement : n'invente aucun ingrédient, aucune quantité, aucune étape. Si la source est dans une autre langue, traduis en français.
- Un ingrédient par ligne, quantité et unité en premier, unités métriques : « 200 g de farine », « 3 œufs », « 1 c. à soupe d'huile d'olive », « 1 pincée de sel ».
- Une étape par entrée, sans numéro.
- Les astuces, variantes et conseils de conservation vont dans notes.
- found = false si on ne voit pas de recette.`;

async function withClaude(content) {
  if (!process.env.ANTHROPIC_API_KEY) { const e = new Error('no_key'); e.code = 'no_key'; throw e; }
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: INSTRUCTIONS,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const r = JSON.parse(text);
  if (!r.found || !r.title) return null;
  delete r.found;
  return { ...r, img: '' };
}

async function fetchPage(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || /^(localhost|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(u.hostname)) throw new Error('bad_url');
  const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NosRecettes/1.0)', 'Accept-Language': 'fr-FR,fr;q=0.9' } });
  if (!r.ok) throw new Error('fetch_' + r.status);
  return (await r.text()).slice(0, 3_000_000);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    if (!(await signedIn(req))) return res.status(401).json({ error: 'auth' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    if (body.url) {
      const html = await fetchPage(body.url);
      const recipe = fromJsonLd(html, body.url);
      if (recipe) return res.json({ recipe, via: 'page' });
      const text = decode(html.replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')).slice(0, 60000);
      const r = await withClaude([{ type: 'text', text: 'Voici le texte d’une page web. Extrais la recette.\n\n' + text }]);
      if (!r) return res.status(422).json({ error: 'not_found' });
      return res.json({ recipe: { ...r, source: 'Source : ' + new URL(body.url).hostname.replace(/^www\./, '') }, via: 'claude' });
    }

    if (body.image) {
      const r = await withClaude([
        { type: 'image', source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.image } },
        { type: 'text', text: 'Recopie la recette de cette photo.' },
      ]);
      if (!r) return res.status(422).json({ error: 'not_found' });
      return res.json({ recipe: r, via: 'claude' });
    }
    return res.status(400).json({ error: 'empty' });
  } catch (e) {
    const code = e.code === 'no_key' ? 'no_key' : /^fetch_|bad_url|Invalid URL|timeout|aborted/i.test(e.message) ? 'fetch' : 'server';
    console.error('import', e);
    return res.status(code === 'server' ? 500 : 400).json({ error: code });
  }
}
