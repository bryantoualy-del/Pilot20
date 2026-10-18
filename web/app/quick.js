import { assetImage } from "./asset-registry.js";
import { WEAPONS, ARMORS } from "../../src/catalog/equipment.js";
import { choiceName, optionName, issueMessage } from "./editor.js";
import { el, button, field, select, check, badge } from "./dom.js";
import {
  newDraft,
  draftProgression,
  compileDraft,
  retainDecision,
  restoreDecision,
} from "../../src/creator/model.js";
import { recommendQuick, quickDecisions } from "../../src/creator/quick.js";
import { previewDraft } from "../../src/creator/experience.js";
import { previewView } from "./experience.js";
import { appearanceControls } from "./appearance.js";
import {
  raceOptions,
  raceSelection,
  selectRace,
} from "../../src/creator/race-selection.js";
import { raceFamily } from "../../src/creator/appearance.js";
import { raceGallery, raceImage, manualRaceControls } from "./races.js";
import { openRaceEditor } from "./race-editor.js";
export async function renderQuick(main, d, a) {
  const fr = a.state.locale === "fr",
    w = (f, e) => (fr ? f : e);
  const root = el("section", { class: "quick-creator" });
  main.append(root);
  const record = await a.library.get(d.id),
    expectedCharacterRevision = record?.definition.revision ?? null;
  async function update(fn) {
    fn(d);
    d.confirmed = d.reviewed = d.finalized = false;
    await a.autosave(d);
    await draw();
  }
  async function go(n) {
    d.quickScreen = n;
    await a.autosave(d);
    await draw();
    root.querySelector("h1")?.focus();
    window.scrollTo({ top: 0 });
  }
  async function advanced(step) {
    d.mode = "guided";
    d.step = step;
    d.returnToQuick = d.quickScreen ?? 0;
    await a.autosave(d);
    await a.render();
  }
  async function draw() {
    const n = d.quickScreen ?? 0,
      r = draftProgression(a.context, a.config, d),
      cls = d.classes[0],
      ce = a.context.index.class(cls.id);
    const header = el(
      "header",
      { class: "quick-header" },
      el(
        "div",
        {},
        badge("Pilot20 · Click & Play"),
        el(
          "h1",
          { tabindex: -1 },
          [
            w("Qui voulez-vous incarner ?", "Who will you play?"),
            w("Donnez-lui votre style", "Make it yours"),
            w("Prêt à jouer", "Ready to play"),
          ][n],
        ),
        el(
          "small",
          {},
          a.cls(cls.id) +
            " " +
            cls.level +
            (cls.subclassId
              ? " · " + a.name(a.context.index.get(cls.subclassId))
              : "") +
            " · " +
            w("Étape ", "Step ") +
            (n + 1) +
            "/3" +
            " · " +
            r.issues.filter((i) =>
              ["required-choice", "origin-choice"].includes(i.code),
            ).length +
            w(" choix à faire", " choices remaining"),
        ),
      ),
      el(
        "div",
        { class: "row" },
        button(w("Mon personnage", "My character"), () => openCharacter()),
        button(w("Guidé", "Guided"), () => advanced(d.step)),
        button(w("Expert", "Expert"), async () => {
          d.mode = "expert";
          await a.autosave(d);
          await a.render();
        }),
      ),
    );
    const status = el(
      "small",
      { id: "draft-save-state", role: "status" },
      d.updatedAt ? w("Sauvegardé", "Saved") : w("Enregistrement…", "Saving…"),
    );
    const body = el("div", { class: "panel quick-body" });
    root.replaceChildren(header, status, body);
    if (!ce) {
      body.append(
        el(
          "p",
          { class: "warning-text" },
          w(
            "Cette classe est conservée mais sa source est désactivée. Réactivez la source pour poursuivre.",
            "This class is preserved but its source is disabled. Enable the source to continue.",
          ),
        ),
        button(a.t("sources"), () => a.nav("sources")),
      );
      return;
    }
    if (n === 0) {
      body.append(
        el(
          "div",
          { class: "row" },
          assetImage("class", cls.id),
          raceFamily(a.context, d) ? raceImage(raceFamily(a.context, d)) : null,
        ),
        field(
          a.t("name"),
          el("input", {
            value: d.name,
            maxlength: 200,
            onchange: (e) => update((x) => (x.name = e.target.value)),
          }),
        ),
        el(
          "div",
          { class: "quick-identity" },
          field(
            w("Classe", "Class"),
            select(
              a.context.index
                .list("class")
                .map((c) => [c.data.classId, a.cls(c.data.classId)]),
              cls.id,
              (e) =>
                update((x) => {
                  x.classes[0] = {
                    id: e.target.value,
                    level: cls.level,
                    subclassId: null,
                  };
                  x.quickRecommendationsAccepted = false;
                }),
            ),
          ),
          field(
            a.t("level"),
            el("input", {
              type: "number",
              min: 1,
              max: 20,
              value: cls.level,
              onchange: (e) =>
                update((x) => {
                  const v = Number(e.target.value);
                  if (Number.isInteger(v) && v >= 1 && v <= 20)
                    x.classes[0].level = v;
                  x.quickRecommendationsAccepted = false;
                }),
            }),
          ),
        ),
        field(
          a.t("origin"),
          select(
            [
              ["", w("Choisir une race", "Choose a race")],
              ...raceOptions(a.context, a.state.locale),
            ],
            raceSelection(d),
            (e) =>
              update((x) =>
                selectRace(a.context, x, e.target.value, a.state.locale),
              ),
          ),
        ),
        button(w("Créer une race", "Create a race"), () =>
          openRaceEditor(a, d, update),
        ),
      );
      if (r.origin?.race?.data.homebrewDefinition)
        body.append(
          button(
            w("Modifier cette race maison", "Edit this homebrew race"),
            () =>
              openRaceEditor(
                a,
                d,
                update,
                r.origin.race.data.homebrewDefinition,
              ),
          ),
        );
      if (r.origin?.race?.data.subraces.length)
        body.append(
          field(
            a.t("subrace"),
            select(
              [
                ["", a.t("choose")],
                ...r.origin.race.data.subraces.map((s) => [
                  s.id,
                  s.name[a.state.locale],
                ]),
              ],
              d.subraceId ?? "",
              (e) => update((x) => (x.subraceId = e.target.value || null)),
            ),
          ),
        );
      body.append(
        ...[
          appearanceControls(a, d, update),
          manualRaceControls(a, d, update),
        ].filter(Boolean),
      );
      const gallery = el(
        "details",
        {},
        el("summary", {}, w("Explorer les 59 peuples", "Explore 59 peoples")),
        raceGallery(a, d, update),
      );
      body.append(gallery);
      const next = button(
        a.t("next"),
        async () => {
          if (
            !d.name.trim() ||
            (!d.raceId && !d.manualRace) ||
            (r.origin?.race?.data.subraces.length && !d.subraceId)
          ) {
            a.notice?.(
              w(
                "Complétez votre identité et votre race.",
                "Complete your identity and race.",
              ),
            );
            return;
          }
          await go(1);
        },
        "primary",
      );
      next.disabled =
        !d.name.trim() ||
        (!r.origin?.race && !d.manualRace) ||
        (r.origin?.race?.data.subraces.length && !d.subraceId);
      body.append(next);
    }
    if (n === 1) {
      if (cls.level >= ce.data.subclassLevel) {
        body.append(
          el("h2", {}, a.t("subclass")),
          el("p", {}, w("Ce choix vous appartient.", "This choice is yours.")),
          el(
            "div",
            { class: "class-grid" },
            a.context.index
              .list("subclass")
              .filter((s) => s.data.classId === cls.id)
              .map((s) =>
                button(
                  [
                    el("strong", {}, a.name(s)),
                    el(
                      "small",
                      {},
                      s.data.summary?.[a.state.locale] ??
                        (s.id === "srd51:champion"
                          ? w(
                              "Un combattant direct, centré sur les prouesses martiales.",
                              "A direct martial specialist focused on physical prowess.",
                            )
                          : s.id === "srd51:college-of-lore"
                            ? w(
                                "Un érudit polyvalent qui soutient le groupe et élargit sa magie.",
                                "A versatile scholar who supports the party and broadens their magic.",
                              )
                            : undefined) ??
                        w(
                          "Une spécialisation qui définit votre façon de jouer.",
                          "A specialization that defines how you play.",
                        ),
                    ),
                    el("small", {}, s.source.document),
                  ],
                  () =>
                    update((x) => {
                      if (cls.subclassId) retainDecision(x, "subclass", cls.id);
                      cls.subclassId = s.id;
                    }),
                  cls.subclassId === s.id ? "active" : "",
                ),
              ),
          ),
        );
      } else
        body.append(
          el(
            "p",
            {},
            w(
              "La sous-classe se débloque au niveau ",
              "Subclass unlocks at level ",
            ) +
              ce.data.subclassLevel +
              ".",
          ),
        );
      if (d.retainedDecisions?.some((v) => v.kind === "subclass"))
        body.append(
          el(
            "details",
            {},
            el(
              "summary",
              {},
              w("Sous-classes précédentes", "Previous subclasses"),
            ),
            d.retainedDecisions.map((v, i) =>
              v.kind === "subclass"
                ? button(
                    v.values
                      .map((id) => a.name(a.context.installed.get(id)))
                      .join(", "),
                    () => update((x) => restoreDecision(x, i)),
                  )
                : null,
            ),
          ),
        );
      body.append(
        el(
          "p",
          {},
          w(
            "Caractéristiques, historique et compétences seront proposés à l’écran suivant. Les sorts et dons restent à choisir.",
            "Scores, background and skills will be recommended next. You choose spells and feats.",
          ),
        ),
        button(a.t("back"), () => go(0)),
      );
      const next = button(
        a.t("next"),
        async () => {
          d.quickRecommendation = recommendQuick(a.context, a.config, d);
          await go(2);
        },
        "primary",
      );
      next.disabled = cls.level >= ce.data.subclassLevel && !cls.subclassId;
      body.append(next);
    }
    if (n === 2) {
      const rec =
          d.quickRecommendation ?? recommendQuick(a.context, a.config, d),
        rr = draftProgression(a.context, a.config, rec);
      body.append(
        d.portrait
          ? el("img", {
              src: d.portrait,
              alt: w("Portrait du personnage", "Character portrait"),
              width: 96,
              height: 96,
              class: "character-portrait",
            })
          : "",
        el("h2", {}, d.name),
        d.gender
          ? badge(
              d.gender === "femme" ? w("Femme", "Woman") : w("Homme", "Man"),
            )
          : "",
        el(
          "p",
          {},
          (d.origin || a.name(a.context.index.get(d.raceId))) +
            " · " +
            a.cls(cls.id) +
            " " +
            cls.level,
        ),
        el(
          "h3",
          {},
          d.quickRecommendationsAccepted
            ? w("Choix confirmés", "Confirmed choices")
            : w("Recommandations à confirmer", "Recommendations to confirm"),
        ),
        el(
          "small",
          { class: "warning-text" },
          !d.quickRecommendationsAccepted
            ? w(
                "Scores de base proposés (bonus de race ajoutés après confirmation)",
                "Proposed base scores (racial bonuses applied after acceptance)",
              )
            : !r.valid || !d.confirmed
              ? w(
                  "Valeurs provisoires — complétez et confirmez vos choix",
                  "Provisional values — complete and confirm your choices",
                )
              : w("Valeurs validées", "Validated values"),
        ),
        el(
          "p",
          {},
          Object.entries(
            d.quickRecommendationsAccepted
              ? (r.scores ?? d.scores)
              : rec.scores,
          )
            .map(([k, v]) => a.label(k) + " " + v)
            .join(" · "),
        ),
        el(
          "p",
          {},
          w("Historique : ", "Background: ") +
            (rr.origin?.background?.name ?? rec.background.name),
        ),
        el(
          "p",
          {},
          w("Équipement : ", "Equipment: ") +
            (ARMORS[rec.equipment]?.name?.[a.state.locale] ?? rec.equipment) +
            " · " +
            (rec.weapons ?? [])
              .map((id) => WEAPONS[id]?.name?.[a.state.locale] ?? id)
              .join(", "),
        ),
        el(
          "p",
          {},
          Object.entries(rec.selections)
            .map(([k, v]) => v.map((id) => optionName(id, a)).join(", "))
            .join(" · "),
        ),
      );
      if (!d.quickRecommendationsAccepted)
        body.append(
          button(
            w("Accepter ces recommandations", "Accept recommendations"),
            async () => {
              const safe = recommendQuick(a.context, a.config, d);
              delete d.quickRecommendation;
              Object.assign(d, safe);
              d.quickRecommendationsAccepted = true;
              await a.autosave(d);
              await draw();
            },
            "primary",
          ),
        );
      if (d.manualRace)
        body.append(
          el(
            "p",
            { class: "warning-text" },
            w(
              "Traits et bonus de race manuels : relisez vos scores finaux et vos notes avec le MJ.",
              "Manual racial traits and bonuses: review final scores and notes with your GM.",
            ),
          ),
        );
      const decisions = quickDecisions(a.context, a.config, d);
      if (d.quickRecommendationsAccepted)
        for (const q of decisions.choices) {
          const values =
            (q.originChoice ? d.originSelections : d.selections)?.[q.id] ?? [];
          body.append(
            el(
              "fieldset",
              { "data-choice-id": q.id },
              el(
                "legend",
                {},
                q.originChoice ? (q.key ?? q.id) : choiceName(q, a),
              ),
              el("p", {}, w("Choisissez ", "Choose ") + q.count),
              q.options.map((id) =>
                check(optionName(id, a), values.includes(id), (e) =>
                  update((x) => {
                    const target = q.originChoice
                      ? (x.originSelections ??= {})
                      : x.selections;
                    const old = target[q.id] ?? [];
                    target[q.id] = e.target.checked
                      ? [...new Set([...old, id])]
                      : old.filter((v) => v !== id);
                  }),
                ),
              ),
            ),
          );
        }
      body.append(
        button(w("Modifier les recommandations", "Edit recommendations"), () =>
          advanced("scores"),
        ),
      );
      if (d.quickRecommendationsAccepted) {
        body.append(
          check(a.t("confirmation"), d.confirmed, async (e) => {
            d.confirmed = e.target.checked;
            await a.autosave(d);
            await draw();
          }),
          check(a.t("reviewed"), d.reviewed, async (e) => {
            d.reviewed = e.target.checked;
            await a.autosave(d);
            await draw();
          }),
        );
        const c = compileDraft(a.context, a.config, d);
        if (c.issues.length)
          body.append(
            el(
              "ul",
              {},
              c.issues.map((i) => el("li", {}, issueMessage(i, r, a))),
            ),
          );
        const save = button(
          w("Sauvegarder et ouvrir le Companion", "Save and open Companion"),
          async () => {
            try {
              const result = compileDraft(a.context, a.config, d);
              if (!result.valid) return;
              await a.autosave(d);
              const saved = await a.drafts.finalize(d, result.character, {
                expectedCharacterRevision,
                expectedDraftRevision: d.revision,
                spellbook: result.spellbook,
              });
              Object.assign(d, saved.draft);
              await a.nav("companion", d.id);
            } catch (e) {
              a.fail(e);
            }
          },
          "primary",
        );
        save.disabled = !c.valid;
        body.append(save);
      }
      body.append(button(a.t("back"), () => go(1)));
    }
  }
  function openCharacter() {
    const report = draftProgression(a.context, a.config, d),
      content = el(
        "section",
        {},
        el("h2", {}, w("Mon personnage", "My character")),
        el(
          "p",
          {},
          report.valid
            ? w("Valeurs calculées", "Calculated values")
            : w(
                "Valeurs provisoires — choix à compléter",
                "Provisional values — incomplete choices",
              ),
        ),
      );
    for (const [title, value, screen, step] of [
      [
        a.t("origin"),
        d.origin || a.name(a.context.index.get(d.raceId)),
        0,
        "origin",
      ],
      [
        a.t("class"),
        d.classes.map((c) => a.cls(c.id) + " " + c.level).join(", "),
        0,
        "class",
      ],
      [
        a.t("subclass"),
        d.classes
          .map((c) => a.name(a.context.index.get(c.subclassId)))
          .filter(Boolean)
          .join(", "),
        1,
        "features",
      ],
      [
        a.t("scores"),
        Object.entries(report.scores ?? d.scores)
          .map(([k, v]) => a.label(k) + " " + v)
          .join(", "),
        2,
        "scores",
      ],
      [
        a.t("spells"),
        Object.values(d.selections)
          .flat()
          .filter((id) => a.context.index.get(id)?.type === "spell")
          .map((id) => a.name(a.context.index.get(id)))
          .join(", "),
        2,
        "spells",
      ],
      [a.t("equipment"), d.equipment, 2, "spells"],
    ])
      content.append(
        el(
          "section",
          {},
          el("h3", {}, title),
          badge(
            step === "origin" && d.raceId && !a.context.index.get(d.raceId)
              ? w("Non disponible", "Unavailable")
              : !value
                ? w("Manquant", "Missing")
                : ["scores", "spells"].includes(step) &&
                    !d.quickRecommendationsAccepted &&
                    !d.quickEdited
                  ? w("Recommandé, non confirmé", "Recommended, unconfirmed")
                  : w("Choisi", "Chosen"),
          ),
          el("p", {}, value || "—"),
          button(w("Modifier", "Edit"), async () => {
            document.querySelector("#dialog").close();
            if (["origin", "class", "features"].includes(step))
              await go(screen);
            else await advanced(step);
          }),
        ),
      );
    content.append(
      el(
        "p",
        {},
        w("Sources : ", "Sources: ") + a.config.enabledSourceIds.join(", "),
      ),
      previewView(a, previewDraft(a.context, a.config, d)),
    );
    a.modal(content);
  }
  await draw();
}
