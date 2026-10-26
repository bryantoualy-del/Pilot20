# PR #92 — résolution Forge dans le moteur existant

## Verdict

Livraison de code et de tests sur `feat/forge-cc-runtime-automation`, sans fusion. **Le critère « tous les objets CC exécutables dans Encounter live sans calcul manuel » n’est pas atteint.** Aucun inventaire ne reçoit une certification « full auto ».

Le planificateur initial de #92 ne faisait qu’énumérer des effets. Il est désormais utilisé par `src/engine.js` : effets, dépenses, historique et reçu sont validés dans une même transaction. Le protocole live des applications historiques reste distinct de ce moteur Pilot20. Ce rapport ne confond pas ces deux niveaux d’intégration.

## Modifications livrées

- `triggerAbility` : commande autoritaire vers une capacité épinglée, contrôle du propriétaire, du tour, de la cible et des faits de portée/hostilité. Le client ne fournit ni nouvelle capacité ni historique de touches. Les touches des deux armes viennent de l’historique des attaques réellement résolues.
- Reçus de fréquence stockés avec le résultat par la persistance existante. Répétition sous le même ID, nouvel ID transport, sauvegarde/rechargement et écritures concurrentes testés. Une panne de stockage n’applique ni dégâts ni reçu.
- Fréquences par événement, attaque, tour, cible, cible/tour et repos. La clé structurée inclut la cible pour les événements collectifs ; les identifiants manquants ne sont pas remplacés par une valeur implicite.
- Événements reconnus : attaque déclarée/réussie/ratée/critique, dégâts reçus, limites de tour, zone, forme, réaction, repos court/long et récupération quotidienne. **La reconnaissance n’est pas un abonnement réseau ni une horloge.** L’hôte doit émettre l’événement autoritaire.
- Une capacité automatique résolue hors tour n’utilise pas l’action du porteur. Une activation volontaire continue de passer par l’économie d’action existante. Les attaques d’arme partagent maintenant le budget d’Attaque existant (`attackAction`) au lieu de consommer une action par jet.
- Formes : groupe exclusif, dépense d’action bonus, bonus de CA et accès aux profils d’attaque mis à jour ensemble. Les définitions épinglées ne sont pas mutées. L’état de forme est sérialisable et bénéficie du système d’annulation existant.
- États pris en charge dans le compilateur : incapacité, impossibilité de déplacement, désavantage de prochaine attaque, marque donnant l’avantage uniquement à sa source. Le désavantage est consommé même sur une attaque ratée ; la marque s’efface à sa limite de tour.
- `recoverResource` : formule épinglée, dés contrôlés, plafonnement et reçu de période. Événements explicites aube/crépuscule/repos court/repos long ; aucune récupération quotidienne non datée n’est inventée.
- Références de sorts : un contrat **déjà compilé et automatique** peut être fourni par l’hôte. Le moteur existant conserve ses règles, applique le DD d’objet et consomme les charges sans emplacement. Ce mécanisme ne transforme pas un nom de sort ou un texte descriptif en résolution.
- `prepareForgeActor` prépare les contributions et capacités admissibles avant création du combat. `createCombat` l’utilise lorsque le participant fournit `forgeItems` et confirme des statistiques de base excluant ces objets (`forgeBaseStatistics: true`). Réserves nommées par instance, bonus d’armes séparés, protections identiques non cumulées et refus de plusieurs boucliers.
- Les contrats partiels portent désormais leurs limitations dans `combat.requirements` : l’exécution réelle les refuse. Le simulateur ne libère ces exigences que dans sa copie isolée, avec les omissions toujours affichées. `itemSource` ne présente plus un pouvoir partiel comme disponible à l’exécution.
- Résultats de déclenchement transmis par la frontière de présentation existante ; aucun reçu privé exposé, aucun effet visuel doublé lors d’une répétition.

Le schéma JSON des objets magiques n’a pas changé. Le contrat de combat existant reçoit des extensions additives (`trigger`, `form`, `requiredForm`, `recharge`, état `forms`) ; pas de second moteur de dégâts.

## Utilisation et limites du raccordement

1. La Forge et le catalogue conservent les définitions originales.
2. L’hôte fournit les instances équipées et des statistiques de personnage sans ces contributions à `prepareForgeActor` / `createCombat`.
3. Les actions installées sont les contrats exécutables du moteur actuel. Les diagnostics des éléments non installés restent disponibles via `prepareForgeActor`.
4. L’autorité appelle `execute`/`combatRepository.commit` avec son événement validé, une révision attendue, et les dés. Le moteur calcule les conséquences et le stockage arbitre les écritures concurrentes.
5. L’application consomme `transactionView`, jamais l’état privé brut.

`web/app/companion.js` n’est pas converti en client réseau et n’offre pas encore de sélection d’équipement Forge. Le raccordement à `createCombat` est une API testable, pas la preuve d’un parcours UI équipé et connecté.

Les sources actuelles d’Encounter et RPG Connect transportent les protocoles historiques (`effect:request`, transactions de réaction, sauvegardes et commandes spécifiques aux personnages). Elles n’exposent pas de récepteur universel des contrats Forge épinglés. `forgeConnectionReadiness` refuse donc de déduire cette capacité du seul handshake historique. `forge-runtime-v1` est une capacité requise pour une intégration future, **non annoncée ni déployée ici**.

Pour fermer ce blocage, il reste à intégrer la réception des intentions, les références de versions/instances, la réservation/ACK, les événements autoritaires et la réconciliation dans Encounter/RPG Connect, puis relier l’inventaire du Compagnon. Faire seulement un nouvel envoi `effect:request` avec des dégâts prétendument résolus contournerait ces garanties. Aucun événement n’a été envoyé aux parties en cours.

