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

## Scores — Desktop

| Catégorie        | Score | Objectif jury |
|------------------|-------|---------------|
| Performance      | —     | ≥ 70          |
| Accessibilité    | —     | ≥ 85          |
| Bonnes pratiques | —     | ≥ 90          |
| SEO              | —     | ≥ 90          |

## Scores — Mobile

| Catégorie        | Score | Objectif jury |
|------------------|-------|---------------|
| Performance      | —     | ≥ 50          |
| Accessibilité    | —     | ≥ 85          |
| Bonnes pratiques | —     | ≥ 90          |
| SEO              | —     | ≥ 90          |

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

### Performance
- First paint rapide grâce à Next.js SSR + export statique partiel
- Canvas PixiJS chargé côté client uniquement (`'use client'`)
- Redis O(1) pour les lectures de pixels → temps de réponse API < 10ms

### Bonnes pratiques
- HTTPS activé (Tailscale + certificat auto-signé)
- CSP headers : configurables via Next.js `headers()` dans `next.config.ts`
- Pas de `console.error` en production

---

## Points à améliorer avant présentation jury

- [ ] Remplir les scores après avoir lancé l'audit sur le serveur de prod
- [ ] Ajouter `viewport` meta si Lighthouse le signale (Next.js l'inclut par défaut)
- [ ] Vérifier le score mobile (canvas PixiJS peut pénaliser le TTI)
