export function $(id) {
  return document.getElementById(id);
}

export function show(id, display = 'block') {
  const el = $(id);
  if (el) el.style.display = display;
  return el;
}

export function hide(id) {
  const el = $(id);
  if (el) el.style.display = 'none';
  return el;
}

export function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
  return el;
}

export function setValueAttr(id, value) {
  const el = $(id);
  if (el) el.setAttribute('value', value);
  return el;
}
