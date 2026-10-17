# Pilot20 — Matrice de couverture par classe, source et traduction

**Instantané :** `main` @ `fc77e3b9`, 17/10/2026. Matrice destinée aux décisions produit, **pas une déclaration de couverture complète des règles D&D 5e 2014**. Les entrées sources complémentaires sont des titres issus des tables des matières françaises des deux PDF utilisateur.

## Classes, capacités et sous-classes

| Classe | Capacités SRD répertoriées (`feature`) | Sous-classes SRD installées | Titres Xanathar | Titres Tasha | Sorts SRD de sa liste |
| --- | ---: | ---: | ---: | ---: | ---: |
| Barbare | 18 | 1 | 3 | 2 | 0 |
| Barde | 15 | 1 | 3 | 2 | 112 |
| Clerc | 14 | 1 | 2 | 3 | 105 |
| Druide | 22 | 1 | 2 | 3 | 105 |
| Guerrier | 18 | 1 | 3 | 2 | 0 |
| Moine | 26 | 1 | 3 | 2 | 0 |
| Paladin | 25 | 1 | 2 | 2 | 31 |
| Rôdeur | 54 | 1 | 3 | 2 | 37 |
| Roublard | 18 | 1 | 4 | 2 | 0 |
| Ensorceleur | 30 | 1 | 3 | 2 | 120 |
| Occultiste | 47 | 1 | 2 | 2 | 64 |
| Magicien | 11 | 1 | 1 | 2 | 204 |
| **Artificier** | **0** | **0** | **0** | **4** | **0** |
| **Total de lignes (hors sorts)** | **298** | **12** | **31 titres non installés** | **30 titres non installés** | *Ne pas sommer : un sort peut figurer sur plusieurs listes* |

Les **12 classes** SRD disposent d'entrées de classe distinctes en plus des 298 capacités, 12 sous-classes et 1 don. Les comptes de capacités dépendent du niveau de découpage du catalogue : une entrée `feature` n'est pas nécessairement une aptitude unique au sens éditorial, ni une mécanique entièrement exécutée. Une classe à zéro sort dans la table signifie qu'elle n'a pas de liste de base dans le catalogue, **pas** qu'aucune de ses sous-classes ne peut un jour lancer des sorts.

## Matrice transversale des états réels

| Catégorie | Référencée | Définitions installées | Traduction FR vérifiée dans les données de base | Automatisation déclarée | Test complet officiel |
| --- | ---: | ---: | --- | --- | --- |
| Historiques du builder AideDD public | 15 | 1 SRD (Acolyte) | Non certifié pour tous | Effets narratifs souvent manuels | Non |
| Familles de races | 59 | 9 SRD de base | 9 intitulés français présents ; traits et variantes à vérifier | Statistiques de base partielles ; hors SRD déclaratif | Non |
| Métadonnées de variantes | 62 | Ne vaut pas installation de 62 blocs | Entrées FR présentes, vérification éditoriale à poursuivre | Non inférable | Non |
| Classes SRD | 12 | 12 | 12 noms `fr` bruts = `en` | Les fonctionnalités sont entrées individuelles | Non |
| Sous-classes SRD | 12 | 12 | 12 noms `fr` bruts = `en` | Dépend de chaque aptitude | Non |
| Sous-classes Xanathar | 31 titres | 0 définition officielle dans le catalogue livré | Titres FR dans sommaire PDF | Aucune donnée officielle installée | Non |
| Sous-classes Tasha | 30 titres | 0 définition officielle dans le catalogue livré | Titres FR dans sommaire PDF | Aucune donnée officielle installée | Non |
| Capacités SRD | 298 | 298 entrées déclaratives | 298 noms `fr` bruts = `en` | Selon `automation.status`, majoritairement manuel | Non |
| Sorts SRD | 319 | 319 définitions | **0/319 nom FR brut distinct du nom EN ; descriptions FR absentes** | 303 manuels, 16 partiels | Non |
| Don SRD | 1 | 1 | Valeur brute FR = EN | Manuel | Non |

**Attention :** « FR distinct de EN » est un test de détection de fallbacks, pas un test linguistique suffisant. Certains mots sont identiques en français et en anglais. Ici, le fait que **toutes** les entrées classes/sorts aient les mêmes valeurs ainsi que `data.language = en` signale un manque systémique. Quelques labels sont traduits au rendu (`web/app/translations.js`) sans corriger la donnée source. Aucun taux de traduction « vérifié » ne peut être inféré automatiquement.

## Statuts de la matrice (contrat recommandé)

- `REFERENCED` : nom, classe et source dans l'inventaire, sans mécanique obligatoire.
- `VISIBLE` : consultable dans la galerie.
- `DECLARATIVE` : sélection possible mais contrôle MJ et effets manuels.
- `INSTALLED` : définition structurée réellement chargée par le catalogue.
- `COMPILES` : personnage reconstruit correctement dans des cas testés.
- `AUTOMATION_PARTIAL` / `AUTOMATION_MANUAL` / `AUTOMATION_VERIFIED` : statut par pouvoir et effet, jamais par nom de classe.
- `FR_VERIFIED` : libellé et aide vérifiés ; `FR_FALLBACK` sinon.
- `IOS_HUMAN_VALIDATED` : séance sur appareil physique avec référence de version, date et scénario.

## Fichiers de données de l'audit

- [652 lignes SRD](matrix-catalogue-srd.csv)
- [15 historiques AideDD 2014](matrix-historiques-2014.csv)
- [59 familles + 62 variantes](matrix-races-2014.csv)
- [12 SRD + 31 Xanathar + 30 Tasha](matrix-sous-classes-2014.csv)

**Réconciliation obligatoire avant développement :** relier les variantes intégrées dans des définitions de races SRD aux métadonnées d'index, sans doubles comptes. Pour les contenus Xanathar/Tasha, confirmer niveaux d'acquisition, versions et réimpressions : leur sommaire ne prouve pas leur implémentation ni une permission de redistribution.
