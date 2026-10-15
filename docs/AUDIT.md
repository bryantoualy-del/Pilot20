# Audit technique de réutilisabilité

Date : 15 octobre 2026. Périmètre : six Companions, Encounter et RPG-Connect, branches `main` épinglées ci-dessous. Audit de structure et lecture ciblée des chemins de combat/stockage/protocole ; ce n’est pas un audit de sécurité exhaustif ni une validation interactive des huit applications.

## Conclusion

Les références offrent des **mécanismes et contrats réutilisables**, mais pas un moteur universel directement extractible. Les modules communs copient souvent le même code, alors que l’état natif, l’économie d’action, les ressources et les effets dépendent du personnage et du DOM. Fusionner les six applications conserverait cette dépendance et multiplierait les branches de règles.

Approche retenue : réimplémenter un petit domaine pur, reprendre les invariants et porter progressivement les cas de régression en données. Aucune copie des écrans, catalogues personnels ou autorités nominatives dans le nouveau moteur.

## Lecture par dépôt

| Référence | Éléments examinés | Réutilisable | Couplage et décision |
|---|---|---|---|
| Brackmard | `index.html`, `companion-v3.js`, `rpg-brack-client.js` | Cas de référence Extra Attack + Fougue + Hâte ; indicateurs A/B/R. | État et fonctions de combat dans HTML ; `extraAction`, attaques restantes et UI interconnectés. Modéliser des budgets distincts, sans copier `ensureAttackAction`. |
| Encounter | `app.js`, `rpg-connect-mj.js`, `rpg-health-authority.js`, `rpg-reaction-authority.js`, `encounter-persistence.js` | Autorité du combat ; ledger de réactions ; modèle de patches d’annulation ; sauvegardes récupérables ; nombreux tests de règles. | Gros orchestrateurs et autorités nominatives ; règles personnelles dans le résolveur de soins. Réutiliser les contrats et scénarios, extraire des fonctions pures ; ne pas importer le moteur MJ tel quel. |
| Kentaro | `companion-api.js`, `kentaro-combat.js`, `kentaro-backup.js` | Adaptateur normalisé, captures de ressources, dégâts effectifs et concentration. | Armure, armes, spectre et bonus imbriqués dans le bridge et les globals. Extraire les mécanismes en primitives et les variantes en données. |
| Nans | `index.html`, `rpg-nans.js`, `tests/volto-regression.cjs` | Échanges de ressources, attaques bonus, rage, objets à charges et régressions de Volto. | Mutations de fonctions natives et règles propres aux armes/cor. Déclarer coûts, états et préconditions ; conserver les scénarios comme fixtures personnelles. |
| RPG-Connect | `rpg-connect-server.js`, `rpg-connect-protocol.test.js`, protocoles Markdown | Transport, capacités, reçus, files, génération de résolution, protection des commandes MJ. | Allowlist de six personnages, état des salles en mémoire, pas de compte/sync durable. Le serveur est un bus de session ; il ne devient pas la base de données Pilot20. |
| Rufus | `companion-v3.js`, `rpg-rufus-combat.js`, `rpg-reactions.js` | Choix de dés différés, reprises persistantes, attaques de réaction et dépenses conditionnelles. | Adaptations spécifiques des réactions et sauvegardes ; attention Sournoise par tour, pas par round. Remplacer les drapeaux propres à Rufus par un déclencheur daté du tour. |
| Samoth | `companion.js`, `rpg-samoth-automatismes.js` | Ressources multiples, métamagie, invocations, phases secondaires, import ancien. | Fiche, catalogue local, règles, persistance et rendu réunis dans `companion.js`. Ne pas importer ses textes hors SRD ni son profil fixe. |
| Zephyr | `index.html`, `zephyr-combat.js`, `spiritual-weapon.js` | Soin à autorité Encounter, coûts liés à une attaque, entité partageant action bonus. | Arme spirituelle utilise bonus/statistiques fixes et globals ; abstraire contrôleur, budget partagé et attaque de sort. Entité secondaire ne signifie pas initiative séparée. |

