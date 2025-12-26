// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION
// ensureWaterGauge({textEl, fillEl})
// setWaterGauge(valuePct? , delta?)
// zoneFrom(): 'low'|'balanced'|'high'

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

const W = {
  value: 50,
  textEl: null,
  fillEl: null
};

export function ensureWaterGauge(opts = {}){
  W.textEl = opts.textEl || W.textEl || DOC.getElementById('waterZoneText');
  W.fillEl = opts.fillEl || W.fillEl || DOC.getElementById('waterBarFill');
  render();
}

export function setWaterGauge(valuePct = null, delta = 0){
  if (valuePct != null){
    const v = Number(valuePct);
    if (Number.isFinite(v)) W.value = clamp(v, 0, 100);
  }
  if (delta){
    W.value = clamp(W.value + Number(delta), 0, 100);
  }
  render();
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:water', { detail:{ value: W.value, zone: zoneFrom() } }));
  }catch{}
  return W.value;
}

export function zoneFrom(){
  if (W.value < 35) return 'low';
  if (W.value > 65) return 'high';
  return 'balanced';
}

function render(){
  if (W.fillEl) W.fillEl.style.width = `${clamp(W.value,0,100).toFixed(1)}%`;
  if (W.textEl){
    const z = zoneFrom();
    W.textEl.textContent = `ZONE: ${String(z).toUpperCase()}`;
  }
}

function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }