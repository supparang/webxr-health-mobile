// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (START-GATED + END SUMMARY + DYNAMIC LAYOUT)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ Enter VR => fullscreen + cVR + hint
// ✅ Toggle HUD (body.hud-hidden) + Quest Peek still shows
// ✅ Starts engine ONLY after pressing "เริ่มเล่น"
// ✅ End overlay on hha:end + save history (HHA_SUMMARY_HISTORY)

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  try{ localStorage.setItem('GJ_VIEW', view); }catch(_){}
  // VR/cVR: show quest peek shortly (handled by safe.js too, but this helps at entry)
  if (view === 'vr' || view === 'cvr'){
    try{
      const peek = DOC.getElementById('gjPeek');
      if (peek){ peek.classList.add('show'); setTimeout(()=>peek.classList.remove('show'), 1200); }
    }catch(_){}
  }
  syncReserves();
}

function isFs(){
  return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
}
async function enterFs(){
  try{
    const el = DOC.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  }catch(_){}
}
function syncFsClass(){
  DOC.body.classList.toggle('is-fs', isFs());
  syncReserves();
}

function syncMeta(state='ready'){
  const hudMeta = DOC.getElementById('hudMeta');
  if (!hudMeta) return;
  const dual = !!DOC.getElementById('gj-layer-r');
  const v = qs('v','');
  hudMeta.textContent = `[BOOT] ${state} • dual=${dual} • view=${pickInitialView()} • v=${v}`;
}

function ensurePeekEl(){
  if (DOC.getElementById('gjPeek')) return;
  const el = DOC.createElement('div');
  el.id = 'gjPeek';
  el.className = 'gj-peek';
  el.innerHTML = `
    <div class="peek-card">
      <div class="peek-title" id="gjPeekTitle">ภารกิจ</div>
      <div class="peek-sub" id="gjPeekGoal">Goal: —</div>
      <div class="peek-mini" id="gjPeekMini">Mini: —</div>
      <div class="peek-tip" id="gjPeekTip">Tip: โหมด VR/cVR ซ่อน HUD ได้ แต่ภารกิจจะโผล่กลางจอเป็นช่วง ๆ</div>
    </div>
  `;
  DOC.body.appendChild(el);
}

function toggleHud(force){
  const b = DOC.body;
  const next = (typeof force === 'boolean') ? force : !b.classList.contains('hud-hidden');
  b.classList.toggle('hud-hidden', next);
  const btn = DOC.getElementById('btnToggleHUD');
  if (btn) btn.textContent = next ? 'HUD (Off)' : 'HUD';
  // show quest peek when turning HUD off
  if (next){
    const peek = DOC.getElementById('gjPeek');
    if (peek){
      peek.classList.add('show');
      setTimeout(()=>peek.classList.remove('show'), 1300);
    }
  }
  syncReserves();
}

function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnVR = DOC.getElementById('btnEnterVR');
  const btnHUD= DOC.getElementById('btnToggleHUD');

  const vrHint = DOC.getElementById('vrHint');
  const vrOk   = DOC.getElementById('btnVrOk');

  function showVrHint(){ if (vrHint) vrHint.hidden = false; }
  function hideVrHint(){ if (vrHint) vrHint.hidden = true; }

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); toggleHud(false); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); toggleHud(false); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); });

  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnHUD && btnHUD.addEventListener('click', ()=> toggleHud());

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  // Enter VR: fullscreen + switch to cVR (cardboard split) + hint + (auto hide HUD a bit)
  btnVR && btnVR.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
    setBodyView('cvr');
    showVrHint();
    // optional auto-hide HUD after 1.2s for VR comfort (still has quest peek)
    setTimeout(()=> toggleHud(true), 1200);
  });
}

