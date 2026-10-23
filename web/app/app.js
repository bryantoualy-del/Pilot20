import {renderGrimoire} from "./grimoire.js";
import {playerCatalogs} from "../../src/catalog/player-catalogs.js";
import { localizedName } from "../../src/catalog/localization.js";
import { stepNames } from "./i18n.js";
import { openIndexedDB } from "../../src/persistence/adapters.js";
import { characterLibrary } from "../../src/persistence/library.js";
import { campaignRepository } from "../../src/campaign/repository.js";
import { creatorRepository } from "../../src/creator/repository.js";
import { validateSavedPlan } from "../../src/campaign/sources.js";
import { frNames } from "./translations.js";
import { messages, labels, classNames } from "./i18n.js";
import { el, button, field, select, check, badge, download } from "./dom.js";
import { renderCreator as renderEditor } from "./creator.js";
import { newDraft } from "../../src/creator/model.js";
import { ABILITIES } from "../../src/character/contracts.js";
import { renderCompanion } from "./companion.js";
const root = document.querySelector("#app"),
  dialog = document.querySelector("#dialog");
const state = {
  route: location.hash === "#sources" ? "sources" : "home",
  locale: "fr",
  campaignId: "default",
  query: "",
  filter: "",
  archives: false,
  inProgress: false,
};
let storage,
  library,
  campaigns,
  drafts,
  config,
  context,
  saveQueue = Promise.resolve(),
  lastSaveError = null;
const revisions = new Map();
const t = (k) => messages[state.locale][k] ?? k;
const name = (i) => localizedName(i, state.locale, frNames);
const cls = (id) =>
  classNames[state.locale][id] ?? name(context?.installed.class(id)) ?? id;
