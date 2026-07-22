/* CSAI2601 UX Quest • Project + Figma Access Authority v1
 * Guarantees visible Project/Figma controls for W1-W15 + B1-B4.
 * Syncs directly with the canonical figmaUrl field used by validation and submit.
 */
(() => {
  'use strict';

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const PARAMS = new URLSearchParams(location.search || '');
  const NODE_ID = String(PARAMS.get('node') || PARAMS.get('id') || 'W1').trim().toUpperCase();
  if (!/^(W(?:[1-9]|1[0-5])|B[1-4])$/.test(NODE_ID)) return;

  const IS_W1 = NODE_ID === 'W1';
  const IS_BOSS = /^B[1-4]$/.test(NODE_ID);
  const FIGMA_RE = /^https:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|board|slides|make)\//i;
  const VERSION = '20260722-PROJECT-FIGMA-ACCESS-AUTHORITY-V1';

  function identityKey() {
    let profile = {};
    try { profile = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    const studentId = String(profile.studentId || PARAMS.get('studentId') || PARAMS.get('sid') || 'anonymous').trim();
    const section = String(profile.section || PARAMS.get('section') || 'default').trim();
    return `${studentId}::${section}`;
  }

  const masterKey = () => `uxq.csai2601.masterFigma.authority.v1.${identityKey()}`;
  function valid(value) { return FIGMA_RE.test(String(value || '').trim()); }
  function readMaster() {
    try {
      const value = String(localStorage.getItem(masterKey()) || '').trim();
      return valid(value) ? value : '';
    } catch (_) { return ''; }
  }
  function saveMaster(value) {
    const clean = String(value || '').trim();
    if (!valid(clean)) return;
    try { localStorage.setItem(masterKey(), clean); } catch (_) {}
  }

  function installStyle() {
    if (document.getElementById('uxq-project-figma-authority-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'uxq-project-figma-authority-style-v1';
    style.textContent = `
      .uxq-project-access{display:grid;gap:12px;margin:14px 0;padding:15px;border:1px solid rgba(110,231,255,.48);border-radius:17px;background:linear-gradient(135deg,rgba(16,56,105,.52),rgba(38,28,92,.42));box-shadow:0 16px 34px rgba(0,0,0,.2)}
      .uxq-project-access__head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.uxq-project-access__head h3{margin:0;color:#fff}.uxq-project-access__head p{margin:4px 0 0;color:#c9d9ef;line-height:1.5}.uxq-project-access__badge{white-space:nowrap;padding:5px 9px;border-radius:999px;background:rgba(110,231,255,.12);color:#c9f8ff;font-size:.72rem;font-weight:900}
      .uxq-project-access__grid{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(0,1.35fr);gap:12px;align-items:end}.uxq-project-access__field{display:grid;gap:6px}.uxq-project-access__field label{font-weight:900;color:#fff}.uxq-project-access__field input{width:100%;min-height:48px;padding:10px 12px;border:1px solid rgba(181,205,255,.34);border-radius:12px;background:#07142e;color:#fff;font:inherit;box-sizing:border-box}
      .uxq-project-access__actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.uxq-project-access__button{display:grid;place-items:center;min-height:46px;padding:10px 13px;border-radius:12px;text-decoration:none;font-weight:950}.uxq-project-access__button.primary{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}.uxq-project-access__button.secondary{border:1px solid rgba(110,231,255,.38);color:#e2eeff;background:rgba(255,255,255,.04)}.uxq-project-access__button[aria-disabled='true']{opacity:.45;pointer-events:none}
      .uxq-project-access__status{padding:8px 10px;border-radius:10px;font-size:.79rem}.uxq-project-access__status[data-state='ok']{color:#82efb4;background:rgba(82,224,147,.1)}.uxq-project-access__status[data-state='bad']{color:#ffabb8;background:rgba(255,91,115,.1)}.uxq-project-access__status[data-state='empty']{color:#ffd98a;background:rgba(255,209,102,.08)}
      @media(max-width:760px){.uxq-project-access__head{display:block}.uxq-project-access__badge{display:inline-block;margin-top:8px}.uxq-project-access__grid{grid-template-columns:1fr}.uxq-project-access__actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function canonicalFields(artifact) {
    let project = artifact.querySelector('[data-studio-key="projectId"]');
    let figma = artifact.querySelector('[data-studio-key="figmaUrl"]');

    if (!project) {
      project = document.createElement('textarea');
      project.hidden = true;
      project.dataset.studioKey = 'projectId';
      project.dataset.studioLabel = IS_W1 ? 'Master Project ID' : 'Master Project ID เดิม';
      project.dataset.required = '1';
      project.dataset.minLength = '4';
      project.dataset.format = 'text';
      artifact.appendChild(project);
    }
    if (!figma) {
      figma = document.createElement('textarea');
      figma.hidden = true;
      figma.dataset.studioKey = 'figmaUrl';
      figma.dataset.studioLabel = IS_W1 ? 'Master Figma Project URL' : 'Project / Evidence URL';
      figma.dataset.required = '1';
      figma.dataset.minLength = '0';
      figma.dataset.format = 'url';
      artifact.appendChild(figma);
    }
    return { project, figma };
  }

  function copyForNode() {
    if (IS_W1) return {
      title:'สร้าง Master Figma Project ครั้งเดียว',
      text:'สร้าง Project หลักใน W1 แล้วใช้ Project เดิมต่อเนื่องถึง W15',
      button:'สร้าง Master Figma Project',
      badge:'W1 • CREATE'
    };
    if (IS_BOSS) return {
      title:`ใช้ Master Project เดิมสำหรับ ${NODE_ID} Defense`,
      text:'เปิด Project เดิม รวบรวมหลักฐานจาก Weeks ก่อนหน้า และเพิ่ม Defense Section โดยไม่สร้าง Project ใหม่',
      button:'เปิด Master Project เดิม',
      badge:`${NODE_ID} • DEFENSE`
    };
    return {
      title:`เปิด Master Project เดิมและเพิ่ม Page / Section สำหรับ ${NODE_ID}`,
      text:'ต่อยอด Artifact จากสัปดาห์ก่อนหน้าใน Project เดิม ห้ามสร้าง Project ใหม่',
      button:'เปิด Master Project เดิม',
      badge:`${NODE_ID} • REUSE`
    };
  }

  function mount() {
    installStyle();
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact) return;
    const { project, figma } = canonicalFields(artifact);
    let box = artifact.querySelector(':scope > .uxq-project-access');
    if (!box) {
      const copy = copyForNode();
      box = document.createElement('section');
      box.className = 'uxq-project-access';
      box.innerHTML = `
        <div class="uxq-project-access__head">
          <div><h3>${copy.title}</h3><p>${copy.text}</p></div>
          <span class="uxq-project-access__badge">${copy.badge}</span>
        </div>
        <div class="uxq-project-access__grid">
          <div class="uxq-project-access__field">
            <label for="uxqAuthorityProjectId">${IS_W1 ? 'Master Project ID' : 'Master Project ID เดิม'}</label>
            <input id="uxqAuthorityProjectId" type="text" autocomplete="off" placeholder="${IS_W1 ? 'เช่น UX2601-รหัสนักศึกษา' : 'ใช้รหัสเดียวกับ W1'}">
          </div>
          <div class="uxq-project-access__field">
            <label for="uxqAuthorityFigmaUrl">${IS_W1 ? 'Master Figma Project URL' : 'Project / Evidence URL'}</label>
            <input id="uxqAuthorityFigmaUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://www.figma.com/design/...">
          </div>
        </div>
        <div class="uxq-project-access__actions">
          <a class="uxq-project-access__button primary" data-open-figma target="_blank" rel="noopener noreferrer">${copy.button} ↗</a>
          <a class="uxq-project-access__button secondary" data-open-current href="#" aria-disabled="true">เปิดลิงก์ที่วาง</a>
        </div>
        <div class="uxq-project-access__status" data-state="empty">ยังไม่ได้วางลิงก์ Figma</div>`;
      const head = artifact.querySelector('.studio-head');
      if (head) head.insertAdjacentElement('afterend', box); else artifact.prepend(box);
    }

    const projectInput = box.querySelector('#uxqAuthorityProjectId');
    const urlInput = box.querySelector('#uxqAuthorityFigmaUrl');
    const openFigma = box.querySelector('[data-open-figma]');
    const openCurrent = box.querySelector('[data-open-current]');
    const status = box.querySelector('.uxq-project-access__status');

    const remembered = readMaster();
    projectInput.value = String(project.value || '');
    if (!String(figma.value || '').trim() && !IS_W1 && remembered) figma.value = remembered;
    urlInput.value = String(figma.value || remembered || '');
    openFigma.href = IS_W1 ? 'https://www.figma.com/files/' : (remembered || 'https://www.figma.com/files/');

    const syncProject = source => {
      project.value = String(source.value || '');
      project.dispatchEvent(new Event('input', { bubbles:true }));
      project.dispatchEvent(new Event('change', { bubbles:true }));
    };
    const syncUrl = source => {
      const value = String(source.value || '').trim();
      figma.value = value;
      figma.dispatchEvent(new Event('input', { bubbles:true }));
      figma.dispatchEvent(new Event('change', { bubbles:true }));
      if (!value) {
        status.dataset.state = 'empty'; status.textContent = 'ยังไม่ได้วางลิงก์ Figma';
        openCurrent.href = '#'; openCurrent.setAttribute('aria-disabled','true');
      } else if (!valid(value)) {
        status.dataset.state = 'bad'; status.textContent = 'URL ไม่ถูกต้อง ต้องเป็นลิงก์ https://www.figma.com/...';
        openCurrent.href = '#'; openCurrent.setAttribute('aria-disabled','true');
      } else {
        status.dataset.state = 'ok';
        status.textContent = IS_W1 ? 'Master Figma Project พร้อมใช้ต่อเนื่อง W1–W15' : 'Project / Evidence URL พร้อมใช้และพร้อมส่ง';
        openCurrent.href = value; openCurrent.target = '_blank'; openCurrent.rel = 'noopener noreferrer'; openCurrent.removeAttribute('aria-disabled');
        saveMaster(value);
        if (!IS_W1) openFigma.href = value;
      }
    };

    if (box.dataset.bound !== '1') {
      box.dataset.bound = '1';
      projectInput.addEventListener('input', () => syncProject(projectInput));
      urlInput.addEventListener('input', () => syncUrl(urlInput));
      openCurrent.addEventListener('click', event => {
        if (openCurrent.getAttribute('aria-disabled') === 'true') event.preventDefault();
      });
    }
    syncProject(projectInput);
    syncUrl(urlInput);
  }

  let timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(mount, 70); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true }); else schedule();
  new MutationObserver(schedule).observe(ROOT, { childList:true, subtree:true });
  window.addEventListener('uxq-mission-resume-studio', schedule);
  window.addEventListener('uxq-direct-studio-confirmed', schedule);
  window.addEventListener('uxq-studio-production-rewrite-ready', schedule);

  window.UXQProjectFigmaAccessAuthorityV1 = Object.freeze({ mount, readMaster, saveMaster, version:VERSION });
})();