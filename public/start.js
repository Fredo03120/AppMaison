/* Connexion, compte, puis démarrage de l'appli sur le carnet choisi. */
(function () {
  const sb = window.sb;
  const login = document.getElementById('login'), shell = document.getElementById('shell');
  const msg = document.getElementById('login-msg');
  let started = false;

  function say(t) { msg.textContent = t; msg.hidden = false; }
  function showLogin() { shell.hidden = true; login.hidden = false; }

  const $ = id => document.getElementById(id);
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  async function enter(session) {
    if (!session) { showLogin(); return; }
    const uid = session.user.id;
    let prof = null;
    for (let i = 0; i < 3 && !prof; i++) {
      const { data } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
      prof = data; if (!prof) await new Promise(r => setTimeout(r, 600));
    }
    const { data: rows, error } = await sb.from('group_members').select('group_id, joined_at, groups(id, name)').eq('user_id', uid).order('joined_at');
    if (error || !prof) {
      showLogin();
      say("Impossible d'ouvrir votre compte pour le moment. Vérifiez la connexion, puis rouvrez l'appli.");
      return;
    }
    const carnets = (rows || []).map(r => r.groups).filter(Boolean); // le plus ancien d'abord : c'est le carnet par défaut
    const saved = store.get('carnet');
    const cur = carnets.find(c => c.id === saved) || carnets[0] || null;
    carnets.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    window.ME = { id: uid, email: session.user.email, created_at: session.user.created_at, profile: prof };
    window.CARNETS = carnets; window.CARNET = cur;
    login.hidden = true; shell.hidden = false;
    showUser();
    if (started) return;
    started = true;
    if (cur) { window.setCarnet(cur.id); window.startApp(); }
    else { window.startApp(); }
    window.Social && window.Social.start();
    if (!prof.name) openAccount("Bienvenue ! Choisissez votre prénom : c'est ce que vos amis verront.");
  }
  window.switchCarnet = id => { store.set('carnet', id); location.reload(); };

  const form = document.getElementById('login-form');
  const emailIn = document.getElementById('login-email'), passIn = document.getElementById('login-pass');
  const btns = form.querySelectorAll('button');
  const busy = on => btns.forEach(b => b.disabled = on);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = emailIn.value.trim(), password = passIn.value;
    if (!password) return say('Entrez un mot de passe (6 caractères minimum).');
    const signup = e.submitter && e.submitter.value === 'up';
    busy(true);
    const { data, error } = signup ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } })
                                   : await sb.auth.signInWithPassword({ email, password });
    busy(false);
    if (error) {
      if (signup && /registered|exists/i.test(error.message || '')) return say('Ce compte existe déjà : touchez « Se connecter ».');
      if (!signup) return say("Adresse ou mot de passe incorrect. Pas encore de compte ? Touchez « Créer mon compte ».");
      return say(`Création du compte impossible (${error.message}).`);
    }
    if (signup && !data.session) say(`Compte créé. Un e-mail de confirmation a été envoyé à ${email} : ouvrez-le, puis connectez-vous ici.`);
  });

  document.getElementById('link-btn').addEventListener('click', async () => {
    const email = emailIn.value.trim();
    if (!emailIn.checkValidity() || !email) return say("Entrez d'abord votre adresse e-mail.");
    busy(true);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
    busy(false);
    if (!error) return say(`Lien envoyé à ${email}. Ouvrez-le sur cet appareil pour vous connecter.`);
    const limit = error.status === 429 || /rate limit|security purposes/i.test(error.message || '');
    say(limit ? "Trop d'e-mails envoyés d'un coup. Le service d'e-mail limite les envois : réessayez dans une heure."
              : `L'envoi du lien a échoué (${error.message || 'erreur inconnue'}). Vérifiez l'adresse et réessayez.`);
  });

  document.getElementById('signout').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

  // Compte : prénom, adresse, mot de passe.
  const dlg = $('acct');
  function showUser() {
    const me = window.ME, p = me.profile;
    const init = (p.name || p.handle || '?').trim()[0].toUpperCase();
    $('acct-init').textContent = $('acct-av').textContent = init;
    $('acct-name').textContent = p.name || 'Mon compte';
    $('acct-email').textContent = '@' + p.handle + ' · ' + (me.email || '');
    $('acct-name-in').value = p.name;
    $('acct-handle-in').value = p.handle;
    $('acct-since').textContent = me.created_at ? 'Compte créé le ' + new Date(me.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    window.Social && window.Social.refreshHeader();
  }
  function note(t) { const m = $('acct-msg'); m.textContent = t; m.hidden = !t; }
  function openAccount(t) { note(t || ''); dlg.showModal(); }
  window.openAccount = openAccount;
  $('acct-btn').addEventListener('click', () => openAccount());
  $('acct-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  $('acct-name-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    const name = $('acct-name-in').value.trim().slice(0, 40);
    const handle = $('acct-handle-in').value.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_.]{3,24}$/.test(handle)) { btn.disabled = false; return note('Le pseudo fait 3 à 24 caractères : lettres sans accent, chiffres, point ou tiret bas.'); }
    const { data, error } = await sb.from('profiles').update({ name, handle }).eq('id', window.ME.id).select().single();
    btn.disabled = false;
    if (error) return note(/duplicate|unique/i.test(error.message) ? 'Ce pseudo est déjà pris, essayez-en un autre.' : `Non enregistré (${error.message}).`);
    window.ME.profile = data; showUser(); note('Profil enregistré.');
  });
  $('acct-pass-form').addEventListener('submit', async e => {
    e.preventDefault();
    const i = $('acct-pass-in'), btn = e.target.querySelector('button'); btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: i.value });
    btn.disabled = false;
    if (error) return note(`Mot de passe non changé (${error.message}).`);
    i.value = ''; note('Mot de passe changé.');
  });

  // Supabase interdit d'appeler l'API dans ce rappel (blocage) : on le fait juste après.
  sb.auth.onAuthStateChange((_evt, session) => { setTimeout(() => enter(session).catch(showLogin), 0); });


  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
