# Passage à la campagne réelle uniquement

## Audit et retrait du contenu fictif

Les données fictives étaient isolées dans 11 JSON de `public/campaigns/stormwreck-isle/` : `manifest.json`, `players.json`, `monsters.json`, `encounters.json`, `characters.json`, `locations.json`, `items.json` et les quatre fichiers `chapters/chapter-01.json` à `chapter-04.json`.

Ces fichiers ont été déplacés vers `tests/fixtures/demo-campaign/`. Ils conservent les exemples des tests métier (Iris, Maël, Nox, Sélia, scènes, dialogues, choix, quêtes, monstres, rencontres et objet fictifs) sans être importés par le code de production ni livrés dans les ressources publiques.

L'application ne propose et ne charge plus que `stormwreck-json/`, sous l'identifiant réel `dragons-ile-aux-tempetes`. Le chargeur rejette les autres manifestes, y compris l'ancien chemin de démonstration. La carte SVG fictive, les badges et les boutons de démonstration ont été retirés. Les descriptions, PNJ, choix, rencontres, objets et profils disponibles viennent des fichiers fournis ; les ajouts du MJ restent explicitement personnalisés.

## Fichiers concernés

- `src/services/campaignLoader.ts` : chargement réel uniquement, sans secours fictif.
- `src/services/game.ts` : progression initiale vide et journalisation idempotente des rencontres réellement terminées.
- `src/services/storageService.ts` : nettoyage ciblé des anciennes préférences, conservation des sauvegardes.
- `src/app.tsx` : démarrage réel, paramètres et tableau de bord nettoyés, états vides.
- `src/components/Views.tsx` : états vides et scènes non visitées présentées « À explorer ».
- `src/components/CombatView.tsx` : rencontres du scénario ou personnalisées, état vide et événements réels.
- `src/index.css` : retrait des styles de la carte fictive.
- `tests/domain.test.ts` : chemin des fixtures déplacées ; tests historiques conservés.
- `tests/cleanup.test.ts` : régressions sur chargement, initialisation, stockage, fixtures et fin de rencontre.
- `README.md` et documentation du format/intégration : instructions actualisées.

## Sauvegardes : absence de suppression générale

Les sauvegardes réelles gardent leurs clés existantes : `dnd-dm:campaign:dragons-ile-aux-tempetes:v1:slot:<emplacement>`. Aucun changement de namespace, écrasement ni réinitialisation automatique n'est effectué.

Le nettoyage retire exclusivement :
1. `dnd-dm:active-manifest`, **seulement** si sa valeur est exactement `/campaigns/stormwreck-isle/manifest.json`.
2. La préférence `dnd-dm:slot:/campaigns/stormwreck-isle/manifest.json`.

Tous les anciens contenus sauvegardés sont conservés, même sous le namespace de démonstration : ils peuvent contenir des notes ou des ajouts du MJ. Ils sont ignorés au démarrage et ne peuvent pas être importés comme sauvegardes de la campagne réelle. En cas de besoin, conserver ces données avant une migration manuelle ; ne pas changer simplement leur identifiant de campagne.

Les autres clés du domaine ne sont pas supprimées et `localStorage.clear()` n'est jamais appelé. L'impossibilité de nettoyer une préférence n'empêche pas le chargement réel. Une sauvegarde réelle illisible reste protégée contre l'enregistrement automatique ; export de l'original, import validé et réinitialisation confirmée restent disponibles.

## État d'une nouvelle partie

La première scène est proposée comme point de départ, sans la marquer visitée ou terminée. Aucun PJ, combat, round, initiative, condition, inventaire, quête ou événement de journal n'est préchargé. Les messages vides ne créent aucune donnée.

Une sauvegarde réelle existante conserve sa progression et ses ajouts : le nettoyage ne remet pas les parties en cours à zéro.

## Fonctionnalités conservées et limites

Navigation libre dans les quatre chapitres, scènes, PNJ, bestiaire, préparation et création de rencontres personnalisées, initiatives, PV partagés, conditions, PJ manuels, inventaire, objets, notes, journal, emplacements et import/export sont conservés.

Les données reçues restent partielles : aucune fiche PJ réelle, neuf profils à vérifier, six quantités absentes, textes officiels et dialogues non transcrits, récompenses non reliées aux scènes et absence de D6. Les valeurs indispensables au combat peuvent être saisies par le MJ dans la session, sans modifier les sources. Aucun contenu n'a été inventé pour combler ces lacunes.

Vérifications finales : **30 tests réussis**, compilation TypeScript/Vite réussie et lint sans erreur (217 avertissements et huit informations). Le contrôle du code et du build ne trouve aucun ancien contenu fictif ni import de fixtures. `public/` est vide, les 11 JSON d'exemples restent uniquement dans les tests, et les 12 JSON réels ont conservé leurs empreintes SHA256. Le navigateur reste non vérifié dans cet environnement. Les détails figurent dans [le rapport de vérification](verification.md).
