// === /herohealth/vr/battle-ui.auto.js ===
// Auto Battle UI: waiting/ready/countdown/ended overlay
// Uses __GJ_SET_PAUSED__ if present (GoodJunk), or __HHA_SET_PAUSED__ fallback.
// FULL v20260228-BATTLE-UI-AUTO
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function qs(k, d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }
function now(){ return Date.now(); }

function setPaused(on){
  try{
    if(typeof WIN.__GJ_SET_PAUSED__ === 'function') return WIN.__GJ_SET_PAUSED__(!!on);
    if(typeof WIN.__HHA_SET_PAUSED__ === 'function') return WIN.__HHA_SET_PAUSED__(!!on);
  }catch(e){}
}

function ensureOverlay(){
  let el = DOC.getElementById('hhaBattleOverlay');
  if(el) return el;

  el = DOC.createElement('div');
  el.id = 'hhaBattleOverlay';
  el.style.position = 'fixed';
  el.style.inset = '0';
  el.style.zIndex = '9999';
  el.style.display = 'none';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.padding = '18px';
  el.style.background = 'rgba(2,6,23,.58)';
  el.style.backdropFilter = 'blur(8px)';
  el.style.webkitBackdropFilter = 'blur(8px)';
  el.style.color = 'rgba(229,231,235,.97)';
  el.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';

  el.innerHTML = `
    <div style="
      width:min(820px, 92vw);
      border-radius:22px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.72);
      box-shadow:0 24px 80px rgba(0,0,0,.55);
      padding:16px 16px 14px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="font-weight:1000; letter-spacing:.2px; font-size:15px;">
          ⚔️ Battle Mode
          <span id="hhaBattleRoom" style="opacity:.7; font-weight:900; margin-left:8px;"></span>
        </div>
        <button id="hhaBattleHide" type="button" style="
          appearance:none; border:1px solid rgba(148,163,184,.22);
          background:rgba(148,163,184,.10);
          color:rgba(229,231,235,.95);
          padding:8px 10px; border-radius:14px; font-weight:1000; cursor:pointer;">
          ซ่อน
        </button>
      </div>

      <div id="hhaBattleMsg" style="margin-top:10px; font-size:14px; font-weight:900; opacity:.92;">
        —
      </div>

      <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
        <div style="flex:1; min-width:240px; border-radius:18px; border:1px solid rgba(148,163,184,.14); padding:10px 12px; background:rgba(15,23,42,.35);">
          <div style="opacity:.7; font-weight:900; font-size:12px;">คุณ</div>
          <div id="hhaBattleMe" style="font-weight:1000; font-size:14px;">—</div>
          <div id="hhaBattleMeStats" style="margin-top:6px; font-weight:900; opacity:.85; font-size:12px;">—</div>
        </div>
        <div style="flex:1; min-width:240px; border-radius:18px; border:1px solid rgba(148,163,184,.14); padding:10px 12px; background:rgba(15,23,42,.35);">
          <div style="opacity:.7; font-weight:900; font-size:12px;">คู่แข่ง</div>
          <div id="hhaBattleOpp" style="font-weight:1000; font-size:14px;">—</div>
          <div id="hhaBattleOppStats" style="margin-top:6px; font-weight:900; opacity:.85; font-size:12px;">—</div>
        </div>
      </div>

      <div id="hhaBattleCountdown" style="
        margin-top:12px;
        text-align:center;
        font-weight:1100;
        font-size:44px;
        letter-spacing:.5px;
        padding:10px 0 2px;
        display:none;">
        3
      </div>

      <div id="hhaBattleFooter" style="margin-top:10px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
        <button id="hhaBattleCopy" type="button" style="
          appearance:none; border:1px solid rgba(59,130,246,.28);
          background:rgba(59,130,246,.14); color:rgba(229,231,235,.96);
          padding:10px 12px; border-radius:14px; font-weight:1000; cursor:pointer;">
          คัดลอกลิงก์ห้อง
        </button>
        <button id="hhaBattleLeave" type="button" style="
          appearance:none; border:1px solid rgba(239,68,68,.26);
          background:rgba(239,68,68,.12); color:rgba(229,231,235,.96);
          padding:10px 12px; border-radius:14px; font-weight:1000; cursor:pointer;">
          ออกห้อง
        </button>
      </div>

      <div style="margin-top:10px; font-size:11.5px; opacity:.62; font-weight:800; text-align:center;">
        ตัดสินผู้ชนะ: <b>score → acc → miss → medianRT</b>
      </div>
    </div>
  `;

  DOC.body.appendChild(el);

  el.querySelector('#hhaBattleHide')?.addEventListener('click', ()=>{
    el.style.display = 'none';
  });

  el.querySelector('#hhaBattleCopy')?.addEventListener('click', async ()=>{
    try{
      const url = new URL(location.href);
      url.searchParams.set('battle','1');
      await navigator.clipboard.writeText(url.toString());
      toast('คัดลอกลิงก์แล้ว ✅');
    }catch(e){
      toast('คัดลอกไม่สำเร็จ');
    }
  });

  el.querySelector('#hhaBattleLeave')?.addEventListener('click', ()=>{
    try{
      const url = new URL(location.href);
      url.searchParams.delete('battle');
      url.searchParams.delete('room');
      location.href = url.toString();
    }catch(e){
      location.href = location.pathname;
    }
  });

  return el;
}

