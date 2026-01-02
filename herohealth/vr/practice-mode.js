// === /herohealth/vr/practice-mode.js ===
// HHA Practice Mode (Universal) — 15s warmup before real game
// - Overlay: Start Practice / Skip / Start Real
// - Emits: hha:practice:start, hha:practice:end, then hha:start
// - Provides window.HHA_PRACTICE state for games to read (isPractice, leftSec, etc.)
// - Safe defaults; no dependencies

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  function qs(k, def = null) {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function emit(name, detail) {
    try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  const view = String(qs('view','pc')).toLowerCase();
  const run  = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();

  const enabledParam = String(qs('practice','1')); // default ON
  const enabled = enabledParam !== '0';

  const practiceSec = Math.max(5, Math.min(60, parseInt(qs('psec','15'),10) || 15));
  const game = String(qs('game','') || qs('gameMode','') || '').toLowerCase(); // optional
  const storeKey = 'HHA_PRACTICE_PREF_V1';

  // Expose state (games can read this)
  const P = root.HHA_PRACTICE || (root.HHA_PRACTICE = {});
  P.enabled = enabled;
  P.practiceSec = practiceSec;
  P.isPractice = false;
  P.leftSec = practiceSec;
  P.view = view;
  P.run = run;
  P.diff = diff;
  P.game = game;

  function shouldAutoShow() {
    if (!enabled) return false;

    // allow force
    if (String(qs('practice','')) === '1' && String(qs('forcePractice','')) === '1') return true;

    // If view not chosen yet (no view param), do nothing (launcher will handle)
    if (!view) return false;

    // remember preference: if user previously chose "skip always" for this session
    try {
      const raw = localStorage.getItem(storeKey);
      if (!raw) return true;
      const obj = JSON.parse(raw);
      // if user chose skip practice and it was recent, don't show
      if (obj && obj.skip === true) return false;
      return true;
    } catch (_) {
      return true;
    }
  }

  function savePref(skip) {
    try {
      localStorage.setItem(storeKey, JSON.stringify({
        ts: Date.now(),
        iso: new Date().toISOString(),
        skip: !!skip
      }));
    } catch (_) {}
  }

  function makeOverlay() {
    const wrap = DOC.createElement('div');
    wrap.id = 'hha-practice-overlay';
    wrap.style.cssText = `
      position:fixed; inset:0; z-index:140;
      display:flex; align-items:center; justify-content:center;
      padding: calc(16px + env(safe-area-inset-top,0px)) calc(16px + env(safe-area-inset-right,0px))
               calc(16px + env(safe-area-inset-bottom,0px)) calc(16px + env(safe-area-inset-left,0px));
      background: rgba(2,6,23,.78);
      backdrop-filter: blur(10px);
      color:#e5e7eb;
      font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
    `;

    const card = DOC.createElement('div');
    card.style.cssText = `
      width:min(920px,100%);
      border-radius:22px;
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.72);
      box-shadow: 0 24px 90px rgba(0,0,0,.55);
      padding:16px;
    `;

    const title = DOC.createElement('div');
    title.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:10px;';
    title.innerHTML = `
      <div style="width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;
                  background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.18);font-size:22px;">🧪</div>
      <div>
        <div style="font-weight:900;font-size:16px;letter-spacing:.2px;">Practice Mode (${practiceSec}s)</div>
        <div style="opacity:.9;font-size:12.5px;line-height:1.3;">
          ซ้อมก่อนเล่นจริง — เป้าช้าลง/ง่ายขึ้น/เน้น “เล็งให้ชัวร์”
        </div>
      </div>
    `;

    const box = DOC.createElement('div');
    box.style.cssText = `
      margin:12px 0;
      border-radius:18px;
      border:1px solid rgba(148,163,184,.16);
      background: rgba(15,23,42,.58);
      padding:12px;
      line-height:1.35;
      font-size:13px;
      white-space:pre-line;
    `;

    const tips = [
      `• PC: คลิกยิง (ไม่ต้องรัว)`,
      `• Mobile: แตะเป้า / หรือ cVR แตะเพื่อยิงกลางจอ`,
      `• Cardboard: หันมองตรง + RECENTER ก่อนเริ่ม`,
      `• เป้าดี = ทำแต้ม/คอมโบ | เป้าแย่ = ทำ MISS/เพี้ยน`
    ].join('\n');

    box.textContent = tips;

    const meter = DOC.createElement('div');
    meter.style.cssText = `
      margin-top:10px;
      display:flex;gap:10px;align-items:center;flex-wrap:wrap;
    `;
    meter.innerHTML = `
      <div style="flex:1;min-width:220px;height:10px;border-radius:999px;background:rgba(148,163,184,.18);
                  overflow:hidden;border:1px solid rgba(148,163,184,.12);">
        <div id="hha-practice-bar" style="height:100%;width:0%;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));"></div>
      </div>
      <div style="font-weight:900;">
        เหลือ <span id="hha-practice-left">${practiceSec}</span>s
      </div>
    `;
    box.appendChild(meter);

    const row = DOC.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;';

    function btn(label, kind) {
      const b = DOC.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = `
        appearance:none; cursor:pointer; user-select:none;
        border-radius:14px; padding:10px 12px; font-weight:900; font-size:13px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(15,23,42,.62);
        color:#e5e7eb;
      `;
      if (kind === 'primary') {
        b.style.borderColor = 'rgba(34,197,94,.26)';
        b.style.background = 'rgba(34,197,94,.16)';
      }
      if (kind === 'cyan') {
        b.style.borderColor = 'rgba(34,211,238,.26)';
        b.style.background = 'rgba(34,211,238,.12)';
      }
      if (kind === 'warn') {
        b.style.borderColor = 'rgba(245,158,11,.26)';
        b.style.background = 'rgba(245,158,11,.14)';
      }
      return b;
    }

    const bStartPractice = btn('▶️ เริ่มซ้อม', 'primary');
    const bSkip = btn('⏭️ ข้ามซ้อม', 'warn');
    const bSkipAlways = btn('🚫 ไม่ต้องซ้อมอีก (จำค่า)', '');
    const bStartReal = btn('🔥 เริ่มเกมจริงเลย', 'cyan');
    bStartReal.disabled = true;
    bStartReal.style.opacity = '.55';

    row.appendChild(bStartPractice);
    row.appendChild(bStartReal);
    row.appendChild(bSkip);
    row.appendChild(bSkipAlways);

    card.appendChild(title);
    card.appendChild(box);
    card.appendChild(row);
    wrap.appendChild(card);

    let timer = null;
    let started = false;

    function setRealEnabled(on) {
      bStartReal.disabled = !on;
      bStartReal.style.opacity = on ? '1' : '.55';
    }

    function close() {
      try { wrap.remove(); } catch (_) {}
    }

    function startPractice() {
      if (started) return;
      started = true;
      P.isPractice = true;
      P.leftSec = practiceSec;

      emit('hha:practice:start', {
        view, run, diff, practiceSec,
        game: P.game || ''
      });

      setRealEnabled(false);
      bStartPractice.disabled = true;
      bStartPractice.style.opacity = '.6';

      const leftEl = DOC.getElementById('hha-practice-left');
      const barEl = DOC.getElementById('hha-practice-bar');

      const t0 = performance.now();
      timer = root.setInterval(() => {
        const t = performance.now();
        const elapsed = (t - t0) / 1000;
        const left = Math.max(0, practiceSec - elapsed);
        P.leftSec = left;

        if (leftEl) leftEl.textContent = String(Math.ceil(left));
        if (barEl) barEl.style.width = String(Math.min(100, (elapsed / practiceSec) * 100).toFixed(1)) + '%';

        if (left <= 0.001) {
          endPractice('timeout');
        }
      }, 120);
    }

    function endPractice(reason) {
      if (!started) return;
      if (timer) { clearInterval(timer); timer = null; }

      P.isPractice = false;
      P.leftSec = 0;

      emit('hha:practice:end', {
        view, run, diff, practiceSec,
        reason: reason || 'end',
        game: P.game || ''
      });

      // enable "start real" (doesn't auto-close unless user chooses)
      setRealEnabled(true);
    }

    function startReal() {
      // after practice or skip
      close();
      // IMPORTANT: start real game
      emit('hha:start', { from:'practice-mode', view, run, diff, game: P.game || '' });
    }

    bStartPractice.addEventListener('click', startPractice);

    bStartReal.addEventListener('click', () => {
      // if practice never started, treat as "skip"
      startReal();
    });

    bSkip.addEventListener('click', () => {
      // skip practice this time
      savePref(false); // do not force skip always
      startReal();
    });

    bSkipAlways.addEventListener('click', () => {
      savePref(true);
      startReal();
    });

    // If user already started real game elsewhere, close overlay
    root.addEventListener('hha:start', () => {
      // avoid recursive close on our own emit
      if (DOC.getElementById('hha-practice-overlay')) close();
    }, { once:true });

    // Allow external end practice
    root.addEventListener('hha:practice:force_end', (ev) => {
      const d = (ev && ev.detail) || {};
      endPractice(d.reason || 'force');
    });

    return wrap;
  }

  function init() {
    if (!shouldAutoShow()) return;

    // If startOverlay exists (your launcher overlay), don't fight it.
    // If user already has a startOverlay, we wait until it hides (view selected).
    const startOverlay = DOC.getElementById('startOverlay');
    if (startOverlay && !startOverlay.classList.contains('hide')) {
      // Wait: when their overlay hides, show practice overlay
      const mo = new MutationObserver(() => {
        const hidden = startOverlay.classList.contains('hide') || getComputedStyle(startOverlay).display === 'none';
        if (hidden) {
          try { mo.disconnect(); } catch (_) {}
          DOC.body.appendChild(makeOverlay());
        }
      });
      try { mo.observe(startOverlay, { attributes:true, attributeFilter:['class','style'] }); } catch (_) {}
      return;
    }

    DOC.body.appendChild(makeOverlay());
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

})(window);