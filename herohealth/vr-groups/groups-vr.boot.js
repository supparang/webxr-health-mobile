// === /herohealth/vr-groups/groups-vr.boot.js ===
// GroupsVR Boot — PRODUCTION
// ✅ Auto-detect view (PC/Mobile/cVR/VR) WITHOUT overriding explicit ?view=
// ✅ Tap-to-start gate (mobile friendly) to satisfy autoplay/user-gesture policies
// ✅ Start engine once (no double start)
// ✅ Robust waits for GroupsVR.GameEngine + setLayerEl
// ✅ Safe body view class + coach hint fallback

'use strict';

const DOC = document;
const WIN = window;

const qs = (k, def = null) => {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function isTouchDevice() {
  return ('ontouchstart' in WIN) || (navigator.maxTouchPoints | 0) > 0;
}

function detectViewNoOverride() {
  const explicit = String(qs('view', '') || '').toLowerCase().trim();
  if (explicit) return explicit; // ✅ do NOT override

  const w = Math.max(1, WIN.innerWidth || 1);
  const h = Math.max(1, WIN.innerHeight || 1);
  const landscape = w >= h;
  const touch = isTouchDevice();

  // heuristic:
  // - touch + landscape + wide => likely cardboard/cVR
  // - touch => mobile
  // - else => pc
  if (touch) {
    if (landscape && w >= 740) return 'cvr';
    return 'mobile';
  }
  return 'pc';
}

function setBodyView(view) {
  const b = DOC.body;
  b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
  if (!view) view = 'mobile';
  if (view === 'cardboard') view = 'cvr';
  b.classList.add('view-' + view);
}

function getLayerEl() {
  return DOC.getElementById('fg-layer')
      || DOC.querySelector('#playLayer')
      || DOC.querySelector('.playLayer')
      || DOC.body;
}

function coach(text, mood = 'neutral') {
  try {
    WIN.dispatchEvent(new CustomEvent('hha:coach', { detail: { text, mood } }));
  } catch (_) {}
}

function ensureTapOverlay() {
  let el = DOC.getElementById('hhaTapStart');
  if (el) return el;

  el = DOC.createElement('div');
  el.id = 'hhaTapStart';
  el.style.cssText = `
    position:fixed; inset:0;
    z-index:70; /* under vr-ui (80) but above HUD (40) */
    display:flex; align-items:center; justify-content:center;
    padding:18px;
    background: rgba(2,6,23,.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    cursor:pointer;
  `;

  el.innerHTML = `
    <div style="
      width:min(520px,100%);
      border-radius:26px;
      border:1px solid rgba(148,163,184,.22);
      background: rgba(2,6,23,.84);
      box-shadow: 0 24px 70px rgba(0,0,0,.55);
      padding:16px;
    ">
      <div style="font-weight:1000; font-size:20px; letter-spacing:.2px;">🎮 Tap-to-start</div>
      <div style="margin-top:6px; color:rgba(148,163,184,1); font-weight:800; font-size:13px; line-height:1.35;">
        แตะ 1 ครั้งเพื่อเริ่มเกม (ปลดล็อกเสียง/ระบบยิงสำหรับมือถือ) ✅
      </div>

      <div style="
        margin-top:12px;
        display:flex; gap:10px; flex-wrap:wrap;
      ">
        <div style="
          flex:1 1 auto;
          padding:12px;
          border-radius:18px;
          background: rgba(15,23,42,.62);
          border: 1px solid rgba(148,163,184,.16);
          font-weight:900;
        ">
          🎯 ยิง: แตะจอ / crosshair
        </div>

        <div style="
          flex:1 1 auto;
          padding:12px;
          border-radius:18px;
          background: rgba(15,23,42,.62);
          border: 1px solid rgba(148,163,184,.16);
          font-weight:900;
        ">
          🧭 cVR: ใช้ RECENTER ก่อนเล่น
        </div>
      </div>

      <div style="
        margin-top:12px;
        display:flex; gap:10px;
      ">
        <button id="hhaTapStartBtn" type="button" style="
          flex:1 1 auto;
          display:inline-flex; align-items:center; justify-content:center;
          gap:8px;
          padding:12px 12px;
          border-radius:18px;
          border:1px solid rgba(34,197,94,.35);
          background: rgba(34,197,94,.20);
          color:#e5e7eb;
          font-weight:1000;
          cursor:pointer;
        ">✅ เริ่มเลย</button>

        <button id="hhaTapStartSkip" type="button" style="
          flex:1 1 auto;
          display:inline-flex; align-items:center; justify-content:center;
          gap:8px;
          padding:12px 12px;
          border-radius:18px;
          border:1px solid rgba(148,163,184,.20);
          background: rgba(2,6,23,.40);
          color:#e5e7eb;
          font-weight:1000;
          cursor:pointer;
        ">⏭️ เริ่มแบบเงียบ</button>
      </div>

      <div style="margin-top:10px; color:rgba(148,163,184,1); font-size:12px; font-weight:800;">
        * ถ้าเป็น PC มักเริ่มอัตโนมัติอยู่แล้ว
      </div>
    </div>
  `;

  DOC.body.appendChild(el);
  return el;
}

function hideTapOverlay() {
  const el = DOC.getElementById('hhaTapStart');
  if (el) el.remove();
}

function unlockAudioBestEffort() {
  try {
    const A = WIN.GroupsVR && WIN.GroupsVR.Audio;
    A && A.unlock && A.unlock();
  } catch (_) {}
}

function waitForEngine(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const it = setInterval(() => {
      const E = WIN.GroupsVR && WIN.GroupsVR.GameEngine;
      if (E && typeof E.start === 'function' && typeof E.setLayerEl === 'function') {
        clearInterval(it);
        resolve(E);
        return;
      }
      if (Date.now() - t0 > timeoutMs) {
        clearInterval(it);
        reject(new Error('Engine not ready: GroupsVR.GameEngine missing'));
      }
    }, 60);
  });
}

