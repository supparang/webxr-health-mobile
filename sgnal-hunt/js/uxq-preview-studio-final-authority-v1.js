/* CSAI2601 UX Quest • Preview Studio Final Authority v1
 * Preview-only, front-end QA renderer.
 * - No Apps Script / Google Sheet copy.
 * - One idempotent wizard.
 * - Separate Master Project ID, Master Figma Project URL, Evidence URL.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const legacyPreview = /^content-preview/i.test(params.get('v') || '');
  const preview = params.get('contentPreview') === '1' || legacyPreview;
  if (!preview) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE_ID = String(params.get('node') || params.get('id') || 'W1').trim().toUpperCase();
  const STYLE_ID = 'uxq-preview-studio-final-authority-v1-style';
  const WIZARD_ID = 'uxqPreviewStudioWizardV1';

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body[data-uxq-mode='preview'] .artifact[data-preview-studio-final='1'] > :not(.studio-head):not(#${WIZARD_ID}){display:none!important}
      body[data-uxq-mode='preview'] .artifact[data-preview-studio-final='1']{display:grid!important;gap:14px!important;max-width:1040px!important;margin-inline:auto!important}
      #${WIZARD_ID}{display:grid;gap:14px;min-width:0}
      #${WIZARD_ID} .uxq-ps__progress{display:grid;gap:9px;padding:14px;border:1px solid rgba(110,231,255,.35);border-radius:16px;background:rgba(5,18,42,.94)}
      #${WIZARD_ID} .uxq-ps__top{display:flex;justify-content:space-between;gap:12px;align-items:center;color:#fff}
      #${WIZARD_ID} .uxq-ps__top span{color:#b8cae8;font-size:.86rem}
      #${WIZARD_ID} .uxq-ps__bar{height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}
      #${WIZARD_ID} .uxq-ps__bar i{display:block;height:100%;background:linear-gradient(90deg,#6ee7ff,#79eda5);transition:width .2s ease}
      #${WIZARD_ID} .uxq-ps__dots{display:grid;grid-template-columns:repeat(var(--count),minmax(34px,1fr));gap:6px}
      #${WIZARD_ID} .uxq-ps__dot{display:grid;place-items:center;min-height:28px;border:1px solid rgba(181,205,255,.2);border-radius:999px;color:#8fa5c8;font-size:.76rem}
      #${WIZARD_ID} .uxq-ps__dot.is-active{background:#6ee7ff;color:#071124;font-weight:950}
      #${WIZARD_ID} .uxq-ps__dot.is-done{border-color:rgba(121,237,165,.5);color:#79eda5}
      #${WIZARD_ID} .uxq-ps__panel{display:none;gap:14px;padding:16px;border:1px solid rgba(110,231,255,.28);border-radius:18px;background:linear-gradient(135deg,rgba(19,73,122,.18),rgba(42,29,97,.18))}
      #${WIZARD_ID} .uxq-ps__panel.is-active{display:grid}
      #${WIZARD_ID} h3{margin:0;color:#fff;font-size:clamp(1.2rem,3vw,1.55rem);line-height:1.25}
      #${WIZARD_ID} p{margin:0;color:#d2def2;line-height:1.6}
      #${WIZARD_ID} .uxq-ps__qa{padding:11px 12px;border:1px solid rgba(255,209,102,.35);border-radius:12px;background:rgba(255,209,102,.07);color:#ffe4a4;line-height:1.5}
      #${WIZARD_ID} .uxq-ps__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      #${WIZARD_ID} label{display:grid;gap:7px;min-width:0;color:#fff;font-weight:900}
      #${WIZARD_ID} input,#${WIZARD_ID} textarea{box-sizing:border-box;width:100%;max-width:100%;min-width:0;border:1px solid rgba(181,205,255,.32);border-radius:12px;background:#07142e;color:#fff;font:inherit;line-height:1.5;padding:11px 12px}
      #${WIZARD_ID} input{min-height:49px}
      #${WIZARD_ID} textarea{min-height:150px;resize:vertical}
      #${WIZARD_ID} .uxq-ps__hint{color:#9eb0cf;font-size:.84rem;font-weight:500;line-height:1.45}
      #${WIZARD_ID} .uxq-ps__nav{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #${WIZARD_ID} .uxq-ps__nav button{min-height:48px;border-radius:12px;border:1px solid rgba(110,231,255,.35);font:inherit;font-weight:950;cursor:pointer}
      #${WIZARD_ID} .uxq-ps__prev{background:rgba(255,255,255,.04);color:#dce9ff}
      #${WIZARD_ID} .uxq-ps__next{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}
      #${WIZARD_ID} .uxq-ps__nav button:disabled{opacity:.35;cursor:not-allowed}
      @media(max-width:760px){
        #${WIZARD_ID} .uxq-ps__grid{grid-template-columns:1fr}
        #${WIZARD_ID} .uxq-ps__dots{grid-template-columns:repeat(var(--count),30px);overflow-x:auto;justify-content:start}
        #${WIZARD_ID} .uxq-ps__panel{padding:14px}
        #${WIZARD_ID} textarea{min-height:125px}
      }
    `;
    document.head.appendChild(style);
  }

  function getSpec() {
    return window.CSAI2601_UXQ_STUDIO_PRACTICE_V1?.byId?.(NODE_ID) || null;
  }

  function field(artifact,key) {
    return artifact.querySelector(`[data-studio-key="${CSS.escape(key)}"]`);
  }

  function ensureHiddenField(artifact,key,label) {
    let input = field(artifact,key);
    if (input) return input;
    input = document.createElement('textarea');
    input.hidden = true;
    input.dataset.studioKey = key;
    input.dataset.studioLabel = label;
    input.dataset.artifactField = String(artifact.querySelectorAll('[data-studio-key]').length);
    artifact.appendChild(input);
    return input;
  }

  function syncPair(visible, hidden) {
    visible.value = hidden?.value || '';
    visible.addEventListener('input', () => {
      if (!hidden) return;
      hidden.value = visible.value;
      hidden.dispatchEvent(new Event('input',{bubbles:true}));
      hidden.dispatchEvent(new Event('change',{bubbles:true}));
    });
  }

  function textFieldPanel(title, description, sourceField) {
    const section = document.createElement('section');
    section.className = 'uxq-ps__panel';
    section.dataset.title = title;
    section.innerHTML = `<h3>${esc(title)}</h3><p>${esc(description)}</p>`;
    const input = document.createElement('textarea');
    input.placeholder = sourceField?.getAttribute('placeholder') || 'เขียนจากหลักฐานของโครงการจริง';
    input.value = sourceField?.value || '';
    if (sourceField) {
      input.addEventListener('input',() => {
        sourceField.value = input.value;
        sourceField.dispatchEvent(new Event('input',{bubbles:true}));
        sourceField.dispatchEvent(new Event('change',{bubbles:true}));
      });
    }
    section.appendChild(input);
    return section;
  }

  function build() {
    installStyle();
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    const spec = getSpec();
    if (!artifact || !spec?.fields?.length) return false;

    artifact.dataset.previewStudioFinal = '1';
    artifact.querySelectorAll('.studio-policy').forEach(el => el.remove());
    artifact.querySelectorAll('#' + WIZARD_ID).forEach((el,index) => { if(index) el.remove(); });
    if (document.getElementById(WIZARD_ID)) return true;

    const projectId = field(artifact,'projectId');
    const figmaUrl = field(artifact,'figmaUrl');
    const evidenceUrl = ensureHiddenField(artifact,'evidenceUrl','Evidence URL');
    const reflection = field(artifact,'reflection');
    const taskFields = spec.fields.filter(item => !['projectId','figmaUrl','evidenceUrl','reflection'].includes(item.key));

    const wizard = document.createElement('div');
    wizard.id = WIZARD_ID;

    const panels = [];
    const intro = document.createElement('section');
    intro.className = 'uxq-ps__panel';
    intro.dataset.title = 'โจทย์และผลลัพธ์';
    intro.innerHTML = `<h3>${esc(spec.studioTitle || NODE_ID)}</h3><p>${esc(spec.objective || '')}</p><div class="uxq-ps__qa"><strong>CONTENT PREVIEW</strong><br>หน้านี้ใช้ตรวจ UI, ลำดับงาน และความครบของเนื้อหาเท่านั้น ไม่อ่านหรือส่ง Google Sheet</div>`;
    panels.push(intro);

    const setup = document.createElement('section');
    setup.className = 'uxq-ps__panel';
    setup.dataset.title = 'Project และหลักฐาน';
    setup.innerHTML = `<h3>Project และหลักฐานของ ${esc(NODE_ID)}</h3><p>ใช้โครงการเดียวต่อเนื่องถึง W15 และแยกลิงก์ไฟล์ออกจากหลักฐานประกอบให้ชัดเจน</p><div class="uxq-ps__grid"></div>`;
    const grid = setup.querySelector('.uxq-ps__grid');
    const controls = [
      ['Master Project ID',projectId,'เช่น UX2601-รหัสนักศึกษา'],
      ['Master Figma Project URL',figmaUrl,'https://www.figma.com/design/...'],
      ['Evidence URL',evidenceUrl,'https://drive.google.com/... หรือ URL หลักฐาน']
    ];
    controls.forEach(([labelText,hidden,placeholder]) => {
      const label = document.createElement('label');
      label.innerHTML = `${esc(labelText)}<input type="${/URL/.test(labelText)?'url':'text'}" placeholder="${esc(placeholder)}"><span class="uxq-ps__hint">${/Evidence/.test(labelText)?'ใช้สำหรับ screenshot, document หรือหลักฐานเสริม':'ต้องใช้ค่าเดิมต่อเนื่องในสัปดาห์ถัดไป'}</span>`;
      const input = label.querySelector('input');
      syncPair(input,hidden);
      grid.appendChild(label);
    });
    panels.push(setup);

    taskFields.forEach(item => {
      const source = field(artifact,item.key);
      panels.push(textFieldPanel(item.label,item.placeholder || spec.objective || '',source));
    });

    if (reflection) {
      panels.push(textFieldPanel(`Weekly Reflection ${NODE_ID}`,reflection.getAttribute('placeholder') || 'สรุปสิ่งที่เรียนรู้และสิ่งที่จะปรับ',reflection));
    }

    const review = document.createElement('section');
    review.className = 'uxq-ps__panel';
    review.dataset.title = 'QA ตรวจความครบ';
    review.innerHTML = `<h3>ตรวจความครบก่อนออกจาก Preview</h3><div class="uxq-ps__qa">✓ Project ID แยกจาก URL<br>✓ Figma Project URL และ Evidence URL แยกกัน<br>✓ คำตอบเชื่อม User → Task → Evidence → Decision → Proof<br>✓ มี Weekly Reflection<br>✓ ไม่มีการส่ง Google Sheet ในโหมด Preview</div><p>เมื่อ Front-end และเนื้อหาครบทุก Node แล้ว จึงค่อยกลับไปเชื่อม Apps Script ตามแผน</p>`;
    panels.push(review);

    wizard.style.setProperty('--count',String(panels.length));
    wizard.innerHTML = `<div class="uxq-ps__progress"><div class="uxq-ps__top"><b data-ps-title></b><span data-ps-count></span></div><div class="uxq-ps__bar"><i></i></div><div class="uxq-ps__dots">${panels.map((_,i)=>`<span class="uxq-ps__dot">${i+1}</span>`).join('')}</div></div>`;
    panels.forEach(panel => wizard.appendChild(panel));
    const nav = document.createElement('div');
    nav.className = 'uxq-ps__nav';
    nav.innerHTML = '<button type="button" class="uxq-ps__prev">ย้อนกลับ</button><button type="button" class="uxq-ps__next">เริ่มตรวจ</button>';
    wizard.appendChild(nav);
    artifact.appendChild(wizard);

    let current = 0;
    const show = next => {
      current = Math.max(0,Math.min(panels.length-1,next));
      panels.forEach((panel,index) => panel.classList.toggle('is-active',index===current));
      wizard.querySelector('[data-ps-title]').textContent = `ขั้นที่ ${current+1} • ${panels[current].dataset.title}`;
      wizard.querySelector('[data-ps-count]').textContent = `${current+1}/${panels.length}`;
      wizard.querySelector('.uxq-ps__bar i').style.width = `${((current+1)/panels.length)*100}%`;
      wizard.querySelectorAll('.uxq-ps__dot').forEach((dot,index) => {
        dot.classList.toggle('is-active',index===current);
        dot.classList.toggle('is-done',index<current);
      });
      const prev = wizard.querySelector('.uxq-ps__prev');
      const nextBtn = wizard.querySelector('.uxq-ps__next');
      prev.disabled = current===0;
      nextBtn.hidden = current===panels.length-1;
      nextBtn.textContent = current===0 ? 'เริ่มตรวจ' : current===panels.length-2 ? 'ไปหน้า QA' : 'ถัดไป';
    };
    wizard.querySelector('.uxq-ps__prev').addEventListener('click',() => show(current-1));
    wizard.querySelector('.uxq-ps__next').addEventListener('click',() => show(current+1));
    show(0);
    return true;
  }

  let timer = 0;
  function schedule(delay=80) {
    clearTimeout(timer);
    timer = setTimeout(build,delay);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => schedule(100),{once:true});
  else schedule(100);
  new MutationObserver(() => schedule(120)).observe(ROOT,{childList:true,subtree:true});
  [300,800,1600,3000].forEach(ms => setTimeout(build,ms));

  window.UXQPreviewStudioFinalAuthorityV1 = Object.freeze({version:'20260728-PREVIEW-STUDIO-FINAL-V1',build});
})();