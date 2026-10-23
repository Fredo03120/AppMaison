# Nos Recettes

Le carnet de recettes partagé de la maison : choisir des recettes au menu remplit la liste de courses, rangée par rayon. Chaque groupe (la maison, les copains…) a son carnet, son menu, sa liste et son chat ; l'onglet Social sert à ajouter des amis par pseudo, discuter et créer des groupes. Appli web installable sur téléphone (iPhone et Android) et utilisable sur ordinateur.

## Comment c'est fait

- `public/` : l'appli elle-même, des fichiers statiques sans étape de compilation (Vercel les sert tels quels).
  - `app.js` : l'interface (recettes, menu, liste de courses, ajout et modification de recettes).
  - `shim.js` : la couche de données au-dessus de Supabase.
  - `start.js` : la connexion (mot de passe ou lien par e-mail), le compte et le choix du carnet.
  - `social.js` : l'onglet Social (amis, chats privés et de groupe, création de groupes).
  - `sw.js` et `manifest.webmanifest` : ce qui rend l'appli installable et rapide à ouvrir.
  - `photos/` : les photos des 49 recettes d'origine.
- `supabase/schema.sql` : la base de données et ses règles d'accès (seules les adresses de la table `members` peuvent lire et écrire).
- `supabase/seed.sql` : les 49 recettes.
- `supabase/setup.sql` : les deux précédents réunis, à coller en une fois.
- `supabase/social.sql` : profils, groupes, amis et messages ; range le carnet d'origine dans le groupe « Maison ».

- `api/import.js` : importer une recette depuis un lien (données schema.org de la page) ou une photo (lue par Claude). La photo et les pages sans données structurées demandent la variable `ANTHROPIC_API_KEY` dans Vercel.

## Mise en route

1. **Supabase** : créez un projet sur supabase.com.
   - Dans SQL Editor, collez `supabase/setup.sql` (la base et les 49 recettes) et exécutez-le, puis faites de même avec `supabase/social.sql` (comptes, groupes, amis, chats). On peut les relancer sans risque.
   - Dans Authentication › URL Configuration, mettez l'adresse du site Vercel dans « Site URL ».
   - Dans Authentication › Sign In / Providers › Email, désactivez « Confirm email » : la création de compte se fait alors sans e-mail (le service d'e-mail gratuit n'envoie que quelques messages par heure).
   - Dans Project Settings › API, copiez l'« URL » et la clé « anon public » dans `public/config.js`.
2. **Vercel** : importez ce dépôt GitHub sur vercel.com. `vercel.json` indique le dossier à publier. Pour l'import de photos, ajoutez la variable d'environnement `ANTHROPIC_API_KEY` (Settings › Environment Variables) puis redéployez.
3. **Sur chaque téléphone** : ouvrez l'adresse du site, créez votre compte (ou connectez-vous) avec e-mail et mot de passe, puis :
   - iPhone (Safari) : bouton Partager › « Sur l'écran d'accueil ».
   - Android (Chrome) : menu ⋮ › « Installer l'application ».

## Ajouter une personne

Elle crée son compte depuis l'appli, puis vous l'ajoutez en ami avec son pseudo (onglet Social) et l'invitez dans un groupe. Les adresses de la table `members` rejoignent directement le groupe « Maison » à la création de leur compte.
