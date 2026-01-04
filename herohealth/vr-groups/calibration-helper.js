/* === /herohealth/vr-groups/calibration-helper.js ===
Pack13: Calibration/Recenter helper for Cardboard (cVR)
- Shows overlay guide (safe, simple)
- Can force recenter (best-effort: clicks vr-ui recenter if found + dispatch event)
- Remembers "calibrated" in localStorage (per device)
- API:
    window.GroupsVR.Calibration.waitIfNeeded({view}) -> Promise<void>
    window.GroupsVR.Calibration.forceShow()
*/

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const KEY = 'HHA_GROUPS_CVR_CALIBRATED_AT';

  function qs(k, def = null) {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function isCVR(view) {
    view = String(view || '').toLowerCase();
    if (view.includes('cvr')) return true;
    const b = DOC.body;
    const cls = b && b.className ? b.className : '';
    return cls.includes('view-cvr');
  }

  function shouldShow(view) {
    if (!isCVR(view)) return false;

    const force = String(qs('calib', '0') || '0');
    if (force === '1' || force === 'true') return true;

    // show if never calibrated (or very old)
    let at = 0;
    try { at = Number(localStorage.getItem(KEY) || '0') || 0; } catch {}
    const ageDays = (Date.now() - at) / (1000 * 60 * 60 * 24);
    if (!at) return true;
    if (ageDays > 30) return true; // re-check monthly
    return false;
  }

  function ensureStyle() {
    if (DOC.getElementById('cvrCalibStyle')) return;
    const st = DOC.createElement('style');
    st.id = 'cvrCalibStyle';
    st.textContent = `
      .cvrCalib{
        position:fixed; inset:0;
        z-index:160;
        display:flex; align-items:center; justify-content:center;
        background: rgba(2,6,23,.78);
        backdrop-filter: blur(10px);
        padding: 18px;
      }
      .cvrCalib.hidden{ display:none; }
      .cvrCalib .panel{
        width:min(560px, 100%);
        border-radius: 26px;
        border: 1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.86);
        box-shadow: 0 24px 70px rgba(0,0,0,.55);
        padding: 16px;
      }
      .cvrCalib .title{
        font: 1000 18px/1.1 system-ui;
        letter-spacing:.2px;
      }
      .cvrCalib .sub{
        margin-top: 8px;
        color: rgba(148,163,184,.92);
        font: 800 13px/1.35 system-ui;
      }
      .cvrCalib .steps{
        margin-top: 12px;
        display:grid; gap: 8px;
      }
      .cvrCalib .step{
        padding: 10px 12px;
        border-radius: 18px;
        background: rgba(15,23,42,.62);
        border: 1px solid rgba(148,163,184,.16);
        font: 850 13px/1.35 system-ui;
      }
      .cvrCalib .row{
        margin-top: 12px;
        display:flex; gap: 10px;
      }
      .cvrCalib .btn{
        flex:1 1 auto;
        display:inline-flex; align-items:center; justify-content:center;
        gap:8px;
        padding: 12px 12px;
        border-radius: 18px;
        border: 1px solid rgba(148,163,184,.20);
        background: rgba(15,23,42,.65);
        color: #e5e7eb;
        font-weight: 1000;
        cursor:pointer;
      }
      .cvrCalib .btn-strong{
        background: rgba(34,197,94,.20);
        border-color: rgba(34,197,94,.35);
      }
      .cvrCalib .hint{
        margin-top: 10px;
        color: rgba(148,163,184,.92);
        font: 800 12px/1.35 system-ui;
      }
    `;
    DOC.head.appendChild(st);
  }

  function bestEffortRecenter() {
    // 1) dispatch event
    try { root.dispatchEvent(new CustomEvent('hha:recenter', { detail: { ts: Date.now() } })); } catch {}

    // 2) click vr-ui recenter button if exists
    const candidates = [
      '.hha-vr-ui button[data-act="recenter"]',
      '.hha-vr-ui .btn-recenter',
      '.hha-vr-ui .recenter',
      '.hha-vr-ui button[aria-label*="RECENTER"]',
      '.hha-vr-ui button'
    ];
    for (const sel of candidates) {
      const el = DOC.querySelector(sel);
      if (el && el.click) { try { el.click(); return true; } catch {} }
    }

    // 3) A-Frame try (best-effort)
    try {
      const scene = DOC.querySelector('a-scene');
      if (scene && scene.emit) scene.emit('recenter');
    } catch {}

    return false;
  }

  function createOverlay() {
    ensureStyle();
    let wrap = DOC.getElementById('cvrCalib');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.id = 'cvrCalib';
    wrap.className = 'cvrCalib hidden';
    wrap.innerHTML = `
      <div class="panel">
        <div class="title">🧭 Calibration (Cardboard)</div>
        <div class="sub">
          ตั้งศูนย์ให้ภาพนิ่งและยิงจาก crosshair ตรงที่สุด (ทำครั้งแรก/เดือนละครั้งก็พอ)
        </div>

        <div class="steps">
          <div class="step">1) หมุนมือถือเป็นแนวนอน + เปิด Fullscreen (ถ้าได้)</div>
          <div class="step">2) วางมือถือใน Cardboard ให้แน่น ไม่โยก</div>
          <div class="step">3) มองไป “จุดกึ่งกลาง” แล้วกด RECENTER</div>
          <div class="step">4) ทดลองยิง 2–3 ครั้ง (ฝึก 15 วิจะเริ่มต่อทันที)</div>
        </div>

        <div class="row">
          <button id="btnCalibRecenter" class="btn" type="button">🎯 RECENTER ตอนนี้</button>
          <button id="btnCalibDone" class="btn btn-strong" type="button">✅ พร้อมเล่น</button>
        </div>

        <div class="hint">
          ทิป: ถ้า crosshair ลอย/เอียง ให้กด RECENTER อีกครั้งหลัง “หยุดมือ” 1 วิ
        </div>
      </div>
    `;
    DOC.body.appendChild(wrap);

    const btnR = wrap.querySelector('#btnCalibRecenter');
    const btnD = wrap.querySelector('#btnCalibDone');

    if (btnR) btnR.addEventListener('click', () => { bestEffortRecenter(); });
    if (btnD) btnD.addEventListener('click', () => {
      try { localStorage.setItem(KEY, String(Date.now())); } catch {}
      wrap.classList.add('hidden');
      try { wrap.dispatchEvent(new CustomEvent('cvr:calib:done')); } catch {}
    });

    // tap backdrop to close? (no — keep explicit, safer)
    return wrap;
  }

  function showOverlay() {
    const wrap = createOverlay();
    wrap.classList.remove('hidden');
    // auto recenter once on open (best-effort)
    setTimeout(() => { bestEffortRecenter(); }, 220);
    return wrap;
  }

  NS.Calibration = {
    forceShow() { showOverlay(); },
    waitIfNeeded({ view } = {}) {
      return new Promise((resolve) => {
        if (!shouldShow(view)) return resolve();

        const wrap = showOverlay();
        const onDone = () => {
          try { wrap.removeEventListener('cvr:calib:done', onDone); } catch {}
          resolve();
        };
        wrap.addEventListener('cvr:calib:done', onDone, { once: true });

        // fallback: if user never clicks done, allow continue after 25s (avoid deadlock)
        setTimeout(() => { resolve(); }, 25000);
      });
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);