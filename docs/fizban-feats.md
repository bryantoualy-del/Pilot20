# Dons draconiques de Fizban — D&D 5e 2014

Source : Fizban’s Treasury of Dragons (2021), p. 17. Données mécaniques structurées et résumés originaux ; aucun texte intégral, PDF ou pack privé distribué. Identifiants stables `fizban:feat:gift-of-the-{chromatic,gem,metallic}-dragon`.

Catalogue unifié par défaut, sans écran Sources ajouté. Les restrictions explicites du MJ continuent de filtrer Fizban. L’option de campagne autorisant les dons reste requise pour remplacer une ASI.

| Capacité | Support dans Pilot20 | Application de combat |
|---|---|---|
| Imprégnation chromatique | Partial : action bonus, 1/repos long | Choisir arme/type à l’activation ; MJ applique 1d4 par touche pendant 60 s |
| Résistance réactive | Partial : réaction, maîtrise/repos long | Une seule instance élémentaire, jamais une résistance permanente |
| Riposte télékinétique | Partial : réaction, maîtrise/repos long, DD dérivé | Après dégâts, attaquant à 10 pieds ; FOR, 2d8 force, moitié sur réussite ; repoussement jusqu’à 10 pieds uniquement sur échec |
| Guérison draconique | Partial : choix INT/SAG/CHA, usage gratuit ou emplacement distinct | N1 gratuit, 1/repos long ; avec emplacement, Nd8 + modificateur choisi ; MJ applique les soins |
| Ailes protectrices | Partial : réaction, maîtrise/repos long, bonus CA dérivé | Touche avant dégâts, soi ou cible visible à 5 pieds, une seule attaque |

Ces capacités utilisent l’exécuteur manuel existant pour payer actions/ressources après déclaration explicite et confirmation des conditions. Les effets, cibles, distances et jets restent validés par le MJ. Aucun handler universel RPG Connect n’est annoncé comme automatique. Les descriptions compilées restent lisibles ; les mécaniques structurées sont dans le catalogue, les choix d’acquisition dans la progression et les ressources/actions dans le Companion Preview.

Le don diamantin ajoute exactement +1 à la caractéristique choisie (plafond 20) et emploie cette même caractéristique pour son DD. Le don métallique conserve un choix **casting-ability** distinct : aucun +1. Soins est un octroi supplémentaire, hors quota de sorts de classe. L’incantation gratuite et les emplacements standards/pacte emploient des routes distinctes et ne se dépensent pas mutuellement.

## Contrat d’intégration progressive

Companion : décide des cibles, choix et confirmations. Bus RPG Connect : transporte commandes/résultats. Encounter : valide fenêtre, distance/vision, économie, sauvegardes, touche, dégâts, PV et effets temporaires.

Les champs `trigger`, `mechanics`, `maximum`, `recovery` et `automation` décrivent chaque capacité. Imprégnation : choix du type à l’activation, durée 60 s, chaque touche. Réactions : fenêtres propres avant dégâts ou après dégâts, effets limités à l’instance. Les compteurs sont dimensionnés au niveau total du personnage, y compris multiclassage. Repos long restaure les ressources. Les déclarations manuelles existantes ont un ID, une résolution explicite, un rejet des répétitions, une sauvegarde JSON et une annulation ; les tests exécutent ce protocole.

Pour une future commande réseau, conserver un commandId/reactionId et parentActionId stables, refuser les conditions invalides sans coût, consommer sur validation/grant et conserver résultat et tombstone d’annulation. Réutiliser les descripteurs défensifs Samoth pour Ailes. Aucun second moteur dans Pilot20, aucune modification Encounter dans cette livraison.

Tests : `tests/fizban-feats.test.js` + suite existante ; contrôles navigateur Chromium/WebKit et largeurs téléphone/iPad en CI. Aucun essai sur appareil physique déclaré.
