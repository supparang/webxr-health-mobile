// === /herohealth/vr/battle-ui.auto.js ===
// Auto Battle HUD injector
// ✅ shows ⚔️ BATTLE panel when ?battle=1
// ✅ listens to hha:score + hha:game-ended
// ✅ injects badge into End Overlay to prove battle mode is ON
// PATCH v20260302
'use strict';

import { initBattle } from './battle-rtdb.js';
import { comparePackets, normalizeScorePacket } from './score-compare.js';

function qs(k, d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }
function esc(s){ return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

const on = (qs('battle','0') === '1');
if(!on){
  // do nothing
}else{
  const pid = String(qs('pid','anon')).trim() || 'anon';
  const gameKey = 'goodjunk';
  const room = String(qs('room','')).trim();

  // inject corner HUD
  const hud = document.createElement('div');
  hud.id = 'hhaBattleHud';
  hud.style.position = 'fixed';
  hud.style.right = '10px';
  hud.style.top = `calc(env(safe-area-inset-top, 0px) + 10px)`;
  hud.style.zIndex = '9999';
  hud.style.pointerEvents = 'none';
  hud.innerHTML = `
    <div style="
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.66);
      color:rgba(229,231,235,.96);
      border-radius:14px;
      padding:10px 10px;
      min-width:220px;
      box-shadow:0 18px 55px rgba(0,0,0,.45);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      font: 900 12px/1.25 system-ui, -apple-system, Segoe UI, Roboto, Arial;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div>⚔️ BATTLE</div>
        <div style="opacity:.85">room <span id="hhaRoom">${esc(room||'—')}</span></div>
      </div>
      <div style="margin-top:8px;display:grid;grid-template-columns:1fr;gap:6px;">
        <div style="display:flex;justify-content:space-between;">
          <span>Me</span><span id="hhaMe">—</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Opp</span><span id="hhaOpp">—</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Winner</span><span id="hhaWin">—</span>
        </div>
      </div>
      <div style="margin-top:8px;opacity:.7;font-weight:900">
        score → acc → miss → medianRT
      </div>
    </div>
  `;
  document.body.appendChild(hud);

  const $me = hud.querySelector('#hhaMe');
  const $op = hud.querySelector('#hhaOpp');
  const $wi = hud.querySelector('#hhaWin');

  function fmt(p){
    if(!p) return '—';
    const s = Number(p.score ?? 0)|0;
    const a = Number(p.accPct ?? 0);
    const m = Number(p.miss ?? 0)|0;
    const rt = Number(p.medianRtGoodMs ?? 0)|0;
    return `${s} | ${a.toFixed(0)}% | m${m} | rt${rt}`;
  }

  // end badge injection (soคุณเห็นแน่ ๆ)
  function injectEndBadge(text){
    try{
      const endOverlay = document.getElementById('endOverlay');
      if(!endOverlay) return;

      const panel = endOverlay.querySelector('.panel') || endOverlay;
      let badge = panel.querySelector('[data-hha-battle-badge="1"]');
      if(!badge){
        badge = document.createElement('div');
        badge.dataset.hhaBattleBadge = '1';
        badge.style.marginTop = '10px';
        badge.style.display = 'flex';
        badge.style.justifyContent = 'center';
        badge.style.pointerEvents = 'none';
        badge.innerHTML = `
          <div style="
            border:1px solid rgba(148,163,184,.18);
            background:rgba(2,6,23,.62);
            color:rgba(229,231,235,.96);
            border-radius:14px;
            padding:10px 12px;
            box-shadow:0 18px 55px rgba(0,0,0,.40);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            font: 1000 14px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial;">
            <span id="hhaBattleBadgeText">⚔️ BATTLE MODE ON</span>
          </div>
        `;
        panel.appendChild(badge);
      }
      const t = badge.querySelector('#hhaBattleBadgeText');
      if(t) t.textContent = String(text||'⚔️ BATTLE MODE ON');
    }catch(e){}
  }

  // show immediately
  injectEndBadge('⚔️ BATTLE MODE ON');

  let myLatest = null;
  let oppLatest = null;

  // init battle transport
  const battle = await initBattle({
    enabled:true,
    room,
    pid,
    gameKey,
    autostartMs: Number(qs('autostart','3000'))||3000,
    forfeitMs: Number(qs('forfeit','5000'))||5000
  });

  // listen scores from game
  window.addEventListener('hha:score', (ev)=>{
    const p = ev?.detail || null;
    if(!p) return;

    myLatest = normalizeScorePacket({ ...p, pid });
    try{ battle?.pushScore?.(myLatest); }catch(e){}
    if($me) $me.textContent = fmt(myLatest);
  }, { passive:true });

  // render opponent + winner
  battle?.onState?.((st)=>{
    try{
      myLatest = st?.me || myLatest;
      oppLatest = st?.opp || oppLatest;

      if($me) $me.textContent = fmt(myLatest);
      if($op) $op.textContent = fmt(oppLatest);
      if($wi) $wi.textContent = String(st?.winnerPid || '—');
    }catch(e){}
  });

  // on end: finalize + badge result
  window.addEventListener('hha:game-ended', (ev)=>{
    const summary = ev?.detail || null;

    if(summary){
      myLatest = normalizeScorePacket({ ...summary, pid });
      try{ battle?.finalizeEnd?.(summary); }catch(e){}
    }

    let label = '⚔️ BATTLE MODE ON';
    if(myLatest && oppLatest){
      const c = comparePackets(myLatest, oppLatest);
      if(c === 0) label = '🤝 เสมอ (TIE)';
      else label = (c > 0) ? '🏆 YOU WIN!' : '😵 YOU LOSE!';
    }
    injectEndBadge(label);
  }, { passive:true });
}