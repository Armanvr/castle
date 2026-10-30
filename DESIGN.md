---
name: Le Grimoire
description: Le pupitre du maître, une interface feutrée et littéraire.
colors:
  charcoal: "#131517"
  panel: "#1c1e20"
  panel-raised: "#222426"
  border: "#303133"
  ivory: "#e8e3da"
  muted: "#969690"
  copper: "#d29a6b"
  sage: "#8da994"
  terracotta: "#d98980"
  primary: "#cf986a"
  primary-hover: "#e3af83"
  primary-text: "#191813"
  control: "#292a29"
  control-hover: "#34332f"
  field: "#17191b"
  nav-selected: "#332b25"
  nav-text: "#e6b083"
  tag: "#2b2e28"
  tag-text: "#afb99f"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.7px"
  headline:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "29px"
    fontWeight: 400
    lineHeight: 1.25
  title:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.25
  body:
    fontFamily: '"Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: '"Segoe UI", sans-serif'
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.12em"
    textTransform: uppercase
  meta:
    fontFamily: '"Segoe UI", sans-serif'
    fontSize: "12px"
    lineHeight: 1.6
  control:
    fontFamily: '"Segoe UI", sans-serif'
    fontSize: "13px"
    lineHeight: 1.4
rounded:
  field: "4px"
  button: "5px"
  panel: "6px"
spacing:
  compact: "6px"
  control-gap: "9px"
  row-gap: "10px"
  section-gap: "20px"
  panel-padding: "23px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.control}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  navigation-selected:
    backgroundColor: "{colors.nav-selected}"
    textColor: "{colors.nav-text}"
    rounded: "{rounded.button}"
    padding: "10px 14px"
  tag:
    backgroundColor: "{colors.tag}"
    textColor: "{colors.tag-text}"
    rounded: "{rounded.field}"
    padding: "3px 7px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.panel}"
    padding: "23px"
---

# Design System: Le Grimoire

## Overview

**Creative North Star: "Le pupitre du maître"**

Le pupitre du maître associe des outils pratiques à une lecture narrative. L’atmosphère est feutrée et littéraire, davantage centrée sur la lecture : titres à empattements, fonds charbon et textes ivoire accompagnent le contenu sans multiplier les effets.

Les composants sont tactiles et affirmés, au service des actions. Les surfaces se distinguent par nuances de charbon et bordures discrètes. Cette documentation décrit l’interface existante ; elle ne constitue pas une refonte ni une validation visuelle en navigateur.

**Key Characteristics:**
- Palette charbon et cuivre, textes ivoire, états sauge et terre cuite.
- Titres narratifs en Georgia et outils compacts en Segoe UI.
- Panneaux bordés, angles légèrement arrondis et actions clairement délimitées.

## Colors

La palette « charbon et cuivre » associe une base sombre peu saturée à une chaleur mesurée. Les valeurs du frontmatter sont normatives ; les nuances contextuelles ci-dessous proviennent de `src/index.css`.

### Primary

Le cuivre sert aux repères éditoriaux, au focus et aux accents. Le bouton principal possède sa propre nuance et un survol plus clair : ne pas confondre automatiquement accent et remplissage d’action.

### Secondary

Le vert sauge accompagne les états positifs. Le rouge terre cuite accompagne les états négatifs ; les actions destructrices utilisent aussi des nuances contextuelles plus sombres.

### Neutral

Le charbon du fond, les panneaux et les surfaces relevées établissent la profondeur. L’ivoire porte le texte principal, le gris les informations secondaires. Les bordures séparent les régions sans contraste lumineux excessif.

## Typography

Les titres utilisent Georgia avec Times New Roman et serif en secours ; le corps et les contrôles utilisent Segoe UI avec sans-serif en secours. Ces polices sont locales, sans téléchargement.

La hiérarchie générale comprend les rôles display, headline et title du frontmatter. Le corps possède une base de 14px avec une hauteur de ligne de 1,6. Trois rôles de petit texte, définis par des variables dans `src/index.css` (`--fs-label`, `--fs-meta`, `--fs-control`), remplacent les tailles ad hoc. Rien ne descend sous 11px, y compris sur petits écrans :
- **label** (11px, 600, 0,12em, capitales) : surtitres, libellés de section, étiquettes de statistiques et de caractéristiques, badges.
- **meta** (12px) : étiquettes, notes de bas de page, horodatages, indications, état de sauvegarde, fil d’Ariane, lignes de détail des cartes, sous-titre de la marque (en gris neutre, en casse de phrase, sur deux lignes équilibrées au plus).
- **control** (13px) : boutons compacts, libellés de champs, entrées de navigation, boutons de dégâts et de soins, prose dense des panneaux (hauteur de ligne 1,7). Les boutons standard conservent les 14px du corps.

Les textes secondaires atteignent au moins 4,5:1 sur leur fond réel ; le gris neutre `muted` est réutilisé de préférence à de nouveaux gris, y compris pour les marqueurs de remplacement des champs. Les titres sont équilibrés (`text-wrap: balance`), les paragraphes ajustés (`pretty`) et les données chiffrées (PV, initiative, caractéristiques, dés) sont tabulaires.

La citation à lire aux joueurs utilise Georgia, 22px et une hauteur de ligne de 1,7 ; les dialogues utilisent Georgia en italique à 17px. Quelques tailles d’affichage ponctuelles (héros, numéro de chapitre, PV du combattant) restent propres à leur composant.

