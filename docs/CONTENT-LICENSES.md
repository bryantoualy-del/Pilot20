# Contenu et provenance

Pilot20 V0.2 utilise exclusivement les règles D&D 5e 2014. Le catalogue minimal est séparé du moteur dans src/catalog ; il ne contient pas un corpus complet de règles.

## Attribution SRD 5.1

This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of
the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The
SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at
https://creativecommons.org/licenses/by/4.0/legalcode.

Official 2014 CC BY source: https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf

Modifications : sélection de données mécaniques, traduction de libellés et structuration en JSON ; aucun soutien ou parrainage de Wizards of the Coast n'est suggéré. Les tables de calcul 2014 et les profils explicitement marqués SRD reposent sur cette fondation. Cette attribution porte sur le contenu concerné et n'accorde pas une licence générale sur tous les fichiers logiciels du projet.

Sources officielles vérifiées le 16 octobre 2026 : https://www.dndbeyond.com/srd et https://www.dndbeyond.com/creator-faq. Ne pas substituer SRD 5.2 ou les règles 2024 aux tables 2014.

## Extensions

Chaque élément porte kind (srd/homebrew/private), document, license et url. Un élément SRD doit déclarer SRD-5.1 / CC-BY-4.0. Le validateur de catalogue refuse de publier un élément déclaré private. Ce contrôle de métadonnées ne vérifie pas la propriété intellectuelle d'un texte arbitraire : l'ajout d'un catalogue exige une revue de sa provenance.

Les fixtures utilisent des scénarios synthétiques écrits pour Pilot20 ; les cas de manœuvre et d'attaque de sort génériques ne sont pas des reproductions du texte d'un supplément. Aucun texte de Kobold, Collège du Glamour, don, invocation ou objet propriétaire n'a été copié des Companions.

Le contenu fourni par l'utilisateur reste une extension distincte. Le champ private ne rend pas privée une branche GitHub publique : aucun contenu privé non autorisé ne doit y être poussé.

## V0.2c additions

The English class reference text and 319 spell descriptions are extracted from the official **SRD 5.1 CC BY 4.0** PDF linked above. The source PDF SHA-256 and independently extracted spell lists are recorded in `src/catalog/data/srd51-manifest.json`. Mechanical progressions and options are transcribed into declarative data. PDF page headers and line breaks are removed, spell apostrophes/hyphens are normalized; no 2024 source is substituted. The attribution above applies to this material. `name.fr` is an English fallback in the expanded catalogue, not a reproduction of commercial French translations. No Xanathar/Tasha text, illustration, or full protected Artificer/subclass definition is distributed.
