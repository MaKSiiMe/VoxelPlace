# État des lieux technique — VoxelPlace

> Audit du code au 10 septembre 2026, branche `feature/claude-overhaul` (base : `main` @ `84f9b3f`).
> Chaque point est vérifié par lecture du code ou reproduction. Les affirmations non vérifiées
> sont signalées comme telles.
>
> Cet audit porte sur le **code**. L'audit des **documents RNCP** est dans
> `docs/audit-verification-dossier.md`.
>
> **État au 10 septembre 2026, après la passe de fiabilisation :** les points 1 à 11 sont
> traités, ainsi que la majeure partie de la dette listée plus bas. Le détail de ce qui a
> été corrigé — et de ce que la mise sous tests a fait apparaître ensuite — se trouve en
> fin de document, section « Ce qui a été traité ».

---

## Ce qui va bien

Le projet est plus solide que la moyenne d'un projet de fin d'année :

- **Découpage feature-based cohérent** back et front — un dossier par domaine, pas de
  fourre-tout `utils/` géant.
- **Le choix Redis + PostgreSQL est réellement justifié**, pas décoratif : buffer binaire
  4 Mo pour la lecture O(1) de la grille, PostgreSQL pour tout ce qui demande de
  l'historique ou des requêtes analytiques (heatmap, timelapse, conflits, streaks).
- **104 tests passent** (51 backend `node:test`, 53 frontend Vitest) — le README annonce
  encore 35, chiffre obsolète.
- **CI/CD réelle et fonctionnelle** : tests bloquants avant déploiement, redéploiement
  conditionnel du plugin Minecraft uniquement si ses sources ont changé.
- **Le pont Minecraft fonctionne vraiment** — c'est la partie la plus originale du projet
  et elle est aboutie (rollback optimiste, action bar, tutoriel, commandes OP).
- **Fonctionnalités riches** : skill tree 27 nœuds, git-blame par pixel, timelapse GIF,
  heatmap, modération, RGPD.

---

## 🔴 Bloquants

### 1. `verifyToken` n'est pas importé — le serveur crashe à chaque connexion authentifiée

`apps/socket-server/src/index.js:63` appelle `verifyToken(token, JWT_SECRET)` dans le
middleware `io.use`. La fonction est exportée par `features/auth/routes.js` mais **jamais
importée** dans `index.js`.

Conséquence exacte, reproduite : Socket.io n'entoure pas l'exécution des middlewares d'un
`try/catch`. Le `ReferenceError` remonte jusqu'à `process` → **crash du process Node**.
En production (`restart: always`), le conteneur redémarre en boucle.

Chemin de déclenchement : le client envoie systématiquement le token
(`features/realtime/socket.ts:10`). Un visiteur non connecté envoie `''` (falsy, le `if`
est ignoré) et passe. **Dès qu'un utilisateur connecté ouvre le site, l'API tombe.**

Et comme `pixel:place` refuse toute pose sans `socket.data.verifiedUsername`, plus aucun
joueur web ne peut poser de pixel — la fonctionnalité centrale de l'application.

Introduit par `1f35cad` ("Refactor code structure…", 8 juin 2026). Correctif : une ligne
d'import. Cause profonde : **aucun test ne couvre les handlers socket ni les routes HTTP**
(voir 🟠 6).

### 2. `admin:clearAll` : 4,2 millions d'écritures Redis et autant d'émissions socket

`index.js:385-401` boucle sur les 4 194 304 pixels, avec pour **chacun** un `await setPixel`
(2 allers-retours Redis) et un `io.emit('pixel:update')` diffusé à tous les clients.

Soit ~8,4 millions de commandes Redis et 4,2 millions de messages par client connecté.
L'event loop est bloquée plusieurs minutes, les clients saturent. Le correctif est
immédiat : un `SET` du buffer vide + un `DEL` du hash + un seul `canvas:reload` broadcast.

