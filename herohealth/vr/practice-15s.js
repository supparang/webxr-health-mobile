// === /herohealth/vr/practice-15s.js ===
// Practice Mode (15s) — overlay + gate start
// Emits:
//  - hha:practice_begin { durationSec }
//  - hha:practice_end { reason, stats }
//  - hha:start (when practice finishes unless user cancels)
// Listens:
//  - hha:judge (kind: good/shield/bad/block/miss) for live scoring
// Usage:
//  const P = initPracticeGate({ durationSec:15, auto:true });
//  P.maybeStart();  // call once at boot

'use strict';

function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function ensureStyle(){
  if (document.getElementById('hha-practice-style')) return;
  const st=document.createElement('style');
  st.id='hha-practice-style';
  st.textContent=`
  .hha-practice{
    position:fixed; inset:0; z-index:125;
    display:flex; align-items:center; justify-content:center;
    padding: calc(18px + env(safe-area-inset-top,0px)) 18px calc(18px + env(safe-area-inset-bottom,0px)) 18px;
    background: rgba(2,6,23,.78);
    backdrop-filter: blur(10px);
    pointer-events:auto;
  }
  .hha-practice[hidden]{ display:none; }
  .hha-practice-card{
    width:min(980px,100%);
    border-radius:22px;
    border:1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.72);
    box-shadow: 0 24px 90px rgba(0,0,0,.55);
    padding:16px;
  }
  .hha-practice-top{
    display:flex; justify-content:space-between; align-items:flex-start; gap:12px;
  }
  .hha-practice-title{
    margin:0;
    font:900 16px/1.2 system-ui;
    color: rgba(229,231,235,.95);
  }
  .hha-practice-sub{
    margin:6px 0 0 0;
    color: rgba(148,163,184,.95);
    font:600 13px/1.35 system-ui;
    white-space:pre-line;
  }
  .hha-practice-grid{
    margin-top:12px;
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:12px;
  }
  .hha-practice-panel{
    background: rgba(15,23,42,.62);
    border:1px solid rgba(148,163,184,.14);
    border-radius:18px;
    padding:12px;
  }
  .hha-k{ font:700 12px/1.2 system-ui; color: rgba(148,163,184,.95); }
  .hha-v{ font:900 22px/1 system-ui; color: rgba(229,231,235,.95); margin-top:6px; }
  .hha-row{ display:flex; justify-content:space-between; gap:10px; margin-top:10px; }
  .hha-pill{
    display:inline-flex; align-items:center; gap:8px;
    padding:8px 10px;
    border-radius:999px;
    border:1px solid rgba(148,163,184,.14);
    background: rgba(2,6,23,.45);
    font:900 12px/1 system-ui;
    color: rgba(229,231,235,.92);
  }
  .hha-goals{
    margin-top:8px;
    font:800 13px/1.35 system-ui;
    color: rgba(229,231,235,.92);
    white-space:pre-line;
  }
  .hha-practice-btns{ display:flex; flex-wrap:wrap; gap:10px; margin-top:12px; }
  .hha-btn{
    appearance:none;
    border:1px solid rgba(148,163,184,.18);
    background: rgba(15,23,42,.62);
    color: rgba(229,231,235,.92);
    padding:10px 12px;
    border-radius:14px;
    font:900 13px/1 system-ui;
    cursor:pointer;
    user-select:none;
  }
  .hha-btn.primary{
    border-color: rgba(34,197,94,.28);
    background: rgba(34,197,94,.16);
  }
  .hha-btn.cyan{
    border-color: rgba(34,211,238,.28);
    background: rgba(34,211,238,.12);
  }
  `;
  document.head.appendChild(st);
}

