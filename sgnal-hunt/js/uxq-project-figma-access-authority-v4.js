/* CSAI2601 UX Quest • Project/Figma/Evidence Authority v4
 * Persistent panel-first implementation for W1-W15 + B1-B4.
 * The visible panel is mounted after the three-part tracker independently of Studio renderer timing.
 * Canonical projectId/figmaUrl/evidenceUrl fields are synchronized when the real Studio form appears.
 */
(() => {
  'use strict';

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const PARAMS = new URLSearchParams(location.search || '');
  const NODE = String(PARAMS.get('node') || PARAMS.get('id') || 'W1').trim().toUpperCase();
  if (!/^(W(?:[1-9]|1[0-5])|B[1-4])$/.test(NODE)) return;

  const IS_W1 = NODE === 'W1';
  const IS_BOSS = /^B[1-4]$/.test(NODE);
  const FIGMA_RE = /^https:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|board|slides|make)\//i;
  const HTTPS_RE = /^https:\/\//i;
  const VERSION = '20260725-PROJECT-FIGMA-EVIDENCE-V4';

  function profile() {
    let p = {};
    try { p = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId:String(p.studentId || PARAMS.get('studentId') || PARAMS.get('sid') || '').trim(),
      section:String(p.section || PARAMS.get('section') || '').trim()
    };
  }

  function storageKeys() {
    const p = profile();
    const suffix = `${p.studentId || 'anonymous'}::${p.section || 'default'}`;
    return {
      project:`uxq.csai2601.masterProject.v4.${suffix}`,
      figma:`uxq.csai2601.masterFigma.v4.${suffix}`,
      evidence:`uxq.csai2601.evidence.${NODE}.v4.${suffix}`
    };
  }

  function read(key) { try { return String(localStorage.getItem(key) || '').trim(); } catch (_) { return ''; } }
  function write(key,value) { try { localStorage.setItem(key,String(value || '').trim()); } catch (_) {} }

  function installStyle() {
    if (document.getElementById('uxq-pfe-v4-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-pfe-v4-style';
    style.textContent = `
      #uxqProjectFigmaEvidenceV4{display:grid!important;visibility:visible!important;opacity:1!important;gap:14px;width:min(100%,1040px);margin:18px auto;padding:18px;box-sizing:border-box;border:1px solid rgba(110,231,255,.62);border-radius:20px;background:linear-gradient(135deg,rgba(11,50,96,.98),rgba(44,29,104,.96));box-shadow:0 18px 44px rgba(0,0,0,.3);position:relative;z-index:500}
      #uxqProjectFigmaEvidenceV4 .uxq-pfe4__head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
      #uxqProjectFigmaEvidenceV4 h2{margin:0;font-size:1.17rem;color:#fff}
      #uxqProjectFigmaEvidenceV4 p{margin:5px 0 0;color:#d5e5fa;line-height:1.5}
      .uxq-pfe4__badge{padding:5px 9px;border-radius:999px;background:rgba(110,231,255,.15);font-weight:900;font-size:.72rem;white-space:nowrap}
      .uxq-pfe4__fields{display:grid;grid-template-columns:minmax(210px,.75fr) minmax(0,1.3fr) minmax(0,1fr);gap:10px}
      .uxq-pfe4__field{display:grid;gap:6px}.uxq-pfe4__field label{font-weight:900;color:#fff}.uxq-pfe4__field input{display:block!important;width:100%;min-height:48px;padding:10px 12px;box-sizing:border-box;border:1px solid rgba(181,205,255,.4);border-radius:12px;background:#07142e;color:#fff;font:inherit}
      .uxq-pfe4__actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.uxq-pfe4__btn{display:grid;place-items:center;min-height:46px;padding:10px 12px;border-radius:12px;text-decoration:none;font-weight:950}.uxq-pfe4__btn.primary{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}.uxq-pfe4__btn.secondary{border:1px solid rgba(110,231,255,.4);color:#eef7ff;background:rgba(255,255,255,.04)}.uxq-pfe4__btn[aria-disabled='true']{opacity:.45;pointer-events:none}
      .uxq-pfe4__status{padding:9px 11px;border-radius:11px;font-size:.8rem}.uxq-pfe4__status[data-state='ok']{color:#8ff0bb;background:rgba(82,224,147,.1)}.uxq-pfe4__status[data-state='bad']{color:#ffb0bd;background:rgba(255,91,115,.1)}.uxq-pfe4__status[data-state='empty']{color:#ffdc91;background:rgba(255,209,102,.08)}
      @media(max-width:900px){.uxq-pfe4__fields{grid-template-columns:1fr 1fr}.uxq-pfe4__field:last-child{grid-column:1/-1}}
      @media(max-width:650px){#uxqProjectFigmaEvidenceV4{margin:12px 8px;width:auto;padding:14px}.uxq-pfe4__head{display:block}.uxq-pfe4__badge{display:inline-block;margin-top:8px}.uxq-pfe4__fields,.uxq-pfe4__actions{grid-template-columns:1fr}.uxq-pfe4__field:last-child{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function copy() {
    if (IS_W1) return {
      title:'สร้าง Master Figma Project ครั้งเดียว',
      desc:'สร้าง Project หลักใน W1 แล้วใช้ Project เดิมต่อเนื่องถึง W15',
      badge:'W1 • CREATE',
      action:'สร้าง Master Figma Project'
    };
    if (IS_BOSS) return {
      title:`ใช้ Master Project เดิมสำหรับ ${NODE} Defense`,
      desc:'เปิด Project เดิม รวบรวมหลักฐานจากสัปดาห์ก่อนหน้า และเพิ่ม Defense Section',
      badge:`${NODE} • DEFENSE`,
      action:'เปิด Master Project เดิม'
    };
    return {
      title:`ใช้ Master Project เดิมต่อใน ${NODE}`,
      desc:'เปิด Project เดิม เพิ่ม Page/Section ของสัปดาห์นี้ และเชื่อม Evidence ที่เกี่ยวข้อง',
      badge:`${NODE} • REUSE`,
      action:'เปิด Master Project เดิม'
    };
  }

  function createPanel() {
    const c = copy();
    const box = document.createElement('section');
    box.id = 'uxqProjectFigmaEvidenceV4';
    box.innerHTML = `
      <div class="uxq-pfe4__head"><div><h2>${c.title}</h2><p>${c.desc}</p></div><span class="uxq-pfe4__badge">${c.badge}</span></div>
      <div class="uxq-pfe4__fields">
        <div class="uxq-pfe4__field"><label>Master Project ID</label><input data-pfe4-project type="text" autocomplete="off" placeholder="UX2601-รหัสนักศึกษา"></div>
        <div class="uxq-pfe4__field"><label>${IS_W1 ? 'Master Figma Project URL' : 'Project / Figma URL'}</label><input data-pfe4-figma type="url" inputmode="url" autocomplete="off" placeholder="https://www.figma.com/design/..."></div>
        <div class="uxq-pfe4__field"><label>Evidence URL <small>(ถ้ามี)</small></label><input data-pfe4-evidence type="url" inputmode="url" autocomplete="off" placeholder="https://..."></div>
      </div>
      <div class="uxq-pfe4__actions">
        <a class="uxq-pfe4__btn primary" data-pfe4-create target="_blank" rel="noopener noreferrer">${c.action} ↗</a>
        <a class="uxq-pfe4__btn secondary" data-pfe4-open-figma href="#" aria-disabled="true">เปิด Figma ที่วาง</a>
        <a class="uxq-pfe4__btn secondary" data-pfe4-open-evidence href="#" aria-disabled="true">เปิด Evidence</a>
      </div>
      <div class="uxq-pfe4__status" data-state="empty">กรอก Project ID และวางลิงก์ Figma</div>`;
    return box;
  }

  function anchorPanel(box) {
    const tracker = document.getElementById('uxqThreePartCompletion');
    if (tracker?.parentNode) {
      if (box.parentNode !== tracker.parentNode || box.previousElementSibling !== tracker) tracker.insertAdjacentElement('afterend',box);
      return;
    }
    const rootFirst = ROOT.firstElementChild;
    if (rootFirst) ROOT.insertBefore(box,rootFirst); else ROOT.appendChild(box);
  }

  function studioCard() {
    const cards = Array.from(ROOT.querySelectorAll('.artifact'));
    let best = null;
    let bestScore = -1;
    cards.forEach(card => {
      const css = getComputedStyle(card);
      if (css.display === 'none' || css.visibility === 'hidden' || card.getClientRects().length === 0) return;
      const dataFields = card.querySelectorAll('[data-studio-key]').length;
      const textareas = card.querySelectorAll('textarea,input').length;
      const submit = card.querySelector('[data-studio-submit],[data-save-artifact],button[type="submit"]') ? 10 : 0;
      const debrief = /Debrief|Studio Practice|Reflection/i.test(card.textContent || '') ? 5 : 0;
      const score = dataFields * 5 + textareas + submit + debrief;
      if (score > bestScore) { bestScore = score; best = card; }
    });
    return best;
  }

  function canonical(card,key,label,format,required) {
    if (!card) return null;
    let field = card.querySelector(`[data-studio-key="${key}"]`);
    if (!field) {
      field = document.createElement('textarea');
      field.hidden = true;
      field.dataset.studioKey = key;
      card.appendChild(field);
    }
    field.dataset.studioLabel = label;
    field.dataset.format = format;
    field.dataset.required = required;
    field.dataset.minLength = '0';
    return field;
  }

  function validProject(value) {
    const s = String(value || '').trim();
    return s && s.length <= 80 && !HTTPS_RE.test(s) && !/หลักฐาน|ผู้ใช้|friction|task/i.test(s);
  }

  function mount() {
    installStyle();
    let box = document.getElementById('uxqProjectFigmaEvidenceV4');
    if (!box) box = createPanel();
    anchorPanel(box);

    const keys = storageKeys();
    const card = studioCard();
    const projectField = canonical(card,'projectId',IS_W1?'Master Project ID':'Master Project ID เดิม','text','1');
    const figmaField = canonical(card,'figmaUrl',IS_W1?'Master Figma Project URL':'Project / Figma URL','url','1');
    const evidenceField = canonical(card,'evidenceUrl','Evidence URL','url','0');

    const projectInput = box.querySelector('[data-pfe4-project]');
    const figmaInput = box.querySelector('[data-pfe4-figma]');
    const evidenceInput = box.querySelector('[data-pfe4-evidence]');
    const create = box.querySelector('[data-pfe4-create]');
    const openFigma = box.querySelector('[data-pfe4-open-figma]');
    const openEvidence = box.querySelector('[data-pfe4-open-evidence]');
    const status = box.querySelector('.uxq-pfe4__status');

    if (!box.dataset.initialized) {
      const storedProject = read(keys.project);
      const storedFigma = read(keys.figma);
      const storedEvidence = read(keys.evidence);
      const canonicalProject = validProject(projectField?.value) ? String(projectField.value).trim() : '';
      const canonicalFigma = FIGMA_RE.test(String(figmaField?.value || '').trim()) ? String(figmaField.value).trim() : '';
      const canonicalEvidence = HTTPS_RE.test(String(evidenceField?.value || '').trim()) ? String(evidenceField.value).trim() : '';
      projectInput.value = canonicalProject || storedProject || (IS_W1 && profile().studentId ? `UX2601-${profile().studentId}` : '');
      figmaInput.value = canonicalFigma || storedFigma;
      evidenceInput.value = canonicalEvidence || storedEvidence;
      box.dataset.initialized = '1';
    }

    const sync = () => {
      const project = String(projectInput.value || '').trim();
      const figma = String(figmaInput.value || '').trim();
      const evidence = String(evidenceInput.value || '').trim();

      if (projectField) projectField.value = project;
      if (figmaField) figmaField.value = figma;
      if (evidenceField) evidenceField.value = evidence;
      [projectField,figmaField,evidenceField].filter(Boolean).forEach(field => {
        field.dispatchEvent(new Event('input',{bubbles:true}));
        field.dispatchEvent(new Event('change',{bubbles:true}));
      });

      if (validProject(project)) write(keys.project,project);
      if (FIGMA_RE.test(figma)) write(keys.figma,figma);
      if (HTTPS_RE.test(evidence)) write(keys.evidence,evidence);

      const figmaOk = FIGMA_RE.test(figma);
      const evidenceOk = !evidence || HTTPS_RE.test(evidence);
      create.href = IS_W1 ? 'https://www.figma.com/files/' : (figmaOk ? figma : read(keys.figma) || 'https://www.figma.com/files/');
      openFigma.href = figmaOk ? figma : '#';
      openFigma.setAttribute('aria-disabled',figmaOk ? 'false' : 'true');
      openEvidence.href = evidence && evidenceOk ? evidence : '#';
      openEvidence.setAttribute('aria-disabled',evidence && evidenceOk ? 'false' : 'true');

      if (!validProject(project) || !figma) {
        status.dataset.state='empty'; status.textContent='กรอก Project ID และวางลิงก์ Figma';
      } else if (!figmaOk) {
        status.dataset.state='bad'; status.textContent='Figma URL ไม่ถูกต้อง ต้องเป็นลิงก์ figma.com';
      } else if (!evidenceOk) {
        status.dataset.state='bad'; status.textContent='Evidence URL ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://';
      } else {
        status.dataset.state='ok'; status.textContent='Project, Figma และ Evidence พร้อมใช้งานและพร้อมส่ง';
      }
    };

    if (box.dataset.bound !== '1') {
      box.dataset.bound='1';
      [projectInput,figmaInput,evidenceInput].forEach(input => input.addEventListener('input',sync));
      [openFigma,openEvidence].forEach(link => link.addEventListener('click',event => {
        if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
      }));
    }
    sync();
  }

  let timer = 0;
  function schedule(delay=60) { clearTimeout(timer); timer=setTimeout(mount,delay); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => schedule(40),{once:true}); else schedule(40);
  new MutationObserver(() => schedule(80)).observe(ROOT,{childList:true,subtree:true});
  [200,800,2000,4000].forEach(ms => setTimeout(mount,ms));
  setInterval(() => {
    const box = document.getElementById('uxqProjectFigmaEvidenceV4');
    if (!box || !document.documentElement.contains(box)) mount();
  },1000);

  window.UXQProjectFigmaEvidenceAuthorityV4 = Object.freeze({mount,version:VERSION});
})();