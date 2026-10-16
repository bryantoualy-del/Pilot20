# Pilot20 — architecture proposée et socle V0.1

Décisions explicitées avant implémentation le 15 octobre 2026. Statut : socle de développement, sans déploiement.

## 1. Frontières

Le moteur ESM JavaScript (`src/engine.js`) ne dépend ni du DOM, ni du stockage, ni du réseau. Il reçoit un document validé et une commande, puis renvoie un nouveau document et un résultat. Le document d’entrée n’est jamais modifié, même si une commande échoue. Pas de framework imposé au futur dashboard.

`src/model.js` définit et valide le modèle, les bornes, identifiants et références. La version des données (`schemaVersion: 1`) est indépendante de la version du logiciel (`0.1.0`). `ruleset: dnd5e-2014` interdit un mélange implicite 2014/2024.

Chaque acteur contient une définition de personnage et son état de jeu. Les définitions comprennent statistiques, défenses, ressources, récupération et capacités. Le runtime contient PV, économie d’action, concentration et demandes de sauvegarde. Dans cette V0.1, la définition est embarquée dans le document pour garder les sauvegardes portables. Le catalogue versionné et les calculs dérivés seront séparés avant le créateur complet.

`layout` réserve les préférences du dashboard, sans effet mécanique. Pas de compte, authentification, serveur ou stockage distant requis. Le moteur et la démo fonctionnent hors ligne après récupération des fichiers.

## 2. Données et capacités

Une capacité déclare son coût (`action`, `bonus`, `reaction`, `none`), sa ressource éventuelle, son ciblage et ses effets. Effets par cible V0.1 : dégâts typés, soin, PV temporaires et attaque contre CA. La concentration appartient à l’activation, pas à la liste des effets par cible. Les formules acceptées sont bornées (`NdS±B`), sans `eval`, script ou expression arbitraire.

`attackAction: true` distingue une attaque faisant partie de l’action Attaquer d’une attaque de sort ou d’une réaction. Extra Attack ne multiplie donc pas automatiquement les sorts d’attaque. Les attaques critiques doublent les dés de dégâts ; le bonus fixe reste unique. Le d20 naturel 1/20 n’a un effet automatique que sur les attaques, pas sur la concentration.

Le moteur consomme des résultats de dés explicites et vérifiés. Le fournisseur aléatoire et l’animation seront des adaptateurs : un résultat doit être enregistré avant affichage/envoi. Les totaux, ressources et dégâts effectifs ne sont pas fournis par le dashboard.

La démo est une fixture de mécanismes, pas un personnage de classe complet. Ses capacités de test ne constituent pas un catalogue D&D. Aucun texte de sort, race ou sous-classe hors SRD n’est repris des anciennes applications.

## 3. Transactions, annulation et sauvegarde

Chaque commande porte un identifiant stable. Le reçu persistant garde son contenu et son résultat : retransmettre ne dépense rien une seconde fois ; réutiliser l’identifiant avec un autre contenu est refusé. Les identifiants annulés restent traités, empêchant une ancienne livraison de rejouer l’action.

L’historique conserve la commande, son résultat et le précédent état mécanique. V0.1 autorise uniquement l’annulation de la dernière transaction. L’annulation restaure ensemble ressources, économie, PV et demandes de concentration ; la révision du document continue de croître. L’annulation ciblée ancienne avec détection de conflits et protocole distribué `prepare/commit/finalize` reste à réaliser.

`src/storage.js` accepte une interface synchrone `getItem/setItem` compatible avec localStorage. L’appelant calcule, sauvegarde, puis publie l’état ; un échec de sauvegarde ne doit pas être présenté comme un succès. Une écriture du document utilise une clé ; la copie précédente valide est conservée séparément. Une copie corrompue n’est jamais remplacée silencieusement. Une lecture de secours signale `recovered: true`, et n’écrit rien. La résolution explicite de la corruption et l’adaptateur IndexedDB transactionnel restent à construire.

L’import vérifie le document avant utilisation et l’export est disponible indépendamment du stockage. La migration V0 → V1 concerne l’enveloppe expérimentale Pilot20 : ajout de `layout`, `history`, `receipts`. Elle ne prétend pas importer les six formats historiques. Les définitions anciennes V1 sont aussi normalisées sur copie : un unique ancien effet `concentration` devient `ability.concentration = {effectId, start: "activation"}`, dans les acteurs courants et les snapshots d’annulation. C’est une lecture rétrocompatible du format V1 ; le schéma décrit la forme canonique exportée. Les conditions anciennes inconnues, doublons et déclarations contradictoires sont refusés. Les reçus, identifiants d’instance et commandes historiques restent inchangés : cette conversion corrige les prochaines activations sans recalculer les résultats passés. Une version future inconnue est refusée. `docs/session-v1.schema.json` décrit la structure ; le validateur runtime ajoute les invariants croisés (bornes dynamiques, références, unicité).

## 4. Concentration et réactions

