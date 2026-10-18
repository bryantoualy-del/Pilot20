# P8 — Historiques et origines supplémentaires

Ce lot prolonge P7 et conserve les identifiants historiques. Il ne prétend pas achever le catalogue du Work 1.

## Fonctionnement livré

- 18 historiques PHB 2014, dont cinq variantes, avec compétences, langues, outils, équipement d’historique et capacités sociales expliquées par des résumés originaux.
- Choix conditionnels du Négociant de guilde ; détection des doublons d’outils et choix de remplacement. Les anciens identifiants de maîtrises restent stables, leurs variantes orthographiques étant comparées par une table d’alias.
- Cinq sous-races PHB : nain des montagnes, elfe des bois, drow, halfelin robuste, gnome des forêts. Source propre, bonus, traits, résistances et magie raciale selon le niveau.
- Dhampire final de Van Richten 2021 : humanoïde, taille, bonus natifs, compétences ancestrales à la création, déplacement et escalade, escalade mains libres au niveau 3, morsure et ressource distincte de renforcement.
- Kobolds Volo 2016 avec errata 2020 et MotM 2022 séparés. Aucun mélange des capacités. Héritage MotM conditionnel : Défiance, Astuce ou Sorcellerie draconique avec choix de caractéristique.
- Résolution des choix d’origine dépendants avant la proposition automatique des ASI, afin de respecter le plafond de 20 dès les premières suggestions.
- Source embarquée d’une sous-race validée aussi lors d’une distribution publique. Les schémas publiés reconnaissent les types race et historique.

Les trois sources raciales ciblées sont disponibles dans les réglages existants ; les préférences d’une campagne ne sont pas modifiées automatiquement.

## Validation

Tests locaux ciblés : 12 tests réussis couvrant notamment 54 combinaisons historique/classe, les paliers du dhampire, les trois héritages MotM, les cinq sous-races, les lanceurs tiers et les sous-classes P6. Le test navigateur du parcours complet de guerrier utilise désormais le Négociant de guilde et ses choix conditionnels. La CI vérifie également les schémas JSON des catalogues et des personnages produits.

Le bilan CI doit être lu sur le commit de cette PR ; son lancement ne constitue pas un succès. Les dépendances Ajv, IndexedDB simulé et Playwright sont installées dans la CI, pas dans l’environnement local de cette session.

## Limites à terminer

- Le changement de lignée en cours de campagne avec héritage conservé d’une ancienne race n’est pas couvert : aucune ancienne vitesse ou compétence n’est inventée. La création initiale de dhampire propose les deux compétences prévues.
- Les alternatives matérielles des variantes d’historique sont décrites, mais ne disposent pas encore toutes d’un sélecteur d’inventaire. L’équipement initial de classe doit être complété dans un lot dédié.
- Les conditions sociales, capacités raciales et effets de combat conservent leurs indications et ressources ; leur résolution complète relève du futur Companion.
- Les autres races, historiques et sous-classes des inventaires ne sont pas déclarés intégrés par ce lot. Les personnages utilisés en test sont synthétiques, pas des reconstitutions certifiées de la Compagnie Créole.
- WebKit Linux ne vaut pas validation Safari sur appareils physiques.
