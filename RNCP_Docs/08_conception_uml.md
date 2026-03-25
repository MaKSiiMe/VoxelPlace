# RNCP Preparation - Conception - Diagrammes UML

**URL :** https://intranet.hbtn.io/projects/3237
**Catégorie :** Technique — Conception
**Type d'évaluation :** Quiz + Manual Review

---

## ⚠️ Importance

Penser à la **conception avant le code** est primordial — surtout pour le RNCP 6 (CDA).
Les jurés préfèrent avoir le **maximum de diagrammes** dans les slides de présentation.
Faire le plus de diagrammes possible pour une vue **high-level** du projet.

---

## Types de diagrammes UML

### Diagrammes structurels (statiques)
| Diagramme | Rôle |
|-----------|------|
| **Diagramme de classe** | Structure statique : classes, attributs, relations |
| **Diagramme de paquetage** | Organisation des modules/packages |
| **ERD / Diagramme EA** | Entités et relations (équivalent MLD en Merise) |
| **Diagramme de déploiement** | Architecture physique et logicielle |

### Diagrammes comportementaux (dynamiques)
| Diagramme | Rôle |
|-----------|------|
| **Diagramme de cas d'utilisation** | Actions des utilisateurs sur le système |
| **Diagramme de séquence** | Interactions chronologiques entre objets |
| **Diagramme d'activité** | Flux de processus |

---

## Objectifs minimum

- Savoir expliquer l'UML et justifier les décisions de schématisation
- **Diagramme de classe** — si POO dans le projet (à faire avant le code)
- **Diagramme de cas d'utilisation** — définir les actions des utilisateurs
- **Diagramme de séquence** — interactions chronologiques
- **ERD** — conception de la BDD (équivalent MLD Merise)
- **Diagramme de déploiement** — architecture de déploiement

---

## Relations dans le diagramme de classe

### Agrégation (losange vide ◇)
- Relation faible "a une"
- La partie **peut exister** sans le tout
- Exemple : Équipe ◇─ Joueurs (les joueurs existent sans l'équipe)

### Composition (losange plein ◆)
- Relation forte
- La partie **ne peut pas exister** sans le tout
- Exemple : Maison ◆─ Pièces (les pièces n'existent pas sans la maison)

### Extension `<<extend>>`
- Cas d'utilisation **optionnel** qui étend un comportement standard

---

## Outils recommandés

- **DBdiagram.io** — ERD
- **Miro** — tous diagrammes (collaboratif)
- **Lucidchart** — tous diagrammes
- **Draw.io** — gratuit, tous diagrammes
- **MermaidJS** — diagrammes en code (intégrable dans Markdown/Git)
- **Visual Paradigm** — UML complet

---

## Ressources

- UML (Wikipedia)
- Vidéo Live session — Diagramme de cas d'utilisation et de classe
- Présentation UML
- Diagramme de classe en 12 minutes
- UML — Diagramme de séquence
- UML — Diagramme de paquetage
- UML — Diagramme EA
- UML — Diagramme de cas d'utilisation
- UML — Diagramme de déploiement (cours + exercice 20 min)

---

## Projets Holberton à revoir

- HBnB — UML

---

## Quiz — Réponses clés

| Question | Réponse |
|----------|---------|
| Cardinalité minimale dans ERD | Nombre minimal de fois qu'une instance participe à une relation |
| `<<extend>>` | Cas d'utilisation optionnel qui étend le comportement standard |
| But principal de l'UML | Langage visuel pour modéliser et documenter des systèmes |
| Agrégation | Relation faible, losange vide, la partie peut exister sans le tout |
| Composition | Relation forte, losange plein, la partie ne peut pas exister sans le tout |
| Diagramme de classe | Structure statique — classes, attributs, relations |
| Diagramme de cas d'utilisation | Exigences fonctionnelles — acteurs et interactions |
| Diagramme de séquence | Interactions dynamiques chronologiques entre objets |
| Diagramme structurel vs comportemental | Structurel = organisation statique ; Comportemental = dynamique |

---

## Notes pour Claude Code

> Créer les diagrammes AVANT de coder.
> Minimum pour le RNCP 6 : diagramme de classe, cas d'utilisation, séquence, ERD, déploiement.
> Intégrer les diagrammes dans les slides de présentation.
> Utiliser MermaidJS pour inclure des diagrammes directement dans le README du projet.
