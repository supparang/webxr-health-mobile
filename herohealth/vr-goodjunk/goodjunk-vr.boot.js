// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (STRICT AUTO + SAFE-MEASURE FIX + GATE FLOW)
// ✅ Guard: prevent double boot (fix: time ends too fast)
// ✅ NO MENU, NO OVERRIDE: ignores ?view= entirely
// ✅ Auto base view: pc / mobile (UA-based)
// ✅ Auto-load ../vr/vr-ui.js only if WebXR exists (navigator.xr) and not already present
// ✅ Auto-switch on Enter/Exit VR via hha:enter-vr / hha:exit-vr:
//    - mobile -> cvr
//    - desktop -> vr
// ✅ HUD-safe measure -> sets CSS vars --gj-top-safe / --gj-bottom-safe
// ✅ Listens gj:measureSafe to re-measure instantly
// ✅ Boots engine: ./goodjunk.safe.js (module export boot())
// ✅ GATE FLOW (gate=1):
//    Warmup(20s) -> Game -> Cooldown(20s) -> HUB (absolute gateUrl to avoid 404)

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

const BOOT_GUARD = '__HHA_GJ_BOOT_STARTED__';

function qs(k, def = null) {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function isMobileUA() {
  const ua = String(navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod/.test(ua);
}

function baseAutoView() {
  return isMobileUA() ? 'mobile' : 'pc';
}

function setBodyView(view) {
  const b = DOC.body;
  if (!b) return;

  b.classList.add('gj');
  b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');

  if (view === 'pc') b.classList.add('view-pc');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  const r = DOC.getElementById('gj-layer-r');
  if (r) r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');

  b.dataset.view = view;
}

/* =========================
 * Gate helpers (avoid 404)
 * ========================= */
function getGateUrl(){
  // prefer explicit param (so you can swap gate page later)
  const g = String(qs('gateUrl', '') || '').trim();
  return g || 'https://supparang.github.io/herohealth/warmup-gate.html';
}

function buildUrl(base, add){
  if(!base) return '';
  try{
    const u = new URL(base, location.href);
    Object.entries(add||{}).forEach(([k,v])=>{
      if (v === undefined || v === null || v === '') return;
      u.searchParams.set(k, String(v));
    });
    return u.toString();
  }catch(_){
    const join = base.includes('?') ? '&' : '?';
    const qx = Object.entries(add||{})
      .filter(([,v])=>!(v===undefined||v===null||v===''))
      .map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(String(v))).join('&');
    return qx ? (base + join + qx) : base;
  }
}

function getPassthrough(){
  // keep everything EXCEPT internal gate params that would recurse weirdly
  const deny = new Set(['next','hub','phase','dur','cdur','autonext']);
  const out = {};
  try{
    const sp = new URL(location.href).searchParams;
    sp.forEach((v,k)=>{ if(!deny.has(k)) out[k]=v; });
  }catch(_){}
  return out;
}

function normalizeRunMode(){
  const r = String(qs('run','play')||'play').toLowerCase();
  return (r === 'research') ? 'research' : 'play';
}

function normalizeDiff(){
  return String(qs('diff','normal')||'normal').toLowerCase();
}

function normalizeTime(def=80){
  const t = Number(qs('time', String(def)) || def);
  return Number.isFinite(t) ? t : def;
}

function normalizeHub(){
  return String(qs('hub','../hub.html') || '../hub.html');
}

function goWarmupGate(){
  const gateUrl = getGateUrl();
  const hub = normalizeHub();

  const curWithDone = buildUrl(location.href, { wDone: 1 }); // ✅ กัน loop
  const u = new URL(gateUrl);

  u.searchParams.set('phase','warmup');
  u.searchParams.set('dur', String(qs('dur','20')||20));
  u.searchParams.set('hub', hub);

  // pass main params
  u.searchParams.set('view', String(DOC.body?.dataset?.view || baseAutoView()));
  u.searchParams.set('run', normalizeRunMode());
  u.searchParams.set('diff', normalizeDiff());
  u.searchParams.set('time', String(normalizeTime(80)));

  // keep passthrough (studyId/seed/etc)
  const pass = getPassthrough();
  Object.entries(pass).forEach(([k,v])=>{
    // do not duplicate keys already set above
    if (!u.searchParams.has(k)) u.searchParams.set(k, v);
  });

  // absolute gate url param (for subsequent redirects)
  u.searchParams.set('gateUrl', gateUrl);

  // next = back to this game, but marked done
  u.searchParams.set('next', curWithDone);
  u.searchParams.set('autonext','1');

  location.replace(u.toString());
}

function goCooldownGate(summary){
  const gateUrl = getGateUrl();
  const hub = normalizeHub();

  // optional: pack a tiny hint
  const reason = summary?.reason || summary?.tier || 'end';

  const hubWithDone = buildUrl(hub, { cdDone: 1 }); // ✅ กัน loop ถ้าย้อนกลับมาแบบประหลาด
  const u = new URL(gateUrl);

  u.searchParams.set('phase','cooldown');
  u.searchParams.set('cdur', String(qs('cdur','20')||20));
  u.searchParams.set('hub', hub);

  u.searchParams.set('view', String(DOC.body?.dataset?.view || baseAutoView()));
  u.searchParams.set('run', normalizeRunMode());
  u.searchParams.set('diff', normalizeDiff());
  u.searchParams.set('time', String(normalizeTime(80)));

  const pass = getPassthrough();
  Object.entries(pass).forEach(([k,v])=>{
    if (!u.searchParams.has(k)) u.searchParams.set(k, v);
  });

  u.searchParams.set('gateUrl', gateUrl);
  u.searchParams.set('next', hubWithDone);
  u.searchParams.set('autonext','1');

  // tiny debug tag (optional)
  u.searchParams.set('end', String(reason).slice(0,32));

  location.href = u.toString();
}

/* =========================
 * vr-ui.js loader
 * ========================= */
function ensureVrUiLoaded() {
  if (!('xr' in navigator)) return;
  if (WIN.__HHA_VRUI_LOADED__ || WIN.__HHA_VR_UI_LOADED__) return;

  const exists = Array.from(DOC.scripts || []).some(s => (s.src || '').includes('/vr/vr-ui.js'));
  if (exists) return;

  WIN.__HHA_VRUI_LOADED__ = true;

  const s = DOC.createElement('script');
  s.src = '../vr/vr-ui.js';
  s.defer = true;
  s.onerror = () => console.warn('[GoodJunkVR] vr-ui.js failed to load');
  DOC.head.appendChild(s);
}

function bindVrAutoSwitch() {
  const base = baseAutoView();

  function emitViewChanged() {
    try {
      WIN.dispatchEvent(new CustomEvent('hha:view', { detail: { view: DOC.body?.dataset?.view || base } }));
    } catch (_) {}
  }

  function onEnter() {
    setBodyView(isMobileUA() ? 'cvr' : 'vr');
    emitViewChanged();
  }

  function onExit() {
    setBodyView(base);
    emitViewChanged();
  }

  WIN.addEventListener('hha:enter-vr', onEnter, { passive: true });
  WIN.addEventListener('hha:exit-vr', onExit, { passive: true });

  WIN.HHA_GJ_resetView = onExit;
}

function bindDebugKeys() {
  WIN.addEventListener('keydown', (e) => {
    const k = e.key || '';
    if (k === ' ' || k === 'Enter') {
      try { WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail: { source: 'key' } })); } catch (_) {}
    }
  }, { passive: true });
}

