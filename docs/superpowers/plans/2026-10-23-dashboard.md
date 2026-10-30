# Dashboard Implementation Plan

**Goal:** livrer le tableau de maîtrise local complet avec données fictives.

**Architecture:** JSON immuable, moteurs purs, état dynamique unique et persistance versionnée. Interface Preact française.

**Tech Stack:** Vite, Preact, TypeScript strict, CSS, JSON, localStorage.

## Répartition et ordre

- [x] Domaine : `src/types.ts`, `src/services/`, `public/campaigns/`. Définir le contrat partagé avant intégration UI. Charger le manifeste, vérifier types et références ; implémenter les transitions narratives et combat sans mutations des données statiques.
- [x] Interface : `src/app.tsx`, `src/components/`, `src/index.css`. Construire navigation, scènes, fiches, combat, journal et sauvegardes autour du contrat partagé. Une seule source de PV par joueur.
- [x] Documentation : `README.md`, `docs/campaign-format.md`. Décrire démarrage, données fictives, conventions JSON, sauvegardes et intégration des sources.
- [x] QA après intégration : tests déterministes des moteurs et import/export, compilation avec `npm run build`, vérification de la démo et des références. Toute correction garde un test couvrant son comportement.
- [x] Revue : simplifier sans modifier le comportement ; relancer QA après simplification.

## Scénarios de validation

1. Dégâts 7 sur 5 PV temporaires et 10 PV ordinaires => 0 temporaires et 8 ordinaires ; soin 99 => maximum.
2. Deux instances du même monstre ont des identifiants différents ; fin de liste d'initiative => round suivant.
3. Un PJ à 0 reste inconscient, trois échecs entraînent la mort ; modifier ses PV en combat modifie sa fiche.
4. Choix joué deux fois => un seul effet ; navigation libre et changement de chapitre conservent le journal.
5. Export/import reproduit exactement le combat ; JSON malformé, référence absente et version inconnue sont signalés sans écrasement silencieux.

Le dossier initial n'a pas de métadonnées Git ; aucun commit ni worktree n'est créé.
