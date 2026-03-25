# RNCP Preparation - DevOps & Testing - Introduction

**URL :** https://intranet.hbtn.io/projects/3238
**Catégorie :** Technique — DevOps
**Type d'évaluation :** Quiz + Manual Review

---

## Contexte

Pas besoin de maîtriser le DevOps avancé, mais connaître les **bases** et appliquer un minimum (Docker, GitFlow, quelques automatisations) est attendu.

---

## Concepts clés à maîtriser

- **Virtualisation** — émulation du matériel
- **Conteneurisation** — partage du système d'exploitation hôte
- Différence entre virtualisation et conteneurisation
- **CI/CD** — Intégration et Déploiement Continus
- **Git** — gestion de versions
- **GitFlow** — workflow de branches Git
- **Docker** — outil de conteneurisation
- **TDD** — Test Driven Development
- Tests unitaires
- Tests d'intégration

---

## Virtualisation vs Conteneurisation

| | Virtualisation (VM) | Conteneurisation (Docker) |
|---|---------------------|--------------------------|
| Émule | Le matériel complet | Partage l'OS hôte |
| Poids | Lourd (Go) | Léger (Mo) |
| Démarrage | Lent (minutes) | Rapide (secondes) |
| Isolation | Complète | Partielle |
| Cas d'usage | Environnements isolés | Déploiement d'applications |

---

## GitFlow — Branches principales

| Branche | Rôle |
|---------|------|
| `main/master` | Production stable |
| `develop` | Développement en cours |
| `feature/*` | Nouvelles fonctionnalités |
| `release/*` | Préparation d'une version |
| `hotfix/*` | Corrections urgentes en prod |

---

## CI/CD

- **CI (Continuous Integration)** : intégrer régulièrement le code, lancer les tests automatiquement
- **CD (Continuous Deployment)** : déployer automatiquement après validation

---

## Tests

### Tests unitaires
- Tester une **unité isolée** du code (une fonction, une méthode)
- Effectués **en premier**

### Tests d'intégration
- Tester l'**interaction entre plusieurs composants**
- Effectués **après** les tests unitaires

### TDD (Test Driven Development)
- Écrire les tests **avant** le code fonctionnel
- Cycle : Red → Green → Refactor

---

## Ordre typique des tests

1. Tests unitaires (composants individuels)
2. Tests d'intégration (interactions entre composants)
3. Tests fonctionnels (fonctionnalités complètes)

---

## Ressources

- Conteneurisation — cas d'utilisation et avantages
- Virtualisation vs Conteneurisation en 6 minutes
- Docker expliqué en 8 minutes
- Comprendre Git Flow
- CI/CD en 8 minutes
- Comment faire des tests unitaires
- TDD — Développement piloté par les tests
- Tests d'intégration

---

## Projets Holberton à revoir

- Docker
- Git

---

## Quiz — Réponses clés

| Question | Réponse |
|----------|---------|
| Virtualisation | Créer des versions virtuelles de ressources physiques |
| Virtualisation vs Conteneurisation | VM émule le matériel, conteneur partage l'OS hôte |
| CI/CD | Pratiques pour intégrer et déployer continuellement du code |
| Branche features (GitFlow) | `feature` |
| TDD | Tests écrits **avant** le code fonctionnel |
| Branche release (GitFlow) | `release` |
| Test unitaire | Vérifie une unité isolée du code |
| Test d'intégration | Vérifie les interactions entre composants |
| Docker et déploiement | Encapsule l'app avec ses dépendances → exécution cohérente partout |

---

## Notes pour Claude Code

> Utiliser Docker pour conteneuriser l'application → facilite le déploiement.
> Mettre en place GitFlow dès le début du projet.
> Documenter dans le rapport : comment vous avez testé l'application (Postman, tests unitaires, etc.).
> Préparer des captures d'écran des tests pour les annexes.
