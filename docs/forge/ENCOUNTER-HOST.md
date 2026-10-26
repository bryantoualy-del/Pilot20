# Adaptateur d’autorité Forge — PR #92

`src/forge/encounter-host.js` raccorde les intentions de joueur au dépôt transactionnel de combat Pilot20. Il réutilise `combatRepository.commit`, `execute`, les profils épinglés, les règles de réaction et la frontière `transactionView`. Il ne contient aucun second calcul de dégâts ni second stockage des PV.

## Chemin exécuté et testé

1. `forgeActivationIntent` produit une enveloppe RPG Connect `event` de type `forge:activate`. Le joueur choisit une capacité et ses cibles ; aucun dégât, DD, charge, jet ou fait de portée n’est accepté dans cette enveloppe.
2. L’autorité crée `createForgeEncounterHost` avec le combat, la génération et la correspondance entre identités authentifiées, acteurs et capacités autorisées. Ces correspondances proviennent de l’hôte, jamais de la requête.
3. `activate(envelope, authenticatedCharacterId)` vérifie identité, génération, révision et capacité. Les déclencheurs automatiques sont interdits à cette entrée joueur.
4. `rollForgeCommand` prépare les dés à partir du contrat épinglé : avantages/désavantages, critique, JdS et dés d’effets. Les faits supplémentaires viennent exclusivement du fournisseur Encounter `facts`.
5. `commit` valide les règles et enregistre atomiquement effets, dépenses, historique et reçu. Un conflit de révision ou une panne de stockage ne produit aucune confirmation.
6. L’adaptateur renvoie un `event-ack` pour l’événement relayé et une commande `message:gm` contenant uniquement la présentation autorisée. Le serveur historique autorise déjà ce canal. Son ACK de transport n’est pas une confirmation mécanique.
7. Une reconnexion récupère `sync`. Une retransmission identique retrouve la commande enregistrée, sans relancer les dés ni rejouer les animations. Un identifiant identique avec des choix différents est refusé.

Les tests utilisent le vrai moteur et le vrai dépôt sur `MemoryStorage`. Ils ne prétendent pas ouvrir un WebSocket, mesurer la géométrie ou utiliser un appareil physique.

## Exemple d’assemblage dans l’hôte

```js
const host = createForgeEncounterHost({
  repository,
  combatId: session.id,
  generation: resolutionGeneration,
  bindings: {
    brackmard: { actorId: 'brack', abilityIds: approvedForgeAbilityIds },
  },
  facts: encounterFacts,
});
const reply = await host.activate(normalizedEnvelope, authenticatedCharacterId);
transport.send(reply.command);
transport.send(reply.ack);
```

`normalizedEnvelope` doit conserver exactement les champs de l’enveloppe de `forgeActivationIntent` et retirer les métadonnées ajoutées par le serveur (`serverEpoch`, `serverOrder`, `serverTime`). L’identité authentifiée doit venir de la liaison de transport validée par l’hôte. Ne pas l’inférer d’un champ libre de l’intention.

## Raccordement live restant

L’application Encounter actuelle conserve un état historique différent de la session Pilot20. Cet adaptateur n’est **pas encore appelé** par son routeur ni par `web/app/companion.js`. Il ne faut pas faire tourner deux autorités sur les mêmes PV. Avant activation live :

- épingler les instances Forge et leurs contrats lors de la création du combat ; conserver les diagnostics des propriétés non installées ;
- établir une autorité unique sur l’état du combat, avec projection vers l’interface historique ;
- ajouter le routage de `forge:activate`, la présentation de `message:gm.payload.forge` et les décisions réactives ;
- fournir les événements et faits autoritaires de portée/zone/hostilité ;
- réconcilier génération, révision, déconnexion et reprise ; tester cette chaîne réseau avant toute annonce de `forge-runtime-v1`.

Le générateur de dés couvre les attaques et sauvegardes simples des capacités épinglées. Les choix de métamagie, dépenses différées, sorts descriptifs, géométrie et réactions ne sont pas inventés par cet adaptateur. Les décisions réactives continuent d’être résolues par le chemin `respondDecision` existant de l’autorité ; leur transport universel reste à brancher.
