# Journal des modifications

Toutes les évolutions notables du Grimoire sont consignées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; versions selon [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- **Annuler les PV** : bouton « Annuler · … » dans la barre du combat (ou Ctrl+Z / Cmd+Z). Il rétablit PV, PV temporaires, état et sauvegardes contre la mort pour les 20 dernières actions (dégâts, soins, sauvegardes contre la mort, saisies manuelles de PV, dégâts appliqués depuis un jet). La pile reste en mémoire : elle n'est pas sauvegardée et se vide à la fin ou au changement de combat.
- **Appliquer un jet de dégâts** : sous le résultat d'un jet de dégâts d'une attaque, choix d'une cible (participants actifs, hors attaquant) et bouton « Appliquer N dégâts ». Une seule cible ; l'action est annulable et annoncée.
- **Raccourcis clavier du combat** : N (tour suivant), D (saisir des dégâts), Ctrl+Z / Cmd+Z (annuler). Ils sont ignorés dans les champs de saisie. Dans la saisie de quantité, Entrée applique les dégâts.
- **Durée des conditions en rounds** : champ numérique facultatif à l'ajout d'une condition. Le compteur baisse au début du tour de la créature concernée ; à 0 la condition reste affichée « expirée » et le MJ la retire. L'expiration est annoncée (« Condition expirée : … »). Les anciennes durées en texte libre sont conservées et affichées telles quelles.
- **Mode table** : bouton « Mode table » au-dessus du combat. Il masque la navigation, la barre du haut et le panneau de contexte pour donner tout l'écran au combat. « Quitter le mode table » ou Échap (hors saisie et hors recherche) en sort ; quitter les rencontres ou terminer le combat aussi.
- **Recherche globale** : Ctrl+K / Cmd+K ou le bouton « Rechercher » de la barre du haut. Elle couvre scènes, PNJ, monstres, objets et PJ personnalisés, sans tenir compte des accents ni de la casse ; les titres passent avant le texte. ↑/↓ parcourent les résultats, Entrée ouvre. Le choix mène à la vue concernée et fait défiler jusqu'à la fiche.
- **Récapitulatif de fin de combat** : l'entrée du journal indique le nombre de rounds, les PJ à terre (0 PV, stables ou morts), les créatures vaincues et les participants retirés. Le récapitulatif décrit l'état à la fin du combat : un PJ tombé puis soigné n'y figure pas.
- **Rappel de concentration** : nouvelle condition « Concentration ». Quand son porteur subit des dégâts en combat, l'application annonce le jet de sauvegarde de Constitution à faire (DD = max(10, moitié des dégâts)), ou la rupture de la concentration s'il tombe à 0 PV. Le jet et le retrait de la condition restent à la main du MJ.

### Modifié

- **Scènes** : une section vide (résumé, dialogues, texte à lire) se replie en bouton « ＋ Ajouter … (MJ) » qui ouvre l'éditeur. Les mentions de texte source manquant restent affichées.
- **Choix de la scène** : les scènes sont regroupées par chapitre dans la liste.
- **Lint** : `biome.json` ignore `.claude/`, `.impeccable/`, `docs/` et `DESIGN.md`, et utilise `preset` au lieu de l'option dépréciée `recommended`.

- **Fenêtres `prompt` supprimées** : la durée d'une condition et les statistiques inconnues d'une créature (PV maximum, CA, bonus d'initiative) se saisissent dans des champs intégrés, avec libellés et messages de validation. « Ajouter une créature » reste désactivé tant que ces valeurs sont invalides ; les statistiques connues ne sont pas redemandées.
- **Format de sauvegarde** : les conditions acceptent un champ facultatif `rounds` (entier ≥ 0). Les sauvegardes existantes se chargent sans changement.

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
