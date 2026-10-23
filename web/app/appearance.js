import { el, button, field, select } from "./dom.js";
import { refreshPortrait } from "../../src/creator/appearance.js";
import { PHYSICAL_FIELDS, portraitPrompt } from '../../src/creator/portrait-prompt.js';
import { classNames } from "./i18n.js";
import { SHOP } from "../../src/creator/equipment-economy.js";
import { compileDraft,draftProgression } from '../../src/creator/model.js';
export function appearanceControls(a, d, update) {
  const w = (fr, en) => (a.state.locale === "fr" ? fr : en);
  const physical=el('div',{class:'physical-fields'},PHYSICAL_FIELDS.map(([key,fr,en])=>field(w(fr,en),el('input',{value:d.physicalDetails?.[key]??'',maxlength:200,onchange:e=>update(x=>{x.physicalDetails??={};x.physicalDetails[key]=e.target.value;})}))));
  const built=compileDraft(a.context,a.config,{...d,confirmed:true});
  const plan=draftProgression(a.context,a.config,d);
  const fallback=[...(plan.startingEquipment?.items??[]),...(d.equipmentMethod==='wealth'?[]:plan.origin?.equipment??[]),...(d.inventoryLedger??[]).map(e=>({name:{fr:e.customName||SHOP[e.itemId]?.name.fr||e.itemId}}))];
  const equipment=(built.character?.equipment??built.equipmentPreview??fallback).map(e=>e.name?.fr??e.customName??e.id);
  const prompt=portraitPrompt(d,a.context,equipment,classNames.fr);
  const promptBox=el('textarea',{readonly:true,rows:8,'aria-label':w('Prompt du portrait','Portrait prompt'),value:prompt});
  const promptDetails=el('details',{},el('summary',{},w('Afficher le prompt','Show prompt')),promptBox);
  const copyStatus=el('p',{role:'status'});
  async function copyPrompt(){
    try{await navigator.clipboard.writeText(prompt);copyStatus.textContent=w('Prompt copié. Collez-le dans ChatGPT, puis importez votre image ici.','Prompt copied. Paste it into ChatGPT, then import your image here.');}
    catch{promptDetails.open=true;promptBox.focus();promptBox.select();copyStatus.textContent=w('La copie automatique est indisponible. Sélectionnez et copiez le prompt ci-dessous.','Automatic copy is unavailable. Select and copy the prompt below.');}
  }
  const generator=el('section',{class:'portrait-generator'},
    button(w('Générer avec ChatGPT','Generate with ChatGPT'),()=>{window.open('https://chatgpt.com/','_blank','noopener,noreferrer');void copyPrompt();}),
    button(w('Copier le prompt','Copy prompt'),copyPrompt,'subtle'),copyStatus,
    el('p',{},w('Collez le prompt dans ChatGPT, générez le portrait, puis importez l’image ci-dessus. Le portrait est facultatif et reste modifiable.','Paste the prompt in ChatGPT, generate a portrait, then import the image above. Portraits are optional and can be changed.')),promptDetails);
  return el(
    "section",
    { class: "appearance-controls" },
    field(
      w("Portrait proposé", "Suggested portrait"),
      select(
        [
          ["", w("Non précisé", "Unspecified")],
          ["femme", w("Femme", "Woman")],
          ["homme", w("Homme", "Man")],
        ],
        d.gender ?? "",
        (e) =>
          update((x) => {
            x.gender = e.target.value;
            refreshPortrait(a.context, x);
          }),
      ),
    ),
    d.portrait
      ? el("img", {
          src: d.portrait,
          alt: w("Portrait du personnage", "Character portrait"),
          width: 96,
          height: 96,
          class: "character-portrait",
        })
      : null,
    physical,
    field(w("Description physique libre", "Physical description"),el("textarea",{value:d.description??"",maxlength:5000,rows:4,onchange:e=>update(x=>{x.description=e.target.value;})})),
    el(
      "small",
      {},
      w(
        "Apparence uniquement, sans effet sur les caractéristiques.",
        "Appearance only; no effect on ability scores.",
      ),
    ),
    el(
      "section",
      {},
      field(
        w("Importer un portrait", "Upload portrait"),
        el("input", {
          type: "file",
          accept: "image/png,image/jpeg,image/webp",
          onchange: async (e) => {
            try {
              const f = e.target.files[0];
              if (!f) return;
              if (f.size > 10000000)
                throw Error(
                  w(
                    "Image trop volumineuse (10 Mo maximum).",
                    "Image too large (10 MB maximum).",
                  ),
                );
              const image = await createImageBitmap(f),
                canvas = document.createElement("canvas");
              canvas.width = canvas.height = 128;
              const side = Math.min(image.width, image.height);
              canvas
                .getContext("2d")
                .drawImage(
                  image,
                  (image.width - side) / 2,
                  (image.height - side) / 2,
                  side,
                  side,
                  0,
                  0,
                  128,
                  128,
                );
              image.close();
              let portrait = canvas.toDataURL("image/jpeg", 0.65);
              if (portrait.length > 10000)
                portrait = canvas.toDataURL("image/jpeg", 0.4);
              if (portrait.length > 10000)
                throw Error(
                  w(
                    "Image trop détaillée, choisissez une autre image.",
                    "Image too detailed; choose another image.",
                  ),
                );
              await update((x) => {
                x.portrait = portrait;
              });
            } catch (error) {
              a.fail(error);
            }
          },
        }),
      ),
      button(w("Utiliser le portrait proposé", "Use suggested portrait"), () =>
        update((x) => refreshPortrait(a.context, x, { force: true })),
      ),
    ),
    generator,
  );
}
