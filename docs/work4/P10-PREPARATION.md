# P10 — Préparations partielles et dépréparation

Le Grimoire accepte une liste de préparation inférieure au quota calculé, jusqu’à une liste vide. La capacité affichée reste calculée par classe, niveau et caractéristique ; aucune préparation excédentaire ou étrangère à la liste n’est acceptée. Les sorts automatiquement préparés restent toujours présents et hors quota. Les sorts mineurs ne consomment pas de place de préparation.

Le Magicien conserve tous les sorts de son grimoire lorsqu’il les déprépare. Les classes à sorts connus gardent leurs quotas distincts : ni le Barde, ni le Rôdeur, ni l’Ensorceleur, ni l’Occultiste n’acquièrent une préparation quotidienne générique.

Une préparation n’est enregistrée qu’après validation de la liste par le joueur. Cette fonction ne déclenche pas de repos ni ne prétend permettre une préparation à n’importe quel moment en partie : les conditions temporelles restent à respecter avec le MJ et seront reliées au futur Companion. Elle permet de conserver un travail de préparation partiel sans imposer de choix arbitraires pour remplir le quota.

Le contrat de personnage accepte un minimum facultatif par choix. Ce champ n’est ajouté qu’aux listes partielles : une fiche antérieure dont la préparation est complète conserve le même contenu compilé. Le cas d’un quota égal à un utilise une case à cocher permettant une dépréparation, plutôt qu’un bouton radio impossible à désélectionner.

Tests ciblés : cinq familles à préparation, listes de zéro/un/quota maximal, quota dépassé, doublons, octrois automatiques, maintien du grimoire du magicien, quotas exacts des sorts connus, validation du contrat. Le parcours navigateur enregistre une préparation réduite de Clerc5 et vérifie le maintien des sorts de domaine. CI et tests navigateur à confirmer sur le commit exact de cette PR.
