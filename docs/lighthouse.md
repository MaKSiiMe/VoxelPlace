# Rapport Lighthouse — VoxelPlace

> Audit de performance, accessibilité, bonnes pratiques et SEO.
> URL auditée : `https://s56c-srv.tailedae07.ts.net`

## Comment reproduire l'audit

```bash
# Via Chrome DevTools
# 1. Ouvrir l'URL dans Chrome
# 2. DevTools → onglet "Lighthouse"
# 3. Catégories : Performance, Accessibility, Best Practices, SEO
# 4. Device : Desktop + Mobile
# 5. Cliquer "Analyze page load"

# Via CLI (npx)
npx lighthouse https://s56c-srv.tailedae07.ts.net \
  --output html \
  --output-path ./docs/lighthouse-report.html \
  --only-categories=performance,accessibility,best-practices,seo
```

---

## Scores (incognito, 2026-06-15)

### Desktop

| Catégorie        | v1 (sans optim) | v2 (next/dynamic) | Statut |
|------------------|-----------------|-------------------|--------|
| Performance      | 79              | ~97               | ✅     |
| Accessibilité    | 95              | 95                | ✅     |
| Bonnes pratiques | 100             | 100               | ✅     |
| SEO              | 100             | 100               | ✅     |

> Mesuré en navigation privée (mode incognito) — référence officielle.
> Sans incognito v1 : Performance 60 (extensions Chrome qui polluent la mesure).

### Mobile

| Catégorie        | v1 (sans optim) | v2 (next/dynamic) | Statut |
|------------------|-----------------|-------------------|--------|
| Performance      | ~55             | ~75               | ✅     |
| Accessibilité    | 95              | 95                | ✅     |
| Bonnes pratiques | 100             | 100               | ✅     |
| SEO              | 100             | 100               | ✅     |

> Le mode Mobile simule un CPU lent (Moto G4, throttling ×4) — la pénalité sur le TBT est amplifiée par rapport au desktop.

## Métriques détaillées

| Métrique                      | Desktop v1 | Desktop v2 | Mobile v1  | Mobile v2  |
|-------------------------------|------------|------------|------------|------------|
| First Contentful Paint (FCP)  | 0.3 s ✅   | 0.4 s ✅   | 0.8 s ✅   | 0.9 s ✅   |
| Largest Contentful Paint (LCP)| 0.5 s ✅   | 0.6 s ✅   | 2.0 s ✅   | 2.0 s ✅   |
| Speed Index                   | 0.7 s ✅   | 1.0 s ✅   | 1.5 s ✅   | 3.3 s ✅   |
| Time to Interactive (TTI)     | 1.2 s ✅   | **0.9 s** ✅| 3.5 s ✅  | **2.8 s** ✅|
| **Total Blocking Time (TBT)** | **480 ms ⚠️** | **64 ms ✅** | **1177 ms ⚠️** | **499 ms ⚠️** |
| Cumulative Layout Shift (CLS) | 0 ✅       | 0 ✅       | 0 ✅       | 0 ✅       |
| Time to First Byte (TTFB)     | 46 ms ✅   | 139 ms ✅  | 49 ms ✅   | 223 ms ✅  |

> Speed Index mobile v2 plus élevé que v1 : les composants `next/dynamic` apparaissent après hydratation, ce qui étale visuellement le rendu — mais TTI et TBT s'améliorent nettement.

### Répartition du travail main thread (mobile v2)

| Catégorie               | v1      | v2      | Delta    |
|-------------------------|---------|---------|----------|
| Script Evaluation       | 2538 ms | 2097 ms | -17%     |
| Other                   | 566 ms  | 566 ms  | =        |
| Style & Layout          | 159 ms  | 147 ms  | -7%      |
| Script Parse/Compile    | 76 ms   | 69 ms   | -9%      |
| Rendering               | 47 ms   | 47 ms   | =        |

Les 4 chunks JS les plus coûteux au démarrage (mobile v2) :

| Chunk                  | CPU total | Évaluation JS |
|------------------------|-----------|---------------|
| `16g.ca89g7fib.js`     | 1037 ms   | 936 ms        |
| `0gg~i0-tgyf-l.js`     | 571 ms    | 341 ms        |
| `0z.~x17s61-v_.js`     | 425 ms    | 420 ms        |
| `00x1122yi.vse.js`     | 336 ms    | 332 ms        |

---

## Points d'attention connus

### Accessibilité
- Boutons "✕" des modales : `aria-label="Fermer"` ajouté ✅
- Bouton déconnexion : `aria-label="Se déconnecter"` ajouté ✅
- `<h1>` unique sur chaque page : ajouté avec classe `sr-only` ✅
- Contraste texte : Tokyo Night — ratio ≥ 4.5:1 vérifié sur les couleurs principales

### SEO
- `<title>` et `<meta description>` définis via Next.js `metadata` ✅
- `<h1>` présent (caché visuellement avec `sr-only`, visible par les moteurs) ✅
- Open Graph image : `/opengraph-image.tsx` ✅

### Performance — analyse du TBT (480ms)
Le seul point rouge est le **Total Blocking Time à 480ms** (seuil vert : < 150ms).

**Cause** : tâches JS longues au démarrage qui bloquent le thread principal —
- Initialisation de **PixiJS v8** (WebGL, shaders, textures)
- Hydratation **Next.js** (React tree, stores Zustand)
- Connexion **Socket.io** + réception du buffer canvas (4MB)

C'est structurellement inhérent à une app canvas temps réel. Les métriques utilisateur réels (FCP 0.3s, LCP 0.5s, TTI 1.2s) montrent que la page est **utilisable en 1.2 secondes** malgré ce TBT élevé.

**Argument jury** : le TBT mesure le blocage du thread principal, pas le temps perçu. Notre FCP/LCP/TTI sont tous dans le vert — l'expérience utilisateur est fluide.

### Bonnes pratiques
- HTTPS activé (Tailscale + certificat auto-signé)
- CSP headers : configurables via Next.js `headers()` dans `next.config.ts`
- Pas de `console.error` en production

---

## Points à améliorer avant présentation jury

- [x] Scores remplis — audit réalisé le 2026-06-15
- [x] Audit mobile v2 réalisé le 2026-06-15 — TBT 1177ms → 499ms (-58%)
- [x] `next/dynamic` avec `ssr: false` sur CanvasEngine — TBT desktop 480ms → 64ms (-87%)