function pickInitialView(){
  const v = String(qs('view','') || '').toLowerCase();
  if (v === 'vr') return 'vr';
  if (v === 'cvr') return 'cvr';

  try{
    const saved = localStorage.getItem('GJ_VIEW');
    if (saved === 'pc' || saved === 'mobile' || saved === 'vr' || saved === 'cvr') return saved;
  }catch(_){}

  const coarse = ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches;
  const w = ROOT.innerWidth || 360;
  const h = ROOT.innerHeight || 640;
  const mobileLike = coarse || Math.min(w,h) < 520;
  return mobileLike ? 'mobile' : 'pc';
}

/* ===== Dynamic reserves: fix "targets flashing behind HUD" in fullscreen/VR ===== */
function px(n){ return (Number(n)||0) + 'px'; }

function syncReserves(){
  try{
    const hud = DOC.querySelector('.hha-hud');
    const fever = DOC.getElementById('hhaFever');
    const ctrl = DOC.querySelector('.hha-controls');

    // When HUD hidden -> reserve small space only (avoid giant empty area)
    const hudHidden = DOC.body.classList.contains('hud-hidden');

    if (hud){
      const r = hud.getBoundingClientRect();
      const cs = getComputedStyle(hud);
      // paddingTop = 10 + sat (computed)
      const padTop = parseFloat(cs.paddingTop)||0;
      const sat = Math.max(0, padTop - 10);
      const usable = hudHidden ? 24 : Math.max(80, Math.round(r.height - sat));
      DOC.documentElement.style.setProperty('--hudH', px(usable));
    }

    if (fever){
      const r = fever.getBoundingClientRect();
      const usable = Math.max(70, Math.round(r.height));
      DOC.documentElement.style.setProperty('--feverH', px(usable));
    }

    if (ctrl){
      const r = ctrl.getBoundingClientRect();
      const usable = Math.max(76, Math.round(r.height));
      DOC.documentElement.style.setProperty('--ctrlH', px(usable));
    }
  }catch(_){}
}

function showStartOverlay(){
  const ol = DOC.getElementById('startOverlay');
  if (ol) ol.hidden = false;
  const meta = DOC.getElementById('startMeta');
  if (meta){
    const diff = qs('diff','normal');
    const time = qs('time', qs('duration','70'));
    meta.textContent = `diff=${diff} • time=${time}s • run=${qs('run','play')}`;
  }
}
function hideStartOverlay(){
  const ol = DOC.getElementById('startOverlay');
  if (ol) ol.hidden = true;
}

function bootEngine(){
  const layerL = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const crossL = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR = DOC.getElementById('gj-crosshair-r');

  const shootEl = DOC.getElementById('btnShoot');
  const stageEl = DOC.getElementById('gj-stage');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','70'))) || 70;

  const endPolicy = qs('end','time');       // time | all | miss
  const challenge = qs('challenge','rush'); // reserved

  engineBoot({
    layerEl: layerL,
    layerElR: layerR,
    crosshairEl: crossL,
    crosshairElR: crossR,
    shootEl,
    stageEl,
    diff,
    run,
    time,
    endPolicy,
    challenge,
    context: { projectTag: qs('projectTag','HeroHealth') }
  });
}

/* ===== End Summary Overlay (HHA Standard) ===== */
function readJson(key, fallback){
  try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; }catch(_){ return fallback; }
}
function saveJson(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(_){}
}
function copyText(txt){
  try{
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt);
  }catch(_){}
  try{
    const ta = DOC.createElement('textarea');
    ta.value = txt; ta.style.position='fixed'; ta.style.left='-9999px';
    DOC.body.appendChild(ta); ta.select(); DOC.execCommand('copy'); ta.remove();
  }catch(_){}
  return Promise.resolve();
}

