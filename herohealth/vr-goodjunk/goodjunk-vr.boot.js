// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Bootper: view controls + start overlay + end summary + fullscreen/VR helpers
// ✅ FIX: landscape detection (matchMedia)
// ✅ FIX: VR tip shows only when needed + remember "OK" (no repeat)
// ✅ FIX: on OK / EnterVR -> try fullscreen + lock landscape inside gesture

'use strict';

import { boot as goodjunkBoot } from './goodjunk.safe.js';

const ROOT = window;

function qs(name, def=null){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}
function setParam(url, k, v){
  const u = new URL(url);
  if (v === null || v === undefined || v === '') u.searchParams.delete(k);
  else u.searchParams.set(k, String(v));
  return u.toString();
}
function clamp(n,a,b){ n=Number(n)||0; return Math.max(a, Math.min(b,n)); }

function mmLandscape(){
  try{ return !!(matchMedia && matchMedia('(orientation: landscape)').matches); }catch(_){ return false; }
}
function isLandscape(){
  // use matchMedia first (more reliable in VR viewers)
  const m = mmLandscape();
  if (m) return true;
  // fallback
  return (innerWidth||1) > (innerHeight||1);
}

function isFullscreen(){
  return !!document.fullscreenElement;
}

async function tryFullscreen(){
  try{
    if (!document.fullscreenElement){
      await document.documentElement.requestFullscreen?.();
    }
  }catch(_){}
}

async function tryLockLandscape(){
  // Android Chrome: lock works only after fullscreen + inside user gesture
  try{
    if (screen.orientation && screen.orientation.lock){
      await screen.orientation.lock('landscape');
    }
  }catch(_){}
}

async function tryEnterWebXR(){
  // Best effort: DOM-game = fullscreen/lock is main; WebXR session optional
  try{
    if (!navigator.xr) return false;
    const ok = await navigator.xr.isSessionSupported?.('immersive-vr');
    if (!ok) return false;
    await tryFullscreen();
    await tryLockLandscape();
    return true;
  }catch(_){
    return false;
  }
}

function applyBodyView(view){
  document.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  document.body.classList.add('view-' + view);
}

function showTip(show){
  const tip = document.getElementById('vrTip');
  if (!tip) return;
  tip.hidden = !show;
}

function tipSeenKey(view){
  return `HHA_VR_TIP_OK_${view}`;
}
function hasTipOk(view){
  try{ return localStorage.getItem(tipSeenKey(view)) === '1'; }catch(_){ return false; }
}
function setTipOk(view){
  try{ localStorage.setItem(tipSeenKey(view), '1'); }catch(_){}
}

function formatMeta({diff, run, end, challenge, view, time}){
  return [
    `diff=${diff}`,
    `run=${run}`,
    `end=${end}`,
    `challenge=${challenge}`,
    `view=${view}`,
    `time=${time}s`
  ].join(' • ');
}

function safeMarginsFor(view){
  const land = isLandscape();
  let top = land ? 90 : 128;
  let bottom = land ? 110 : 170;
  let left = land ? 18 : 26;
  let right = land ? 18 : 26;

  if (view === 'vr' || view === 'cvr'){
    top = land ? 78 : 110;
    bottom = land ? 120 : 160;
  }

  if ((innerWidth - left - right) < 220){ left = 12; right = 12; }
  if ((innerHeight - top - bottom) < 260){ top = Math.max(70, top - 24); bottom = Math.max(95, bottom - 24); }

  return { top, bottom, left, right };
}

function setAimVar(view){
  let aim = '62%';
  if (isLandscape()) aim = '52%';
  if (view === 'vr' || view === 'cvr') aim = '50%';
  document.documentElement.style.setProperty('--aimY', aim);
}

function renderEndSummary(sum, hubUrl){
  const box = document.getElementById('end-summary');
  if (!box) return;

  const acc = Number(sum.accuracyGoodPct||0);
  const grade = String(sum.grade||'—');
  const dur = Number(sum.durationPlayedSec||0);

  const html = `
    <div class="start-overlay" style="background:rgba(2,6,23,.82);">
      <div class="start-card">
        <div class="start-title">สรุปผล</div>
        <div class="start-desc">
          <b>Grade:</b> ${grade} &nbsp; <b>Acc:</b> ${acc}%<br/>
          <b>Score:</b> ${sum.scoreFinal||0} &nbsp; <b>ComboMax:</b> ${sum.comboMax||0} &nbsp; <b>Miss:</b> ${sum.misses||0}<br/>
          <span class="muted">เวลาเล่น ${dur}s • Goals ${sum.goalsCleared||0}/${sum.goalsTotal||0} • Minis ${sum.miniCleared||0}/${sum.miniTotal||0}</span>
        </div>
        <div class="start-meta">${sum.reason || 'end'} • diff=${sum.diff} • run=${sum.runMode}</div>
        <button class="btn-start" id="btnReplay">เล่นใหม่</button>
        <button class="btn-start" id="btnBackHub" style="margin-top:10px;background:rgba(96,165,250,.16);">กลับ HUB</button>
      </div>
    </div>
  `;
  box.innerHTML = html;

  const replay = document.getElementById('btnReplay');
  const back = document.getElementById('btnBackHub');

  if (replay) replay.onclick = ()=> location.reload();
  if (back) back.onclick = ()=>{
    if (hubUrl) location.href = hubUrl;
    else location.href = './hub.html';
  };
}

