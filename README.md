# Pilot20

[Ouvrir Pilot20 sur GitHub Pages](https://bryantoualy-del.github.io/Pilot20/)

Le workflow `Publish Pilot20 to GitHub Pages` teste et compile l’application, puis publie le contenu de `dist/` à chaque mise à jour de `main`. Il vérifie ensuite la page, le service worker et les assets publics. La racine du site ouvre le créateur dans `web/index.html`.

Application locale pour personnages D&D 5e **2014** : moteur universel, catalogue SRD, créateur graphique et bibliothèque. V0.3.1 proposée en revue, avec effets manuels et validation Safari physique encore à réaliser.

```sh
npm ci
npm test
npm run dev
```

Créateur local : `http://127.0.0.1:4173/web/index.html`. Voir [l’audit V0.3.1](docs/V0.3.1-AUDIT.md), [le benchmark UX](docs/V0.3.1-UX-BENCHMARK.md) et [la validation avec captures et limites](docs/V0.3.1-VALIDATION.md).

Node.js 22 ou 24. La démo du moteur reste disponible avec `npm run demo`. Le créateur dispose d’un cache hors ligne après une première installation complète.

- [Audit des huit références](docs/AUDIT.md)
- [Architecture et décisions](docs/ARCHITECTURE.md)
- [Périmètre, manques et prochaine étape](docs/ROADMAP.md)
- [Contrat des commandes](docs/API.md)
- [Schéma JSON V1](docs/session-v1.schema.json)
- [Références épinglées et empreintes](docs/reference-manifest.json)
- [Validation](docs/VALIDATION.md)
- [Mesures sur 500 transactions](docs/HISTORY-MEASUREMENTS.md)

Les capacités de démonstration sont des fixtures originales de mécanismes, pas un build de classe ni un catalogue D&D complet. Aucun contenu hors SRD des références n’est redistribué. Les dépôts Companions, Encounter et RPG Connect sont restés en lecture seule. Aucun déploiement public.

## V0.2 — modèle universel de personnage

Contrats versionnés, calculs D&D 2014, projection vers le moteur V0.1,
bibliothèque locale multipersonnage et persistance transactionnelle IndexedDB.

- [Périmètre, architecture et couverture des règles](docs/V0.2.md)
- [Stockage et migrations](docs/V0.2-STORAGE.md)
- [Validation](docs/V0.2-VALIDATION.md)
- [Contenu et licences](docs/CONTENT-LICENSES.md)
- [Prochain test réel : kobold barde](docs/KOBOLD-INTEGRATION-PLAN.md)
- [Schémas de transport](schemas/contracts-v2.schema.json)

`npm ci --ignore-scripts`, puis `npm test` et `npm run demo:characters`.
Pas de créateur visuel, dashboard ou automatisation exhaustive des classes à ce stade.

## Universal rules, V0.2b

- [Twelve-class audit](docs/CLASS-COVERAGE.md) and [spell families](docs/SPELL-COVERAGE.md).
- [Generic contracts](docs/RULE-CONTRACTS.md), [executable P0 scope/limits](docs/V0.2b-P0.md) and [V0.2c plan](docs/V0.2c-PLAN.md).
- `npm run coverage` / `npm run coverage:check`: reproducible fixture coverage, with selected-effect execution separated from whole official spells.
- `npm run demo:combat`: three deterministic rounds, three classes, five opponents and a mid-combat reload.

Twelve represented classes do not mean twelve fully automated classes. Reactions, post-hit decisions and transformations remain blocked pending their complete executors.

## V0.2b.3 — réactions et règles conditionnelles

Décisions JSON persistantes, fenêtres ordonnées, réactions défensives, dépenses après touche, ressources transférées, Rage et modifications du plan de lancement. Le moteur transactionnel existant reste l'autorité locale ; les faits externes manquants demandent une validation explicite.

- [API, ordre et continuations](docs/V0.2b.3-REACTIVE.md)
- [Correctif pré-fusion : vue joueur, dégâts mixtes et garde-fous](docs/V0.2b.3-PREMERGE.md)
- [Validation, couverture réelle, limites et risques](docs/V0.2b.3-VALIDATION.md)
- [Démonstration déterministe : sept classes, cinq adversaires, cinq rounds](docs/V0.2b.3-DEMO.txt)
- [Matrice générée et contrôlée en CI](docs/coverage-report.json)

`npm run demo:reactive`. Aucun déploiement ; aucune affirmation de douze classes ou de sorts officiels entièrement automatisés. Les limites restantes empêchent de déclarer tous les critères V0.2b.3 clos sans réserve.

## V0.3 — paramètres de sources

[Sources de campagne, packs privés et contrat du créateur](docs/V0.3-SOURCES.md).
Écran local : `web/sources.html` via un serveur HTTP depuis la racine du dépôt.
SRD, Xanathar et Tasha sont sélectionnables ; seul le SRD est livré. Les packs
privés s'importent localement et ne sont jamais publiés avec l'application.

## V0.3 local character application (review candidate)

Run `npm ci` then `npm run dev` and open the printed local URL. The graphical application includes a bilingual library, campaign sources, quick/guided/expert creation and a local Companion Preview. Build static files with `npm run build:web`; `dist/` contains every runtime asset and the service worker. Wait for “Disponible hors ligne” before disconnecting.

No accounts, external CDN, RPG Connect or public deployment are required. Back up characters with the library export action. Private packs are installed on this browser only. The public app does not ship protected extension books.

The V0.3 release gate is still open: see [validation](docs/V0.3-VALIDATION.md), [architecture](docs/V0.3-ARCHITECTURE.md), [UX](docs/V0.3-UX.md), [source coverage](docs/V0.3-SOURCES-COVERAGE.md) and [limitations](docs/V0.3-LIMITATIONS.md). No complete official extension or physical iPad validation is claimed.

### V0.3.2 — Creation experience (review)

Native responsive class discovery, source-filtered class/subclass comparisons, non-destructive score/class simulation, level timeline and actionable diagnostics. Local RPG Connect icons are included in the offline package under the owner's authorization. Existing draft/character schemas and the rules engine remain unchanged.

See [UX architecture](docs/V0.3.2-UX-ARCHITECTURE.md), [open-source audit](docs/V0.3.2-OPEN-SOURCE-AUDIT.md), [responsive protocol](docs/V0.3.2-RESPONSIVE.md), [assets](docs/V0.3.2-ASSETS.md) and [validation](docs/V0.3.2-VALIDATION.md). Physical Safari/iPhone/iPad validation remains a manual review gate. No protected XGE/Tasha content is distributed.
