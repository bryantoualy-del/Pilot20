# P13 — Bonus de construction réellement calculés

Les tests à haut niveau ont montré que plusieurs capacités SRD étaient présentes dans les textes sans être appliquées aux statistiques. Ce lot relie leurs effets de construction au moteur existant, sans ajouter de parcours de création.

- Champion primitif : au niveau20 de barbare, Force et Constitution gagnent4 avec plafond24. Les ASI ordinaires gardent leur plafond20 et sont résolues avant ce gain ; une compilation ne cumule pas le bonus plusieurs fois. Constitution et tous les gains de PV sont recalculés.
- Résistance draconique :+1 PV par niveau d’ensorceleur et calcul de CA13+Dextérité sans armure portée. Les autres calculs de base de CA ne s’additionnent pas.
- Touche-à-tout : demi-maîtrise arrondie à l’inférieur pour les tests non maîtrisés, initiative comprise. Athlète remarquable : arrondi supérieur pour les tests physiques concernés. Les deux ne se cumulent pas. Les sauvegardes ne reçoivent pas ces bonus ; Contresort utilise bien le bonus de test du barde.
- Défense :+1 CA uniquement avec une armure portée. Un bouclier seul ne déclenche pas le style.
- Archerie :+2 aux attaques d’armes à distance, sans bonus de dégâts ni bonus aux armes de mêlée simplement lancées.
- Un style déjà acquis par une autre classe est exclu des choix proposés. Une ancienne sélection incompatible reste conservée et signalée.
- Un second niveau initial dans une autre classe ne permet pas d’acquérir à nouveau Défense sans armure ; la première acquisition est retenue.

L’ancêtre draconique et le terrain du Cercle de la terre sont conditionnés à leurs sous-classes respectives. Un ensorceleur de Tasha ne reçoit plus un choix draconique sans rapport avec son origine. Les couleurs draconiques disposent du type de dégâts associé ; le draconique est connu par la lignée, sans résistance permanente gratuite.

Les effets restent rattachés à leurs identifiants et leur provenance SRD. Les conditions d’armure et le caractère d’arme à distance sont déclaratifs dans les contrats. Les champs ajoutés sont facultatifs pour la lecture des anciennes données. Les fiches anciennes qui n’intégraient pas ces bonus doivent être revues dans le Créateur avant de modifier leur Grimoire ; elles ne sont pas écrasées depuis un brouillon devenu différent.

Des résumés français originaux sont fournis pour ces capacités ; leurs descriptions anglaises SRD sont conservées pour l’interface anglaise.

Validation : tests ciblés du barbare20, PV/CA de l’ensorceleur et de son multiclassage, arrondis et non-cumul de demi-maîtrise, conditions des styles, choix de styles multiclassés, Défense sans armure et Contresort de barde. Le navigateur crée un guerrier Défense avec mailles et bouclier et vérifie une CA de19. La CI doit être vérifiée sur le commit exact.

Les effets conditionnels de combat tels que Duel, Combat à deux armes, Protection, les auras et la résolution des dégâts ne sont pas annoncés entièrement automatisés par ce lot. Ils doivent continuer à être reliés selon leur périmètre, en préservant les règles dans le modèle du futur Companion.
