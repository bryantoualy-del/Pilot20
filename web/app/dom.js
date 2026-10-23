export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "value" && tag === "textarea") e.value = v;
    else if (
      k === "checked" ||
      k === "disabled" ||
      k === "selected" ||
      k === "open"
    )
      e[k] = !!v;
    else if (v !== null && v !== undefined) e.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity))
    if (c !== null && c !== undefined)
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
export const button = (text, onclick, kind = "") =>
  el("button", { type: "button", class: kind, onclick }, text);
export function field(label, input, help = "") {
  const id = input.id || "field-" + crypto.randomUUID();
  input.id = id;
  return el(
    "div",
    { class: "field" },
    el("label", { for: id }, label),
    input,
    help ? el("small", {}, help) : null,
  );
}
export function select(options, value, onchange, attrs = {}) {
  const e = el(
    "select",
    { ...attrs, onchange },
    options.map(([id, label]) => el("option", { value: id }, label)),
  );
  e.value = value;
  return e;
}
export const check = (label, checked, onchange, attrs = {}) =>
  el(
    "label",
    { class: "check" },
    el("input", { type: "checkbox", checked, onchange, ...attrs }),
    el("span", {}, label),
  );
export const badge = (text, kind = "") =>
  el("span", { class: "badge " + kind }, text);
export function download(text, name) {
  const u = URL.createObjectURL(new Blob([text], { type: "application/json" })),
    a = el("a", { href: u, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
