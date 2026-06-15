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



| Catégorie        | Score | Statut |
|------------------|-------|--------|
| Performance      | 79    | ✅     |
| Accessibilité    | 95    | ✅     |
| Bonnes pratiques | 100   | ✅     |
| SEO              | 100   | ✅     |

> Mesuré en navigation privée (mode incognito) — référence officielle.
> Sans incognito : Performance 60 (extensions Chrome qui polluent la mesure).

### Mobile

| Catégorie        | Score | Statut |
|------------------|-------|--------|
| Performance      | ~55   | ⚠️     |
| Accessibilité    | 95    | ✅     |
| Bonnes pratiques | 100   | ✅     |
| SEO              | 100   | ✅     |

> Le mode Mobile simule un CPU lent (Moto G4, throttling ×4) — la pénalité sur le TBT est amplifiée par rapport au desktop.

## Métriques détaillées

| Métrique                      | Desktop | Mobile  |
|-------------------------------|---------|---------|
| First Contentful Paint (FCP)  | 0.3 s ✅ | 0.8 s ✅ |
| Largest Contentful Paint (LCP)| 0.5 s ✅ | 2.0 s ✅ |
| Speed Index                   | 0.7 s ✅ | 1.5 s ✅ |
| Time to Interactive (TTI)     | 1.2 s ✅ | 3.5 s ✅ |
| **Total Blocking Time (TBT)** | **480 ms ⚠️** | **1177 ms ⚠️** |
| Cumulative Layout Shift (CLS) | 0 ✅    | 0 ✅    |
| Time to First Byte (TTFB)     | 46 ms ✅ | 49 ms ✅ |

### Répartition du travail main thread (mobile)

| Catégorie               | Temps   |
|-------------------------|---------|
| Script Evaluation       | 2538 ms |
| Other                   | 566 ms  |
| Style & Layout          | 159 ms  |
| Script Parse/Compile    | 76 ms   |
| Rendering               | 47 ms   |

Les 4 chunks JS les plus coûteux au démarrage :

| Chunk                  | CPU total | Évaluation JS |
|------------------------|-----------|---------------|
| `16g.ca89g7fib.js`     | 910 ms    | 854 ms        |
| `00x1122yi.vse.js`     | 845 ms    | 842 ms        |
| `0gg~i0-tgyf-l.js`     | 583 ms    | 363 ms        |
| `0z.~x17s61-v_.js`     | 416 ms    | 410 ms        |

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
- [ ] Relancer l'audit mobile pour compléter les scores mobiles
- [ ] Optionnel : `next/dynamic` avec `ssr: false` sur CanvasEngine pour réduire le TBT
