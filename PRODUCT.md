# Le Grimoire

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Le maître du jeu, pour un usage personnel principalement sur ordinateur pendant les parties de D&D 5e, règles 2014. L’interface est en français.

## Product Purpose

Aider le MJ à mener une partie sans perdre le fil : lire rapidement les scènes et les dialogues, suivre les combats et conserver ses ajouts. Le MJ garde la main sur les décisions et l’arbitrage des règles.

## Operating Context

Application locale existante en Preact, TypeScript et Vite, sans compte utilisateur ni serveur métier. Les ressources de campagne sont locales. Le serveur local doit rester disponible ; aucun service worker n’est installé.

L’état de partie est sauvegardé sur cet appareil dans le stockage du navigateur, par campagne et emplacement. L’export/import JSON permet de conserver ou transférer une sauvegarde. Changer d’origine, de port ou de navigateur peut changer les sauvegardes accessibles.

## Capabilities and Constraints

- Navigation entre chapitres et scènes, fiches des PJ, bestiaire, rencontres, journal et objets du groupe.
- Dans une scène, le résumé et les dialogues sont prioritaires. Le texte à lire aux joueurs vient ensuite ; les choix, conséquences et liens de suite terminent la page.
- Ajouts personnels éditables et sauvegardés par scène pour le résumé, les dialogues et le texte à lire aux joueurs. Le bloc de notes du MJ a été retiré de cette page ; ses données existantes sont conservées.
- Combat : initiative, tours, PV actuels et temporaires, PV maximum, CA, bonus d’initiative, conditions et sauvegardes contre la mort. Les changements de statistiques des PJ persistent dans leurs fiches et les rencontres suivantes ; ceux des monstres restent propres à chaque exemplaire.
- Les attaques et jets des monstres sont accessibles sous leurs PV. Les boutons utilisent les formules connues ; le lanceur global de dés a été retiré à la demande du MJ. Les résultats des jets sont temporaires.
- Les sources de campagne restent distinctes de l’état de partie et des ajouts du MJ. Ne pas inventer de dialogue, texte officiel, statistique ou effet manquant. Signaler les informations incomplètes et conserver leur provenance.
- Préserver les sauvegardes et leur compatibilité ; valider les imports avant remplacement. Aucun effacement global du stockage.

## Brand Commitments

Nom existant : « Le Grimoire ». Terminologie française du jeu : MJ, PJ, PV, CA, initiative, rencontres, choix et conséquences.

## Evidence on Hand

- `stormwreck-json/` : campagne intégrée de L’Île aux Dragons, avec résumés, références et informations parfois incomplètes. Ce contenu ne doit pas être complété par invention.
- `README.md` et `docs/campaign-format.md` : fonctionnement local, contrats et règles de sauvegarde.
- `src/` : capacités et interface existantes ; `tests/` : vérifications automatisées et exemples fictifs réservés aux tests.
- Les tests et la compilation ne constituent pas une validation visuelle, tactile ou par lecteur d’écran.

## Product Principles

1. Faciliter la lecture et les actions du MJ pendant la partie.
2. Donner la priorité au résumé des scènes, aux dialogues et au suivi des combats.
3. Préserver les sources et rendre explicites les informations manquantes ainsi que les ajouts personnels.
4. Conserver les données de session et permettre leur export sans dépendre d’un compte.
5. Assister l’arbitrage du MJ sans lui attribuer des effets ou décisions non documentés.
