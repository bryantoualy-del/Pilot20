# Pilot20 — architecture proposée et socle V0.1

Décisions explicitées avant implémentation le 15 octobre 2026. Statut : socle de développement, sans déploiement.

## 1. Frontières

Le moteur ESM JavaScript (`src/engine.js`) ne dépend ni du DOM, ni du stockage, ni du réseau. Il reçoit un document validé et une commande, puis renvoie un nouveau document et un résultat. Le document d’entrée n’est jamais modifié, même si une commande échoue. Pas de framework imposé au futur dashboard.

`src/model.js` définit et valide le modèle, les bornes, identifiants et références. La version des données (`schemaVersion: 1`) est indépendante de la version du logiciel (`0.1.0`). `ruleset: dnd5e-2014` interdit un mélange implicite 2014/2024.

Chaque acteur contient une définition de personnage et son état de jeu. Les définitions comprennent statistiques, défenses, ressources, récupération et capacités. Le runtime contient PV, économie d’action, concentration et demandes de sauvegarde. Dans cette V0.1, la définition est embarquée dans le document pour garder les sauvegardes portables. Le catalogue versionné et les calculs dérivés seront séparés avant le créateur complet.

`layout` réserve les préférences du dashboard, sans effet mécanique. Pas de compte, authentification, serveur ou stockage distant requis. Le moteur et la démo fonctionnent hors ligne après récupération des fichiers.

## 2. Données et capacités

Une capacité déclare son coût (`action`, `bonus`, `reaction`, `none`), sa ressource éventuelle, son ciblage et ses effets. Primitives V0.1 : dégâts typés, soin, PV temporaires, concentration et attaque contre CA. Les formules acceptées sont bornées (`NdS±B`), sans `eval`, script ou expression arbitraire.

`attackAction: true` distingue une attaque faisant partie de l’action Attaquer d’une attaque de sort ou d’une réaction. Extra Attack ne multiplie donc pas automatiquement les sorts d’attaque. Les attaques critiques doublent les dés de dégâts ; le bonus fixe reste unique. Le d20 naturel 1/20 n’a un effet automatique que sur les attaques, pas sur la concentration.

Le moteur consomme des résultats de dés explicites et vérifiés. Le fournisseur aléatoire et l’animation seront des adaptateurs : un résultat doit être enregistré avant affichage/envoi. Les totaux, ressources et dégâts effectifs ne sont pas fournis par le dashboard.

La démo est une fixture de mécanismes, pas un personnage de classe complet. Ses capacités de test ne constituent pas un catalogue D&D. Aucun texte de sort, race ou sous-classe hors SRD n’est repris des anciennes applications.

## 3. Transactions, annulation et sauvegarde

Chaque commande porte un identifiant stable. Le reçu persistant garde son contenu et son résultat : retransmettre ne dépense rien une seconde fois ; réutiliser l’identifiant avec un autre contenu est refusé. Les identifiants annulés restent traités, empêchant une ancienne livraison de rejouer l’action.

L’historique conserve la commande, son résultat et le précédent état mécanique. V0.1 autorise uniquement l’annulation de la dernière transaction. L’annulation restaure ensemble ressources, économie, PV et demandes de concentration ; la révision du document continue de croître. L’annulation ciblée ancienne avec détection de conflits et protocole distribué `prepare/commit/finalize` reste à réaliser.

`src/storage.js` accepte une interface synchrone `getItem/setItem` compatible avec localStorage. L’appelant calcule, sauvegarde, puis publie l’état ; un échec de sauvegarde ne doit pas être présenté comme un succès. Une écriture du document utilise une clé ; la copie précédente valide est conservée séparément. Une copie corrompue n’est jamais remplacée silencieusement. Une lecture de secours signale `recovered: true`, et n’écrit rien. La résolution explicite de la corruption et l’adaptateur IndexedDB transactionnel restent à construire.

L’import vérifie le document avant utilisation et l’export est disponible indépendamment du stockage. La seule migration V0 → V1 concerne l’enveloppe expérimentale Pilot20 : ajout de `layout`, `history`, `receipts`. Elle ne prétend pas importer les six formats historiques. Une version future inconnue est refusée. `docs/session-v1.schema.json` décrit la structure ; le validateur runtime ajoute les invariants croisés (bornes dynamiques, références, unicité).

## 4. Concentration et réactions

La concentration est identifiée par effet ET instance d’activation. Après chaque instance de dégâts effective strictement positive, une demande est conservée avec DD `max(10, floor(dégâts / 2))`. Les dégâts absorbés par les PV temporaires comptent. Immunité et zéro dégât ne déclenchent rien. Les composantes d’un même type sont regroupées avant résistance ; les composantes du même coup produisent une seule sauvegarde.

À 0 PV ou en incapacité explicitement signalée, la concentration se termine immédiatement. Une sauvegarde ratée supprime les demandes de cette concentration. V0.1 bloque une nouvelle capacité de cet acteur tant que ses demandes restent à résoudre ; elle ne bloque pas le démarrage des tours des autres acteurs. L’annulation du coup supprime ses demandes.

La réaction peut être consommée hors du tour et revient au début du prochain tour de son propriétaire. V0.1 n’automatise pas encore l’ouverture des fenêtres ni l’éligibilité de portée/visibilité : ces mécanismes nécessitent un ordonnanceur, avant de porter Bouclier, Contresort ou Attaque d’opportunité.

## 5. Autorité et RPG Connect

Trois valeurs sont prévues : `local`, `free`, `encounter`. Local et Libre utilisent le moteur local. En mode Encounter, toute mutation mécanique exige le contexte explicite de l’autorité Encounter ; corrections et autres commandes MJ exigent aussi le rôle MJ. Ce contexte est une dépendance de confiance interne, PAS une authentification réseau : il devra être alimenté par un adaptateur qui valide session, combat, génération, révisions et accusés de réception.

`src/connect.js` contient une sonde de compatibilité et une projection illustrative de demande de soin `heal:request`. Il ne se connecte à aucun serveur et ne modifie aucun état. L’enveloppe est volontairement incomplète pour une session réelle : négociation, `resolutionGeneration`, réservations, outbox, ACK, liaison aux participants et réconciliation restent à implémenter. Aucun statut de compatibilité de bout en bout n’est revendiqué.

Le serveur actuel limite explicitement les identifiants aux six personnages. Le nouveau kobold ne peut pas être invité sans évolution future de RPG Connect ET de la liaison Encounter. Aucun contournement par usurpation d’un identifiant existant. Les transitions Libre ↔ Encounter et la réconciliation après déconnexion ne sont pas livrées en V0.1. Jamais de bascule automatique vers une double autorité.

## 6. Choix différés

JavaScript ESM avec tests natifs Node permet un socle sans dépendance ni étape de compilation ; c’est cohérent avec les références existantes et exécutable dans le futur navigateur. TypeScript et une bibliothèque de schéma pourront être adoptés avant l’élargissement de l’API. Pas de monorepo complexe pour quatre petits modules.

Un futur adaptateur IndexedDB prendra en charge les transactions locales, identifiants UUID indépendants d’un compte, index et outbox. Un service de compte facultatif pourra synchroniser des documents révisés ; on ne synchronisera pas deux autorités de combat par simple « dernière écriture gagnante ». La politique de conflit, le chiffrement et les droits seront décidés lors de ce lot.

Le futur catalogue devra porter source, version et licence par entrée ; un pack officiel SRD 5.1 sera séparé des extensions personnelles. Le kobold et le Collège du Glamour 2014 serviront de premier cas réel d’extension autorisée par l’utilisateur. Ils ne sont pas supposés inclus dans le SRD 5.1.