## État des objets prioritaires

| Cas | Validation réelle | Limites conservées |
|---|---|---|
| PyroMerlin | Profil +2 et dégâts de feu existants ; aura générique 2d6 résolue hors tour avec défense et reçu ; souffle calculé dans le simulateur | L’aura du catalogue garde sa condition de contact manuelle ; son binding n’est pas installé automatiquement. Géométrie du souffle et émission d’événements live absentes. Moment de récupération et contrecoup à préciser |
| Kane | Bonus d’objet +1 séparé des totaux de classe | Type/activation des 2d6 non établis ; aucune inférence à partir de « ardente » |
| Solinar / Sélhane | Primitive de prochaine attaque et sauvegardes du moteur testées | Bonus d’objet, type du d8, déclencheur des sauvegardes, succès, fin d’aveuglement à confirmer. Aveuglement complet non implémenté (vision et tests associés) |
| Sceau d’éclipse | Deux attaques réellement réussies sur la même cible au tour du porteur ; dégâts radiants/psychiques et marque à source unique ; expiration testée | Scénario moteur avec capacités épinglées explicites. L’entrée de catalogue reste descriptive ; pas de migration silencieuse en troisième objet équipé ni de raccordement live |
| Volto-Fendoir | Épée+bouclier et hache exclusives, changement bonus, CA18/16 depuis base16 et bonus2, profils de dégâts distincts | Le test lève explicitement l’incertitude d’harmonisation **dans une copie de test seulement**. Le catalogue inchangé reste bloqué sur cette incertitude. Finesse/bonus de personnage fournis par l’hôte |
| Hexen Blade | +1, 5 charges, 1d4+1 à l’aube ; récupération persistée et plafonnée | Déguisement, Image miroir et Motif hypnotique ne possèdent pas ici de résolution complète liée à leur référence ; pas déclarés automatiques |
| Samoth | Profil PDF et conflit Companion conservés ; mécanisme générique de sort d’objet testé sur contrat explicite | 10 / 1d6+4 contre 8 / 1d4+2 : pas d’arbitrage trouvé. Pouvoirs, +1 magique, Fiole sanguine et restrictions de métamagie doivent être raccordés par contrats validés |
| Zéphyr | Bouclier normal +2 et enchantement +3 séparés ; Force25 calculée comme contribution isolée existante | Recalcul complet de personnage depuis Force25 non raccordé dans ce chargement. Ancre : attribution, déclenchement et moment de réaction non tranchés ; pas de duplication des capacités de paladin |

L’[inventaire complet](validation/CC-INVENTORY.md) couvre les 54 objets/références, accessoires et protections compris. La [matrice](validation/CC-MATRIX.md) distingue les contributions isolées, les simulations partielles et les scénarios du moteur. Les scénarios ajoutés ne valent pas certification des entrées incomplètes du catalogue.

## Arbitrages nécessaires du MD

- Bâton de Samoth : quelle version fait autorité, et quels pouvoirs exacts/bonus doivent l’accompagner ? Le PDF fourni confirme 10 charges / 1d6+4 ; le code Companion actuel utilise 8 / 1d4+2. Aucune décision durable identifiée entre les deux.
- PyroMerlin : événement de récupération quotidienne ; déclencheur exact du contrecoup et interaction avec la résistance. Le contact doit rester un fait autoritaire du MJ tant qu’il n’existe pas de géométrie fiable.
- Kane : type et activation du supplément de dégâts.
- Solinar/Sélhane : profils d’arme et bonus d’objet, déclenchement des JdS, absence d’effet en réussite à confirmer, borne précise de l’aveuglement.
- Volto-Fendoir : harmonisation requise ou non et attribution du +1 figurant dans la décomposition d’attaque. L’action bonus et l’exclusivité sont déjà confirmées ; elles ne sont pas remises en question.
- Ancre sacrée : capacité personnelle ou équipement, réaction lors de l’attaque choisie ou activation préalable, et événement quotidien de récupération. Ne pas attribuer automatiquement un coût de réaction absent de la preuve PDF.
- Les autres incertitudes de source restent détaillées objet par objet dans l’inventaire.

## Limitations techniques restantes

- Pas de calcul automatique de géométrie/visibilité, ni abonnement live aux événements. La portée et l’hostilité ne sont jamais déduites d’un nom d’objet.
- Une fenêtre réactive ouverte pendant `triggerAbility` fait échouer la transaction entière, plutôt que de publier un effet partiel sans reçu. L’enchaînement avec les fenêtres de réaction reste à finaliser.
- Corrélation des lames actuellement depuis les attaques directes terminées ; les attaques terminées via continuation réactive ne sont pas encore indexées par ce pont.
- Pas d’ordonnanceur quotidien réseau. L’autorité fournit l’identifiant stable de période ; un client ne peut pas se déclarer une nouvelle aube.
- Plusieurs réserves simultanées, coûts différés, conséquences de dernière charge, transformations complexes, défenses temporaires et invocations restent diagnostiqués comme partiels.
- Une définition d’objet incomplète reste incomplète même si un scénario synthétique prouve les primitives nécessaires.
- Les anciens Compagnons ne sont pas migrés et leurs inventaires stockés sur les appareils ne sont pas accessibles ici.

## Tests et appareils

Résultats détaillés consignés dans `validation/PR92-TESTS.md`. Les captures historiques de #91 ne sont pas réutilisées comme preuve visuelle de #92. L’installation locale de Chromium échoue avec une archive téléchargée invalide ; le parcours E2E ne peut pas démarrer dans cet environnement. Aucun test sur matériel iPad/iPhone physique.
