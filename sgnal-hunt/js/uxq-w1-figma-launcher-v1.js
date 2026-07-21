/* CSAI2601 UX Quest • W1 Persistent Figma Launcher v1
 * Front-end only. Ensures the Figma action is always visible before guided steps.
 */
(() => {
  'use strict';
  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const node = String(new URLSearchParams(location.search).get('node') || '').toUpperCase();
  if (node !== 'W1') return;

  function installStyle() {
    if (document.getElementById('uxq-w1-figma-launcher-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'uxq-w1-figma-launcher-style-v1';
    style.textContent = `
      .w1-figma-launcher{display:grid;gap:10px;margin:12px 0;padding:14px;border:1px solid rgba(110,231,255,.42);border-radius:16px;background:linear-gradient(135deg,rgba(20,76,125,.34),rgba(45,32,105,.32));box-shadow:0 12px 32px rgba(0,0,0,.18)}
      .w1-figma-launcher__head{display:flex;gap:11px;align-items:flex-start}.w1-figma-launcher__icon{width:44px;height:44px;min-width:44px;border-radius:13px;display:grid;place-items:center;background:rgba(255,255,255,.1);font-size:1.45rem}
      .w1-figma-launcher h3{margin:0;font-size:1.08rem;color:#fff}.w1-figma-launcher p{margin:4px 0 0;color:#c9d8f1;line-height:1.48;font-size:.84rem}
      .w1-figma-launcher__actions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.w1-figma-launcher__open{display:grid;place-items:center;min-height:46px;padding:10px 16px;border-radius:12px;background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124;text-decoration:none;font-weight:950;font-size:.95rem}.w1-figma-launcher__note{font-size:.74rem;color:#b7c9e7}
      .w1-figma-launcher__frames{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.w1-figma-launcher__frames span{padding:8px;border:1px solid rgba(181,205,255,.2);border-radius:10px;background:rgba(3,13,31,.34);font-size:.72rem;line-height:1.35;color:#d9e6fa;text-align:center}
      @media(max-width:760px){.w1-figma-launcher{padding:12px;margin:10px 0}.w1-figma-launcher__actions{grid-template-columns:1fr}.w1-figma-launcher__note{text-align:center}.w1-figma-launcher__frames{grid-template-columns:1fr}.w1-figma-launcher__open{position:sticky;top:8px;z-index:19}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    installStyle();
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact || artifact.querySelector('.w1-figma-launcher')) return;
    const head = artifact.querySelector('.studio-head');
    if (!head) return;

    const box = document.createElement('section');
    box.className = 'w1-figma-launcher';
    box.innerHTML = `
      <div class="w1-figma-launcher__head">
        <div class="w1-figma-launcher__icon">🎨</div>
        <div><h3>เริ่ม Studio W1 ใน Figma</h3><p>สร้างไฟล์ใหม่ชื่อ <b>W1-UX-Audit-รหัสนักศึกษา</b> แล้วทำ Board 3 Frames ตามโจทย์ด้านล่าง</p></div>
      </div>
      <div class="w1-figma-launcher__frames">
        <span><b>Frame A</b><br>User + Task + Context</span>
        <span><b>Frame B</b><br>Friction + Evidence</span>
        <span><b>Frame C</b><br>Impact + Fix + Test</span>
      </div>
      <div class="w1-figma-launcher__actions">
        <a class="w1-figma-launcher__open" href="https://www.figma.com/files/" target="_blank" rel="noopener noreferrer">เปิด Figma เพื่อสร้างไฟล์ใหม่ ↗</a>
        <span class="w1-figma-launcher__note">Figma → New design file</span>
      </div>`;
    head.insertAdjacentElement('afterend', box);
  }

  let timer;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(mount, 80); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once:true});
  else schedule();
  new MutationObserver(schedule).observe(ROOT, {childList:true, subtree:true});
  window.UXQW1FigmaLauncherV1 = Object.freeze({mount, version:'20260721-W1-FIGMA-LAUNCHER-V1'});
})();