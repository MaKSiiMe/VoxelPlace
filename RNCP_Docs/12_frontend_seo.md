# RNCP Preparation - Frontend - Référencement (SEO)

**URL :** https://intranet.hbtn.io/projects/3221
**Catégorie :** Technique — Frontend
**Type d'évaluation :** Quiz + Manual Review

---

## Concepts clés à maîtriser

- **SEO** — Search Engine Optimization (Référencement Naturel)
- **SERP** — Search Engine Result Page (Page de résultats des moteurs de recherche)
- Balises HTML essentielles pour le SEO
- Bonnes pratiques d'optimisation

---

## Définitions

### SEO (Search Engine Optimization)
- Ensemble de techniques pour **améliorer le classement** d'un site dans les résultats des moteurs de recherche
- Objectif : apparaître en haut de la SERP sans payer (référencement **naturel** vs payant)

### SERP
- Page de résultats affichée par un moteur de recherche après une requête

---

## Balises HTML essentielles pour le SEO

```html
<!-- Titre de la page — ESSENTIEL -->
<title>Mon Application | Description courte</title>

<!-- Meta description — résumé affiché dans la SERP -->
<meta name="description" content="Description de la page pour les moteurs de recherche">

<!-- Balises de structure — hiérarchie de contenu -->
<h1>Titre principal (1 seul par page)</h1>
<h2>Sous-titre</h2>

<!-- Images — toujours avec alt -->
<img src="image.jpg" alt="Description précise de l'image">

<!-- Liens — texte d'ancrage descriptif -->
<a href="/page">Texte descriptif du lien</a>
```

---

## Bonnes pratiques SEO

### URLs
- Utiliser des **mots-clés pertinents** dans les URLs
- URLs courtes et lisibles : `/blog/mon-article` plutôt que `/page?id=123`

### Contenu
- Une seule balise `<h1>` par page
- Hiérarchie logique des titres (h1 → h2 → h3)
- Contenu de qualité et pertinent

### Performance
- Vitesse de chargement rapide (impact sur le classement)
- Images optimisées

### Liens
- Liens internes entre les pages du site
- Texte d'ancrage descriptif (pas "cliquez ici")

### Balises `<strong>` et `<em>`
- Permettent de mettre en évidence du texte important pour les moteurs de recherche

---

## Ressources

- Le Référencement : les bases pour débutants
- Qu'est-ce que le référencement naturel (SEO) ?
- Astuces SEO — le code indispensable
- 9 Balises SEO HTML incontournables
- Définition d'une SERP

---

## Quiz — Réponses clés

| Question | Réponse |
|----------|---------|
| SEO | L'optimisation des moteurs de recherche |
| Pourquoi le SEO | Améliorer le classement dans les résultats des moteurs de recherche |
| Balise HTML essentielle | `<title>` |
| Attribut SEO image | `alt` |
| Rôle `<h1>` à `<h6>` | Structurer le contenu et indiquer les titres importants |
| SERP | Search Engine Result Page |
| URLs et SEO | Oui — utiliser des mots-clés pertinents |
| `<meta name="description">` | Résumé de la page pour les moteurs de recherche et utilisateurs |
| `<title>` | Aide les moteurs à comprendre le sujet principal de la page |
| `<strong>` et `<em>` | Mettre en évidence du texte important pour les moteurs |
| SEO signifie | Search Engine Optimization |

---

## Notes pour Claude Code

> Intégrer dans chaque page : `<title>` unique, `<meta description>`, balises `<h1>` à `<h3>`.
> Toujours renseigner l'attribut `alt` sur les images.
> Optimiser les URLs (mots-clés, tirets, pas de majuscules).
> Mentionner les mesures SEO dans le rapport.
> Tester le SEO avec l'onglet Lighthouse de Chrome DevTools.