La concentration est identifiée par effet ET instance d’activation. Après chaque instance de dégâts effective strictement positive, une demande est conservée avec DD `max(10, floor(dégâts / 2))`. Les dégâts absorbés par les PV temporaires comptent. Immunité et zéro dégât ne déclenchent rien. Les composantes d’un même type sont regroupées avant résistance ; les composantes du même coup produisent une seule sauvegarde.

À 0 PV ou en incapacité explicitement signalée, la concentration se termine immédiatement. Une sauvegarde ratée supprime les demandes de cette concentration. V0.1 bloque une nouvelle capacité de cet acteur tant que ses demandes restent à résoudre, sauf remplacement explicite par une concentration démarrant à l’activation ; elle ne bloque pas le démarrage des tours des autres acteurs. L’annulation du coup supprime ses demandes.

Le contrat canonique est `ability.concentration: {effectId, start}` avec `start` obligatoire :

| Règle déclarée | Moment et conditions |
|---|---|
| `activation` | Une fois les coûts et entrées validés, démarre une seule fois, même si l’attaque rate. Remplace l’instance précédente et invalide ses demandes avant les effets sur les cibles. |
| `hit` | Requiert un profil d’attaque. Démarre seulement si cette attaque touche ; sur un raté, l’ancienne concentration reste inchangée. Les demandes anciennes doivent être résolues avant de tenter cette capacité. |

Une capacité conditionnelle ne reçoit pas une règle implicite tirée de son nom ou de ses effets. Les deux règles ci-dessus sont les seules prises en charge ; toute autre condition doit attendre une primitive dédiée et ses tests. Les coûts sont engagés une seule fois, indépendamment du nombre de cibles. Une entrée invalide annule toute la transaction, remplacement compris. L’activation précède les effets : si le lanceur est lui-même blessé, sa nouvelle sauvegarde n’est pas effacée au traitement de la cible suivante. À 0 PV, elle est immédiatement interrompue. L’annulation restaure l’ancienne instance et ses demandes, ainsi que l’action et les ressources.

La réaction peut être consommée hors du tour et revient au début du prochain tour de son propriétaire. V0.1 n’automatise pas encore l’ouverture des fenêtres ni l’éligibilité de portée/visibilité : ces mécanismes nécessitent un ordonnanceur, avant de porter Bouclier, Contresort ou Attaque d’opportunité.

## 5. Autorité et RPG Connect

Trois valeurs sont prévues : `local`, `free`, `encounter`. Local et Libre utilisent le moteur local. En mode Encounter, toute mutation mécanique exige le contexte explicite de l’autorité Encounter ; corrections et autres commandes MJ exigent aussi le rôle MJ. Ce contexte est une dépendance de confiance interne, PAS une authentification réseau : il devra être alimenté par un adaptateur qui valide session, combat, génération, révisions et accusés de réception.

`src/connect.js` contient une sonde de compatibilité et une projection illustrative de demande de soin `heal:request`. Il ne se connecte à aucun serveur et ne modifie aucun état. L’enveloppe est volontairement incomplète pour une session réelle : négociation, `resolutionGeneration`, réservations, outbox, ACK, liaison aux participants et réconciliation restent à implémenter. Aucun statut de compatibilité de bout en bout n’est revendiqué.

Le serveur actuel limite explicitement les identifiants aux six personnages. Le nouveau kobold ne peut pas être invité sans évolution future de RPG Connect ET de la liaison Encounter. Aucun contournement par usurpation d’un identifiant existant. Les transitions Libre ↔ Encounter et la réconciliation après déconnexion ne sont pas livrées en V0.1. Jamais de bascule automatique vers une double autorité.

## 6. Choix différés

JavaScript ESM avec tests natifs Node permet un socle sans dépendance ni étape de compilation ; c’est cohérent avec les références existantes et exécutable dans le futur navigateur. TypeScript et une bibliothèque de schéma pourront être adoptés avant l’élargissement de l’API. Pas de monorepo complexe pour quatre petits modules.

Un futur adaptateur IndexedDB prendra en charge les transactions locales, identifiants UUID indépendants d’un compte, index et outbox. Un service de compte facultatif pourra synchroniser des documents révisés ; on ne synchronisera pas deux autorités de combat par simple « dernière écriture gagnante ». La politique de conflit, le chiffrement et les droits seront décidés lors de ce lot.

Le futur catalogue devra porter source, version et licence par entrée ; un pack officiel SRD 5.1 sera séparé des extensions personnelles. Le kobold et le Collège du Glamour 2014 serviront de premier cas réel d’extension autorisée par l’utilisateur. Ils ne sont pas supposés inclus dans le SRD 5.1.

## 7. Frontières confirmées et séparation V0.2

Aucune bibliothèque ni éditeur permanent n’est ajouté dans ce correctif. Les points suivants sont des décisions de conception pour V0.2, pas des API déjà livrées.

