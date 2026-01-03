// === /herohealth/vr/recenter-helper.js ===
// HHA Recenter Helper — PRODUCTION
// - Provides a simple "recenter offset" for crosshair/tap-to-shoot aiming
// - Works well for cVR/Cardboard where user wants center calibration
// - Stores per game/view in localStorage
// - Emits: hha:recenter { dx, dy, source }
// - Exposes: window.HHA_RECENTER.recenter(), get(), set(dx,dy), clear()

(function(){
  'use strict';
  const ROOT = window;
  const DOC  = document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  const game = (qs('game') || qs('gameMode') || 'plate').toLowerCase();
  const view = (qs('view') || 'mobile').toLowerCase();
  const KEY = `HHA_RECENTER_${game}_${view}`;

  let state = { dx:0, dy:0 };

  function load(){
    try{
      const s = localStorage.getItem(KEY);
      if(!s) return;
      const j = JSON.parse(s);
      if(j && typeof j.dx==='number' && typeof j.dy==='number'){
        state.dx = clamp(j.dx, -120, 120);
        state.dy = clamp(j.dy, -120, 120);
      }
    }catch(_){}
  }
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify({ dx:state.dx, dy:state.dy })); }catch(_){}
  }

  function set(dx, dy, source){
    state.dx = clamp(dx, -120, 120);
    state.dy = clamp(dy, -120, 120);
    save();
    emit('hha:recenter', { dx:state.dx, dy:state.dy, source: source||'set' });
  }

  function clear(){
    state.dx = 0; state.dy = 0;
    try{ localStorage.removeItem(KEY); }catch(_){}
    emit('hha:recenter', { dx:0, dy:0, source:'clear' });
  }

  function get(){ return { dx:state.dx, dy:state.dy }; }

  // “Recenter now” = ตั้ง offset ให้ crosshair ณ ตอนนี้เป็นศูนย์
  // วิธี: วัด visualViewport center (หรือ inner) แล้ว set offset = 0 (เกมจะใช้ offset นี้ไปชดเชยตอนยิง)
  // แต่เราไม่มี sensor ของผู้ใช้จริง ๆ จึงให้ UX เป็น: ปรับจูนด้วยปุ่ม +/- ใน UI ได้ (ด้านล่าง)
  function recenter(source){
    // hard reset to 0 (simple & reliable)
    set(0,0, source||'recenter');
  }

  // Optional mini UI for calibration (only show in cVR/VR)
  function ensureMiniUI(){
    const show = (view === 'cvr' || view === 'vr');
    if(!show) return;

    const id = 'hha-recenter-mini';
    if(DOC.getElementById(id)) return;

    const wrap = DOC.createElement('div');
    wrap.id = id;
    wrap.style.cssText = `
      position:fixed; left:10px; top: calc(10px + var(--sat,0px));
      z-index:160; display:flex; gap:6px; flex-wrap:wrap;
      pointer-events:none;
    `;

    function mkBtn(txt, onClick){
      const b = DOC.createElement('button');
      b.type = 'button';
      b.textContent = txt;
      b.style.cssText = `
        pointer-events:auto;
        appearance:none;border:none;border-radius:999px;
        padding:9px 10px;
        background:rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.22);
        color:rgba(229,231,235,.95);
        font: 1000 12px/1 system-ui;
        backdrop-filter: blur(10px);
      `;
      b.addEventListener('click', onClick, { passive:true });
      return b;
    }

    const step = 6;
    wrap.appendChild(mkBtn('⟲ RECENTER', ()=>recenter('mini-ui')));
    wrap.appendChild(mkBtn('←', ()=>set(state.dx - step, state.dy, 'mini-ui')));
    wrap.appendChild(mkBtn('→', ()=>set(state.dx + step, state.dy, 'mini-ui')));
    wrap.appendChild(mkBtn('↑', ()=>set(state.dx, state.dy - step, 'mini-ui')));
    wrap.appendChild(mkBtn('↓', ()=>set(state.dx, state.dy + step, 'mini-ui')));
    wrap.appendChild(mkBtn('✖', ()=>clear()));

    DOC.body.appendChild(wrap);
  }

  load();
  ROOT.HHA_RECENTER = { recenter, get, set, clear, key: KEY };

  // emit initial so game can pick up immediately
  emit('hha:recenter', { dx:state.dx, dy:state.dy, source:'init' });

  // build mini UI after DOM ready
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', ensureMiniUI, { once:true });
  }else{
    ensureMiniUI();
  }
})();