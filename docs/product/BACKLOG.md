# Pilot20 — Backlog produit priorisé après audit du 17/10/2026

**Statut : proposition, aucun développement engagé.** Les histoires/titres visés sont ceux de **D&D 2014**. Source UX de référence : **AideDD 2014**. Ce backlog ne doit être exécuté qu'après revue de [la charte](PRODUCT-CHARTER.md) et des [preuves d'audit](AUDIT-2026-10-17.md). Les critères d'acceptation prévalent sur un nombre de commits/tests.

## Séquence recommandée et dépendances

| Ordre / priorité | Lot isolable en PR | Problème actuel | Critères d'acceptation (Definition of Done) | Dépendance |
| --- | --- | --- | --- | --- |
| **0 — P0** | **Gouvernance / vérité de couverture** | Des noms/illustrations sont confondus avec des règles fonctionnelles | Statuts affichables « disponible / seulement référencé / partiel / manuel / non installé », matrice régénérée en CI, preuves liées aux entrées, docs cohérents. **Aucun faux nombre de races/sous-classes automatisées.** | Accord charte |
| **1 — P0** | **Glossaire FR/EN et pipeline i18n** | 323 noms bruts du catalogue classes et 319 sorts sont des alias anglais, des descriptions anglaises subsistent | Mesure explicite par item : `fr_verified` au lieu d'un champ `name.fr` factice ; aucune chaîne EN non signalée en mode FR ; noms des 12 classes, 12 sous-classes, 319 sorts SRD et capacités de premier lot audités ; suite de tests de repli, accents, recherche, longues chaînes. La traduction intégrale des 319 **descriptions** doit avoir un périmètre/licence et une passe éditoriale dédiés ; elle n'est pas réputée achevée par la correction des noms. | 0 |
| **2 — P0** | **Historiques 2014, choix et aptitudes** | Acolyte seul ; 14 historiques du builder AideDD absents | Galerie claire des 15 historiques visibles sur AideDD ; pour chaque entrée réellement jouable : compétences, langues/outils, équipement, trait narratif, provenance, personnalisation. Tests de doublons, sauvegarde, impact caractéristiques/compétences et reprise. Statut explicite pour contenus non autorisés/non installés plutôt que faux détails. | 0, 1 |
| **3 — P0** | **Sous-classes : disponibilité et priorités** | Seules les 12 SRD sont des définitions installées, malgré 31 XGE + 30 TCE identifiées | 73 lignes d'inventaire réconciliées avec éditions, aliases FR/EN et doublons/réimpressions ; vues par classe/source/niveau ; chaque sous-classe installée vérifiée pour acquisition, décisions, aptitudes par niveau, repos, sorts octroyés et exemples. Les contenus manquants restent visiblement non jouables. Premier scénario métier : Barde 10 (Savoir, Séduction/Glamour, Éloquence) sans inventer les pouvoirs officiels. | 0, 1 |
| **4 — P0** | **Simplification UI créateur** | 3e écran rapide dense au niveau élevé ; parcours non évalué par des humains | Design validé avant développement : une décision prioritaire, panneau de progression, aide contextuelle, menus avancés repliés, différenciation des états disponibles/indisponibles, libellés FR. Comparatif AideDD 2014. Captures iPhone 375/390/430 et iPad 820/1180, tableau avant/après à scénario **identique**. | 0 + maquette revue |
| **5 — P0** | **Validation Safari réelle / qualité de release** | Chromium vert mais pas iOS physique, clavier ni VoiceOver | Scénarios Guerrier 1, Barde 10, Magicien 10, race déclarative ; portrait/paysage, offline, clavier, export/import, VoiceOver, barre d'adresse, sauvegarde. Bugs classés et résolus ; le Product Owner valide UX, puis URL/commit public vérifiés. | 2–4 |
| **6 — P1** | **Races et variantes : vérité mécanique** | 59 familles/62 variantes référencées, 9 races de base calculées | Toute famille choisissable, mais statut clair « règles SRD calculées / version à confirmer / déclaration manuelle » ; traits, bonus, variantes et choix d'apparence validés avec version. 118 portraits annoncés vérifiés en cache et dans les sauvegardes, sans effet sexe sur mécaniques. Les races ajoutées ne dépendent pas de l'activation implicite d'un contenu tiers. | 0, 1 |
| **7 — P1** | **Capacités 1→20 et progression** | 298 capacités SRD structurées, automatisation largement manuelle | Matrice d'acquisitions 1–20 par classe, prérequis, choix et coûts/ressources/rechargements ; automatisation **par effet**, tests des scénarios des six Companions et décision manuelle explicite sinon. | 0 |
| **8 — P1** | **Sorts : langues, filtre et exécution** | 319 SRD, 303 manuels / 16 partiels | Noms FR vérifiés et moteur de recherche robuste, distinction connus/préparés/octroyés ; contrats de composantes/portée/concentration/rituel par entrée ; effets prioritaires vérifiés ; nouveaux sorts de sources identifiés sans faux statut « implémenté ». | 1, 7 |
| **9 — P1** | **Équipement & ressources** | Profils armes/armures partiels ; inventaire/charges manuels | Packs de départ selon classe/historique, quantité et provenance, ajustements, charges/repos, limites manuelles ; tests d'export/import et Companion | 2, 7 |
| **10 — P1** | **Accessibilité et aide pédagogique** | Détails techniques trop présents pour novices | Narratif « pourquoi ce choix ? », erreur actionable, aides compactes, recherche contextualisée ; validation clavier, VoiceOver, contraste et zoom 200 % sur appareils réels | 4 |
| **11 — P2** | **Documentation produit et indicateurs réels** | Ancien README annonce « aucun déploiement public » après intégration de Pages | README synchronisé, lien fonctionnel, journal des décisions, mesures humaines honnêtes, preuve CI/production séparées. | 5 |