| Objet | Limite V0.1 constatée | Séparation prévue V0.2 |
|---|---|---|
| Bibliothèque de personnages | `createSession` produit une session ; la clé de stockage par défaut contient un seul document. Réutiliser cette clé écraserait une autre session valide. | Un index de `CharacterRecord` indépendants, identifiants stables sans compte ; choix d’un personnage puis création explicite de session. |
| Définition permanente | `actor.definition` est embarqué et recopié dans chaque snapshot d’annulation ; niveau, ressources maximales et capacités sont liés à cette copie. | Définition versionnée à part ; participants épinglés à une révision. Pas d’édition de classe/niveau via une commande de combat. |
| État de jeu | PV, ressources, concentration et économie sont stockés avec la définition. Aucun acte d’édition permanente n’existe dans V0.1. | Runtime séparé, avec état initial de session ; les éventuels PV/ressources conservés entre parties seront enregistrés explicitement sans modifier la définition. |
| Participants | La clé d’acteur est égale à `definition.id` ; deux occurrences du même personnage ne peuvent pas coexister dans une session. | `participantId` distinct de `characterId`, `definitionRevision` et `sessionId`. L’autorité connectée s’applique au participant de la session, pas à toute la bibliothèque. |
| Préférences | `layout` est un objet du document de session, non un ensemble validé de préférences par personnage. Il est volontairement exclu des snapshots mécaniques. | Préférences par `characterId`, stockage indépendant du combat ; une annulation de combat ne change ni thèmes ni panneaux. |
| Maxima et progression | `hp.max` et `definition.maxHp` peuvent différer ; ressources limitées aux maxima embarqués. | Distinguer valeurs de base, modificateurs temporaires et valeurs calculées ; migrer les références lors d’une progression, sans normalisation silencieuse. |

Les tests garantissent l’absence d’alias entre deux sessions créées depuis une même définition, l’isolation par clés explicites de stockage, la persistance des préférences lors d’une annulation et le refus d’un snapshot historique incomplet. Ils ne prétendent pas implémenter le gestionnaire de bibliothèque.

## 8. Croissance, validation et compactage futur

Chaque transaction non annulée garde un snapshot complet de tous les acteurs et de leurs définitions. Les reçus ne sont jamais évincés. La mesure reproductible sur deux scénarios de 500 transactions figure dans `HISTORY-MEASUREMENTS.md`, avec données brutes dans `benchmark-500.json`.

Un défaut de coût de validation a été retiré sans supprimer de données : l’ancien validateur reparcourait le ledger de reçus actuel pour chaque snapshot historique. Le nouveau validateur contrôle le ledger une fois et vérifie chaque snapshot avec ses propres acteurs, acteur actif et tour. La validation des définitions, bornes, demandes, reçus et JSON reste présente. L’exécution, le clonage et la persistance continuent de parcourir un historique croissant ; aucune borne de latence n’est garantie sur iPad.

Stratégie V0.2 proposée :

1. Stocker définitions immuables, état courant, journal et préférences séparément dans IndexedDB ; commit transactionnel de l’état et du reçu avant publication.
2. Produire des checkpoints révisés et conserver une fenêtre explicite d’annulation avec deltas de runtime. Archiver les transactions plus anciennes après écriture et relecture de l’archive ; ne jamais tronquer silencieusement une sauvegarde.
3. Séparer les reçus d’idempotence du journal d’annulation. Conserver durablement l’identifiant de session/époque, l’identifiant de commande, son empreinte et son statut appliqué/annulé. Un reçu annulé reste un tombstone même après archivage du snapshot.
4. Si les résultats complets sont archivés, pouvoir retrouver l’ancien résultat ou rejeter explicitement une commande ancienne ; ne jamais la traiter comme nouvelle. Une purge d’époque réseau exige clôture et accusés de réception, à spécifier avant implémentation.
5. Tester reprise après interruption de compactage, migration, annulation, rejeux anciens et collisions avant d’activer une politique de rétention. Une suppression fondée uniquement sur l’âge ou le nombre de reçus est exclue.

Aucun compactage n’est implémenté ici. En V0.1, un échec de quota est remonté à l’appelant ; l’état proposé ne doit pas être publié. La dernière sauvegarde validée reste lisible. Le seuil d’import/export de 10 000 000 est un nombre de caractères JavaScript, pas une garantie de quota navigateur. Les mesures incluent le coût des deux copies de stockage ; cette limite doit être traitée avant de proposer de longues campagnes en navigateur.

## V0.2b extension

The existing transaction executor delegates P0 validation/runtime helpers to `src/rules/combat.js`. Permanent abilities opt in with versioned declarative profiles; runtime `advanced` holds temporary effects, independent action pools, movement/cast ledgers, source concentration clocks and manual declarations. Snapshots/receipts/CAS remain shared with V0.1/V0.2. See [P0 contracts and authority](V0.2b-P0.md), [twelve-class audit](CLASS-COVERAGE.md) and [deferred rule contracts](RULE-CONTRACTS.md). Decisions after hits, reactions, transformations and summons are contract-only and cannot auto-execute. Full spell legality and consequences must be certified by catalogue compilation rather than inferred from a content reference.
