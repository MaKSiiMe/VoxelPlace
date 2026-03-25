# RNCP Preparation - Frontend - RGPD

**URL :** https://intranet.hbtn.io/projects/3225
**Catégorie :** Technique — Frontend / Légal
**Type d'évaluation :** Quiz + Manual Review

---

## ⚠️ Importance

Le RGPD est un point **très important** à connaître.
Il est **fortement recommandé** de l'intégrer dans le projet RNCP.
À minima : savoir ce qu'est le RGPD, son utilité et comment l'intégrer dans une application.

---

## Concepts clés

- **RGPD** — Règlement Général sur la Protection des Données
- **CNIL** — Commission Nationale de l'Informatique et des Libertés
- **GDPR** — General Data Protection Regulation (équivalent anglais du RGPD)

---

## Définitions essentielles

### RGPD
- Règlement **européen** sur la protection des données personnelles
- S'applique à **toute entreprise traitant des données de résidents UE**, quel que soit son emplacement
- Entrée en vigueur : 25 mai 2018

### CNIL
- Autorité française de contrôle du RGPD
- Mission : **protéger les données personnelles et la vie privée** des individus

### Donnée personnelle
- Toute information se rapportant à une **personne physique identifiée ou identifiable**
- Exemples : nom, email, adresse IP, localisation, identifiants en ligne

---

## Droits des personnes (RGPD)

- **Droit d'accès** — accéder à ses données
- **Droit de rectification** — corriger ses données
- **Droit à l'oubli** — faire effacer ses données
- **Droit à la portabilité** — récupérer ses données dans un format lisible
- **Droit d'opposition** — s'opposer au traitement de ses données

---

## Bonnes pratiques développeur

- **Minimiser** la collecte de données au strict nécessaire
- **Hasher** les mots de passe (ne jamais les stocker en clair)
- **Chiffrer** les données sensibles
- Informer les utilisateurs via une **politique de confidentialité**
- Mettre en place un **bandeau cookies** (consentement)
- Respecter le **droit à l'oubli** (possibilité de suppression du compte)
- Sécuriser les données (HTTPS, accès restreints)

---

## Ressources

- CNIL (site officiel : cnil.fr)
- RGPD (règlement officiel)
- 2 MIN POUR COMPRENDRE LE RGPD
- RGPD / GDPR : FAQ avec la CNIL
- Guide RGPD du développeur par la CNIL
- Mots de passe : recommandations de sécurité (CNIL)

---

## Quiz — Réponses clés

| Question | Réponse |
|----------|---------|
| RGPD | Règlement européen sur la protection des données personnelles |
| Mission CNIL | Protéger les données personnelles et la vie privée |
| Donnée personnelle | Toute info liée à une personne identifiée ou identifiable |
| Droit à l'oubli | Droit de faire effacer ses données personnelles |
| RGPD s'applique-t-il seulement à l'UE ? | Non — toute entreprise traitant des données de résidents UE |
| Minimisation des données | ✅ Oui — collecter uniquement le strict nécessaire |
| CNIL signifie | Commission Nationale de l'Informatique et des Libertés |
| RGPD signifie | Règlement Général sur la Protection des Données |
| Équivalent anglais RGPD | GDPR — General Data Protection Regulation |

---

## Notes pour Claude Code

> Intégrer dans le projet : bandeau cookies, politique de confidentialité, formulaire de suppression de compte.
> Hasher les mots de passe avec bcrypt.
> Documenter dans le rapport les mesures RGPD mises en place.
> Citer la CNIL comme référence officielle.