### Sous-chantiers de contenu, ne pas fusionner artificiellement

- **Historiques** : identifier et couvrir d'abord les 15 choix de la page publique AideDD ; les autres historiques officiels ne sont pas exclus, mais leur inventaire demande une délimitation par ouvrages.
- **Sous-classes** : valider d'abord les 12 SRD existantes, puis dérouler **Xanathar (31 titres) et Tasha (30 titres)** par classe avec provenance, sans prétendre pouvoir publier leur texte dans un dépôt public. **Artificier** : classe supplémentaire à part entière avec 4 spécialisations recensées dans les 30 entrées Tasha.
- **Traduction** : distinguer (a) titre court vérifié, (b) aide utilisateur synthétique, (c) description complète, (d) message/erreur, (e) unité de jeu ; `name.fr = name.en` ne vaut jamais traduction validée.
- **Races** : les 59 familles et les portraits sont un engagement de découverte/identité ; la couverture mécanique s'évalue séparément par règles et version.
- **UX** : conception d'abord, tests ensuite ; aucune modification visuelle sans prototype comparé AideDD, notamment pour le mode Rapide de niveau élevé.

## Les cinq décisions à obtenir du Product Owner

1. **Périmètre d'historiques :** les 15 de la page publique AideDD constituent-ils la base minimale immédiate ? Le reste est inventorié par ouvrage.
2. **Sous-classes :** conserver comme priorité produit Xanathar + Tasha **en totalité**, tout en assurant un mode utilisable avec les données disponibles.
3. **Référence UX :** AideDD est **prioritaire**, mais autoriser une interface visuellement distincte, moderne et mobile.
4. **Français :** par défaut, aucun texte anglais non signalé ; traduction éditoriale par vagues vérifiées et traçables.
5. **Release gate :** la mention « validé iOS » exige une séance réelle iPhone et iPad Air 5 ; une CI Chromium seule ne suffit pas.

## Format obligatoire des futurs tickets/PR

Chaque ticket inclut : **objectif joueur, preuve du problème, référence AideDD/source 2014, données/écrans concernés, hors périmètre, critères Given/When/Then, scénarios de non-régression, appareils à tester, statut de licence, métrique avant/après, risques et rollback**.

Chaque livraison doit joindre : commit exact, CI exacte, captures *réelles* ou mention contraire, couverture chiffrée et reproductible, états restants manuels et confirmation de l'URL publique si déployée. Une démo synthétique ne compte jamais comme test de contenu officiel.

### Étapes suivantes après approbation

1. Valider la charte et rectifier ce backlog s'il manque une consigne ;
2. Ouvrir des tickets distincts sur les P0, avec matrice/bornes et responsable ;
3. Approuver les maquettes avant développement UX ;
4. Développer en PR courtes puis tester sur appareils ;
5. Fusionner/déployer uniquement après validation de la version considérée.

**Audit 17/10/2026 : aucune de ces tâches fonctionnelles n'a été réalisée.** Ce backlog est un plan mesurable, pas une déclaration de livraison.
