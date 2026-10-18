# P11 — Points de vie dans le parcours unique

Une étape de points de vie suit les caractéristiques. Elle propose les valeurs fixes des dés ou les résultats de dés lancés. Le premier niveau du personnage utilise toujours le maximum du dé de sa classe initiale. Les niveaux suivants utilisent la valeur fixe prévue ou un résultat explicite compris entre 1 et le dé de la classe correspondante.

Les résultats sont conservés par classe et niveau de classe. Revenir en arrière, changer temporairement de méthode ou réduire puis réaugmenter le niveau ne les efface pas. Un nouveau niveau exige son propre résultat si la méthode par dés est active. Le bouton de lancer est une action explicite ; la compilation ne génère jamais de dés automatiquement. Un joueur peut saisir les résultats de ses dés physiques.

Le moteur applique le modificateur actuel de Constitution à chaque niveau, avec un gain minimal de 1 PV par niveau. Les bonus raciaux restent distincts. Le multiclassage ne donne pas un dé maximal pour le premier niveau de chaque nouvelle classe : seul le premier niveau du personnage le fait. Une chronologie de progression renseignée détermine l’ordre des dés ; aucune chronologie réelle n’est inventée pour un import ancien.

La persistance ajoute seulement des champs facultatifs au brouillon ; le personnage utilise le contrat de progression déjà existant. Les anciennes fiches à valeurs fixes conservent leur compilation habituelle. Le constructeur de production vérifie également les résultats explicites reçus directement.

Validation locale : cinq tests couvrant les dés des treize classes, résultats hors plage, Constitution négative et positive, nain des collines, changement de niveau et de méthode, choix conservés, multiclassage chronologique et action de lancer. Le scénario navigateur renseigne neuf dés d’un Barde10 puis revient en arrière et vérifie leur conservation. CI Node22/24 et Chromium/WebKit à confirmer sur le commit exact.

Les règles supplémentaires de PV de certaines sous-classes et de dons doivent encore être vérifiées avec les lots de contenu correspondants. Ce lot n’annonce pas leur intégration exhaustive.
