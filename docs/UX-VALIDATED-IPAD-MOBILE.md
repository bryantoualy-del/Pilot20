# UX validée — iPad et téléphone (19 octobre 2026)

Référence : maquette iPad de 14 pages et déclinaison téléphone validées par le responsable produit. Cette PR applique le parcours au créateur existant, sans recréer le moteur D&D 5e 2014.

## Parcours / modifications
- Six sections toujours visibles : Origine, Classe, Caractéristiques, Choix, Magie & équipement, Validation. Les décisions conditionnelles existantes demeurent et sont regroupées sans mutation de leur contrat.
- Classe : galerie d'icônes locales existantes, niveau et sous-classe dans un panneau commun (uniquement lorsqu'elle est déverrouillée par les règles).
- Races : recherche et filtre disponible/toutes, icônes locales existantes, résumé des bonus, vitesse et traits sous la galerie ; détails longs consultables.
- Achat de caractéristiques : budget 27 points inchangé, coût par score, bonus racial et total explicites ; tableau compact iPad, cartes lisibles sur téléphone.
- Dons : deux choix visuels distincts « Améliorer les caractéristiques » et « Choisir un don », toujours soumis aux options et prérequis du moteur.
- Validation : structure existante, problèmes et corrections, sauvegarde atomique inchangée.
- Grand écran et iPad : galerie et panneau de classe côte à côte ; téléphone : une colonne, boutons de navigation tactiles fixes, six étapes compactes.

## Garde-fous
- Aucune donnée officielle propriétaire copiée des maquettes/livres. Règles 2014 et sélection des sources inchangées.
- Races et classes puisent les images locales Pilot20. Les contenus non installés restent bloqués.
- Les anciennes décisions et brouillons restent compatibles ; le regroupement ne supprime aucune décision.
- Le saut d'un sous-choix déjà décidé ne se fait que si `decisionReady` confirme sa validité.
- Pas de test Safari/iPad physique revendiqué. Les tests automatisés et le rendu réellement testable sont à vérifier dans les checks de PR.