### 3. La grille transite en JSON — ~10 Mo par connexion

`grid:init` et `GET /api/grid` renvoient `Array.from(buf)` : 4 194 304 entiers sérialisés
en JSON, soit 8 à 12 Mo de texte pour 4 Mo de données binaires. C'est pourquoi
`maxHttpBufferSize` est monté à 64 Mo (`index.js:56`).

Chaque connexion, chaque rechargement et chaque `grid:request` repaie ce coût. Socket.io
sait transporter un `Buffer` en binaire nativement : ~4 Mo, et compressible.

### 4. Front : 20 Mo alloués et une texture 16 Mo ré-uploadée à **chaque** pixel reçu

Chaîne complète pour un seul pixel distant :

1. `store.ts:96` — `updatePixel` fait `new Uint8Array(state.grid)` : copie de 4 Mo.
2. `usePixiCanvas.ts:146` — la souscription rappelle `gridToRGBA` : alloue 16 Mo et
   convertit les 4,2 M pixels un par un.
3. `bufferSource.update()` — ré-upload la texture entière vers le GPU.

Sur un canvas actif à 10 pixels/seconde, cela représente ~200 Mo/s d'allocations et
autant de pression sur le GC. C'est le vrai plafond de performance du client.

Le correctif est structurel : muter le buffer en place et n'écrire que les 4 octets RGBA
concernés, puis marquer la texture partiellement modifiée (ou reconstruire au plus une
fois par frame via le ticker, pas par pixel).

---

## 🟠 Sérieux

### 5. Cooldown et rate limiting entièrement en mémoire

`lastPlaced`, `userCache` (`index.js`) et `attempts` (`auth/rate-limit.js`) sont des `Map`
de process. Conséquences : un redémarrage de l'API remet tous les cooldowns à zéro, et le
service ne peut pas être répliqué (deux instances = deux fois plus de pixels autorisés).
Redis est déjà présent et fait exactement ça (`SET NX PX` / `INCR EXPIRE`).

### 6. Aucun test d'intégration : ni route HTTP, ni handler socket

Les 104 tests couvrent uniquement des fonctions pures (validation, hachage, stores). Les
~40 routes REST et les ~10 handlers socket — c'est-à-dire la quasi-totalité de la logique
métier — ne sont couverts par rien. Le bug 🔴 1 aurait été attrapé par un seul test de
connexion socket avec un token.

### 7. `POST /api/admin/login` n'est pas rate-limité

`admin/routes.js:23` compare le mot de passe admin sans aucune limite de tentatives, alors
que `/api/auth/login` et `/api/auth/register`, eux, le sont (10 req/min). Le mot de passe
admin est donc brute-forçable, et il délivre un JWT `superadmin` valable 7 jours qui donne
accès au vidage complet du canvas.

La comparaison `password !== expected` n'est pas non plus à temps constant.

### 8. PostgreSQL et Redis sont exposés publiquement dans `docker-compose.yml`

```yaml
voxelplace-db:    ports: ["5432:5432"]
voxelplace-redis: ports: ["6379:6379"]
```

Ces deux services ne sont consommés que par `voxelplace-api`, sur le réseau interne
Docker. Publier les ports sur l'hôte les expose à toute interface accessible de la
machine — et Redis n'a **aucun mot de passe** configuré. Ces deux lignes doivent
disparaître (ou être bindées sur `127.0.0.1`).

### 9. `voxelplace-api` ne déclare pas sa dépendance à Redis

`depends_on` ne mentionne que `voxelplace-db`. Au démarrage de la stack, l'API peut donc
tenter de joindre Redis avant qu'il n'écoute. `ioredis` reconnecte tout seul, donc l'effet
est atténué — mais la dépendance reste fausse dans la déclaration.

### 10. Pas de journalisation structurée

