# Les Dragons de l’Île aux Tempêtes — données pour tableau de bord MJ

## Fichiers
- `manifest.json` : index des quatre chapitres et des dépendances.
- `chapters/` : scènes structurées A/B/C/D, choix, conditions, tests, notes et références des pages.
- `characters.json` : personnages, PNJ et groupes.
- `encounters.json` : modèles de rencontres **sans blocs de statistiques**.
- `monster-catalog.json` : identifiants des monstres, en attente de l’annexe.
- `locations.json`, `items.json`, `introduction.json` et `validation-report.json`.

## Utilisation
Charger `manifest.json`, puis chacun des `chapterFiles`. Utiliser `scene.id` comme identifiant persistant et `choice.nextSceneId` pour la navigation. Les `effects` sont des suggestions d’état déclaratives; les valeurs du combat (PV, initiative, round et conditions) doivent être enregistrées séparément en `localStorage` par l’application. Les références `sourcePages` renvoient aux numéros de pages imprimés.

## Limites importantes
Ces fichiers constituent une **première structuration des 17 scans**, et non une transcription exhaustive certifiée des pages. Plusieurs textes sur les pages de droite et les mécanismes détaillés doivent être confirmés avant utilisation comme référence arbitrale. Les champs `readAloud` restent `null` pour éviter de présenter des créations comme les encadrés originaux. Les annexes de monstres et d'objets n’ont pas été fournies. Les choix avec `origin: editorial_navigation` servent à la navigation dans l’application et ne sont pas nécessairement des options officielles.


## Mise à jour annexes (v0.3.0)
Sept scans d’annexes intégrés : objets magiques et profils de créatures. Le catalogue `monster-catalog.json` est la source de vérité des statistiques ; les rencontres y pointent par `statBlockId`, avec PV et CA de base. `null` signifie non lisible / non confirmé dans le scan. Les pages de droite sont parfois coupées : vérifiez les entrées `requiresVerification: true` avant usage. Les PV courants et initiatives restent des données dynamiques de session dans localStorage.
