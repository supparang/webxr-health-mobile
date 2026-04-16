export function $(id) {
  return document.getElementById(id);
}

export function setValueAttr(idOrEl, value) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.setAttribute("value", value);
}

export function setText(idOrEl, value) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.textContent = value;
}

export function show(idOrEl, display = "block") {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.style.display = display;
}

export function hide(idOrEl) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.style.display = "none";
}

export function setVisible(entityIdOrEl, visible) {
  const el = typeof entityIdOrEl === "string" ? $(entityIdOrEl) : entityIdOrEl;
  if (!el) return;
  el.setAttribute("visible", visible ? "true" : "false");
}

export function setColor(idOrEl, color) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.style.color = color;
}

export function setHtml(idOrEl, html) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.innerHTML = html;
}

export function addClass(idOrEl, className) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.classList.add(className);
}

export function removeClass(idOrEl, className) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.classList.remove(className);
}

export function toggleClass(idOrEl, className, force) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  if (typeof force === "boolean") el.classList.toggle(className, force);
  else el.classList.toggle(className);
}

export function setButtonDisabled(idOrEl, disabled = true) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.disabled = disabled;
}

export function setInputValue(idOrEl, value = "") {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  if (!el) return;
  el.value = value;
}

export function getInputValue(idOrEl) {
  const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
  return el ? el.value : "";
}