function toast(msg){
  try{
    const t = DOC.createElement('div');
    t.textContent = msg;
    t.style.position='fixed';
    t.style.left='50%';
    t.style.bottom='calc(env(safe-area-inset-bottom, 0px) + 18px)';
    t.style.transform='translateX(-50%)';
    t.style.zIndex='10000';
    t.style.padding='10px 12px';
    t.style.border='1px solid rgba(148,163,184,.18)';
    t.style.borderRadius='14px';
    t.style.background='rgba(2,6,23,.72)';
    t.style.color='rgba(229,231,235,.97)';
    t.style.font='900 13px/1.2 system-ui';
    t.style.boxShadow='0 16px 40px rgba(0,0,0,.45)';
    DOC.body.appendChild(t);
    setTimeout(()=>t.remove(), 1100);
  }catch(e){}
}

function fmtStats(p){
  if(!p) return '—';
  const score = Number(p.score||0)|0;
  const acc = Number(p.accPct||0)|0;
  const miss = Number(p.miss||0)|0;
  const rt = Number(p.medianRtGoodMs||0)|0;
  return `score=${score} | acc=${acc}% | miss=${miss} | medRT=${rt}ms`;
}

let lastPlayers = null;
let lastState = null;

let countdownTimer = null;
let lastCountdownShown = -999;

function startCountdown(startAt){
  const ov = ensureOverlay();
  const cd = ov.querySelector('#hhaBattleCountdown');
  const msg= ov.querySelector('#hhaBattleMsg');

  clearInterval(countdownTimer);
  cd.style.display = 'block';

  setPaused(true);
  ov.style.display = 'flex';
  msg.textContent = 'เริ่มใน…';

  countdownTimer = setInterval(()=>{
    const leftMs = Math.max(0, Number(startAt||0) - now());
    const sec = Math.ceil(leftMs/1000);

    // show 3..2..1..GO
    let show = sec;
    if(show <= 0) show = 0;

    if(show !== lastCountdownShown){
      lastCountdownShown = show;
      cd.textContent = show > 0 ? String(show) : 'GO!';
      if(show === 0){
        // release after a short beat
        setTimeout(()=>{
          cd.style.display = 'none';
          ov.style.display = 'none';
          setPaused(false);
        }, 380);
      }
    }

    if(leftMs <= 0){
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 120);
}

function showWaiting(room){
  const ov = ensureOverlay();
  ov.style.display = 'flex';
  ov.querySelector('#hhaBattleRoom').textContent = room ? `room=${room}` : '';
  ov.querySelector('#hhaBattleCountdown').style.display = 'none';
  ov.querySelector('#hhaBattleMsg').textContent = 'รอผู้เล่นอีกคนเข้าห้อง…';
  setPaused(true);
}

function showReady(room){
  const ov = ensureOverlay();
  ov.style.display = 'flex';
  ov.querySelector('#hhaBattleRoom').textContent = room ? `room=${room}` : '';
  ov.querySelector('#hhaBattleCountdown').style.display = 'none';
  ov.querySelector('#hhaBattleMsg').textContent = 'ครบ 2 คนแล้ว ✅ กำลังเตรียมเริ่ม…';
  setPaused(true);
}

function showEnded(detail){
  const ov = ensureOverlay();
  ov.style.display = 'flex';
  ov.querySelector('#hhaBattleCountdown').style.display = 'none';

  const w = String(detail?.winner||'tie');
  const msg = (w==='tie') ? 'เสมอ!' : (w==='a' ? 'ผู้เล่น A ชนะ!' : 'ผู้เล่น B ชนะ!');
  ov.querySelector('#hhaBattleMsg').textContent = `จบเกมแล้ว — ${msg}`;

  // keep paused only if you want; normally game already ended and overlay shows endscreen anyway
  // setPaused(true);
}

function updatePlayerCards(){
  if(!lastPlayers) return;
  const ov = ensureOverlay();
  const meKey = lastPlayers.me;
  const oppKey= lastPlayers.opponent;
  const players = lastPlayers.players || {};

  const me = players[meKey] || null;
  const opp = oppKey ? (players[oppKey] || null) : null;

  ov.querySelector('#hhaBattleMe').textContent = me?.pid ? `pid=${me.pid}` : '—';
  ov.querySelector('#hhaBattleMeStats').textContent = fmtStats(me);

  ov.querySelector('#hhaBattleOpp').textContent = opp?.pid ? `pid=${opp.pid}` : '—';
  ov.querySelector('#hhaBattleOppStats').textContent = fmtStats(opp);
}

function shouldEnable(){
  return String(qs('battle','0')) === '1';
}

function boot(){
  if(!DOC || !shouldEnable()) return;

  // make sure starting paused until state says started
  setPaused(true);

  WIN.addEventListener('hha:battle-players', (ev)=>{
    lastPlayers = ev.detail || null;
    updatePlayerCards();

    const room = lastPlayers?.room || qs('room','');
    const keys = Object.keys(lastPlayers?.players || {});
    if(keys.length < 2) showWaiting(room);
    else showReady(room);
  });

  WIN.addEventListener('hha:battle-state', (ev)=>{
    lastState = ev.detail || null;
    const room = lastState?.room || qs('room','');

    if(String(lastState?.status||'') === 'waiting'){
      showWaiting(room);
      return;
    }
    if(String(lastState?.status||'') === 'started'){
      const startAt = Number(lastState?.startAt||0) || (now()+800);
      if(startAt > now()){
        startCountdown(startAt);
      }else{
        // already started
        const ov = ensureOverlay();
        ov.style.display = 'none';
        setPaused(false);
      }
      return;
    }
    if(String(lastState?.status||'') === 'ended'){
      showEnded(lastState);
      return;
    }
  });

  WIN.addEventListener('hha:battle-ended', (ev)=>{
    showEnded(ev.detail || null);
  });

  // also update cards on score changes (local)
  WIN.addEventListener('hha:score', ()=>{
    updatePlayerCards();
  });
}

try{ boot(); }catch(e){ console.warn('[battle-ui] boot err', e); }