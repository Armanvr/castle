# Le Grimoire — tableau du Maître

Assistant local de maîtrise D&D 5e (règles 2014), en français. Vite, Preact, TypeScript strict et CSS ; aucun serveur métier ni compte utilisateur.

## Démarrer

```sh
npm install
npm run dev
```

Ouvrir l'adresse locale annoncée par Vite. Pour une version compilée :

```sh
npm run build
npm run preview
```

## Vérifier

```sh
npm test
npm run build
```

Les tests utilisent le lanceur intégré de Node et son support TypeScript natif ; utiliser Node 22.18 ou plus récent (Node 26 utilisé pour le développement).

Les ressources sont locales : aucune police, API ni image distante n'est nécessaire pendant la partie. Garder le serveur local ouvert ; cette version n'installe pas de service worker.

## Utilisation

La navigation donne accès aux scènes dans l'ordre choisi par le MJ, aux fiches, au bestiaire, aux rencontres et au journal. Le panneau du groupe peut être masqué. Les PV d'un PJ proviennent d'un état partagé entre sa fiche et le combat. Les conditions renseignent le MJ sans automatiser tous leurs effets.

La campagne réelle est chargée depuis `stormwreck-json/`, sans déplacer ni dupliquer ses fichiers. Elle contient quatre chapitres et 44 scènes. Les résumés et références fournis sont conservés ; les encadrés officiels non transcrits, les dialogues absents et les statistiques incomplètes ne sont pas inventés. Consulter les avertissements avant la partie.

La campagne réelle est la seule campagne proposée et démarre automatiquement. Les anciens exemples fictifs sont réservés aux tests et ne sont plus livrés en production. Une ancienne sélection de démonstration est ignorée.

Aucune fiche PJ réelle n'est fournie. Saisir les personnages du groupe avec leurs valeurs connues ; ces fiches de session et leurs PV seront sauvegardés. Les rencontres dont une quantité ou une statistique indispensable manque demandent une préparation manuelle avant lancement.

Une nouvelle partie commence sans PJ, combat, journal, inventaire ni scène visitée. Le chapitre 1 est proposé comme point de départ sans progression supposée. Les ajouts du MJ restent identifiés comme personnalisés.

## Pendant la partie

- **Raccourcis du combat** : `N` passe au tour suivant, `D` place le curseur dans la saisie des dégâts, `Entrée` applique les dégâts saisis, `Ctrl+Z` / `Cmd+Z` annule la dernière action sur les PV. Ils sont ignorés pendant la saisie dans un champ, où le `Ctrl+Z` du navigateur continue de fonctionner.
- **Annulation des PV** : les 20 dernières actions du combat (dégâts, soins, sauvegardes contre la mort, saisies de PV, dégâts appliqués depuis un jet) peuvent être annulées. Cet historique reste en mémoire : il n'est pas sauvegardé et se vide au rechargement ou à la fin du combat.
- **Jets des monstres** : sous un jet de dégâts, choisir une cible puis « Appliquer N dégâts ».
- **Conditions** : durée facultative en rounds, décomptée au début du tour de la créature concernée. À 0, la condition reste affichée « expirée » et le MJ la retire. La condition « Concentration » déclenche un rappel du jet de sauvegarde de Constitution (DD = max(10, moitié des dégâts)) ; le jet reste à la main du MJ.
- **Mode table** : le bouton « Mode table » au-dessus du combat masque la navigation et les panneaux. Pour en sortir : « Quitter le mode table » ou Échap (hors saisie et hors recherche). Sur téléphone, « Annuler » et « Tour suivant » restent épinglés en haut de l'écran.
- **Recherche globale** : `Ctrl+K` / `Cmd+K` ou le bouton « Rechercher ». Scènes, PNJ, monstres, objets et PJ, sans tenir compte des accents ni de la casse.
- **Export rapide** : `Ctrl+S` / `Cmd+S` exporte la sauvegarde JSON, y compris depuis un champ de saisie ; ignoré pendant un chargement, un import ou une sauvegarde protégée. L'annonce « Sauvegarde exportée. » est vocalisée.
- **Repos long** : le bouton « Repos long » du panneau du groupe (désactivé pendant un combat) remet les PJ vivants à leurs PV maximum, sans PV temporaires, ressources au maximum, épuisement −1 et sauvegardes contre la mort à zéro. Un PJ mort reste mort ; une entrée est ajoutée au journal. Le bouton « Repos court » ouvre un dialogue : le MJ saisit les PV récupérés par PJ vivant (les dés de vie restent à sa main).
- **Fin de combat** : le journal reçoit un récapitulatif (rounds, PJ à terre, créatures vaincues, retirés) de l'état final du combat, avec l'XP gagnée.
- **Expérience** : l'XP des créatures vaincues (morts ou à terre, hors alliés et retirés) vient de leur FP selon la table 2014 ; elle est partagée à parts égales, arrondie à l'inférieur, entre les PJ du combat encore en vie. Les créatures au FP inconnu sont signalées et ne rapportent rien. La fiche de chaque PJ affiche son XP, ajustable à la main (0 à 10 000 000).
- **Préparer la session** : le tableau de bord rassemble la scène en cours, les scènes accessibles depuis ses choix, leurs rencontres (badge « À préparer » quand une quantité ou une statistique manque) et les avertissements qui les concernent.
- **Écran des joueurs** : le bouton « Écran des joueurs » de la barre du haut ouvre un second onglet à placer sur une TV ou un second écran. Il montre l'ordre d'initiative, le tour en cours et les PV des PJ ; jamais les PV, CA ni initiative des créatures. Dans une scène, « Montrer aux joueurs » y affiche le texte à lire ; « Effacer l'écran des joueurs » le retire. Rien de ce qui est montré n'est sauvegardé. La synchronisation est locale (même navigateur, même adresse).

