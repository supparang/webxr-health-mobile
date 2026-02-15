// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR boot — v20260215
// ✅ Sets body class: view-pc / view-mobile / view-cvr
// ✅ Supports ?debug=1 (shows boot panel + forwards to engine)
// ✅ Safe import: if engine fails, show error panel (do not white-screen)
// ✅ Works with ../vr/vr-ui.js (emits hha:shoot) immediately
'use strict';

function qs(k, d = null) {
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
}
function normView(v) {
  v = String(v || '').toLowerCase();
  if (v === 'cvr' || v === 'cardboard' || v === 'stereo') return 'cvr';
  if (v === 'pc' || v === 'desktop') return 'pc';
  return 'mobile';
}
function setBodyViewClass(view) {
  const b = document.body;
  if (!b) return;
  b.classList.remove('view-pc', 'view-mobile', 'view-cvr');
  b.classList.add(view === 'pc' ? 'view-pc' : view === 'cvr' ? 'view-cvr' : 'view-mobile');
}

function isDebug() {
  const v = String(qs('debug', '') || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function ensureBootPanel() {
  if (!isDebug()) return null;
  let el = document.getElementById('gjBootDbg');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'gjBootDbg';
  el.style.position = 'fixed';
  el.style.top = 'calc(10px + env(safe-area-inset-top, 0px))';
  el.style.right = 'calc(10px + env(safe-area-inset-right, 0px))';
  el.style.zIndex = '9999';
  el.style.width = 'min(520px, 92vw)';
  el.style.maxHeight = '40vh';
  el.style.overflow = 'auto';
  el.style.padding = '10px 12px';
  el.style.border = '1px solid rgba(148,163,184,.18)';
  el.style.borderRadius = '18px';
  el.style.background = 'rgba(2,6,23,.78)';
  el.style.backdropFilter = 'blur(6px)';
  el.style.color = '#e5e7eb';
  el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  el.style.fontSize = '11px';
  el.style.lineHeight = '1.35';
  el.style.boxShadow = '0 18px 60px rgba(0,0,0,.45)';

  el.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
      <div style="font-weight:1000;">GoodJunkVR Boot Debug</div>
      <button id="gjBootDbgClose" style="pointer-events:auto;font-weight:1000;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.35);color:#e5e7eb;border-radius:12px;padding:6px 10px;cursor:pointer;">close</button>
    </div>
    <div id="gjBootDbgBody" style="margin-top:8px;white-space:pre-wrap;"></div>
  `;
  document.body.appendChild(el);

  const btn = document.getElementById('gjBootDbgClose');
  if (btn) btn.addEventListener('click', () => { try { el.remove(); } catch { } });

  return el;
}

function bootDbg(line) {
  const panel = ensureBootPanel();
  if (!panel) return;
  const body = document.getElementById('gjBootDbgBody');
  if (!body) return;
  const t = new Date();
  const stamp = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
  body.textContent = `${stamp}  ${line}\n` + body.textContent;
}

function showFatal(title, detail) {
  const ov = document.createElement('div');
  ov.style.position = 'fixed';
  ov.style.inset = '0';
  ov.style.zIndex = '99999';
  ov.style.display = 'grid';
  ov.style.placeItems = 'center';
  ov.style.padding = '24px';
  ov.style.background = 'rgba(2,6,23,.78)';
  ov.style.backdropFilter = 'blur(6px)';

  const card = document.createElement('div');
  card.style.width = 'min(720px, 92vw)';
  card.style.border = '1px solid rgba(148,163,184,.18)';
  card.style.borderRadius = '22px';
  card.style.background = 'linear-gradient(180deg, rgba(2,6,23,.92), rgba(2,6,23,.70))';
  card.style.boxShadow = '0 18px 60px rgba(0,0,0,.45)';
  card.style.padding = '16px';
  card.style.color = '#e5e7eb';

  const hub = String(qs('hub', '../hub.html') || '../hub.html');

  card.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <div style="font-weight:1000;">${title || 'GoodJunkVR — Error'}</div>
      <a href="${hub}" style="margin-left:auto;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.35);font-weight:1000;color:#e5e7eb;text-decoration:none;">กลับ HUB</a>
    </div>
    <div style="margin-top:8px;color:rgba(229,231,235,.82);font-weight:850;font-size:12px;line-height:1.35;">
      ตัวเกมโหลดไม่สำเร็จ แต่หน้าไม่พัง ✅ ดูรายละเอียดด้านล่างแล้วแก้ path/ไฟล์ได้เลย
    </div>
    <pre style="margin-top:12px;white-space:pre-wrap;word-break:break-word;
      border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.35);
      border-radius:16px;padding:10px 12px;font-size:11px;line-height:1.35;">${String(detail || '').replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}</pre>
    <div style="margin-top:12px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
      <button id="gjReload" style="pointer-events:auto;font-weight:1000;padding:10px 14px;border-radius:14px;border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.18);color:#e5e7eb;cursor:pointer;">Reload</button>
      <button id="gjCopy" style="pointer-events:auto;font-weight:1000;padding:10px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.35);color:#e5e7eb;cursor:pointer;">Copy log</button>
    </div>
  `;
  ov.appendChild(card);
  document.body.appendChild(ov);

  const btnR = card.querySelector('#gjReload');
  if (btnR) btnR.addEventListener('click', () => location.reload());

  const btnC = card.querySelector('#gjCopy');
  if (btnC) btnC.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(String(detail || ''));
      btnC.textContent = 'Copied ✅';
      setTimeout(() => btnC.textContent = 'Copy log', 900);
    } catch {
      btnC.textContent = 'Copy failed';
      setTimeout(() => btnC.textContent = 'Copy log', 900);
    }
  });
}

