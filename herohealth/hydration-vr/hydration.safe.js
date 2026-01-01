// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration SAFE — PRODUCTION PATCH v3 (Shoot event + cVR crosshair hit-test)
// ✅ Minis count = Storm Cycles (ไม่ใช่ 999)
// ✅ Storm Success = จำนวนพายุที่ "ผ่าน mini" จริง
// ✅ End-window FX: blink + tick + gentle shake
// ✅ Boss-mini optional: block bossbad xN in boss window
// ✅ AI Coach hooks: storm/end window signals + frustration/fatigue
// ✅ Summary fields match HUD
// ✅ NEW: Listen to hha:shoot (from loader / VR UI) to hit target at crosshair (cVR-friendly)
// ✅ NEW: In cardboard, targets have pointer-events none (avoid double-eye tap mismatch) — use shoot event instead
// ✅ NEW: Safe DOM checks + robust playfield rect

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

// -------------------- View / layers from loader --------------------
function isCardboard(){
  try{ return DOC.body.classList.contains('cardboard'); }catch(_){ return false; }
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
function getPlayfieldNode(){
  return isCardboard()
    ? (DOC.getElementById('cbPlayfield') || DOC.getElementById('playfield'))
    : (DOC.getElementById('playfield') || DOC.getElementById('cbPlayfield'));
}
function getPlayfieldRect(){
  const pf = getPlayfieldNode();
  const r = pf?.getBoundingClientRect?.();
  return r && r.width>2 && r.height>2 ? r : { left:0, top:0, width: 1, height: 1 };
}

// -------------------- Config --------------------
const diff = String(qs('diff','normal')).toLowerCase();
const run  = String(qs('run', qs('runMode','play'))).toLowerCase();
const timeLimit = clamp(parseInt(qs('time', qs('durationPlannedSec', 70)),10) || 70, 20, 600);
const hub = String(qs('hub','./hub.html'));

const sessionId = String(qs('sessionId', qs('studentKey','')) || '');
const ts = String(qs('ts', Date.now()));
const seed = String(qs('seed', sessionId ? (sessionId + '|' + ts) : ts));
const logEndpoint = String(qs('log','') || '');

// RNG deterministic-ish
function hashStr(s){
  s=String(s||''); let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0);
}
function makeRng(seedStr){
  let x = hashStr(seedStr) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0) / 4294967296;
  };
}
const rng = makeRng(seed);

// -------------------- Audio tick/beep (no file needed) --------------------
let AC=null;
function ensureAC(){
  try{
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  }catch(_){}
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
    g.gain.linearRampToValueAtTime(vol,