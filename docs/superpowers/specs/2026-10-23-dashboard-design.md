# Tableau du Maître — conception validée

Application locale française pour le MJ, Vite/Preact/TypeScript strict. Trois couches : données JSON statiques, fonctions métier pures, interface consommant un état partagé. Aucun backend ni contenu officiel reconstitué.

Navigation latérale, contenu central, contexte du groupe masquable. Palette anthracite, cuivre et papier ; commandes tactiles et clavier. Les écrans couvrent campagne, chapitres et scènes non linéaires, personnages, rencontres, bestiaire, journal et paramètres.

Le combat utilise les règles 5e 2014 : PV temporaires avant PV ordinaires, plafonnement des soins, 0 PV distinct de la mort pour les PJ, sauvegardes contre la mort et épuisement 0–6. Les conditions restent soumises à l'arbitrage du MJ. Les PJ référencés en combat partagent leurs valeurs dynamiques avec leur fiche.

Campagne démonstrative explicitement fictive ; quatre chapitres préparés pour les futurs documents. Chaque donnée comporte une provenance. Chargement par manifeste et validation des références. Les choix déclaratifs sont idempotents et réversibles lorsque possible.

Sauvegarde locale versionnée et isolée par campagne. Import validé avant remplacement, export, restauration et réinitialisation confirmée. Les erreurs ne doivent ni écraser une sauvegarde illisible ni bloquer l'interface.

Validation : tests des moteurs, dégâts/soins/PV temporaires, tours/rounds, narration, identifiants d'instances, synchronisation PJ, JSON et persistance ; compilation stricte ; vérification navigateur selon disponibilité. Pas de reproduction du livret, pas de dépendances UI supplémentaires.
