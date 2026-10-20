/* Social : amis, groupes (un carnet chacun) et chats, au-dessus de Supabase. */
(function () {
  const sb = window.sb;
  const X = { ready: false, profiles: new Map(), friends: [], groups: [], msgs: new Map(), sub: null, draft: {}, addOpen: false, confirmLeave: false, note: '' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const me = () => window.ME && window.ME.id;
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const dmKey = (a, b) => [a, b].sort().join('_');
  const convOf = m => m.group_id ? 'g:' + m.group_id : 'd:' + m.dm;
  const nameOf = id => { const p = X.profiles.get(id); return p ? (p.name || '@' + p.handle) : 'Quelqu’un'; };
  const initial = id => (nameOf(id).replace(/^@/, '')[0] || '?').toUpperCase();
  const rerender = () => { if (typeof render === 'function') render(); };

  const ICON = {
    back: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    send: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z"/></svg>',
    plus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  };

  /* ---------- Données ---------- */
  async function load() {
    const [f, gm, m] = await Promise.all([
      sb.from('friendships').select('*'),
      sb.from('group_members').select('group_id, user_id, groups(id, name)'),
      sb.from('messages').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    if (f.error || gm.error || m.error) { X.error = true; rerender(); return; }
    const uid = me();
    X.friends = f.data.map(r => {
      const other = r.requester === uid ? r.addressee : r.requester;
      return { id: other, status: r.status, incoming: r.addressee === uid };
    });
    const g = new Map();
    for (const r of gm.data) {
      if (!r.groups) continue;
      if (!g.has(r.group_id)) g.set(r.group_id, { id: r.group_id, name: r.groups.name, members: [] });
      g.get(r.group_id).members.push(r.user_id);
    }
    X.groups = [...g.values()].filter(x => x.members.includes(uid)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    X.msgs = new Map();
    for (const msg of m.data.reverse()) push(msg);
    const ids = new Set([uid, ...X.friends.map(x => x.id), ...gm.data.map(r => r.user_id), ...m.data.map(x => x.sender)]);
    const p = await sb.from('profiles').select('*').in('id', [...ids]);
    if (!p.error) X.profiles = new Map(p.data.map(x => [x.id, x]));
    if (window.ME) window.ME.profile = X.profiles.get(uid) || window.ME.profile;
    window.CARNETS = X.groups.map(x => ({ id: x.id, name: x.name }));
    X.ready = true; X.error = false;
    refreshHeader(); rerender();
  }
  function push(msg) {
    const k = convOf(msg);
    if (!X.msgs.has(k)) X.msgs.set(k, []);
    const l = X.msgs.get(k);
    if (!l.some(x => x.id === msg.id)) l.push(msg);
  }
  let reloadT = null;
  const reloadSoon = () => { clearTimeout(reloadT); reloadT = setTimeout(load, 300); };

  function listen() {
    sb.channel('social')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => {
        push(p.new);
        if (!X.profiles.has(p.new.sender)) reloadSoon(); else rerender();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, reloadSoon)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, reloadSoon)
      .subscribe(s => { if (s === 'SUBSCRIBED' && X.ready) reloadSoon(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reloadSoon(); });
  }

  /* ---------- Non lus ---------- */
  const seenAt = k => store.get('seen:' + k) || '';
  function unread(k) {
    const s = seenAt(k), l = X.msgs.get(k) || [];
    return l.filter(m => m.sender !== me() && m.created_at > s).length;
  }
  function markSeen(k) {
    const l = X.msgs.get(k) || [];
    if (l.length) store.set('seen:' + k, l[l.length - 1].created_at);
  }
  function badge() {
    if (!X.ready) return '';
    const n = X.friends.filter(f => f.status === 'pending' && f.incoming).length
      + X.groups.reduce((t, g) => t + unread('g:' + g.id), 0)
      + X.friends.filter(f => f.status === 'accepted').reduce((t, f) => t + unread('d:' + dmKey(me(), f.id)), 0);
    return n || '';
  }

  /* ---------- Rendu ---------- */
  const time = iso => {
    const d = new Date(iso), now = new Date();
    const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === now.toDateString() ? hm : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + hm;
  };
  const avatar = id => `<span class="av" aria-hidden="true">${esc(initial(id))}</span>`;
  const lastLine = k => { const l = X.msgs.get(k) || []; const m = l[l.length - 1]; return m ? (m.sender === me() ? 'Vous : ' : '') + m.body : ''; };
  const unreadDot = n => n ? `<span class="badge">${n}</span>` : '';

  function html() {
    if (!X.ready) return `<div class="empty"><h2>${X.error ? 'Social indisponible' : 'Ouverture…'}</h2><p>${X.error ? 'Vérifiez la connexion, puis rouvrez l’appli.' : 'Vos amis et vos groupes arrivent.'}</p></div>`;
    if (X.sub && X.sub.k === 'chat') return chatHtml();
    if (X.sub && X.sub.k === 'newgroup') return newGroupHtml();
    const uid = me(), p = X.profiles.get(uid) || {};
    const incoming = X.friends.filter(f => f.status === 'pending' && f.incoming);
    const outgoing = X.friends.filter(f => f.status === 'pending' && !f.incoming);
    const friends = X.friends.filter(f => f.status === 'accepted').sort((a, b) => nameOf(a.id).localeCompare(nameOf(b.id), 'fr'));
    return `<h2 class="s-title">Social</h2>
    <div class="s-me"><div><span class="status">Votre pseudo</span><b>@${esc(p.handle || '')}</b></div><button class="btn ghost" data-s="copyhandle">Copier</button><button class="btn ghost" data-s="account">Modifier</button></div>
    <form class="addrow" id="s-add"><input id="s-add-in" autocapitalize="off" placeholder="Pseudo d’un ami (ex. marie)" aria-label="Pseudo de l’ami"><button class="btn">${ICON.plus}Ajouter</button></form>
    ${X.note ? `<p class="s-note">${esc(X.note)}</p>` : ''}
    ${incoming.length ? `<section class="s-sec"><h3>Demandes reçues</h3>${incoming.map(f => `<div class="s-row">${avatar(f.id)}<div class="s-txt"><b>${esc(nameOf(f.id))}</b><span>@${esc((X.profiles.get(f.id) || {}).handle || '')}</span></div><button class="btn primary" data-s="accept" data-id="${f.id}">Accepter</button><button class="btn ghost" data-s="unfriend" data-id="${f.id}">Refuser</button></div>`).join('')}</section>` : ''}
    <section class="s-sec"><div class="s-head"><h3>Groupes</h3><button class="btn" data-s="newgroup">${ICON.plus}Créer un groupe</button></div>
      ${X.groups.map(g => `<button class="s-row s-open" data-s="opengroup" data-id="${g.id}"><span class="av grp" aria-hidden="true">${esc(g.name[0].toUpperCase())}</span><div class="s-txt"><b>${esc(g.name)}${window.CARNET && window.CARNET.id === g.id ? ' <small>· carnet ouvert</small>' : ''}</b><span>${esc(lastLine('g:' + g.id) || g.members.map(nameOf).join(', '))}</span></div>${unreadDot(unread('g:' + g.id))}</button>`).join('')}
    </section>
    <section class="s-sec"><h3>Amis</h3>
      ${friends.length ? friends.map(f => { const k = 'd:' + dmKey(uid, f.id); return `<button class="s-row s-open" data-s="opendm" data-id="${f.id}">${avatar(f.id)}<div class="s-txt"><b>${esc(nameOf(f.id))}</b><span>${esc(lastLine(k) || '@' + ((X.profiles.get(f.id) || {}).handle || ''))}</span></div>${unreadDot(unread(k))}</button>`; }).join('')
        : `<p class="hint">Ajoutez un ami avec son pseudo : il le trouve dans Social, en haut.</p>`}
      ${outgoing.map(f => `<div class="s-row">${avatar(f.id)}<div class="s-txt"><b>${esc(nameOf(f.id))}</b><span>Demande envoyée</span></div><button class="btn ghost" data-s="unfriend" data-id="${f.id}">Annuler</button></div>`).join('')}
    </section>`;
  }

  function chatHtml() {
    const s = X.sub, uid = me();
    const isGroup = s.type === 'g';
    const g = isGroup && X.groups.find(x => x.id === s.id);
    if (isGroup && !g) { X.sub = null; return html(); }
    const k = isGroup ? 'g:' + s.id : 'd:' + dmKey(uid, s.id);
    const title = isGroup ? g.name : nameOf(s.id);
    const l = X.msgs.get(k) || [];
    let head = '';
    if (isGroup) {
      const addable = X.friends.filter(f => f.status === 'accepted' && !g.members.includes(f.id));
      head = `<p class="status">${esc(g.members.map(nameOf).join(', '))}</p>
      <div class="actions">${window.CARNET && window.CARNET.id === g.id ? '' : `<button class="btn primary" data-s="usecarnet" data-id="${g.id}">Ouvrir ce carnet</button>`}
        <button class="btn" data-s="toggleadd">${ICON.plus}Ajouter un ami</button>
        <button class="btn ghost danger-t" data-s="askleave">Quitter le groupe</button></div>
      ${X.addOpen ? `<div class="s-pick">${addable.length ? addable.map(f => `<button class="btn" data-s="addmember" data-id="${f.id}">${esc(nameOf(f.id))}</button>`).join('') : '<p class="hint">Tous vos amis sont déjà dans ce groupe. Ajoutez d’abord un ami dans Social.</p>'}</div>` : ''}
      ${X.confirmLeave ? `<div class="confirm"><span>Quitter « ${esc(g.name)} » ? ${g.members.length === 1 ? 'Vous êtes seul : le groupe et son carnet seront supprimés.' : 'Vous n’aurez plus accès à son carnet.'}</span><button class="btn danger" data-s="leave">Quitter</button><button class="btn ghost" data-s="noleave">Annuler</button></div>` : ''}`;
    } else {
      head = `<p class="status">@${esc((X.profiles.get(s.id) || {}).handle || '')} · <button class="linkbtn s-inline" data-s="askunfriend">Retirer de mes amis</button></p>
      ${X.confirmLeave ? `<div class="confirm"><span>Retirer ${esc(title)} de vos amis ?</span><button class="btn danger" data-s="unfriend" data-id="${s.id}">Retirer</button><button class="btn ghost" data-s="noleave">Annuler</button></div>` : ''}`;
    }
    let prevDay = '';
    const bubbles = l.map(m => {
      const mine = m.sender === uid, day = new Date(m.created_at).toDateString();
      const sep = day !== prevDay ? `<div class="c-day">${esc(new Date(m.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</div>` : '';
      prevDay = day;
      return `${sep}<div class="c-msg ${mine ? 'mine' : ''}">${!mine && isGroup ? `<span class="c-who">${esc(nameOf(m.sender))}</span>` : ''}<p>${esc(m.body)}</p><time>${esc(time(m.created_at).split(' ').pop())}</time></div>`;
    }).join('');
    return `<button class="btn ghost back" data-s="home">${ICON.back}Social</button>
    <div class="c-top"><h2>${esc(title)}</h2>${head}</div>
    <div class="chat" id="chat">${bubbles || `<p class="hint c-empty">Aucun message. Écrivez le premier !</p>`}</div>
    <form class="c-form" id="s-msg"><textarea id="msg" rows="1" maxlength="2000" placeholder="Message" aria-label="Message">${esc(X.draft[k] || '')}</textarea><button class="btn primary" aria-label="Envoyer">${ICON.send}</button></form>`;
  }

  function newGroupHtml() {
    const friends = X.friends.filter(f => f.status === 'accepted');
    return `<button class="btn ghost back" data-s="home">${ICON.back}Social</button>
    <h2 class="s-title">Créer un groupe</h2>
    <p class="hint">Le groupe a son propre carnet (recettes, menu, liste de courses) et son chat.</p>
    <form class="edit" id="s-newgroup">
      <label>Nom du groupe<input id="ng-name" required maxlength="40" placeholder="ex. Les copains, Famille"></label>
      <fieldset class="s-check"><legend>Avec qui ?</legend>
        ${friends.length ? friends.map(f => `<label class="item"><input type="checkbox" value="${f.id}"><span>${esc(nameOf(f.id))}</span></label>`).join('') : '<p class="hint">Vous n’avez pas encore d’amis ajoutés. Vous pourrez les inviter ensuite.</p>'}
      </fieldset>
      <div class="actions"><button class="btn primary">Créer le groupe</button><button type="button" class="btn ghost" data-s="home">Annuler</button></div>
    </form>`;
  }

  // Après chaque rendu : chat en bas et messages marqués lus.
  function after() {
    if (!X.sub || X.sub.k !== 'chat') return;
    const k = X.sub.type === 'g' ? 'g:' + X.sub.id : 'd:' + dmKey(me(), X.sub.id);
    markSeen(k);
    const c = document.getElementById('chat');
    if (c) c.scrollIntoView({ block: 'end' });
    const t = document.getElementById('msg');
    if (t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }
  }

  /* ---------- En-tête : carnet ouvert ---------- */
  function refreshHeader() {
    if (window.ME && X.ready) { X.profiles.set(window.ME.id, window.ME.profile); rerender(); }
    const sub = document.getElementById('sub');
    if (sub && window.CARNET) sub.textContent = window.CARNET.name;
    const list = document.getElementById('carnets-list');
    if (list) list.innerHTML = (window.CARNETS || []).map(c => `<button class="s-row" data-s="usecarnet" data-id="${c.id}" aria-current="${window.CARNET && window.CARNET.id === c.id}"><span class="av grp" aria-hidden="true">${esc(c.name[0].toUpperCase())}</span><div class="s-txt"><b>${esc(c.name)}</b></div></button>`).join('');
  }

  /* ---------- Copier une recette vers un autre carnet ---------- */
  let copying = null;
  function openCopy(id, recipe) {
    copying = { id, recipe };
    document.getElementById('copyto-title').textContent = recipe.title;
    const others = X.groups.filter(g => !window.CARNET || g.id !== window.CARNET.id);
    document.getElementById('copyto-list').innerHTML = others.length
      ? others.map(g => `<button class="s-row" data-s="copyrecipe" data-id="${g.id}"><span class="av grp" aria-hidden="true">${esc(g.name[0].toUpperCase())}</span><div class="s-txt"><b>${esc(g.name)}</b></div></button>`).join('')
      : '<p class="hint">Vous n’avez pas d’autre groupe. Créez-en un dans Social.</p>';
    document.getElementById('copyto').showModal();
  }
  async function copyRecipe(gid) {
    const { id, recipe } = copying;
    const base = 'g/' + gid + '/recipes/';
    const { data } = await sb.from('docs').select('path').eq('path', base + id).maybeSingle();
    const newId = data ? id + '-' + Date.now().toString(36).slice(-4) : id;
    const { error } = await sb.from('docs').insert({ path: base + newId, data: recipe });
    document.getElementById('copyto').close();
    toast(error ? 'Copie impossible, réessayez.' : 'Recette copiée dans « ' + (X.groups.find(g => g.id === gid) || {}).name + ' »');
  }

  /* ---------- Actions ---------- */
  function openChat(type, id) { X.sub = { k: 'chat', type, id }; X.addOpen = false; X.confirmLeave = false; rerender(); }
  function home() { X.sub = null; X.addOpen = false; X.confirmLeave = false; X.note = ''; rerender(); scrollTo(0, 0); }

  document.addEventListener('click', async e => {
    const closer = e.target.closest('[data-close]');
    if (closer) { closer.closest('dialog').close(); return; }
    const d = e.target.closest('dialog');
    if (d && e.target === d && (d.id === 'carnets' || d.id === 'copyto')) { d.close(); return; }
    if (e.target.closest('#carnet-btn')) { refreshHeader(); document.getElementById('carnets').showModal(); return; }
    const b = e.target.closest('[data-s]'); if (!b) return;
    const a = b.dataset.s, id = b.dataset.id, uid = me();
    if (a === 'home') return home();
    if (a === 'account') return window.openAccount && window.openAccount();
    if (a === 'copyhandle') {
      const h = '@' + ((X.profiles.get(uid) || {}).handle || '');
      try { await navigator.clipboard.writeText(h); toast('Pseudo copié : ' + h); } catch (err) { toast('Votre pseudo : ' + h); }
      return;
    }
    if (a === 'newgroup') {
      const dlg = document.getElementById('carnets'); if (dlg.open) dlg.close();
      if (S.view !== 'social' || S.detail || S.edit) go('social');
      X.sub = { k: 'newgroup' }; rerender(); scrollTo(0, 0);
      return;
    }
    if (a === 'opengroup') return openChat('g', id);
    if (a === 'opendm') return openChat('d', id);
    if (a === 'usecarnet') { if (!window.CARNET || window.CARNET.id !== id) window.switchCarnet(id); else document.getElementById('carnets').close(); return; }
    if (a === 'accept') { const { error } = await sb.rpc('accept_friend', { p_user: id }); if (error) toast('Action impossible, réessayez.'); return load(); }
    if (a === 'unfriend') {
      const { error } = await sb.from('friendships').delete().or(`and(requester.eq.${uid},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${uid})`);
      if (error) toast('Action impossible, réessayez.');
      if (X.sub && X.sub.k === 'chat') X.sub = null;
      X.confirmLeave = false; return load();
    }
    if (a === 'askunfriend' || a === 'askleave') { X.confirmLeave = true; return rerender(); }
    if (a === 'noleave') { X.confirmLeave = false; return rerender(); }
    if (a === 'toggleadd') { X.addOpen = !X.addOpen; return rerender(); }
    if (a === 'addmember') {
      const { error } = await sb.rpc('add_to_group', { p_group: X.sub.id, p_user: id });
      toast(error ? 'Ajout impossible, réessayez.' : nameOf(id) + ' a rejoint le groupe');
      X.addOpen = false; return load();
    }
    if (a === 'leave') {
      const gid = X.sub.id;
      const { error } = await sb.from('group_members').delete().eq('group_id', gid).eq('user_id', uid);
      if (error) return toast('Impossible de quitter le groupe, réessayez.');
      if (window.CARNET && window.CARNET.id === gid) {
        const next = X.groups.find(g => g.id !== gid);
        if (next) return window.switchCarnet(next.id);
        const { data } = await sb.rpc('create_group', { p_name: 'Mon carnet', p_members: [] });
        return window.switchCarnet(data);
      }
      X.sub = null; return load();
    }
    if (a === 'copyrecipe') return copyRecipe(id);
  });

  document.addEventListener('submit', async e => {
    const f = e.target;
    if (f.id === 's-add') {
      e.preventDefault();
      const input = document.getElementById('s-add-in'), h = input.value.trim();
      if (!h) return;
      const { data, error } = await sb.rpc('request_friend', { p_handle: h });
      X.note = error ? 'Demande impossible, réessayez.'
        : { introuvable: `Personne n’a le pseudo « ${h} ». Vérifiez l’orthographe.`, soi: 'C’est votre propre pseudo !', deja: 'Vous êtes déjà amis.',
            ami: 'Vous êtes maintenant amis.', envoye: 'Demande envoyée. Elle apparaîtra dans ses amis dès qu’elle sera acceptée.' }[data] || '';
      if (!error && data !== 'introuvable') input.value = '';
      return load();
    }
    if (f.id === 's-msg') {
      e.preventDefault();
      const t = document.getElementById('msg'), body = t.value.trim();
      if (!body) return;
      const s = X.sub, uid = me();
      const row = s.type === 'g' ? { group_id: s.id, body } : { dm: dmKey(uid, s.id), body };
      const k = s.type === 'g' ? 'g:' + s.id : 'd:' + row.dm;
      X.draft[k] = ''; t.value = '';
      const { data, error } = await sb.from('messages').insert(row).select().single();
      if (error) { X.draft[k] = body; toast('Message non envoyé, réessayez.'); }
      else push(data);
      rerender();
      const nt = document.getElementById('msg'); if (nt) nt.focus();
      return;
    }
    if (f.id === 's-newgroup') {
      e.preventDefault();
      const name = document.getElementById('ng-name').value.trim();
      const members = [...f.querySelectorAll('input[type=checkbox]:checked')].map(i => i.value);
      const { data, error } = await sb.rpc('create_group', { p_name: name, p_members: members });
      if (error) return toast('Création impossible, réessayez.');
      await load();
      toast('Groupe « ' + name + ' » créé');
      return openChat('g', data);
    }
  });

  document.addEventListener('input', e => {
    if (e.target.id !== 'msg' || !X.sub) return;
    const k = X.sub.type === 'g' ? 'g:' + X.sub.id : 'd:' + dmKey(me(), X.sub.id);
    X.draft[k] = e.target.value;
    e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  });
  document.addEventListener('keydown', e => {
    if (e.target.id === 'msg' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(hover:hover)').matches) {
      e.preventDefault(); e.target.form.requestSubmit();
    }
  });

  window.Social = {
    start() { load(); listen(); },
    html, after, badge, refreshHeader,
    canCopy: () => X.groups.length > 1,
    copyTo: openCopy,
    reset: () => { X.sub = null; X.addOpen = false; X.confirmLeave = false; X.note = ''; },
    busy: () => !!(X.sub && X.sub.k === 'newgroup'),
  };
})();
