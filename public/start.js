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
    if (!started) { started = true; window.startApp(); }
  }

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
    btn.disabled = false;
    if (!error) return say(`Lien envoyé à ${email}. Ouvrez-le sur cet appareil pour vous connecter.`);
    const limit = error.status === 429 || /rate limit|security purposes/i.test(error.message || '');
    say(limit ? "Trop de liens envoyés d'un coup. Le service d'e-mail limite les envois : réessayez dans une heure, ou ouvrez un lien déjà reçu."
              : `L'envoi du lien a échoué (${error.message || 'erreur inconnue'}). Vérifiez l'adresse et réessayez.`);
  });
  document.getElementById('signout').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

  // Supabase interdit d'appeler l'API dans ce rappel (blocage) : on le fait juste après.
  sb.auth.onAuthStateChange((_evt, session) => { setTimeout(() => enter(session).catch(showLogin), 0); });

  function showLogin() { shell.hidden = true; login.hidden = false; }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