## Duplication vérifiée par empreintes SHA-256

| Module | Résultat sur les six Companions | Décision |
|---|---|---|
| `dice-engine.js` | Identique dans les six | Conserver éventuellement comme adaptateur d’animation ; dépend de Three.js importé depuis un CDN, à embarquer/cacheter pour garantir le hors-ligne navigateur. Pas de dépendance dans le moteur. |
| `rpg-concentration.js` | Identique dans les six | Reprendre demandes persistantes et identification des instances ; retirer DOM, aura fixe de Zéphyr et pénalité nommée au profit de modificateurs de données. |
| `rpg-multi-target.js` | Identique dans les six | Reprendre principe d’une transaction avec plusieurs cibles, validation distincte par cible ; pas six dépenses de ressources. |
| `rpg-correction-schema.js` | Identique dans les six et Encounter | Bonne base de vocabulaire de corrections ; séparer contrat réseau et modèle universel. |
| `mj-journal-model.js` | Identique dans les six et Encounter | Diff/merge/restauration par patches et détection de conflit à reprendre au lot d’annulation ciblée. |
| `rpg-connect-client.js` | Cinq variantes ; Brackmard et Nans identiques | Ne pas choisir arbitrairement une variante comme vérité. Contrat unique à tester contre les capacités réellement négociées. |
| `rpg-reactions.js` | Quatre identiques ; variantes Rufus et Samoth | Moteur commun de fenêtres, options propres aux capacités. |
| `rpg-undo.js` | Quatre variantes ; Brackmard/Samoth/Zephyr identiques | Conserver les phases distribuées et tombstones ; ne pas copier les listes d’exclusion nominatives dans le domaine. |

Les empreintes exactes et tailles des fichiers sont conservées dans `reference-manifest.json`. L’égalité des fichiers prouve leur duplication, pas leur absence de défaut.

## Invariants à préserver

1. **Économie** : une action Attaquer peut contenir plusieurs attaques ; une action bonus et une réaction ont des budgets distincts. La réaction revient au début du tour du propriétaire. Hâte et Fougue exigent des budgets propres, pas un simple booléen « action supplémentaire ».
2. **Concentration** : dégâts effectifs après défenses, y compris absorption par PV temporaires ; DD minimum 10 ; une demande par instance de dégâts ; refus d’un reroll après reconnexion ; rupture si incapacité. Les totaux de dégâts affichés doivent refléter les résultats d’Encounter.
3. **Ressources** : une activation dépense une fois, y compris à plusieurs cibles ; refus/restauration doivent traiter coût et économie ensemble. Une réservation en attente survit au rechargement.
4. **Réactions** : ouverture → options → revendication → accord → résultat → reprise. Le joueur ne consomme pas avant accord en mode connecté. Les fenêtres dépassent la simple disponibilité d’une réaction.
5. **Annulation** : annuler une action ne restaure pas une sauvegarde complète sur des événements ultérieurs ; le protocole existant vérifie la possibilité de restaurer, coordonne et garde les identifiants annulés. V0.1 commence volontairement par la dernière transaction locale.
6. **Autorité** : Encounter tranche touché/raté, dégâts, PV/états et tours connectés. Mode Libre sépare présence réseau et résolution locale ; reprendre un combat exige une proposition et une réconciliation, pas l’envoi aveugle d’une fiche locale.
7. **Sauvegarde** : importer avant de remplacer ; refuser une version future ; conserver la donnée illisible et une copie valide ; signaler les erreurs au lieu de continuer silencieusement.

## Dette et points de vigilance

