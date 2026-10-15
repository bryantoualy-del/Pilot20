# Pilot20

Socle universel pour personnages D&D 5e **2014**. V0.1 de développement : moteur local indépendant du dashboard, piloté par des données, sans compte et sans dépendance d’exécution.

```sh
npm test
npm run demo
```

Node.js 22 ou 24. Aucune installation de dépendances nécessaire. La démo est textuelle et fonctionne hors ligne après récupération du dépôt.

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
