/** Portable local registry: applications may vendor this module and assets/shared independently. */
import { el } from "./dom.js";
const aliases = {
  class: "classes",
  school: "magic-schools",
  inventory: "inventory",
  condition: "conditions",
};
const safe = /^[a-z0-9_-]+$/;
export function assetURL(type, id) {
  const group = aliases[type];
  return group && safe.test(id ?? "")
    ? new URL(`../assets/shared/${group}/${id}.webp`, import.meta.url).href
    : null;
}
export function assetImage(type, id, fallback = "◇") {
  const url = assetURL(type, id);
  const wrap = el(
    "span",
    { class: "asset-icon", "aria-hidden": "true" },
    fallback,
  );
  if (url) {
    const img = el("img", {
      src: url,
      alt: "",
      width: 64,
      height: 64,
      loading: "lazy",
      decoding: "async",
      onerror: () => img.remove(),
    });
    wrap.replaceChildren(img);
    img.addEventListener(
      "error",
      () => {
        wrap.textContent = fallback;
      },
      { once: true },
    );
  }
  return wrap;
}
