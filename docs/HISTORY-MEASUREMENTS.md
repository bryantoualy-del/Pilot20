# Mesures de l’historique et des sauvegardes — correctif pré-merge

Commande reproductible :

```sh
npm run benchmark -- --output=docs/benchmark-500.json
```

Le script contient des assertions fonctionnelles et n’écrit aucun stockage navigateur. La sortie JSON archive les mesures réelles ; les valeurs de temps sont descriptives, sans seuil de performance imposé aux tests.

## Protocole

Deux scénarios : 2 participants et 7 participants, **500 transactions acceptées chacun**. Une boucle de dix commandes représente : début de tour, concentration multicible avec emplacement, PV temporaires, dégâts, sauvegarde de concentration, nouveau tour, attaque, annulation de cette attaque, correction justifiée et repos long. Au total par scénario : 100 débuts de tour, 150 capacités, 50 dégâts, 50 sauvegardes, 50 annulations, 50 corrections et 50 repos. Les cibles sont des fixtures simples, pas sept fiches de personnages complètes.

Après **chaque** transaction : sauvegarde via `repository.save`, relecture via `load`, comparaison intégrale. Chaque annulation est comparée au snapshot mécanique avant l’attaque. Aux étapes 100, 250 et 500 : export/import, rejeu de la dernière commande et comparaison du document. Après 500 : rejeu de la toute première commande, rejeu d’une attaque annulée et refus d’une collision de contenu sous un ancien identifiant.

Le scénario garde 400 entrées d’historique pour 500 reçus : l’annulation retire l’attaque de l’historique, sans retirer son reçu ni celui de l’annulation. Aucun compactage ni purge n’intervient.

## Volume

| Participants | Transactions | JSON UTF-8 (octets) | Historique | Reçus | Deux copies UTF-16 estimées (octets) |
|---|---:|---:|---:|---:|---:|
| 2 | 100 | 189,405 | 80 | 100 | 752,170 |
| 2 | 250 | 471,435 | 200 | 250 | 1,878,364 |
| 2 | 500 | 941,490 | 400 | 500 | 3,755,382 |
| 7 | 100 | 357,075 | 80 | 100 | 1,418,710 |
| 7 | 250 | 887,505 | 200 | 250 | 3,538,504 |
| 7 | 500 | 1,771,560 | 400 | 500 | 7,071,522 |

Le JSON ne suffit pas à estimer le quota : les clés de stockage et la copie `last-good` comptent aussi. La colonne finale prend deux octets par unité UTF-16 pour clés et valeurs. Le comptage réel des navigateurs peut différer.

## Temps mesurés

Environnement : v24.19.0 / linux / x64. Horodatage UTC : `2026-10-15T21:43:53.321Z`.

| Participants | Opération | Moyenne (ms) | P95 (ms) | Maximum (ms) | Total des 500 appels (s) |
|---|---|---:|---:|---:|---:|
| 2 | execute | 8.82 | 16.90 | 42.20 | 4.41 |
| 2 | save | 15.77 | 30.34 | 36.41 | 7.89 |
| 2 | load | 13.10 | 24.82 | 39.12 | 6.55 |
| 7 | execute | 16.77 | 33.59 | 60.65 | 8.38 |
| 7 | save | 30.22 | 59.74 | 89.71 | 15.11 |
| 7 | load | 25.17 | 50.41 | 77.66 | 12.58 |

- 2 participants : 28.46 s de durée totale, assertions, simulation de quota et contrôles de rejeu compris.
- 7 participants : 47.83 s de durée totale, assertions, simulation de quota et contrôles de rejeu compris.

Ces résultats portent sur une machine de développement, avec stockage en mémoire. Le coût de `save` inclut validation, sérialisation et lecture/validation de l’ancienne copie. Le coût de `load` inclut parsing, migration sur copie et validation. Les écritures disque, l’interface, le navigateur et l’iPad ne sont pas mesurés. Moyennes et P95 agrègent les étapes 1 à 500 ; ce ne sont pas des temps à taille constante. Le coût augmente avec les snapshots, définitions et reçus, et ces chiffres ne garantissent pas la fluidité sur tablette.

## Quota et fiabilité

Simulation additionnelle d’un budget **5 Mio (5 242 880 octets)**, selon le comptage UTF-16 ci-dessus :

- Avec 2 participants : les 500 sauvegardes passent.
- Avec 7 participants : première écriture refusée à la **transaction 371** ; la révision **370** reste sauvegardée, lisible et identique à la copie validée. Le script vérifie que le primaire n’a pas changé lors du refus. Le scénario principal poursuit jusqu’à 500 avec un stockage mémoire sans quota, sans masquer le refus du stockage limité.

Les 1 000 transactions principales ont toutes passé les contrôles de relecture, annulation et rejeu. Le quota simulé prouve le traitement sûr d’un refus, pas la capacité d’une campagne de cette taille à tenir dans localStorage. Les deux copies à 7 participants représentent environ **7,07 Mo décimaux**, soit **6,74 Mio**. Le JSON primaire reste sous la limite applicative de 10 000 000 caractères ; la saturation locale peut donc arriver bien avant cette limite.

## Décision

Le socle V0.1 peut conserver son historique intégral et son comportement d’échec explicite, sans compactage prématuré. Il ne doit pas être présenté comme un stockage de longue campagne prêt pour le navigateur. Pour V0.2 : IndexedDB transactionnel, définitions versionnées séparées, checkpoints et deltas de runtime, archive relisible, reçus/tombstones durables indépendants de la fenêtre d’annulation. La stratégie complète est dans `ARCHITECTURE.md`.
