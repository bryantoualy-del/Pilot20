import { SOURCES } from "../../src/campaign/sources.js";
import {
  raceLibrary,
  RACE_FAMILIES,
} from "../../src/catalog/race-discovery.js";
import {
  selectRace,
  manualRaceVariants,
  selectRaceVariant,
} from "../../src/creator/race-selection.js";
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
export function manualRaceControls(a, d, update) {
  if (!d.manualRace) return null;
  const w = (f, e) => (a.state.locale === "fr" ? f : e);
  const variants = manualRaceVariants(d);
  return el(
    "section",
    { class: "manual-race-controls" },
    el(
      "p",
      { class: "warning-text" },
      w(
        "Race sélectionnée. Traits et bonus à renseigner manuellement et à vérifier avec le MJ ; aucun bonus racial n’est ajouté automatiquement.",
        "Race selected. Enter and review traits and bonuses with your GM; no racial bonus is added automatically.",
      ),
    ),
    variants.length
      ? field(
          w("Variante / version", "Variant / version"),
          select(
            [
              [
                "",
                w(
                  "Race sans variante précisée",
                  "Race without specified variant",
                ),
              ],
              ...variants.map((v) => [
                v.rulesVersionId,
                v.name[a.state.locale] +
                  " · " +
                  v.sourceId +
                  " " +
                  v.sourceVersion,
              ]),
            ],
            d.manualRace.variantId ?? "",
            (e) =>
              update((x) =>
                selectRaceVariant(x, e.target.value, a.state.locale),
              ),
          ),
        )
      : null,
    field(
      w("Vitesse de marche (ft) · à vérifier", "Walking speed (ft) · review"),
      el("input", {
        type: "number",
        min: 0,
        max: 200,
        value: d.manualSpeed ?? 30,
        onchange: (e) =>
          update((x) => {
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 0 && n <= 200) x.manualSpeed = n;
          }),
      }),
    ),
    field(
      w("Traits de race · notes manuelles", "Race traits · manual notes"),
      el(
        "textarea",
        {
          maxlength: 5000,
          onchange: (e) =>
            update((x) => {
              x.traits = e.target.value;
            }),
        },
        d.traits,
      ),
    ),
  );
}
export function raceGallery(a, d, update) {
  const fr = a.state.locale === "fr",
    w = (f, e) => (fr ? f : e);
  const box = el("section", { class: "race-library" }),
    list = el("div", { class: "race-grid" });
  let query = "",
    source = "",
    family = "",
    coverage = "";
  function draw() {
    const rows = raceLibrary(a.context, { query, source, family }).filter(
      (f) =>
        !coverage ||
        (f.versions.some((v) => v.available) ? "automatic" : "manual") ===
          coverage,
    );
    list.replaceChildren(
      ...rows.map((f) => {
        const active = f.versions.filter((v) => v.available);
        const builtin = RACE_FAMILIES.some((v) => v.slug === f.raceFamilyId);
        return el(
          "article",
          { class: "race-card" },
          raceImage(f.slug),
          el("h3", {}, fr ? f.nom_fr : f.name_en),
          badge(
            active.length
              ? w("Disponible", "Available")
              : w("Traits manuels", "Manual traits"),
          ),
          el("small", {}, f.source),
          ...active.map((v) =>
            button(
              a.name(v.entry) + " · " + v.rulesVersionId,
              () =>
                update((x) =>
                  selectRace(a.context, x, v.entry.id, a.state.locale),
                ),
              d.raceId === v.entry.id ? "active" : "",
            ),
          ),
          builtin
            ? button(
                (active.length
                  ? w("Autre variante · ", "Other variant · ")
                  : w("Choisir ", "Choose ")) + (fr ? f.nom_fr : f.name_en),
                () =>
                  update((x) =>
                    selectRace(
                      a.context,
                      x,
                      "manual-race:" + f.raceFamilyId,
                      a.state.locale,
                    ),
                  ),
                d.manualRace?.familyId === f.raceFamilyId ? "active" : "",
              )
            : null,
          !active.length
            ? el(
                "small",
                {},
                w(
                  "Sélection directe ; traits et bonus à renseigner manuellement.",
                  "Select directly; enter traits and bonuses manually.",
                ),
              )
            : null,
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
        );
      }),
    );
  }
  box.append(
    field(
      w("Rechercher une race", "Search races"),
      el("input", {
        type: "search",
        placeholder: "Kobold, drakéide…",
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
        w("Prise en charge", "Support"),
        select(
          [
            ["", w("Toutes", "All")],
            ["automatic", w("Règles disponibles", "Rules available")],
            ["manual", w("Traits manuels", "Manual traits")],
          ],
          "",
          (e) => {
            coverage = e.target.value;
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
    list,
  );
  draw();
  return box;
}