`Fastify({ logger: false })` et une soixantaine de `console.log` / `console.error`. Aucune
requête HTTP n'est tracée, aucune erreur n'est corrélable à un utilisateur ou à une
requête. En cas d'incident en production, il n'y a rien à lire. Fastify embarque Pino.

### 11. Aucune validation de schéma sur les routes Fastify

Chaque handler re-valide ses paramètres à la main, avec des trous : `/api/grid/window`
(`index.js:114`) fait `parseInt` sans vérifier `NaN` — `?x=abc` produit un `NaN` qui
traverse la boucle et renvoie une fenêtre entièrement remplie de `0`. Fastify valide
nativement via JSON Schema, ce qui supprimerait ces vérifications manuelles.

---

## 🟡 Dette et cohérence

| Point | Détail |
|-------|--------|
| **Code mort** | `packages/db/` (Drizzle : schéma, migrations, config) n'est importé nulle part — le backend utilise `pg` brut. Deux définitions concurrentes du schéma coexistent. |
| **Code mort** | `voxelplace-minecraft/` à la racine est un dossier vide (reliquat de build). `CLAUDE.md` y pointait encore. |
| **Poids inutile** | `tools/preview-creeper.html` et `tools/preview-pixels.html` : 229 Ko chacun, versionnés. |
| **Duplication** | `SUPERUSER_PREFIXES` est réécrit en dur deux fois dans `auth/routes.js` (l. 63 et 110) alors que `@voxelplace/types/roles` l'exporte. |
| **Duplication** | La palette existe en trois exemplaires (voir `CLAUDE.md`, invariant 1). |
| **`index.js` fourre-tout** | 533 lignes : rate limiting, stats, heatmap, snapshot, conflits, historique + tous les handlers socket. Les features sont extraites, mais pas ce fichier. |
| **Import en milieu de fichier** | `index.js:278` importe `@voxelplace/types/roles` au milieu du code. Valide en ESM (hoisté), mais trompeur. |
| **README obsolète** | Annonce « 35 tests » (104 réels) et « Node.js 20 » dans le tableau de stack alors que la CI utilise Node 22. |
| **Pas de linter** | `turbo run lint` n'appelle que `next lint` sur le front. Le backend JS n'a ni ESLint ni formateur. |
| **Perf front** | `GameFrame.tsx:104` fait un `setState` React à **chaque frame** (60 fps) pour animer la couleur de la bordure pendant le cooldown, ce qui re-rend tout le HUD. Une variable CSS animée suffirait. |
| **Pas de `/health`** | Le healthcheck Docker interroge `/api/stats`, qui touche Redis — une route de santé dédiée distinguerait « process vivant » de « dépendances joignables ». |
| **RGPD partiel** | La suppression de compte enchaîne 6 `DELETE` **sans transaction** (`auth/routes.js:164-169`). Une erreur en cours de route laisse des données personnelles orphelines. |

---

## Ordre de traitement proposé

1. **Rétablir le service** — bug 1, puis 2, 8, 7. Ce sont des correctifs courts et à fort effet.
2. **Filet de sécurité** — tests d'intégration HTTP + socket (6), avant toute refonte, pour
   que la suite soit vérifiable.
3. **Performance** — protocole binaire (3) et rendu incrémental (4), les deux plafonds réels.
4. **Robustesse** — cooldowns dans Redis (5), journalisation (10), schémas de validation (11).
5. **Nettoyage** — code mort, duplications, découpage d'`index.js`, README.


---

## Ce qui a été traité

### Les bloquants et les points sérieux

