/* Connexion par lien magique, puis démarrage de l'appli. */
(function () {
  const sb = window.sb;
  const login = document.getElementById('login'), shell = document.getElementById('shell');
  const msg = document.getElementById('login-msg');
  let started = false;

  function say(t) { msg.textContent = t; msg.hidden = false; }

  async function enter(session) {
    if (!session) { shell.hidden = true; login.hidden = false; return; }
    const { data: ok, error } = await sb.rpc('is_member');
    if (error || !ok) {
      shell.hidden = true; login.hidden = false;
      say(`Le compte ${session.user.email} n'a pas encore accès au carnet. Demandez à ce qu'il soit ajouté à la liste des membres, puis rouvrez l'appli.`);
      return;
    }
    login.hidden = true; shell.hidden = false;
    showUser(session.user);
    if (!started) { started = true; window.startApp(); }
  }

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
  const $ = id => document.getElementById(id);
  const dlg = $('acct');
  let user = null;
  function showUser(u) {
    user = u;
    const name = (u.user_metadata && u.user_metadata.name) || '';
    const init = (name || u.email || '?').trim()[0].toUpperCase();
    $('acct-init').textContent = $('acct-av').textContent = init;
    $('acct-name').textContent = name || 'Mon compte';
    $('acct-email').textContent = u.email || '';
    $('acct-name-in').value = name;
    $('acct-since').textContent = u.created_at ? 'Compte créé le ' + new Date(u.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  }
  $('acct-btn').addEventListener('click', () => { $('acct-msg').hidden = true; dlg.showModal(); });
  $('acct-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  async function save(form, attrs, ok) {
    const btn = form.querySelector('button'); btn.disabled = true;
    const { data, error } = await sb.auth.updateUser(attrs);
    btn.disabled = false;
    const msg = $('acct-msg'); msg.hidden = false;
    if (error) { msg.textContent = `Non enregistré (${error.message}).`; return; }
    if (data && data.user) showUser(data.user);
    msg.textContent = ok;
  }
  $('acct-name-form').addEventListener('submit', e => { e.preventDefault(); save(e.target, { data: { name: $('acct-name-in').value.trim() } }, 'Prénom enregistré.'); });
  $('acct-pass-form').addEventListener('submit', e => { e.preventDefault(); const i = $('acct-pass-in'); save(e.target, { password: i.value }, 'Mot de passe changé.').then(() => { i.value = ''; }); });

  // Supabase interdit d'appeler l'API dans ce rappel (blocage) : on le fait juste après.
  sb.auth.onAuthStateChange((_evt, session) => { setTimeout(() => enter(session).catch(showLogin), 0); });

  function showLogin() { shell.hidden = true; login.hidden = false; }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
