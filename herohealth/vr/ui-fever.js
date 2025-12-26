// === /herohealth/vr/ui-fever.js ===
// Fever UI — PRODUCTION (works with any HeroHealth game)
// ensureFeverUI()
// setFever(pct0to100)
// setShield(n)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const F = {
  fever: 0,
  shield: 0
};

export function ensureFeverUI(){
  // if you later add a visual bar, bind here.
  // currently HUD text is updated by game; this is a safe shared holder.
  if (!ROOT.FeverUI) ROOT.FeverUI = { setFever, setShield, get: ()=>({ ...F }) };
}

export function setFever(pct){
  F.fever = clamp(pct, 0, 100);
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:fever', { detail:{ fever: F.fever, shield: F.shield } }));
  }catch{}
  return F.fever;
}

export function setShield(n){
  F.shield = clamp(n, 0, 9);
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:shield', { detail:{ shield: F.shield, fever: F.fever } }));
  }catch{}
  return F.shield;
}

function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }