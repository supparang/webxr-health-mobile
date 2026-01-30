// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Auto view detect (fallback when view=auto / missing)
// ✅ Adds body class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Wires vr-ui.js shooting (hha:shoot) -> forwards to safe engine (if supported)
// ✅ Dispatches gj:measureSafe so HTML recalculates spawn safe-zone
// ✅ Robustly loads goodjunk.safe.js with multiple export shapes
// ✅ Emits hha:ready / handles hard-fail message on boot errors

const qs = (k, d = null) => {
  try { return new URL(location.href).searchParams.get(k) ?? d; } catch (_) { return d; }
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

function detectViewAuto() {
  // view-vr / view-cvr normally comes from launcher, but keep auto fallback safe.
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (matchMedia && matchMedia('(pointer:coarse)').matches);
  const hasXR = !!(navigator.xr);
  // If XR exists but no explicit view, keep mobile/pc split; Enter VR button provided by vr-ui.js anyway.
  return isMobile ? 'mobile' : 'pc';
}

function applyViewClass(viewRaw) {
  const v = (viewRaw || 'auto').toLowerCase();
  const view = (v === 'auto' || v === 'detect' || !v) ? detectViewAuto() : v;

  document.body.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
  if (view === 'cvr') document.body.classList.add('view-cvr');
  else if (view === 'vr') document.body.classList.add('view-vr');
  else if (view === 'mobile') document.body.classList.add('view-mobile');
  else document.body.classList.add('view-pc');

  return view;
}

function dispatchMeasureSafe() {
  try {
    window.dispatchEvent(new Event('gj:measureSafe'));
  } catch (_) {}
}

function hardFail(msg, err) {
  console.error('[GoodJunkVR.boot] FAIL:', msg, err || '');
  try {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.inset = '0';
    div.style.zIndex = '999';
    div.style.background = 'rgba(0,0,0,.75)';
    div.style.color = '#fff';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.padding = '18px';
    div.style.fontFamily = 'system-ui,-apple-system,Segoe UI,Noto Sans Thai,sans-serif';
    div.innerHTML = `
      <div style="max-width:720px;background:rgba(2,6,23,.92);border:1px solid rgba(148,163,184,.2);border-radius:18px;padding:16px">
        <div style="font-weight:900;font-size:18px;margin-bottom:8px">GoodJunkVR โหลดไม่สำเร็จ</div>
        <div style="opacity:.9;line-height:1.35">${msg}</div>
        <div style="opacity:.75;margin-top:10px;font-size:12px">เปิด Console ดู error เพื่อแก้ไฟล์ได้เร็วขึ้น</div>
        <button id="gjReload" style="margin-top:14px;height:44px;border-radius:14px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.6);color:#fff;font-weight:900;padding:0 14px;cursor:pointer">Reload</button>
      </div>
    `;
    document.body.appendChild(div);
    div.querySelector('#gjReload')?.addEventListener('click', () => location.reload());
  } catch (_) {}
}

async function loadSafeModule() {
  // try standard module import first
  const mod = await import('./goodjunk.safe.js');
  // support various export shapes
  const factory =
    mod?.boot ||
    mod?.createGame ||
    mod?.create ||
    mod?.default;

  if (!factory) {
    throw new Error('goodjunk.safe.js missing export: expected boot/createGame/create/default');
  }
  return { mod, factory };
}

function buildCtx() {
  const ctx = {
    hub: qs('hub', null),
    run: (qs('run', 'play') || 'play').toLowerCase(),
    diff: (qs('diff', 'normal') || 'normal').toLowerCase(),
    style: (qs('style', 'mix') || 'mix').toLowerCase(),
    time: clamp(qs('time', 80), 20, 999),
    seed: Number(qs('seed', Date.now())) || Date.now(),
    view: qs('view', 'auto'),
    // research passthrough
    studyId: qs('studyId', ''),
    phase: qs('phase', ''),
    conditionGroup: qs('conditionGroup', ''),
    siteCode: qs('siteCode', ''),
    classCode: qs('classCode', ''),
    playerId: qs('playerId', ''),
    // logging (optional)
    log: qs('log', '') // if your logger module uses it
  };
  return ctx;
}

function grabUI() {
  const $ = (id) => document.getElementById(id);

  return {
    // layers
    layer: $('gj-layer'),
    layerR: $('gj-layer-r'),

    // mission line
    mGoal: $('mGoal'),
    mMini: $('mMini'),

    // progress
    progressFill: $('gjProgressFill'),

    // boss
    bossBar: $('bossBar'),
    bossHint: $('bossHint'),
    bossFill: $('bossFill'),

    // hud top
    score: $('hud-score'),
    time: $('hud-time'),
    miss: $('hud-miss'),
    grade: $('hud-grade'),
    hudGoal: $('hud-goal'),
    goalDesc: $('goalDesc'),
    goalCur: $('hud-goal-cur'),
    goalTarget: $('hud-goal-target'),
    hudMini: $('hud-mini'),
    miniTimer: $('miniTimer'),

    // hud bottom
    feverFill: $('feverFill'),
    feverText: $('feverText'),
    shieldPills: $('shieldPills'),

    // overlays
    lowTimeOverlay: $('lowTimeOverlay'),
    lowTimeNum: $('gj-lowtime-num'),
    endSummary: $('endSummary')
  };
}

function attachShootBridge(game) {
  // vr-ui.js emits: hha:shoot {x,y,lockPx,source}
  window.addEventListener('hha:shoot', (ev) => {
    try {
      const d = ev.detail || {};
      // Preferred: safe engine exposes onShoot(d) or shoot(d) etc.
      if (typeof game?.onShoot === 'function') return game.onShoot(d);
      if (typeof game?.shoot === 'function') return game.shoot(d);

      // Fallback: dispatch custom event for safe.js to pick up
      window.dispatchEvent(new CustomEvent('gj:shoot', { detail: d }));
    } catch (_) {}
  }, { passive: true });
}

(async function main(){
  try{
    const ctx = buildCtx();
    const viewApplied = applyViewClass(ctx.view);

    // hint to vr-ui strict crosshair mode for cVR
    if (viewApplied === 'cvr') {
      // vr-ui.js reads window.HHA_VRUI_CONFIG on load; but it's already loaded.
      // still OK: safe can choose to rely on body.view-cvr and hha:shoot events.
      document.body.classList.add('view-cvr');
    }

    // give layout a moment then measure safe
    requestAnimationFrame(()=>dispatchMeasureSafe());
    setTimeout(dispatchMeasureSafe, 120);

    const ui = grabUI();
    if(!ui.layer) throw new Error('Missing #gj-layer');

    const { factory } = await loadSafeModule();

    // Create game — support class or function
    let game;
    const opts = {
      ctx,
      ui,
      mount: ui.layer,
      mountR: ui.layerR,
      dispatchMeasureSafe
    };

    try{
      // if factory is a class
      game = new factory(opts);
    }catch(_){
      // if factory is a function
      game = await factory(opts);
    }

    if(!game) throw new Error('Safe factory returned empty game');

    // Bridge shooting for cVR / crosshair mode
    attachShootBridge(game);

    // Start
    if(typeof game.start === 'function') await game.start();
    else if(typeof game.boot === 'function') await game.boot();
    else {
      // last resort: emit event and hope safe.js auto-starts
      console.warn('[GoodJunkVR.boot] game has no start(); safe.js should auto start');
    }

    // measure again after start
    setTimeout(dispatchMeasureSafe, 0);
    setTimeout(dispatchMeasureSafe, 160);

    // Let other modules know boot OK
    window.dispatchEvent(new CustomEvent('hha:ready', { detail: { game: 'goodjunk', view: viewApplied, ctx } }));

  }catch(err){
    hardFail(String(err?.message || err || 'Unknown error'), err);
  }
})();