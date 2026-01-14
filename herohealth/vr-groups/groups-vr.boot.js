// === /herohealth/vr-groups/groups-vr.boot.js ===
// GroupsVR Boot — PRODUCTION
// ✅ Auto-detect view (NO override when ?view= is explicit)
// ✅ Tap-to-start (required on mobile/cVR for gesture unlock + fullscreen/gyro)
// ✅ cVR Calibration gate (Step1 RECENTER, Step2 shoot test 3)
// ✅ Practice 15s when ?practice=1 (cVR only) then auto start real run
// ✅ Starts GroupsVR.GameEngine (from groups.safe.js)
// ✅ Optional AI hooks attach (play only, requires ?ai=1, research always OFF)

(function () {
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || !WIN) return;

  const $ = (id) => DOC.getElementById(id);

  function qs(k, def = null) {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }

  function isTouchDevice() {
    return ('ontouchstart' in WIN) || (navigator.maxTouchPoints | 0) > 0;
  }

  function detectViewNoOverride() {
    const explicit = String(qs('view', '') || '').toLowerCase().trim();
    if (explicit) return explicit; // ✅ do not override explicit

    const touch = isTouchDevice();
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    // heuristic tuned for your project
    if (touch) {
      if (landscape && w >= 740) return 'cvr';   // big phone / tablet landscape -> cardboard feel
      return 'mobile';
    }
    // desktop
    return (w >= 980) ? 'pc' : 'pc';
  }

  function setBodyView(view) {
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
    b.classList.add('view-' + view);
  }

  function setHudModeLabel(text) {
    const el = $('vMode');
    if (el) el.textContent = String(text || '').toUpperCase();
  }

  // ---------------- Tap-to-start overlay ----------------
  function ensureTapOverlay() {
    let el = DOC.getElementById('tapStart');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'tapStart';
    el.style.cssText = `
      position:fixed; inset:0; z-index:120;
      display:flex; align-items:center; justify-content:center;
      padding:18px;
      background: rgba(2,6,23,.72);
      backdrop-filter: blur(10px);
      color:#e5e7eb;
    `;
    el.innerHTML = `
      <div style="
        width:min(520px,100%);
        border-radius:26px;
        border:1px solid rgba(148,163,184,.20);
        background: rgba(2,6,23,.86);
        box-shadow: 0 24px 70px rgba(0,0,0,.55);
        padding:16px;">
        <div style="font-weight:1000; font-size:20px;">🟢 แตะเพื่อเริ่ม (Tap-to-start)</div>
        <div style="margin-top:6px; color:#94a3b8; font-weight:800; font-size:13px; line-height:1.35;">
          เพื่อปลดล็อกเสียง/การสั่น/เต็มจอ และเซ็นเซอร์บนมือถือ<br/>
          (Cardboard/cVR แนะนำให้แตะหนึ่งครั้งก่อน)
        </div>
        <div style="margin-top:12px; display:flex; gap:10px;">
          <button id="tapGo" type="button" style="
            flex:1; padding:12px; border-radius:18px; cursor:pointer;
            border:1px solid rgba(34,197,94,.35);
            background: rgba(34,197,94,.20);
            color:#e5e7eb; font-weight:1000;">▶️ เริ่มเลย</button>
          <button id="tapSkip" type="button" style="
            flex:1; padding:12px; border-radius:18px; cursor:pointer;
            border:1px solid rgba(148,163,184,.20);
            background: rgba(15,23,42,.60);
            color:#e5e7eb; font-weight:1000;">⏭️ เริ่มแบบเงียบ</button>
        </div>
        <div style="margin-top:10px; color:#94a3b8; font-weight:800; font-size:12px;">
          Tip: cVR ยิงด้วย crosshair (แตะจอ) • ใช้ RECENTER เพื่อปรับศูนย์มุมมอง
        </div>
      </div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  function hideTapOverlay() {
    const el = DOC.getElementById('tapStart');
    if (el) el.remove();
  }

  // ---------------- Engine ready ----------------
  function waitForEngine(cb) {
    const t0 = Date.now();
    const it = setInterval(() => {
      const E = WIN.GroupsVR && WIN.GroupsVR.GameEngine;
      if (E && typeof E.start === 'function' && typeof E.setLayerEl === 'function') {
        clearInterval(it);
        cb(E);
        return;
      }
      if (Date.now() - t0 > 9000) {
        clearInterval(it);
        try {
          WIN.dispatchEvent(new CustomEvent('hha:coach', {
            detail: { text: 'โหลดเอนจินไม่ขึ้น (groups.safe.js). เช็ค path/ชื่อไฟล์ แล้วรีเฟรชอีกครั้ง', mood: 'sad' }
          }));
        } catch (_) {}
      }
    }, 60);
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

  function tryUnlockAudioOnce() {
    try {
      const A = WIN.GroupsVR && WIN.GroupsVR.Audio;
      A && A.unlock && A.unlock();
    } catch (_) {}
  }

  // ---------------- Calibration (cVR gate) ----------------
  const cal = { on: false, step: 0, shots: 0 };

  function showCal(on) {
    const el = $('calOverlay');
    if (!el) return;
    el.classList.toggle('hidden', !on);
    DOC.body.classList.toggle('calibration', !!on);
  }

  function setCalStep(step) {
    cal.step = step;
    const stepEl = $('calStep');
    const subEl = $('calSub');
    const shotsEl = $('calShots');
    const nextBt = $('btnCalNext');

    if (stepEl) stepEl.textContent = `${step}/2`;
    if (shotsEl) shotsEl.textContent = `${cal.shots}/3`;

    if (subEl) {
      if (step === 1) {
        subEl.innerHTML = `Step 1/2: กด <b>RECENTER</b> แล้วถือมือถือให้นิ่งตรงหน้า`;
      } else {
        subEl.innerHTML = `Step 2/2: ลองยิง <b>3 ครั้ง</b> (แตะจอ) เพื่อทดสอบ crosshair`;
      }
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

  function startCalibrationIfNeeded(view, runMode) {
    if (view !== 'cvr') return false;

    // ถ้าอยาก “ไม่ทำ calibration ใน research” ให้เปิดบรรทัดนี้:
    // if (runMode === 'research') return false;

    cal.on = true;
    cal.shots = 0;

    showCal(true);
    setCalStep(1);

    try {
      WIN.dispatchEvent(new CustomEvent('hha:coach', {
        detail: { text: 'Calibration: กด RECENTER ก่อน แล้วกด “ต่อไป” ✅', mood: 'neutral' }
      }));
    } catch (_) {}

    return true;
  }

  function finishCalibration() {
    cal.on = false;
    showCal(false);
  }

  // count shots on hha:shoot when step 2
  WIN.addEventListener('hha:shoot', () => {
    if (!cal.on) return;
    if (cal.step !== 2) return;
    cal.shots = Math.min(3, (cal.shots | 0) + 1);
    setCalStep(2);
    try {
      WIN.dispatchEvent(new CustomEvent('hha:coach', {
        detail: { text: `Calibration ยิงแล้ว ${cal.shots}/3`, mood: 'neutral' }
      }));
    } catch (_) {}
  }, { passive: true });

  // calibration buttons
  function bindCalButtons(onDone) {
    const btnNext = $('btnCalNext');
    const btnSkip = $('btnCalSkip');

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (!cal.on) return;
        if (cal.step === 1) {
          setCalStep(2);
          try {
            WIN.dispatchEvent(new CustomEvent('hha:coach', {
              detail: { text: 'ต่อไป: ยิงทดสอบ 3 ครั้ง (แตะจอ) 🎯', mood: 'neutral' }
            }));
          } catch (_) {}
          return;
        }
        if (cal.step === 2 && cal.shots >= 3) {
          finishCalibration();
          onDone && onDone();
        }
      }, { passive: true });
    }

    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        if (!cal.on) return;
        finishCalibration();
        onDone && onDone();
      }, { passive: true });
    }
  }

  // ---------------- Practice chain ----------------
  function getPracticeSec(view) {
    const p = String(qs('practice', '0') || '0');
    let sec = Number(p) || 0;
    if (p === '1') sec = 15;
    sec = clamp(sec, 0, 30);
    if (view !== 'cvr') sec = 0;
    return sec;
  }

  // ---------------- AI switch ----------------
  function aiEnabled(runMode) {
    const on = String(qs('ai', '0') || '0').toLowerCase();
    if (runMode === 'research' || runMode === 'practice') return false;
    return (on === '1' || on === 'true');
  }

  // ---------------- START FLOW ----------------
  let started = false;
  let practiceActive = false;

  function startEngineFlow() {
    if (started) return;
    started = true;

    const view = String(detectViewNoOverride() || 'mobile').toLowerCase();
    const runMode = (String(qs('run', 'play') || 'play').toLowerCase() === 'research') ? 'research' : 'play';
    const diff = String(qs('diff', 'normal') || 'normal').toLowerCase();
    const style = String(qs('style', 'mix') || 'mix').toLowerCase();
    const time = clamp(qs('time', 90), 30, 180);
    const seed = String(qs('seed', Date.now()) || Date.now());

    setBodyView(view);
    initViewHelper(view);

    // label now (before real start)
    setHudModeLabel(runMode === 'research' ? 'RESEARCH' : 'PLAY');

    const practiceSec = getPracticeSec(view);

    // cVR calibration gate
    const gated = startCalibrationIfNeeded(view, runMode);
    if (gated) {
      bindCalButtons(() => {
        waitForEngine((E) => startAfterCalibration(E, { view, runMode, diff, style, time, seed, practiceSec }));
      });
      return;
    }

    waitForEngine((E) => startAfterCalibration(E, { view, runMode, diff, style, time, seed, practiceSec }));
  }

  function startAfterCalibration(E, cfg) {
    // practice first (cVR only + practiceSec > 0)
    if (cfg.view === 'cvr' && cfg.practiceSec > 0) {
      practiceActive = true;
      setHudModeLabel('PRACTICE');

      // try immersive helper for cVR
      try {
        const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
        H && H.tryImmersiveForCVR && H.tryImmersiveForCVR();
      } catch (_) {}

      E.setLayerEl(getLayerEl());
      E.start(cfg.diff, {
        runMode: 'practice',
        diff: cfg.diff,
        style: cfg.style,
        time: cfg.practiceSec,
        seed: String(cfg.seed) + '-practice',
        view: cfg.view
      });

      try {
        WIN.dispatchEvent(new CustomEvent('hha:coach', {
          detail: { text: `Practice ${cfg.practiceSec}s: ลองเล็งให้แม่นก่อนเข้าเกมจริง! 🎯`, mood: 'happy' }
        }));
      } catch (_) {}

      return;
    }

    // real start
    startReal(E, cfg);
  }

  function startReal(E, cfg) {
    practiceActive = false;

    setHudModeLabel(cfg.runMode === 'research' ? 'RESEARCH' : 'PLAY');

    initViewHelper(cfg.view);
    E.setLayerEl(getLayerEl());

    E.start(cfg.diff, {
      runMode: cfg.runMode,
      diff: cfg.diff,
      style: cfg.style,
      time: cfg.time,
      seed: cfg.seed,
      view: cfg.view
    });

    // AI attach (safe)
    try {
      const AI = WIN.GroupsVR && WIN.GroupsVR.AIHooks;
      if (AI && AI.attach) {
        AI.attach({
          runMode: cfg.runMode,
          seed: cfg.seed,
          enabled: aiEnabled(cfg.runMode)
        });
      }
    } catch (_) {}
  }

  // When practice ends, auto start real run (A must ignore practice end overlay)
  WIN.addEventListener('hha:end', (ev) => {
    const d = ev.detail || {};
    if (!practiceActive) return;
    if (String(d.reason || '') !== 'practice') return;

    practiceActive = false;

    // rebuild cfg from params (fresh)
    const view = String(detectViewNoOverride() || 'mobile').toLowerCase();
    const runMode = (String(qs('run', 'play') || 'play').toLowerCase() === 'research') ? 'research' : 'play';
    const diff = String(qs('diff', 'normal') || 'normal').toLowerCase();
    const style = String(qs('style', 'mix') || 'mix').toLowerCase();
    const time = clamp(qs('time', 90), 30, 180);
    const seed = String(qs('seed', Date.now()) || Date.now());

    waitForEngine((E) => {
      setTimeout(() => startReal(E, { view, runMode, diff, style, time, seed, practiceSec: 0 }), 180);
    });
  }, { passive: true });

  // ---------------- Tap-to-start decision ----------------
  function needsTapToStart(view) {
    // safest: any touch device requires gesture
    if (isTouchDevice()) return true;
    // desktop can autostart
    return false;
  }

  function boot() {
    const view = String(detectViewNoOverride() || 'mobile').toLowerCase();
    setBodyView(view);

    // if we need tap: show overlay, wait for click
    if (needsTapToStart(view)) {
      const overlay = ensureTapOverlay();
      const btnGo = DOC.getElementById('tapGo');
      const btnSkip = DOC.getElementById('tapSkip');

      const go = () => {
        tryUnlockAudioOnce();
        hideTapOverlay();
        startEngineFlow();
      };

      if (btnGo) btnGo.addEventListener('click', go, { passive: true });
      if (btnSkip) btnSkip.addEventListener('click', () => {
        hideTapOverlay();
        startEngineFlow();
      }, { passive: true });

      // also allow tapping anywhere
      overlay.addEventListener('click', (e) => {
        // prevent double-trigger from clicking buttons
        if (e && e.target && (e.target.id === 'tapGo' || e.target.id === 'tapSkip')) return;
        go();
      }, { passive: true });

      return;
    }

    // desktop autostart
    startEngineFlow();
  }

  boot();

})();