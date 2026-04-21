# Diagramme de Cas d'Utilisation — VoxelPlace

```mermaid
flowchart LR
    Anon(["👁 Visiteur"])
    Auth(["👤 Joueur connecté"])
    MC(["⛏ Minecraft"])
    Admin(["👑 Admin"])

    subgraph Lecture["Lecture seule"]
        UC1["Voir le canvas temps réel"]
        UC2["Zoom / Navigation"]
        UC3["Hover pixel (auteur, coords)"]
        UC4["Voir le leaderboard"]
    end

    subgraph Compte["Gestion du compte"]
        UC5["S'inscrire / Se connecter"]
        UC6["Supprimer son compte (RGPD)"]
    end

    subgraph Jeu["Actions de jeu"]
        UC7["Placer un pixel"]
        UC8["Débloquer couleurs & fonctions"]
        UC9["Signaler un pixel / joueur"]
        UC10["Chat sur un pixel"]
        UC11["Partager une zone"]
    end

    subgraph MinecraftUC["Minecraft"]
        UC12["Placer un bloc (16 couleurs)"]
        UC13["Commandes /vp"]
    end

    subgraph AdminUC["Administration"]
        UC14["Modérer (ban, clear, restore)"]
        UC15["Traiter les signalements"]
        UC16["Voir les logs"]
    end

    Anon --> Lecture
    Anon --> UC5

    Auth --> Lecture
    Auth --> Compte
    Auth --> Jeu

    MC --> UC12
    MC --> UC13

    Admin --> AdminUC
```

---

| Acteur | Cooldown pixel | Accès |
|--------|---------------|-------|
| Visiteur | — | Lecture seule |
| `user` | 60 s | Jeu complet |
| `superuser` (hbtn_*) | 1 s | Jeu complet |
| `admin` | 5 s | + modération |
| `superadmin` | 0 s | Accès total |
