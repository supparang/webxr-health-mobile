// === /HeroHealth/game/main.js (2025-11-12 HUD wired + fallback stats + result modal) ===
import { GameHub } from '../hub.js';
import * as goodjunk from '../modes/goodjunk.safe.js';

const $ = (s)=>document.querySelector(s);
const qs = new URLSearchParams(location.search);
const MODE = (qs.get('mode')||'goodjunk').toLowerCase();
const DIFF = (qs.get('diff')||'normal').toLowerCase();
const AUTO = qs.get('autostart') === '1';
const DURATION = Number(qs.get('time')||60);

// ------- HUD elements (score/combo/time) -------
function ensureTimerPill(){
  let pill = document.getElementById('hudTimePill');
  if (!pill){
    pill = document.createElement('div');
    pill.id = 'hudTimePill';
    pill.textContent = '60s';
    pill.style.cssText = `
      position:fixed; top:10px; right:12px; z-index:760;
      background:#0b1220cc; color:#e2e8f0; border:1px solid #334155;
      border-radius:12px; padding:6px 10px; font:800 12px system-ui;
      box-shadow:0 10px 24px rgba(0,0,0,.35);
    `;
    document.body.appendChild(pill);
  }
  return pill;
}
const scoreEl = $('#hudScore');
const comboEl = $('#hudCombo');
const timePill = ensureTimerPill();

// ------- Local fallback scoreboard (ถ้าโหมดไม่ยิงค่ารวมมาให้) -------
let localScore = 0;
let localCombo = 0;
let localMaxCombo = 0;

function syncHUD(score, combo){
  if (scoreEl) scoreEl.textContent = (score|0).toLocaleString();
  if (comboEl) comboEl.textContent = (combo|0);
}