function parseRunMode() {
  const rm = String(qs('run', 'play') || 'play').toLowerCase();
  if (rm === 'research') return 'research';
  if (rm === 'practice') return 'practice';
  return 'play';
}

function startConfig(view) {
  const runMode = parseRunMode();
  const diff = String(qs('diff', 'normal') || 'normal').toLowerCase();
  const style = String(qs('style', 'mix') || 'mix').toLowerCase();
  const time = Math.max(5, Math.min(180, Number(qs('time', 90) || 90) || 90));
  const seed = String(qs('seed', Date.now()) || Date.now());

  return { runMode, diff, style, time, seed, view };
}

let started = false;

async function startOnce({ silent = false } = {}) {
  if (started) return;
  started = true;

  try {
    if (!silent) unlockAudioBestEffort();

    const view = detectViewNoOverride();
    setBodyView(view);

    const E = await waitForEngine(9000);
    E.setLayerEl(getLayerEl());

    const cfg = startConfig(view);

    // ✅ start engine
    coach('เริ่มเกมแล้ว! เล็งให้ตรงหมู่แล้วค่อยยิง 🎯', 'happy');
    E.start(cfg.diff, {
      runMode: cfg.runMode,
      diff: cfg.diff,
      style: cfg.style,
      time: cfg.time,
      seed: cfg.seed,
      view: cfg.view,
    });

    // optional: help cVR enter immersive + fullscreen (if ViewHelper exists)
    try {
      const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
      if (H && H.init) H.init({ view: cfg.view });
      if (cfg.view === 'cvr' && H && H.tryImmersiveForCVR) H.tryImmersiveForCVR();
    } catch (_) {}

  } catch (err) {
    console.error(err);
    started = false;
    coach('โหลดเอนจินไม่ขึ้น หรือ path ผิด (groups.safe.js). เช็คไฟล์แล้วรีเฟรชอีกครั้ง', 'sad');
  }
}

function shouldAutoStart(view) {
  // PC: autostart
  // Mobile/cVR: prefer tap-to-start unless explicitly autostart=1
  const force = String(qs('autostart', '0') || '0');
  if (force === '1' || force === 'true') return true;
  return (view === 'pc');
}

// ---- Boot entry ----
(function boot() {
  const view = detectViewNoOverride();
  setBodyView(view);

  // hint to user
  coach('แตะเพื่อเริ่ม…', 'neutral');

  if (shouldAutoStart(view)) {
    // PC auto start
    startOnce({ silent: false });
    return;
  }

  // Mobile/cVR: tap gate
  const overlay = ensureTapOverlay();

  const btnStart = DOC.getElementById('hhaTapStartBtn');
  const btnSkip  = DOC.getElementById('hhaTapStartSkip');

  const onStart = (silent) => {
    hideTapOverlay();
    startOnce({ silent });
  };

  // click anywhere
  overlay.addEventListener('click', (e) => {
    // if click on buttons, their handlers manage; but safe fallback:
    if (e.target && (e.target.id === 'hhaTapStartBtn' || e.target.id === 'hhaTapStartSkip')) return;
    onStart(false);
  }, { passive: true });

  btnStart && btnStart.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onStart(false); }, { passive: false });
  btnSkip  && btnSkip.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onStart(true);  }, { passive: false });

})();