## Layout

Sur ordinateur, la structure comporte une navigation de 228px, un contenu central flexible et un contexte latéral de 282px. Masquer le contexte supprime sa colonne. À partir de 1700px, les colonnes latérales passent à 250px et 320px.

À 1250px et moins, le contexte passe sous le contenu central et la navigation occupe 205px. À 900px et moins, la navigation se réduit à une colonne d’icônes de 76px. À 650px et moins, la structure devient verticale et la navigation est horizontale, avec défilement.

Le contenu central est un conteneur de mise en page : sous 720px de largeur utile, le dashboard et les grilles de fiches passent sur une colonne, les statistiques du dashboard sur deux. Les panneaux narratifs restent pleine largeur ; leur prose et les ajouts du MJ sont limités à 70ch, sans tronquer le texte ni réduire les contrôles. Les champs en ligne et les commandes de PV peuvent se replier ; une rangée étroite d’initiative libère sa troisième colonne quand les commandes passent en dessous. Le bandeau supérieur conserve une hauteur minimale et grandit lorsque ses libellés se replient.

Les panneaux génériques ont un espacement intérieur de 23px et une séparation verticale de 20px. Les rangées d’actions se replient sur plusieurs lignes. Les agencements spécifiques à une page restent propres à cette page ; ne pas en faire une obligation pour tout le produit.

## Elevation & Depth

La profondeur repose sur les différences de teinte et les bordures. Les portraits conservent leurs tons distincts, sans reflet ni ombre décorative. Une ligne interne cuivre (`inset 0 3px var(--copper)`) marque le combattant actif. Les panneaux génériques ne portent pas d’ombre.

## Shapes

Les panneaux ont des angles légèrement arrondis, les boutons un arrondi intermédiaire et les champs et étiquettes un arrondi plus petit, selon le frontmatter. Les bordures courantes mesurent 1px. Les choix narratifs forment des lignes larges à séparateur inférieur et sans arrondi, distinctes des boutons ordinaires.

## Components

### Buttons

Tactiles et affirmés, les boutons ordinaires ont une hauteur minimale de 40px, une bordure et un espacement intérieur défini dans le frontmatter. Le principal utilise le cuivre avec un texte sombre ; le secondaire reste charbon. Le survol change le fond et la bordure en 0,15s. Le focus visible utilise un contour cuivre de 2px décalé de 4px. Un bouton désactivé a une opacité de 0,45 et un curseur indisponible ; ses styles de survol restent inactifs. Les icônes conservent leur taille lorsque leur libellé se replie.

Les actions de danger utilisent un fond `#3a2725`, une bordure `#764c46` et un texte `#edaaa3`. Les boutons textuels restent légers ; ne pas leur imposer le remplissage d’un bouton principal.

### Chips

Les étiquettes sont compactes, sur fond végétal sombre, avec une bordure `#404637`, un texte sauge atténué, une taille meta de 12px et une hauteur de ligne de 1,4. Certaines représentent un état ; d’autres permettent de retirer une condition et sont de vrais boutons.

### Cards / Containers

Les panneaux utilisent le fond, la bordure et l’arrondi du frontmatter. La distinction des surfaces suffit à leur profondeur habituelle. Les cartes spécialisées peuvent adapter l’espacement sans introduire un nouveau système. Les surfaces de soutien (campagne, aperçu de scène, lieu et pense-bête) restent unies ; le dégradé végétal est réservé au texte à lire aux joueurs.

### Inputs / Fields

Les champs utilisent un fond plus sombre que les panneaux, une bordure `#3a3b3b` et les valeurs du frontmatter. Ils héritent de la police des outils, sont limités à la largeur disponible et partagent le focus visible. Les zones de texte se redimensionnent verticalement, avec une hauteur minimale générale de 100px ; les ajouts de scène passent à 120px.

### Navigation

Les entrées ordinaires sont transparentes et alignées à gauche, avec une hauteur minimale de 45px et un texte control de 13px (conservé à 205px et en dessous ; un intitulé long passe à la ligne). L’entrée sélectionnée utilise un fond brun charbon, une bordure `#5b4432` et un texte cuivre clair. Le survol est `#252727`. Le comportement responsive est décrit dans Layout.

### Lecture narrative et jets

L’encadré à lire aux joueurs conserve son dégradé végétal sombre (`linear-gradient(135deg, #292b25, #20251f)`), sa bordure `#484b3b` et un espacement intérieur de 27px 30px. La citation est ivoire chaud (`#e0d9c7`).

Les résultats des dés présentent les valeurs individuelles et le total ; les chiffres sont tabulaires et le total est accentué en cuivre. Les ajouts du MJ conservent les retours à la ligne et un séparateur discret.

Les préférences de mouvement réduit désactivent transitions, animations et défilement animé. Le focus s’applique aussi aux liens et aux résumés dépliables. Ces règles de source ne remplacent pas un contrôle clavier ou lecteur d’écran en situation.

## Do's and Don'ts

### Do:
- Do réutiliser les couleurs et primitives existantes pour prolonger le système.
- Do préserver le focus visible cuivre et la réduction des mouvements.
- Do conserver les différences entre texte narratif, libellés et contrôles.

### Don't:
- Don't remplacer les polices système par une dépendance distante sans décision explicite.
- Don't généraliser les ombres ponctuelles en élévation permanente de toutes les cartes.
- Don't présenter les petites tailles observées comme une conformité d’accessibilité vérifiée.
