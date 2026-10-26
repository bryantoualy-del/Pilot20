# Validation PR #92 — 26 octobre 2026

| Vérification | Résultat | Périmètre |
|---|---|---|
| `npm test` avant modification | 614/614 réussis | État initial de la branche #92 |
| `npm test` après modification | 626/626 réussis, zéro échec | Suite complète Pilot20, Node24.22.1 |
| `npm run test:forge` | 40/40 réussis | Inclut les 4 tests du planificateur dont le nom ne correspond pas à la découverte par défaut de `node --test` |
| Matrice exécutée | 54 objets, 97 lignes | 85 lignes originales +12 scénarios exécutés dans le moteur ; inventaire complet généré |
| `npm run build:web` | Réussi | Construction et empaquetage hors ligne |
| Encounter `npm run test:companions` | 7/7 réussis | Ponts des six Compagnons et flux client/reconnexion |
| Six autorités Encounter | 107/107 réussis | Kentaro, Brack, Nans, Rufus, Zéphyr, automatismes Samoth ; dépôts inchangés |
| `git diff --check` | Réussi | Aucun défaut d’espacement signalé |
| Installation Chromium | Échec environnement | Archive téléchargée invalide : `End of central directory record signature not found` |
| `npm run test:e2e:forge` | Non exécuté au-delà du lancement navigateur | Binaire Chromium indisponible ; aucune conclusion visuelle |
| iPad paysage / iPhone portrait physiques | Non testés | Aucun appareil physique accessible |

Les tests des six autorités ont été lancés avec :

```
node --test --test-concurrency=1 rpg-kentaro-authority.test.js rpg-brack-authority.test.js rpg-nans-authority.test.js rpg-rufus-authority.test.js rpg-zephyr-authority.test.js rpg-samoth-automatismes.test.js
```

Ils vérifient les mécanismes historiques à leur révision source consignée dans `pr92-sources.json`. Ils ne démontrent pas une connexion live entre ces applications et le nouveau contrat Forge.

Les 12 scénarios de `forge-runtime-integration.test.mjs` exercent les assertions suivantes :

- Aura hors tour : dégâts après résistance, économie inchangée, répétition/rechargement et cible suivante.
- Refus des faux propriétaires, mauvaise autorité, portée non vérifiée, tour périmé, cible incohérente et dés invalides ; entrée intacte après échec.
- Récupération d’aube : limites du d4, plafond5, doublon avec nouvel ID de transport et refus du mauvais événement.
- Transformation : action bonus, CA recalculée, ancien profil d’attaque interdit, retour à la forme précédente sans cumul.
- Capacité partielle refusée en combat réel.
- Fréquences/événements : repos sans cible, identifiants requis, armes distinctes et couverture du vocabulaire des déclencheurs.
- Sceau : deux attaques réelles, dégâts typés, avantage réservé à la source et disparition à la fin du prochain tour.
- Désavantage : conservation au changement de tour, consommation sur attaque ratée, application ou absence selon le JdS.
- Persistance : échec de quota sans application, conflit entre deux écritures simultanées, reçu sauvegardé avec dégâts.
- Sort d’objet : contrat exécutable explicitement fourni, DD fixe, coût en charges, aucun emplacement supplémentaire ; absence du contrat reste partielle.
- Contrat live : le handshake historique ne suffit pas à certifier la disponibilité Forge.
- Présentation : résultat autorisé sans reçu privé et sans seconde animation après répétition.

Les tests existants Forge couvrent aussi critique, attaque ratée, résistances/vulnérabilités, coûts de réaction déjà dépensée, charges insuffisantes, soins plafonnés et bonus temporaires. Le test de Volto lève une ambiguïté dans sa copie de test ; aucun arbitrage n’est persisté dans le catalogue.
