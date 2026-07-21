/* CSAI2601 UX Quest • W1 Persistent Figma Launcher v2
 * Front-end only. Keeps Open Figma, paste URL, validation and link preview together.
 * Mirrors the canonical figmaUrl field; no duplicate submission data is created.
 */
(() => {
  'use strict';
  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const node = String(new URLSearchParams(location.search).get('node') || '').toUpperCase();
  if (node !== 'W1') return;

  function installStyle() {
    if (document.getElementById('uxq-w1-figma-launcher-style-v2')) return;
    const style = document.createElement('style');
    style.id = 'uxq-w1-figma-launcher-style-v2';
    style.textContent = `
      .w1-figma-launcher{display:grid;gap:11px;margin:12px 0;padding:14px;border:1px solid rgba(110,231,255,.42);border-radius:16px;background:linear-gradient(135deg,rgba(20,76,125,.34),rgba(45,32,105,.32));box-shadow:0 12px 32px rgba(0,0,0,.18)}
      .w1-figma-launcher__head{display:flex;gap:11px;align-items:flex-start}.w1-figma-launcher__icon{width:44px;height:44px;min-width:44px;border-radius:13px;display:grid;place-items:center;background:rgba(255,255,255,.1);font-size:1.45rem}
      .w1-figma-launcher h3{margin:0;font-size:1.08rem;color:#fff}.w1-figma-launcher p{margin:4px 0 0;color:#c9d8f1;line-height:1.48;font-size:.84rem}
      .w1-figma-launcher__actions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.w1-figma-launcher__open{display:grid;place-items:center;min-height:46px;padding:10px 16px;border-radius:12px;background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124;text-decoration:none;font-weight:950;font-size:.95rem}.w1-figma-launcher__note{font-size:.74rem;color:#b7c9e7}
      .w1-figma-launcher__frames{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.w1-figma-launcher__frames span{padding:8px;border:1px solid rgba(181,205,255,.2);border-radius:10px;background:rgba(3,13,31,.34);font-size:.72rem;line-height:1.35;color:#d9e6fa;text-align:center}
      .w1-figma-linkbox{display:grid;gap:7px;padding:11px;border:1px solid rgba(181,205,255,.25);border-radius:13px;background:rgba(3,13,31,.45)}
      .w1-figma-linkbox label{font-weight:900;color:#fff;font-size:.88rem}.w1-figma-linkbox small{color:#afc2df;line-height:1.4}
      .w1-figma-linkbox__row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.w1-figma-linkbox input{width:100%;min-height:45px;padding:10px 12px;border:1px solid rgba(181,205,255,.35);border-radius:11px;background:#07152f;color:#fff;font:inherit;font-size:.88rem;outline:none}.w1-figma-linkbox input:focus{border-color:#6ee7ff;box-shadow:0 0 0 3px rgba(110,231,255,.12)}
      .w1-figma-linkbox__check{min-height:45px;padding:9px 12px;border:1px solid rgba(110,231,255,.38);border-radius:11px;background:rgba(110,231,255,.12);color:#eaf8ff;font:inherit;font-weight:900;cursor:pointer}.w1-figma-linkbox__check:disabled{opacity:.4;cursor:not-allowed}
      .w1-figma-linkbox__status{padding:8px 10px;border-radius:10px;font-size:.8rem;font-weight:850;background:rgba(255,209,102,.09);color:#ffe3a0;border:1px solid rgba(255,209,102,.3)}
      .w1-figma-linkbox__status[data-state='ok']{background:rgba(121,237,165,.09);color:#8ff2ba;border-color:rgba(121,237,165,.35)}
      .w1-figma-linkbox__status[data-state='bad']{background:rgba(255,119,145,.09);color:#ff9fb2;border-color:rgba(255,119,145,.35)}
      @media(max-width:760px){.w1-figma-launcher{padding:12px;margin:10px 0}.w1-figma-launcher__actions,.w1-figma-linkbox__row{grid-template-columns:1fr}.w1-figma-launcher__note{text-align:center}.w1-figma-launcher__frames{grid-template-columns:1fr}.w1-figma-launcher__open{position:sticky;top:8px;z-index:19}.w1-figma-linkbox input{font-size:1rem}}
    `;
    document.head.appendChild(style);
  }

  function canonicalField() {
    return ROOT.querySelector('[data-studio-key="figmaUrl"]');
  }

  function isValidFigmaUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'https:' && /(^|\.)figma\.com$/i.test(url.hostname);
    } catch (_) {
      return false;
    }
  }

  function updateStatus(box, value) {
    const status = box.querySelector('.w1-figma-linkbox__status');
    const check = box.querySelector('.w1-figma-linkbox__check');
    const clean = String(value || '').trim();
    if (!clean) {
      status.dataset.state = '';
      status.textContent = '⏳ ยังไม่ได้วางลิงก์ Figma';
      check.disabled = true;
      return;
    }
    if (!isValidFigmaUrl(clean)) {
      status.dataset.state = 'bad';
      status.textContent = '✕ URL ไม่ถูกต้อง ต้องเป็นลิงก์ https://www.figma.com/...';
      check.disabled = true;
      return;
    }
    status.dataset.state = 'ok';
    status.textContent = '✓ ลิงก์ Figma พร้อมส่ง และเชื่อมกับฟอร์มแล้ว';
    check.disabled = false;
  }

  function wire(box) {
    const input = box.querySelector('.w1-figma-linkbox__input');
    const check = box.querySelector('.w1-figma-linkbox__check');
    const canonical = canonicalField();
    if (!canonical) return false;

    input.value = canonical.value || '';
    updateStatus(box, input.value);

    const syncToCanonical = () => {
      canonical.value = input.value;
      canonical.dispatchEvent(new Event('input', { bubbles:true }));
      canonical.dispatchEvent(new Event('change', { bubbles:true }));
      updateStatus(box, input.value);
    };
    input.addEventListener('input', syncToCanonical);
    input.addEventListener('paste', () => setTimeout(syncToCanonical, 0));
    canonical.addEventListener('input', () => {
      if (input.value !== canonical.value) input.value = canonical.value || '';
      updateStatus(box, input.value);
    });
    check.addEventListener('click', () => {
      if (!isValidFigmaUrl(input.value)) return;
      window.open(String(input.value).trim(), '_blank', 'noopener,noreferrer');
    });
    return true;
  }

  function mount() {
    installStyle();
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact) return;
    const existing = artifact.querySelector('.w1-figma-launcher');
    if (existing) {
      if (!existing.dataset.wired) {
        existing.dataset.wired = wire(existing) ? '1' : '';
      }
      return;
    }
    const head = artifact.querySelector('.studio-head');
    if (!head) return;

    const box = document.createElement('section');
    box.className = 'w1-figma-launcher';
    box.innerHTML = `
      <div class="w1-figma-launcher__head">
        <div class="w1-figma-launcher__icon">🎨</div>
        <div><h3>เริ่ม Studio W1 ใน Figma</h3><p>สร้างไฟล์ใหม่ชื่อ <b>W1-UX-Audit-รหัสนักศึกษา</b> แล้วทำ Board 3 Frames จากนั้นกลับมาวาง Share URL ด้านล่าง</p></div>
      </div>
      <div class="w1-figma-launcher__frames">
        <span><b>Frame A</b><br>User + Task + Context</span>
        <span><b>Frame B</b><br>Friction + Evidence</span>
        <span><b>Frame C</b><br>Impact + Fix + Test</span>
      </div>
      <div class="w1-figma-launcher__actions">
        <a class="w1-figma-launcher__open" href="https://www.figma.com/files/" target="_blank" rel="noopener noreferrer">1. เปิด Figma เพื่อสร้างไฟล์ใหม่ ↗</a>
        <span class="w1-figma-launcher__note">Figma → New design file</span>
      </div>
      <div class="w1-figma-linkbox">
        <label for="w1FigmaQuickUrl">2. กลับมาวาง Figma Share URL ที่นี่</label>
        <small>ใน Figma กด Share → Copy link แล้ววาง ระบบจะใช้ช่องเดียวกับข้อมูลส่งงานจริง</small>
        <div class="w1-figma-linkbox__row">
          <input id="w1FigmaQuickUrl" class="w1-figma-linkbox__input" type="url" inputmode="url" autocomplete="url" placeholder="https://www.figma.com/design/...">
          <button type="button" class="w1-figma-linkbox__check" disabled>เปิดตรวจลิงก์นี้ ↗</button>
        </div>
        <div class="w1-figma-linkbox__status" role="status" aria-live="polite">⏳ ยังไม่ได้วางลิงก์ Figma</div>
      </div>`;
    head.insertAdjacentElement('afterend', box);
    box.dataset.wired = wire(box) ? '1' : '';
  }

  let timer;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(mount, 80); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once:true});
  else schedule();
  new MutationObserver(schedule).observe(ROOT, {childList:true, subtree:true});
  window.UXQW1FigmaLauncherV1 = Object.freeze({mount, isValidFigmaUrl, version:'20260721-W1-FIGMA-LAUNCHER-V2'});
})();