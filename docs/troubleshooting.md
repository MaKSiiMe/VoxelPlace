# VoxelPlace — Problèmes rencontrés & résolutions

---

## 1. Canvas web complètement blanc après déploiement

**Date :** Juin 2026  
**Symptôme :** La toile s'affiche entièrement blanche malgré des pixels posés (visibles côté Minecraft).

### Diagnostic

La connexion WebSocket était fonctionnelle (101 Switching Protocols, `grid:init` reçu à 8 Mo).  
Le hash Redis `voxelplace:pixels` contenait 260 entrées avec des `colorId` valides.  
Pourtant, le byte lu dans `voxelplace:grid` à une position connue retournait `0`.

### Cause

Le buffer binaire `voxelplace:grid` avait été **réinitialisé à zéro** lors d'un redéploiement.  
La fonction `loadGrid()` contient un comportement destructif : si la taille du buffer en Redis ne correspond pas à `GRID_SIZE * GRID_SIZE`, elle l'écrase silencieusement avec un buffer vide.

```js
// grid.js — comportement actuel (dangereux)
const buf = await redis.getBuffer(GRID_KEY)
if (buf && buf.length === GRID_SIZE * GRID_SIZE) return buf

const empty = Buffer.alloc(GRID_SIZE * GRID_SIZE, 0)
await redis.set(GRID_KEY, empty) // écrase sans backup
```

Le hash `voxelplace:pixels` (métadonnées) et la table PostgreSQL `pixel_history` n'ont pas été affectés — ils vivent dans des structures indépendantes.

### Résolution

Reconstruction du buffer depuis PostgreSQL via le script de restauration :

```bash
docker exec voxelplace-api node scripts/restore-canvas.js
```

Le script lit `pixel_history` (294 entrées), reconstruit le buffer 4 Mo avec les bons `colorId` aux bons index (`y * 2048 + x`), et le réécrit dans `voxelplace:grid`. Les 260 pixels réels (dernière valeur par coordonnée) sont réapparus immédiatement.

### Fix long terme recommandé

Rendre `loadGrid()` non-destructif : au lieu d'écraser le buffer en cas de taille incorrecte, logger une erreur et déclencher une restauration automatique depuis `pixel_history`.

---

## 2. Variables d'environnement manquantes dans `.env.example`

**Date :** Juin 2026  
**Symptôme :** Après clonage du repo sur un nouveau serveur, le canvas web ne se connecte pas au socket-server.

### Cause

`.env.example` ne documentait pas `NEXT_PUBLIC_API_URL` ni `ALLOWED_ORIGINS`.  
Sans `NEXT_PUBLIC_API_URL`, Next.js est compilé avec `http://localhost` comme URL de l'API.  
Depuis un browser distant, `http://localhost` pointe vers la machine du visiteur, pas le serveur.  
Sans `ALLOWED_ORIGINS`, le socket-server n'autorise que `localhost:5173` et `localhost:3000` — tout autre domaine est rejeté par CORS.

### Résolution

Ajout des deux variables dans `.env.example` :

```env
NEXT_PUBLIC_API_URL=http://localhost        # URL publique du serveur (ex: https://mon-domaine.com)
ALLOWED_ORIGINS=http://localhost:3000,...   # Origins autorisées pour CORS et Socket.io
```

`NEXT_PUBLIC_API_URL` est un **build arg** Next.js — l'image Docker doit être reconstruite sans cache après modification :

```bash
docker compose build --no-cache voxelplace-web
docker compose up -d
```

### Fix appliqué

`.env.local` des apps ajouté au `.dockerignore` pour éviter qu'il écrase le build arg lors du build Docker :

```
**/.env.local
**/.env.*.local
```

---

## Conclusion

Deux classes de problèmes ont été identifiés sur ce projet :

**Infrastructure / déploiement** — Les variables d'environnement liées au déploiement (`NEXT_PUBLIC_API_URL`, `ALLOWED_ORIGINS`) doivent être documentées et le `.dockerignore` doit exclure les `.env.local` pour garantir que le build arg est bien utilisé.

**Résilience des données Redis** — Redis est utilisé comme cache rapide, mais `voxelplace:grid` est aussi la source de vérité du canvas. Sa réinitialisation silencieuse est un point de fragilité. PostgreSQL (`pixel_history`) joue le rôle de backup fiable et permet de reconstruire l'état complet via `restore-canvas.js`. À terme, cette restauration devrait être automatique au démarrage du serveur si le buffer Redis est absent ou invalide.
