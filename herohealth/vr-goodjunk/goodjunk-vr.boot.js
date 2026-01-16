// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (auto view + safe-zone + deps)
// ✅ Respect ?view= (do NOT override)
// ✅ Auto-detect view if not provided: pc/mobile/vr/cvr
// ✅ Load deps if missing: vr-ui.js, particles.js, cloud-logger (no-dup)
// ✅ Set body class: view-pc/view-mobile/view-vr/view-cvr
// ✅ Measure HUD + set --gj-top-safe / --gj-bottom-safe
// ✅ Start engine: import { boot } from './goodjunk.safe.js'

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null) {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function hasParam(k){
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}
function clamp(v, a, b){
  v = Number(v) || 0;
  return (v < a) ? a : (v > b) ? b : v;
}
function px(n){ return Math.max(0, Math.floor(Number(n)||0)) + 'px'; }

function detectView() {
  // DO NOT override if ?view= exists
  const v = (qs('view', '') || '').toLowerCase().trim();
  if (v) return v;

  // Auto detect: best-effort (practical)
  const ua = (navigator.userAgent || '').toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/.test(ua);
  const w = DOC.documentElement.clientWidth || innerWidth || 0;

  // If WebXR immersive-vr available and device hints => vr
  // NOTE: we can't reliably detect cardboard vs cvr here; cvr usually passed explicitly
  // so: default vr on mobile if xr is present AND screen is wide-ish landscape.
  const isLandscape = (innerWidth > innerHeight);

  // If user opened from desktop: pc
  if (!isMobile && w >= 880) return 'pc';

  // Heuristic: if on mobile + landscape + has XR => 'vr' else 'mobile'
  if (isMobile && isLandscape && WIN.navigator && WIN.navigator.xr) return 'vr';

  return isMobile ? 'mobile' : 'pc';
}

function setBodyView(view) {
  const b = DOC.body;
  if (!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if (view === 'cvr') b.classList.add('view-cvr');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'pc') b.classList.add('view-pc');
  else b.classList.add('view-mobile');
}

function ensureScriptOnce(src) {
  // avoid duplicates: by src match
  try {
    const found = Array.from(DOC.scripts || []).some(s => (s?.src || '').includes(src));
    if (found) return;
  } catch (_) {}

  const s = DOC.createElement('script');
  s.src = src;
  s.defer = true;
  DOC.head.appendChild(s);
}

function ensureDeps() {
  // In your folder-run HTML you already include these,
  // but this makes it robust if someone uses root-run HTML.
  // (no duplicates thanks to ensureScriptOnce)
  ensureScriptOnce('../vr/particles.js');
  ensureScriptOnce('../vr/hha-cloud-logger.js');
  ensureScriptOnce('../vr/vr-ui.js');
}

function bindMissionsPeekSync() {
  // optional: keep peek texts updated via quest:update
  const peekGoal = DOC.getElementById('peekGoal');
  const peekMini = DOC.getElementById('peekMini');

  function safeText(x){ return (x == null) ? '—' : String(x); }

  function onQuestUpdate(ev){
    try{
      const goal = ev?.detail?.goal || null;
      const mini = ev?.detail?.mini || null;
      if (peekGoal){
        if(goal){
          peekGoal.textContent = `${safeText(goal.title)} (${safeText(goal.cur)}/${safeText(goal.target)})`;
        }else{
          peekGoal.textContent = '—';
        }
      }
      if (peekMini){
        if(mini){
          peekMini.textContent = safeText(mini.title || mini.type || '—');
        }else{
          peekMini.textContent = '—';
        }
      }
    }catch(_){}
  }
  WIN.addEventListener('quest:update', onQuestUpdate, { passive:true });
  DOC.addEventListener('quest:update', onQuestUpdate, { passive:true });
}

function measureSafeZone() {
  // sets CSS vars used by goodjunk.safe.js getSafeRect()
  try {
    const root = DOC.documentElement;
    const cs = getComputedStyle(root);
    const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;

    // IDs differ between root-run and folder-run versions; support both
    const topbar =
      DOC.getElementById('gjTopbar')?.getBoundingClientRect().height ||
      DOC.querySelector('.gj-topbar')?.getBoundingClientRect().height || 0;

    const hudTop =
      DOC.getElementById('gjHudTop')?.getBoundingClientRect().height ||
      DOC.getElementById('hud')?.getBoundingClientRect().height || 0;

    const hudBot =
      DOC.getElementById('gjHudBot')?.getBoundingClientRect().height ||
      DOC.querySelector('.gj-hud-bot')?.getBoundingClientRect().height || 0;

    // extra breathing
    const topSafe = topbar + hudTop + 14 + sat;
    const botSafe = Math.max(110, hudBot + 14);

    root.style.setProperty('--gj-top-safe', px(topSafe));
    root.style.setProperty('--gj-bottom-safe', px(botSafe));
  } catch (_) {}
}

function wireButtons() {
  // Topbar buttons exist in both variants with different ids; support both
  const btnHide = DOC.getElementById('btnHideHud') || DOC.getElementById('btnHideHud2');
  const btnMis  = DOC.getElementById('btnMissions') || DOC.getElementById('btnMissions2');
  const peek    = DOC.getElementById('missionsPeek');
  const btnHub  = DOC.getElementById('btnBackHub') || DOC.getElementById('btnHubTop');

  const hub = qs('hub', null);

  function updateHideLabel(){
    const hidden = DOC.body.classList.contains('hud-hidden');
    if(btnHide) btnHide.textContent = hidden ? 'Show HUD' : 'Hide HUD';
  }

  btnHide?.addEventListener('click', ()=>{
    DOC.body.classList.toggle('hud-hidden');
    updateHideLabel();
    setTimeout(measureSafeZone, 0);
  });

  function toggleMissions(){
    DOC.body.classList.toggle('show-missions');
    const on = DOC.body.classList.contains('show-missions');
    if (peek) peek.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  btnMis?.addEventListener('click', toggleMissions);
  peek?.addEventListener('click', toggleMissions);

  btnHub?.addEventListener('click', ()=>{
    if (hub) location.href = hub;
    else location.href = '../hub.html';
  });

  updateHideLabel();
}

function startEngine(view) {
  const payload = {
    view,
    run: qs('run', qs('mode', 'play')) || 'play',
    diff: qs('diff', 'normal') || 'normal',
    time: clamp(qs('time', 80), 20, 300),
    hub: qs('hub', null),

    seed: qs('seed', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };

  // Let engine decide default seed behavior; pass-through only
  engineBoot(payload);
}

(function bootNow(){
  try {
    // Dependencies (robust)
    ensureDeps();

    // view
    const view = detectView();
    setBodyView(view);

    // buttons + peek sync
    wireButtons();
    bindMissionsPeekSync();

    // safe zone measure now + after layout settles
    measureSafeZone();
    WIN.addEventListener('resize', ()=> setTimeout(measureSafeZone, 0), { passive:true });
    WIN.addEventListener('orientationchange', ()=> setTimeout(measureSafeZone, 0), { passive:true });
    setTimeout(measureSafeZone, 80);
    setTimeout(measureSafeZone, 260);
    setTimeout(measureSafeZone, 620);

    // run
    // (wait 1 frame so DOM layout + CSS apply before engine reads vars)
    requestAnimationFrame(()=> startEngine(view));
  } catch (err) {
    console.error('[GoodJunkVR boot] failed:', err);
  }
})();