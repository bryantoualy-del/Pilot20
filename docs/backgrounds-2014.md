# Catalogue des historiques D&D 2014

Périmètre : liste officielle du Character Builder AideDD, plus Agent de maison d’Eberron (Rising from the Last War, 2019). Comparaison réalisée le 21 octobre 2026. Cela ne prétend pas couvrir tous les historiques de tous les livres D&D.

Avant : 18 entrées PHB/SRD, soit 13 historiques et 5 variantes. Après : **30 entrées, soit 25 historiques et 5 variantes**. Aucun changement d’identifiant ancien, aucune migration IndexedDB. Le catalogue livré avec l’application est distinct des personnages sauvegardés.

| Source | Entrées | Ajouts |
|---|---:|---|
| SRD 5.1 | 1 | Acolyte existant |
| Manuel des joueurs 2014 | 17 | Existants, dont 5 variantes |
| Guide des aventuriers de la Côte des Épées | 4 | Agent de faction, Chasseur de primes urbain, Grand voyageur, Mercenaire vétéran |
| Curse of Strahd | 1 | Hanté, avec errata : deux langues dont une exotique, 1 pa |
| Tomb of Annihilation | 2 | Anthropologue, Archéologue |
| Glory of the Giants | 2 | Gigantin, Ciseleur de runes et dons accordés |
| Planescape 2023 | 2 | Gardien des portails, Philosophe planaire et don Scion des plans extérieurs |
| Eberron 2019 | 1 | Agent de maison : choix parmi 13 maisons |

Les variantes Espion, Gladiateur, Négociant de guilde, Chevalier et Pirate gardent leur ID et sont reliées à leur historique de base. Les spécialités Infanterie et Arnaqueur sont recherchables et sélectionnables, sans dupliquer Soldat ou Criminel. Aucun bonus de caractéristique d’historique 2024.

## Compagnie Créole

| Fiche | Sélection |
|---|---|
| Brack — Infanterie | Soldat, spécialité Infanterie |
| Nans — Sauvageon | Sauvageon |
| Zéphyr — Acolyte | Acolyte |
| Rufus — Arnaqueur | Criminel, spécialité Arnaqueur |
| Samoth — Hanté | Hanté |
| Kentaro — Grand Voyageur | Grand voyageur |

Les six libellés ont été vérifiés sur les fiches fournies. Ce test couvre les historiques, pas une reconstruction intégrale des six personnages.

## Fonctionnement et limites

- Recherche sans accents par nom FR/EN, source, alias et spécialité ; filtre lisible par source.
- Les restrictions de campagne existantes restent souveraines ; désactiver une source invalide le choix sans effacer le personnage. Sans restrictions MJ, tous les contenus installés restent visibles, conformément au fonctionnement existant.
- Les dons de Bigby sont accordés sans consommer une ASI. Le don planaire applique résistance, sort mineur et caractéristique d’incantation au choix. Les conditions de campagne Planescape et les pouvoirs narratifs restent à arbitrer par le MJ.
- L’équipement est intégré au parcours existant ; Hanté conserve ses 10 pièces de cuivre, et non 10 po. Les objets narratifs restent des objets descriptifs, sans prix ou statistiques inventés.
- Le sur-mesure est conservé. Les textes sont des synthèses originales ; pas de copie des tables de personnalités des ouvrages.
- Captif, Idiot du village et Voyageur du concours AideDD sont exclus du catalogue officiel. Grand voyageur est bien une autre entrée officielle.
- Eberron Forge of the Artificer et les historiques des règles 2024 ne sont pas inclus. Tasha et Xanathar ne sont pas attribués artificiellement comme sources de ces ajouts.

## Références de vérification

- [Liste du créateur AideDD](https://www.aidedd.org/dnd-builder/index.php)
- [Règles 2014 des historiques](https://www.aidedd.org/regles/historiques/)
- [Hanté et errata](https://www.aidedd.org/regles/historiques/hante/)
- [Présentation officielle Planescape](https://www.dndbeyond.com/posts/1580-preview-planescape-character-options-for-your)
- Chaque entrée porte sa référence au livre officiel. Les maîtrises et équipements ont aussi été recoupés avec les fiches de référence du wiki DND 5th Edition (rubriques backgrounds Far Traveler, Faction Agent, Urban Bounty Hunter, Mercenary Veteran, Anthropologist, Archaeologist, House Agent, Giant Foundling, Rune Carver, Gate Warden, Planar Philosopher).

## Validation

`tests/backgrounds-2014.test.js` vérifie le décompte, la validation publique, la compilation guerrier/roublard, les six correspondances CC, les 13 maisons, l’errata Hanté, les dons, toutes les infusions planaires, la désactivation de source et les anciens identifiants.

`e2e/backgrounds-2014.mjs` vérifie le sélecteur réel aux largeurs 390 et 1180 px dans Chromium et WebKit via la CI.
