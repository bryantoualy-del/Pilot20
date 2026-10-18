# Work4 — Magie des sous-classes et sorts d’origine

Chevalier occulte et Escroc arcanique utilisent la magie2014 : Intelligence, liste de magicien, sorts connus, progression au tiers, aucun grimoire de magicien et aucune préparation quotidienne. Les choix par écoles et les choix libres sont séparés. Main du mage est accordée à l’Escroc arcanique sans occuper un de ses deux autres choix de sorts mineurs. Le multiclassage emploie l’arrondi inférieur au tiers, indépendamment de l’arrondi supérieur de l’Artificier.

Aberrance et Âme mécanique apprennent leurs sorts supplémentaires hors quota. Leur origine, niveau d’acquisition de classe et provenance sont conservés ; ils ne sont pas présentés comme des sorts toujours préparés. Le Créateur offre, à la demande sous les sorts connus, un remplacement de sort d’origine par niveau d’ensorceleur. Le moteur contrôle niveau du sort, écoles, listes autorisées, acquisition initiale et unicité du remplacement au niveau déclaré. Les échanges passés sont des saisies explicites du joueur, jamais une chronologie inventée.

Les résumés des capacités sont originaux, fondés sur les PDF2014 fournis. Les effets de combat restent dans le périmètre manuel prévu pour ce Work. La préparation quotidienne ne s’applique à aucune de ces quatre sous-classes.

Tests : `tests/subclass-casting.test.js` vérifie paliers des tiers-lanceurs, emplacements, écoles, Main du mage, octrois hors quota et échanges invalides. La suite navigateur crée des fixtures synthétiques, ouvre les grimoires et effectue un échange d’origine via le Créateur avant sauvegarde. Contrôler la CI Chromium et WebKit avant validation.