- `window.__CompanionBridge`, les globals, interceptions d’événements et remplacements de fonctions lient règles et UI. La normalisation dans `CompanionAPI` révèle plusieurs formats natifs (`hp/temp/tempHp`, `eco/used`, etc.). Une seule structure canonique est nécessaire.
- Les autorités de soin/effets Encounter comportent des branches sur le nom du personnage, la source et des montants fixes. Elles restent correctes pour leurs cas actuels mais ne doivent pas dicter la future API universelle.
- Formats d’export et versions différents selon les applications. Aucun import direct dans le nouveau modèle sans importeur dédié, mapping et rapport de perte.
- Les scénarios de tests des références s’appuient parfois sur des chemins frères et sur `jsdom`, `ws` ou Playwright. Leur présence ne prouve pas qu’ils passent sur un clone isolé.
- Le bus RPG Connect conserve salles, tokens, files et watermarks dans des `Map/Set` en mémoire. Sa reprise après redémarrage complet n’est pas une synchronisation cloud durable.
- Les six identifiants sont explicitement autorisés dans le serveur. L’extension à des personnages générés demandera un changement de protocole et du binding Encounter, hors périmètre des écritures autorisées ici.
- Le dépôt Pilot20 est public, comme les références. La branche de développement sera donc consultable ; aucun secret ni contenu sous droits hors SRD ne doit être copié. Aucun site/application n’est déployé par ce travail.

## Vérification des références

Exécution depuis `references/Encounter`, sans installer ni écrire de dépendances dans les sources :

```sh
node --test rpg-effective-damage.test.js rpg-reaction-authority.test.js mj-spell-slots.test.js
```

Résultat : **15 tests passent**. Couvre rapprochement des dégâts effectifs, rejeu/annulation/tours, fenêtres de réaction et dépenses d’emplacements idempotentes. Une première exécution incluant `rpg-participant-profiles.test.js` n’a pas pu charger ce fichier : `ERR_MODULE_NOT_FOUND: jsdom`. C’est un blocage d’environnement, pas une régression démontrée. Les tests navigateurs, WebSocket et la campagne complète ne sont pas exécutés dans cet audit.

## Révisions auditées

| Dépôt | Commit `main` |
|---|---|
| [bryantoualy-del/Brackmard](https://github.com/bryantoualy-del/Brackmard/tree/8868f30c1e870d6cb4d677c3930b8bed2a660373) | `8868f30c1e870d6cb4d677c3930b8bed2a660373` |
| [bryantoualy-del/Encounter](https://github.com/bryantoualy-del/Encounter/tree/693cb70cb530bfe5c00d954d705ef270592c48b5) | `693cb70cb530bfe5c00d954d705ef270592c48b5` |
| [bryantoualy-del/Kentaro](https://github.com/bryantoualy-del/Kentaro/tree/b1376f9541ceadf089c5c977ff53dd5d0181a2c1) | `b1376f9541ceadf089c5c977ff53dd5d0181a2c1` |
| [bryantoualy-del/Nans](https://github.com/bryantoualy-del/Nans/tree/4aca7847c4e456639ecd369004c55af8cf12409d) | `4aca7847c4e456639ecd369004c55af8cf12409d` |
| [bryantoualy-del/RPG-Connect](https://github.com/bryantoualy-del/RPG-Connect/tree/204f044860ef18ef6268494236a682fa201c5202) | `204f044860ef18ef6268494236a682fa201c5202` |
| [bryantoualy-del/Rufus](https://github.com/bryantoualy-del/Rufus/tree/9179d039281115becfd4533e097b4548815d7680) | `9179d039281115becfd4533e097b4548815d7680` |
| [bryantoualy-del/Samoth](https://github.com/bryantoualy-del/Samoth/tree/53e05b1f7524bf107d4bf89f8f728ef65d06e840) | `53e05b1f7524bf107d4bf89f8f728ef65d06e840` |
| [bryantoualy-del/Zephyr](https://github.com/bryantoualy-del/Zephyr/tree/cc82caa1038c3aee36662fea02ef0bee323f84b1) | `cc82caa1038c3aee36662fea02ef0bee323f84b1` |

Toutes les écritures de développement concernent uniquement Pilot20, branche `dev/universal-engine-v0.1`. Les clones des huit références sont restés sans changement suivi ou non suivi après inspection et tests.
