import { el, button, field, select, check, badge } from "./dom.js";
import { assetImage } from "./asset-registry.js";
import { classInfo } from "./class-info.js";
import {
  discoveryMatches,
  comparisonPlan,
  previewDraft,
  primaryAbilities,
} from "../../src/creator/experience.js";
import { draftProgression } from "../../src/creator/model.js";
const labels = {
  melee: ["Corps à corps", "Melee"],
  ranged: ["À distance", "Ranged"],
  magic: ["Magie", "Magic"],
  support: ["Soutien", "Support"],
  protection: ["Protection", "Protection"],
  control: ["Contrôle", "Control"],
  exploration: ["Exploration", "Exploration"],
  simple: ["Prise en main simple", "Easy to learn"],
};
export const words = (a) => (fr, en) => (a.state.locale === "fr" ? fr : en);
export function helpPanel(a, expert) {
  const w = words(a);
  const items = [
    [
      w("Caractéristiques", "Ability scores"),
      w(
        "Les scores alimentent les modificateurs du moteur : attaques, sauvegardes et certaines ressources. Consultez Base, Race et Améliorations avant de confirmer.",
        "Scores feed engine modifiers: attacks, saves and some resources. Review Base, Race and Improvements before confirming.",
      ),
    ],
    [
      w("Maîtrises et expertise", "Proficiency and expertise"),
      w(
        "La maîtrise ajoute le bonus de maîtrise aux jets concernés ; l’expertise double ce bonus. La provenance indique ce que votre classe ou votre historique vous accorde.",
        "Proficiency adds your proficiency bonus to relevant rolls; expertise doubles it. Provenance shows grants from class or background.",
      ),
    ],
    [
      w("Sorts et emplacements", "Spells and slots"),
      w(
        "Les sorts connus ou inscrits au grimoire constituent votre répertoire. Les sorts préparés sont ceux disponibles pour la journée. Les emplacements servent à lancer les sorts et se dépensent séparément.",
        "Known or spellbook spells form your repertoire. Prepared spells are available for the day. Slots pay for casting and are tracked separately.",
      ),
    ],
    [
      w("Repos et ressources", "Rest and resources"),
      w(
        "Chaque ressource indique sa récupération : repos court ou long. Une capacité manuelle nécessite une déclaration ou une vérification ; cela ne signifie pas que votre choix est invalide.",
        "Each resource specifies short or long rest recovery. A manual ability needs a declaration or review; that does not make the choice invalid.",
      ),
    ],
    [
      w("Sources et prérequis", "Sources and prerequisites"),
      w(
        "Les règles automatiques dépendent des sources installées et activées. Toutes les races restent sélectionnables avec des traits manuels. Un changement de source conserve les choix à revoir.",
        "Automatic rules depend on installed, enabled sources. All races remain selectable with manual traits. Source changes preserve decisions for review.",
      ),
    ],
    [
      w("Dons et sous-classes", "Feats and subclasses"),
      w(
        "Les sous-classes se débloquent au niveau défini par la classe. Un don remplace une amélioration seulement si l’option et ses prérequis sont disponibles.",
        "Subclasses unlock at the class-defined level. Feats replace an improvement only when the option and prerequisites are available.",
      ),
    ],
  ];
  return el(
    "details",
    { class: expert ? "context-help expert" : "context-help" },
    el("summary", {}, w("Comprendre mes choix", "Understand my choices")),
    items.map(([title, text]) =>
      el("details", {}, el("summary", {}, title), el("p", {}, text)),
    ),
  );
}
export function previewView(a, snapshot, title) {
  const w = words(a),
    { plan, report, stats } = snapshot;
  const s = stats;
  return el(
    "section",
    { class: "character-preview" },
    badge(title ?? w("Actuel", "Current")),
    plan.portrait
      ? el("img", {
          src: plan.portrait,
          alt: "",
          class: "preview-portrait",
          width: 64,
          height: 64,
        })
      : assetImage("class", plan.classes[0]?.id),
    el("h3", {}, plan.name || w("Votre héros", "Your hero")),
    el(
      "p",
      {},
      plan.classes.map((c) => a.cls(c.id) + " " + c.level).join(" / "),
    ),
    el(
      "small",
      {},
      report.origin?.race ? a.name(report.origin.race) : plan.origin,
    ),
    plan.classes.map((c) =>
      c.subclassId
        ? el(
            "small",
            {},
            a.context.index.get(c.subclassId)
              ? a.name(a.context.index.get(c.subclassId))
              : w("Contenu indisponible", "Unavailable content"),
          )
        : null,
    ),
    el(
      "div",
      { class: "preview-stats" },
      [
        [a.t("hp"), s?.maxHp ?? snapshot.hp],
        [a.t("ac"), s?.ac],
        [w("Initiative", "Initiative"), s?.initiative],
        [w("Vitesse", "Speed"), s?.speed],
        [a.t("proficiencyBonus"), s?.proficiency],
      ].map(([k, v]) =>
        el("div", {}, el("small", {}, k), el("strong", {}, v ?? "—")),
      ),
    ),
    el(
      "p",
      {},
      Object.entries(snapshot.scores ?? {})
        .map(([k, v]) => a.label(k).slice(0, 3) + " " + v)
        .join(" · "),
    ),
    !s
      ? el(
          "p",
          { class: "warning-text" },
          w(
            "Complétez les choix pour calculer les valeurs « — ».",
            "Complete decisions to calculate “—” values.",
          ),
        )
      : null,
    el(
      "details",
      {},
      el(
        "summary",
        {},
        w("Ressources et capacités", "Resources and abilities"),
      ),
      s
        ? Object.entries(s.resources).map(([id, r]) =>
            el(
              "p",
              {},
              id + " · " + (r.max ?? "∞") + " · " + (r.recovery ?? "—"),
            ),
          )
        : report.resources.map((r) =>
            el("p", {}, r.id + " · " + (r.max ?? "∞") + " · " + r.recovery),
          ),
      report.features.map((id) => el("p", {}, a.name(a.context.index.get(id)))),
    ),
    s
      ? el(
          "details",
          {},
          el("summary", {}, w("Attaques et magie", "Attacks and magic")),
          Object.entries(s.weapons).map(([id, v]) =>
            el("p", {}, id + " · +" + v.attack),
          ),
          Object.entries(s.casting).map(([id, v]) =>
            el("p", {}, a.cls(id) + " · DD " + v.dc + " · +" + v.attack),
          ),
        )
      : null,
  );
}
export function openSimulation(a, d, mutate, onConfirm, title) {
  const w = words(a),
    current = previewDraft(a.context, a.config, d),
    simulated = previewDraft(a.context, a.config, d, mutate);
  const changes = ["maxHp", "ac", "initiative", "speed"].filter(
    (k) => current.stats?.[k] !== simulated.stats?.[k],
  );
  a.modal(
    el(
      "section",
      { class: "simulation" },
      el("h2", {}, title ?? w("Simuler un choix", "Simulate a choice")),
      el(
        "p",
        {},
        w(
          "Le brouillon reste intact jusqu’à confirmation.",
          "The draft stays unchanged until confirmation.",
        ),
      ),
      el(
        "div",
        { class: "simulation-grid" },
        previewView(a, current, w("Actuel", "Current")),
        previewView(a, simulated, w("Simulé", "Simulated")),
      ),
      el(
        "p",
        { role: "status" },
        changes
          .map(
            (k) =>
              k +
              ": " +
              (current.stats?.[k] ?? "—") +
              " → " +
              (simulated.stats?.[k] ?? "—"),
          )
          .join(" · "),
      ),
      button(
        w("Confirmer ce choix", "Confirm this choice"),
        async () => {
          document.querySelector("dialog").close();
          await onConfirm();
        },
        "primary",
      ),
    ),
  );
}
/** Shared cards; device differences are CSS only. Comparisons never write draft state. */
export function discoveryGallery(a, d, update, ui) {
  const w = words(a),
    root = el("div", { class: "discovery" }),
    list = el("div", { class: "class-grid" });
  const selected = (ui.compared ??= new Set());
  const tags = (ui.tags ??= new Set());
  const available = a.context.index.list("class");
  const compareButton = button(
    w("Comparer les classes", "Compare classes"),
    () =>
      openComparison(
        a,
        d,
        available.filter((e) => selected.has(e.id)),
        update,
      ),
  );
  function fill() {
    compareButton.disabled = selected.size < 2;
    list.replaceChildren(
      ...available
        .filter((e) => discoveryMatches(e.data.classId, [...tags]))
        .map((entry) => {
          const id = entry.data.classId,
            info = classInfo(id, a.state.locale);
          const card = el(
            "article",
            {
              class:
                "discovery-card" + (id === d.classes[0].id ? " selected" : ""),
            },
            button(
              [
                assetImage("class", id),
                el("strong", {}, a.cls(id)),
                el("small", {}, info?.role ?? ""),
                el("small", {}, a.t("hitDie") + " d" + entry.data.hitDie),
              ],
              () =>
                update((x) => {
                  const plan = comparisonPlan(x, entry);
                  x.classes = plan.classes;
                  if (plan.retainedDecisions)
                    x.retainedDecisions = plan.retainedDecisions;
                }),
              "class-card" + (id === d.classes[0].id ? " active" : ""),
            ),
            el(
              "small",
              {},
              a.t("complexity") + " · " + (info?.complexity ?? "—"),
            ),
            el(
              "small",
              {},
              a.t("primary") +
                " · " +
                primaryAbilities(entry)
                  .map((k) => a.label(k))
                  .join(" / "),
            ),
            el(
              "details",
              {},
              el("summary", {}, w("Style de jeu", "Play style")),
              el("p", {}, info?.description ?? ""),
              el(
                "p",
                {},
                entry.data.casting
                  ? w("Magie de classe", "Class magic")
                  : w(
                      "Aucune magie de classe de base",
                      "No base class spellcasting",
                    ),
              ),
            ),
            check(
              w("Comparer ", "Compare ") + a.cls(id),
              selected.has(entry.id),
              (e) => {
                if (e.target.checked && selected.size >= 3) {
                  e.target.checked = false;
                  return;
                }
                e.target.checked
                  ? selected.add(entry.id)
                  : selected.delete(entry.id);
                fill();
              },
            ),
            button(w("Simuler ", "Simulate ") + a.cls(id), () =>
              openSimulation(
                a,
                d,
                (x) => {
                  const p = comparisonPlan(x, entry);
                  x.classes = p.classes;
                  if (p.retainedDecisions)
                    x.retainedDecisions = p.retainedDecisions;
                },
                () =>
                  update((x) => {
                    const p = comparisonPlan(x, entry);
                    x.classes = p.classes;
                    if (p.retainedDecisions)
                      x.retainedDecisions = p.retainedDecisions;
                  }),
              ),
            ),
          );
          return card;
        }),
    );
    if (!list.childElementCount)
      list.append(
        el(
          "p",
          {},
          w(
            "Aucune classe pour ces filtres.",
            "No class matches these filters.",
          ),
        ),
      );
  }
  const filters = el(
    "div",
    { class: "discovery-filters" },
    Object.entries(labels).map(([key, pair]) =>
      check(w(...pair), tags.has(key), (e) => {
        e.target.checked ? tags.add(key) : tags.delete(key);
        fill();
      }),
    ),
  );
  root.append(
    el(
      "p",
      {},
      w(
        "Repères de découverte indicatifs, sans restriction de règles.",
        "Editorial discovery guidance, not rules restrictions.",
      ),
    ),
    filters,
    compareButton,
    list,
  );
  if (d.mode !== "expert") {
    const style = select(
      [
        ["", w("Libre", "Any")],
        ["melee", w("Armes de mêlée", "Melee weapons")],
        ["magic", w("Magie", "Magic")],
        ["support", w("Aider mes alliés", "Help allies")],
      ],
      "",
      () => {},
    );
    const easy = check(
      w("Je préfère une prise en main simple", "I prefer an easy start"),
      false,
      () => {},
    );
    const result = el("p", { role: "status" });
    root.prepend(
      el(
        "details",
        { class: "play-questionnaire" },
        el(
          "summary",
          {},
          w("Comment souhaites-tu jouer ?", "How would you like to play?"),
        ),
        field(w("Votre préférence", "Your preference"), style),
        easy,
        button(w("Voir les suggestions", "See suggestions"), () => {
          const preferences = [
            style.value,
            ...(easy.querySelector("input").checked ? ["simple"] : []),
          ].filter(Boolean);
          result.textContent =
            available
              .filter((e) => discoveryMatches(e.data.classId, preferences))
              .map((e) => a.cls(e.data.classId))
              .join(" · ") ||
            w("Essayez une autre combinaison.", "Try another combination.");
        }),
        result,
      ),
    );
  }
  fill();
  return root;
}
export function openComparison(a, d, entries, update) {
  const w = words(a);
  if (!entries.length) return;
  const candidates = entries
    .slice(0, matchMedia("(max-width:700px)").matches ? 2 : 3)
    .map((e) => {
      const plan = comparisonPlan(d, e),
        r = draftProgression(a.context, a.config, plan),
        cls = a.context.index.class(e.data.classId);
      return { entry: e, plan, r, cls };
    });
  const rows = [
    [w("Source", "Source"), (c) => c.entry.source.document],
    [a.t("hitDie"), (c) => "d" + c.cls?.data.hitDie],
    [
      w("Déblocage de sous-classe", "Subclass unlock"),
      (c) => String(c.cls?.data.subclassLevel),
    ],
    [
      w("Rôle / complexité (indicatifs)", "Role / complexity (guidance)"),
      (c) => {
        const i = classInfo(c.entry.data.classId, a.state.locale);
        return [i?.role, i?.complexity].filter(Boolean).join(" · ") || "—";
      },
    ],
    [
      a.t("primary"),
      (c) =>
        primaryAbilities(c.cls)
          .map((k) => a.label(k))
          .join(" / "),
    ],
    [
      a.t("proficiencies"),
      (c) => (c.cls?.data.initialProficiencies ?? []).join(" · "),
    ],
    [
      a.t("spells"),
      (c) =>
        c.cls?.data.casting
          ? a.label(c.cls.data.casting.ability) +
            " · " +
            ({
              full: w("Progression complète", "Full progression"),
              half: w("Demi-progression", "Half progression"),
              pact: w("Magie de pacte", "Pact magic"),
            }[c.cls.data.casting.progression] ??
              w("Progression du catalogue", "Catalogue progression"))
          : w("Sans magie de base", "No base casting"),
    ],
    [
      w("Ressources au niveau choisi", "Resources at selected level"),
      (c) =>
        c.r.resources
          .map((r) => r.id + " " + (r.max ?? "∞") + " / " + r.recovery)
          .join(" · ") || "—",
    ],
    ...Array.from(
      { length: Math.max(...d.classes.map((c) => c.level)) },
      (_, n) => [
        a.t("level") + " " + (n + 1),
        (c) =>
          c.r.features
            .filter((id) =>
              [
                ...(c.cls?.data.grants ?? []),
                ...(c.entry.type === "subclass"
                  ? (c.entry.data.grants ?? [])
                  : []),
              ].some(
                (row) => row.level === n + 1 && row.featureIds.includes(id),
              ),
            )
            .map((id) => a.name(a.context.index.get(id)))
            .join(" · ") || "—",
      ],
    ),
    [
      w("Automatisation", "Automation"),
      (c) =>
        [
          ...new Set(
            c.r.features
              .map((id) => a.context.index.get(id)?.data.automation.status)
              .filter(Boolean),
          ),
        ]
          .map((v) => a.t(v))
          .join(" · ") || "—",
    ],
  ];
  const content = el(
    "section",
    { class: "comparison" },
    el("h2", {}, w("Comparer à niveau constant", "Compare at the same level")),
    el(
      "p",
      {},
      w(
        "Seuls les contenus installés et activés sont proposés. La comparaison ne modifie aucun choix.",
        "Only installed, enabled content is offered. Comparing changes no choices.",
      ),
    ),
    el(
      "div",
      { class: "comparison-options" },
      candidates.map((c) =>
        el(
          "article",
          {},
          el("h3", {}, a.name(c.entry)),
          button(
            w("Choisir ", "Choose ") + a.name(c.entry),
            async () => {
              document.querySelector("dialog").close();
              await update((x) => {
                const p = comparisonPlan(x, c.entry);
                x.classes = p.classes;
                if (p.retainedDecisions)
                  x.retainedDecisions = p.retainedDecisions;
              });
            },
            "primary",
          ),
        ),
      ),
    ),
    rows.map(([label, value]) => {
      const values = candidates.map(value),
        different = new Set(values).size > 1;
      return el(
        "section",
        { class: "comparison-row" + (different ? " different" : "") },
        el("h3", {}, label),
        el(
          "div",
          { class: "comparison-values" },
          values.map((v, i) =>
            el(
              "div",
              {},
              el("small", {}, a.name(candidates[i].entry)),
              el("p", {}, v),
            ),
          ),
        ),
      );
    }),
  );
  a.modal(content);
  document.querySelector("dialog").classList.add("wide-dialog");
}
export function subclassComparison(a, d, update) {
  const w = words(a),
    root = el(
      "details",
      {},
      el("summary", {}, w("Comparer les sous-classes", "Compare subclasses")),
    );
  for (const c of d.classes) {
    const entries = a.context.index
      .list("subclass")
      .filter((e) => e.data.classId === c.id);
    const chosen = new Set(
      entries
        .slice(0, matchMedia("(max-width:700px)").matches ? 2 : 3)
        .map((e) => e.id),
    );
    const launch = button(w("Ouvrir le comparateur", "Open comparison"), () =>
      openComparison(
        a,
        d,
        entries.filter((e) => chosen.has(e.id)),
        update,
      ),
    );
    launch.disabled =
      c.level < (a.context.index.class(c.id)?.data.subclassLevel ?? 99) ||
      !entries.length;
    root.append(
      el("h3", {}, a.cls(c.id)),
      el(
        "p",
        {},
        w(
          "Les packs absents ou sources désactivées ne sont pas sélectionnables.",
          "Missing packs and disabled sources cannot be selected.",
        ),
      ),
      entries.map((e) =>
        check(a.name(e), chosen.has(e.id), (ev) => {
          if (ev.target.checked && chosen.size >= 3) {
            ev.target.checked = false;
            return;
          }
          ev.target.checked ? chosen.add(e.id) : chosen.delete(e.id);
          launch.disabled =
            !chosen.size ||
            c.level < (a.context.index.class(c.id)?.data.subclassLevel ?? 99);
        }),
      ),
      launch,
    );
  }
  return root;
}
