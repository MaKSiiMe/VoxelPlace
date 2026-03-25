# RNCP Preparation - Backend - Sécurité, Infrastructure & Tests

**URL :** https://intranet.hbtn.io/projects/3234
**Catégorie :** Technique — Backend / Sécurité
**Type d'évaluation :** Quiz + Manual Review

---

## Contexte

Connaître les failles de sécurité est **indispensable** pour le RNCP.
Le RNCP 6 demande plus de détails que le RNCP 5.
Ne pas partager de données de configuration sensibles sur GitHub/GitLab.

---

## Concepts clés à maîtriser

- **Application monolithe** (structure naturelle pour un projet perso/prototype)
- Architecture Microservices
- Modèle **MVC**
- **Injections SQL**
- **CSRF** (Cross-Site Request Forgery)
- **XSS** (Cross-Site Scripting)
- Monitoring
- **Hachage (Hashing)** — unidirectionnel, irréversible
- **Chiffrement (Encryption)** — réversible avec une clé
- Backup de BDD
- **HTTPS / SSL / TLS**
- **PoLP** — Principe de moindre privilège (Principle of Least Privilege)
- **OWASP** (référence des vulnérabilités web)

---

## Différence clé : Hachage vs Chiffrement

| | Hachage | Chiffrement |
|---|---------|-------------|
| Réversible ? | ❌ Non | ✅ Oui (avec clé) |
| Usage typique | Mots de passe | Données à transmettre |
| Exemple | bcrypt, SHA-256 | AES, RSA |

---

## Objectifs

- Mettre en place (ou savoir comment mettre en place) des mesures de sécurité
- Savoir définir et expliquer les failles
- Maîtriser hashing, encryption, SQL injection au minimum
- Comprendre les architectures (monolithe, microservices, MVC)

---

## Architecture — Monolithe vs Microservices

| | Monolithe | Microservices |
|---|-----------|---------------|
| Déploiement | Un seul bloc | Services indépendants |
| Pour projet RNCP | ✅ Naturel | Complexe |
| Scalabilité | Limitée | Meilleure |

---

## Failles de sécurité essentielles

### Injection SQL
- Exploitation de requêtes SQL mal construites
- **Protection** : requêtes préparées, ORM, validation des entrées

### CSRF
- Forcer un utilisateur authentifié à exécuter des actions involontaires
- **Protection** : jetons CSRF (tokens)

### XSS
- Injection de scripts malveillants dans des pages web
- **Protection** : valider et échapper toutes les entrées utilisateur

---

## Ressources

### Infrastructure & Architecture
- Architecture en couches
- MVC — wiki
- Application monolithe
- Comprendre les microservices en 6 minutes

### Sécurité
- Présentation : Le Hachage
- Présentation : Le Chiffrement
- PoLP — Principe de moindre privilège
- 50 min — 6 vidéos — Injections SQL, CSRF, XSS
- SSL et HTTPS
- OWASP
- mysqldump — Sauvegarde BDD

---

## Tests (pour RNCP 5 principalement)

- Préparer un jeu de tests (Postman, tests unitaires)
- Prendre des captures d'écran des tests pour le rapport
- Organiser et planifier les scénarios de tests

### Ressources Tests
- Comment faire des tests unitaires
- Tests d'intégration
- Tester son API avec Postman

---

## Quiz — Réponses clés

| Question | Réponse |
|----------|---------|
| Prévention injections SQL | Requêtes préparées |
| Protection CSRF | Jetons CSRF |
| Protection XSS | Valider et échapper les entrées |
| Backup BDD | Récupération des données en cas de panne/attaque |
| Monitoring | Détecter rapidement anomalies et pannes |
| Pare-feu | Filtrer connexions entrantes/sortantes |
| Hachage vs Chiffrement | Hachage irréversible, chiffrement réversible avec clé |
| Monolithe vs Microservices | Monolithe = 1 bloc, Microservices = services indépendants |
| MVC | Modèle (données) + Vue (UI) + Contrôleur (logique) |

---

## Notes pour Claude Code

> Ne jamais committer de fichiers `.env` ou de secrets sur Git.
> Toujours hasher les mots de passe (bcrypt recommandé).
> Documenter dans le rapport : les mesures de sécurité mises en place.
> Mentionner HTTPS, CSRF tokens, validation des entrées dans le rapport.
