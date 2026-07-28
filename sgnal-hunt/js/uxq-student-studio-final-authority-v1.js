/* CSAI2601 UX Quest • Student Studio Final Authority v1
 * Student-mode only, front-end authority.
 * - One production wizard using the real canonical form controls.
 * - No duplicated raw fields or duplicated Project/Figma panels.
 * - Keeps Google Sheet as official authority without fabricating progress.
 * - Aligns the result heading with Mission / Studio / Reflection completion.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const preview = params.get('contentPreview') === '1' || /^content-preview/i.test(params.get('v') || '');
  if (preview) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE_ID = String(params.get('node') || params.get('id') || 'W1').trim().toUpperCase();
  const WIZARD_ID = 'uxqStudentStudioFinalV1';
  const STYLE_ID = 'uxq-student-studio-final-authority-v1-style';
  let building = false;
  let scheduled = 0;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body:not([data-uxq-mode='preview']) .artifact[data-student-studio-final='1'] > :not(.studio-head):not(#${WIZARD_ID}){display:none!important}
      body:not([data-uxq-mode='preview']) .artifact[data-student-studio-final='1']{display:grid!important;gap:14px!important;max-width:1080px!important;margin-inline:auto!important;min-width:0!important}
      #${WIZARD_ID}{display:grid!important;gap:14px!important;min-width:0!important;margin-top:12px!important}
      #${WIZARD_ID} .uxq-ssf__progress{position:sticky;top:8px;z-index:70;display:grid;gap:9px;padding:13px;border:1px solid rgba(110,231,255,.38);border-radius:16px;background:rgba(5,18,42,.98);box-shadow:0 12px 30px rgba(0,0,0,.28)}
      #${WIZARD_ID} .uxq-ssf__top{display:flex;justify-content:space-between;gap:12px;align-items:center;color:#fff}
      #${WIZARD_ID} .uxq-ssf__top span{color:#b6c8e6;font-size:.84rem}
      #${WIZARD_ID} .uxq-ssf__bar{height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}
      #${WIZARD_ID} .uxq-ssf__bar i{display:block;height:100%;background:linear-gradient(90deg,#6ee7ff,#79eda5);transition:width .2s ease}
      #${WIZARD_ID} .uxq-ssf__dots{display:grid;grid-template-columns:repeat(var(--count),minmax(30px,1fr));gap:5px}
      #${WIZARD_ID} .uxq-ssf__dot{display:grid;place-items:center;min-height:28px;border:1px solid rgba(181,205,255,.2);border-radius:999px;color:#8498ba;font-size:.7rem}
      #${WIZARD_ID} .uxq-ssf__dot.is-active{background:#6ee7ff;color:#071124;font-weight:950}
      #${WIZARD_ID} .uxq-ssf__dot.is-done{border-color:rgba(121,237,165,.48);color:#79eda5}
      #${WIZARD_ID} .uxq-ssf__panel{display:none!important;gap:14px!important;min-width:0!important}
      #${WIZARD_ID} .uxq-ssf__panel.is-active{display:grid!important}
      #${WIZARD_ID} .uxq-ssf__card{display:grid;gap:11px;padding:16px;border:1px solid rgba(110,231,255,.3);border-radius:17px;background:linear-gradient(135deg,rgba(19,73,122,.22),rgba(42,29,97,.2))}
      #${WIZARD_ID} h3{margin:0;color:#fff;font-size:clamp(1.2rem,3vw,1.55rem);line-height:1.3}
      #${WIZARD_ID} p{margin:0;color:#d3e0f4;line-height:1.6}
      #${WIZARD_ID} .uxq-ssf__deliverable{padding:11px 12px;border:1px solid rgba(255,209,102,.34);border-radius:12px;background:rgba(255,209,102,.07);color:#ffe5a5;line-height:1.5}
      #${WIZARD_ID} .uxq-ssf__taskgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
      #${WIZARD_ID} .uxq-ssf__taskgrid span{padding:9px;border:1px solid rgba(181,205,255,.18);border-radius:11px;background:rgba(3,13,31,.34);color:#dce8fa;font-size:.82rem;line-height:1.4}
      #${WIZARD_ID} .uxq-ssf__projectgrid{display:grid;grid-template-columns:minmax(150px,.75fr) minmax(220px,1.25fr) minmax(220px,1fr);gap:10px}
      #${WIZARD_ID} label{display:grid;gap:7px;min-width:0;color:#fff;font-weight:900}
      #${WIZARD_ID} input,#${WIZARD_ID} textarea{box-sizing:border-box;width:100%!important;max-width:100%!important;min-width:0!important;border:1px solid rgba(181,205,255,.32);border-radius:12px;background:#07142e;color:#fff;font:inherit;line-height:1.5;padding:11px 12px}
      #${WIZARD_ID} input{min-height:49px}
      #${WIZARD_ID} textarea{min-height:150px!important;max-height:360px!important;resize:vertical!important}
      #${WIZARD_ID} .studio-field{display:grid!important;gap:7px!important}
      #${WIZARD_ID} .studio-field>b{display:none!important}
      #${WIZARD_ID} .uxq-ssf__hint{color:#9fb1cf;font-size:.83rem;font-weight:500;line-height:1.45}
      #${WIZARD_ID} .uxq-ssf__actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
      #${WIZARD_ID} .uxq-ssf__actions a{display:grid;place-items:center;min-height:46px;padding:10px;border-radius:12px;text-decoration:none;font-weight:950}
      #${WIZARD_ID} .uxq-ssf__actions .primary{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}
      #${WIZARD_ID} .uxq-ssf__actions .secondary{border:1px solid rgba(110,231,255,.35);background:rgba(255,255,255,.04);color:#e1edff}
      #${WIZARD_ID} .uxq-ssf__actions [aria-disabled='true']{opacity:.4;pointer-events:none}
      #${WIZARD_ID} .studio-checks{display:grid!important;grid-template-columns:1fr!important;gap:9px!important}
      #${WIZARD_ID} label.studio-check{display:grid!important;grid-template-columns:22px minmax(0,1fr)!important;align-items:start!important;gap:9px!important;padding:3px 0!important}
      #${WIZARD_ID} label.studio-check input{width:18px!important;height:18px!important;min-height:18px!important;padding:0!important;margin-top:2px!important}
      #${WIZARD_ID} .actions{display:grid!important;grid-template-columns:minmax(230px,auto) minmax(0,1fr)!important;gap:12px!important;align-items:center!important}
      #${WIZARD_ID} .actions .btn{min-height:48px!important}
      #${WIZARD_ID} .actions small{line-height:1.45!important;overflow-wrap:anywhere!important}
      #${WIZARD_ID} .uxq-ssf__nav{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      #${WIZARD_ID} .uxq-ssf__nav button{min-height:48px;border-radius:12px;border:1px solid rgba(110,231,255,.35);font:inherit;font-weight:950;cursor:pointer}
      #${WIZARD_ID} .uxq-ssf__prev{background:rgba(255,255,255,.04);color:#dce9ff}
      #${WIZARD_ID} .uxq-ssf__next{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}
      #${WIZARD_ID} .uxq-ssf__nav button:disabled{opacity:.35;cursor:not-allowed}
      @media(max-width:800px){
        #${WIZARD_ID} .uxq-ssf__progress{position:static}
        #${WIZARD_ID} .uxq-ssf__taskgrid,#${WIZARD_ID} .uxq-ssf__projectgrid,#${WIZARD_ID} .uxq-ssf__actions{grid-template-columns:1fr}
        #${WIZARD_ID} .uxq-ssf__dots{grid-template-columns:repeat(var(--count),30px);overflow-x:auto;justify-content:start}
        #${WIZARD_ID} .uxq-ssf__card{padding:14px}
        #${WIZARD_ID} textarea{min-height:125px!important}
        #${WIZARD_ID} .actions{grid-template-columns:1fr!important}
      }
    `;
    document.head.appendChild(style);
  }

  function spec() {
    return window.CSAI2601_UXQ_STUDIO_PRACTICE_V1?.byId?.(NODE_ID) || null;
  }

  function sourceField(artifact,key) {
    return artifact.querySelector(`[data-studio-key="${CSS.escape(key)}"]`);
  }

  function fieldWrap(artifact,key) {
    return sourceField(artifact,key)?.closest('label,.studio-field') || null;
  }

  function ensureHiddenField(artifact,key,label) {
    let field = sourceField(artifact,key);
    if (field) return field;
    field = document.createElement('textarea');
    field.hidden = true;
    field.dataset.studioKey = key;
    field.dataset.studioLabel = label;
    field.dataset.artifactField = String(artifact.querySelectorAll('[data-studio-key]').length);
    artifact.appendChild(field);
    return field;
  }

  function syncVisible(visible,hidden) {
    visible.value = hidden?.value || '';
    const apply = () => {
      if (!hidden) return;
      hidden.value = visible.value;
      hidden.dispatchEvent(new Event('input',{bubbles:true}));
      hidden.dispatchEvent(new Event('change',{bubbles:true}));
    };
    visible.addEventListener('input',apply);
    visible.addEventListener('change',apply);
  }

  function isHttp(value) {
    try { return /^https?:$/i.test(new URL(String(value || '').trim()).protocol); }
    catch (_) { return false; }
  }

  function createProjectPanel(artifact) {
    const projectId = sourceField(artifact,'projectId');
    const figmaUrl = sourceField(artifact,'figmaUrl');
    const evidenceUrl = ensureHiddenField(artifact,'evidenceUrl','Evidence URL');

    const panel = document.createElement('section');
    panel.className = 'uxq-ssf__panel';
    panel.dataset.title = 'Project และหลักฐาน';
    panel.innerHTML = `
      <div class="uxq-ssf__card">
        <h3>${NODE_ID === 'W1' ? 'สร้าง Master Project ครั้งเดียว' : 'ใช้ Master Project เดิม'}</h3>
        <p>${NODE_ID === 'W1' ? 'กำหนด Project ID และสร้าง Figma Project หลักใน W1 แล้วใช้ Project เดิมต่อเนื่องถึง W15' : 'ใช้ Project ID และ Figma Project เดิมจาก W1 แล้วเพิ่ม Page หรือ Section ของสัปดาห์นี้'}</p>
        <div class="uxq-ssf__projectgrid">
          <label>Master Project ID<input data-ssf-project-id type="text" placeholder="เช่น UX2601-รหัสนักศึกษา"><span class="uxq-ssf__hint">ใช้ค่าเดิมตลอดรายวิชา</span></label>
          <label>Master Figma Project URL<input data-ssf-figma type="url" inputmode="url" placeholder="https://www.figma.com/design/..."><span class="uxq-ssf__hint">ลิงก์ Project หลัก ไม่ใช่รูปภาพอย่างเดียว</span></label>
          <label>Evidence URL (ถ้ามี)<input data-ssf-evidence type="url" inputmode="url" placeholder="https://..."><span class="uxq-ssf__hint">Screenshot, document หรือหลักฐานประกอบ</span></label>
        </div>
        <div class="uxq-ssf__actions">
          <a class="primary" href="https://www.figma.com/files/" target="_blank" rel="noopener noreferrer">${NODE_ID === 'W1' ? 'สร้าง Master Figma Project' : 'เปิด Figma'} ↗</a>
          <a class="secondary" data-ssf-open-figma href="#" aria-disabled="true">เปิด Figma ที่วาง</a>
          <a class="secondary" data-ssf-open-evidence href="#" aria-disabled="true">เปิด Evidence</a>
        </div>
        <div class="uxq-ssf__deliverable" data-ssf-project-status>กรอก Master Project ID และลิงก์ Figma</div>
      </div>`;

    const pid = panel.querySelector('[data-ssf-project-id]');
    const figma = panel.querySelector('[data-ssf-figma]');
    const evidence = panel.querySelector('[data-ssf-evidence]');
    const openFigma = panel.querySelector('[data-ssf-open-figma]');
    const openEvidence = panel.querySelector('[data-ssf-open-evidence]');
    const status = panel.querySelector('[data-ssf-project-status]');
    syncVisible(pid,projectId);
    syncVisible(figma,figmaUrl);
    syncVisible(evidence,evidenceUrl);

    const refresh = () => {
      const p = String(pid.value || '').trim();
      const f = String(figma.value || '').trim();
      const e = String(evidence.value || '').trim();
      if (isHttp(f)) {
        openFigma.href = f;
        openFigma.target = '_blank';
        openFigma.rel = 'noopener noreferrer';
        openFigma.removeAttribute('aria-disabled');
      } else {
        openFigma.href = '#';
        openFigma.setAttribute('aria-disabled','true');
      }
      if (isHttp(e)) {
        openEvidence.href = e;
        openEvidence.target = '_blank';
        openEvidence.rel = 'noopener noreferrer';
        openEvidence.removeAttribute('aria-disabled');
      } else {
        openEvidence.href = '#';
        openEvidence.setAttribute('aria-disabled','true');
      }
      status.textContent = !p ? 'ยังไม่ได้กรอก Master Project ID' : !isHttp(f) ? 'ยังไม่ได้วาง Master Figma Project URL ที่เปิดได้' : 'Project และ Figma พร้อมใช้ต่อเนื่อง';
    };
    [pid,figma,evidence].forEach(input => input.addEventListener('input',refresh));
    [openFigma,openEvidence].forEach(link => link.addEventListener('click',event => {
      if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
    }));
    refresh();
    return panel;
  }

  function taskPanel(field,wrap,index,total) {
    const panel = document.createElement('section');
    panel.className = 'uxq-ssf__panel';
    panel.dataset.title = field.label || `ส่วนที่ ${index + 1}`;
    panel.innerHTML = `<div class="uxq-ssf__card"><h3>${esc(field.label || `ส่วนที่ ${index + 1}`)}</h3><p>${esc(field.placeholder || 'เขียนจากหลักฐานของโครงการจริง')}</p><div class="uxq-ssf__deliverable">เชื่อม User → Task → Evidence → Decision → Proof • ส่วน ${index + 1}/${total}</div></div>`;
    panel.querySelector('.uxq-ssf__card').appendChild(wrap);
    return panel;
  }

  function parseCompletionCount() {
    const tracker = document.getElementById('uxqThreePartCompletion');
    const text = String(tracker?.textContent || ROOT.textContent || '');
    const matches = Array.from(text.matchAll(/([0-3])\s*\/\s*3/g));
    if (!matches.length) return null;
    return Math.max(...matches.map(item => Number(item[1])));
  }

  function alignResultHeading() {
    const count = parseCompletionCount();
    if (count == null || count >= 3) return;
    const results = ROOT.querySelector('.results');
    const heading = results?.querySelector('h1');
    if (!heading) return;
    heading.textContent = `${NODE_ID} ผ่าน Mission แล้ว`;
    const lead = heading.nextElementSibling;
    if (lead?.tagName === 'P') {
      lead.textContent = `ยืนยันแล้ว ${count}/3 ส่วน • ต้องทำ Studio Practice และ Weekly Reflection ให้ครบก่อนจึงถือว่า ${NODE_ID} สมบูรณ์`;
    }
    results.querySelectorAll('*').forEach(el => {
      if (el.children.length) return;
      const text = String(el.textContent || '');
      if (/ปลดล็อกด่านถัดไปได้แล้ว/i.test(text)) {
        el.textContent = 'Mission ผ่านแล้ว แต่ยังไม่ปลดล็อกด่านถัดไปจนกว่าจะยืนยันครบ 3/3 ส่วน';
      }
    });
  }

  function build() {
    if (building) return false;
    installStyle();
    alignResultHeading();

    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    const currentSpec = spec();
    if (!artifact || !currentSpec?.fields?.length) return false;
    if (artifact.querySelector('#' + WIZARD_ID)) {
      artifact.dataset.studentStudioFinal = '1';
      return true;
    }

    building = true;
    try {
      artifact.dataset.studentStudioFinal = '1';
      artifact.querySelectorAll('.studio-policy').forEach(el => el.remove());
      artifact.querySelectorAll(':scope > .uxq-pr, :scope > #uxqPreviewStudioWizardV1, :scope > #uxqProjectFigmaEvidenceV4').forEach(el => el.remove());

      const checks = artifact.querySelector(':scope > .studio-checks') || artifact.querySelector('.studio-checks');
      const validation = artifact.querySelector(':scope > .studio-validation') || artifact.querySelector('.studio-validation');
      const actions = artifact.querySelector(':scope > .actions') || artifact.querySelector('.actions');
      const reflectionWrap = fieldWrap(artifact,'reflection');
      const taskSpecs = currentSpec.fields.filter(item => !['projectId','figmaUrl','evidenceUrl','reflection'].includes(item.key));
      const taskPairs = taskSpecs.map(item => ({item,wrap:fieldWrap(artifact,item.key)})).filter(pair => pair.wrap);
      if (!checks || !actions || !reflectionWrap || !taskPairs.length) return false;

      const wizard = document.createElement('div');
      wizard.id = WIZARD_ID;
      wizard.className = 'uxq-pr uxq-student-studio';

      const panels = [];
      const intro = document.createElement('section');
      intro.className = 'uxq-ssf__panel';
      intro.dataset.title = 'โจทย์และชิ้นงาน';
      intro.innerHTML = `<div class="uxq-ssf__card"><p class="kicker">STUDIO PRACTICE • ${esc(NODE_ID)}</p><h3>${esc(currentSpec.studioTitle || NODE_ID)}</h3><p>${esc(currentSpec.objective || '')}</p><div class="uxq-ssf__deliverable"><strong>Artifact:</strong> ${esc(currentSpec.canonicalArtifact || '')} • เวลาประมาณ ${Number(currentSpec.suggestedMinutes || 0)} นาที</div><div class="uxq-ssf__taskgrid">${(currentSpec.practiceFlow || []).map((step,index)=>`<span>${index + 1}. ${esc(step)}</span>`).join('')}</div></div>`;
      panels.push(intro);
      panels.push(createProjectPanel(artifact));
      taskPairs.forEach((pair,index) => panels.push(taskPanel(pair.item,pair.wrap,index,taskPairs.length)));

      const reflection = document.createElement('section');
      reflection.className = 'uxq-ssf__panel';
      reflection.dataset.title = 'Weekly Reflection';
      reflection.innerHTML = `<div class="uxq-ssf__card"><h3>Weekly Reflection ${esc(NODE_ID)}</h3><p>${esc(currentSpec.reflectionPrompt || 'สรุปสิ่งที่เรียนรู้จากหลักฐาน การตัดสินใจ และสิ่งที่จะปรับในรอบถัดไป')}</p></div>`;
      reflection.querySelector('.uxq-ssf__card').appendChild(reflectionWrap);
      panels.push(reflection);

      const review = document.createElement('section');
      review.className = 'uxq-ssf__panel';
      review.dataset.title = 'ตรวจและส่ง';
      review.innerHTML = `<div class="uxq-ssf__card"><h3>ตรวจความครบก่อนส่ง</h3><p>ตรวจ Project ID, Figma URL, Evidence, คำตอบทุกส่วน และ Weekly Reflection ก่อนส่ง</p><div class="uxq-ssf__deliverable">ข้อมูลทางการจะสมบูรณ์เมื่อระบบยืนยัน Mission + Studio Practice + Weekly Reflection ครบ 3/3 ส่วน</div></div>`;
      const reviewCard = review.querySelector('.uxq-ssf__card');
      reviewCard.appendChild(checks);
      if (validation) reviewCard.appendChild(validation);
      const submitButton = actions.querySelector('[data-studio-submit],[data-save-artifact]');
      if (submitButton) submitButton.textContent = 'ส่ง Studio Practice และ Weekly Reflection';
      reviewCard.appendChild(actions);
      panels.push(review);

      wizard.style.setProperty('--count',String(panels.length));
      wizard.innerHTML = `<div class="uxq-ssf__progress"><div class="uxq-ssf__top"><b data-ssf-title></b><span data-ssf-count></span></div><div class="uxq-ssf__bar"><i></i></div><div class="uxq-ssf__dots">${panels.map((_,index)=>`<span class="uxq-ssf__dot">${index + 1}</span>`).join('')}</div></div>`;
      panels.forEach(panel => wizard.appendChild(panel));
      const nav = document.createElement('div');
      nav.className = 'uxq-ssf__nav';
      nav.innerHTML = '<button type="button" class="uxq-ssf__prev">ย้อนกลับ</button><button type="button" class="uxq-ssf__next">เริ่มทำ</button>';
      wizard.appendChild(nav);
      artifact.appendChild(wizard);

      let current = 0;
      const show = next => {
        current = Math.max(0,Math.min(panels.length - 1,next));
        panels.forEach((panel,index) => panel.classList.toggle('is-active',index === current));
        wizard.querySelector('[data-ssf-title]').textContent = `ขั้นที่ ${current + 1} • ${panels[current].dataset.title}`;
        wizard.querySelector('[data-ssf-count]').textContent = `${current + 1}/${panels.length}`;
        wizard.querySelector('.uxq-ssf__bar i').style.width = `${((current + 1) / panels.length) * 100}%`;
        wizard.querySelectorAll('.uxq-ssf__dot').forEach((dot,index) => {
          dot.classList.toggle('is-active',index === current);
          dot.classList.toggle('is-done',index < current);
        });
        const prev = wizard.querySelector('.uxq-ssf__prev');
        const nextButton = wizard.querySelector('.uxq-ssf__next');
        prev.disabled = current === 0;
        nextButton.hidden = current === panels.length - 1;
        nextButton.textContent = current === 0 ? 'เริ่มทำ' : current === panels.length - 2 ? 'ไปตรวจและส่ง' : 'ถัดไป';
        wizard.querySelector('.uxq-ssf__progress')?.scrollIntoView?.({behavior:'smooth',block:'start'});
      };
      wizard.querySelector('.uxq-ssf__prev').addEventListener('click',() => show(current - 1));
      wizard.querySelector('.uxq-ssf__next').addEventListener('click',() => show(current + 1));
      show(0);
      return true;
    } finally {
      building = false;
    }
  }

  function schedule(delay = 100) {
    clearTimeout(scheduled);
    scheduled = setTimeout(build,delay);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => schedule(120),{once:true});
  else schedule(120);
  new MutationObserver(() => schedule(120)).observe(ROOT,{childList:true,subtree:true});
  ['uxq-mission-resume-studio','uxq-direct-studio-confirmed','uxq-progress-updated','uxq-sheet-progress-restored'].forEach(name => window.addEventListener(name,() => schedule(70)));
  [300,800,1600,3000,5000].forEach(ms => setTimeout(build,ms));

  window.UXQStudentStudioFinalAuthorityV1 = Object.freeze({version:'20260728-STUDENT-STUDIO-FINAL-V1',build,alignResultHeading});
})();