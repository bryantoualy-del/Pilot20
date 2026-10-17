# PILOT20 — Cahier des charges produit permanent (v1)

**Statut : proposition pour validation du Product Owner — 17/10/2026.**
**Référentiel de règles : D&D 5e édition 2014, SRD 5.1.** Les suppléments autorisés sont identifiés séparément par ouvrage et version ; ne jamais mélanger les règles 2024/5.5.
**Référence fonctionnelle et ergonomique prioritaire : [AideDD Character Builder 2014](https://www.aidedd.org/dnd-builder/index.php)** ; l'[index AideDD](https://www.aidedd.org/dnd-filters/index.php) sert au repérage et aux traductions de dénominations, avec vérification par les règles de la source. AideDD ne garantit pas à lui seul la légalité d'une règle ni la disponibilité de contenus protégés.

## 1. Promesse produit

Permettre à un joueur débutant ou expérimenté de **créer, comprendre, sauvegarder, faire progresser et jouer** son personnage, sur iPhone et iPad (iPad Air 5 prioritaire), localement et hors ligne après installation. L'expérience est **française par défaut**, anglais optionnel. Pilot20 reste indépendant de RPG Connect et Encounter ; le Companion exploite le personnage réellement construit et ses règles vérifiées.

## 2. Principes obligatoires

1. **Référence AideDD en premier.** Pour chaque parcours de création, prendre l'ordre et l'explicitation des décisions du builder 2014 comme référence de contenu : race, classe, historique, niveau, caractéristiques, capacités, maîtrises, options, PV, sorts connus, équipement, personnage. Adapter et simplifier la présentation à nos besoins ; ne pas copier l'interface, les illustrations, le code ou les textes.
2. **Complétude vérifiable.** Une option affichée n'est pas « implémentée ». Toujours distinguer **référencée / visible / sélectionnable / compilable / effets automatiques / FR vérifié / testée sur appareil**. Afficher honnêtement les limites et leur cause, sans écran trompeur ni faux calcul.
3. **Choix du joueur explicites.** Aucune sous-classe, caractéristique, sort, don, aptitude facultative ou choix de progression ne doit être imposé silencieusement. Les suggestions rapides sont explicites, révisables, conformes aux prérequis ; les choix obligatoires bloquent la finalisation tant qu'ils ne sont pas résolus ou signalés manuels.
4. **Localisation française effective.** Un champ `name.fr` égal au nom anglais **ne prouve pas** une traduction. Nom, descriptif utile, erreur, filtre, école, portée, unités, résumé du Companion et équipements doivent recevoir une validation humaine. Afficher un statut « traduction indisponible » plutôt que prétendre qu'une entrée est traduite. IDs stables FR/EN.
5. **Navigation sobre.** Une décision principale visible à la fois ; autres rubriques repliables. En mobile : une colonne, progression contextualisée, aperçu sur demande, résumé clair. Éviter les pages à multiples listes défilantes et les détails techniques déversés sur l'utilisateur.
6. **Persistance sans perte.** Brouillons repris à leur étape, historique des choix et évolution par niveau, export/import, contrôle de version, conversion non destructive et aucun changement silencieux d'un choix sous source désactivée.
7. **Conformité éditoriale et droits.** Les sources libres redistribuables sont identifiées et attribuées ; Xanathar, Tasha et les autres livres ne sont ni recopiés ni publiés sans droits adaptés. La disponibilité des données et l'automatisation restent distinctes de la sélection des sources. Les noms, références et écarts peuvent être audités sans reproduire les textes protégés.
8. **Accessibilité et efficacité.** Zones tactiles ≥ 44 px, focus et erreurs visibles, support clavier/VoiceOver, contraste, réduction des mouvements, interface adaptée au clavier virtuel iOS, restauration hors ligne ; no regression sur les personnages existants.
9. **Vérité de livraison.** « Développé », « testé automatiquement », « validé sur appareil », « disponible en production », « approuvé par le Product Owner » sont **des états différents**. Une CI verte n'est pas une preuve d'ergonomie ni de contenu complet.

## 3. Parcours cibles

**Rapide** : nom/persona/race/classe/niveau → sous-classe explicite si éligible → options proposées avec confirmation → aperçu clair → enregistrer/ouvrir Companion. Pour un guerrier SRD 1, cible ≤3 écrans de création ; mesurer sans masquer les choix nécessaires. Pour un niveau 10, des décisions supplémentaires restent nécessaires et ne doivent pas être éludées.

**Guidé** : parcours pédagogique inspiré d'AideDD, avec raisons et conséquences des décisions, compteurs restants, aide compacte à la demande, recherche/filtre dans les choix, étape et sauvegarde visibles.

**Expert** : choix complets dont progression jusqu'au niveau 20, multiclassage si activé, sources/version des règles, gestion des sorts connus/préparés/grimoire/Secrets magiques, comparaison sur demande, diagnostics techniques repliés.

**Bibliothèque et Companion** : retrouver un brouillon, modifier un personnage, exporter/importer sans perte, afficher provenances des caractéristiques/maîtrises, distinguer pouvoirs jouables et actions manuelles. Tracer les choix acquis à chaque niveau si disponible ; ne pas présenter l'absence de chronologie comme une validation rétroactive.

## 4. Contrat de donnée par capacité de jeu

Chaque entrée du catalogue ou de la matrice produit dispose au minimum de :
`id, type, ruleset, classe/race d'appartenance, sourceDocument, sourceVersion, sourcePage (si vérifiée), name.fr, name.en, traduction.status, content.status, selection.status, compilation.status, automation.status, testEvidence, blockers`.

En outre, pour une sous-classe : niveau d'acquisition, aptitudes par niveau, ressources et sorts accordés. Pour un historique : compétences, outils/langues, équipement, aptitude narrative, variantes et besoins de validation. Pour un sort : niveau, classe(s), type d'incantation, composants, concentration, portée, rituel, choix de cible, gestion des ressources, texte FR vérifié. Ne pas inférer ces champs lorsqu'une source n'est pas installée.

## 5. Définition de « terminé » et gates de release

- **G0 — exigences** : besoin écrit, exemple d'usage, comparaison AideDD, critère d'acceptation et preuve planifiée.
- **G1 — contenu** : inventaire objectif, entrées disponibles réellement, contrôle de provenance, bilan de traduction ; couverture calculée à partir des données et non des noms affichés.
- **G2 — parcours** : tests métier 2014 par classe/niveau et reprise/erreurs, comparaison de scénarios strictement identiques, captures iPhone/iPad émulation.
- **G3 — appareil** : Safari physique iPhone et iPad Air 5 (clavier réel, orientation, offline, VoiceOver, portrait, sauvegarde). Si non testé, le release gate reste « non vérifié ».
- **G4 — livraison** : CI à la tête exacte, revue PR, fusion seulement après autorisation, déploiement et vérification de l'URL publique/commit. Rapport « livré / partiel / absent / à vérifier » + écarts + risques.
- **G5 — acceptation** : validation explicite du Product Owner sur 2–3 personnages de référence, sans masquer les limitations.

## 6. Gouvernance avec ChatGPT

1. **Audit en lecture seule puis proposition** avant tout lot conséquent ; respecter le présent cahier et les décisions antérieures tracées dans GitHub.
2. **Petites PR par objectif** (contenu, i18n, UX, tests) avec DoD ; aucune « méga PR » mêlant toutes les sources.
3. **Blocage explicite** des prérequis, désaccords avec la référence ou impossibilités de test. Ne jamais annoncer une fusion, un déploiement ou un test non vérifié.
4. **Source de vérité dans le dépôt** : ce cahier, matrice de couverture, backlog, décisions, rapports de validation. Une discussion seule ne change pas les exigences.
5. **Pas de changement fonctionnel** dans la PR d'audit du 17/10/2026. Les adaptations seront ouvertes après décision sur le backlog.

## 7. Critères prioritaires d'acceptation produit

- Le joueur trouve les historiques officiels de référence, sait ceux qui sont jouables et ceux qui restent non disponibles ; pas de confusion entre « historique », chronologie de montée en niveau et journal de combat.
- Un barde 10 peut identifier les collèges Savoir, Séduction/Glamour et Éloquence avec provenance exacte, sélectionner celui réellement installé et voir les choix de Secrets magiques ; pas de faux support officiel.
- Toute sous-classe affichée est étiquetée de manière fiable quant à la disponibilité des règles ; pas de « 59 races jouables automatiquement » pour 59 illustrations.
- Une interface configurée en français ne fait pas passer des libellés anglais pour des traductions.
- Un joueur retrouve la tâche courante sans fouiller menus et paramètres ; un clic ramène au brouillon et au Companion ; les réglages de campagne sont séparés du parcours joueur.
- Les limites manuelles sont signalées au point d'usage, mais **sans submerger l'écran principal**.

**Révisions :** cette charte doit être amendée uniquement avec une décision justifiée, une comparaison de l'impact UX/règles et la validation du Product Owner.
