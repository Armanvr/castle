# Format des campagnes et sauvegardes

## Organisation

Cette page décrit le format interne et le format normalisé historique utilisé par les fixtures de tests. Un manifeste normalisé indique son `id`, `title`, `subtitle`, `version`, `rules` (`"2014"`), `demo` et les chemins relatifs des fichiers : `chapters` (liste), `players`, `monsters`, `encounters`, `locations`, `items`, `npcs`. Les sources de production `stormwreck-json/` gardent leur propre schéma, traduit par [l'adaptateur dédié](stormwreck-integration.md).

Les fichiers de collections contiennent des tableaux JSON. Chaque fichier de chapitre contient un objet avec `id`, `title`, `description`, `scenes`. Le contrat complet et strict est dans [`src/types.ts`](../src/types.ts) ; les fichiers de démonstration servent d'exemples exécutables.

L'application démarre uniquement sur la campagne intégrée `/stormwreck-json/manifest.json`, reconnue par le chargeur et importée par Vite. Les anciens chemins de démonstration et les autres manifestes ne sont pas proposés ni chargés. Aucune donnée distante n'est nécessaire.

Les identifiants sont stables. Ne pas renommer un identifiant utilisé par une sauvegarde sans migration. Les références de scène, chapitre, lieu, PNJ, rencontre, objet et monstre sont validées avant utilisation.

## Provenance

Les scènes, PJ et monstres portent `source` :

```json
{ "type": "fictional_demo", "pages": [] }
```

Valeurs autorisées : `fictional_demo`, `official_summary`, `custom`. Pour un résumé du livret, renseigner les pages réellement consultées ; `files` peut préciser les noms de PDF et leurs pages. Les textes de démonstration ne sont pas officiels. Les valeurs inconnues admises par les types restent `null`. Un profil incomplet peut être consulté ; les statistiques indispensables à son combat doivent être explicitement renseignées par le MJ avant lancement, dans la session seulement.

## Scènes

Une scène comprend `id`, `chapterId`, `title`, `locationId`, `recommendedLevel`, `source`, `readAloud`, `dmNotes`, `characters` (identifiants PNJ), `dialogues`, `checks`, `choices`, `encounterIds` et `transitions`.

`readAloud` et `recommendedLevel` peuvent être `null`. Le champ `summary` conserve le résumé fourni sans le présenter comme un texte officiel à lire. Un choix peut porter `nextSceneId`, `origin` et `manual` ; une option manuelle n'applique aucune conséquence non documentée.

Un dialogue possède `id`, `speakerId`, `text` et des choix `{id,label,nextDialogueId}`. Un test possède `ability`, `dc`, `description` et éventuellement `successChoiceId`/`failureChoiceId`. Une transition possède `sceneId` et `label`. Le MJ conserve l'accès manuel à toutes les scènes.

## Conditions et effets

Les conditions d'un choix sont combinées par ET. Elles vérifient un drapeau (`flag`, opérateurs `equals`/`not_equals`), un statut de scène (`scene`) ou une quête (`quest`).

```json
{
	"id": "demo-accepter",
	"label": "Accepter la mission de démonstration",
	"conditions": [],
	"effects": [
		{ "type": "set_flag", "key": "demo_mission", "value": true },
		{ "type": "journal", "title": "Mission acceptée", "description": "Le groupe accepte." }
	],
	"important": true
}
```

Les autres effets sont `unlock_scene`, `set_quest`, `add_item`, `relationship` et `start_encounter`. Voir l'union `Effect` pour leurs paramètres. Les choix déjà effectués sont enregistrés pour empêcher leur double application. L'annulation concerne le dernier choix lorsque son instantané reste applicable ; elle ne doit pas effacer des modifications intervenues ensuite.

## Personnages et rencontres

Une fiche statique conserve caractéristiques, PV maximaux, CA, vitesse, bonus d'initiative, compétences, attaques, sorts et ressources maximales. L'état dynamique conserve PV actuels/temporaires, conditions, épuisement, sauvegardes contre la mort et ressources restantes.

Une rencontre contient `id`, `name`, `description`, `participants`. Chaque groupe de participants indique `monsterId`, `count` et éventuellement `type` (`monster`, `ally`, `hostile`). Le démarrage crée des identifiants d'instances distincts. Un combattant PJ référence `playerId` ; ses PV ne sont pas dupliqués.

`count` peut être `null` dans un modèle incomplet. Les valeurs de préparation sont distinctes des données initiales ; la sauvegarde conserve les PV maximaux et la CA effectivement saisis pour chaque instance, ainsi que ses annotations manuelles. Les statistiques du catalogue restent immuables.

Les monstres de démonstration sont des créations fictives. Pour un monstre réel, utiliser uniquement les données fournies ou une source légalement utilisable, et conserver la provenance.

## État sauvegardé

`GameState` contient sa version, la campagne, la scène active, les statuts de scènes, variables, quêtes, inventaire, relations, choix effectués, PJ, combat, journal et notes. Les données JSON statiques ne sont jamais réécrites.

Les extensions `customPlayers` et `itemAssignments` conservent les PJ saisis par le MJ et les objets attribués. Une ancienne sauvegarde sans ces champs est normalisée avec `[]` et `{}` lors de l'import. Une seule attribution par objet du catalogue est prise en charge tant que les sources ne fournissent pas d'instances de récompenses distinctes.

L'état du combat conserve son statut, le round, le participant actif, l'ordre et les initiatives, les instances et leurs états. L'import doit vérifier ces liens avant de remplacer l'état courant. La version 1 est le format initial ; toute version future exige une migration explicite, et les versions inconnues doivent être refusées.

Lorsqu'un participant est retiré, `removedStatus` conserve son état précédent. Le prochain combat réintègre les PJ avec cet état et leurs PV conservés, sans ranimer un personnage mort.

Compatibilité initiale : une enveloppe `version: 0` n'est migrée vers `1` que si tout son contenu satisfait le schéma actuel. Ce n'est pas une conversion générique d'anciens schémas ; les autres versions sont refusées.

`localStorage` dépend de l'origine et du navigateur. L'export JSON constitue la sauvegarde portable. L'application ne synchronise aucune donnée entre appareils.

La clé utilisée est `dnd-dm:campaign:<id>:v1:slot:<emplacement>` (emplacement `1` par défaut). Chaque campagne et chaque emplacement ont un état distinct. Une lecture invalide conserve l'original et nécessite une action explicite de récupération avant reprise de l'écriture automatique.
