# Périmètre et suite

## Livré en V0.1

- Audit statique des huit dépôts, références épinglées et comparaison des modules communs.
- Moteur indépendant de l’interface, capacités et ressources décrites par données.
- Attaque contre CA, coups critiques, avantage/désavantage, Extra Attack déclaré.
- Dégâts typés R/I/V, PV et PV temporaires, soins plafonnés.
- Action, action bonus, réaction ; rafraîchissement au début du tour du propriétaire.
- Concentration obligatoire, demandes persistantes, incapacité et annulation.
- Reçus persistants, rejet des collisions, transactions atomiques et annulation du dernier changement.
- Corrections justifiées des PV, PV temporaires, ressources et A/B/R.
- Récupération des ressources par repos court/long ; récupération des PV au repos long.
- Modèle versionné, validateur, schéma JSON, migration d’enveloppe, import/export et copie précédente.
- Démo locale et tests automatisés ; CI de tests seulement, aucun workflow de publication.

## Prochain lot : compléter le domaine avant l’interface produit

1. Caractéristiques, maîtrise, compétences, jets de sauvegarde génériques, CA calculée et ajustements, mouvement et états mécaniques.
2. Sorts à sauvegarde, moitié des dégâts, règles d’incantation 2014 (dont sort en action bonus), surincantation, concentration liée aux effets sur plusieurs cibles.
3. Économie avancée : Fougue, Hâte limitée à une attaque avec léthargie, attaques bonus conditionnelles, déclencheurs une fois par tour et entités secondaires.
4. Fenêtres de réaction explicites : déclenchement, offre, réservation, résolution, refus et reprise ; esquives, Bouclier, Contresort et opportunités.
5. Tests de non-régression traduits des six personnages. Ils serviront de fixtures de données indépendantes, sans recopier leurs écrans ou leurs règles maison dans le moteur.

## Lot personnage : kobold barde Glamour 10

- Création guidée, rapide et experte partageant un validateur de construction unique.
- Calcul des caractéristiques et statistiques dérivées, maîtrises/expertises, ressources, choix de sorts et Secrets magiques.
- Extensions personnelles pour la variante précise de kobold et le Collège du Glamour 2014, avec provenance et contenu fournis/autorisés par l’utilisateur.
- Inspiration et Manteau d’inspiration : choix de plusieurs alliés, PV temporaires sans cumul, déplacement offert consommant la réaction de chaque allié ; cas d’intégration prioritaire.
- Manteau de majesté, durée, concentration et incantations répétées ; choix RP et options manuelles documentés.

## Lots ultérieurs

- Importeurs distincts des anciens Companions : rapport des champs inconnus et sauvegarde source intacte.
- IndexedDB et tests navigateur hors ligne ; gestion explicite de la récupération après corruption/quota.
- Adaptateur RPG Connect complet avec négociation, générations, révisions, réservations/outbox, ACK, reprise et annulation distribuée.
- Proposition séparée d’évolution des identifiants dynamiques côté serveur et des bindings Encounter, uniquement après autorisation de toucher ces dépôts.
- Dashboard fonctionnel modulaire puis personnalisation visuelle ; ergonomie Encounter sur iPad.
- Compte facultatif et synchronisation cloud après stabilisation du format et des conflits.

## Limites explicites

V0.1 n’est ni un outil complet de création, ni une implémentation exhaustive de D&D 2014. Pas de catalogue SRD distribué, de build Glamour final, de sélection de cibles par portée, d’initiative automatique, de mort/JS contre la mort/résurrection, de dés de vie, de recharge aléatoire, de durées/expiration, d’inventaire mécanique, d’aura, de concentration partagée complète, de validation de l’éligibilité des réactions ou de connexion serveur réelle.

Le repos est une primitive de récupération à appeler après adjudication : durée, limites quotidiennes, incapacité, épuisement et interruptions ne sont pas automatisés. Les jets explicites sont une entrée d’adaptateur de confiance ; une interface ne devra pas exposer le contexte d’autorité comme une autorisation réseau. L’historique et les reçus restent non compactés ; la limite d’import est de 10 000 000 caractères JavaScript, sans objectif de grande campagne garanti à ce stade.


Correctif pré-merge : concentration déplacée à l’activation avec conditions explicites et compatibilité de lecture des sauvegardes V1 antérieures. Les frontières bibliothèque / définition / runtime / participant / préférences et la stratégie de checkpoint sont détaillées dans `ARCHITECTURE.md`. Les limites de volume et les mesures sur 500 transactions sont dans `HISTORY-MEASUREMENTS.md` ; IndexedDB et l’archivage non destructif restent prioritaires pour V0.2 avant longues sessions en navigateur.
