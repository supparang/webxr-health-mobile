ฃ// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration SAFE — PRODUCTION (FULL) — 1-3 DONE (AIM + FX + 3-STAGE)
// ✅ Fix: targets always visible (z-index/opacity/display/visibility) + layer ready
// ✅ Smart Aim Assist lockPx (cVR) adaptive + fair + deterministic in research
// ✅ FX: hit pulse, shockwave, boss flash, end-window blink+shake, pop score
// ✅ Mission 3-Stage: GREEN -> Storm Mini -> Boss Clear
// ✅ Cardboard layers via window.HHA_VIEW.layers from loader

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
function ensureLayerReady(){
  const layers = getLayers();
  for (const L of layers){
    if (!L) continue;
    try{
      L.style.position = 'absolute';
      L.style.inset = '0';
      L.style.width = '100%';
      L.style.height = '100%';
      L.style.zIndex = '20';
    }catch(_){}
  }
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

// -------------------- FX Helpers (Particles + DOM shock) --------------------
function pulseBody(cls, ms=140){
  try{
    DOC.body.classList.add(cls);
    setTimeout(()=>DOC.body.classList.remove(cls), ms);
  }catch(_){}
}
function shockAt(x, y){
  const pf = getPlayfieldEl();
  if (!pf) return;

  const r = pf.getBoundingClientRect();
  const xPct = ((x - r.left)/Math.max(1,r.width))*100;
  const yPct = ((y - r.top)/Math.max(1,r.height))*100;

  const el = DOC.createElement('div');
  el.className='hha-shock';
  el.style.setProperty('--x', xPct.toFixed(2)+'%');
  el.style.setProperty('--y', yPct.toFixed(2)+'%');
  pf.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 520);
}
function popScore(text='+10'){
  try{
    const P = window.Particles || (window.GAME_MODULES && window.GAME_MODULES.Particles);
    if (P){
      const { cx, cy } = centerPoint();
      if (typeof P.popText === 'function'){ P.popText(cx, cy, text, ''); return; }
      if (typeof P.pop === 'function'){ P.pop(cx, cy, text); return; }
    }
  }catch(_){}
  pulseBody('hha-hitfx', 140);
}

// -------------------- Audio tick (no file needed) --------------------
let AC=null;
function ensureAC(){
  try{ if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); }catch(_){}
}
function tickBeep(freq=900, dur=0.045, vol=0.06){
  try{
    ensureAC(); if(!AC) return;
    const t0 = AC.currentTime;
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type='square';
    o.frequency.value=freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0+0.005);
    g.gain.linearRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t0); o.stop(t0+dur+0.01);
  }catch(_){}
}

// -------------------- Config --------------------
const diff = String(qs('diff','normal')).toLowerCase();
const run  = String(qs('run', qs('runMode','play'))).toLowerCase();
const timeLimit =
