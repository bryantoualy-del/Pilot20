# Audit UX Pilot20 × AideDD 2014 — iPhone / iPad

**Date / base :** 17/10/2026 — `main` `fc77e3b9`. **Méthode :** comparaison des étapes publiques du builder AideDD 2014, lecture du code web Pilot20, contrôle des rapports/captures **déjà produits** dans GitHub. Pas de navigation authentifiée AideDD, pas de capture fraîche, pas de session utilisateur, pas de test Safari physique effectués ici.

## AideDD est la référence prioritaire, pas une inspiration parmi quatre

- [Builder AideDD 2014](https://www.aidedd.org/dnd-builder/index.php) : **Race → Classe → Historique → Niveau → Caractéristiques → Capacités de classe → Maîtrises → Options → Points de vie → Sorts connus → Équipement → Personnage**.
- Les options dépendent du contexte race/classe/niveau ; les explications de section précisent le type de choix, les sorts connus diffèrent des sorts préparés et l'équipement initial reste modifiable.
- La page publique permet 12 classes, 15 historiques et une sélection de races ; des choix plus larges nécessitent une connexion. Ne pas déduire de la page publique l'intégralité des options accessibles avec un compte.
- La référence est **fonctionnelle et pédagogique**, pas une exigence de copier mot pour mot ses menus, de reproduire son CSS, ou de reprendre ses données protégées.

## Cartographie de parcours

| Besoin joueur AideDD 2014 | Pilot20 actuel | Constat UX | Recommandation |
| --- | --- | --- | --- |
| Race et variantes compréhensibles | Bibliothèque de 59 familles, versions/traits installés ou déclaratifs | Riche galerie mais risque fort de confondre « visible » et « règles disponibles » | Sur la carte : nom + origine + statut concret + détails repliés ; filtres « Jouable / À compléter » |
| Classe et niveau, capacités révélées à chaque niveau | Rapide identité/classe/niveau, Guidé classe & niveau, progression | Autorité de progression présente, mais personnalisation haut niveau complexe | Afficher les acquisitions **au niveau choisi** puis décisions restantes ; accès chronologie séparé |
| Historique officiel et ses acquis | Acolyte SRD + éditeur libre | Gap majeur : le joueur doit fabriquer ce qu'AideDD lui permet de choisir directement | Galerie d'historiques, compétences/outils/langues, variantes, présentation compacte |
| Caractéristiques et provenance | Standard, achat, tirage, manuel ; provenance | Bonne base fonctionnelle, besoin d'explication compacte des bonus | Base → bonus d'origine → augmentations → final ; détails à la demande |
| Capacités et choix de sous-classe | SRD 12 ; XGE/Tasha non installées | Écran de comparaison utile mais options attendues introuvables | « Source/indisponible » clair, ne pas afficher comme sélectionnable |
| Maîtrises et doublons | Résolution et provenance ; choix de doublons | Fonction existante, charge cognitive potentielle | Regrouper acquises et choix requis, avertissement actionnable |
| Sorts connus, préparés et grimoire | Séparation interne des catégories | Bon fond, manque de libellés FR ; recherches/listes denses | Onglets « connus / préparés / grimoire / octroyés », filtres et français vérifié |
| Points de vie / équipement | Calcul moyens/choix et profils SRD ; manuels pour propriétés/budget | Différents niveaux d'automatisation | Enveloppe de choix par classe, résumé lisible et limites manuelles non invasives |
| Fiche finale et édition | Bibliothèque, Companion preview, export/import, offline | Socle utile ; reprise et niveau existants | La fiche doit expliquer « jouable / manuel / incomplet » sans diagnostics techniques visibles d'emblée |

## Écrans et navigation observés dans le code

- **Rapide** (`web/app/quick.js`) : 3 écrans, racine `quick-creator`, assistant de recommandations, passerelle vers Guidé/Expert pour décisions étendues et retour Rapide. Cela fonctionne pour le guerrier 1 de référence, **pas preuve** de 3 écrans suffisants au niveau 10.
- **Guidé/Expert** (`web/app/editor.js` et `i18n.js`) : **8 étapes** Race, Classe et niveau, Capacités, Historique, Caractéristiques, Maîtrises, Sorts et équipement, Finalisation. Le parcours n'imite donc pas l'ordre AideDD ; conserver la couverture des décisions de la référence, sans obligation d'imiter ses 12 écrans.
- **Responsive** (`style.css`) : règles autour de **700 et 1100 px** ; une colonne sur téléphone, réorganisation rail/navigation, aperçus en dialogue ; contrôles tactiles / `safe-area` / `dvh` prévus. `app.js` écoute `visualViewport` pour adapter les commandes sticky lors de l'ouverture du clavier iOS. Ce code constitue une **intention de compatibilité**, pas un test iOS réussi.
- **Lisibilité** : les aides longues et comparateurs sont repliables ; la présence de nombreuses capacités/sorts/diagnostics à haut niveau crée toujours un risque de défilement excessif et de confusion entre choix, descriptions, statut de source et détails experts.

## Données de mesure et leurs limites

| Scénario mesuré dans les rapports existants | Mesure | Ce qu'elle ne démontre PAS |
| --- | --- | --- |
| V0.3.1 vs première V0.3.2 : guerrier personnalisé 1 à décisions constantes | **22 interactions / 9 changements d'écran** des deux côtés | Aucun gain de gestes/écrans sur cette comparaison, encore moins une amélioration subjective |
| Nouveau Rapide : guerrier humain Acolyte 1 avec suggestions | **11 interactions / 3 écrans de création** | Pas comparable au guerrier personnalisé 22/9 : recommandations et données différentes |
| Chromium responsive historique | Largeurs **375, 390, 430, 820, 1024, 1180, 1440** et cas paysage 844×390 ; tests de débordement, focus, aperçu, actions ≥44 px | Pas Safari, pas clavier virtuel iPhone/iPad réel, pas VoiceOver, pas mesure de lecture humaine |
| Tests Node / E2E du précédent lot | V0.3.2-RACES : **384 tests Node, 36 scénarios navigateur** déclarés réussis | Ne prouve pas les règles de 73 sous-classes, le contenu FR ni la complétude du catalogue |

Les liens et rapports sont conservés dans :
- [Validation V0.3.2](../V0.3.2-VALIDATION.md).
- [Validation races / UX Rapide](../V0.3.2-RACES-VALIDATION.md).
- [Protocole responsive existant](../V0.3.2-RESPONSIVE.md).
- [Benchmark UX historique](../V0.3.1-UX-BENCHMARK.md).

## Risques par appareil (hypothèses à tester, pas bugs reproduits)

| Appareil/parcours | Niveau de risque | Condition nécessaire de sortie |
| --- | --- | --- |
| iPhone 375–430, classe/niveau, race galerie | Moyen | Nom, provenance et statut jouable visibles sans scrolling horizontal, recherche utilisable au doigt |
| iPhone, barde niveau 10, 15+ décisions, filtres de sorts | Élevé | Étapes et choix requis toujours repérables, liste de sorts utilisable sans menus concurrents |
| iPhone, clavier virtuel et nom long | Élevé | Champ actif jamais caché, validation/retour toujours accessibles, scroll stable |
| iPad Air 5 paysage, édition complète | Moyen | Panneaux non tassés, une décision prioritaire, comparateurs compréhensibles |
| iPad Air 5 portrait, passage portrait↔paysage | Élevé | Pas de perte des sélections, pas de double scroll ou panneau superposé |
| iPhone/iPad, offline, reprise et import | Élevé | Installation initiale complète, rechargement en mode avion, bonne persistance |
| VoiceOver, erreurs et dialogues | Élevé | Labels, ordre de focus, annonces d'erreurs, fermeture et retour cohérents |

## Protocole de tests à faire sur vrais appareils (bloquant avant « UX validée »)

1. **Guerrier 1** Humain/Acolyte : Rapide + Guidé, sans et avec recommandations ; taux de réussite, gestes, temps, hésitations, écrans traversés ; aucun choix obligatoire perdu.
2. **Barde 10** : sélectionner Collège du Savoir, expertises, ASI, Secrets magiques, sorts connus ; retrouver une capacité en quelques gestes. Essayer « Séduction/Glamour » et « Éloquence » pour vérifier un statut honnête si non installés.
3. **Kobold barde 10** : tester race déclarative et validation manuelle ; aucune mécanique inventée ; retour sans effacement.
4. **Magicien 10** : grimoire vs préparation, changement de niveau et reprise ; cohérence des choix et libellés FR.
5. **Clerc 5** : domaine, préparation, sorts accordés, canaux et validation ; affichage des limites manuelles.
6. **iPhone Safari physique** : clavier ouvert, saisie, recherche, dialogue, restauration, mode avion, partage/export, VoiceOver, zoom texte et safe areas.
7. **iPad Air 5 Safari physique** paysage puis portrait : mêmes parcours, basculement orientation avec comparateur puis aperçus, vérification des contrôles tactiles et du focus.
8. **Compare UX vs AideDD** : scénario commun (classe/niveau/race/historique accessibles des deux côtés), même opérateur et même appareil ; chronométrer durée *humaine*, gestes et corrections séparément des replays Playwright.

**Critère UX cible à valider avec le Product Owner** : novice guidé sans blocage incompréhensible, utilisateur expert autonome, langue française cohérente, défilement pertinent (pas « zéro scroll » à tout prix), accès direct au brouillon, sauvegarde certaine.

## Décision de méthode

Les tests d'ergonomie doivent être **un gate distinct** des tests de règles ; chaque PR UX doit inclure captures comparables avant/après sur les mêmes appareils/états, preuve de non-régression, mesures honnêtes, et explicitation de toute étape manquante. Les captures historiques ne remplacent pas une nouvelle séance humaine.
