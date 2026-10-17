/* Couche de données : reproduit l'interface claude.use('db') / claude.use('assets')
   utilisée par app.js, au-dessus de Supabase (table public.docs + stockage "photos"). */
(function () {
  const cfg = window.CONFIG || {};
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  window.sb = sb;

  const cache = new Map();      // chemin -> données
  const listeners = new Set();  // { match(path), load(), fire() }
  let channel = null;

  const depth = p => p.split('/').length;
  const snap = path => {
    const d = cache.get(path);
    return { id: path.split('/').pop(), exists: d !== undefined, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const notify = path => { for (const l of listeners) if (l.match(path)) l.fire(); };
  const fail = e => { const err = new Error(e && e.message || 'Erreur'); err.code = 'unavailable'; return err; };

  function ensureChannel() {
    if (channel) return;
    channel = sb.channel('docs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, p => {
        if (p.eventType === 'DELETE') { const path = p.old && p.old.path; if (path) { cache.delete(path); notify(path); } }
        else { cache.set(p.new.path, p.new.data); notify(p.new.path); }
      })
      .subscribe(status => { if (status === 'SUBSCRIBED') reloadAll(); });
  }
  function reloadAll() { for (const l of listeners) l.load(); }
  // Un téléphone en veille perd la connexion temps réel : on recharge au retour.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reloadAll(); });
  window.addEventListener('online', reloadAll);

  function docRef(path) {
    return {
      id: path.split('/').pop(), path,
      async get() {
        const { data, error } = await sb.from('docs').select('data').eq('path', path).maybeSingle();
        if (error) throw fail(error);
        if (data) cache.set(path, data.data); else cache.delete(path);
        return snap(path);
      },
      async set(body) {
        cache.set(path, body); notify(path);
        const { error } = await sb.from('docs').upsert({ path, data: body, updated_at: new Date().toISOString() });
        if (error) throw fail(error);
      },
      async update(patch) {
        const { error } = await sb.rpc('doc_merge', { p_path: path, p_patch: patch });
        if (error) throw fail(error);
      },
      async delete() {
        cache.delete(path); notify(path);
        const { error } = await sb.from('docs').delete().eq('path', path);
        if (error) throw fail(error);
      },
      onSnapshot(next, onErr) {
        ensureChannel();
        const l = {
          match: p => p === path,
          fire: () => next(snap(path)),
          load: async () => { try { await docRef(path).get(); l.fire(); } catch (e) { onErr && onErr(e); } },
        };
        listeners.add(l); l.load();
        return () => listeners.delete(l);
      },
    };
  }

  function collectionRef(name) {
    const inCol = p => p.startsWith(name + '/') && depth(p) === depth(name) + 1;
    return {
      path: name,
      doc: id => docRef(name + '/' + (id || Date.now().toString(36) + Math.random().toString(36).slice(2, 8))),
      async get() {
        const { data, error } = await sb.from('docs').select('path,data').like('path', name + '/%');
        if (error) throw fail(error);
        for (const p of [...cache.keys()]) if (inCol(p)) cache.delete(p);
        for (const r of data) if (inCol(r.path)) cache.set(r.path, r.data);
        const docs = [...cache.keys()].filter(inCol).sort().map(snap);
        return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
      },
      onSnapshot(next, onErr) {
        ensureChannel();
        const self = this;
        const emit = () => { const docs = [...cache.keys()].filter(inCol).sort().map(snap); next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }); };
        const l = { match: inCol, fire: emit, load: async () => { try { await self.get(); emit(); } catch (e) { onErr && onErr(e); } } };
        listeners.add(l); l.load();
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

  const db = { doc: docRef, collection: collectionRef };
  window.claude = { use: async name => name === 'db' ? db : name === 'assets' ? assets : null };
})();
