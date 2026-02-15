// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION SAFE (v20260215)
// เป้าหมาย:
// ✅ รันได้จริงทุกโหมด (pc/mobile/cvr/cardboard)
// ✅ ตั้ง class ให้ body: view-pc / view-mobile / view-cvr
// ✅ รองรับ ?debug=1 (โชว์ badge เล็ก + ส่ง opts.debug ให้เกม)
// ✅ กันพังถ้า import fail (ขึ้น error panel + ปุ่ม reload/back hub)
// ✅ ยิง crosshair จาก vr-ui.js ได้ทันที (vr-ui.js emits hha:shoot)

// NOTE: ให้ใส่ <script src="../vr/vr-ui.js"></script> ใน goodjunk-vr.html ก่อน boot นี้

'use strict';

function qs(k, d = null) {
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
}
function clamp(v, min, max) {
  v = Number(v);
  if (!Number.isFinite(v)) v = min;
  return Math.max(min, Math.min(max, v));
}
function asLower(v, d = '') {
  v = (v == null) ? d : String(v);
  v = v.trim().toLowerCase();
  return v || d;
}
function nowSeed() { return String(Date.now()); }

function applyViewClass(view) {
  const b = document.body;

  // wipe old
  b.classList.remove('view-pc', 'view-mobile', 'view-cvr');

  // normalize
  const v = (view === 'cardboard') ? 'cvr' : view;

  if (v === 'cvr') b.classList.add('view-cvr');
  else if (v === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showBootError(err, hubUrl) {
  const msg = (err && (err.stack || err.message))
    ? String(err.stack || err.message)
    : String(err);

  console.error('[GoodJunkVR boot error]', err);

  const ov = document.createElement('div');
  ov.id = 'gjBootError';
  ov.style.position = 'fixed';
  ov.style.inset = '0';
  ov.style.zIndex = '99999';
  ov.style.display = 'grid';
  ov.style.placeItems = 'center';
  ov.style.padding = '18px';
  ov.style.background = 'rgba(2,6,23,.72)';
  ov.style.backdropFilter = 'blur(6px)';

  const card = document.createElement('div');
  card.style.width = 'min(860px, 94vw)';
  card.style.border = '1px solid rgba(148,163,184,.18)';
  card.style.borderRadius = '22px';
  card.style.background = 'linear-gradient(180deg, rgba(2,6,23,.92), rgba(2,6,23,.70))';
  card.style.boxShadow = '0 18px 60px rgba(0,0,0,.45)';
  card.style.padding = '14px';

  card.innerHTML = `
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <div style="font-weight:1000; letter-spacing:.2px;">GoodJunkVR — Boot Error</div>
      <div style="margin-left:auto; font-weight:1000; font-size:12px; padding:6px 10px; border-radius:999px;
                  border:1px solid rgba(239,68,68,.30); background:rgba(239,68,68,.12); color:#e5e7eb;">
        IMPORT FAIL
      </div>
    </div>
    <div style="margin-top:8px; color:rgba(229,231,235,.82); font-weight:850; font-size:12px; line-height:1.35;">
      โหลดไฟล์ JS แบบ module ไม่สำเร็จ (path/ชื่อไฟล์ไม่ตรง หรือมี syntax error)
    </div>

    <div style="margin-top:10px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px;">
      <div style="border:1px solid rgba(148,163,184,.14); border-radius:16px; padding:10px 12px; background:rgba(2,6,23,.35);">
        <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">CHECKLIST</div>
        <div style="margin-top:6px; font-size:12px; color:rgba(229,231,235,.82); font-weight:800; line-height:1.35;">
          • เปิด DevTools → Console ดู error บรรทัดแรก<br/>
          • ตรวจ path: <code style="font-weight:900">./goodjunk.safe.js</code><br/>
          • ตรวจว่าไฟล์เป็น ES module (มี export boot)<br/>
          • ถ้ามี import จาก ../vr/food5-th.js ให้ path ถูก<br/>
        </div>
      </div>

      <div style="border:1px solid rgba(148,163,184,.14); border-radius:16px; padding:10px 12px; background:rgba(2,6,23,.35);">
        <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">ERROR</div>
        <pre style="margin:6px 0 0 0; white-space:pre-wrap; word-break:break-word;
                    color:rgba(229,231,235,.90); font-size:11px; font-weight:800; line-height:1.35;">${escapeHtml(msg)}</pre>
      </div>
    </div>

    <div style="margin-top:12px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
      <button id="gjBootReload"
        style="font-weight:1000; padding:10px 14px; border-radius:14px;
               border:1px solid rgba(148,163,184,.18); background:rgba(2,6,23,.35); color:#e5e7eb;">
        Reload
      </button>

      <button id="gjBootBack"
        style="font-weight:1000; padding:10px 14px; border-radius:14px;
               border:1px solid rgba(34,197,94,.35); background:rgba(34,197,94,.18); color:#e5e7eb;">
        กลับ HUB
      </button>
    </div>
  `;

  ov.appendChild(card);
  document.body.appendChild(ov);

  document.getElementById('gjBootReload')?.addEventListener('click', () => location.reload());
  document.getElementById('gjBootBack')?.addEventListener('click', () => { location.href = hubUrl; });
}

function ensureDebugBadge(debug) {
  if (!debug) return;
  try {
    if (document.getElementById('gjDebugBadge')) return;
    const b = document.createElement('div');
    b.id = 'gjDebugBadge';
    b.style.position = 'fixed';
    b.style.right = 'calc(10px + env(safe-area-inset-right, 0px))';
    b.style.bottom = 'calc(10px + env(safe-area-inset-bottom, 0px))';
    b.style.zIndex = '9999';
    b.style.padding = '8px 10px';
    b.style.borderRadius = '999px';
    b.style.border = '1px solid rgba(148,163,184,.18)';
    b.style.background = 'rgba(2,6,23,.55)';
    b.style.color = '#e5e7eb';
    b.style.fontWeight = '950';
    b.style.fontSize = '12px';
    b.textContent = 'debug=1';
    document.body.appendChild(b);
  } catch (_) {}
}

// ===== Read params =====
const view = asLower(qs('view', 'pc'), 'pc');           // pc|mobile|cvr|cardboard
const run  = asLower(qs('run', 'play'), 'play');        // play|research|study
const diff = asLower(qs('diff', 'normal'), 'normal');   // easy|normal|hard
const time = clamp(qs('time', '80'), 20, 300);
const seed = String(qs('seed', '') || nowSeed());
const hub  = String(qs('hub', '../hub.html') || '../hub.html');
const pid  = String(qs('pid', '') || '').trim();

const debug = (String(qs('debug', '0')) === '1');

// extras pass-through (เผื่อใช้ใน ecosystem / research later)
const log = String(qs('log', '') || '');
const studyId = String(qs('studyId', '') || '');
const phase = String(qs('phase', '') || '');
const conditionGroup = String(qs('conditionGroup', '') || '');

// ===== Apply view & debug =====
applyViewClass(view);
ensureDebugBadge(debug);

// ===== Ensure vr-ui exists (non-fatal) =====
try {
  // vr-ui.js typically sets window dispatchers; if missing, game still works via pointerdown targets
  if (!window || !document) throw new Error('no window');
} catch (_) {}

// ===== Boot module with hard guard =====
(async () => {
  try {
    const mod = await import('./goodjunk.safe.js');

    if (!mod || typeof mod.boot !== 'function') {
      throw new Error('goodjunk.safe.js loaded but export boot() not found');
    }

    // IMPORTANT:
    // vr-ui.js emits event: hha:shoot {x,y,lockPx}
    // goodjunk.safe.js ต้อง listen: window.addEventListener('hha:shoot', onShoot)
    // (คุณทำไว้แล้ว)

    const opts = {
      view,
      run,
      diff,
      time,
      seed,
      hub,
      pid,

      // debug flag (ให้ goodjunk.safe.js ใช้เปิด overlay)
      debug,

      // keep for future (safe if ignored)
      log,
      studyId,
      phase,
      conditionGroup
    };

    mod.boot(opts);

  } catch (err) {
    showBootError(err, hub);
  }
})();