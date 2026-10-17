import { SOURCES } from "../../src/campaign/sources.js";
import { raceLibrary } from "../../src/catalog/race-discovery.js";
import { el, button, field, select, badge } from "./dom.js";
export function raceImage(slug) {
  return el("img", {
    src: `./assets/shared/races/${slug}.webp`,
    alt: "",
    width: 96,
    height: 96,
    loading: "lazy",
    onerror: (e) => {
      e.target.onerror = null;
      e.target.src = "./assets/shared/races/custom.svg";
    },
  });
}
export function raceGallery(a, d, update, { compact = false } = {}) {
  const fr = a.state.locale === "fr",
    w = (f, e) => (fr ? f : e),
    box = el("section", { class: "race-library" }),
    list = el("div", { class: "race-grid" });
  let query = "",
    availability = "",
    source = "",
    family = "";
  function draw() {
    const rows = raceLibrary(a.context, {
      query,
      availability,
      source,
      family,
    });
    list.replaceChildren(
      ...rows.map((f) =>
        el(
          "article",
          { class: "race-card" },
          raceImage(f.slug),
          el("h3", {}, fr ? f.nom_fr : f.name_en),
          badge(
            w(
              {
                available: "Disponible",
                homebrew: "Choix maison",
                "source-disabled": "Source désactivée",
                "pack-missing": "Pack privé manquant",
              }[f.availability],
              {
                available: "Available",
                homebrew: "Homebrew",
                "source-disabled": "Source disabled",
                "pack-missing": "Private pack missing",
              }[f.availability],
            ),
          ),
          el("small", {}, f.source),
          el(
            "small",
            {},
            (f.knownVersions ?? []).map((v) => v.rulesVersionId).join(" · "),
          ),
          f.mechanicalVariants?.length
            ? el(
                "details",
                {},
                el(
                  "summary",
                  {},
                  w("Variantes et versions", "Variants and versions"),
                ),
                el(
                  "ul",
                  {},
                  f.mechanicalVariants.map((v) =>
                    el(
                      "li",
                      {},
                      v.name[a.state.locale] +
                        " · " +
                        v.sourceId +
                        " " +
                        v.sourceVersion,
                    ),
                  ),
                ),
              )
            : null,
          ...f.versions.map((v) => {
            const b = button(
              a.name(v.entry) + " · " + v.rulesVersionId,
              () =>
                update((x) => {
                  x.raceId = v.entry.id;
                  x.subraceId = null;
                  x.origin = a.name(v.entry);
                  x.customOriginRequiresReview = false;
                }),
              d.raceId === v.entry.id ? "active" : "",
            );
            b.disabled = !v.available;
            return b;
          }),
          !f.versions.length
            ? el(
                "small",
                {},
                w(
                  "Importez le pack de cette source pour choisir cette version.",
                  "Import a pack for this source to select this version.",
                ),
              )
            : null,
        ),
      ),
    );
  }
  box.append(
    field(
      w("Rechercher une race", "Search races"),
      el("input", {
        type: "search",
        placeholder: w("Kobold, drakéide…", "Kobold, dragonborn…"),
        oninput: (e) => {
          query = e.target.value;
          draw();
        },
      }),
    ),
    el(
      "div",
      { class: "row" },
      field(
        w("Disponibilité", "Availability"),
        select(
          [
            ["", w("Toutes", "All")],
            ["available", w("Disponibles", "Available")],
            ["pack-missing", w("Pack manquant", "Pack missing")],
            ["source-disabled", w("Source désactivée", "Source disabled")],
            ["homebrew", w("Choix maison", "Homebrew")],
          ],
          "",
          (e) => {
            availability = e.target.value;
            draw();
          },
        ),
      ),
      field(
        w("Source", "Source"),
        select(
          [["", w("Toutes", "All")], ...SOURCES.map((s) => [s.id, s.name])],
          "",
          (e) => {
            source = e.target.value;
            draw();
          },
        ),
      ),
    ),
    field(
      w("Famille", "Family"),
      select(
        [
          ["", w("Toutes les familles", "All families")],
          ...raceLibrary(a.context).map((f) => [
            f.raceFamilyId,
            fr ? f.nom_fr : f.name_en,
          ]),
        ],
        "",
        (e) => {
          family = e.target.value;
          draw();
        },
      ),
    ),
    button(
      w(
        "Importer un pack / gérer les sources",
        "Import a pack / manage sources",
      ),
      () => a.nav("sources"),
    ),
    list,
  );
  draw();
  return box;
}