export function initPracticeGate(opts = {}){
  ensureStyle();

  const durationSec = Math.max(8, Number(opts.durationSec ?? 15));
  const auto = String(opts.auto ?? '1') !== '0';

  let overlay = document.getElementById('hhaPractice');
  if (!overlay){
    overlay = document.createElement('div');
    overlay.id='hhaPractice';
    overlay.className='hha-practice';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="hha-practice-card">
        <div class="hha-practice-top">
          <div>
            <p class="hha-practice-title">Practice Mode — วอร์มมือก่อนเข้าเกมจริง</p>
            <p class="hha-practice-sub" id="hhaPracticeSub">15s Warm-up: ยิง 💧 + เก็บ 🛡️ + เลี่ยง 🥤</p>
          </div>
          <div class="hha-pill">⏱️ <span id="hhaPracticeT">15</span>s</div>
        </div>

        <div class="hha-practice-grid">
          <div class="hha-practice-panel">
            <div class="hha-k">Practice Score</div>
            <div class="hha-v" id="hhaPracticeScore">0</div>
            <div class="hha-row">
              <div class="hha-pill">Combo <b id="hhaPracticeCombo">0</b></div>
              <div class="hha-pill">Miss <b id="hhaPracticeMiss">0</b></div>
            </div>
          </div>

          <div class="hha-practice-panel">
            <div class="hha-k">Checklist (แนะนำ)</div>
            <div class="hha-goals" id="hhaPracticeGoals">
• ยิง 💧 ให้ได้อย่างน้อย 8 ครั้ง
• เก็บ 🛡️ อย่างน้อย 1
• อย่ายิง/โดน 🥤 เกิน 2 ครั้ง
            </div>
            <div class="hha-row">
              <div class="hha-pill">💧 <b id="hhaPracticeGood">0</b></div>
              <div class="hha-pill">🛡️ <b id="hhaPracticeShield">0</b></div>
              <div class="hha-pill">🥤 <b id="hhaPracticeBad">0</b></div>
            </div>
          </div>
        </div>

        <div class="hha-practice-btns">
          <button class="hha-btn cyan" id="hhaPracticeStart">▶ Start Practice</button>
          <button class="hha-btn" id="hhaPracticeSkip">⏭️ Skip to Real Game</button>
          <button class="hha-btn primary" id="hhaPracticeGoNow">✅ Start Real Game Now</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const elT = overlay.querySelector('#hhaPracticeT');
  const elScore = overlay.querySelector('#hhaPracticeScore');
  const elCombo = overlay.querySelector('#hhaPracticeCombo');
  const elMiss = overlay.querySelector('#hhaPracticeMiss');
  const elGood = overlay.querySelector('#hhaPracticeGood');
  const elShield = overlay.querySelector('#hhaPracticeShield');
  const elBad = overlay.querySelector('#hhaPracticeBad');
  const btnStart = overlay.querySelector('#hhaPracticeStart');
  const btnSkip  = overlay.querySelector('#hhaPracticeSkip');
  const btnGoNow = overlay.querySelector('#hhaPracticeGoNow');

  const ST = {
    active:false,
    tLeft: durationSec,
    score:0,
    combo:0,
    miss:0,
    good:0,
    shield:0,
    bad:0
  };

  function sync(){
    if (elT) elT.textContent = String(Math.ceil(ST.tLeft));
    if (elScore) elScore.textContent = String(ST.score|0);
    if (elCombo) elCombo.textContent = String(ST.combo|0);
    if (elMiss) elMiss.textContent = String(ST.miss|0);
    if (elGood) elGood.textContent = String(ST.good|0);
    if (elShield) elShield.textContent = String(ST.shield|0);
    if (elBad) elBad.textContent = String(ST.bad|0);
  }

  function open(){
    overlay.hidden = false;
    ST.active = false;
    ST.tLeft = durationSec;
    ST.score = ST.combo = ST.miss = ST.good = ST.shield = ST.bad = 0;
    sync();
  }

  function close(){
    overlay.hidden = true;
  }

  let rafId=0;
  let last=0;

  function onJudge(ev){
    if (!ST.active) return;
    const d = ev.detail || {};
    const k = String(d.kind||'').toLowerCase();

    if (k==='good'){
      ST.good++;
      ST.combo++;
      ST.score += (10 + Math.min(10, ST.combo));
    } else if (k==='shield'){
      ST.shield++;
      ST.combo++;
      ST.score += 8;
    } else if (k==='bad'){
      ST.bad++;
      ST.miss++;
      ST.combo = 0;
      ST.score = Math.max(0, ST.score - 8);
    } else if (k==='block'){
      // ถือว่า “ทำได้ดี” แต่ไม่เพิ่ม checklist bad
      ST.combo++;
      ST.score += 4;
    } else if (k==='miss'){
      ST.miss++;
      ST.combo = 0;
    }
    sync();
  }

  function end(reason='timeup'){
    if (!ST.active) return;
    ST.active = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('hha:judge', onJudge);

    const stats = {
      durationSec,
      score: ST.score|0,
      combo: ST.combo|0,
      miss: ST.miss|0,
      good: ST.good|0,
      shield: ST.shield|0,
      bad: ST.bad|0
    };

    emit('hha:practice_end', { reason, stats });
    close();

    // start real game
    emit('hha:start', { from:'practice', reason });
  }

  function start(){
    if (ST.active) return;
    ST.active = true;
    ST.tLeft = durationSec;
    sync();

    emit('hha:practice_begin', { durationSec });

    window.addEventListener('hha:judge', onJudge);

    last = performance.now();
    function tick(t){
      if (!ST.active) return;
      const dt = Math.min(0.05, Math.max(0.01, (t-last)/1000));
      last = t;
      ST.tLeft = Math.max(0, ST.tLeft - dt);
      sync();
      if (ST.tLeft <= 0.001){
        end('timeup');
        return;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  btnStart?.addEventListener('click', start);
  btnSkip?.addEventListener('click', ()=>{
    // ไม่เก็บสถิติ practice
    close();
    emit('hha:practice_end', { reason:'skip', stats:null });
    emit('hha:start', { from:'practice', reason:'skip' });
  });
  btnGoNow?.addEventListener('click', ()=>{
    end('manual');
  });

  function maybeStart(){
    if (!auto) return;
    open();
  }

  return { open, close, start, end, maybeStart };
}