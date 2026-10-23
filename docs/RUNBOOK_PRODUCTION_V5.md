# Mise en production de la V5 : procédure pas à pas

Rédigée le 2026-10-19 pour le propriétaire du site. **Rien ici ne s'exécute tout seul.** Chaque étape
est une action que vous lancez, dans l'ordre, après avoir lu la précédente. En cas de doute, arrêtez-vous
et envoyez-moi la sortie de la dernière commande (jamais un mot de passe ni une adresse de base).

Ce document complète `docs/MISE_EN_LIGNE_NETLIFY.md` (Netlify, DNS) et
`docs/AUTHORIZATION_MIGRATION_RUNBOOK.md` (rôles et propriétaire, en anglais).

## Étape 0 : changer les secrets exposés (avant tout le reste)

À faire une seule fois, maintenant. Les anciens secrets sont à considérer comme volés.

| Secret                          | Où le changer                                                                                                 | Où mettre le nouveau                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Clé TMDB (`TMDB_API_KEY`)       | themoviedb.org, Paramètres, API : régénérer la clé (et le jeton `TMDB_READ_TOKEN`)                            | `.env` de votre PC et Netlify (Production et Preview)             |
| Jeton Telegram                  | Telegram, @BotFather, `/revoke` puis `/token` sur votre bot                                                   | Netlify, `TELEGRAM_BOT_TOKEN` (seulement si vous gardez Telegram) |
| Secret du webhook Telegram      | Inventez une nouvelle chaîne aléatoire (32 caractères ou plus)                                                | Netlify, `TELEGRAM_WEBHOOK_SECRET`                                |
| Mot de passe posté dans le chat | Commande ci-dessous, sur chaque base où ce mot de passe existe (votre PC, puis la production après l'étape 3) | Votre gestionnaire de mots de passe, nulle part ailleurs          |

Changer un mot de passe (il est tapé deux fois, caché, jamais écrit dans l'historique). Dans PowerShell,
depuis le dossier du projet :

```text
$env:WORKER_DATABASE_URL="<adresse de la base>"
$env:PASSWORD_RESET_CONFIRM="set-user-password"
pnpm auth:set-password -- --username <votre identifiant>
Remove-Item Env:PASSWORD_RESET_CONFIRM, Env:WORKER_DATABASE_URL
```

Toutes les sessions du compte sont déconnectées : reconnectez-vous ensuite. Pour la base de votre PC,
l'adresse est `postgres://postgres:postgres@127.0.0.1:5433/postgres` (base de démonstration locale).

## Étape 1 : sauvegarder la base de production

Sans sauvegarde vérifiée, n'allez pas plus loin.

1. Chez votre hébergeur (Neon, Supabase…), créez un instantané ou une branche de sauvegarde, **ou**
   avec PostgreSQL installé :
   `pg_dump --format=custom --file=alandb-avant-v5.dump "<adresse de production>"`
2. Vérifiez que la sauvegarde se relit : `pg_restore --list alandb-avant-v5.dump | Select-Object -First 5`
   doit afficher des lignes, pas une erreur.
3. Gardez ce fichier hors du dossier du projet.

## Étape 2 : savoir où en est la base

Ouvrez la console SQL de l'hébergeur (ou `psql "<adresse>"`) et lancez, une par une :

```sql
select count(*) from drizzle.__drizzle_migrations;
select to_regclass('public.users'), to_regclass('public.auth_invites'), to_regclass('public.media_files');
```

- **La première requête répond un nombre** : la base suit l'historique Drizzle. Passez à l'étape 3A.
- **Elle répond « relation does not exist »** mais `users` existe : la base a été créée sans historique.
  Passez à l'étape 3B.
- **`users` n'existe pas** : base vide. Suivez l'option A de `docs/MISE_EN_LIGNE_NETLIFY.md` (étape 1).

## Étape 3 : appliquer les migrations 0002 à 0008

Ce qu'elles font (toutes additives : elles ajoutent, elles ne suppriment rien) :

| Migration | Contenu                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| 0002      | Journal d'activité, sessions d'IA (désactivées), limitation de débit, réglages utilisateur                 |
| 0003      | Rôles, comptes désactivables, invitations, journal d'audit. **Déconnecte toutes les sessions existantes.** |
| 0004      | Notes IMDb des films (colonnes vides au départ)                                                            |
| 0005      | Plateformes de streaming légales par film (« Où regarder »)                                                |
| 0006      | Séries, saisons, épisodes, et l'index de vos fichiers vidéo (`media_files`)                                |
| 0007      | Progression de lecture (reprendre là où vous étiez)                                                        |
| 0008      | Watchlist et favoris des séries                                                                            |

**3A, base avec historique :**

```text
$env:DATABASE_URL="<adresse de production>"
pnpm db:migrate
Remove-Item Env:DATABASE_URL
```

**3B, base sans historique :** appliquez les fichiers un par un, dans l'ordre, avec `psql` (ils sont
écrits pour pouvoir être relancés sans casse) :

```text
psql "<adresse de production>" -v ON_ERROR_STOP=1 -f drizzle/0002_wet_masque.sql
psql "<adresse de production>" -v ON_ERROR_STOP=1 -f drizzle/0003_complete_skrulls.sql
```

… et ainsi de suite jusqu'à `0008_user_show_interactions.sql`. Arrêtez-vous à la première erreur et
envoyez-la-moi.

## Étape 4 : vérifier (des nombres, jamais des données privées)

```sql
select role, count(*) from users group by role order by role;
select count(*) from movies;
select to_regclass('public.user_show_interactions');
```

Le premier résultat doit montrer vos comptes (tous `member` après 0003). Le dernier doit afficher le nom
de la table, pas `null`. Ensuite, désignez le propriétaire en suivant `docs/AUTHORIZATION_MIGRATION_RUNBOOK.md`
(section _Migration sequence_, points 4 à 6).

## Étape 5 : remplir la bibliothèque de vos fichiers (optionnel, pour le streaming)

Seulement si vous voulez regarder vos films depuis le site en ligne (option B, voir
`docs/superpowers/specs/2026-10-19-media-node-design.md`). Sur votre PC :

```text
$env:WORKER_DATABASE_URL="<adresse de production>"
$env:MEDIA_LIBRARY_ROOTS="F:/MOVIES"
$env:FFPROBE_PATH="<dossier de ffmpeg>/bin/ffprobe.exe"
pnpm library:scan
Remove-Item Env:WORKER_DATABASE_URL, Env:MEDIA_LIBRARY_ROOTS, Env:FFPROBE_PATH
```

La clé TMDB est lue dans votre `.env`. Le scan ne fait que **lire** `F:/MOVIES` ; il n'y écrit, ne renomme et ne supprime jamais rien. Les chemins
de vos fichiers sont stockés dans la base mais ne sont jamais envoyés aux navigateurs.

## Étape 6 : le serveur média sur votre PC (option B)

Seulement après la mise en production (étape 5 de `docs/MISE_EN_LIGNE_NETLIFY.md`). Votre PC ne sert alors
**que** la lecture de vos fichiers ; tout le reste du site (pages, comptes) vient de Netlify.

1. Créez une clé partagée (une seule fois) et gardez-la dans votre gestionnaire de mots de passe :
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
2. Dans Netlify (Production seulement), ajoutez :
   `MEDIA_ORIGIN` = `https://alanjuggerson.taildf8547.ts.net:8443` et `MEDIA_GRANT_KEY` = la clé.
   Redéployez.
3. Sur votre PC, dans un PowerShell, depuis le dossier du projet (après `pnpm build`) :

   ```text
   $env:MEDIA_NODE="1"
   $env:MEDIA_APP_ORIGIN="https://alandatabase.com"
   $env:MEDIA_GRANT_KEY="<la clé>"
   $env:DATABASE_URL="<adresse de production>"
   $env:MEDIA_LIBRARY_ROOTS="F:/MOVIES"
   $env:FFMPEG_PATH="<dossier de ffmpeg>/bin/ffmpeg.exe"
   $env:FFPROBE_PATH="<dossier de ffmpeg>/bin/ffprobe.exe"
   pnpm media:node
   ```

   Vérifiez : `http://127.0.0.1:4174/api/health` répond, `http://127.0.0.1:4174/` répond 404 (normal).

4. Publiez ce port, et lui seul, sur Internet : `tailscale funnel --bg --https=8443 http://127.0.0.1:4174`.
   Votre aperçu privé sur le port 443 reste privé.
5. Sur alandatabase.com, connecté, lancez un film : il vient de votre PC.

Pour tout couper : `tailscale funnel --https=8443 off`, puis fermez la fenêtre du serveur. Le site reste en
ligne ; seuls vos films deviennent indisponibles. Pour invalider tous les accès en cours, changez
`MEDIA_GRANT_KEY` des deux côtés.

Limites : le débit de Funnel n'est pas garanti ; en cas de lenteur, la qualité baisse automatiquement. Le PC
doit rester allumé pendant la lecture.

## Si quelque chose tourne mal

- **Pendant les étapes 3 et 4** : ne supprimez rien. Restaurez la sauvegarde de l'étape 1
  (`pg_restore --clean --dbname "<adresse>" alandb-avant-v5.dump`, ou restauration de l'instantané chez
  l'hébergeur), puis envoyez-moi l'erreur.
- **Les migrations 0006 à 0008** se défont en supprimant les tables qu'elles ont créées ; leur en-tête
  (`drizzle/0006_*.sql` à `0008_*.sql`) indique lesquelles. Pour 0002 à 0005, restaurez la sauvegarde.
- L'ancien site reste en ligne tant que l'étape 5 de `docs/MISE_EN_LIGNE_NETLIFY.md` n'est pas faite.
