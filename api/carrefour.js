/* Envoyer la liste de courses dans un panier Carrefour, en livraison à domicile.
   POST /api/carrefour  { address, items: [{ n, q }] }  — en-tête Authorization: Bearer <jeton Supabase>.
   Claude passe par le connecteur officiel Carrefour (serveur MCP) : il choisit le centre de livraison,
   cherche chaque article, remplit un panier et renvoie le lien qui l'ouvre sur carrefour.fr.
   Rien n'est commandé ni payé : on finit sur carrefour.fr.
   Réponse : { link, total, min, added: [{ item, product, qty }], missing: [item] } */
import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 300 };

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jajhvlpweusxiwlmaueq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_W5ShxdvNLQZT1IYanovw0A_8Gl8k9pC';

async function signedIn(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_KEY, Authorization: auth } });
  return r.ok;
}

// Seuls les outils utiles à la livraison : pas de drive, pas de compte client.
const TOOLS = ['set_pickup_mode', 'auto_select_delivery_location', 'set_store', 'search_multiple_products', 'search_products', 'add_to_cart', 'get_substitutions'];

const INSTRUCTIONS = `Tu remplis un panier Carrefour (livraison à domicile) à partir de la liste de courses d'une famille, avec les outils Carrefour.
1. set_pickup_mode en LAD, puis auto_select_delivery_location avec l'adresse, puis set_store avec le magasin choisi.
2. search_multiple_products avec tous les articles en un seul appel (mots-clés courts : le nom du produit seulement).
3. Pour chaque article, choisis le produit le plus courant et le mieux adapté : marque Carrefour ou marque connue, format proche de la quantité demandée, prix raisonnable. Calcule le nombre d'unités à prendre pour couvrir la quantité (ex. « 750 g » de carottes avec un sachet de 1 kg → 1). En cas de doute, 1.
4. Un seul add_to_cart avec tous les produits choisis (EAN venus des résultats de recherche uniquement, jamais inventés). Réutilise ensuite le cart_id si un second appel est nécessaire.
5. Ne cherche pas à commander ni payer : ce n'est pas possible et ce n'est pas demandé.
À la fin, réponds uniquement par un objet JSON, sans texte autour :
{"link": "<cart_in_carrefour_link>", "total": "<total affiché, ex. 54,20 €>", "min": "<minimum de commande du magasin, ex. 60 €, ou vide>", "added": [{"item": "<article de la liste>", "product": "<produit choisi>", "qty": <nombre>}], "missing": ["<article introuvable ou refusé>"]}`;

function lastJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

// Le lien du panier, lu directement dans la réponse de l'outil si Claude l'a mal recopié.
function linkFromTools(content) {
  let link = '';
  for (const b of content) {
    if (b.type !== 'mcp_tool_result' || b.is_error) continue;
    for (const c of b.content || []) {
      const m = c.type === 'text' && c.text.match(/"cart_in_carrefour_link"\s*:\s*"([^"]+)"/);
      if (m) link = m[1];
    }
  }
  return link;
}

async function fill(address, items) {
  const client = new Anthropic();
  const list = items.map(i => '- ' + i.n + (i.q ? ' : ' + i.q : '')).join('\n');
  const messages = [{ role: 'user', content: `Adresse de livraison : ${address}\n\nListe de courses :\n${list}` }];
  const all = [];
  for (let turn = 0; turn < 6; turn++) {
    const response = await client.beta.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 32000,
      betas: ['mcp-client-2025-11-20', 'server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: INSTRUCTIONS,
      output_config: { effort: 'low' },
      mcp_servers: [{ type: 'url', url: process.env.CARREFOUR_MCP_URL, name: 'carrefour' }],
      tools: [{
        type: 'mcp_toolset', mcp_server_name: 'carrefour',
        default_config: { enabled: false },
        configs: Object.fromEntries(TOOLS.map(t => [t, { enabled: true }])),
      }],
      messages,
    }).finalMessage();
    all.push(...response.content);
    if (response.stop_reason === 'refusal') return null;
    // Une longue suite d'appels d'outils peut s'interrompre : on relance là où elle s'est arrêtée.
    if (response.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: response.content });
  }
  const text = all.filter(b => b.type === 'text').map(b => b.text).join('');
  const out = lastJson(text) || { added: [], missing: [] };
  out.link = linkFromTools(all) || out.link || '';
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    if (!(await signedIn(req))) return res.status(401).json({ error: 'auth' });
    if (!process.env.ANTHROPIC_API_KEY || !process.env.CARREFOUR_MCP_URL) return res.status(400).json({ error: 'no_key' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const address = String(body.address || '').trim().slice(0, 300);
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 100)
      .map(i => ({ n: String(i.n || '').slice(0, 120), q: String(i.q || '').slice(0, 60) })).filter(i => i.n);
    if (!address) return res.status(400).json({ error: 'address' });
    if (!items.length) return res.status(400).json({ error: 'empty' });
    const out = await fill(address, items);
    if (!out || !out.link) return res.status(502).json({ error: 'carrefour' });
    return res.json(out);
  } catch (e) {
    console.error('carrefour', e);
    return res.status(500).json({ error: 'server' });
  }
}
