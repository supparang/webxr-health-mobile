// === /herohealth/vr/battle-ui.auto.js ===
// Auto Battle UI Overlay (SAFE)
// - listens: hha:battle, hha:score, hha:game-ended
// - shows: room/status/you/opp/winner
'use strict';

import { compareScorePackets, formatPacket, normalizeScorePacket } from './score-compare.js';

const WIN = window;
const DOC = document;

function qs(k, d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }

const enabled = String(qs('battle','0')) === '1';
if(!enabled){
  // still listen for game-ended? no need.
} else {
  boot();
}

function boot(){
  const pid = String(qs('pid','anon')).trim() || 'anon';
  const room = String(qs('room','')).trim() || '—';

  // UI container
  const wrap = DOC.createElement('div');
  wrap.id = 'hhaBattleHud';
  wrap.style.position = 'fixed';
  wrap.style.top = '10px';
  wrap.style.right = '10px';
  wrap.style.zIndex = '9999';
  wrap.style.pointerEvents = 'none';
  wrap.style.maxWidth = '320px';
  wrap.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';

  wrap.innerHTML = `
    <div style="
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.62);
      color:rgba(229,231,235,.96);
      border-radius:14px;
      padding:10px 10px;
      box-shadow:0 18px 55px rgba(0,0,0,.40);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display:flex;
      flex-direction:column;
      gap:6px;
      ">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
        <div style="font-weight:1000;letter-spacing:.2px;">⚔️ BATTLE</div>
        <div style="font-weight:900;opacity:.85;">room <span id="bhRoom">${esc(room)}</span></div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span style="padding:4px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.35);font-weight:900;">
          status <span id="bhStatus">—</span>
        </span>
        <span style="padding:4px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.35);font-weight:900;">
          you <span id="bhYouPid">${esc(pid)}</span>
        </span>
      </div>

      <div style="font-size:12px;opacity:.95;">
        <div style="display:flex;justify-content:space-between;gap:10px;">
          <span style="opacity:.8;">YOU</span>
          <span style="font-weight:900" id="bhYou">—</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px;">
          <span style="opacity:.8;">OPP</span>
          <span style="font-weight:900" id="bhOpp">—</span>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
        <div style="font-size:12px;opacity:.8;">tie-break: score→acc→miss→medianRT</div>
        <div style="font-weight:1000" id="bhWinner">—</div>
      </div>
    </div>
  `;
  DOC.body.appendChild(wrap);

  const elStatus = wrap.querySelector('#bhStatus');
  const elYou = wrap.querySelector('#bhYou');
  const elOpp = wrap.querySelector('#bhOpp');
  const elWinner = wrap.querySelector('#bhWinner');

  // Local snapshots
  let youPacket = null;
  let oppPacket = null;
  let winnerPid = '—';

  function setText(el, v){
    if(!el) return;
    el.textContent = String(v ?? '—');
  }

  function decideWinnerLocal(){
    if(!youPacket || !oppPacket) return null;
    const a = normalizeScorePacket({ ...youPacket, pid });
    const b = normalizeScorePacket({ ...oppPacket, pid: String(oppPacket.pid||'opponent') });
    const c = compareScorePackets(a,b);
    return (c <= 0) ? a : b;
  }

  function updateHud(){
    setText(elYou, youPacket ? formatPacket({ ...youPacket, pid }) : '—');
    setText(elOpp, oppPacket ? formatPacket(oppPacket) : '—');

    // winner: from battle event, else local compare
    let w = winnerPid;
    if(w === '—'){
      const local = decideWinnerLocal();
      if(local) w = local.pid;
    }
    setText(elWinner, w === '—' ? 'winner —' : `winner ${w}`);
  }

  // Listen battle bus
  WIN.addEventListener('hha:battle', (ev)=>{
    const d = ev?.detail || {};
    setText(elStatus, d.status || '—');
    // d.you / d.opp are strings (short)
    // winner maybe pid string
    if(typeof d.winner === 'string' && d.winner){
      winnerPid = d.winner;
    }
    updateHud();
  });

  // Listen realtime score (your own)
  WIN.addEventListener('hha:score', (ev)=>{
    const p = ev?.detail || null;
    if(!p) return;
    youPacket = {
      pid,
      score: Number(p.score)||0,
      accPct: Number(p.accPct)||0,
      miss: Number(p.miss)||0,
      medianRtGoodMs: Number(p.medianRtGoodMs)||0,
      ts: Date.now()
    };
    updateHud();
  });

  // Listen game end to pin badge on endOverlay
  WIN.addEventListener('hha:game-ended', (ev)=>{
    const summary = ev?.detail || null;
    // try compute local winner if not set yet
    let w = winnerPid;
    if(w === '—'){
      const local = decideWinnerLocal();
      if(local) w = local.pid;
    }
    injectEndBadge(w, summary);
  });

  // Also if battle module sends opponent scores via battle push -> we can read from window events? (not available)
  // However battle-rtdb.js emits hha:battle frequently; we accept "opp" short string only.
  // To show numeric opp packet, we can listen to storage/broadcast? not safe here.
  // Workaround: battle-rtdb pushes scores via hha:battle? We'll add optional hook:
  WIN.addEventListener('hha:battle-score', (ev)=>{
    // if you later decide to emit this from battle-rtdb, UI will auto show
    const d = ev?.detail || {};
    if(d.opp && typeof d.opp === 'object') oppPacket = d.opp;
    if(d.winner) winnerPid = d.winner;
    updateHud();
  });

  updateHud();
}

function injectEndBadge(winnerPid, summary){
  try{
    const endOverlay = DOC.getElementById('endOverlay');
    if(!endOverlay) return;

    const panel = endOverlay.querySelector('.panel') || endOverlay;

    let badge = panel.querySelector('[data-hha-battle-badge="1"]');
    if(!badge){
      badge = DOC.createElement('div');
      badge.dataset.hhaBattleBadge = '1';
      badge.style.marginTop = '10px';
      badge.style.display = 'flex';
      badge.style.justifyContent = 'center';
      panel.appendChild(badge);
    }

    const me = String(qs('pid','anon')).trim() || 'anon';
    const win = String(winnerPid || '—');

    let label = 'ยังไม่รู้ผล';
    if(win !== '—'){
      label = (win === me) ? '🏆 YOU WIN!' : `😵 YOU LOSE (winner ${win})`;
    }

    badge.innerHTML = `
      <div style="
        width:100%;
        max-width:520px;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.35);
        border-radius:14px;
        padding:10px 12px;
        text-align:center;
        font-weight:1000;
        color:rgba(229,231,235,.96);
        ">
        <div style="font-size:14px;letter-spacing:.2px;">${esc(label)}</div>
        <div style="margin-top:4px;font-size:12px;opacity:.85;">
          rule: score→acc→miss→medianRT
        </div>
      </div>
    `;
  }catch(e){}
}

function esc(s){
  s = String(s ?? '');
  return s.replace(/[&<>"']/g, (c)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}