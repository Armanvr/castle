# Intégration des données Stormwreck Isle

## Audit des sources

Le dossier `stormwreck-json/` contient 12 fichiers JSON et un README. Le manifeste source utilise le schéma `0.3.0`, avec l'identifiant `dragons-ile-aux-tempetes`. Il s'agit désormais de la seule campagne de production. Les anciens exemples `stormwreck-isle` ont été déplacés dans les fixtures de tests ; leurs sauvegardes historiques ne sont plus chargées.

Inventaire vérifié : quatre chapitres, 44 scènes (13/8/13/10), 29 choix, cinq tests, 27 PNJ, 34 lieux, 13 rencontres, 19 profils de créatures et six objets. Les identifiants et références entre scènes, lieux, PNJ, rencontres et profils sont cohérents dans la livraison examinée.

Les données sources ne sont ni modifiées, ni déplacées, ni recopiées dans `public/`. Les empreintes SHA256 de chaque JSON ont été enregistrées avant l'intégration puis comparées après les vérifications : **12 fichiers, aucune différence**.

## Correspondance des schémas

| Fichier source            | Usage normalisé                                                       |
| ------------------------- | --------------------------------------------------------------------- |
| `manifest.json`           | Métadonnées, index des fichiers, limitations et provenance            |
| `chapters/chapter-*.json` | Chapitres, scènes, zones, résumés, notes, tests, choix et transitions |
| `characters.json`         | PNJ et liens vers leurs profils de créatures                          |
| `locations.json`          | Descriptions des lieux et pages sources                               |
| `encounters.json`         | Groupes de créatures et quantités initiales à préparer                |
| `monster-catalog.json`    | Statistiques disponibles et marqueurs de vérification                 |
| `items.json`              | Catalogue d'objets, mécanismes et récompenses en attente              |
| `introduction.json`       | Contexte et conseils de maîtrise                                      |
| `validation-report.json`  | Avertissements et limites de fiabilité                                |

Le chargement est centralisé dans `campaignLoader`. Un adaptateur dédié traduit le schéma source vers les contrats existants ; les composants ne chargent aucun fichier source individuellement. Les imports JSON sont traités par Vite et inclus dans la compilation, sans supposer que le dossier racine est servi par HTTP.

Les identifiants d'origine et les zones effectivement fournies A1–A5, B1–B6, C1–C9 et D1–D5 sont conservés. **Aucune scène D6 n'existe dans le chapitre 4 reçu**, malgré sa mention dans la demande : elle n'est pas inventée. Les index normalisés permettent les recherches par identifiant. Une référence absente est signalée explicitement ; elle ne justifie pas l'invention d'une entité.

## Fidélité narrative

Tous les champs `readAloud` sont `null` dans ces sources. Le résumé est donc présenté séparément, sans le faire passer pour un encadré officiel. Aucun dialogue n'est fourni. Les choix de navigation éditoriale restent identifiés comme tels ; les transitions `nextSceneId` ne créent aucun effet narratif supplémentaire.

Les effets `set_flag` et les conditions réellement décrites réutilisent le moteur narratif existant, avec protection contre la double application. Une option incomplète reste une décision manuelle du MJ. Les résultats textuels des tests sont conservés, sans leur inventer de conséquences automatiques.

Les références PDF et pages imprimées sont exposées lorsqu'elles sont disponibles. Les références de scène sont rapprochées des fichiers du chapitre à partir de leurs pages, sans prétendre avoir revérifié les scans.

## Profils et rencontres incomplets

Neuf profils demandent vérification : `dragon-bleu-jeune`, `guivre-follette`, `kobold`, `kobold-aile`, `mort-vivant`, `thallophyte-violette`, `goule`, `sinensa`, `tarak`.

Quatre n'ont pas de PV/CA exploitables : `dragon-bleu-jeune`, `guivre-follette`, `mort-vivant`, `thallophyte-violette`. `mort-vivant` est une catégorie narrative générique ; le MJ doit choisir ou préciser le profil utilisé.

Six groupes ont une quantité absente : la guivre des sources chaudes, les thallophytes violettes, les zombies de la cale, les kobolds et striges de la rotonde, et les kobolds du rituel. Les quantités numériques restantes portent un statut d'estimation ou de lecture visuelle : elles restent à confirmer.

Une valeur `null` reste inconnue. Le MJ prépare explicitement les valeurs indispensables au combat. Les valeurs saisies et les PV courants appartiennent aux instances de la session ; ils ne changent jamais le catalogue statique. Les attaques, dégâts et capacités renseignés restent consultables pendant le combat, sans automatisation des règles absentes.

## Groupe, inventaire et sauvegardes

Aucune fiche PJ n'est incluse. La campagne réelle démarre sans personnages inventés ; les PJ saisis manuellement par le MJ appartiennent à la sauvegarde de session. Les PV restent partagés entre leur fiche et leur participant en combat.

Les identifiants des PJ de session commencent par `custom:`. Ce préfixe est réservé : ne pas l'utiliser pour un PJ statique d'un futur fichier de campagne. Les PJ manuels ne remplacent pas une conversion complète des fiches réelles ; seules les valeurs explicitement saisies sont connues.

Aucune scène ne contient de référence structurée à un objet-récompense. Le catalogue peut être consulté et attribué manuellement, mais aucun lien de récompense n'est déduit d'un texte. Les récompenses de quêtes, le trésor du capitaine, le talisman, la clef et les artefacts de l'observatoire restent en attente de vérification. Une attribution unique est enregistrée dans l'état dynamique.

La persistance conserve les clés versionnées par campagne et emplacement, l'import/export, et la protection des sauvegardes incompatibles. Une sauvegarde refusée n'est pas écrasée automatiquement. Les nouveaux champs optionnels doivent avoir une valeur initiale explicite à l'import des anciennes sauvegardes ; les identifiants inconnus sont signalés, jamais remplacés silencieusement.

## Ajouter ou mettre à jour une campagne

Le chargeur de production accepte uniquement la campagne intégrée. Le validateur du format normalisé reste utilisé par les fixtures et les tests. L'ajout futur d'une campagne devra passer par une extension explicite du catalogue et, si nécessaire, un adaptateur central ; conserver les identifiants et références de provenance.

Une mise à jour des JSON Stormwreck est prise en compte au prochain démarrage Vite ou à la prochaine compilation. Une mise à jour incompatible des identifiants exige une migration explicite de sauvegarde, ou une réinitialisation confirmée après export.

## Vérification de l'intégration

- `npm test` : 24 tests réussis, aucun échec, incluant les 15 tests de la démonstration.
- `npm run build` : TypeScript strict et compilation Vite réussis.
- `npm run lint` : code de sortie 0, aucune erreur ; 216 avertissements et quatre informations restent présents (principalement assertions non nulles, styles CSS et configuration Biome).
- Intégrité des sources : 12 empreintes SHA256 inchangées.

Les régressions couvrent les données réellement chargées, les valeurs absentes, les références, les préparations de rencontre, les instances indépendantes, les PJ de session, les PV partagés, les objets uniques et les sauvegardes anciennes/nouvelles. La revue a également corrigé la réinitialisation avec un groupe manuel et les bornes incohérentes entre saisie et import.

Le navigateur, les interactions tactiles et le rendu responsive réel restent non vérifiés : le serveur local est bloqué par `listen EPERM` dans l'environnement d'exécution. L'exactitude des profils partiels nécessite toujours les scans manquants ou une vérification du MJ. Les liens de récompenses par scène et la zone D6 attendent des données sources ; aucune automatisation n'a été inventée pour les remplacer.
