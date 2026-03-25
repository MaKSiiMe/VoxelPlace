# RNCP 6 - CDA — Récapitulatif global de préparation

> **École :** Holberton Toulouse
> **Titre visé :** RNCP 6 — Concepteur Développeur d'Application (CDA)
> **Deadline finale :** 30 Juillet
> **Source :** Intranet Holberton — https://intranet.hbtn.io/projects/current

---

## Index des fichiers de documentation

| # | Fichier | Sujet | Statut |
|---|---------|-------|--------|
| 01 | `01_simulation_entretien_final.md` | Mock Interview — Entretien final (non-technique, 20 min) | 0% |
| 02 | `02_backend_bdd.md` | BDD — SQL, NoSQL, Merise, ERD, ACID | 0% |
| 03 | `03_backend_securite_infrastructure.md` | Sécurité — XSS, CSRF, SQL Injection, Hachage, MVC | 0% |
| 04 | `04_devops_testing.md` | DevOps — Docker, GitFlow, CI/CD, Tests unitaires | 0% |
| 05 | `05_frontend_accessibilite.md` | Accessibilité — WCAG, RGAA, WAI, ARIA | 0% |
| 06 | `06_frontend_tests_devtools.md` | Tests Frontend — Chrome DevTools, Lighthouse | 0% |
| 07 | `07_frontend_rgpd.md` | RGPD — CNIL, Protection des données | 0% |
| 08 | `08_conception_uml.md` | UML — Diagrammes de classe, séquence, cas d'utilisation, déploiement | 0% |
| 09 | `09_questionnaire_professionnel.md` | Épreuve écrite — Format, ressources, vocabulaire technique | 0% |
| 10 | `10_gestion_projet_methodologies.md` | Gestion de projet — Agile, Scrum, Waterfall | 0% |
| 11 | `11_frontend_maquettage_css.md` | Maquettage — Wireframe, Mockup, Responsive, Flexbox, Grid | 0% |
| 12 | `12_frontend_seo.md` | SEO — Balises HTML, SERP, bonnes pratiques | 0% |
| 13 | `13_presentation_attendus.md` | Vue d'ensemble — 4 épreuves, rendus, deadlines | ✅ 100% |
| 14 | `14_redaction_rapport.md` | Rapport — Méthodologie, plan REV2, volume, deadlines | 0% |
| 15 | `15_dossier_professionnel.md` | Dossier Professionnel — Template, activités titre, deadline | 0% |
| 16 | `16_support_presentation_orale.md` | Support de présentation — Slides, conseils oraux, deadline | 0% |

---

## Les 4 épreuves du RNCP

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Questionnaire professionnel (écrit)    ← 30 min             │
│  2. Présentation du projet                 ← 35-40 min          │
│  3. Entretien technique                    ← 40-45 min          │
│  4. Entretien final (non-technique)        ← 15-20 min          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Rendus et deadlines

| Rendu | Deadline |
|-------|---------|
| Dossier projet → Manual Review (staff) | **S-2** |
| Dossier Professionnel (DP) | **S-2** |
| Support de présentation → staff | **S-1** |
| Dossier projet définitif → équipe campus (jury) | **J-7** |
| Support de présentation définitif | **J-1** |
| Livret d'évaluation signé | **J-1** |

---

## Checklist technique — À intégrer dans le projet

### Base de données
- [ ] Méthode Merise : MCD → MLD → MPD
- [ ] ERD (Entity-Relationship Diagram) avant le code
- [ ] BDD SQL préconisée (MySQL, PostgreSQL...)
- [ ] Requêtes préparées (anti-injection SQL)
- [ ] BDD hébergée (ou démarche documentée)

### Sécurité
- [ ] Hachage des mots de passe (bcrypt)
- [ ] Protection CSRF (tokens)
- [ ] Protection XSS (échappement des entrées)
- [ ] HTTPS
- [ ] Pas de secrets dans le dépôt Git (.env dans .gitignore)
- [ ] Principe de moindre privilège (PoLP)

### DevOps
- [ ] Docker (conteneurisation)
- [ ] GitFlow (branches feature/develop/main)
- [ ] CI/CD (au moins pipeline basique)
- [ ] Tests unitaires documentés
- [ ] Captures d'écran des tests pour le rapport

