// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (VR COMPACT + TICK WARNING + START GATE)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ Enter VR => fullscreen + cVR + hint + auto-hide HUD (VR comfort)
// ✅ Missions button shows Quest Peek anytime
// ✅ VR Compact HUD updates (Score/Time/Grade) from events
// ✅ VR Tick warning (from safe.js: hha:vr_tick) -> toast + subtle vibrate + compact pulse
// ✅ Starts engine ONLY after pressing "เริ่มเล่น"
// ✅ End overlay on hha:end (if page has endOverlay elements)

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
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
async function exitFs(){
  try{
    if (DOC.exitFullscreen) await DOC.exitFullscreen();
    else if (DOC.webkitExitFullscreen) await DOC.webkitExitFullscreen();
  }catch(_){}
}
function syncFsClass(){
  DOC.body.classList.toggle('is-fs', isFs());
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

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  try{ localStorage.setItem('GJ_VIEW', view); }catch(_){}
}

function ensurePeekShow(ms=1300){
  const peek = DOC.getElementById('gjPeek');
  if (!peek) return;
  peek.classList.add('show');
  setTimeout(()=>{ try{ peek.classList.remove('show'); }catch(_){ } }, ms);
}

function toggleHud(force){
  const b = DOC.body;
  const next = (typeof force === 'boolean') ? force : !b.classList.contains('hud-hidden');
  b.classList.toggle('hud-hidden', next);

  const btn = DOC.getElementById('btnToggleHud'); // ✅ match HTML ล่าสุด
  if (btn) btn.textContent = next ? 'HUD (Off)' : 'HUD';

  // when HUD turns off -> show missions peek
  if (next) ensurePeekShow(1300);
}

/* -------------------------
   VR Compact HUD updater
-------------------------- */
function setText(id, txt){
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(txt);
}
function setCompactScore(v){
  setText('vrScore-l', v);
  setText('vrScore-r', v);
}
function setCompactTime(v){
  setText('vrTime-l', v);
  setText('vrTime-r', v);
}
function setCompactGrade(v){
  setText('vrGrade-l', v);
  setText('vrGrade-r', v);
}

function pulseCompact(){
  const l = DOC.getElementById('vrCompactHud-l');
  const r = DOC.getElementById('vrCompactHud-r');
  if (l) { l.classList.add('tick'); setTimeout(()=>l.classList.remove('tick'), 170); }
  if (r) { r.classList.add('tick'); setTimeout(()=>r.classList.remove('tick'), 170); }
}

/* -------------------------
   VR Toast (per eye)
-------------------------- */
let toastT = 0;
function showVrToast(text, kind='warn', ms=650){
  const tl = DOC.getElementById('vrToast-l');
  const tr = DOC.getElementById('vrToast-r');
  const txl = DOC.getElementById('vrToastText-l');
  const txr = DOC.getElementById('vrToastText-r');

  if (txl){ txl.classList.remove('warn','bad'); txl.classList.add(kind); txl.textContent = String(text); }
  if (txr){ txr.classList.remove('warn','bad'); txr.classList.add(kind); txr.textContent = String(text); }

  if (tl) tl.hidden = false;
  if (tr) tr.hidden = false;

  clearTimeout(toastT);
  toastT = setTimeout(()=>{
    if (tl) tl.hidden = true;
    if (tr) tr.hidden = true;
  }, ms);
}

