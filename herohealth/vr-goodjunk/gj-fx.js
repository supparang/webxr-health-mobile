// === /herohealth/vr-goodjunk/gj-fx.js ===
// GoodJunk FX — PRODUCTION (anti-flash + popup + shards)
// FULL v20260224-fxcore
'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
const now = ()=> (performance?.now?.() ?? Date.now());

function ensureFxRoot(){
  let root = document.getElementById('gj-fx');
  if(root) return root;

  // create fallback if missing
  root = document.createElement('div');
  root.id = 'gj-fx';
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.pointerEvents = 'none';
  root.style.overflow = 'hidden';
  root.style.zIndex = '140';

  // prefer gj-layer parent
  const layer = document.getElementById('gj-layer');
  if(layer && layer.parentElement){
    layer.parentElement.appendChild(root);
  }else{
    document.body.appendChild(root);
  }
  return root;
}

function place(el, x, y){
  // IMPORTANT: avoid top-left flash
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
}

function mk(tag, cls){
  const el = document.createElement(tag);
  el.className = cls;
  return el;
}

export function fxText(x, y, text, tone='t-good'){
  const root = ensureFxRoot();
  const el = mk('div', `gj-fx-text ${tone||''}`.trim());
  el.textContent = String(text || '');
  place(el, x, y);
  root.appendChild(el);
  const life = 720;
  setTimeout(()=>{ try{ el.remove(); }catch(_){} }, life);
}

export function fxBurst(x, y, kind='good', opt={}){
  const root = ensureFxRoot();
  const life = clamp(opt.life ?? 360, 180, 1200);

  // burst ring
  const ring = mk('div', `gj-fx gj-fx-${kind}`.trim());
  ring.style.setProperty('--life', `${life}ms`);
  place(ring, x, y);
  root.appendChild(ring);

  // shards
  const wrap = mk('div', `gj-fx-shards`.trim());
  wrap.style.setProperty('--life', `${Math.max(life, 520)}ms`);
  place(wrap, x, y);

  const n = clamp(opt.shards ?? 10, 6, 16);
  for(let i=0;i<n;i++){
    const s = mk('div', 'gj-shard');
    const w = clamp((opt.shardW ?? 10) + (Math.random()*8), 8, 22);
    const h = clamp((opt.shardH ?? 6) + (Math.random()*8), 6, 20);
    s.style.width = `${w}px`;
    s.style.height= `${h}px`;

    const ang = Math.random()*Math.PI*2;
    const r = clamp(opt.radius ?? 80, 30, 140) * (0.55 + Math.random()*0.55);
    const tx = Math.cos(ang) * r;
    const ty = Math.sin(ang) * r * 0.85 - (10 + Math.random()*18);
    s.style.setProperty('--tx', `${tx.toFixed(1)}px`);
    s.style.setProperty('--ty', `${ty.toFixed(1)}px`);

    // color by kind (simple + safe)
    let col = 'rgba(229,231,235,.90)';
    if(kind==='good' || kind==='defuse') col = 'rgba(16,185,129,.95)';
    if(kind==='junk' || kind==='skull' || kind==='boss' || kind==='rage') col='rgba(244,63,94,.92)';
    if(kind==='star') col='rgba(251,191,36,.96)';
    if(kind==='shield' || kind==='block' || kind==='storm') col='rgba(59,130,246,.92)';
    if(kind==='diamond') col='rgba(167,139,250,.92)';
    s.style.background = col;

    wrap.appendChild(s);
  }
  root.appendChild(wrap);

  setTimeout(()=>{ try{ ring.remove(); }catch(_){} }, life + 60);
  setTimeout(()=>{ try{ wrap.remove(); }catch(_){} }, Math.max(life,520) + 80);
}

export function pulseBody(cls, ms=140){
  try{
    document.body.classList.add(cls);
    setTimeout(()=>document.body.classList.remove(cls), clamp(ms, 80, 600));
  }catch(_){}
}

// Optional bridge: listen to hha:fx and render automatically
export function attachFxBridge(){
  if(window.__GJ_FX_BRIDGE__) return;
  window.__GJ_FX_BRIDGE__ = true;

  window.addEventListener('hha:fx', (ev)=>{
    const d = ev?.detail || {};
    const x = Number(d.x), y = Number(d.y);
    const kind = String(d.kind || 'good');
    if(Number.isFinite(x) && Number.isFinite(y)){
      fxBurst(x, y, kind, d.opt || {});
      if(d.text) fxText(x, y, d.text, d.tone || '');
      if(d.pulse) pulseBody(String(d.pulse), d.pulseMs || 140);
    }
  });
}