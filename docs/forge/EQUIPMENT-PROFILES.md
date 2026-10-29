# Forge — profils d’équipement 2014

## Audit

Le catalogue `src/catalog/equipment.js` connaissait les dés, catégories, finesse et maîtrises, mais pas toutes les propriétés de maniement. La Forge exposait les sous-types, propriétés et emplacements en texte libre. Son bouton de profil ajoutait toujours 1d8 tranchants. `weaponCapability` recevait des bonus déjà calculés, sans exploiter la polyvalence. `prepareForgeActor` ajoutait +2 par bouclier et n’utilisait pas les profils d’armure. Le Companion local créait ses sessions sans objets Forge.

## Implémentation

- Catalogue commun enrichi : 37 armes (filet sans dégâts), 12 armures, propriétés, portées métriques, polyvalence, mains, discrétion. Aucun second format d’objet.
- Sous-types contextualisés et recherche ; les choix non martiaux ne génèrent aucun dégât. Alias FR/EN et identifiants historiques résolus en lecture seule.
- Profil automatique via les effets existants `weapon-base` et `forge:base-profile`. Remplacement explicite d’un ancien profil ; pouvoirs, charges, formes et enchantements conservés.
- Bonus standard 0–3, valeurs extraordinaires dans les réglages avancés. Modificateurs d’attaque et de dégâts distincts ; modifications multiples refusées atomiquement.
- Propriétés et emplacements par cases à cocher, ajout homebrew unitaire. Paramètres physiques et effets détaillés repliés. Simulation facultative, avec maniement sélectionnable.
- Au démarrage de session : caractéristiques effectives du personnage, maîtrise, finesse, bonus magique, polyvalence, CA d’armure et bouclier. Les décisions de caractéristique peuvent être spécifiques à chaque objet, notamment Charisme pour une aptitude autorisée.
- Companion : sélection des objets Forge pour la prochaine session, harmonisation explicite, mains et caractéristique. Remplacement du matériel ordinaire de même type sur une copie du personnage ; les actions compilées sont affichées depuis le moteur de session. Les sessions existantes restent épinglées à leur définition.

## Validations et références

Les fiches fournies de Brack, Kentaro, Rufus et Zéphyr ont été extraites et comparées au catalogue CC. PyroMerlin est décrit en 1d10 dans sa fiche : cet ancien JSON est conservé ; une sélection explicite du profil standard propose 1d8 / 1d10. Kane et Hexen conservent leurs pouvoirs. Les anciens JSON du catalogue CC sont testés en aller-retour sans mutation.

Les tests `forge-equipment.test.mjs` couvrent tous les sous-types, bonus, dégâts additionnels, finesse, maîtrise, Charisme, polyvalence, deux mains, armures, boucliers, objet merveilleux sans dégâts, anciens objets et passage jusqu’au runtime Companion. Les tests Forge existants couvrent aussi les réserves atomiques, réactions, déclencheurs et synchronisation Encounter. Le parcours E2E Forge vérifie maintenant la sélection du marteau et les largeurs 1180/390/375.

Un ancien test du catalogue étendu a été mis à jour : l’ajout des sept sorts de Fizban sur main avait porté le catalogue de 477 à 484 références (165 non-SRD).

## Limites explicites

- Le sélecteur Companion concerne les sessions locales ; il ne constitue pas encore un inventaire permanent d’objets Forge sur la fiche. Les paramètres de sélection ne sont pas persistés, les sessions créées le sont.
- Les capacités avec géométrie, conditions narratives ou sorts non exécutables restent signalées par les diagnostics existants. Le choix du Charisme doit être justifié par l’aptitude ou une décision du MJ.
- Les propriétés de portée, munitions et chargement sont structurées. Le contrat peut refuser un contexte explicitement hors portée, sans munition ou ayant déjà utilisé le chargement ; la session locale ne possède pas encore de suivi géométrique ou de stock de munitions. Leur contrôle à chaque attaque et le désavantage de longue portée restent à arbitrer.
- La Force minimale et le désavantage en Discrétion sont transmis dans le profil et signalés ; les conséquences de déplacement propres aux races/classes demandent encore un arbitrage. Les armes à propriété spéciale (filet, lance d’arçon) ne sont pas déclarées automatiquement exécutables.
- Le service de navigateur a refusé l’accès à l’aperçu local : aucune validation visuelle iPad/iPhone n’est revendiquée. Les tests E2E mis à jour doivent passer dans GitHub Actions avant fusion.
