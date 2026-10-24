import { el, button, field, select } from "./dom.js";
import { refreshPortrait } from "../../src/creator/appearance.js";
export function appearanceControls(a, d, update) {
  const w = (fr, en) => (a.state.locale === "fr" ? fr : en);
  refreshPortrait(a.context, d);
  return el(
    "section",
    { class: "appearance-controls" },
    field(
      w("Femme / Homme", "Woman / Man"),
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
    el(
      "small",
      {},
      w(
        "Apparence uniquement, sans effet sur les caractéristiques.",
        "Appearance only; no effect on ability scores.",
      ),
    ),
    el(
      "details",
      {},
      el("summary", {}, w("Personnaliser le portrait", "Customize portrait")),
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
  );
}