function subtleVibrate(sec){
  // กันเวียนหัว: สั่นนิดเดียว และเฉพาะตอน 5,3,1
  try{
    const ok = (navigator.vibrate && (DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr')));
    if (!ok) return;
    if (sec === 5) navigator.vibrate(15);
    if (sec === 3) navigator.vibrate([10, 40, 10]);
    if (sec === 1) navigator.vibrate([20, 60, 20]);
  }catch(_){}
}

/* -------------------------
   Optional beep (disabled by default)
   enable: ?beep=1
-------------------------- */
let audioCtx = null;
function beep(sec){
  if (String(qs('beep','0')) !== '1') return;
  try{
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    const f = (sec <= 3) ? 880 : 660;
    o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + 0.14);
  }catch(_){}
}

/* -------------------------
   End Overlay (optional)
-------------------------- */
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

function showEndOverlay(summary){
  const ol = DOC.getElementById('endOverlay');
  if (!ol) return;

  const s = summary || {};
  setText('endGrade', s.grade ?? '—');
  setText('endScore', s.scoreFinal ?? 0);
  setText('endAcc', `${s.accuracyGoodPct ?? 0}%`);
  setText('endCombo', s.comboMax ?? 0);
  setText('endMiss', s.misses ?? 0);
  setText('endTimePlayed', `${s.durationPlayedSec ?? 0}s`);
  setText('endQuest', `${s.goalsCleared ?? 0}/${s.goalsTotal ?? 0} • ${s.miniCleared ?? 0}/${s.miniTotal ?? 0}`);

  const sub = DOC.getElementById('endSub');
  if (sub){
    sub.textContent = `เหตุผล: ${s.reason || 'end'} • diff=${s.diff || qs('diff','')} • run=${s.runMode || qs('run','play')}`;
  }

  // save history
  try{
    const hist = readJson(LS_HIST, []);
    hist.unshift({ ...s, timestampIso: new Date().toISOString() });
    hist.splice(50);
    saveJson(LS_HIST, hist);
    saveJson(LS_LAST, s);
  }catch(_){}

  ol.hidden = false;
}

function hookEndOverlayButtons(){
  const btnReplay = DOC.getElementById('btnReplay');
  const btnHub    = DOC.getElementById('btnBackHub');
  const btnCopy   = DOC.getElementById('btnCopyJson');

  const hub = qs('hub', './hub.html');

  btnReplay && btnReplay.addEventListener('click', ()=>{
    const u = new URL(location.href);
    u.searchParams.set('ts', String(Date.now()));
    location.href = u.toString();
  });

  btnHub && btnHub.addEventListener('click', async ()=>{
    try{
      if (ROOT.GoodJunkVR && typeof ROOT.GoodJunkVR.endGame === 'function'){
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

/* -------------------------
   Hook buttons / view
-------------------------- */
function hookControls(){
  const btnPC   = DOC.getElementById('btnViewPC');
  const btnM    = DOC.getElementById('btnViewMobile');
  const btnV    = DOC.getElementById('btnViewVR');
  const btnC    = DOC.getElementById('btnViewCVR');

  const btnFS   = DOC.getElementById('btnEnterFS');
  const btnVR   = DOC.getElementById('btnEnterVR');

  const btnHud  = DOC.getElementById('btnToggleHud'); // ✅ match HTML ล่าสุด
  const btnPeek = DOC.getElementById('btnPeek');      // ✅ match HTML ล่าสุด

  const vrHint  = DOC.getElementById('vrHint');
  const vrOk    = DOC.getElementById('btnVrOk');

  function showVrHint(){ if (vrHint) vrHint.hidden = false; }
  function hideVrHint(){ if (vrHint) vrHint.hidden = true; }

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); toggleHud(false); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); toggleHud(false); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); });

  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnHud && btnHud.addEventListener('click', ()=> toggleHud());

  btnPeek && btnPeek.addEventListener('click', ()=>{
    ensurePeekShow(1400);
  });

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  // Enter VR: fullscreen + switch to cVR + hint + auto hide HUD (comfort)
  btnVR && btnVR.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
    setBodyView('cvr');
    showVrHint();
    setTimeout(()=> toggleHud(true), 850);
    setTimeout(()=> ensurePeekShow(1200), 900);
  });
}

/* -------------------------
   Start gate / Engine boot
-------------------------- */
function showStartOverlay(){
  const ol = DOC.getElementById('startOverlay');
  if (ol) ol.hidden = false;

  const meta = DOC.getElementById('startMeta');
  if (meta){
    const diff = qs('diff','normal');
    const time = qs('time', qs('duration','70'));
    const run  = qs('run','play');
    const end  = qs('end','time');
    const ch   = qs('challenge','rush');
    meta.textContent = `diff=${diff} • time=${time}s • run=${run} • end=${end} • ch=${ch}`;
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
  const challenge = qs('challenge','rush'); // rush | survive | boss

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

/* -------------------------
   Event hooks (score/time/rank + vr_tick + end)
-------------------------- */
function hookGameEvents(){
  // compact HUD update
  ROOT.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || {};
    setCompactScore(d.score ?? 0);
  });

  ROOT.addEventListener('hha:time', (ev)=>{
    const d = ev?.detail || {};
    const left = Math.max(0, Math.ceil(Number(d.left ?? 0)));
    setCompactTime(left);
  });

  ROOT.addEventListener('hha:rank', (ev)=>{
    const d = ev?.detail || {};
    setCompactGrade(d.grade ?? '—');
  });

  // low-time tick warning (from safe.js)
  ROOT.addEventListener('hha:vr_tick', (ev)=>{
    const sec = Number(ev?.detail?.sec ?? 0) | 0;

    // only meaningful in VR/cVR
    const inVR = DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');
    if (!inVR) return;

    // pulse compact (light, no shake camera)
    pulseCompact();

    // show toast only when HUD hidden OR always? -> ให้ชัดใน VR เลย
    if (sec <= 10 && sec >= 1){
      const kind = (sec <= 3) ? 'bad' : 'warn';
      showVrToast(`⏳ เหลือ ${sec} วิ`, kind, (sec <= 3 ? 520 : 420));
      subtleVibrate(sec);
      beep(sec);
    }
  });

  // End event: show end overlay, exit fullscreen (อ่านง่าย)
  ROOT.addEventListener('hha:end', async (ev)=>{
    const summary = ev?.detail || readJson(LS_LAST, null);

    // ไม่ให้คนอ่านยากใน cVR: ออกจาก fullscreen ก่อนโชว์ (best-effort)
    try{ await exitFs(); }catch(_){}
    syncFsClass();

    // เปิด HUD กลับมา (ถ้าอยากให้ end ดูชัด)
    try{ toggleHud(false); }catch(_){}

    showEndOverlay(summary);
  });
}

/* -------------------------
   Main
-------------------------- */
function main(){
  hookControls();
  hookEndOverlayButtons();
  hookGameEvents();

  setBodyView(pickInitialView());
  syncFsClass();

  ROOT.addEventListener('resize', ()=>{}, { passive:true });
  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  // START-GATE
  showStartOverlay();
  const btnStart = DOC.getElementById('btnStart');
  btnStart && btnStart.addEventListener('click', ()=>{
    hideStartOverlay();
    bootEngine();
  }, { once:true });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();