function hudSafeMeasure() {
  const root = DOC.documentElement;

  const px = (n) => Math.max(0, Math.round(Number(n) || 0)) + 'px';
  const h = (el) => { try { return el ? el.getBoundingClientRect().height : 0; } catch { return 0; } };

  function update() {
    try {
      const cs = getComputedStyle(root);
      const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
      const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;

      const topbar   = DOC.querySelector('.gj-topbar');
      const progress = DOC.querySelector('.gj-progress');
      const hudTop   = DOC.getElementById('hud') || DOC.getElementById('gjHudTop');
      const fever    = DOC.getElementById('feverBox');
      const hudBot   = DOC.querySelector('.gj-hud-bot') || DOC.getElementById('gjHudBot');
      const controls = DOC.querySelector('.hha-controls');

      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      topSafe = Math.max(topSafe, h(progress));
      topSafe = Math.max(topSafe, h(hudTop) * 0.28);
      topSafe += (10 + sat);

      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, h(fever) * 0.62);
      bottomSafe = Math.max(bottomSafe, h(hudBot) * 0.22);
      bottomSafe = Math.max(bottomSafe, h(controls));
      bottomSafe += (12 + sab);

      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if (hudHidden) {
        topSafe = Math.max(66 + sat, h(topbar) + h(progress) + 6 + sat);
        bottomSafe = Math.max(70 + sab, h(fever) * 0.38 + 6 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    } catch (_) {}
  }

  WIN.addEventListener('resize', update, { passive: true });
  WIN.addEventListener('orientationchange', update, { passive: true });

  WIN.addEventListener('click', (e) => {
    if (e?.target?.id === 'btnHideHud' || e?.target?.id === 'btnHideHud2') {
      setTimeout(update, 30);
      setTimeout(update, 180);
      setTimeout(update, 420);
    }
  }, { passive: true });

  WIN.addEventListener('hha:view', () => {
    setTimeout(update, 0);
    setTimeout(update, 120);
    setTimeout(update, 350);
  }, { passive: true });

  WIN.addEventListener('gj:measureSafe', () => {
    setTimeout(update, 0);
    setTimeout(update, 120);
    setTimeout(update, 360);
  }, { passive: true });

  setTimeout(update, 0);
  setTimeout(update, 120);
  setTimeout(update, 350);
  setInterval(update, 1200);
}

async function start() {
  // ✅ Guard: avoid duplicate start
  if (WIN[BOOT_GUARD]) return;
  WIN[BOOT_GUARD] = true;

  const view = baseAutoView();
  setBodyView(view);

  ensureVrUiLoaded();
  bindVrAutoSwitch();
  bindDebugKeys();
  hudSafeMeasure();

  // =========================
  // ✅ Gate: Warmup required
  // =========================
  const gateOn = String(qs('gate','0')||'0');
  const wDone  = String(qs('wDone','0')||'0');
  if (gateOn === '1' && wDone !== '1') {
    // go to warmup gate (absolute) to avoid 404
    goWarmupGate();
    return;
  }

  // =========================
  // Boot engine
  // =========================
  engineBoot({
    view,
    diff: qs('diff', 'normal'),
    run: qs('run', 'play'),
    time: qs('time', '80'),
    seed: qs('seed', null),
    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
    lockPx: Number(qs('lockPx', '0')) || undefined,
  });

  // =========================
  // ✅ Gate: After end -> cooldown -> hub
  // =========================
  WIN.addEventListener('hha:end', (ev)=>{
    try{
      const gateOn2 = String(qs('gate','0')||'0');
      if (gateOn2 !== '1') return;

      const cdDone = String(qs('cdDone','0')||'0');
      if (cdDone === '1') return;

      // small delay to let end overlay / logger flush start
      setTimeout(()=> goCooldownGate(ev?.detail||{}), 220);
    }catch(_){}
  }, { passive:true });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start);
else start();