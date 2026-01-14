// === /herohealth/vr-groups/groups-vr.boot.js ===
// GroupsVR Boot — PRODUCTION
// ✅ Detect view (pc/mobile/cvr) WITHOUT overriding explicit ?view=
// ✅ Tap-to-start gate on touch devices (unlock audio/fullscreen policies)
// ✅ Wait for engine (GroupsVR.GameEngine) then start()
// ✅ Supports: calibration (cVR), practice (cVR), AI hooks (play only), research deterministic
//
// Usage in A (groups-vr.html RUN):
// <script src="./groups-vr.boot.js" defer></script>
// and REMOVE the big inline start script to avoid double-start.

(function () {
  'use strict';

  const WIN = window;
  const DOC = document;

  if (!WIN || !DOC) return;
  if (WIN.__HHA_GROUPS_BOOT_LOADED__) return;
  WIN.__HHA_GROUPS_BOOT_LOADED__ = true;

  const $ = (id) => DOC.getElementById(id);

  function qs(k, def = null) {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function clamp(v, a, b) {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  }

  function isTouch() {
    return ('ontouchstart' in WIN) || (navigator.maxTouchPoints | 0) > 0;
  }

  // ✅ no override: if ?view= present, trust it
  function detectViewNoOverride() {
    const explicit = String(qs('view', '') || '').toLowerCase();
    if (explicit) return explicit;

    const touch = isTouch();
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    if (touch) {
      // conservative default: mobile
      // If you want auto-cVR on wide landscape phones, uncomment:
      // if (landscape && w >= 860) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setBodyView(view) {
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
    b.classList.add('view-' + view);
  }

  function getPracticeSec(view) {
    const p = String(qs('practice', '0') || '0');
    let sec = Number(p) || 0;
    if (p === '1') sec = 15;         // practice=1 => 15s
    sec = clamp(sec, 0, 30);
    if (view !== 'cvr') sec = 0;     // practice only for cVR
    return sec;
  }

  function aiEnabled(runMode) {
    const on = String(qs('ai', '0') || '0').toLowerCase();
    if (runMode === 'research' || runMode === 'practice') return false;
    return (on === '1' || on === 'true');
  }

  async function tryFullscreen() {
    try {
      const el = DOC.documentElement;
      if (el.requestFullscreen && !DOC.fullscreenElement) {
        await el.requestFullscreen();
      }
    } catch (_) {}
  }

  // ---------- Tap-to-start overlay (optional but recommended) ----------
  function ensureTapOverlay() {
    let tap = $('hhaTapOverlay');
    if (tap) return tap;

    tap = DOC.createElement('div');
    tap.id = 'hhaTapOverlay';
    tap.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      display:none; align-items:center; justify-content:center;
      padding:18px;
      background: rgba(2,6,23,.82);
      backdrop-filter: blur(10px);
    `;

    const box = DOC.createElement('div');
    box.style.cssText = `
      width:min(560px,96vw);
      border-radius:26px;
      border:1px solid rgba(148,163,184,.20);
      background: rgba(2,6,23,.88);
      box-shadow: 0 24px 80px rgba(0,0,0,.60);
      padding:16px;
      color:#e5e7eb;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    `;
    box.innerHTML = `
      <div style="font-weight:1000;font-size:20px;">👆 Tap-to-start</div>
      <div style="margin-top:8px;color:#94a3b8;font-weight:800;font-size:13px;line-height:1.35;">
        มือถือบางเครื่องต้อง “แตะ 1 ครั้ง” เพื่อปลดล็อกเสียง/เต็มจอ แล้วค่อยเริ่มเกม
      </div>
      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <button id="hhaTapGo" type="button"
          style="flex:1 1 auto;padding:12px 14px;border-radius:18px;border:1px solid rgba(34,197,94,.35);
                 background: rgba(34,197,94,.18);color:#e5e7eb;font-weight:1000;cursor:pointer;">
          ✅ แตะเพื่อเริ่ม
        </button>
        <button id="hhaTapSkip" type="button"
          style="flex:1 1 auto;padding:12px 14px;border-radius:18px;border:1px solid rgba(148,163,184,.20);
                 background: rgba(2,6,23,.50);color:#e5e7eb;font-weight:1000;cursor:pointer;">
          ⏭️ ข้าม
        </button>
      </div>
      <div style="margin-top:10px;color:#94a3b8;font-weight:800;font-size:12px;line-height:1.35;">
        หมายเหตุ: cVR ใช้ยิงจาก crosshair (hha:shoot) • ปุ่ม ENTER VR/RECENTER มาจาก vr-ui.js
      </div>
    `;

    tap.appendChild(box);
    DOC.body.appendChild(tap);
    return tap;
  }

  function showTap(on) {
    const tap = ensureTapOverlay();
    tap.style.display = on ? 'flex' : 'none';
  }

  // ---------- Engine wait ----------
  function waitForEngine(timeoutMs = 8000) {
    return new Promise((resolve) => {
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
          resolve(null);
        }
      }, 60);
    });
  }

  function getLayerEl() {
    return $('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
  }

  function initViewHelper(view) {
    try {
      const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
      H && H.init && H.init({ view });
    } catch (_) {}
  }

  // ---------- cVR Calibration gate (PACK 13) ----------
  // Boot will just "show/hide" if A has the overlay DOM (#calOverlay) and buttons;
  // actual step logic can remain in A, but we support it here as well if present.

  const cal = { on:false, step:0, shots:0, done:false };

  function showCal(on) {
    const el = $('calOverlay');
    if (!el) return false;
    el.classList.toggle('hidden', !on);
    DOC.body.classList.toggle('calibration', !!on);
    return true;
  }

  function setCalStep(step) {
    cal.step = step;
    const stepEl = $('calStep');
    const subEl  = $('calSub');
    const shotsEl= $('calShots');
    const nextBt = $('btnCalNext');

    if (stepEl) stepEl.textContent = `${step}/2`;
    if (shotsEl) shotsEl.textContent = `${cal.shots}/3`;

    if (subEl) {
      if (step === 1) subEl.innerHTML = `Step 1/2: กด <b>RECENTER</b> แล้วถือมือถือให้นิ่งตรงหน้า`;
      else subEl.innerHTML = `Step 2/2: ลองยิง <b>3 ครั้ง</b> (แตะจอ) เพื่อทดสอบ crosshair`;
    }

    if (nextBt) {
      if (step === 1) {
        nextBt.textContent = '✅ ต่อไป';
        nextBt.disabled = false;
      } else {
        nextBt.textContent = (cal.shots >= 3) ? '🚀 เริ่มเลย' : 'ยิงให้ครบ 3 ครั้ง';
        nextBt.disabled = (cal.shots < 3);
      }
    }
  }

  function startCalibrationIfNeeded(view) {
    if (view !== 'cvr') return false;
    if (!$('calOverlay')) return false; // overlay must exist in A
    cal.on = true;
    cal.done = false;
    cal.shots = 0;
    showCal(true);
    setCalStep(1);
    return true;
  }

  function finishCalibration() {
    cal.on = false;
    cal.done = true;
    showCal(false);
  }

  // Count shots during calibration step 2
  try {
    WIN.addEventListener('hha:shoot', () => {
      if (!cal.on) return;
      if (cal.step !== 2) return;
      cal.shots = Math.min(3, (cal.shots | 0) + 1);
      setCalStep(2);
    }, { passive:true });
  } catch (_) {}

  function bindCalButtons(afterCalStartFn) {
    const nextBt = $('btnCalNext');
    const skipBt = $('btnCalSkip');
    if (!nextBt || !skipBt) return;

    nextBt.onclick = async () => {
      if (!cal.on) return;
      if (cal.step === 1) { setCalStep(2); return; }
      if (cal.step === 2 && cal.shots >= 3) {
        finishCalibration();
        afterCalStartFn && afterCalStartFn();
      }
    };

    skipBt.onclick = () => {
      if (!cal.on) return;
      finishCalibration();
      afterCalStartFn && afterCalStartFn();
    };
  }

  // ---------- Start flows ----------
  function startPractice(E, { diff, style, seed, practiceSec }) {
    const seedP = String(seed) + '-practice';
    initViewHelper('cvr');
    E.setLayerEl(getLayerEl());
    E.start(diff, { runMode:'practice', diff, style, time: practiceSec, seed: seedP, view:'cvr' });

    try {
      const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
      H && H.tryImmersiveForCVR && H.tryImmersiveForCVR();
    } catch (_) {}
  }

  function startReal(E, { view, runMode, diff, style, timeSec, seed }) {
    initViewHelper(view);
    E.setLayerEl(getLayerEl());
    E.start(diff, { runMode, diff, style, time: timeSec, seed, view });

    // PACK 15 AI attach point
    try {
      const AI = WIN.GroupsVR && WIN.GroupsVR.AIHooks;
      if (AI && AI.attach) {
        AI.attach({ runMode, seed, enabled: aiEnabled(runMode) && runMode === 'play' });
      }
    } catch (_) {}
  }

  async function bootStart() {
    const view = String(detectViewNoOverride() || 'mobile').toLowerCase();
    setBodyView(view);

    const runMode = (String(qs('run', 'play') || 'play').toLowerCase() === 'research') ? 'research' : 'play';
    const diff = String(qs('diff', 'normal') || 'normal').toLowerCase();
    const style = String(qs('style', 'mix') || 'mix').toLowerCase();
    const timeSec = clamp(qs('time', 90), 30, 180);
    const seed = String(qs('seed', Date.now()) || Date.now());

    // unlock policies on touch
    const needTap = isTouch();
    if (needTap) {
      showTap(true);
      $('hhaTapGo').onclick = async () => {
        showTap(false);
        await tryFullscreen();
        proceed(view, runMode, diff, style, timeSec, seed);
      };
      $('hhaTapSkip').onclick = () => {
        showTap(false);
        proceed(view, runMode, diff, style, timeSec, seed);
      };
      $('hhaTapOverlay').onclick = (e) => {
        if (e.target && e.target.id === 'hhaTapOverlay') {
          $('hhaTapGo').click();
        }
      };
      return;
    }

    // desktop: proceed immediately
    proceed(view, runMode, diff, style, timeSec, seed);
  }

  async function proceed(view, runMode, diff, style, timeSec, seed) {
    // cVR calibration gate (if overlay exists)
    const gated = startCalibrationIfNeeded(view);

    const E = await waitForEngine(9000);
    if (!E) {
      try {
        WIN.dispatchEvent(new CustomEvent('hha:coach', {
          detail:{ text:'โหลดเอนจินไม่ขึ้น (groups.safe.js). เช็ค path/ชื่อไฟล์ แล้วรีเฟรช', mood:'sad' }
        }));
      } catch (_) {}
      return;
    }

    const practiceSec = getPracticeSec(view);

    const startAfterCal = () => {
      if (view === 'cvr' && practiceSec > 0) {
        startPractice(E, { diff, style, seed, practiceSec });
        return;
      }
      startReal(E, { view, runMode, diff, style, timeSec, seed });
    };

    if (gated) {
      bindCalButtons(startAfterCal);
      return;
    }

    startAfterCal();
  }

  // start
  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', bootStart, { once:true });
  } else {
    bootStart();
  }

})();