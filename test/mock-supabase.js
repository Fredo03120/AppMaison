// Faux Supabase pour tester l'appli dans un navigateur sans réseau ni compte.
(function () {
  const G = '00000000-0000-4000-8000-000000000001';
  const UID = 'u1';
  const T = {
    profiles: [{ id: UID, name: 'Fred', handle: 'fred' }],
    groups: [{ id: G, name: 'Maison' }],
    group_members: [{ group_id: G, user_id: UID, joined_at: '2026-01-01' }],
    friendships: [], messages: [],
    docs: [],
  };
  const ing = (t) => ({ t });
  const R = (id, title, cat, portions, lines) => T.docs.push({ path: `g/${G}/recipes/${id}`, data: { title, cat, portions, ptxt: portions + ' personnes', meta: [['Préparation', '20 min'], ['Cuisson', '30 min']], groups: [{ g: '', ing: lines.map(ing) }], steps: ['Faire.', 'Cuire 20 min.'] } });
  R('boeuf', 'Bœuf bourguignon', 'Plats', 4, ['1 kg de bœuf', '2 oignons', '3 carottes', '50 cl de vin rouge', '1 c. à soupe de farine', 'sel', 'poivre', "2 c. à soupe d'huile"]);
  R('tarte', 'Tarte aux pommes', 'Desserts', 6, ['1 pâte brisée', '4 pommes', '50 g de beurre', '60 g de sucre', '1 œuf']);
  R('salade', 'Salade de tomates', 'Salades', 2, ['4 tomates', '1 oignon rouge', "3 c. à soupe d'huile d'olive", 'sel', 'basilic']);
  R('crepes', 'Crêpes', 'Petit-déj & goûter', 4, ['250 g de farine', '3 œufs', '50 cl de lait', '30 g de beurre', '1 pincée de sel']);

  // Le faux serveur survit au rechargement de la page.
  try { const saved = JSON.parse(localStorage.getItem('mockT') || 'null'); if (saved) Object.assign(T, saved); } catch (e) {}
  window.__log = [];
  const log = (op) => { window.__log.push(op); if (op.op !== 'select') try { localStorage.setItem('mockT', JSON.stringify(T)); } catch (e) {} };
  const fail = () => window.__offline ? { message: 'TypeError: Failed to fetch' } : null;
  // La recette d'app.js utilise parseLine à l'enregistrement ; ici on prépare les items comme app.js le ferait.
  function prep() {
    for (const d of T.docs) for (const g of d.data.groups || []) for (const i of g.ing) if (!i.items) Object.assign(i, window.parseLine ? window.parseLine(i.t) : { items: [] });
  }

  function deepMerge(a, b) {
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return b;
    const r = { ...a }; for (const [k, v] of Object.entries(b)) r[k] = deepMerge(r[k], v); return r;
  }
  const listeners = [];
  const emit = (table, p) => listeners.forEach(l => { if (l.table === table && (l.event === '*' || l.event === p.eventType)) setTimeout(() => l.cb(p), 0); });

  function builder(table) {
    const q = { table, op: 'select', filters: [], like: null, single: false, maybe: false };
    const run = () => {
      const err = fail(); if (err) return { data: null, error: err };
      let rows = T[table] || [];
      const match = r => q.filters.every(([k, v]) => r[k] === v) && (!q.like || r.path.startsWith(q.like.replace('%', '')));
      if (q.op === 'select') {
        if (window.parseLine) prep();
        let out = rows.filter(match).map(r => ({ ...r }));
        if (table === 'group_members') out = out.map(r => ({ ...r, groups: T.groups.find(g => g.id === r.group_id) }));
        log({ op: 'select', table, filters: q.filters, like: q.like });
        if (q.single || q.maybe) return { data: out[0] || null, error: null };
        return { data: out, error: null };
      }
      if (q.op === 'upsert') {
        const i = rows.findIndex(r => r.path === q.row.path);
        if (i >= 0) rows[i] = { ...rows[i], ...q.row }; else rows.push({ ...q.row });
        log({ op: 'upsert', table, path: q.row.path });
        emit('docs', { eventType: i >= 0 ? 'UPDATE' : 'INSERT', new: { ...q.row } });
        return { data: null, error: null };
      }
      if (q.op === 'insert') { rows.push({ id: 'm' + rows.length, created_at: new Date().toISOString(), ...q.row }); log({ op: 'insert', table }); return { data: rows[rows.length - 1], error: null }; }
      if (q.op === 'update') { const r = rows.find(match); if (r) Object.assign(r, q.row); log({ op: 'update', table }); return { data: r, error: null }; }
      if (q.op === 'delete') {
        const gone = rows.filter(match); T[table] = rows.filter(r => !match(r));
        log({ op: 'delete', table, filters: q.filters });
        gone.forEach(r => emit('docs', { eventType: 'DELETE', old: { path: r.path } }));
        return { data: null, error: null };
      }
    };
    const api = {
      select() { return api; }, eq(k, v) { q.filters.push([k, v]); return api; }, like(k, v) { q.like = v; return api; },
      order() { return api; }, limit() { return api; }, in() { return api; }, or() { return api; },
      maybeSingle() { q.maybe = true; return api; }, single() { q.single = true; return api; },
      upsert(row) { q.op = 'upsert'; q.row = row; return api; }, insert(row) { q.op = 'insert'; q.row = row; return api; },
      update(row) { q.op = 'update'; q.row = row; return api; }, delete() { q.op = 'delete'; return api; },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
    };
    return api;
  }

  const session = { user: { id: UID, email: 'fred@exemple.fr', created_at: '2026-01-01' }, access_token: 'tok' };
  let echoN = 0;
  window.supabase = { createClient() {
    return {
      from: builder,
      async rpc(name, args) {
        const err = fail(); if (err) return { data: null, error: err };
        if (name === 'doc_merge') {
          const i = T.docs.findIndex(r => r.path === args.p_path);
          if (i >= 0) T.docs[i].data = deepMerge(T.docs[i].data, args.p_patch); else T.docs.push({ path: args.p_path, data: args.p_patch });
          log({ op: 'merge', path: args.p_path, patch: args.p_patch });
          const row = JSON.parse(JSON.stringify(T.docs.find(r => r.path === args.p_path).data));
          setTimeout(() => emit('docs', { eventType: 'UPDATE', new: { path: args.p_path, data: row } }), window.__echoDelay ? window.__echoDelay * (++echoN) : 0);
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      channel() { const ch = { on(ev, f, cb) { listeners.push({ table: f.table, event: f.event, cb }); return ch; }, subscribe(cb) { setTimeout(() => cb && cb('SUBSCRIBED'), 10); return ch; } }; return ch; },
      auth: {
        onAuthStateChange(cb) { setTimeout(() => cb('INITIAL_SESSION', session), 0); return { data: { subscription: {} } }; },
        async getSession() { return { data: { session } }; }, async signOut() {}, async updateUser() { return { error: null }; },
      },
      storage: { from() { return { async upload() { return { error: null }; }, getPublicUrl(n) { return { data: { publicUrl: '/photos/' + n } }; } }; } },
    };
  } };
  window.__T = T;
})();
