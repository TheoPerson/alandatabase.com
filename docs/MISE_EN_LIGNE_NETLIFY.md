# Remettre le site en ligne sur Netlify (guide simple)

Mis à jour le 2026-10-12. Ce guide est pour le propriétaire du site. Rien de ce qui suit n'a été fait
automatiquement : le code est prêt, mais la mise en ligne, la base de données et le DNS sont à vous.

## Pourquoi le site est en panne

- Le projet **Vercel** est désactivé : tous les domaines répondent `402 Payment Required`
  (`DEPLOYMENT_DISABLED`). Ce n'est pas un bug du code.
- Le DNS de `alandatabase.com`, `www`, `auth`, `api` et `status` pointe encore vers Vercel.
- Sur **Netlify**, le site `the-alans-data-base.netlify.app` est en ligne, mais c'est un **très vieux
  build (12 août)**, d'avant la sécurité de la version V3. Il est public. Il sera remplacé à l'étape 5.

## Ce qui est déjà prêt dans le code (branche `TheoPerson/V5-Alan-s-Data-Base`)

- Netlify est maintenant la seule cible (plus de Vercel).
- Le cookie de connexion et la protection de la base « test » ne dépendent plus de variables Vercel.
- Le site de test `.netlify.app` redirige vers `alandatabase.com`.
- Vérifié sur mon poste : types, lint, 260 tests, build Netlify : tout passe.
- **Pas encore vérifié** : un vrai build sur Netlify (la version de pnpm sur leur machine de build n'est
  pas confirmée) et une vraie base de données hébergée.

## Étape 1 : choisir la base de données (la décision importante)

Le code V3 a besoin de 3 changements dans la base (migrations `0002`, `0003`, `0004`). Ils n'ont **jamais**
été appliqués à votre base de production. Sans eux, la connexion ne marche pas.

**Option A, la plus simple et sans risque : une base neuve et vide.**
Créez une base PostgreSQL (par exemple sur Neon). Le site marchera, mais le catalogue sera vide au début
et vous perdez les anciens comptes et listes.

1. Dans PowerShell, avec l'adresse de la nouvelle base :
   `$env:DATABASE_URL="<adresse>"; pnpm db:migrate`
2. Pour remplir le catalogue (clé TMDB nécessaire) :
   d'abord `$env:WORKER_DATABASE_URL="<adresse>"; $env:TMDB_API_KEY="<clé>"`, puis
   `pnpm --dir worker ingest:genres` et `pnpm --dir worker ingest:popular`. Si `ingest:popular` se plaint de
   Meilisearch, dites-le-moi.
3. Le premier compte se crée sur `/auth/register` avec `OWNER_SETUP_KEY` (étape 2). C'est le compte
   propriétaire.

**Option B, garder vos données :** suivez à la lettre `docs/AUTHORIZATION_MIGRATION_RUNBOOK.md`.
**Faites d'abord une sauvegarde de la base.** Cette migration déconnecte tout le monde (c'est normal).

## Étape 2 : variables d'environnement sur Netlify

Dans Netlify : votre site, menu **Environment variables**. Mettez la bonne valeur pour **Production** et une
autre valeur pour **Deploy Previews / Branch deploys** quand c'est indiqué.

| Variable               | À mettre                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Base de **production** (étape 1). Production seulement.                                                     |
| `PREVIEW_DATABASE_URL` | Une **autre** base, pour les tests. Jamais la production.                                                   |
| `RATE_LIMIT_HASH_KEY`  | Texte aléatoire long (32 caractères ou plus). Obligatoire.                                                  |
| `OWNER_SETUP_KEY`      | Seulement pour créer le premier compte sur une base vide (32 caractères ou plus). **Supprimez-la ensuite.** |
| `TELEGRAM_*`           | Seulement si vous gardez Telegram. Utilisez un **nouveau** token (voir étape 7).                            |
| `UPTIMEROBOT_API_KEY`  | Facultatif (page de statut).                                                                                |

Ne mettez pas `NODE_ENV`. Ne mettez jamais `ALLOW_DEV_AUTH_BYPASS` en ligne.

## Étape 3 : déploiement de test (sans toucher au vrai site)

Un « brouillon » Netlify a sa propre adresse et ne remplace rien. Depuis le dossier du projet :

```text
pnpm dlx netlify-cli login
pnpm dlx netlify-cli deploy --site the-alans-data-base --context deploy-preview
```

`--context deploy-preview` est important : il force l'usage de `PREVIEW_DATABASE_URL`, donc **pas** de la
base de production. Si `PREVIEW_DATABASE_URL` manque, le site refuse de démarrer, exprès.

## Étape 4 : vérifier l'adresse de test

Ouvrez l'adresse « draft » donnée par la commande, et vérifiez :

1. `/` et `/movies` s'affichent. `/api/health` répond.
2. La connexion marche (`/auth/login`) et le compte propriétaire existe.
3. `/cinema/picker` marche une fois connecté.
4. Sans être connecté, `/my/films` vous renvoie vers la connexion.

Si le build échoue sur Netlify, copiez-moi les dernières lignes du journal. Le point à confirmer est la
version de pnpm (le projet utilise pnpm 11).

## Étape 5 : mise en production

Seulement quand l'étape 4 est bonne :

```text
pnpm dlx netlify-cli deploy --site the-alans-data-base --context production --prod
```

Cela remplace le vieux build public. Vérifiez `https://the-alans-data-base.netlify.app/`.

## Étape 6 : DNS (en dernier)

Dans Netlify, **Domain management** : ajoutez `alandatabase.com`, `www`, `api`, `auth` et `status`
comme domaines du site. Puis, là où le DNS est géré (votre registrar), remplacez les enregistrements qui
pointent vers Vercel (`vercel-dns-017.com`, `64.29.17.x`) par ceux que Netlify vous indique.
N'oubliez pas HTTPS (Netlify le fait tout seul une fois le DNS bon).

## Étape 7 : après la mise en ligne

1. Supprimez `OWNER_SETUP_KEY` de Netlify.
2. **Changez le token du bot Telegram** (dans BotFather). L'ancien était écrit dans le code public ; considérez-le
   comme volé. Mettez le nouveau dans Netlify.
3. Vous pourrez supprimer le projet Vercel quand tout marche.

## Si ça se passe mal

Les anciens domaines ne bougent qu'à l'étape 6. Avant elle, vous pouvez tout recommencer sans impact sur
`alandatabase.com` (qui est de toute façon en panne). Pour revenir en arrière après le DNS : remettez les anciens
enregistrements DNS.
