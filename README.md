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

## Données et sauvegardes

Les JSON de campagne restent immuables. Seul l'état de partie est conservé dans `localStorage`, sur l'origine du navigateur utilisée. Changer de navigateur, de port ou effacer les données du site change les sauvegardes disponibles. Exporter régulièrement une copie JSON depuis les paramètres.

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
