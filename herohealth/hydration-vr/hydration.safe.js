// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration SAFE — PRODUCTION (FULL) — LATEST (AUTO + ML + Kids Smooth)
// ✅ Smart Aim Assist lockPx (cVR) adaptive + fair + deterministic in research
// ✅ FX: hit pulse, shockwave, boss flash, end-window blink+shake, pop score
// ✅ Mission 3-Stage: GREEN -> Storm Mini -> Boss Clear
// ✅ Cardboard layers via window.HHA_VIEW.layers from loader
// ✅ Spawn Safe-Zone (avoid HUD + safe-area)
// ✅ Practice mode 15s (play only) => kids-friendly onboarding
// ✅ Kids-friendly tuning (?kids=1) => easier water control + more forgiving
// ✅ Avoid duplicate log send if using hha-cloud-logger.js (?log=...)
// ✅ NEW: WaterGauge "soft-control" (drift+friction) for Grade 5 feel
// ✅ NEW: ML Telemetry (1Hz): emits 'hha:ml_row' + optional 'hha:predict' hook

'use strict';

import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createAICoach } from '../vr/ai-coach.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function setText(id, v){
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(v);
}

// ---------- CSV / copy ----------
function toCSVRow(obj){
  const keys = Object.keys(obj);
  const esc = (v)=>{
    const s = String(v ?? '');
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  return keys.join(',') + '\n' + keys.map(k=>esc(obj[k])).join(',') + '\n';
}
function downloadText(filename, text, type='text/plain'){
  try{
    const blob = new Blob([text], {type});
    const a = DOC.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      try{ URL.revokeObjectURL(a.href); }catch(_){}
      try{ a.remove(); }catch(_){}
    }, 50);
  }catch(_){}
}
async function copyToClipboard(text){
  try{ await navigator.clipboard.writeText(text); return true; }
  catch(_){
    try{
      const ta = DOC.createElement('textarea');
      ta.value = text;
      DOC.body.appendChild(ta);
      ta.select();
      DOC.execCommand('copy');
      ta.remove();
      return true;
    }catch(_){}
  }
  return false;
}

// -------------------- View / layers --------------------
function isCardboard(){
  try{ return DOC.body.classList.contains('cardboard'); }catch(_){ return false; }
}
function isCVR(){
  try{ return DOC.body.classList.contains('view-cvr'); }catch(_){ return false; }
}
function getLayers(){
  const cfg = ROOT.HHA_VIEW;
  if (cfg && Array.isArray(cfg.layers) && cfg.layers.length){
    const arr = cfg.layers.map(id=>DOC.getElementById(id)).filter(Boolean);
    if (arr.length) return arr;
  }
  const main = DOC.getElementById('hydration-layer');
  const L = DOC.getElementById('hydration-layerL');
  const R = DOC.getElementById('hydration-layerR');
  if (isCardboard() && L && R) return [L,R];
  return [main].filter(Boolean);
}
function getPlayfieldEl(){
  return isCardboard() ? DOC.getElementById('cbPlayfield') : DOC.getElementById('playfield');
}
function getPlayfieldRect(){
  const pf = getPlayfieldEl();
  const r = pf?.getBoundingClientRect();
  return r || { left:0, top:0, width:1, height:1 };
}
function centerPoint(){
  const r = getPlayfieldRect();
  return { cx: r.left + r.width/2, cy: r.top + r.height/2 };
}

// -------------------- FX Helpers --------------------
function pulseBody(cls, ms=140){
  try{
    DOC.body.classList.add(cls);
    setTimeout(()=>DOC.body.classList.remove(cls), ms);
  }catch(_){}
}
function shockAt(x, y){
  const pf = getPlayfieldEl