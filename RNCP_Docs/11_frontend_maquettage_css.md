# RNCP Preparation - Frontend - Maquettage & Design Responsive & CSS

**URL :** https://intranet.hbtn.io/projects/3217
**Catégorie :** Technique — Frontend
**Type d'évaluation :** Quiz + Manual Review

---

## Concepts clés à maîtriser

- **Maquettage** (Wireframe, Mockup, Prototype)
- **Design responsive**
- **Media queries** CSS
- **Flexbox** et **CSS Grid**
- **Breakpoints** Bootstrap

---

## Les étapes du maquettage

### 1. Wireframe
- Schéma **simple** représentant la structure de la page (sans graphismes)
- Fait en premier, avant tout développement
- Outils : Figma, Miro, Draw.io

### 2. Mockup
- Visualisation de **l'apparence finale** avec les éléments graphiques détaillés
- Pas encore interactif

### 3. Prototype
- Maquette **interactive** simulant le comportement de l'application

---

## Design Responsive

Le design responsive adapte automatiquement la mise en page à **toutes les tailles d'écran**.

### Media Queries
```css
/* Mobile first */
@media (max-width: 768px) {
  /* styles pour mobile */
}

/* Tablette */
@media (min-width: 768px) and (max-width: 991px) {
  /* styles pour tablette */
}
```

### Breakpoints Bootstrap
| Breakpoint | Taille |
|------------|--------|
| xs | < 576px |
| sm | ≥ 576px |
| md | ≥ 768px (tablettes) |
| lg | ≥ 992px |
| xl | ≥ 1200px |

---

## Flexbox vs Grid

| | Flexbox | Grid |
|---|---------|------|
| Dimensions | **1D** (ligne ou colonne) | **2D** (lignes ET colonnes) |
| Usage | Alignement d'éléments | Mise en page complexe |
| Direction | `flex-direction: row/column` | `grid-template-columns` |

### Flexbox — Propriétés clés
```css
.container {
  display: flex;
  flex-direction: row; /* aligne en rangée horizontale */
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}
```

---

## Outils de maquettage

- **Figma** — maquettage professionnel, wireframes, prototypes
- **Miro** — wireframes collaboratifs
- **Draw.io** — gratuit, tous types de schémas
- **Adobe XD**, **Balsamiq**

---

## Ressources

- En 2 minutes — Wireframe, Mockup et Prototype
- Créer des wireframes rapidement sous Figma
- Wireframes pour application mobile — Miro
- UI/UX Design — Wireframe, Mockup & Design in Figma
- Rendre un site responsive en HTML/CSS avec media queries
- Flexbox en CSS
- CSS Grid
- Site web responsive en 22 minutes

---

## Quiz — Réponses clés

| Question | Réponse |
|----------|---------|
| Wireframe | Schéma simple représentant la structure sans contenu graphique |
| Mockup | Visualisation de l'apparence finale avec éléments graphiques |
| Avantage Flexbox | Alignement et répartition d'espace quelle que soit la taille de l'écran |
| Media queries | Modifier le style en fonction de la taille de l'écran selon des breakpoints |
| Breakpoint Bootstrap pour tablettes | `@media (min-width: 768px) and (max-width: 991px)` |
| `flex-direction: row` | Aligne les éléments enfants en rangée horizontale |
| `@media (max-width: 768px)` | Styles si largeur ≤ 768px |
| Design responsive | S'adapte automatiquement à différentes tailles d'écran |
| Flexbox vs Grid | Flexbox = 1D, Grid = 2D |

---

## Notes pour Claude Code

> Faire le wireframe avant de commencer le développement du frontend.
> Intégrer le design responsive avec media queries ou un framework CSS (Bootstrap, Tailwind).
> Tester sur les breakpoints : mobile, tablette, desktop.
> Inclure les wireframes et mockups dans le rapport et les slides.