| # | Point | Traitement |
|---|-------|-----------|
| 1 | `verifyToken` non importé | Middleware extrait dans `features/auth/socket-auth.js`, erreurs absorbées, couvert par un test d'intégration Socket.io réel |
| 2 | `admin:clearAll` en 4,2 M d'écritures | `clearGrid()` : un `SET`, un `DEL`, un seul `canvas:reload`. Le plugin Minecraft sait désormais y réagir |
| 3 | Grille transportée en JSON | **Non traité** — voir ci-dessous |
| 4 | Rendu front : 20 Mo par pixel | **Non traité** — voir ci-dessous |
| 5 | Cooldown en mémoire | Extrait dans `features/canvas/cooldown.js`, horloge injectable, 15 tests. Reste en mémoire : documenté comme limite au déploiement mono-instance |
| 6 | Aucun test d'intégration | 245 tests backend contre un vrai PostgreSQL 16 |
| 7 | `/api/admin/login` non limité | Rate limit 5/min + comparaison à temps constant, sur la route REST **et** l'événement socket |
| 8 | Bases publiées sur toutes les interfaces | PostgreSQL sur la loopback, Redis interne, versions épinglées |
| 9 | Dépendance Redis non déclarée | Ajoutée à `depends_on` |
| 10 | Pas de journalisation structurée | **Non traité** |
| 11 | Aucune validation des paramètres | `shared/query.js`, adopté par toutes les routes |

### Ce que la mise sous tests a révélé

Ces défauts n'étaient pas dans l'audit initial : ils sont apparus en écrivant les tests.

- **Le build frontend échouait depuis le 8 juin** — `roles.ts` réexportait depuis `./roles.js`,
  que TypeScript résout vers lui-même. La CI ne construisait pas, le script de déploiement
  n'avait pas de `set -e` : l'API était redéployée pendant que le conteneur web gardait une
  image d'avant juin. D'où l'erreur CSRF à la connexion, insoluble côté serveur.
- **Contournement d'authentification sur les signalements** — la feature avait son propre
  `requireAdmin`, qui décodait le jeton en base64 **sans vérifier la signature** et lisait un
  champ `isAdmin` que personne n'émet. Ouvert aux jetons forgés, fermé aux vrais
  administrateurs. Implémentation désormais unique et partagée.
- **Épuisement mémoire depuis `/api/admin/pixel/clear`** — un `typeof x === 'number'` sans
  bornes laissait passer n'importe quel entier vers `SETRANGE`, que Redis honore en
  agrandissant le buffer jusqu'à l'index demandé.
- **Progression dupliquée par la casse du pseudo** — `alice` et `Alice` ouvraient deux
  progressions parallèles. Le pseudo du jeton fait désormais autorité.
- **Suppression RGPD incomplète** — `unlockBaseNodes`, lancé sans `await` à l'inscription,
  réinsérait des lignes après la suppression du compte. La suppression est passée en transaction.
- **Débannissement sensible à la casse** — bannir « Alice » puis débannir « alice » renvoyait
  404 et laissait le joueur bloqué.
- **Une panne Redis tuait le process** — `io.on('connection')` faisait `await loadGrid` sans
  `try/catch` ; Socket.io n'attendant pas le handler, le rejet non géré terminait Node.
- **`/health` inaccessible** — nginx ne routait que `/api/` et `/socket.io/`.
- **Test et production sur des versions Node différentes** — CI sur 22, Dockerfiles sur 20.

### Ce qui reste ouvert

Par ordre de valeur :

1. **Performance du canvas** (points 3 et 4) — la grille transite en JSON (~10 Mo par
   connexion) et le client réalloue 20 Mo à chaque pixel reçu. Ce sont les deux vrais
   plafonds ; ils demandent un protocole binaire et un rendu incrémental.
2. **Journalisation structurée** (point 10) — Fastify embarque Pino, aucune requête n'est tracée.
3. **Couverture restante** — le chat, le timelapse et les dashboards joueur n'ont pas de tests ;
   le frontend n'est couvert que sur ses stores et utilitaires, pas ses composants ; le plugin
   Java n'a aucun test.
4. **Code mort** — `packages/db/` (Drizzle) et les deux fichiers de prévisualisation de 229 Ko
   dans `tools/`.
5. **`GameFrame.tsx`** — `setState` React à chaque frame pour animer la bordure du cooldown.
