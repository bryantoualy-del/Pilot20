export const PHYSICAL_FIELDS = Object.freeze([
  ['age','Âge','Age'],['height','Taille','Height'],['weight','Poids','Weight'],
  ['gender','Genre (précisions)','Gender (details)'],['skin','Peau','Skin'],
  ['hair','Cheveux','Hair'],['eyes','Yeux','Eyes'],['facialHair','Pilosité','Facial hair'],
  ['marks','Signes particuliers','Distinctive marks'],
]);
export function physicalDescription(d) {
  return PHYSICAL_FIELDS.filter(([key])=>d.physicalDetails?.[key]?.trim())
    .map(([key,label])=>label+' : '+d.physicalDetails[key].trim()).join('\n');
}
/** Plain French prompt, no remote generation and no implicit personal-data transfer. */
export function portraitPrompt(d,context,equipment=[],classLabels={}) {
  const name=id=>context.index.get(id)?.name?.fr??id;
  return [
    'Crée un portrait de personnage de D&D 5e, fantasy semi-réaliste, dans une direction artistique cohérente avec la Compagnie Créole : illustration peinte détaillée, matières crédibles, lumière cinématographique, couleurs riches et maîtrisées, visage expressif et silhouette lisible. Cadrage vertical, personnage au centre, fond fantasy discret, sans texte ni interface.',
    d.name?'Nom : '+d.name:'',
    'Race : '+(d.raceId?name(d.raceId):d.origin||'non précisée')+(d.subraceId?' — '+name(d.subraceId):''),
    'Classe : '+d.classes.map(c=>(classLabels[c.id]??name(context.index.class(c.id)?.id??c.id))+' niveau '+c.level+(c.subclassId?' — '+name(c.subclassId):'')).join(' / '),
    d.gender?'Genre : '+d.gender:'',physicalDescription(d),d.description?'Description physique : '+d.description:'',
    equipment.length?'Équipement visible : '+equipment.join(', '):'',
    d.equipmentNotes?'Précisions sur l’équipement : '+d.equipmentNotes:'',
    'Respecte les traits anatomiques de la race et les indications ci-dessus. N’ajoute pas d’ailes ou d’accessoires non demandés. Le portrait doit exprimer la personnalité du personnage.',
  ].filter(Boolean).join('\n\n');
}
