// === /herohealth/vr/battle-ui.js ===
// HeroHealth Battle UI Overlay (Room + Live Score + Result Banner)
// Works with battle-rtdb.js events
// FULL v20260228-BATTLE-UI
'use strict';

import { normalizeResult, compareResults } from './score-rank.js';

const WIN = (typeof window!=='undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }

function ensureStyle(){
  if(!DOC || DOC.getElementById('hh-battle-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hh-battle-style';
  st.textContent = `
  .hh-battle{
    position:fixed;
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    left: 10px;
    right: 10px;
    z-index: 265;
    pointer-events: none;
    display:flex;
    justify-content:center;
  }
  .hh-battle-card{
    max-width:760px; width:100%;
    border:1px solid rgba(148,163,184,.16);
    background:rgba(2,6,23,.64);
    color:rgba(229,231,235,.96);
    border-radius:16px;
    padding:10px 12px;
    box-shadow:0 18px 55px rgba(0,0,0,.40);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    font: 900 12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;
    display:flex;
    gap:10px;
    align-items:center;
    justify-content:space-between;
  }
  .hh-battle-left{ display:flex; gap:8px; align-items:center; }
  .hh-pill{
    display:inline-flex; align-items:center; gap:6px;
    border:1px solid rgba(148,163,184,.18);
    background:rgba(15,23,42,.55);
    border-radius:999px;
    padding:4px 8px;
    font-weight:1000;
    font-size:11px;
    opacity:.95;
    white-space:nowrap;
  }
  .hh-mini{ opacity:.86; font-weight:900; font-size:11px; }
  .hh-grid{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:8px;
    width:100%;
  }
  .hh-side{
    border:1px solid rgba(148,163,184,.12);
    background:rgba(15,23,42,.35);
    border-radius:12px;
    padding:8px 10px;
    display:flex;
    flex-direction:column;
    gap:4px;
    min-width: 0;
  }
  .hh-row{
    display:flex;
    justify-content:space-between;
    gap:8px;
    font-weight:950;
    font-size:11px;
    opacity:.95;
  }
  .hh-row span:last-child{ opacity:.95; }
  .hh-name{ font-weight:1100; font-size:12px; letter-spacing:.2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .hh-muted{ opacity:.82; font-weight:900; }
  .hh-result{
    position:fixed;
    left: 12px;
    right: 12px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
    z-index: 266;
    pointer-events:none;
    display:flex;
    justify-content:center;
    opacity:0;
    transform: translateY(8px);
    transition: opacity .18s ease, transform .18s ease;
  }
  .hh-result.show{ opacity:1; transform: translateY(0); }
  .hh-result-card{
    max-width:760px; width:100%;
    border-radius:18px;
    padding:12px 12px;
    border:1px solid rgba(148,163,184,.16);
    background:rgba(2,6,23,.72);
    color:rgba(229,231,235,.96);
    box-shadow:0 18px 55px rgba(0,0,0,.45);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    font: 1000 13px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;
  }
  .hh-result-top{ display:flex; justify-content:space-between; gap:10px; align-items:center; }
  .hh-badge{
    border-radius:999px;
    padding:6px 10px;
    font-size:12px;
    font-weight:1200;
    border:1px solid rgba(148,163,184,.20);
    background:rgba(15,23,42,.55);
  }
  .hh-win{ border-color: rgba(34,197,94,.28); background: rgba(34,197,94,.12); }
  .hh-lose{ border-color: rgba(239,68,68,.28); background: rgba(239,68,68,.10); }
  .hh-tie{ border-color: rgba(59,130,246,.28); background: rgba(59,130,246,.10); }
  .hh-rule{ opacity:.85; font-size:11px; font-weight:950; }
  .hh-break{
    margin-top:10px;
    border-top:1px solid rgba(148,163,184,.14);
    padding-top:10px;
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:10px;
  }
  .hh-kv{ display:flex; justify-content:space-between; gap:10px; font-size:12px; font-weight:1050; }
  .hh-kv .k{ opacity:.85; font-weight:950; }
  `;
  DOC.head.appendChild(st);
}

function fmtPct(n){ n=Number(n)||0; return `${Math.round(n)}%`; }
function fmtMs(n){ n=Number(n)||0; return `${Math.round(n)}ms`; }
function fmtNum(n){ n=Number(n)||0; return String(Math.round(n)); }

export function mountBattleUI(opts){
  if(!DOC) return null;
  ensureStyle();

  opts = opts || {};
  const enabled = String(opts.enabled ?? qs('battle','0')) === '1';
  if(!enabled) return null;

  const wrap = DOC.createElement('div');
  wrap.className = 'hh-battle';
  wrap.innerHTML = `
    <div class="hh-battle-card">
      <div class="hh-battle-left">
        <span class="hh-pill" id="hhRoom">🏟️ ROOM: —</span>
        <span class="hh-pill" id="hhState">⏳ waiting</span>
        <span class="hh-pill" id="hhRule">Rule: score→acc→miss→medianRT</span>
      </div>

      <div class="hh-grid">
        <div class="hh-side">
          <div class="hh-name" id="hhMe">ME: —</div>
          <div class="hh-row"><span class="hh-muted">Score</span><span id="hhMeScore">0</span></div>
          <div class="hh-row"><span class="hh-muted">Acc</span><span id="hhMeAcc">0%</span></div>
          <div class="hh-row"><span class="hh-muted">Miss</span><span id="hhMeMiss">0</span></div>
          <div class="hh-row"><span class="hh-muted">MedRT</span><span id="hhMeRT">0ms</span></div>
        </div>

        <div class="hh-side">
          <div class="hh-name" id="hhOp">OPP: —</div>
          <div class="hh-row"><span class="hh-muted">Score</span><span id="hhOpScore">0</span></div>
          <div class="hh-row"><span class="hh-muted">Acc</span><span id="hhOpAcc">0%</span></div>
          <div class="hh-row"><span class="hh-muted">Miss</span><span id="hhOpMiss">0</span></div>
          <div class="hh-row"><span class="hh-muted">MedRT</span><span id="hhOpRT">0ms</span></div>
        </div>
      </div>
    </div>
  `;
  DOC.body.appendChild(wrap);

  const res = DOC.createElement('div');
  res.className = 'hh-result';
  res.innerHTML = `
    <div class="hh-result-card">
      <div class="hh-result-top">
        <div>
          <div style="font-size:14px; font-weight:1200; letter-spacing:.2px;">Battle Result</div>
          <div class="hh-rule">Rule: score→acc→miss→medianRT</div>
        </div>
        <div class="hh-badge" id="hhBadge">—</div>
      </div>

      <div class="hh-break" id="hhBreak">
        <div>
          <div class="hh-name" style="margin-bottom:6px;" id="hhBreakMe">ME</div>
          <div class="hh-kv"><span class="k">Score</span><span id="hhBMeS">0</span></div>
          <div class="hh-kv"><span class="k">Acc</span><span id="hhBMeA">0%</span></div>
          <div class="hh-kv"><span class="k">Miss</span><span id="hhBMeM">0</span></div>
          <div class="hh-kv"><span class="k">MedRT</span><span id="hhBMeR">0ms</span></div>
        </div>
        <div>
          <div class="hh-name" style="margin-bottom:6px;" id="hhBreakOp">OPP</div>
          <div class="hh-kv"><span class="k">Score</span><span id="hhBOpS">0</span></div>
          <div class="hh-kv"><span class="k">Acc</span><span id="hhBOpA">0%</span></div>
          <div class="hh-kv"><span class="k">Miss</span><span id="hhBOpM">0</span></div>
          <div class="hh-kv"><span class="k">MedRT</span><span id="hhBOpR">0ms</span></div>
        </div>
      </div>
    </div>
  `;
  DOC.body.appendChild(res);

  // refs
  const $ = (id)=> DOC.getElementById(id);
  const elRoom = $('hhRoom');
  const elState= $('hhState');

  const elMe = $('hhMe'), elOp = $('hhOp');
  const elMeS=$('hhMeScore'), elMeA=$('hhMeAcc'), elMeM=$('hhMeMiss'), elMeR=$('hhMeRT');
  const elOpS=$('hhOpScore'), elOpA=$('hhOpAcc'), elOpM=$('hhOpMiss'), elOpR=$('hhOpRT');

  const elBadge=$('hhBadge');
  const elBMe=$('hhBreakMe'), elBOp=$('hhBreakOp');
  const elBMeS=$('hhBMeS'), elBMeA=$('hhBMeA'), elBMeM=$('hhBMeM'), elBMeR=$('hhBMeR');
  const elBOpS=$('hhBOpS'), elBOpA=$('hhBOpA'), elBOpM=$('hhBOpM'), elBOpR=$('hhBOpR');

  // state
  const st = {
    room: qs('room',''),
    meKey: null,
    opKey: null,
    players: {},
    mePid: qs('pid','anon'),
    opPid: '—',
    liveMe: { score:0, accPct:0, miss:0, medianRtGoodMs:0 },
    liveOp: { score:0, accPct:0, miss:0, medianRtGoodMs:0 },
    ended: false
  };

  if(elRoom) elRoom.textContent = `🏟️ ROOM: ${st.room || '—'}`;

  function applyLive(){
    if(elMe) elMe.textContent = `ME: ${st.mePid || 'anon'}`;
    if(elOp) elOp.textContent = `OPP: ${st.opPid || '—'}`;

    elMeS.textContent = fmtNum(st.liveMe.score);
    elMeA.textContent = fmtPct(st.liveMe.accPct);
    elMeM.textContent = fmtNum(st.liveMe.miss);
    elMeR.textContent = fmtMs(st.liveMe.medianRtGoodMs);

    elOpS.textContent = fmtNum(st.liveOp.score);
    elOpA.textContent = fmtPct(st.liveOp.accPct);
    elOpM.textContent = fmtNum(st.liveOp.miss);
    elOpR.textContent = fmtMs(st.liveOp.medianRtGoodMs);
  }

  function setBadge(kind, text){
    if(!elBadge) return;
    elBadge.className = 'hh-badge ' + (kind==='win'?'hh-win':kind==='lose'?'hh-lose':'hh-tie');
    elBadge.textContent = text;
  }

  function showResult(meRes, opRes){
    const A = normalizeResult(meRes);
    const B = normalizeResult(opRes);
    const cmp = compareResults(A, B);

    if(cmp < 0) setBadge('lose', 'LOSE');
    else if(cmp > 0) setBadge('win', 'WIN');
    else setBadge('tie', 'TIE');

    elBMe.textContent = `ME: ${st.mePid || 'anon'}`;
    elBOp.textContent = `OPP: ${st.opPid || '—'}`;

    elBMeS.textContent = fmtNum(A.score);
    elBMeA.textContent = fmtPct(A.acc);
    elBMeM.textContent = fmtNum(A.miss);
    elBMeR.textContent = fmtMs(A.medRT);

    elBOpS.textContent = fmtNum(B.score);
    elBOpA.textContent = fmtPct(B.acc);
    elBOpM.textContent = fmtNum(B.miss);
    elBOpR.textContent = fmtMs(B.medRT);

    res.classList.add('show');
  }

  // events
  WIN.addEventListener('hha:battle-players', (ev)=>{
    const d = ev?.detail || {};
    st.meKey = d.me || st.meKey;
    st.opKey = d.opponent || st.opKey;
    st.players = d.players || st.players;

    const me = st.players?.[st.meKey] || null;
    const op = st.opKey ? st.players?.[st.opKey] : null;

    st.mePid = String(me?.pid || st.mePid || 'anon');
    st.opPid = String(op?.pid || (st.opKey||'—'));

    // live fields if exist
    if(me){
      st.liveMe = {
        score: Number(me.score||0),
        miss: Number(me.miss||0),
        accPct: Number(me.accPct||0),
        medianRtGoodMs: Number(me.medianRtGoodMs||0)
      };
    }
    if(op){
      st.liveOp = {
        score: Number(op.score||0),
        miss: Number(op.miss||0),
        accPct: Number(op.accPct||0),
        medianRtGoodMs: Number(op.medianRtGoodMs||0)
      };
    }

    applyLive();
  });

  WIN.addEventListener('hha:battle-state', (ev)=>{
    const d = ev?.detail || {};
    const status = String(d.status||'waiting');
    if(elState){
      elState.textContent =
        status==='started' ? '▶️ started' :
        status==='ended' ? '🏁 ended' :
        '⏳ waiting';
    }
  });

  // Update live from local score event too (instant)
  WIN.addEventListener('hha:score', (ev)=>{
    const p = ev?.detail || {};
    st.liveMe = {
      score: Number(p.score||0),
      miss: Number(p.miss||0),
      accPct: Number(p.accPct||0),
      medianRtGoodMs: Number(p.medianRtGoodMs||0)
    };
    applyLive();
  });

  // When ended, show result banner (prefer payload a/b)
  WIN.addEventListener('hha:battle-ended', (ev)=>{
    if(st.ended) return;
    st.ended = true;
    const d = ev?.detail || {};
    // if module supplies a/b (recommended)
    const a = d.a || null;
    const b = d.b || null;

    if(a && b){
      // identify which is me by pid
      const meIsA = String(a.pid||'') === String(st.mePid||'');
      const meRes = meIsA ? a : b;
      const opRes = meIsA ? b : a;
      showResult(meRes, opRes);
      return;
    }

    // fallback using current live values
    showResult(
      { scoreFinal: st.liveMe.score, accPct: st.liveMe.accPct, missTotal: st.liveMe.miss, medianRtGoodMs: st.liveMe.medianRtGoodMs },
      { scoreFinal: st.liveOp.score, accPct: st.liveOp.accPct, missTotal: st.liveOp.miss, medianRtGoodMs: st.liveOp.medianRtGoodMs }
    );
  });

  applyLive();

  return {
    root: wrap,
    result: res,
    state: st
  };
}

export function autoMountBattleUI(){
  if(!DOC) return;
  if(WIN.__HHA_BATTLE_UI__) return;
  WIN.__HHA_BATTLE_UI__ = 1;
  mountBattleUI({ enabled: true });
}