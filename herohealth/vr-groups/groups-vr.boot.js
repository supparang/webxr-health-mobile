// === /herohealth/groups-vr.boot.js ===
// GroupsVR Boot (Launcher -> Run)
// ✅ Auto-detect view (does NOT override explicit ?view=...)
// ✅ Tap-to-start gate (unlock audio/fullscreen gesture)
// ✅ Redirect to /herohealth/vr-groups/groups-vr.html with passthrough params
// ✅ Keeps hub/log/research params

(function () {
  'use strict';

  const WIN = window;
  const DOC = document;

  const RUN_PATH = './vr-groups/groups-vr.html'; // from /herohealth/groups-vr.html

  const qs = (k, def = null) => {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  };

  function detectViewNoOverride() {
    const explicit = String(qs('view', '') || '').toLowerCase();
    if (explicit) return explicit;

    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints | 0) > 0);
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    // ✅ heuristic: mobile touch -> mobile, but wide landscape touch -> cVR
    if (isTouch) {
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function buildRunUrl(view) {
    const u = new URL(RUN_PATH, location.href);
    const sp = new URL(location.href).searchParams;

    // pass everything through
    sp.forEach((v, k) => u.searchParams.set(k, v));

    // set detected view only if not explicit
    if (!sp.get('view')) u.searchParams.set('view', view);

    // default params
    if (!u.searchParams.get('run'))  u.searchParams.set('run', 'play');
    if (!u.searchParams.get('diff')) u.searchParams.set('diff', 'easy');
    if (!u.searchParams.get('time')) u.searchParams.set('time', '90');
    if (!u.searchParams.get('seed')) u.searchParams.set('seed', String(Date.now()));

    return u.toString();
  }

  function ensureTapOverlay() {
    let ov = DOC.getElementById('tapStart');
    if (ov) return ov;

    ov = DOC.createElement('div');
    ov.id = 'tapStart';
    ov.style.cssText = `
      position:fixed; inset:0; z-index:999;
      display:flex; align-items:center; justify-content:center;
      padding:18px;
      background: rgba(2,6,23,.84);
      backdrop-filter: blur(10px);
      color:#e5e7eb;
      font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    `;
    ov.innerHTML = `
      <div style="
        width:min(560px, 100%);
        border:1px solid rgba(148,163,184,.22);
        background: rgba(15,23,42,.55);
        border-radius: 22px;
        padding: 16px;
        box-shadow: 0 24px 70px rgba(0,0,0,.55);
      ">
        <div style="font-weight:1000; font-size:20px;">👆 Tap-to-start</div>
        <div style="margin-top:8px; color:rgba(148,163,184,.95); font-weight:800; font-size:13px; line-height:1.35;">
          แตะ 1 ครั้งเพื่อเริ่มเกม (ปลดล็อกเสียง/เต็มจอ) <br/>
          จากนั้นจะเข้าเกมอัตโนมัติ
        </div>
        <button id="btnTapGo" type="button" style="
          margin-top:14px;
          width:100%;
          display:inline-flex; align-items:center; justify-content:center;
          gap:10px;
          padding: 12px 14px;
          border-radius: 18px;
          border:1px solid rgba(34,197,94,.35);
          background: rgba(34,197,94,.18);
          color:#e5e7eb;
          font-weight:1000;
          cursor:pointer;
        ">🚀 เริ่มเลย</button>
        <div style="margin-top:10px; color:rgba(148,163,184,.9); font-weight:800; font-size:12px;">
          Hint: ถ้าเข้าจอ Cardboard ให้กด RECENTER ในเกมก่อนเริ่มยิง 🎯
        </div>
      </div>
    `;
    DOC.body.appendChild(ov);
    return ov;
  }

  async function unlockAudioBestEffort() {
    // best-effort: create a tiny audio context
    try {
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      if (ctx.state === 'suspended') await ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(() => { try { o.stop(); } catch (_) {} }, 40);
    } catch (_) {}
  }

  function go() {
    const view = detectViewNoOverride();
    location.href = buildRunUrl(view);
  }

  function main() {
    const ov = ensureTapOverlay();
    const btn = DOC.getElementById('btnTapGo');

    const onTap = async () => {
      try { btn && (btn.disabled = true); } catch (_) {}
      await unlockAudioBestEffort();
      go();
    };

    // any click/tap starts
    ov.addEventListener('click', onTap, { passive: true });
    btn && btn.addEventListener('click', onTap, { passive: true });
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
  else main();

})();