### Frontend
- [ ] Wireframes réalisés avant le développement
- [ ] Design responsive (media queries)
- [ ] Attributs `alt` sur toutes les images
- [ ] Labels sur tous les champs de formulaire
- [ ] Contraste couleurs ≥ 4.5:1 (WCAG)
- [ ] Balises SEO : `<title>`, `<meta description>`, `<h1>` unique
- [ ] Bandeau cookies + politique de confidentialité (RGPD)
- [ ] Audit Lighthouse ≥ 90

### Conception UML
- [ ] Diagramme de classe
- [ ] Diagramme de cas d'utilisation
- [ ] Diagramme de séquence
- [ ] Diagramme de déploiement
- [ ] ERD / MLD

---

## Checklist rapport (RNCP 6 — 40 à 60 pages)

- [ ] Plan du REV2 CDA respecté
- [ ] Page de garde
- [ ] Sommaire
- [ ] En-tête et pied de page
- [ ] Introduction (contexte du projet)
- [ ] Méthodologie de gestion de projet (Scrum, Waterfall...)
- [ ] Conception (diagrammes UML, Merise)
- [ ] Développement (choix techniques justifiés)
- [ ] Sécurité (mesures mises en place)
- [ ] Tests (jeu de tests, résultats)
- [ ] Déploiement (ou démarche)
- [ ] RGPD (mesures mises en place)
- [ ] Conclusion (apports pro + perso + ouverture)
- [ ] Annexes (captures tests, diagrammes supplémentaires)

---

## Checklist dossier professionnel

- [ ] Template officiel CDA utilisé
- [ ] Au moins 1 exemple par activité titre (voir REAC CDA)
- [ ] Déclaration sur l'honneur complétée
- [ ] GitHub public et projets accessibles
- [ ] Envoyé en PDF à l'équipe campus avant S-2

---

## Checklist support de présentation

- [ ] Plan du REV2 CDA respecté
- [ ] 1 à 2 minutes par slide
- [ ] Diagrammes intégrés
- [ ] Slides d'annexe préparées pour les Q&A
- [ ] Envoyé au staff avant S-1

---

## Concepts clés à réviser pour l'entretien technique

### Base de données
- Différence SQL / NoSQL / SGBD
- Jointures SQL (INNER, LEFT, RIGHT, FULL)
- Méthode Merise : MCD, MLD, MPD
- Propriétés ACID
- Injections SQL et protection
- Scalabilité horizontale vs verticale

### Sécurité
- CSRF, XSS, SQL Injection
- Hachage vs Chiffrement
- HTTPS / SSL / TLS
- OWASP
- RGPD / CNIL

### Architecture
- Monolithe vs Microservices
- MVC (Modèle-Vue-Contrôleur)
- Architecture en couches

### DevOps
- Virtualisation vs Conteneurisation
- Docker (images, containers, volumes)
- GitFlow (branches)
- CI/CD
- Tests unitaires vs Tests d'intégration
- TDD

### Frontend
- Flexbox vs Grid CSS
- Media queries et breakpoints
- Accessibilité : WCAG, RGAA, ARIA
- SEO : balises essentielles, SERP
- Chrome DevTools : onglets et utilisation

### Gestion de projet
- Agile vs Non-agile (Waterfall, Cycle en V)
- Scrum : rôles (PO, SM, Dev), sprint, cérémonies
- Product Backlog

---

## Questions d'entretien final à préparer (non-technique)

- Vision du métier de Concepteur Développeur d'Application
- Différences développeur web / CDA
- Comment vous avez géré la collaboration dans vos projets
- Technologies choisies et pourquoi
- Veille technologique — comment la pratiquez-vous
- Expérience de gestion de projet
- Gestion des imprévus dans un projet
- Comment vous assurez la qualité de votre code

---

## Outils recommandés pour le projet

| Catégorie | Outils |
|-----------|--------|
| Conception BDD | DBdiagram.io, Draw.io |
| Diagrammes UML | Draw.io, Miro, Lucidchart, MermaidJS |
| Maquettage | Figma, Miro |
| Conteneurisation | Docker |
| Versioning | Git + GitFlow |
| Tests | Postman, pytest, Jest |
| CI/CD | GitHub Actions |
| Hébergement | DigitalOcean, AWS, Heroku |

---

## Ressources officielles clés

- REV2 CDA V04 — Plan du rapport + critères d'évaluation
- REAC CDA V04 — Compétences du titre + glossaire
- Guide de l'entretien technique
- Guide de l'entretien final
- Grille de l'entretien final
- Guide RGPD du développeur (CNIL)
