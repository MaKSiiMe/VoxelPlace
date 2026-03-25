# RNCP Preparation - Backend - Conception et développement de Base De Données

**URL :** https://intranet.hbtn.io/projects/3232
**Catégorie :** Technique — Backend
**Type d'évaluation :** Quiz + Manual Review

---

## ⚠️ Importance

Ce projet est **un des piliers du RNCP 6 (CDA)**.
Le bloc "Base de données" ne sera **pas validé** sans maîtrise de la méthode MERISE.
Utiliser une **BDD SQL** est fortement préconisé (NoSQL accepté mais implique plus de questions sur SQL).

---

## Concepts clés à maîtriser

- SQL / NoSQL
- SGBD (Système de Gestion de Bases de Données) — différence avec SQL (langage)
- Conception de BDD
- **Méthode MERISE** (MCD → MLD → MPD)
- UML — Entity Relationship Diagram (ERD / Diagramme Entité-Association)
- Propriétés **ACID**
- Scalabilité (horizontale vs verticale)

---

## Objectifs

- Avoir de bonnes bases en SQL/MySQL
- Connaître la différence entre SQL (langage) et MySQL (SGBD)
- Connaître NoSQL (au moins MongoDB)
- Savoir faire un ERD avant de coder
- **Savoir faire MCD, MLD, MPD propres (Merise) — OBLIGATOIRE RNCP 6**
- Maîtriser associations, entités, cardinalités
- Expliquer et justifier ses choix techniques de conception
- Connaître les injections SQL et comment s'en protéger
- Savoir héberger ou décrire comment héberger une BDD
- Comprendre la scalabilité

---

## Questions types des jurés

- Différence entre SQL et NoSQL ?
- Faire des jointures SQL (au tableau blanc !)
- Dessiner un schéma de BDD à partir d'un exemple donné
- Écrire une requête SQL avec des jointures
- Expliquer les injections SQL et comment les prévenir
- Intérêt d'une BDD de backup ?
- Intérêt du monitoring ?
- Qu'est-ce que les propriétés ACID ?

---

## Ressources

- Live Coding (1h) — Méthode MERISE avec exemple complet (**ne pas mettre les ID dans le MCD !**)
- Présentation MERISE
- Modélisation MCD avec Merise
- Playlist complète formation Merise
- Injections SQL avec SQLMap (vidéo 4 min)
- Jointures SQL — 12 questions pratiques
- Propriétés ACID
- Scalabilité horizontale vs verticale
- SQL.SH — exercices SQL

---

## Outils de conception

- **DBdiagram.io** — ERD exportable en code
- **Miro**
- **Lucidchart**
- **Draw.io**

---

## Hébergement BDD

- **MongoDB Atlas** — NoSQL gratuit
- **GoogieHost** — SQL avec panneau de configuration
- **Cloud** : DigitalOcean, AWS, Google Cloud, Azure, Heroku (GitHub Students Pack)

---

## Projets Holberton à revoir

- SQL - Introduction
- SQL - More queries
- NoSQL
- MySQL advanced

---

## Quiz — Réponses clés à retenir

| Question | Réponse |
|----------|---------|
| Différence SQL / MySQL | SQL = langage, MySQL = SGBD |
| Collection MongoDB | Équivalent d'une table SQL |
| Prévention injections SQL | Requêtes préparées + validation/échappement des entrées |
| Différence MCD / MLD | MCD = conceptuel sans contrainte technique ; MLD = adapté au SGBD choisi |
| Scalabilité verticale | Améliorer le hardware du serveur existant |
| Scalabilité horizontale | Ajouter des serveurs supplémentaires |
| Sharding MongoDB | Distribuer les données sur plusieurs serveurs |

---

## Notes pour Claude Code

> Avant de coder la BDD : **toujours faire le MCD → MLD → MPD** (Merise).
> Utiliser DBdiagram.io pour générer le code SQL depuis le schéma.
> Penser à documenter les choix techniques de conception dans le rapport.
> Implémenter les requêtes préparées pour éviter les injections SQL.
