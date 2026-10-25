/* Couche de données : reproduit l'interface claude.use('db') / claude.use('assets')
   utilisée par app.js, au-dessus de Supabase (table public.docs + stockage "photos").
   Sans réseau : la dernière copie des données reste sur le téléphone, les modifications
   attendent dans une file et partent au retour du réseau. */
(function () {
  const cfg = window.CONFIG || {};
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  window.sb = sb;

  const cache = new Map();      // chemin -> données
  const listeners = new Set();  // { match(path), load(), fire() }
  let channel = null;
  // Chaque groupe a son carnet : tous les chemins sont rangés sous g/<groupe>/.
  let prefix = '';
  window.setCarnet = id => { prefix = 'g/' + id + '/'; };

  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  /* ---------- Copie locale ---------- */
  // Tout le cache est gardé sur l'appareil : l'appli s'ouvre avec les dernières données, même sans réseau.
  try { for (const [p, d] of Object.entries(JSON.parse(store.get('docs') || '{}'))) cache.set(p, d); } catch (e) {}
  let saveT = null;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { const o = {}; for (const [p, d] of cache) o[p] = d; store.set('docs', JSON.stringify(o)); }, 300);
  }

  /* ---------- File d'attente hors ligne ---------- */
  let queue = [];
  try { queue = JSON.parse(store.get('pending') || '[]'); } catch (e) { queue = []; }
  const saveQueue = () => store.set('pending', JSON.stringify(queue));
  const netError = e => !navigator.onLine || /fetch|network|load failed|NetworkError/i.test((e && e.message) || '');
  let flushing = false;
  async function flush() {
    if (flushing || !queue.length || !navigator.onLine) return;
    flushing = true;
    try {
      while (queue.length) {
        const op = queue[0];
        const { error } = await send(op);
        if (error) { if (netError(error)) break; }  // toujours hors ligne : on réessaiera
        queue.shift(); saveQueue();                 // envoyé, ou refusé pour de bon : on passe
      }
    } finally { flushing = false; }
    if (!queue.length) reloadAll();
    window.dispatchEvent(new CustomEvent('pendingchange', { detail: queue.length }));
  }
  function send(op) {
    if (op.t === 'set') return sb.from('docs').upsert({ path: op.path, data: op.body, updated_at: new Date().toISOString() });
    if (op.t === 'update') return sb.rpc('doc_merge', { p_path: op.path, p_patch: op.body });
    return sb.from('docs').delete().eq('path', op.path);
  }
  // Une écriture qui échoue faute de réseau est gardée pour plus tard ; l'appli continue comme si elle avait réussi.
  // Les envois partent un par un, dans l'ordre : deux clics rapides sur la même case ne peuvent
  // pas se croiser sur le serveur (sinon le premier pouvait arriver après le second et l'annuler).
  let chain = Promise.resolve();
  async function write(op) {
    if (queue.length) { queue.push(op); saveQueue(); flush(); return; }
    const turn = chain.then(() => send(op)); chain = turn.catch(() => {});
    const { error } = await turn;
    if (!error) return;
    if (!netError(error)) throw fail(error);
    queue.push(op); saveQueue();
    window.dispatchEvent(new CustomEvent('pendingchange', { detail: queue.length }));
  }
  window.pendingWrites = () => queue.length;
  window.addEventListener('online', flush);

  // Même fusion que doc_merge côté serveur, pour voir tout de suite ce qu'on vient de changer.
  function deepMerge(a, b) {
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return b;
    const r = { ...a };
    for (const [k, v] of Object.entries(b)) r[k] = deepMerge(r[k], v);
    return r;
  }

  const depth = p => p.split('/').length;
  // fromCache : la valeur vient de la copie locale (ce qu'on vient de taper), pas encore du serveur.
  const snap = (path, fromCache) => {
    const d = cache.get(path);
    return { id: path.split('/').pop(), exists: d !== undefined, data: () => d, metadata: { fromCache: !!fromCache, hasPendingWrites: !!fromCache } };
  };
  const notify = (path, fromCache) => { for (const l of listeners) if (l.match(path)) l.fire(fromCache); };
  const fail = e => { const err = new Error(e && e.message || 'Erreur'); err.code = 'unavailable'; return err; };

  function ensureChannel() {
    if (channel) return;
    channel = sb.channel('docs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, p => {
        if (p.eventType === 'DELETE') { const path = p.old && p.old.path; if (path) { cache.delete(path); persist(); notify(path); } }
        else { cache.set(p.new.path, p.new.data); persist(); notify(p.new.path); }
      })
      .subscribe(status => { if (status === 'SUBSCRIBED') reloadAll(); });
  }
  /* Rechargement groupé : une seule requête pour tout le carnet (au lieu d'une par liste suivie),
     et on ne prévient que les listes dont les données ont vraiment changé. */
  let reloadT = null, reloading = false, again = false;
  function reloadAll() { clearTimeout(reloadT); reloadT = setTimeout(reloadNow, 0); }
  async function reloadNow() {
    if (reloading) { again = true; return; }
    if (queue.length) return; // des modifications attendent le réseau : elles seraient écrasées
    const mine = [...listeners].filter(l => l.prefixed), others = [...listeners].filter(l => !l.prefixed);
    others.forEach(l => l.load());
    if (!mine.length) return;
    if (!prefix) { mine.forEach(l => l.load()); return; }
    reloading = true;
    try {
      const { data, error } = await sb.from('docs').select('path,data').like('path', prefix + '%');
      if (error) throw error;
      if (queue.length) return;
      const fresh = new Map(data.map(r => [r.path, r.data])), changed = [];
      for (const [p, d] of fresh) { const o = cache.get(p); if (o === undefined || JSON.stringify(o) !== JSON.stringify(d)) { cache.set(p, d); changed.push(p); } }
      for (const p of [...cache.keys()]) if (p.startsWith(prefix) && !fresh.has(p)) { cache.delete(p); changed.push(p); }
      if (changed.length) persist();
      for (const l of mine) if (!l.loaded || changed.some(l.match)) { l.loaded = true; l.fire(); }
    } catch (e) { mine.forEach(l => l.load()); } // en cas d'échec, chaque liste réessaie et signale l'erreur
    finally { reloading = false; if (again) { again = false; reloadAll(); } }
  }
  // Un téléphone en veille perd la connexion temps réel : on recharge au retour.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { flush(); reloadAll(); } });
  window.addEventListener('online', reloadAll);

  function docRef(path) {
    return {
      id: path.split('/').pop(), path: path.slice(prefix.length),
      async get() {
        const { data, error } = await sb.from('docs').select('data').eq('path', path).maybeSingle();
        if (error) throw fail(error);
        if (data) cache.set(path, data.data); else cache.delete(path);
        persist();
        return snap(path);
      },
      async set(body) {
        cache.set(path, body); persist(); notify(path, true);
        await write({ t: 'set', path, body });
      },
      async update(patch) {
        cache.set(path, deepMerge(cache.get(path) || {}, patch)); persist(); notify(path, true);
        await write({ t: 'update', path, body: patch });
      },
      async delete() {
        cache.delete(path); persist(); notify(path, true);
        await write({ t: 'delete', path });
      },
      onSnapshot(next, onErr) {
        ensureChannel();
        const l = {
          match: p => p === path, prefixed: !!prefix && path.startsWith(prefix),
          fire: fc => next(snap(path, fc)),
          load: async () => { if (queue.length) return; try { await docRef(path).get(); l.loaded = true; l.fire(); } catch (e) { onErr && onErr(e); } },
        };
        listeners.add(l);
        if (cache.has(path)) l.fire(true); // copie locale d'abord
        if (l.prefixed) reloadAll(); else l.load();
        return () => listeners.delete(l);
      },
    };
  }

  function collectionRef(name) {
    name = prefix + name;
    const inCol = p => p.startsWith(name + '/') && depth(p) === depth(name) + 1;
    const docsNow = () => [...cache.keys()].filter(inCol).sort().map(snap);
    const result = docs => ({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } });
    return {
      path: name.slice(prefix.length),
      doc: id => docRef(name + '/' + (id || Date.now().toString(36) + Math.random().toString(36).slice(2, 8))),
      async get() {
        const { data, error } = await sb.from('docs').select('path,data').like('path', name + '/%');
        if (error) throw fail(error);
        for (const p of [...cache.keys()]) if (inCol(p)) cache.delete(p);
        for (const r of data) if (inCol(r.path)) cache.set(r.path, r.data);
        persist();
        return result(docsNow());
      },
      onSnapshot(next, onErr) {
        ensureChannel();
        const self = this;
        const emit = () => next(result(docsNow()));
        // Tant que des modifications attendent le réseau, on ne recharge pas : elles seraient écrasées.
        const l = { match: inCol, prefixed: !!prefix && name.startsWith(prefix), fire: emit,
          load: async () => { if (queue.length) return; try { await self.get(); l.loaded = true; emit(); } catch (e) { onErr && onErr(e); } } };
        listeners.add(l);
        if (docsNow().length) emit();
        if (l.prefixed) reloadAll(); else l.load();
        return () => listeners.delete(l);
      },
    };
  }

  // Les photos de téléphone font souvent plusieurs Mo : on les réduit avant l'envoi.
  async function shrink(file) {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', 0.85));
    } catch (e) { return file; }
  }
  const assets = {
    async upload(file) {
      const blob = await shrink(file);
      const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
      const { error } = await sb.storage.from('photos').upload(name, blob, { contentType: 'image/jpeg' });
      if (error) throw fail(error);
      const { data } = sb.storage.from('photos').getPublicUrl(name);
      return { id: name, url: data.publicUrl, sizeBytes: blob.size, contentType: 'image/jpeg' };
    },
  };

  const db = { doc: p => docRef(prefix + p), collection: collectionRef };
  window.claude = { use: async name => name === 'db' ? db : name === 'assets' ? assets : null };
  flush();
})();