let noticeTimer;
function notice(message) {
  clearTimeout(noticeTimer);
  document.querySelector("#notice").textContent = message;
  noticeTimer = setTimeout(() => {
    document.querySelector("#notice").textContent = "";
  }, 2500);
}
function fail(e) {
  console.error(e);
  notice(
    e?.code === "conflict" || /conflict/i.test(e?.message)
      ? t("conflict")
      : t("error"),
  );
}
function modal(content) {
  dialog.classList.remove("wide-dialog");
  dialog.replaceChildren(
    el(
      "button",
      {
        type: "button",
        class: "close",
        "aria-label": state.locale === "fr" ? "Fermer" : "Close",
        onclick: () => dialog.close(),
      },
      "×",
    ),
    content,
  );
  dialog.setAttribute(
    "aria-label",
    content.querySelector("h2,h3")?.textContent ??
      (state.locale === "fr" ? "Détails" : "Details"),
  );
  dialog.showModal();
}
async function ask(message, action) {
  modal(
    el(
      "section",
      {},
      el("h2", {}, message),
      el(
        "div",
        { class: "row" },
        button(t("cancel"), () => dialog.close()),
        button(
          t("remove"),
          async () => {
            dialog.close();
            try {
              await action();
              await render();
            } catch (e) {
              fail(e);
            }
          },
          "danger",
        ),
      ),
    ),
  );
}
function autosave(d) {
  const snapshot = structuredClone(d);
  snapshot.updatedAt = new Date().toISOString();
  d.updatedAt = snapshot.updatedAt;
  document.querySelector("#draft-save-state")?.replaceChildren(t("saving"));
  const promise = saveQueue.then(async () => {
    const expected = revisions.has(d.id) ? revisions.get(d.id) : null;
    snapshot.revision = expected === null ? 1 : expected + 1;
    await drafts.save(snapshot, { expectedRevision: expected });
    lastSaveError = null;
    revisions.set(d.id, snapshot.revision);
    d.revision = snapshot.revision;
    document.querySelector("#draft-save-state")?.replaceChildren(
      t(snapshot.finalized ? "saved" : "draftSaved") +
        " · " +
        new Date(snapshot.updatedAt).toLocaleTimeString(state.locale, {
          hour: "2-digit",
          minute: "2-digit",
        }),
    );
  });
  saveQueue = promise.catch((e) => {
    lastSaveError = e;
    document
      .querySelector("#draft-save-state")
      ?.replaceChildren(
        state.locale === "fr" ? "Erreur de sauvegarde" : "Save failed",
      );
    fail(e);
  });
  return promise;
}
async function nav(route, id = null) {
  await saveQueue;
  if (route === "library") {
    state.query = "";
    state.filter = "";
    state.archives = false;
    state.inProgress = false;
  }
  state.route = route;
  state.id = id;
  if (id && ["creator", "companion", "grimoire"].includes(route)) {
    const d = await drafts.get(id);
    if (d) {
      state.campaignId = d.campaignId;
      await storage.batch(
        [],
        [{ store: "meta", key: "creator:campaign", value: state.campaignId }],
      );
    }
  }
  await render();
  window.scrollTo({ top: 0 });
}
async function refresh() {
  config = await campaigns.get(state.campaignId);
  context = await campaigns.context(config);
}
function api() {
  return {
    t,
    name,
    cls,
    label: (k) => labels[state.locale][k] ?? k.replace(/([A-Z])/g, " $1"),
    state,
    context,
    config,
    library,
    campaigns,
    drafts,
    storage,
    nav,
    notice,
    fail,
    modal,
    autosave,
    refresh,
    render,
    loadDraft: async (id) => {
      const d = await drafts.get(id);
      if (d) revisions.set(id, d.revision);
      return d;
    },
  };
}
async function render() {
  await refresh();
  document.documentElement.lang = state.locale;
  const header = el(
    "header",
    {},
    button([el("img",{src:"./icon.svg",alt:""}),"Pilot20"], () => nav("home"), "brand"),
    el(
      "nav",
      { "aria-label": "Navigation" },
      ["home", "library", "sources"].map((route) =>
        button(
          t(route),
          () => nav(route),
          (state.route === route || route === 'library' && state.route === 'creator') ? "active" : "",
        ),
      ),
    ),
    select(
      [
        ["fr", "Français"],
        ["en", "English"],
      ],
      state.locale,
      async (e) => {
        state.locale = e.target.value;
        await storage.batch(
          [],
          [{ store: "meta", key: "creator:locale", value: state.locale }],
        );
        render().catch(fail);
      },
      { "aria-label": "Langue / Language" },
    ),
  );
  const main = el("main", {class:state.route==='creator'?'creator-page':''});
  root.replaceChildren(
    header,
    main,
    el(
      "footer",
      {},
      el(
        "span",
        {},
        "Pilot20 · D&D 5e 2014 · ",
        el("a", { href: "./attribution.html" }, "SRD 5.1 · CC BY 4.0"),
      ),
      el("span", { id: "offline-state" }, t("offlineWait")),
    ),
  );
  const all = await drafts.list();
  if (state.route === "home")
    main.append(
      el(
        "section",
        { class: "hero" },
        el(
          "div",
          { class: "hero-copy" },
          badge("V0.3 · " + t("local")),
          el("h1", {}, t("hero")),
          el("p", {}, t("intro")),
          el(
            "div",
            { class: "row" },
            button(t("create"), () => start(), "primary"),
            button(t("library"), () => nav("library")),
          ),
          el("small", {}, t("noJson")),
        ),
        el(
          "div",
          { class: "hero-art", "aria-hidden": "true" },
          el("div", { class: "orbit orbit-one" }),
          el("div", { class: "orbit orbit-two" }),
          el("img", { class: "hero-logo", src:"./icon.svg", alt:"" }),
          el("span", { class: "art-label" }, "ROLL YOUR STORY"),
        ),
      ),
      el(
        "section",
        {},
        el(
          "div",
          { class: "section-head" },
          el("h2", {}, t("resume")),
          badge(String(all.filter((d) => !d.finalized).length)),
        ),
        el(
          "div",
          { class: "cards" },
          all
            .filter((d) => !d.finalized)
            .sort((a, b) =>
              (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
            )
            .slice(0, 6)
            .map(cardDraft),
        ),
      ),
    );
  if (state.route === "library") await libraryScreen(main, all);
  if (state.route === "sources") await sourcesScreen(main);
  if (state.route === "creator") {
    const d = await drafts.get(state.id);
    if (d) {
      revisions.set(d.id, d.revision);
      await renderEditor(main, d, api());
    } else await nav("library");
  }
  if (state.route === "grimoire") await renderGrimoire(main, state.id, api());
  if (state.route === "companion") await renderCompanion(main, state.id, api());
  updateOffline();
}
async function start() {
  const d = newDraft(state.campaignId);
  if(context.index.get('srd51:background:acolyte'))d.backgroundId='srd51:background:acolyte';
  d.startingEquipmentEnabled=true;d.startingEquipmentChoices={};
  d.scoreMethod='point-buy';
  // AideDD 2014: six valeurs brutes de 10 au départ (12 points sur 27).
  d.scores=Object.fromEntries(ABILITIES.map(ability=>[ability,10]));
  await autosave(d);
  await nav("creator", d.id);
}
function cardDraft(d) {
  return el(
    "article",
    { class: "card" },
    el(
      "div",
      { class: "avatar" },
      d.portrait ? el("img", { src: d.portrait, alt: "" }) : "◈",
    ),
    badge(t("draft")),
    el("h3", {}, d.name || t("create")),
    el("p", {}, d.classes.map((c) => cls(c.id) + " " + c.level).join(" / ")),
    el(
      "small",
      {},
      t(d.step) +
        " · " +
        (d.updatedAt
          ? new Date(d.updatedAt).toLocaleString(state.locale)
          : t("draft")),
    ),
    button(t("resume"), () => nav("creator", d.id)),
    el(
      "details",
      {},
      el("summary", {}, t("details")),
      el(
        "div",
        { class: "row" },
        button(t("duplicate"), async () => {
          await drafts.duplicate(d.id);
          await render();
        }),
        button(t("export"), async () =>
          download(await drafts.export(d.id), "Pilot20-" + d.id + ".json"),
        ),
        button(
          t("remove"),
          () =>
            ask(t("deleteConfirm"), async () => {
              await drafts.remove(d.id, d.revision);
            }),
          "danger",
        ),
      ),
    ),
  );
}
async function libraryScreen(main, all) {
  const records = await library.list({ includeArchived: true }),
    byId = new Map(all.map((d) => [d.id, d])),
    contexts = new Map();
  for (const id of new Set(all.map((d) => d.campaignId))) {
    contexts.set(id, await campaigns.context(await campaigns.get(id)));
  }
  main.append(
    el(
      "div",
      { class: "section-head" },
      el("div", {}, badge(t("local")), el("h1", {}, t("library"))),
      button("+ " + t("create"), () => start(), "primary"),
    ),
  );
  const query = el("input", {
      type: "search",
      value: state.query,
      placeholder: t("search"),
      "aria-label": t("search"),
      oninput: (e) => {
        state.query = e.target.value;
        fill();
      },
    }),
    filter = select(
      [
        ["", t("all")],
        ...context.installed
          .list("class")
          .map((i) => [i.data.classId, cls(i.data.classId)]),
      ],
      state.filter,
      (e) => {
        state.filter = e.target.value;
        fill();
      },
    );
  const upload = el("input", {
    type: "file",
    accept: ".json,application/json",
    "aria-label": t("import"),
    onchange: async (e) => {
      try {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 4000000) throw Error("size");
        await drafts.import(await f.text());
        await render();
      } catch (e) {
        fail(e);
      }
    },
  });
  main.append(
    el(
      "div",
      { class: "toolbar" },
      query,
      filter,
      check(t("archived"), state.archives, (e) => {
        state.archives = e.target.checked;
        fill();
      }),
      check(t("inProgress"), state.inProgress, (e) => {
        state.inProgress = e.target.checked;
        fill();
      }),
      field(t("import"), upload),
    ),
  );
  const grid = el("div", { class: "cards" });
  main.append(grid);
  function fill() {
    grid.replaceChildren();
    const filtered = records.filter(
      (r) =>
        (state.archives || !r.archived) &&
        (!state.inProgress ||
          (byId.has(r.definition.id) &&
            !byId.get(r.definition.id).finalized)) &&
        (!state.filter ||
          r.definition.classes.some((c) => c.id === state.filter)) &&
        r.definition.identity.name
          .toLocaleLowerCase()
          .includes(state.query.toLocaleLowerCase()),
    );
    for (const r of filtered) {
      const c = r.definition,
        d = byId.get(c.id),
        valid = d
          ? validateSavedPlan(contexts.get(d.campaignId), d)
          : { valid: c.features.every((id) => context.index.get(id)) };
      const card = el(
        "article",
        { class: "card" },
        el(
          "div",
          { class: "avatar" },
          c.identity.portrait
            ? el("img", { src: c.identity.portrait, alt: "" })
            : "◈",
        ),
        badge(
          !valid.valid
            ? t("review")
            : d?.finalized
              ? t(d.status)
              : d
                ? t("draft")
                : t("review"),
          valid.valid ? "" : "warning",
        ),
        el("h3", {}, c.identity.name),
        el(
          "p",
          {},
          c.classes.map((c) => cls(c.id) + " " + c.level).join(" / "),
        ),
      );
      if (!valid.valid)
        card.append(el("p", { class: "warning-text" }, t("sourceAbsent")));
      card.append(
        el(
          "div",
          { class: "row" },
          button(state.locale === "fr" ? "Grimoire" : "Spellbook", () => nav("grimoire", c.id), "primary"),
          button(t("open"), () => nav("companion", c.id)),
          button(t("edit"), () =>
            d ? nav("creator", c.id) : notice(t("noPlan")),
          ),
        ),
        el(
          "details",
          {},
          el("summary", {}, t("details")),
          el(
            "div",
            { class: "row" },
            button(t("duplicate"), async () => {
              try {
                const copy = await library.duplicate(c.id);
                if (d) {
                  const draft = structuredClone(d);
                  draft.id = copy.definition.id;
                  draft.revision = 1;
                  await drafts.save(draft);
                }
                await render();
              } catch (e) {
                fail(e);
              }
            }),
            button(r.archived ? t("restore") : t("archive"), async () => {
              await library.archive(c.id, !r.archived);
              await render();
            }),
            button(t("export"), async () =>
              download(await drafts.export(c.id), "Pilot20-" + c.id + ".json"),
            ),
            button(
              t("remove"),
              () =>
                ask(t("deleteConfirm"), async () => {
                  await library.remove(c.id, { confirmId: c.id });
                  if (d) await drafts.remove(d.id, d.revision);
                }),
              "danger",
            ),
          ),
        ),
      );
      grid.append(card);
    }
    for (const d of all.filter(
      (d) =>
        !records.some((r) => r.definition.id === d.id) &&
        (!state.filter || d.classes.some((c) => c.id === state.filter)) &&
        d.name.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()),
    ))
      grid.append(cardDraft(d));
    if (!grid.children.length)
      grid.append(el("p", { class: "empty" }, t("emptyLibrary")));
  }
  fill();
}
async function sourcesScreen(main) {
  main.append(
    el(
      "div",
      { class: "section-head" },
      el("div", {}, badge("D&D 5e · 2014"), el("h1", {}, t("sources"))),
    ),
  );
  const campaignNames = await storage.list("meta", "campaign:sources:");
  main.append(
    field(
      t("campaign"),
      select(
        campaignNames.map((r) => [r.value.id, r.value.id]),
        config.id,
        async (e) => {
          state.campaignId = e.target.value;
          await storage.batch(
            [],
            [
              {
                store: "meta",
                key: "creator:campaign",
                value: state.campaignId,
              },
            ],
          );
          await render();
        },
      ),
    ),
  );
  const cid = el("input", {
    placeholder: t("newCampaign"),
    maxlength: 80,
    "aria-label": t("newCampaign"),
  });
  main.append(
    el(
      "div",
      { class: "row" },
      cid,
      button(t("newCampaign"), async () => {
        try {
          await campaigns.initialize(cid.value.trim());
          state.campaignId = cid.value.trim();
          await render();
        } catch (e) {
          fail(e);
        }
      }),
    ),
    el("p", { class: "lede" }, t("sourceHelp")),
  );
  const change = async (mut) => {
    try {
      const next = structuredClone(config);
      mut(next);
      next.revision++;
      await campaigns.save(next, { expectedRevision: config.revision });
      await render();
      notice(t("sourceWarning"));
    } catch (e) {
      fail(e);
    }
  };
  main.append(
    check(state.locale === "fr" ? "Activer les restrictions du MJ par ouvrage" : "Enable GM source restrictions",
      config.sourceRestrictions === true,
      e => change(c => { c.sourceRestrictions = e.target.checked; })),
    el(
      "div",
      { class: "source-cards" },
      context.statuses.filter(s => s.installedEntries > 0).map((s) =>
        el("article", { class: "card source-card" },
          check(s.name, s.selected, (e) =>
            change((c) => {
              c.enabledSourceIds = e.target.checked
                ? [...new Set([...c.enabledSourceIds, s.id])]
                : c.enabledSourceIds.filter((k) => k !== s.id);
            }), { disabled: !config.sourceRestrictions }),
        ),
      ),
    ),
  );
  main.append(
    el(
      "section",
      { class: "panel" },
      el("h2", {}, t("options")),
      context.options.map((o) =>
        check(
          name(
            context.installed
              .list()
              .find((i) => i.data.campaignOption === o.id),
          ) ||
            ({
              feats: state.locale === "fr" ? "Dons" : "Feats",
              multiclass:
                state.locale === "fr" ? "Multiclassage" : "Multiclassing",
            }[o.id] ??
              o.name),
          o.enabled,
          (e) =>
            change((c) => {
              c.enabledOptions = e.target.checked
                ? [...c.enabledOptions, o.id]
                : c.enabledOptions.filter((k) => k !== o.id);
            }),
          {
            disabled: !o.sourceIds.some((id) =>
              context.statuses.some(s => s.id === id && s.selected),
            ),
          },
        ),
      ),
    ),
  );
  const auth = el("input", { type: "checkbox" });
  const file = el("input", {
    type: "file",
    accept: ".json,application/json",
    "aria-label": t("pack"),
    onchange: async (e) => {
      try {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 8000000) throw Error("size");
        await campaigns.importPack(await f.text(), {
          authorized: auth.checked,
        });
        await render();
      } catch (e) {
        fail(e);
      }
    },
  });
  main.append(
    el(
      "section",
      { class: "panel" },
      el("h2", {}, t("pack")),
      el("label", { class: "check" }, auth, el("span", {}, t("authorize"))),
      field(t("pack"), file),
    ),
  );
}
function updateOffline() {
  const e = document.querySelector("#offline-state");
  if (e) e.textContent = cacheReady ? t("offline") : t("offlineWait");
}
let cacheReady = false;
try {
  storage = await openIndexedDB();
  library = characterLibrary(storage);
  campaigns = campaignRepository(storage,playerCatalogs,{cacheContexts:true});
  drafts = creatorRepository(storage, library);
  state.locale = (await storage.get("meta", "creator:locale")) ?? "fr";
  state.campaignId =
    (await storage.get("meta", "creator:campaign")) ?? "default";
  await campaigns.initialize(state.campaignId);
  await render();
  if ("serviceWorker" in navigator) {
    const hadController=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(!hadController||document.querySelector('#app-update'))return;
      const apply=button(state.locale==='fr'?'Actualiser':'Refresh',async()=>{
        apply.disabled=true;
        try{await saveQueue;if(lastSaveError)throw lastSaveError;location.reload();}catch(e){apply.disabled=false;fail(e);}
      },'primary');
      document.body.append(el('aside',{id:'app-update',role:'status'},el('span',{},state.locale==='fr'?'Une nouvelle version est prête.':'A new version is ready.'),apply));
    });
    const reg = await navigator.serviceWorker.register("../sw.js",{updateViaCache:'none'});
    reg.update().catch(()=>{});
    await navigator.serviceWorker.ready;
    const worker = reg.active ?? reg.waiting ?? reg.installing;
    worker?.postMessage({ type: "status" });
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "cache-ready") {
        cacheReady = true;
        updateOffline();
      }
    });
  }
} catch (e) {
  fail(e);
  root.replaceChildren(
    el("main", {}, el("h1", {}, "Pilot20"), el("p", {}, t("error"))),
  );
}

// Visual viewport shrinks with the iOS keyboard; release sticky actions while editing.
if (window.visualViewport) {
  const syncViewport = () => {
    const editing = /INPUT|TEXTAREA|SELECT/.test(
      document.activeElement?.tagName ?? "",
    );
    document.body.classList.toggle(
      "keyboard-open",
      editing && visualViewport.height < innerHeight * 0.8,
    );
  };
  visualViewport.addEventListener("resize", syncViewport);
  document.addEventListener("focusin", syncViewport);
  document.addEventListener("focusout", () =>
    requestAnimationFrame(syncViewport),
  );
}
