import { derive } from "../../src/character/derive.js";
import { createCombat } from "../../src/character/session.js";
import { combatRepository } from "../../src/persistence/combat-repository.js";
import { validateSavedPlan } from "../../src/campaign/sources.js";
import { pendingDecisions } from "../../src/rules/reactive.js";
import { diceSpec } from "../../src/model.js";
import { ABILITIES } from "../../src/character/contracts.js";
import { el, button, field, select, check, badge } from "./dom.js";
import { optionName, inspectEntry } from "./editor.js";
const words = {
  inspiration: ["Inspiration bardique", "Bardic Inspiration"],
  "second-wind": ["Second souffle", "Second Wind"],
  "action-surge": ["Fougue", "Action Surge"],
  rage: ["Rages", "Rages"],
  "sorcery-points": ["Points de sorcellerie", "Sorcery points"],
  ki: ["Points de ki", "Ki points"],
};
function resourceName(id, a) {
  if (/^slot\d$/.test(id)) return a.t("slot") + " " + id.slice(4);
  const suffix = id.split(":").at(-1);
  return words[suffix]?.[a.state.locale === "fr" ? 0 : 1] ?? optionName(id, a);
}
export async function renderCompanion(main, id, a) {
  const { t } = a,
    record = await a.library.get(id);
  if (!record) {
    await a.nav("library");
    return;
  }
  const d = record.definition,
    stats = derive(d),
    draft = await a.drafts.get(id),
    compatible = draft
      ? validateSavedPlan(a.context, draft).valid
      : d.features.every((id) => a.context.index.get(id));
  const repo = combatRepository(a.storage);
  let sessionId = await a.storage.get("meta", "creator:preview:" + id),
    session = sessionId ? await repo.load(sessionId) : null;
  if (session && session.participants.hero.definitionRevision !== d.revision)
    session = null;
  const shell = el("div", {});
  main.append(shell);
  let lastResult = "";
  const abilityName = (ability) =>
    a.name(a.context.installed.get(ability.combat?.spell?.id ?? ability.id)) ||
    ability.name;
  const automation = (ability) =>
    ability.combat?.mode === "manual"
      ? "manual"
      : (a.context.installed.get(ability.combat?.spell?.id ?? ability.id)?.data
          .automation.status ?? "partial");
  async function create() {
    const partner = structuredClone(d);
    partner.id = "demo-partner";
    partner.revision = 1;
    partner.identity.name = t("targetDummy");
    partner.abilities = [];
    partner.reactiveRules = [];
    partner.castingModifiers = [];
    const initial = createCombat(crypto.randomUUID(), [
      { instanceId: "hero", character: d },
      { instanceId: "partner", character: partner },
    ]);
    session = await repo.create(initial);
    sessionId = session.id;
    await a.storage.batch(
      [],
      [{ store: "meta", key: "creator:preview:" + id, value: sessionId }],
    );
    await commit({
      type: "damage",
      actorId: "hero",
      amount: Math.min(5, stats.maxHp - 1),
      damageType: "force",
    });
    lastResult =
      a.state.locale === "fr"
        ? "Démonstration : vous commencez avec quelques PV manquants pour tester les soins."
        : "Demo: you start with some missing HP to test healing.";
    draw();
  }
  async function commit(command) {
    const result = await repo.commit(
      sessionId,
      { id: crypto.randomUUID(), ...command },
      { role: "gm" },
    );
    session = result.state;
    return result;
  }
  function draw() {
    const runtime = session?.engine.actors.hero,
      abilities = d.abilities,
      resourceRows = Object.entries(stats.resources),
      fr = a.state.locale === "fr";
    shell.replaceChildren(
      el(
        "div",
        { class: "section-head" },
        button("← " + t("library"), () => a.nav("library")),
        draft ? button(t("edit"), () => a.nav("creator", id)) : null,
      ),
      el(
        "div",
        { class: "companion-head" },
        el(
          "div",
          { class: "avatar" },
          d.identity.portrait
            ? el("img", { src: d.identity.portrait, alt: "" })
            : "◈",
        ),
        el(
          "div",
          {},
          badge(t("preview")),
          el("h1", {}, d.identity.name),
          el(
            "p",
            {},
            d.classes.map((c) => a.cls(c.id) + " " + c.level).join(" / "),
          ),
        ),
      ),
      el("p", {}, d.identity.description),
    );
    if (!compatible)
      shell.append(
        el("p", { class: "warning-text" }, t("sourceAbsent")),
        button(t("sources"), () => a.nav("sources")),
      );
    const left = el(
      "section",
      {},
      el(
        "div",
        { class: "stat-grid" },
        el(
          "div",
          { class: "stat" },
          el("small", {}, t("hp")),
          el(
            "strong",
            {},
            runtime ? runtime.hp.current + " / " + runtime.hp.max : stats.maxHp,
          ),
        ),
        el(
          "div",
          { class: "stat" },
          el("small", {}, t("ac")),
          el("strong", {}, stats.ac),
        ),
        el(
          "div",
          { class: "stat" },
          el("small", {}, t("level")),
          el("strong", {}, stats.level),
        ),
      ),
      el(
        "div",
        { class: "score-grid" },
        ABILITIES.map((k) =>
          el(
            "div",
            { class: "stat" },
            el("small", {}, a.label(k)),
            el("strong", {}, d.scores[k]),
            el(
              "small",
              {},
              (stats.modifiers[k] >= 0 ? "+" : "") + stats.modifiers[k],
            ),
          ),
        ),
      ),
      el(
        "details",
        {},
        el("summary", {}, t("skills")),
        el(
          "div",
          { class: "grid2" },
          Object.entries(stats.skills).map(([k, v]) =>
            el("span", {}, a.label(k) + " " + (v >= 0 ? "+" : "") + v),
          ),
        ),
      ),
      el("h2", {}, t("actions")),
      el(
        "div",
        { class: "ability-list" },
        abilities.map((ability) =>
          el(
            "article",
            { class: "ability" },
            badge(t(automation(ability))),
            el("h3", {}, abilityName(ability)),
            el(
              "p",
              {},
              t("cost") +
                " : " +
                t(ability.cost) +
                (ability.resource
                  ? " · " +
                    resourceName(ability.resource.id, a) +
                    " × " +
                    ability.resource.amount
                  : ""),
            ),
            el(
              "div",
              { class: "row" },
              button(t("inspect"), () => inspectAbility(ability)),
              button(
                ability.combat?.mode === "manual"
                  ? t("confirmManual")
                  : t("execute"),
                () => actionDialog(ability),
                compatible && session ? "primary" : "",
              ),
            ),
          ),
        ),
      ),
    );
    if (!abilities.length) left.append(el("p", {}, t("noAction")));
    const right = el(
      "aside",
      {},
      el(
        "section",
        { class: "panel" },
        el("h2", {}, t("resource")),
        el(
          "div",
          { class: "resource-list" },
          resourceRows.map(([key, r]) =>
            el(
              "div",
              { class: "resource-row" },
              el("span", {}, resourceName(key, a)),
              el(
                "strong",
                {},
                (runtime?.resources[key] ?? r.max) + " / " + r.max,
              ),
            ),
          ),
        ),
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", {}, t("local")),
        el("p", {}, t("sessionOnly")),
        button(
          t("start"),
          async () => {
            try {
              if (!compatible) {
                a.notice(t("unavailable"));
                return;
              }
              await create();
            } catch (e) {
              a.fail(e);
            }
          },
          "primary",
        ),
        session
          ? el(
              "div",
              { class: "row" },
              button(t("reset"), async () => {
                try {
                  await commit({ type: "startTurn", actorId: "hero" });
                  lastResult = t("reset");
                  draw();
                } catch (e) {
                  a.fail(e);
                }
              }),
              button(t("rest"), async () => {
                try {
                  await commit({ type: "rest", actorId: "hero", kind: "long" });
                  lastResult = t("rest");
                  draw();
                } catch (e) {
                  a.fail(e);
                }
              }),
            )
          : null,
      ),
    );
    if (session) {
      const pending = session.engine.actors.hero.advanced?.pendingManual;
      if (pending)
        right.append(
          el(
            "section",
            { class: "panel" },
            el("h3", {}, t("confirmManual")),
            button(t("resolve"), () => resolveManual(pending)),
          ),
        );
      for (const decision of pendingDecisions(session.engine))
        right.append(
          el(
            "section",
            { class: "panel" },
            el("h3", {}, fr ? "Décision en attente" : "Pending decision"),
            el("p", {}, t("reviewHelp")),
            button(fr ? "Décliner" : "Decline", async () => {
              try {
                await commit({
                  type: "respondDecision",
                  actorId: decision.actorId,
                  decisionId: decision.id,
                  decisionRevision: decision.revision,
                  expectedRevision: session.engine.revision,
                  choice: "decline",
                });
                lastResult = fr
                  ? "Décision déclinée ; résolution poursuivie."
                  : "Decision declined; resolution resumed.";
                draw();
              } catch (e) {
                a.fail(e);
              }
            }),
          ),
        );
    }
    if (lastResult)
      right.append(
        el(
          "section",
          { class: "panel" },
          el("h2", {}, t("result")),
          el("div", { class: "log", role: "status" }, lastResult),
        ),
      );
    shell.append(el("div", { class: "companion-grid" }, left, right));
  }
  function inspectAbility(ability) {
    const entry = a.context.installed.get(
      ability.combat?.spell?.id ?? ability.id,
    );
    a.modal(
      el(
        "section",
        {},
        el("h2", {}, abilityName(ability)),
        badge(t(automation(ability))),
        el("p", {}, t("cost") + " : " + t(ability.cost)),
        ability.resource
          ? el(
              "p",
              {},
              resourceName(ability.resource.id, a) +
                " × " +
                ability.resource.amount,
            )
          : null,
        entry ? el("p", {}, entry.source.document) : null,
        el("p", {}, t("reviewHelp")),
        entry?.data.reviewNotes
          ? el(
              "ul",
              {},
              entry.data.reviewNotes.map((n) => el("li", {}, n)),
            )
          : null,
      ),
    );
  }
  function actionDialog(ability) {
    if (!compatible) {
      a.notice(t("unavailable"));
      return;
    }
    if (!session) {
      a.notice(t("start"));
      return;
    }
    const compiled =
        session.engine.actors.hero.definition.abilities[ability.id],
      manual = compiled.combat?.mode === "manual",
      content = el(
        "section",
        {},
        el("h2", {}, abilityName(ability)),
        badge(t(automation(ability))),
        el("p", {}, t("cost") + " : " + t(compiled.cost)),
      );
    let target = "hero",
      slot = null;
    if (compiled.target !== "self")
      content.append(
        field(
          t("target"),
          select(
            [
              ["hero", t("targetSelf")],
              ["partner", t("targetDummy")],
            ],
            target,
            (e) => {
              target = e.target.value;
            },
          ),
        ),
      );
    const spell = compiled.combat?.spell;
    if (spell?.level && spell.slotPolicy !== "free") {
      const slots = Object.entries(stats.resources).filter(
        ([, r]) => r.slotLevel >= spell.level,
      );
      slot = slots[0]?.[0];
      content.append(
        field(
          t("slot"),
          select(
            slots.map(([k]) => [k, resourceName(k, a)]),
            slot,
            (e) => {
              slot = e.target.value;
            },
          ),
        ),
      );
    }
    const rolls = [];
    let attack = null,
      save = null;
    const input = (title, placeholder) => {
      const input = el("input", {
        type: "text",
        inputmode: "numeric",
        placeholder,
      });
      content.append(field(title, input));
      return input;
    };
    if (compiled.attack) attack = input(t("roll") + " · d20", "1–20");
    if (compiled.save)
      save = input(t("roll") + " · " + a.label(compiled.save.ability), "1–20");
    compiled.effects.forEach((effect, i) => {
      if (effect.dice) {
        const spec = diceSpec(effect.dice);
        rolls.push([
          i,
          input(
            t("roll") + " · " + spec.count + "d" + spec.sides,
            Array(spec.count).fill("1").join(", "),
          ),
        ]);
      }
    });
    const ack = el("input", { type: "checkbox" }),
      reason = el("textarea", { maxlength: 1000 });
    content.append(
      el("label", { class: "check" }, ack, el("span", {}, t("ack"))),
    );
    if (manual) content.append(field(t("reason"), reason));
    const parse = (e) => e.value.split(",").map((n) => Number(n.trim()));
    const error = el("p", { class: "warning-text", role: "alert" });
    content.append(
      error,
      button(
        manual ? t("confirmManual") : t("execute"),
        async () => {
          try {
            if (!ack.checked || (manual && !reason.value.trim())) {
              error.textContent = t("ack");
              return;
            }
            const facts = {
              hero: Object.fromEntries(
                (compiled.combat?.externalRequirements ?? []).map((k) => [
                  k,
                  true,
                ]),
              ),
              partner: { within60ft: true, canHear: true },
            };
            if (ack.checked) {
              facts.hero.within60ft = true;
              facts.hero.canHear = true;
            }
            const before = structuredClone(session.engine.actors.hero),
              command = {
                type: manual ? "declareManual" : "useAbility",
                actorId: "hero",
                abilityId: ability.id,
                targetIds: [target],
                facts,
                ...(slot ? { slotId: slot } : {}),
                ...(attack ? { attackRolls: parse(attack) } : {}),
                ...(save ? { saveRolls: { [target]: parse(save) } } : {}),
                effectRolls: Object.fromEntries(
                  rolls.map(([i, e]) => [i, parse(e)]),
                ),
                ...(manual ? { reason: reason.value } : {}),
              };
            const out = await commit(command);
            const after = session.engine.actors.hero,
              changes = Object.keys(after.resources)
                .filter((k) => after.resources[k] !== before.resources[k])
                .map(
                  (k) =>
                    resourceName(k, a) +
                    " : " +
                    before.resources[k] +
                    " → " +
                    after.resources[k],
                );
            lastResult = [
              abilityName(ability),
              ...changes,
              t("hp") + " : " + before.hp.current + " → " + after.hp.current,
              manual
                ? t("confirmManual")
                : a.state.locale === "fr"
                  ? "Action résolue par le moteur."
                  : "Action resolved by the engine.",
            ].join("\n");
            document.querySelector("#dialog").close();
            draw();
          } catch (e) {
            console.error(e);
            error.textContent =
              a.state.locale === "fr"
                ? "Action refusée. Vérifiez les dés, les cibles, les ressources, l’économie d’action et les décisions en attente."
                : "Action refused. Check dice, targets, resources, action economy and pending decisions.";
          }
        },
        "primary",
      ),
    );
    a.modal(content);
  }
  function resolveManual(pending) {
    let kind = "none",
      amount = 0;
    const reason = el("textarea", { maxlength: 1000 }),
      value = el("input", {
        type: "number",
        min: 0,
        max: 1000,
        value: 0,
        onchange: (e) => {
          amount = Number(e.target.value);
        },
      }),
      error = el("p", { class: "warning-text" });
    a.modal(
      el(
        "section",
        {},
        el("h2", {}, t("confirmManual")),
        field(t("reason"), reason),
        field(
          t("result"),
          select(
            [
              [
                "none",
                a.state.locale === "fr"
                  ? "Résolution narrative"
                  : "Narrative ruling",
              ],
              [
                "tempHp",
                a.state.locale === "fr" ? "PV temporaires" : "Temporary HP",
              ],
              ["heal", a.state.locale === "fr" ? "Soin" : "Healing"],
              [
                "damage",
                a.state.locale === "fr"
                  ? "Dégâts validés"
                  : "Adjudicated damage",
              ],
            ],
            "none",
            (e) => {
              kind = e.target.value;
            },
          ),
        ),
        field(t("result"), value),
        error,
        button(
          t("resolve"),
          async () => {
            try {
              if (!reason.value.trim()) throw Error("reason");
              await commit({
                type: "resolveManual",
                actorId: "hero",
                declarationId: pending.id,
                reason: reason.value,
                outcomes:
                  kind === "none"
                    ? []
                    : pending.targetIds.map((actorId) => ({
                        kind,
                        actorId,
                        amount,
                        reason: reason.value,
                      })),
              });
              lastResult = reason.value;
              document.querySelector("#dialog").close();
              draw();
            } catch (e) {
              error.textContent = t("error");
            }
          },
          "primary",
        ),
      ),
    );
  }
  draw();
}