function showEnd(summary){
  const ol = DOC.getElementById('endOverlay');
  if (!ol) return;
  ol.hidden = false;

  const reason = DOC.getElementById('endReason');
  const grade  = DOC.getElementById('endGrade');
  const score  = DOC.getElementById('endScore');
  const acc    = DOC.getElementById('endAcc');
  const cm     = DOC.getElementById('endComboMax');
  const miss   = DOC.getElementById('endMiss');
  const goals  = DOC.getElementById('endGoals');
  const minis  = DOC.getElementById('endMinis');
  const meta2  = DOC.getElementById('endMeta2');

  const s = summary || {};
  if (reason) reason.textContent = `เหตุผล: ${s.reason || 'end'} • time=${s.durationPlayedSec ?? '—'}s • diff=${s.diff || qs('diff','')}`;
  if (grade)  grade.textContent  = s.grade || '—';
  if (score)  score.textContent  = String(s.scoreFinal ?? 0);
  if (acc)    acc.textContent    = `${s.accuracyGoodPct ?? 0}%`;
  if (cm)     cm.textContent     = String(s.comboMax ?? 0);
  if (miss)   miss.textContent   = String(s.misses ?? 0);
  if (goals)  goals.textContent  = `${s.goalsCleared ?? 0}/${s.goalsTotal ?? 0}`;
  if (minis)  minis.textContent  = `${s.miniCleared ?? 0}/${s.miniTotal ?? 0}`;

  if (meta2){
    meta2.textContent = `seed=${s.seed || ''} • run=${s.runMode || qs('run','play')} • end=${qs('end','time')}`;
  }

  // save history (HHA Standard)
  try{
    const hist = readJson(LS_HIST, []);
    hist.unshift({ ...s, timestampIso: new Date().toISOString() });
    hist.splice(50); // keep last 50
    saveJson(LS_HIST, hist);
    saveJson(LS_LAST, s);
  }catch(_){}
}

function hideEnd(){
  const ol = DOC.getElementById('endOverlay');
  if (ol) ol.hidden = true;
}

function hookEndButtons(){
  const btnAgain = DOC.getElementById('btnPlayAgain');
  const btnHub   = DOC.getElementById('btnBackHub');
  const btnCopy  = DOC.getElementById('btnCopySummary');

  // hub location
  const hub = qs('hub', './hub.html');

  btnAgain && btnAgain.addEventListener('click', ()=>{
    // reload with new ts to avoid cache
    const u = new URL(location.href);
    u.searchParams.set('ts', String(Date.now()));
    location.href = u.toString();
  });

  btnHub && btnHub.addEventListener('click', ()=>{
    // flush hard then go hub (safe)
    try{
      if (ROOT.GoodJunkVR && typeof ROOT.GoodJunkVR.endGame === 'function'){
        // already ended, but safe
        ROOT.GoodJunkVR.endGame('back_hub');
      }
    }catch(_){}
    location.href = hub;
  });

  btnCopy && btnCopy.addEventListener('click', async ()=>{
    const s = readJson(LS_LAST, null);
    await copyText(JSON.stringify(s || {}, null, 2));
    btnCopy.textContent = 'Copied ✅';
    setTimeout(()=> btnCopy.textContent = 'Copy JSON', 900);
  });
}

/* ===== Listen end event from safe.js ===== */
function hookEndEvent(){
  ROOT.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || readJson(LS_LAST, null);
    showEnd(summary);
    // when end shows, keep HUD off for clarity
    toggleHud(true);
    syncReserves();
  });
}

function main(){
  ensurePeekEl();
  hookViewButtons();
  hookEndButtons();
  hookEndEvent();

  setBodyView(pickInitialView());
  syncMeta('ready');
  syncFsClass();
  syncReserves();

  // keep reserves fresh
  ROOT.addEventListener('resize', ()=> syncReserves(), { passive:true });
  ROOT.addEventListener('orientationchange', ()=> setTimeout(syncReserves, 180), { passive:true });

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  // START-GATE
  showStartOverlay();
  const btnStart = DOC.getElementById('btnStart');
  btnStart && btnStart.addEventListener('click', ()=>{
    hideStartOverlay();
    hideEnd();
    syncMeta('running');
    syncReserves();
    bootEngine();
  }, { once:true });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();