function showResult(detail={}){
  // รวมค่า fallback ถ้าโหมดไม่ส่ง score/คอมโบมา
  const finalScore = (typeof detail.score === 'number') ? detail.score : localScore;
  const finalCombo = (typeof detail.comboMax === 'number') ? detail.comboMax : localMaxCombo;
  const duration   = (typeof detail.duration === 'number') ? detail.duration : DURATION;

  const old = document.getElementById('hhaResultOverlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'hhaResultOverlay';
  overlay.innerHTML = `
    <div class="card">
      <div class="title">สรุปผล: ${detail.mode || MODE} (${detail.difficulty || DIFF})</div>
      <div class="grid">
        <div class="stat"><div class="k">คะแนนรวม</div><div class="v">${finalScore.toLocaleString()}</div></div>
        <div class="stat"><div class="k">คอมโบสูงสุด</div><div class="v">${finalCombo}</div></div>
        <div class="stat"><div class="k">พลาด</div><div class="v">${detail.misses ?? 0}</div></div>
        <div class="stat"><div class="k">เป้าหมาย</div><div class="v">${detail.goalCleared? 'ถึงเป้า ✓' : `ไม่ถึง (${detail.goalTarget||'-'})`}</div></div>
        <div class="stat"><div class="k">เวลา</div><div class="v">${duration}s</div></div>
      </div>
      <div class="questBadge">Mini Quests ${detail.questsCleared ?? 0}/${detail.questsTotal ?? 0}</div>
      <div class="btns">
        <button id="btnRetry">เล่นอีกครั้ง</button>
        <button id="btnHub">กลับ Hub</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // สี badge ตามสัดส่วน
  (function(){
    const x = detail.questsCleared ?? 0, y = detail.questsTotal ?? 0;
    const r = y ? x/y : 0;
    const badge = overlay.querySelector('.questBadge');
    badge.style.borderColor = (r>=1)?'#16a34a':(r>=0.5?'#f59e0b':'#ef4444');
    badge.style.background  = (r>=1)?'#16a34a22':(r>=0.5?'#f59e0b22':'#ef444422');
    badge.style.color       = (r>=1)?'#bbf7d0':(r>=0.5?'#fde68a':'#fecaca');
  })();

  // ปุ่ม
  overlay.querySelector('#btnRetry').onclick = ()=>location.reload();
  overlay.querySelector('#btnHub').onclick   = ()=>{
    const url = `hub.html?mode=${encodeURIComponent(MODE)}&diff=${encodeURIComponent(DIFF)}`;
    location.href = url;
  };

  // style
  const css = document.getElementById('hhaResultCSS') || (()=>{
    const st = document.createElement('style'); st.id='hhaResultCSS';
    st.textContent = `
      #hhaResultOverlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000000;
        display:flex;align-items:center;justify-content:center;}
      #hhaResultOverlay .card{background:#0b1220;border:1px solid #334155;border-radius:16px;color:#e2e8f0;
        box-shadow:0 24px 60px rgba(0,0,0,.5); padding:20px; width:min(780px,92vw);}
      #hhaResultOverlay .title{font:900 20px/1.3 system-ui;margin-bottom:12px;}
      #hhaResultOverlay .grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;}
      #hhaResultOverlay .stat{background:#11182780;border:1px solid #1f2937;border-radius:12px;padding:10px;text-align:center}
      #hhaResultOverlay .k{font:700 11px system-ui;color:#93c5fd;margin-bottom:6px;}
      #hhaResultOverlay .v{font:900 18px system-ui;color:#f8fafc;}
      #hhaResultOverlay .questBadge{margin:14px 0 0 0;padding:6px 10px;border:2px solid #334155;border-radius:10px;display:inline-block;font:800 12px system-ui;}
      #hhaResultOverlay .btns{display:flex;gap:12px;justify-content:flex-end;margin-top:14px;}
      #hhaResultOverlay .btns button{cursor:pointer;border:0;border-radius:10px;padding:8px 14px;font:800 13px system-ui}
      #hhaResultOverlay #btnRetry{background:#22c55e;color:#fff;}
      #hhaResultOverlay #btnHub{background:#0ea5e9;color:#fff;}
      @media (max-width:720px){ #hhaResultOverlay .grid{grid-template-columns:repeat(2,minmax(0,1fr));} }
    `;
    document.head.appendChild(st);
    return st;
  })();
}

// ------- bind global events -------
function wireEvents(){
  // เวลา
  window.addEventListener('hha:time', (e)=>{
    const sec = e?.detail?.sec ?? 0;
    if (timePill) timePill.textContent = `${sec}s`;
  });

  // คะแนน (fallback): คำนวณเองหากโหมดไม่ส่งสถิติรวม
  window.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    // ถ้าโหมดอื่นมีการส่ง 'hha:stats' เราจะโดน override อยู่แล้ว
    // ที่นี่ทำแค่ fallback
    const delta = Number(d.delta||0);
    if (d.good) { localCombo += 1; localMaxCombo = Math.max(localMaxCombo, localCombo); }
    else { localCombo = 0; }
    localScore = Math.max(0, localScore + delta);
    syncHUD(localScore, localCombo);
  });

  // ถ้าโหมดส่ง 'hha:stats' มาก็ใช้เป็นแหล่งความจริง
  window.addEventListener('hha:stats', (e)=>{
    const s = e?.detail||{};
    if (typeof s.score === 'number') localScore = s.score;
    if (typeof s.combo === 'number') localCombo = s.combo;
    if (typeof s.comboMax === 'number') localMaxCombo = s.comboMax;
    syncHUD(localScore, localCombo);
  });

  // จบเกม → สรุปผล
  window.addEventListener('hha:end', (e)=>{
    showResult(e?.detail||{});
  });
}

// ------- start flow -------
async function startGame(){
  if (MODE === 'goodjunk'){
    const ctrl = await goodjunk.boot({ difficulty: DIFF, duration: DURATION });
    ctrl.start();
  } else {
    alert('โหมดนี้ยังไม่พร้อม: ' + MODE);
  }
}

function bindStartButtons(){
  const vrBtn  = $('#vrStartBtn');
  const domBtn = $('#btnStart');
  const go = async ()=>{
    try{ domBtn && (domBtn.disabled=true); await startGame(); }
    catch(err){ console.error('[main] start error', err); domBtn && (domBtn.disabled=false); }
  };
  vrBtn  && vrBtn.addEventListener('click', (e)=>{ e.preventDefault(); go(); });
  domBtn && domBtn.addEventListener('click', (e)=>{ e.preventDefault(); go(); });
  if (AUTO) go();
}

window.addEventListener('DOMContentLoaded', ()=>{
  try{ new GameHub(); }catch(_){}
  wireEvents();
  bindStartButtons();
  syncHUD(0,0);
});
