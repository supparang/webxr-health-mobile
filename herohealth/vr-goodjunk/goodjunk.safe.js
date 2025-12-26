7// --- Event emitter helper (send to both window + document) ---
function emitEvt(type, detail){
  try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch(_) {}
  try { document.dispatchEvent(new CustomEvent(type, { detail })); } catch(_) {}
}