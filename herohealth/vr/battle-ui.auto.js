// === /herohealth/vr/battle-ui.auto.js ===
// HeroHealth Battle UI (auto) — optional
// Shows room + countdown + opponent status (best-effort).
// SAFE: does nothing unless ?battle=1 and never breaks gameplay.
'use strict';

(function(){
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const on = String(qs('battle','0')) === '1';
  if(!on) return;

  const DOC = document;

  // lightweight overlay
  const wrap = DOC.createElement('div');
  wrap.id = 'hha-battle-ui';
  wrap.style.position = 'fixed';
  wrap.style.left = '10px';
  wrap.style.top  = `calc(env(safe-area-inset-top, 0px) + 10px)`;
  wrap.style.zIndex = '999';
  wrap.style.pointerEvents = 'none';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '8px';
  wrap.innerHTML = `
    <div style="
      pointer-events:none;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(2,6,23,.60);
      color:rgba(229,231,235,.96);
      border-radius:14px;
      padding:8px 10px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow:0 18px 55px rgba(0,0,0,.40);
      font:900 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial;">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span style="opacity:.85">⚔️ BATTLE</span>
        <span style="opacity:.85">room:</span><b id="hhaRoom">—</b>
        <span style="opacity:.65">|</span>
        <span style="opacity:.85">status:</span><b id="hhaStatus">connecting…</b>
      </div>
      <div style="margin-top:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <span style="opacity:.85">You:</span><b id="hhaYou">—</b>
        <span style="opacity:.65">|</span>
        <span style="opacity:.85">Opp:</span><b id="hhaOpp">—</b>
      </div>
      <div style="margin-top:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <span style="opacity:.85">Winner:</span><b id="hhaWinner">—</b>
      </div>
    </div>
  `;
  DOC.body.appendChild(wrap);

  const $ = (id)=> DOC.getElementById(id);
  const roomEl = $('hhaRoom');
  const stEl   = $('hhaStatus');
  const youEl  = $('hhaYou');
  const oppEl  = $('hhaOpp');
  const winEl  = $('hhaWinner');

  const room = qs('room','') || '(auto)';
  if(roomEl) roomEl.textContent = room;

  function setText(el, v){
    if(!el) return;
    el.textContent = String(v ?? '—');
  }

  // Listen to custom events (best-effort)
  window.addEventListener('hha:battle', (ev)=>{
    const d = ev?.detail || {};
    if(d.room) setText(roomEl, d.room);
    if(d.status) setText(stEl, d.status);
    if(d.you) setText(youEl, d.you);
    if(d.opp) setText(oppEl, d.opp);
    if(d.winner) setText(winEl, d.winner);
  }, { passive:true });

  // If battle-rtdb exists, try to ping it (optional)
  (async ()=>{
    try{
      // NOTE: goodjunk.safe.js imports ../vr/battle-rtdb.js itself
      // Here we only attach to optional helper if the module exposes it.
      const mod = await import('./battle-rtdb.js');
      if(typeof mod?.getBattleDebug === 'function'){
        const dbg = mod.getBattleDebug();
        if(dbg?.room) setText(roomEl, dbg.room);
        if(dbg?.status) setText(stEl, dbg.status);
      }else{
        setText(stEl, 'ready');
      }
    }catch(e){
      // Battle can still work via safe.js; this UI just stays passive.
      setText(stEl, 'ready');
    }
  })();
})();