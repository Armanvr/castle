# Journal des modifications

Toutes les évolutions notables du Grimoire sont consignées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; versions selon [SemVer](https://semver.org/lang/fr/).

## [Non publié]

## [0.1.0] — 2026-10-30

Première version versionnée. Elle regroupe le travail mené du 23 au 28 octobre 2026.

### Ajouté

- **Tableau du Maître** : application locale Preact + TypeScript + Vite, en français, sans compte ni serveur métier (D&D 5e, règles 2014).
- **Campagne réelle** : intégration de L'Île aux Dragons depuis `stormwreck-json/` (4 chapitres, 44 scènes). Les sources sont conservées et les informations absentes ne sont pas inventées. Les avertissements de données incomplètes sont affichés.
- **Navigation** : chapitres et scènes, fiches des PJ, personnages et PNJ, bestiaire, rencontres, journal et objets du groupe. Le panneau de contexte peut être masqué.
- **Scènes** : résumé et dialogues en tête, puis texte à lire aux joueurs, informations complémentaires, choix et conséquences. Les ajouts du MJ sont éditables et identifiés comme personnels.
- **Choix narratifs** : application idempotente, annulation immédiate, conditions d'accès et effets consignés au journal.
- **Combat** : initiative, tours et rounds, PV actuels et temporaires, PV maximum, CA, bonus d'initiative, conditions avec durée, sauvegardes contre la mort. Les statistiques des PJ persistent d'un combat à l'autre ; celles des monstres restent propres à chaque exemplaire.
- **Interface de combat en deux panneaux** : liste d'initiative (`InitiativeRow`) et fiche du participant sélectionné, avec barre d'outils collante.
- **Attaques des monstres** : bonus, dégâts et DD issus des données, avec boutons de jets lorsque la formule est connue. Les dégâts de types différents sont lancés séparément.
- **Retrait réversible** : bloc « Retirés (n) » avec « Réintégrer ». L'état du participant (PV, statut, sauvegardes contre la mort) est conservé.
- **Initiative** : jet automatique des créatures au démarrage du combat. « Lancer les initiatives » ne relance que les créatures sans initiative, sans toucher aux PJ ni au tour en cours.
- **Sauvegardes** : état de partie par campagne et par emplacement dans `localStorage`, avec export et import JSON validés avant remplacement.
- **Libellés français** des données brutes (`fieldLabel`, `valueLabel`, `journalTypeLabel`) : nombres à virgule, bonus signés, codes de statut traduits, « Non renseigné » pour les valeurs vides.
- **Accessibilité** : lien d'évitement, anneau de focus, gestion du focus après les actions de combat, annonces dans une région live, mouvement réduit.
- **Tests** : 66 tests avec le lanceur natif de Node (`npm test`) couvrant le domaine, les sauvegardes, la campagne, les dés et les libellés.
- **Documentation** : `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/campaign-format.md`, `docs/stormwreck-integration.md`, `docs/verification.md`.

### Modifié

- **Production limitée à la campagne réelle** : les exemples fictifs ne servent plus qu'aux tests (`tests/fixtures/`). L'ancienne sélection de démonstration est ignorée sans effacer les sauvegardes existantes.
- **Fiche de combat réordonnée** : PV et dégâts, puis sauvegardes contre la mort, puis attaques, puis conditions. Statistiques, notes et état sont regroupés dans « Ajuster les statistiques ».
- **Typographie et contrastes** revus (tailles minimales, interlignage, chiffres tabulaires, paires de couleurs conformes WCAG).
- **Lanceur de dés global retiré** à la demande du MJ. Les jets restent disponibles sur les attaques.
- **Bloc « Derrière l'écran » masqué** dans les scènes. Ses données et les ajouts sauvegardés sont conservés.
- **Identifiants techniques** (`id`, `statBlockId`) masqués dans l'interface. La provenance reste visible.

### Corrigé

- Une créature retirée par une ancienne sauvegarde à 0 PV revenait inconsciente au lieu de morte.
- Le lancer d'initiative pouvait réinitialiser le tour actif.
- Une sélection périmée subsistait après le retrait puis la réintégration d'un participant.
- Les sauvegardes contre la mort n'étaient pas réinitialisées lorsqu'un PJ passait à « stable » ou était ranimé manuellement.
- La barre d'outils du combat masquait des lignes de la liste à 800 px : sa hauteur est désormais mesurée (`--combat-toolbar-h`).
- `journalTypeLabel` renvoyait une fonction pour des noms comme `toString`. `fieldLabel` laissait des espaces en bord de chaîne pour les clés préfixées par `_`.
- Le type de taille était répété dans la description des monstres (« de taille M · M »).

### Sécurité

- Les recherches de libellés utilisent `Object.hasOwn` pour qu'une sauvegarde importée ne puisse pas atteindre les propriétés du prototype.
- L'import de sauvegarde est validé (version, références de campagne, bornes numériques) avant tout remplacement. Aucun `localStorage.clear()`.

[Non publié]: #
[0.1.0]: #