(async function main(){
  const diff = String(qs('diff','normal')).toLowerCase();
  const run  = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const end  = String(qs('end','time')).toLowerCase();
  const challenge = String(qs('challenge','rush')).toLowerCase();
  const view = String(qs('view', 'mobile')).toLowerCase();
  const time = clamp(Number(qs('time', qs('duration','70') || '70')), 30, 600);
  const hub  = qs('hub', '');

  applyBodyView(view);
  setAimVar(view);

  const meta = formatMeta({diff, run, end, challenge, view, time});
  const hudMeta = document.getElementById('hudMeta');
  const panelMeta = document.getElementById('panelMeta');
  const startMeta = document.getElementById('startMeta');
  if (hudMeta) hudMeta.textContent = meta;
  if (panelMeta) panelMeta.textContent = meta;
  if (startMeta) startMeta.textContent = meta;

  // activate pills
  document.querySelectorAll('.gj-pill[data-view]').forEach(btn=>{
    const v = btn.getAttribute('data-view');
    if (v === view) btn.classList.add('active');
    btn.addEventListener('click', ()=>{
      const next = setParam(location.href, 'view', v);
      location.href = next;
    });
  });

  // fullscreen button
  const btnFs = document.getElementById('btnFs');
  if (btnFs) btnFs.onclick = async ()=>{
    await tryFullscreen();
    await tryLockLandscape();
    // after action, re-check tip
    if ((view === 'vr' || view === 'cvr') && !hasTipOk(view)){
      showTip(!isLandscape());
    }
  };

  // Enter VR button (best effort)
  const btnEnterVR = document.getElementById('btnEnterVR');
  if (btnEnterVR) btnEnterVR.onclick = async ()=>{
    await tryFullscreen();
    await tryLockLandscape();
    await tryEnterWebXR(); // optional; doesn't hurt

    if ((view === 'vr' || view === 'cvr') && !hasTipOk(view)){
      showTip(!isLandscape());
    }
  };

  // Tip overlay OK
  const tipOk = document.getElementById('vrTipOk');
  if (tipOk) tipOk.onclick = async ()=>{
    setTipOk(view);
    showTip(false);
    // also try to help user right away
    await tryFullscreen();
    await tryLockLandscape();
  };

  // show tip automatically if view=vr/cvr AND not landscape AND not OK yet
  if ((view === 'vr' || view === 'cvr') && !hasTipOk(view)){
    showTip(!isLandscape());
  } else {
    showTip(false);
  }

  // listen orientation/resize to auto-hide tip when landscape
  const onOrient = ()=>{
    setAimVar(view);
    if ((view === 'vr' || view === 'cvr') && !hasTipOk(view)){
      showTip(!isLandscape());
    } else {
      showTip(false);
    }
  };
  window.addEventListener('resize', onOrient, { passive:true });
  try{
    screen.orientation?.addEventListener?.('change', onOrient);
  }catch(_){}
  window.addEventListener('orientationchange', onOrient, { passive:true });

  // start overlay
  const overlay = document.getElementById('startOverlay');
  const btnStart = document.getElementById('btnStart');

  // boot game but don't autostart until click
  const api = goodjunkBoot({
    diff, run, time,
    endPolicy: end,
    challenge,
    view,
    safeMargins: safeMarginsFor(view),
    context: { projectTag: String(qs('projectTag','HeroHealth')) || 'HeroHealth' },
    autoStart: false
  });

  function startGame(){
    try{ overlay && (overlay.style.display = 'none'); }catch(_){}
    try{ api && api.start && api.start(); }catch(_){}
    if (view === 'vr' || view === 'cvr'){
      // try to stabilize
      // (must be inside gesture -> this is inside click)
      tryFullscreen();
      tryLockLandscape();
    }
  }

  if (btnStart) btnStart.onclick = startGame;
  else startGame();

  // end summary
  window.addEventListener('hha:end', (ev)=>{
    const sum = ev?.detail || null;
    if (!sum) return;
    renderEndSummary(sum, hub);
  }, { passive:true });
})();