/* Importer une recette depuis un lien ou une photo : /api/import la lit, le formulaire s'ouvre prérempli. */
(function () {
  const $ = id => document.getElementById(id);
  const dlg = () => $('import');
  const MSG = {
    no_key: 'La lecture par Claude n’est pas encore activée (clé API à ajouter dans Vercel). Les liens des grands sites de recettes marchent déjà.',
    fetch: 'Impossible d’ouvrir ce lien. Vérifiez l’adresse, ou faites une capture d’écran de la recette et importez-la en photo.',
    not_found: 'Aucune recette trouvée. Essayez une photo plus nette, ou un autre lien.',
    auth: 'Votre session a expiré : reconnectez-vous.',
  };

  function say(t, busy) {
    const m = $('imp-msg'); m.textContent = t || ''; m.hidden = !t;
    m.classList.toggle('busy', !!busy);
    dlg().querySelectorAll('button, input').forEach(el => { if (!el.hasAttribute('data-close')) el.disabled = !!busy; });
  }

  // Photo de téléphone : réduite avant l'envoi (limite de taille et coût de lecture).
  async function toJpeg(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }

  async function run(body) {
    say(body.url ? 'Lecture de la page…' : 'Lecture de la photo… (jusqu’à 30 secondes)', true);
    try {
      const { data } = await window.sb.auth.getSession();
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session && data.session.access_token) },
        body: JSON.stringify(body),
      });
      const out = await r.json().catch(() => ({ error: 'server' }));
      if (!r.ok || !out.recipe) return say(MSG[out.error] || 'L’import a échoué. Réessayez dans un instant.');
      say('');
      dlg().close();
      S.edit = { id: null, draft: out.recipe }; S.detail = null; S.view = 'recettes';
      render(); scrollTo(0, 0);
      toast('Recette importée : relisez-la puis enregistrez');
    } catch (e) {
      say('Pas de connexion. Réessayez quand le réseau revient.');
    }
  }

  function open(url) {
    say('');
    $('imp-url').value = url || '';
    if (!dlg().open) dlg().showModal();
    if (url) run({ url });
  }

  document.addEventListener('submit', e => {
    if (e.target.id !== 'imp-form') return;
    e.preventDefault();
    const url = $('imp-url').value.trim();
    if (url) run({ url });
  });
  document.addEventListener('change', async e => {
    if (e.target.id !== 'imp-photo') return;
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { run({ image: await toJpeg(f), mediaType: 'image/jpeg' }); }
    catch (err) { say('Cette image n’a pas pu être lue. Essayez une photo au format JPEG.'); }
  });
  document.addEventListener('click', e => {
    if (e.target === dlg()) dlg().close();
  });

  // Partage depuis le navigateur du téléphone (Android) : l'appli s'ouvre avec le lien.
  function fromShare() {
    const q = new URLSearchParams(location.search);
    const link = q.get('url') || ((q.get('text') || '').match(/https?:\/\/\S+/) || [])[0];
    if (!link) return;
    history.replaceState(null, '', '/');
    open(link);
  }

  window.Importer = { open, fromShare };
})();
