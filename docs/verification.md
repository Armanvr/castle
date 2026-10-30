# Vérification de la première version

Ce document conserve les résultats historiques. Pour le comportement actuel, voir [le passage à la campagne réelle uniquement](real-campaign-cleanup.md).

Vérifications finales le 23 octobre 2026 :
- `npm test` : 15 tests réussis, aucun échec.
- `npm run build` : TypeScript strict et compilation Vite réussis.
- `npm run lint` : code de sortie 0, aucune erreur ; 153 avertissements et 4 informations restent présents, notamment assertions non nulles, spécificité CSS et configuration Biome dépréciée.

Les tests couvrent dégâts, soins, PV temporaires, sauvegardes contre la mort et dégâts massifs, conditions, rounds, départage stable, retrait des participants, PV partagés des PJ, effets narratifs et annulation, références JSON, sauvegardes corrompues, isolation des emplacements, import/export et conservation des statuts après un retrait.

La revue a également vérifié les confirmations, l'ordre initial d'initiative, la conservation des participants retirés lors du départage, l'affichage des objets acquis, les libellés de caractéristiques et les types de participants.

## Limites de vérification

Le démarrage du serveur local échoue dans cet environnement avec `listen EPERM` sur `127.0.0.1:5173`. `agent-browser` ne peut pas créer son socket sous `/Users/nebula/.agent-browser`. Aucun résultat visuel, tactile, responsive réel ou de lecteur d'écran n'est donc revendiqué. La revue du code et les diagnostics d'accessibilité statiques ne remplacent pas ces vérifications.

La campagne fournie est une démonstration fictive. La fidélité au livret et aux fiches réelles sera vérifiable uniquement après réception des documents.

## Intégration ultérieure des données réelles

Les résultats ci-dessus décrivent le socle initial. L'intégration de `stormwreck-json/` a depuis été vérifiée avec 24 tests réussis, une compilation TypeScript/Vite réussie et un lint sans erreur (216 avertissements). Les 12 JSON originaux ont conservé leurs empreintes SHA256. Voir [le rapport d'intégration](stormwreck-integration.md) pour les données connectées et les limites des sources, notamment D6 absent, profils partiels, quantités et récompenses à confirmer.

## Nettoyage de la production : campagne réelle uniquement

- `npm test` : **30 tests réussis**, aucun échec. Les tests métier historiques et d'intégration sont conservés ; six régressions vérifient le nettoyage et les événements réels.
- `npm run build` : compilation TypeScript/Vite réussie.
- `npm run lint` : code de sortie 0, aucune erreur, 217 avertissements et huit informations (notamment assertions non nulles, styles et configuration dépréciée).
- Recherche après compilation dans `src/`, `public/` et `dist/` : aucun ancien nom de PJ/PNJ fictif, identifiant de scène/monstre/rencontre/objet de démonstration ni import de fixtures. Les seules références techniques restantes concernent la compatibilité des types et le nettoyage des anciennes préférences.
- `public/` ne contient plus de fichiers. Les 11 JSON fictifs sont uniquement sous `tests/fixtures/demo-campaign/`, hors du build.
- Les 12 empreintes SHA256 des JSON de `stormwreck-json/` sont inchangées.

La revue a vérifié le démarrage réel, les emplacements, les PJ personnalisés, les états vides, l'import/export et la protection des sauvegardes corrompues. Toutes les anciennes sauvegardes sont conservées ; seules les deux préférences exactes de démonstration sont nettoyées. Voir [le détail du nettoyage](real-campaign-cleanup.md).

Le navigateur, les interactions tactiles et le rendu responsive réel restent non vérifiés dans cet environnement, où les essais précédents de serveur local échouaient avec `listen EPERM`. Les lacunes des sources ne sont pas comblées par des valeurs inventées.
