# RNCP Preparation - Frontend - Tester la partie frontend

**URL :** https://intranet.hbtn.io/projects/3224
**Catégorie :** Technique — Frontend
**Type d'évaluation :** Quiz + Manual Review

---

## Concepts clés à maîtriser

- **Chrome DevTools** — outil intégré au navigateur pour inspecter, déboguer et tester

---

## Objectifs

Être capable de montrer et d'expliquer aux jurés comment tester la partie frontend :
- Qu'est-ce que le DevTools ?
- Que peut-on faire avec ?
- Comment déboguer CSS et HTML ?
- Comment tester les designs responsives ?
- Comment faire un audit avec le DevTools ?

---

## Fonctionnalités du Chrome DevTools

### Onglet Elements
- Inspecter et modifier le HTML/CSS en direct
- Déboguer la mise en page

### Onglet Toggle Device Toolbar (Responsive)
- Simuler différentes tailles d'écran
- Tester le design responsive sur mobile/tablette

### Onglet Network (Réseau)
- Analyser les requêtes HTTP
- Mesurer les temps de chargement des ressources

### Onglet Lighthouse (Audit)
- Générer un rapport d'audit complet
- Analyse : performance, accessibilité, SEO, bonnes pratiques

### Onglet Performance & Memory
- Analyser les performances de rendu
- Identifier les fuites mémoire

### Onglet Application
- Inspecter les cookies, localStorage, Service Workers

### Onglet Security
- Vérifier les connexions HTTPS et les certificats

---

## Ce qui est attendu pour le RNCP

- Montrer dans le rapport ou la présentation comment tester le frontend
- Savoir utiliser le DevTools pour déboguer et tester
- Si pas le temps en présentation → garder en **annexe** pour anticiper les questions QnA

---

## Ressources

- Chrome DevTools : Vue d'ensemble (tous les onglets)
- Chrome DevTools : Elements / Responsive
- Chrome DevTools : Performance et Mémoire
- Chrome DevTools : Audit, Security, Application
- Chrome DevTools Crash Course — CSS Development

---

## Quiz — Réponses clés

| Question | Réponse |
|----------|---------|
| Déboguer CSS | Onglet "Elements" — modifier styles en direct |
| Tester design responsive | Mode "Barre d'outils des appareils" (Toggle device toolbar) |
| Audit de performance | Onglet "Lighthouse" |
| Onglet Réseau | Analyser requêtes et temps de chargement |
| Tester accessibilité | Outil "Audit" / Lighthouse |

---

## Notes pour Claude Code

> Faire un audit Lighthouse du projet et viser 90+ en performance, accessibilité, SEO.
> Inclure des captures d'écran des tests DevTools dans le rapport ou les annexes.
> Tester le responsive sur les breakpoints : mobile (< 768px), tablette (768-992px), desktop (> 992px).
