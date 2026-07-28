/* CSAI2601 UX Quest • Student Studio Final Authority v2
 * Student-only, front-end authority.
 * Uses proxy controls synced to canonical fields, so legacy renderers cannot
 * destroy the real submission data while only one guided wizard is visible.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const preview = params.get('contentPreview') === '1' || /^content-preview/i.test(params.get('v') || '');
  if (preview) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE_ID = String(params.get('node') || params.get('id') || 'W1').trim().toUpperCase();
  const WIZARD_ID = 'uxqStudentStudioFinalV2';
  const STYLE_ID = 'uxq-student-studio-final-authority-v2-style';
  let building = false;
  let timer = 0;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function getSpec() {
    return window.CSAI2601_UXQ_STUDIO_PRACTICE_V1?.byId?.(NODE_ID) || null;
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body:not([data-uxq-mode='preview']) .artifact[data-student-studio-v2='1'] > :not(.studio-head):not(#${WIZARD_ID}){display:none!important}
      body:not([data-uxq-mode='preview']) .artifact[data-student-studio-v2='1']{display:grid!important;gap:14px!important;max-width:1080px!important;margin-inline:auto!important;min-width:0!important}
      #${WIZARD_ID}{display:grid!important;gap:14px!important;min-width:0!important;margin-top:12px!important}
      #${WIZARD_ID} .uxq-sv2__progress{position:sticky;top:8px;z-index:80;display:grid;gap:9px;padding:13px;border:1px solid rgba(110,231,255,.4);border-radius:16px;background:rgba(5,18,42,.98);box-shadow:0 12px 30px rgba(0,0,0,.28)}
      #${WIZARD_ID} .uxq-sv2__top{display:flex;justify-content:space-between;gap:12px;align-items:center;color:#fff}
      #${WIZARD_ID} .uxq-sv2__top span{color:#b6c8e6;font-size:.84rem}
      #${WIZARD_ID} .uxq-sv2__bar{height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}
      #${WIZARD_ID} .uxq-sv2__bar i{display:block;height:100%;background:linear-gradient(90deg,#6ee7ff,#79eda5);transition:width .2s ease}
      #${WIZARD_ID} .uxq-sv2__dots{display:grid;grid-template-columns:repeat(var(--count),minmax(30px,1fr));gap:5px}
      #${WIZARD_ID} .uxq-sv2__dot{display:grid;place-items:center;min-height:28px;border:1px solid rgba(181,205,255,.2);border-radius:999px;color:#8498ba;font-size:.7rem}
      #${WIZARD_ID} .uxq-sv2__dot.is-active{background:#6ee7ff;color:#071124;font-weight:950}
      #${WIZARD_ID} .uxq-sv2__dot.is-done{border-color:rgba(121,237,165,.48);color:#79eda5}
      #${WIZARD_ID} .uxq-sv2__panel{display:none!important;gap:14px!important;min-width:0!important}
      #${WIZARD_ID} .uxq-sv2__panel.is-active{display:grid!important}
      #${WIZARD_ID} .uxq-sv2__card{display:grid;gap:11px;padding:16px;border:1px solid rgba(110,231,255,.3);border-radius:17px;background:linear-gradient(135deg,rgba(19,73,122,.22),rgba(42,29,97,.2))}
      #${WIZARD_ID} h3{margin:0;color:#fff;font-size:clamp(1.2rem,3vw,1.55rem);line-height:1.3}
      #${WIZARD_ID} p{margin:0;color:#d3e0f4;line-height:1.6}
      #${WIZARD_ID} .uxq-sv2__deliverable{padding:11px 12px;border:1px solid rgba(255,209,102,.34);border-radius:12px;background:rgba(255,209,102,.07);color:#ffe5a5;line-height:1.5}
      #${WIZARD_ID} .uxq-sv2__taskgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
      #${WIZARD_ID} .uxq-sv2__taskgrid span{padding:9px;border:1px solid rgba(181,205,255,.18);border-radius:11px;background:rgba(3,13,31,.34);color:#dce8fa;font-size:.82rem;line-height:1.4}
      #${WIZARD_ID} .uxq-sv2__projectgrid{display:grid;grid-template-columns:minmax(150px,.75fr) minmax(220px,1.25fr) minmax(220px,1fr);gap:10px}
      #${WIZARD_ID} label{display:grid;gap:7px;min-width:0;color:#fff;font-weight:900}
      #${WIZARD_ID} input,#${WIZARD_ID} textarea{box-sizing:border-box;width:100%!important;max-width:100%!important;min-width:0!important;border:1px solid rgba(181,205,255,.32);border-radius:12px;background:#07142e;color:#fff;font:inherit;line-height:1.5;padding:11px 12px}
      #${WIZARD_ID} input{min-height:49px}
      #${WIZARD_ID} textarea{min-height:150px!important;max-height:360px!important;resize:vertical!important}
      #${WIZARD_ID} .uxq-sv2__hint{color:#9fb1cf;font-size:.83rem;font-weight:500;line-height:1.45}
      #${WIZARD_ID} .uxq-sv2__actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
      #${WIZARD_ID} .uxq-sv2__actions a{display:grid;place-items:center;min-height:46px;padding:10px;border-radius:12px;text-decoration:none;font-weight:950}
      #${WIZARD_ID} .uxq-sv2__actions .primary{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}
      #${WIZARD_ID} .uxq-sv2__actions .secondary{border:1px solid rgba(110,231,255,.35);background:rgba(255,255,255,.04);color:#e1edff}
      #${WIZARD_ID} .uxq-sv2__actions [aria-disabled='true']{opacity:.4;pointer-events:none}
      #${WIZARD_ID} .studio-checks{display:grid!important;grid-template-columns:1fr!important;gap:9px!important}
      #${WIZARD_ID} label.studio-check{display:grid!important;grid-template-columns:22px minmax(0,1fr)!important;align-items:start!important;gap:9px!important;padding:3px 0!important}
      #${WIZARD_ID} label.studio-check input{width:18px!important;height:18px!important;min-height:18px!important;padding:0!important;margin-top:2px!important}
      #${WIZARD_ID} .actions{display:grid!important;grid-template-columns:minmax(230px,auto) minmax(0,1fr)!important;gap:12px!important;align-items:center!important}
      #${WIZARD_ID} .actions .btn{min-height:48px!important}
      #${WIZARD_ID} .actions small{line-height:1.45!important;overflow-wrap:anywhere!important}
      #${WIZARD_ID} .uxq-sv2__validation{display:none;padding:10px 12px;border:1px solid rgba(255,120,140,.55);border-radius:12px;background:rgba(255,90,115,.1);color:#ffd8df;line-height:1.5}
      #${WIZARD_ID} .uxq-sv2__validation[data-show='1']{display:block}
      #${WIZARD_ID} .uxq-sv2__nav{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      #${WIZARD_ID} .uxq-sv2__nav button{min-height:48px;border-radius:12px;border:1px solid rgba(110,231,255,.35);font:inherit;font-weight:950;cursor:pointer}
      #${WIZARD_ID} .uxq-sv2__prev{background:rgba(255,255,255,.04);color:#dce9ff}
      #${WIZARD_ID} .uxq-sv2__next{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}
      #${WIZARD_ID} .uxq-sv2__nav button:disabled{opacity:.35;cursor:not-allowed}
      @media(max-width:800px){
        #${WIZARD_ID} .uxq-sv2__progress{position:static}
        #${WIZARD_ID} .uxq-sv2__taskgrid,#${WIZARD_ID} .uxq-sv2__projectgrid,#${WIZARD_ID} .uxq-sv2__actions{grid-template-columns:1fr}
        #${WIZARD_ID} .uxq-sv2__dots{grid-template-columns:repeat(var(--count),30px);overflow-x:auto;justify-content:start}
        #${WIZARD_ID} .uxq-sv2__card{padding:14px}
        #${WIZARD_ID} textarea{min-height:125px!important}
        #${WIZARD_ID} .actions{grid-template-columns:1fr!important}
      }
    `;
    document.head.appendChild(style);
  }

  function canonicalField(artifact,key) {
    return Array.from(artifact.querySelectorAll(`[data-studio-key="${CSS.escape(key)}"]`))
      .find(field => !field.closest('#' + WIZARD_ID)) || null;
  }

  function ensureCanonicalField(artifact,key,label,meta={}) {
    let source = canonicalField(artifact,key);
    if (source) return source;
    source = document.createElement('textarea');
    source.dataset.studioKey = key;
    source.dataset.studioLabel = label;
    source.dataset.required = meta.required ? '1' : '0';
    source.dataset.minLength = String(meta.minLength || 0);
    source.dataset.format = meta.format || 'text';
    source.dataset.artifactField = String(artifact.querySelectorAll('[data-studio-key]').length);
    artifact.appendChild(source);
    return source;
  }

  function syncProxy(proxy,source) {
    proxy.value = source?.value || '';
    const push = () => {
      if (!source) return;
      source.value = proxy.value;
      source.dispatchEvent(new Event('input',{bubbles:true}));
      source.dispatchEvent(new Event('change',{bubbles:true}));
    };
    proxy.addEventListener('input',push);
    proxy.addEventListener('change',push);
  }

  function isHttp(value) {
    try { return /^https?:$/i.test(new URL(String(value || '').trim()).protocol); }
    catch (_) { return false; }
  }

  function makePanel(title) {
    const panel = document.createElement('section');
    panel.className = 'uxq-sv2__panel';
    panel.dataset.title = title;
    return panel;
  }

  function makeProxyField(artifact,fieldSpec) {
    const source = ensureCanonicalField(artifact,fieldSpec.key,fieldSpec.label,fieldSpec);
    const panel = makePanel(fieldSpec.label || fieldSpec.key);
    panel.innerHTML = `<div class="uxq-sv2__card"><h3>${esc(fieldSpec.label || fieldSpec.key)}</h3><p>${esc(fieldSpec.placeholder || 'เขียนจากหลักฐานของโครงการจริง')}</p><div class="uxq-sv2__deliverable">เชื่อม User → Task → Evidence → Decision → Proof</div><textarea data-sv2-proxy="${esc(fieldSpec.key)}" placeholder="${esc(fieldSpec.placeholder || '')}"></textarea></div>`;
    const proxy = panel.querySelector('[data-sv2-proxy]');
    proxy.dataset.required = fieldSpec.required ? '1' : '0';
    proxy.dataset.minLength = String(fieldSpec.minLength || 0);
    proxy.dataset.format = fieldSpec.format || 'text';
    proxy.dataset.label = fieldSpec.label || fieldSpec.key;
    syncProxy(proxy,source);
    return panel;
  }

  function createProjectPanel(artifact) {
    const projectSource = ensureCanonicalField(artifact,'projectId','Master Project ID',{required:true,minLength:4});
    const figmaSource = ensureCanonicalField(artifact,'figmaUrl','Master Figma Project URL',{required:true,format:'url'});
    const evidenceSource = ensureCanonicalField(artifact,'evidenceUrl','Evidence URL',{required:false,format:'url'});

    const panel = makePanel('Project และหลักฐาน');
    panel.innerHTML = `<div class="uxq-sv2__card">
      <h3>${NODE_ID === 'W1' ? 'สร้าง Master Project ครั้งเดียว' : 'ใช้ Master Project เดิม'}</h3>
      <p>${NODE_ID === 'W1' ? 'กำหนด Project ID และสร้าง Figma Project หลักใน W1 แล้วใช้ Project เดิมต่อเนื่องถึง W15' : 'ใช้ Project ID และ Figma Project เดิมจาก W1 แล้วเพิ่ม Page หรือ Section ของสัปดาห์นี้'}</p>
      <div class="uxq-sv2__projectgrid">
        <label>Master Project ID<input data-sv2-project type="text" placeholder="เช่น UX2601-รหัสนักศึกษา"><span class="uxq-sv2__hint">ใช้ค่าเดิมตลอดรายวิชา</span></label>
        <label>Master Figma Project URL<input data-sv2-figma type="url" inputmode="url" placeholder="https://www.figma.com/design/..."><span class="uxq-sv2__hint">ลิงก์ Project หลัก ไม่ใช่ภาพหน้าจออย่างเดียว</span></label>
        <label>Evidence URL (ถ้ามี)<input data-sv2-evidence type="url" inputmode="url" placeholder="https://..."><span class="uxq-sv2__hint">Screenshot, document หรือหลักฐานประกอบ</span></label>
      </div>
      <div class="uxq-sv2__actions">
        <a class="primary" href="https://www.figma.com/files/" target="_blank" rel="noopener noreferrer">${NODE_ID === 'W1' ? 'สร้าง Master Figma Project' : 'เปิด Figma'} ↗</a>
        <a class="secondary" data-sv2-open-figma href="#" aria-disabled="true">เปิด Figma ที่วาง</a>
        <a class="secondary" data-sv2-open-evidence href="#" aria-disabled="true">เปิด Evidence</a>
      </div>
      <div class="uxq-sv2__deliverable" data-sv2-project-status>กรอก Master Project ID และลิงก์ Figma</div>
    </div>`;

    const project = panel.querySelector('[data-sv2-project]');
    const figma = panel.querySelector('[data-sv2-figma]');
    const evidence = panel.querySelector('[data-sv2-evidence]');
    const openFigma = panel.querySelector('[data-sv2-open-figma]');
    const openEvidence = panel.querySelector('[data-sv2-open-evidence]');
    const status = panel.querySelector('[data-sv2-project-status]');
    syncProxy(project,projectSource);
    syncProxy(figma,figmaSource);
    syncProxy(evidence,evidenceSource);

    const refresh = () => {
      const projectValue = String(project.value || '').trim();
      const figmaValue = String(figma.value || '').trim();
      const evidenceValue = String(evidence.value || '').trim();
      if (isHttp(figmaValue)) {
        openFigma.href = figmaValue;
        openFigma.target = '_blank';
        openFigma.rel = 'noopener noreferrer';
        openFigma.removeAttribute('aria-disabled');
      } else {
        openFigma.href = '#';
        openFigma.setAttribute('aria-disabled','true');
      }
      if (isHttp(evidenceValue)) {
        openEvidence.href = evidenceValue;
        openEvidence.target = '_blank';
        openEvidence.rel = 'noopener noreferrer';
        openEvidence.removeAttribute('aria-disabled');
      } else {
        openEvidence.href = '#';
        openEvidence.setAttribute('aria-disabled','true');
      }
      status.textContent = !projectValue
        ? 'ยังไม่ได้กรอก Master Project ID'
        : !isHttp(figmaValue)
          ? 'ยังไม่ได้วาง Master Figma Project URL ที่เปิดได้'
          : 'Project และ Figma พร้อมใช้ต่อเนื่อง';
    };
    [project,figma,evidence].forEach(input => input.addEventListener('input',refresh));
    [openFigma,openEvidence].forEach(link => link.addEventListener('click',event => {
      if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
    }));
    refresh();
    return panel;
  }

  function findOutside(selector) {
    return Array.from(ROOT.querySelectorAll(selector)).find(node => !node.closest('#' + WIZARD_ID)) || null;
  }

  function ensureChecks(spec) {
    let checks = findOutside('.artifact[data-studio-practice-v1] .studio-checks');
    if (checks) return checks;
    checks = document.createElement('section');
    checks.className = 'studio-checks';
    checks.innerHTML = `<h3>Self-check ก่อนส่ง</h3>${(spec.selfChecks || []).map((item,index)=>`<label class="studio-check"><input type="checkbox" data-studio-check="${index}"><span>${esc(item)}</span></label>`).join('')}`;
    return checks;
  }

  function ensureActions() {
    let actions = findOutside('.artifact[data-studio-practice-v1] .actions');
    if (actions) return actions;
    actions = document.createElement('div');
    actions.className = 'actions';
    actions.innerHTML = '<button class="btn" type="button" data-save-artifact data-studio-submit>ส่ง Studio Practice และ Weekly Reflection</button><small data-save-status>ข้อมูลทางการเกิดเมื่อ Google Sheet ยืนยันการส่ง</small>';
    return actions;
  }

  function completionCount() {
    const tracker = document.getElementById('uxqThreePartCompletion');
    const badge = tracker?.querySelector('.uxq-3part__count');
    const match = String(badge?.textContent || '').match(/([0-3])\s*\/\s*3/);
    return match ? Number(match[1]) : null;
  }

  function alignResultHeading() {
    const count = completionCount();
    if (count == null) return;
    const results = ROOT.querySelector('.results');
    const heading = results?.querySelector('h1');
    if (!heading) return;
    if (count < 3) {
      heading.textContent = `${NODE_ID} ผ่าน Mission แล้ว`;
      const lead = heading.nextElementSibling;
      if (lead?.tagName === 'P') lead.textContent = `ระบบยืนยันแล้ว ${count}/3 ส่วน • ต้องทำ Studio Practice และ Weekly Reflection ให้ครบก่อนจึงถือว่า ${NODE_ID} สมบูรณ์`;
      results.querySelectorAll('*').forEach(el => {
        if (el.children.length) return;
        if (/ปลดล็อกด่านถัดไปได้แล้ว/i.test(el.textContent || '')) el.textContent = 'Mission ผ่านแล้ว แต่ยังไม่ปลดล็อกด่านถัดไปจนกว่าระบบจะยืนยันครบ 3/3 ส่วน';
      });
    } else {
      heading.textContent = `${NODE_ID} สมบูรณ์แล้ว`;
    }
  }

  function validateWizard(wizard) {
    const problems = [];
    const project = wizard.querySelector('[data-sv2-project]');
    const figma = wizard.querySelector('[data-sv2-figma]');
    const evidence = wizard.querySelector('[data-sv2-evidence]');
    if (!String(project?.value || '').trim()) problems.push('Master Project ID: ยังไม่ได้กรอก');
    if (!isHttp(figma?.value)) problems.push('Master Figma Project URL: ต้องเป็น URL ที่เปิดได้');
    if (String(evidence?.value || '').trim() && !isHttp(evidence.value)) problems.push('Evidence URL: URL ไม่ถูกต้อง');
    wizard.querySelectorAll('[data-sv2-proxy]').forEach(field => {
      const value = String(field.value || '').trim();
      const label = field.dataset.label || 'คำตอบ';
      const minLength = Number(field.dataset.minLength || 0);
      if (field.dataset.required === '1' && !value) problems.push(`${label}: ยังไม่ได้กรอก`);
      else if (value && minLength && value.length < minLength) problems.push(`${label}: ควรมีอย่างน้อย ${minLength} ตัวอักษร`);
    });
    const checks = Array.from(wizard.querySelectorAll('[data-studio-check]'));
    const unchecked = checks.filter(item => !item.checked);
    if (checks.length && unchecked.length) problems.push(`Self-check: ยังไม่ได้ยืนยัน ${unchecked.length} ข้อ`);
    return problems;
  }

  function build() {
    if (building) return false;
    installStyle();
    alignResultHeading();

    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    const spec = getSpec();
    if (!artifact || !spec?.fields?.length) return false;
    if (artifact.querySelector('#' + WIZARD_ID)) {
      artifact.dataset.studentStudioV2 = '1';
      return true;
    }

    building = true;
    try {
      artifact.dataset.studentStudioV2 = '1';
      artifact.querySelectorAll('.studio-policy').forEach(el => el.remove());

      const wizard = document.createElement('div');
      wizard.id = WIZARD_ID;
      wizard.className = 'uxq-pr uxq-student-studio-v2';

      const panels = [];
      const intro = makePanel('โจทย์และชิ้นงาน');
      intro.innerHTML = `<div class="uxq-sv2__card"><p class="kicker">STUDIO PRACTICE • ${esc(NODE_ID)}</p><h3>${esc(spec.studioTitle || NODE_ID)}</h3><p>${esc(spec.objective || '')}</p><div class="uxq-sv2__deliverable"><strong>Artifact:</strong> ${esc(spec.canonicalArtifact || '')} • เวลาประมาณ ${Number(spec.suggestedMinutes || 0)} นาที</div><div class="uxq-sv2__taskgrid">${(spec.practiceFlow || []).map((step,index)=>`<span>${index + 1}. ${esc(step)}</span>`).join('')}</div></div>`;
      panels.push(intro);
      panels.push(createProjectPanel(artifact));

      const taskSpecs = spec.fields.filter(item => !['projectId','figmaUrl','evidenceUrl','reflection'].includes(item.key));
      taskSpecs.forEach(fieldSpec => panels.push(makeProxyField(artifact,fieldSpec)));
      const reflectionSpec = spec.fields.find(item => item.key === 'reflection');
      if (reflectionSpec) panels.push(makeProxyField(artifact,{...reflectionSpec,label:`Weekly Reflection ${NODE_ID}`}));

      const review = makePanel('ตรวจและส่ง');
      review.innerHTML = `<div class="uxq-sv2__card"><h3>ตรวจความครบก่อนส่ง</h3><p>ตรวจ Project ID, Figma URL, Evidence, คำตอบทุกส่วน และ Weekly Reflection ก่อนส่ง</p><div class="uxq-sv2__deliverable">ข้อมูลทางการจะสมบูรณ์เมื่อระบบยืนยัน Mission + Studio Practice + Weekly Reflection ครบ 3/3 ส่วน</div><div class="uxq-sv2__validation" data-sv2-validation role="alert"></div></div>`;
      const reviewCard = review.querySelector('.uxq-sv2__card');
      const checks = ensureChecks(spec);
      const validationLegacy = findOutside('.artifact[data-studio-practice-v1] .studio-validation');
      const actions = ensureActions();
      const submitButton = actions.querySelector('[data-studio-submit],[data-save-artifact]');
      if (submitButton) submitButton.textContent = 'ส่ง Studio Practice และ Weekly Reflection';
      reviewCard.appendChild(checks);
      if (validationLegacy) reviewCard.appendChild(validationLegacy);
      reviewCard.appendChild(actions);
      panels.push(review);

      wizard.style.setProperty('--count',String(panels.length));
      wizard.innerHTML = `<div class="uxq-sv2__progress"><div class="uxq-sv2__top"><b data-sv2-title></b><span data-sv2-count></span></div><div class="uxq-sv2__bar"><i></i></div><div class="uxq-sv2__dots">${panels.map((_,index)=>`<span class="uxq-sv2__dot">${index + 1}</span>`).join('')}</div></div>`;
      panels.forEach(panel => wizard.appendChild(panel));
      const nav = document.createElement('div');
      nav.className = 'uxq-sv2__nav';
      nav.innerHTML = '<button type="button" class="uxq-sv2__prev">ย้อนกลับ</button><button type="button" class="uxq-sv2__next">เริ่มทำ</button>';
      wizard.appendChild(nav);
      artifact.appendChild(wizard);

      let current = 0;
      const show = next => {
        current = Math.max(0,Math.min(panels.length - 1,next));
        panels.forEach((panel,index) => panel.classList.toggle('is-active',index === current));
        wizard.querySelector('[data-sv2-title]').textContent = `ขั้นที่ ${current + 1} • ${panels[current].dataset.title}`;
        wizard.querySelector('[data-sv2-count]').textContent = `${current + 1}/${panels.length}`;
        wizard.querySelector('.uxq-sv2__bar i').style.width = `${((current + 1) / panels.length) * 100}%`;
        wizard.querySelectorAll('.uxq-sv2__dot').forEach((dot,index) => {
          dot.classList.toggle('is-active',index === current);
          dot.classList.toggle('is-done',index < current);
        });
        const prev = wizard.querySelector('.uxq-sv2__prev');
        const nextButton = wizard.querySelector('.uxq-sv2__next');
        prev.disabled = current === 0;
        nextButton.hidden = current === panels.length - 1;
        nextButton.textContent = current === 0 ? 'เริ่มทำ' : current === panels.length - 2 ? 'ไปตรวจและส่ง' : 'ถัดไป';
        wizard.querySelector('.uxq-sv2__progress')?.scrollIntoView?.({behavior:'smooth',block:'start'});
      };
      wizard.querySelector('.uxq-sv2__prev').addEventListener('click',() => show(current - 1));
      wizard.querySelector('.uxq-sv2__next').addEventListener('click',() => show(current + 1));

      submitButton?.addEventListener('click',event => {
        const problems = validateWizard(wizard);
        const box = wizard.querySelector('[data-sv2-validation]');
        if (!problems.length) {
          if (box) { box.dataset.show = '0'; box.textContent = ''; }
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (box) {
          box.dataset.show = '1';
          box.innerHTML = `<strong>ยังส่งไม่ได้</strong><br>${problems.map(esc).join('<br>')}`;
          box.scrollIntoView?.({behavior:'smooth',block:'center'});
        }
      },true);

      show(0);
      return true;
    } finally {
      building = false;
    }
  }

  function schedule(delay=100) {
    clearTimeout(timer);
    timer = setTimeout(build,delay);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => schedule(120),{once:true});
  else schedule(120);
  new MutationObserver(() => schedule(120)).observe(ROOT,{childList:true,subtree:true});
  ['uxq-mission-resume-studio','uxq-direct-studio-confirmed','uxq-progress-updated','uxq-sheet-progress-restored'].forEach(name => window.addEventListener(name,() => schedule(70)));
  [250,600,1200,2200,4000,7000].forEach(ms => setTimeout(build,ms));

  window.UXQStudentStudioFinalAuthorityV2 = Object.freeze({version:'20260728-STUDENT-STUDIO-FINAL-V2',build,alignResultHeading,completionCount});
})();