async function main() {
  // --- read params ---
  const view = normView(qs('view', 'mobile'));
  const run = String(qs('run', 'play')).toLowerCase() || 'play';
  const diff = String(qs('diff', 'normal')).toLowerCase() || 'normal';
  const time = Number(qs('time', '80')) || 80;
  const seed = String(qs('seed', String(Date.now())));
  const hub = String(qs('hub', '../hub.html') || '../hub.html');
  const pid = String(qs('pid', '') || '');

  // --- set class early (so CSS layout correct) ---
  setBodyViewClass(view);

  bootDbg(`params: view=${view} run=${run} diff=${diff} time=${time} seed=${seed} pid=${pid || 'anon'}`);
  bootDbg(`hub=${hub}`);

  // --- sanity: required DOM ids exist ---
  const layerL = document.getElementById('gj-layer');
  if (!layerL) {
    showFatal('GoodJunkVR — Missing layer', 'Missing element #gj-layer. Ensure goodjunk-vr.html has <div id="gj-layer">');
    return;
  }

  // --- load engine safely ---
  try {
    const mod = await import('./goodjunk.safe.js');
    if (!mod || typeof mod.boot !== 'function') {
      showFatal('GoodJunkVR — Import failed', 'Imported ./goodjunk.safe.js but export { boot } was not found.');
      return;
    }

    bootDbg('engine imported OK: ./goodjunk.safe.js');

    const opts = {
      view, run, diff,
      time,
      seed,
      hub,
      pid,
      layerL,
      layerR: document.getElementById('gj-layer-r') || null
    };

    mod.boot(opts);
    bootDbg('engine.boot() called ✅');

  } catch (err) {
    const msg = [
      'FAILED to import/boot engine:',
      (err && err.stack) ? err.stack : String(err),
      '',
      'CHECK:',
      '- file path: /herohealth/vr-goodjunk/goodjunk.safe.js exists and is valid JS module',
      '- goodjunk-vr.html uses: <script type="module" src="./goodjunk-vr.boot.js"></script>',
      '- any import inside goodjunk.safe.js resolves (../vr/food5-th.js, ../badges.safe.js)',
      '- GitHub Pages cached old build? try hard reload'
    ].join('\n');
    bootDbg('ERROR: ' + String(err));
    showFatal('GoodJunkVR — Boot Error', msg);
  }
}

// run
main();