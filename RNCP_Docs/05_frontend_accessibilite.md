# RNCP Preparation - Frontend - Accessibilité

**URL :** https://intranet.hbtn.io/projects/3222
**Catégorie :** Technique — Frontend
**Type d'évaluation :** Quiz + Manual Review

---

## Concepts clés à maîtriser

- **W3C** — World Wide Web Consortium (organisme de normalisation du web)
- **Accessibilité web** — rendre le web utilisable par tous, y compris les personnes handicapées
- **RGAA** — Référentiel Général d'Amélioration de l'Accessibilité (standard français)
- **WCAG** — Web Content Accessibility Guidelines (standard international)
- **WAI** — Web Accessibility Initiative
- **ARIA** — Accessible Rich Internet Applications

---

## Objectifs

- Comprendre ce qu'est l'accessibilité web et pour qui la faire
- Connaître les bases des règles et standards d'accessibilité
- Savoir intégrer quelques notions d'accessibilité dans un site
- Avoir une idée générale sur W3C, RGAA, WCAG, WAI, ARIA

---

## Règles d'accessibilité essentielles

### HTML
- Toujours utiliser l'attribut `alt` sur les images
- Associer chaque champ de formulaire à une balise `<label>`
- Utiliser `<button>` plutôt que `<div>` cliquable
- Structure sémantique correcte (h1 → h6, nav, main, footer...)

### CSS
- Utiliser des unités relatives (`em`, `rem`) pour les tailles de police
- Assurer un contraste suffisant texte/fond :
  - Minimum **4.5:1** pour le texte normal
  - Minimum **3:1** pour le texte agrandi (selon WCAG)
- Tous les éléments interactifs doivent être accessibles au clavier (Tab)

### Vidéos
- Fournir des sous-titres et une transcription

---

## Standards et référentiels

| Sigle | Signification | Rôle |
|-------|---------------|------|
| W3C | World Wide Web Consortium | Organisme qui définit les standards web |
| WAI | Web Accessibility Initiative | Initiative du W3C sur l'accessibilité |
| WCAG | Web Content Accessibility Guidelines | Guide international d'accessibilité |
| RGAA | Référentiel Général d'Amélioration de l'Accessibilité | Standard français |
| ARIA | Accessible Rich Internet Applications | Améliore l'accessibilité des apps dynamiques |

---

## Outils

- **Contrast Finder** — vérifier le contraste entre couleurs
- **Accessibility Checker** — validateur en ligne

---

## Ressources

- W3C (site officiel)
- Accessibilité du web (Wikipedia)
- WAI - Web Accessibility Initiative
- WCAG
- RGAA — critères et tests par thématique
- Tutoriel HTML/CSS — accessibilité web
- En 20 minutes les bases de l'accessibilité
- Learn Accessibility - Full a11y Tutorial (1h30)

---

## Quiz — Réponses clés

| Question | Réponse |
|----------|---------|
| Accessibilité web | Consultable par le plus grand nombre, y compris handicapés |
| WCAG | Web Content Accessibility Guidelines |
| RGAA | Référentiel Général d'Amélioration de l'Accessibilité |
| WAI | Web Accessibility Initiative |
| ARIA | Améliore l'accessibilité des applications web dynamiques |
| Contraste couleurs | 4.5:1 texte normal, 3:1 texte agrandi (WCAG) |
| Attribut image | `alt` |
| CSS responsive | Utiliser `em` ou `rem` |
| Formulaire accessible | Balise `<label>` associée à chaque champ |
| Vidéo accessible | Sous-titres + transcription |
| Navigation clavier | Touche Tab sur tous les éléments interactifs |
| Bouton accessible | `<button>` (pas `<div>` avec onclick) |

---

## Notes pour Claude Code

> Intégrer dans le projet : attributs `alt`, labels de formulaire, balises sémantiques.
> Vérifier le contraste des couleurs avec Contrast Finder avant de finaliser le design.
> Mentionner dans le rapport les mesures d'accessibilité mises en place.
> RGAA et WCAG sont les références officielles à citer.