## Données et sauvegardes

Les JSON de campagne restent immuables. Seul l'état de partie est conservé dans `localStorage`, sur l'origine du navigateur utilisée. Changer de navigateur, de port ou effacer les données du site change les sauvegardes disponibles. Exporter régulièrement une copie JSON depuis les paramètres.

Un rappel d'export s'affiche après chaque fin de combat, et à l'ouverture lorsque la partie a progressé sans export depuis plus de 7 jours. La date du dernier export est indiquée dans les paramètres ; elle est conservée à part, hors de la sauvegarde.

**Points de restauration** : les 10 derniers états sont gardés à part, par campagne et emplacement, et listés dans les paramètres. Un point est créé automatiquement avant chaque fin de combat, repos court, repos long et import, ainsi qu'avant une restauration ; « Créer un point de restauration » en ajoute un à la main. « Restaurer » demande confirmation et valide l'état comme un import. Ces points restent dans le navigateur : ils ne remplacent pas un export. Si la place manque, les plus anciens sont sacrifiés en premier, jamais la sauvegarde principale.

**Fichier de sauvegarde automatique** (Chrome, Edge et autres navigateurs Chromium) : « Lier un fichier de sauvegarde » choisit un fichier JSON sur le disque ; chaque sauvegarde y est ensuite écrite automatiquement (après 1,5 s de calme) et compte comme un export. Le lien n'est pas mémorisé : il faut relier le fichier à chaque ouverture de l'application. En cas d'échec d'écriture, une alerte s'affiche et le fichier est délié.

L'import est validé avant remplacement. Une sauvegarde invalide doit être signalée ; conserver son export pour diagnostic. Une nouvelle version de format nécessite une migration explicite : ne pas modifier simplement son numéro de version.

Le nettoyage des anciennes démonstrations retire uniquement leurs préférences de sélection explicitement reconnues. Leurs sauvegardes ne sont plus chargées mais restent conservées, car elles peuvent contenir des notes personnelles. Les sauvegardes réelles et les autres données du domaine ne sont jamais effacées par ce nettoyage ; aucun `localStorage.clear()` n'est utilisé.

Voir [l'intégration Stormwreck](docs/stormwreck-integration.md), [le format normalisé des campagnes](docs/campaign-format.md) et [la conception initiale](docs/superpowers/specs/2026-10-23-dashboard-design.md).

## Mettre à jour les sources

Conserver les pages sources, signaler les valeurs illisibles et distinguer les ajouts du MJ. Préférer les résumés structurés à la reproduction du livret. Ne jamais déduire silencieusement une statistique manquante. Une modification des JSON intégrés demande un redémarrage du serveur Vite ou une nouvelle compilation. Un changement d'identifiants peut nécessiter une migration de sauvegarde ; exporter avant toute réinitialisation.

## Structure

- `stormwreck-json/` : sources réelles immuables de cette intégration.
- `tests/fixtures/demo-campaign/` : exemples fictifs réservés aux tests, absents de la production.
- `src/types.ts` : contrats TypeScript.
- `src/services/` : chargement, validation, moteurs et persistance.
- `src/components/` : vues et composants Preact.
- `src/index.css` : thème responsive, focus et mouvement réduit.

Les tests et la compilation constituent la validation technique. Les vérifications navigateur, tactiles et lecteurs d'écran doivent être distinguées des tests unitaires.
