import { LANGUAGES } from './origins.js';

const trait = (id, fr, en, description, extra = {}) => ({
  id, name: { fr, en }, description, automation: 'manual', ...extra,
});

/** Campaign variant: original summaries, distinct from the Ravenloft lineage. */
export const compagnieCreole = {
  kind: 'catalog', schemaVersion: 3, ruleset: 'dnd5e-2014',
  id: 'pilot20:compagnie-creole',
  items: [{
    id: 'homebrew:race:dhampir-compagnie-creole', type: 'race',
    name: { fr: 'Dhampir — Compagnie Créole', en: 'Dhampir — Compagnie Créole' },
    source: {
      kind: 'homebrew',
      document: 'Création maison — inspirée du dhampir de Kobold Press (Midgard Heroes Handbook)',
      license: 'Pilot20-original-summary', url: 'https://koboldpress.com/errata/',
    },
    data: {
      ruleset: 'dnd5e-2014', rulesSourceId: 'homebrew',
      raceFamilyId: 'dhampir',
      rulesVersionId: 'dhampir-compagnie-creole/homebrew-v1',
      aliases: ['Kentaro', 'Dhampire', 'Kobold Press'],
      summary: {
        fr: 'À mi-chemin entre les vivants et les morts, ces dhampirs possèdent une morsure qui nourrit leur vitalité et un charme surnaturel. Cette variante maison reprend les traits utilisés pour Kentaro dans la campagne de la Compagnie Créole.',
        en: 'Between life and death, these dhampirs sustain their vitality through their bite and wield supernatural charm. This homebrew variant follows Kentaro’s traits in the Compagnie Créole campaign.',
      },
      automation: { status: 'partial', handler: null, limits: [
        'Bite eligibility, attack, damage and temporary hit points require player/GM resolution. Consume its use only when temporary hit points are gained.',
        'Predatory Charm and conditional saving throw advantages require player/GM resolution.',
      ] },
      size: 'medium', creatureType: 'humanoid', speed: 30,
      bonuses: { cha: 2, dex: 1 }, languages: ['common'],
      skills: ['persuasion'], proficiencies: [], subraces: [], spells: [],
      resistances: ['necrotic'], vulnerabilities: ['radiant'],
      choices: [{ key: 'language', kind: 'language', count: 1,
        options: LANGUAGES.filter(id => id !== 'common'),
        label: { fr: 'Langue supplémentaire', en: 'Additional language' } }],
      traits: [
        trait('darkvision', 'Vision dans le noir', 'Darkvision',
          'Vision dans le noir à 18 m : la pénombre est perçue comme une lumière vive, et l’obscurité comme une lumière faible, sans couleurs.'),
        trait('dark-thirst', 'Soif ténébreuse', 'Dark Thirst',
          'Morsure par une attaque sans arme contre une cible neutralisée ou que vous avez empoignée : 1 dégât perforant. Si elle a du sang et n’est ni artificielle ni morte-vivante, vous pouvez vous nourrir pour infliger des dégâts nécrotiques égaux au modificateur de Charisme (minimum 1) et gagner autant de PV temporaires que de dégâts nécrotiques infligés. Dépensez la réserve seulement lorsque vous gagnez ces PV temporaires ; elle revient après un repos court ou long. Attaque, dégâts et PV temporaires à résoudre à la table.',
          { activation: { cost: 'action', target: 'selected', maxTargets: 1 }, resource: { max: 1, recovery: 'short' } }),
        trait('predatory-charm', 'Charme prédateur', 'Predatory Charm',
          'Vous maîtrisez Persuasion. Après au moins une minute d’échange avec un humanoïde que votre groupe n’a pas attaqué depuis 24 heures, votre prochain test de Charisme contre lui bénéficie de l’avantage. Ce bénéfice ne peut viser à nouveau cet humanoïde avant 24 heures. Un 20 naturel à ce test le rend consentant pour votre morsure. Le MJ suit les cibles et valide les conditions.'),
        trait('vampiric-resilience', 'Résistance vampirique', 'Vampiric Resilience',
          'Résistance aux dégâts nécrotiques et avantage aux jets de sauvegarde contre les maladies.'),
        trait('homebrew-poison-resilience', 'Vitalité des morts-vivants — variante maison', 'Undead Vitality — homebrew variant',
          'Particularité maison de Kentaro : avantage aux jets de sauvegarde contre l’état Empoisonné. Ce trait ne confère ni immunité à cet état ni résistance aux dégâts de poison.'),
        trait('homebrew-radiant-vulnerability', 'Vulnérabilité radiante — variante maison', 'Radiant Vulnerability — homebrew variant',
          'Particularité maison de Kentaro : vulnérabilité aux dégâts radiants, qui sont doublés après application des autres modificateurs pertinents.'),
      ],
    },
  }],
};
