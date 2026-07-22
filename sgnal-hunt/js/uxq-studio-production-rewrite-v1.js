/* CSAI2601 UX Quest • Studio Production Rewrite v1
 * Phase 2: canonical Project/Figma artifact plan for W1-W15 + B1-B4.
 * Phase 3: one responsive wizard renderer using the real form controls.
 * Google Sheet remains the official progress authority. localStorage stores draft URL only.
 */
(() => {
  'use strict';

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const PARAMS = new URLSearchParams(location.search || '');
  const NODE_ID = String(PARAMS.get('node') || PARAMS.get('id') || 'W1').trim().toUpperCase();
  const VERSION = '20260722-STUDIO-PRODUCTION-REWRITE-V1';
  const FIGMA_RE = /^https:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|board|slides|make)\//i;

  const PLAN = Object.freeze({
    W1:{phase:'Foundation',mode:'create',title:'UX First Impression Audit',figma:'สร้าง Master Figma Project และ Page: W1 UX Audit',output:'3 Frames: User/Task/Context • Friction/Evidence • Impact/Fix/Test',tasks:['เลือกโครงการจริง','จับหลักฐานหน้าจอ','ระบุ User + Task + Context','วิเคราะห์ Friction + Impact','เสนอ Fix + วิธีทดสอบ']},
    W2:{phase:'Foundation',mode:'reuse',title:'HCD Evidence Lab',figma:'เพิ่ม Page: W2 Evidence & HCD Map ใน Project เดิม',output:'Evidence/Assumption Board + Research Plan + HCD Process Map',tasks:['ใช้ผล W1','เขียนปัญหาโดยไม่ล็อก Solution','แยก Evidence/Assumption','เลือกวิธีเก็บข้อมูล','วาง HCD Process']},
    W3:{phase:'Foundation',mode:'reuse',title:'Cognitive Load Repair',figma:'เพิ่ม Page: W3 Cognitive Repair ใน Project เดิม',output:'Before–After Screen + Psychology Diagnosis + Validation Plan',tasks:['เลือกหน้าจอจาก W1','ระบุ Cognitive Load','จับคู่หลัก Psychology','ทำ Before–After','วางแผนตรวจผล']},
    B1:{phase:'Boss Defense',mode:'defense',title:'Foundation UX Defense',figma:'เพิ่ม Section: B1 Foundation Defense ใน Project เดิม',output:'Evidence Chain W1–W3 + Defense Board + Revision Priority',tasks:['สรุป User/Task/Friction','แยก Evidence/Assumption','อธิบาย Psychology','ปกป้อง Fix','กำหนด Test/Revision']},
    W4:{phase:'Research',mode:'reuse',title:'User Research & Persona Lite',figma:'เพิ่ม Page: W4 Research & Persona ใน Project เดิม',output:'Interview Evidence + Quote/Behaviour/Pain Point + Persona Lite',tasks:['กำหนด Research Objective','เขียนคำถามไม่ชี้นำ','เก็บ Quote/Behaviour','สร้าง Persona Lite','หา Design Opportunity']},
    W5:{phase:'Define',mode:'reuse',title:'Problem & Ideation Studio',figma:'เพิ่ม Page: W5 Problem-HMW-Storyboard ใน Project เดิม',output:'Problem Statement + Root Cause + HMW + Concept Storyboard',tasks:['สกัด Insight','เขียน Problem Statement','หา Root Cause','สร้าง HMW/แนวคิด','ทำ Storyboard']},
    W6:{phase:'IA',mode:'reuse',title:'IA & User Flow Studio',figma:'เพิ่ม Page: W6 Sitemap & User Flow ใน Project เดิม',output:'Sitemap + Main Flow + Decision/Error/Alternative Path',tasks:['จัดกลุ่ม Content','ทำ Sitemap','วาง Happy Path','เพิ่ม Decision/Error Path','ตรวจ Bottleneck']},
    W7:{phase:'Wireframe',mode:'reuse',title:'Low-fi Wireframe Studio',figma:'เพิ่ม Page: W7 Low-fi Wireframe ใน Project เดิม',output:'Low-fi Wireframe 5 Screens + Hierarchy + CTA + Mobile-first',tasks:['เลือก Main Flow','ร่าง 5 Screens','จัดลำดับความสำคัญ','วาง CTA/Grid','ตรวจ Mobile-first']},
    B2:{phase:'Boss Defense',mode:'defense',title:'Research-to-Wireframe Defense',figma:'เพิ่ม Section: B2 Research-to-Wireframe Defense',output:'Research → Problem → IA → Flow → Wireframe Evidence Chain',tasks:['สรุป Research Insight','ปกป้อง Problem','ตรวจ Flow','ปกป้อง Wireframe','กำหนด Revision']},
    W8:{phase:'Midterm',mode:'reuse',title:'Midterm UX Blueprint',figma:'เพิ่ม Page: W8 Midterm Blueprint ใน Project เดิม',output:'รวม W1–W7 + Evidence Gap + Peer Critique + Revision Plan',tasks:['รวม Artifact','ตรวจ Evidence Chain','หา Mismatch','รับ Peer Critique','เขียน Revision Plan']},
    W9:{phase:'UI System',mode:'reuse',title:'Pattern Library & Design System',figma:'เพิ่ม Page: W9 UI Kit ใน Project เดิม',output:'Component Inventory + Variants/States + Naming + Tokens',tasks:['สำรวจ Component','รวม Pattern','กำหนด Variants/States','ตั้ง Naming/Tokens','ตรวจ Consistency']},
    W10:{phase:'Responsive',mode:'reuse',title:'Responsive & Accessibility Studio',figma:'เพิ่ม Page: W10 Responsive-A11y ใน Project เดิม',output:'Desktop/Mobile Layout + Breakpoints + Accessibility Audit',tasks:['ตรวจ Layout','ปรับ Responsive','อธิบาย Breakpoint','Audit Accessibility','บันทึก Fix']},
    W11:{phase:'Visual System',mode:'reuse',title:'Visual Style Guide',figma:'เพิ่ม Page: W11 Visual Style Guide ใน Project เดิม',output:'Color Tokens + Type Scale + Spacing + Status + Contrast',tasks:['กำหนด Color Tokens','วาง Type Scale','กำหนด Spacing','กำหนด Status Colors','ตรวจ Accessibility']},
    B3:{phase:'Boss Defense',mode:'defense',title:'Interface System Defense',figma:'เพิ่ม Section: B3 Interface System Defense',output:'Design System + Responsive + Accessibility Evidence Defense',tasks:['ตรวจ Component System','ปกป้อง Responsive','ตรวจ Accessibility','เชื่อม Visual Tokens','จัด Revision']},
    W12:{phase:'Interaction',mode:'reuse',title:'Interaction & Component States',figma:'เพิ่ม Page: W12 Component States ใน Project เดิม',output:'Loading/Empty/Error/Success/Confirmation + Recovery + Microcopy',tasks:['สำรวจ Interaction','กำหนด States','เขียน Microcopy','ออกแบบ Recovery','ตรวจ Prevention']},
    W13:{phase:'Prototype',mode:'reuse',title:'Hi-fi Prototype Studio',figma:'เพิ่ม Page: W13 Hi-fi Prototype ใน Project เดิม',output:'Clickable Prototype 5–8 Screens + Main/Error/Alternative Path',tasks:['รวม UI System','เชื่อม Main Flow','เพิ่ม Overlay/States','เพิ่ม Error Path','ทดลอง Task']},
    W14:{phase:'Validation',mode:'reuse',title:'Usability Test & Iteration',figma:'เพิ่ม Page: W14 Usability Iteration ใน Project เดิม',output:'Test Protocol + Findings/Severity + Before–After Fix + Retest',tasks:['เขียน Protocol','ทดสอบผู้ใช้','จัด Findings/Severity','แก้ Prototype','วาง Retest']},
    B4:{phase:'Boss Defense',mode:'defense',title:'Prototype Validation Defense',figma:'เพิ่ม Section: B4 Validation Defense ใน Project เดิม',output:'Test Evidence + Severity Defense + Iteration Defense + Retest Priority',tasks:['อ่าน Test Evidence','จัด Severity','ปกป้อง Fix','ตรวจ Before–After','กำหนด Retest']},
    W15:{phase:'Portfolio',mode:'reuse',title:'Final UX/UI Case Study Portfolio',figma:'เพิ่ม Page: W15 Case Study Portfolio ใน Project เดิม',output:'Evidence → Decision → Design → Test → Iteration Case Study',tasks:['จัด Story','เลือก Evidence','แสดง Design Evolution','สรุป Test/Iteration','เตรียมนำเสนอ']}
  });

  const META = PLAN[NODE_ID];
  if (!META) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const isFigma = value => FIGMA_RE.test(String(value || '').trim());

  function identityKey() {
    let profile = {};
    try { profile = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return `${String(profile.studentId || PARAMS.get('studentId') || PARAMS.get('sid') || 'anonymous').trim()}::${String(profile.section || PARAMS.get('section') || 'default').trim()}`;
  }
  const masterKey = () => `uxq.csai2601.masterFigma.v2.${identityKey()}`;
  function readMaster() { try { const value = localStorage.getItem(masterKey()) || ''; return isFigma(value) ? value : ''; } catch (_) { return ''; } }
  function saveMaster(value) { if (!isFigma(value)) return; try { localStorage.setItem(masterKey(), String(value).trim()); } catch (_) {} }

  function installStyle() {
    if (document.getElementById('uxq-production-rewrite-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'uxq-production-rewrite-style-v1';
    style.textContent = `
      .artifact[data-production-rewrite='1']>:not(.studio-head):not(.uxq-pr){display:none!important}
      .uxq-pr{display:grid;gap:14px;margin-top:14px}.uxq-pr__progress{position:sticky;top:8px;z-index:60;padding:12px;border:1px solid rgba(110,231,255,.38);border-radius:16px;background:rgba(5,18,42,.97);box-shadow:0 12px 34px rgba(0,0,0,.32)}
      .uxq-pr__top{display:flex;justify-content:space-between;gap:12px;align-items:center}.uxq-pr__top b{color:#fff}.uxq-pr__top span{color:#b9cae5;font-size:.78rem}.uxq-pr__bar{height:7px;margin-top:8px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}.uxq-pr__bar i{display:block;height:100%;background:linear-gradient(90deg,#6ee7ff,#79eda5);transition:width .2s}
      .uxq-pr__dots{display:grid;grid-template-columns:repeat(var(--count),minmax(30px,1fr));gap:5px;margin-top:8px}.uxq-pr__dot{padding:5px;text-align:center;border:1px solid rgba(181,205,255,.2);border-radius:999px;color:#8396b7;font-size:.64rem}.uxq-pr__dot.is-active{background:#6ee7ff;color:#071124;font-weight:950}.uxq-pr__dot.is-done{color:#79eda5;border-color:rgba(121,237,165,.45)}
      .uxq-pr__panel{display:none;gap:14px}.uxq-pr__panel.is-active{display:grid}.uxq-pr__brief,.uxq-pr__figma,.uxq-pr__review{display:grid;gap:10px;padding:15px;border:1px solid rgba(110,231,255,.3);border-radius:15px;background:linear-gradient(135deg,rgba(19,73,122,.22),rgba(42,29,97,.2))}.uxq-pr h3,.uxq-pr h4{margin:0;color:#fff}.uxq-pr p{margin:0;color:#d3e0f4;line-height:1.55}.uxq-pr ol,.uxq-pr ul{margin:0;padding-left:1.25rem;display:grid;gap:6px;color:#dce8fb;line-height:1.5}
      .uxq-pr__deliverable{padding:12px;border:1px solid rgba(255,209,102,.35);border-radius:13px;background:rgba(255,209,102,.07)}.uxq-pr__deliverable b{display:block;color:#ffe3a0;margin-bottom:4px}.uxq-pr__cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.uxq-pr__cards span{padding:9px;border:1px solid rgba(181,205,255,.18);border-radius:11px;background:rgba(3,13,31,.36);color:#dce8fa;font-size:.78rem;line-height:1.35}
      .uxq-pr__figmaActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.uxq-pr__button{display:grid;place-items:center;min-height:46px;padding:10px 13px;border-radius:12px;text-decoration:none;font-weight:950}.uxq-pr__button.primary{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}.uxq-pr__button.secondary{border:1px solid rgba(110,231,255,.38);color:#e2eeff;background:rgba(255,255,255,.04)}
      .uxq-pr__url{display:grid;gap:6px}.uxq-pr__url label{font-weight:900;color:#fff}.uxq-pr__url input{width:100%;min-height:48px;padding:10px 12px;border:1px solid rgba(181,205,255,.32);border-radius:12px;background:#07142e;color:#fff;font:inherit}.uxq-pr__status{padding:8px 10px;border-radius:10px;font-size:.79rem}.uxq-pr__status[data-state='ok']{color:#82efb4;background:rgba(82,224,147,.1)}.uxq-pr__status[data-state='bad']{color:#ffabb8;background:rgba(255,91,115,.1)}.uxq-pr__status[data-state='empty']{color:#ffd98a;background:rgba(255,209,102,.08)}
      .uxq-pr__panel .studio-field,.uxq-pr__panel .studio-checks,.uxq-pr__panel .studio-validation,.uxq-pr__panel .actions{display:grid!important}.uxq-pr__panel .studio-field{gap:6px}.uxq-pr__panel .studio-field>b{color:#fff}.uxq-pr__panel textarea{min-height:150px!important;max-height:360px!important;line-height:1.5!important}.uxq-pr__panel [data-studio-key='figmaUrl']{display:none!important}
      .uxq-pr__nav{display:grid;grid-template-columns:1fr 1fr;gap:9px}.uxq-pr__nav button{min-height:47px;border-radius:12px;border:1px solid rgba(110,231,255,.35);font:inherit;font-weight:950;cursor:pointer}.uxq-pr__prev{background:rgba(255,255,255,.04);color:#dce9ff}.uxq-pr__next{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}.uxq-pr__nav button:disabled{opacity:.35;cursor:not-allowed}
      body[data-device-mode='pc'] .uxq-pr__panel.is-active{grid-template-columns:minmax(300px,.8fr) minmax(0,1.3fr);align-items:start}.uxq-pr__panel>.uxq-pr__brief,.uxq-pr__panel>.uxq-pr__figma{grid-column:1}.uxq-pr__panel>.studio-field,.uxq-pr__panel>.studio-checks,.uxq-pr__panel>.studio-validation,.uxq-pr__panel>.actions,.uxq-pr__panel>.uxq-pr__review{grid-column:2}.uxq-pr__panel[data-kind='intro']{grid-template-columns:1fr!important}.uxq-pr__panel[data-kind='intro']>*{grid-column:1!important}
      @media(max-width:900px){body[data-device-mode] .uxq-pr__panel.is-active{grid-template-columns:1fr}.uxq-pr__panel>*{grid-column:1!important}.uxq-pr__cards{grid-template-columns:1fr 1fr}.uxq-pr__figmaActions{grid-template-columns:1fr}}
      @media(max-width:600px){.uxq-pr__progress{top:4px;padding:9px}.uxq-pr__dots{overflow-x:auto;grid-template-columns:repeat(var(--count),30px);justify-content:start}.uxq-pr__cards{grid-template-columns:1fr}.uxq-pr__panel textarea{min-height:115px!important}.uxq-pr__nav{position:sticky;bottom:7px;z-index:55;padding:6px;border-radius:13px;background:rgba(5,18,42,.96)}}
    `;
    document.head.appendChild(style);
  }

  function fieldInput(artifact, key) { return artifact.querySelector(`[data-studio-key="${CSS.escape(key)}"]`); }
  function fieldWrap(artifact, key) { return fieldInput(artifact,key)?.closest('.studio-field'); }

  function restoreControls(artifact) {
    artifact.querySelectorAll('.uxq-gs__panel,.uxq-wizard-panel').forEach(panel => {
      panel.querySelectorAll(':scope > .studio-field,:scope > .studio-checks,:scope > .studio-validation,:scope > .actions').forEach(control => artifact.appendChild(control));
    });
    artifact.querySelectorAll(':scope > .uxq-gs,:scope > .uxq-wizard-progress,:scope > .uxq-wizard-nav,:scope > .w1-guide,:scope > .w1-figma-launcher').forEach(node => node.remove());
  }

  function sanitize(artifact, figmaOriginal) {
    artifact.querySelectorAll('[data-studio-key]').forEach(input => {
      if (input === figmaOriginal) return;
      const move = () => {
        const value = String(input.value || '').trim();
        if (!isFigma(value)) return;
        if (!String(figmaOriginal.value || '').trim()) {
          figmaOriginal.value = value;
          figmaOriginal.dispatchEvent(new Event('input',{bubbles:true}));
          figmaOriginal.dispatchEvent(new Event('change',{bubbles:true}));
        }
        input.value = '';
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      };
      move();
      if (input.dataset.productionFigmaGuard !== '1') {
        input.dataset.productionFigmaGuard='1';
        input.addEventListener('input',move);
        input.addEventListener('paste',() => setTimeout(move,0));
      }
    });
  }

  function build() {
    installStyle();
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact || artifact.dataset.productionRewrite === '1') return;
    const spec = window.CSAI2601_UXQ_STUDIO_PRACTICE_V1?.byId?.(NODE_ID);
    if (!spec?.fields?.length) return;

    restoreControls(artifact);
    const projectWrap = fieldWrap(artifact,'projectId');
    const figmaOriginal = fieldInput(artifact,'figmaUrl');
    const reflectionWrap = fieldWrap(artifact,'reflection');
    const checks = artifact.querySelector(':scope > .studio-checks');
    const validation = artifact.querySelector(':scope > .studio-validation');
    const actions = artifact.querySelector(':scope > .actions');
    const taskSpecs = spec.fields.filter(field => !['projectId','figmaUrl','reflection'].includes(field.key));
    const taskWraps = taskSpecs.map(field => fieldWrap(artifact,field.key)).filter(Boolean);
    if (!projectWrap || !figmaOriginal || !reflectionWrap || !checks || !actions || taskWraps.length < 2) return;

    artifact.dataset.productionRewrite='1';
    artifact.dataset.guidedAll19='1';
    sanitize(artifact,figmaOriginal);

    const projectInput = fieldInput(artifact,'projectId');
    const projectLabel = projectWrap.querySelector('b');
    if (projectLabel) projectLabel.textContent = NODE_ID === 'W1' ? 'Master Project ID' : 'Master Project ID เดิม';
    if (projectInput) projectInput.placeholder = NODE_ID === 'W1' ? 'เช่น UX2601-รหัสนักศึกษา' : 'ใช้รหัสเดียวกับ W1';

    const remembered = readMaster();
    if (META.mode !== 'create' && !String(figmaOriginal.value || '').trim() && remembered) {
      figmaOriginal.value=remembered;
      figmaOriginal.dispatchEvent(new Event('input',{bubbles:true}));
      figmaOriginal.dispatchEvent(new Event('change',{bubbles:true}));
    }

    const panels=[];
    const panel=(title,subtitle,kind='task') => {
      const section=document.createElement('section'); section.className='uxq-pr__panel'; section.dataset.title=title; section.dataset.subtitle=subtitle||''; section.dataset.kind=kind; return section;
    };

    const intro=panel('โจทย์และชิ้นงาน',META.phase,'intro');
    intro.innerHTML=`<div class="uxq-pr__brief"><p class="kicker">${esc(NODE_ID)} • ${esc(META.phase)}</p><h3>${esc(META.title)}</h3><p>${esc(spec.objective || '')}</p><div class="uxq-pr__deliverable"><b>Phase 2 • Artifact ใน Project เดิม</b><p>${esc(META.figma)}</p><p><strong>ผลลัพธ์:</strong> ${esc(META.output)}</p></div><div class="uxq-pr__cards">${META.tasks.map((task,index)=>`<span>${index+1}. ${esc(task)}</span>`).join('')}</div></div>`;
    panels.push(intro);

    const project=panel(META.mode==='create'?'สร้าง Master Project':'เปิด Project เดิม','Project + Figma');
    const openHref=META.mode==='create'?'https://www.figma.com/files/':(remembered||'https://www.figma.com/files/');
    project.innerHTML=`<div class="uxq-pr__figma"><h3>${esc(META.figma)}</h3><p>${META.mode==='create'?'สร้างไฟล์หลักเพียงครั้งเดียว และใช้ไฟล์นี้ต่อเนื่องถึง W15':META.mode==='defense'?'ใช้หลักฐานจาก Weeks ก่อนหน้า ห้ามสร้าง Project ใหม่':'เพิ่ม Page หรือ Section ของสัปดาห์นี้ใน Master Project เดิม'}</p><div class="uxq-pr__figmaActions"><a class="uxq-pr__button primary" href="${esc(openHref)}" target="_blank" rel="noopener noreferrer">${META.mode==='create'?'สร้าง Master Figma Project':'เปิด Master Project เดิม'} ↗</a><a class="uxq-pr__button secondary" href="#" data-open-current aria-disabled="true">เปิดลิงก์ที่วาง</a></div><div class="uxq-pr__url"><label>Project / Evidence URL</label><input type="url" inputmode="url" autocomplete="off" data-production-url placeholder="https://www.figma.com/design/..."><div class="uxq-pr__status" data-state="empty">ยังไม่ได้วางลิงก์ Figma</div></div></div>`;
    project.appendChild(projectWrap); panels.push(project);

    taskWraps.forEach((wrap,index)=>{
      const field=taskSpecs[index]; const step=panel(field.label,`ส่วน ${index+1}/${taskWraps.length}`);
      step.innerHTML=`<div class="uxq-pr__brief"><h3>${esc(field.label)}</h3><p>${esc(field.placeholder || META.tasks[index] || spec.objective || '')}</p><div class="uxq-pr__deliverable"><b>เขียนให้ตรวจสอบได้</b><p>เชื่อม User → Task → Evidence → Decision → Proof และระบุตัวอย่างจาก Project จริง</p></div></div>`;
      step.appendChild(wrap); panels.push(step);
    });

    const reflection=panel('Weekly Reflection','สรุปสิ่งที่เรียนรู้');
    reflection.innerHTML=`<div class="uxq-pr__brief"><h3>Reflection ${esc(NODE_ID)}</h3><p>${esc(spec.reflectionPrompt || 'สรุปสิ่งที่เรียนรู้จากหลักฐานและการตัดสินใจ')}</p></div>`;
    reflection.appendChild(reflectionWrap); panels.push(reflection);

    const review=panel('ตรวจและส่ง','Phase 3 • Review + Submit');
    review.innerHTML=`<div class="uxq-pr__review"><h3>ตรวจความครบก่อนส่ง</h3><p>Project URL ต้องเปิดได้ คำตอบทุกส่วนต้องเป็นคำอธิบาย ไม่ใช่ URL และ Self-check ต้องตรงกับงานจริง</p><div class="uxq-pr__deliverable"><b>${esc(META.output)}</b><p>ส่ง Studio Artifact และ Weekly Reflection เข้า Google Sheet</p></div></div>`;
    review.appendChild(checks); if(validation) review.appendChild(validation); review.appendChild(actions); panels.push(review);

    const wizard=document.createElement('div'); wizard.className='uxq-pr'; wizard.style.setProperty('--count',String(panels.length));
    wizard.innerHTML=`<div class="uxq-pr__progress"><div class="uxq-pr__top"><b data-pr-title></b><span data-pr-count></span></div><div class="uxq-pr__bar"><i></i></div><div class="uxq-pr__dots">${panels.map((_,index)=>`<span class="uxq-pr__dot">${index+1}</span>`).join('')}</div></div>`;
    panels.forEach(item=>wizard.appendChild(item));
    const nav=document.createElement('div'); nav.className='uxq-pr__nav'; nav.innerHTML='<button type="button" class="uxq-pr__prev">ย้อนกลับ</button><button type="button" class="uxq-pr__next">เริ่มทำ</button>'; wizard.appendChild(nav);
    artifact.appendChild(wizard);

    const urlInput=wizard.querySelector('[data-production-url]');
    const status=wizard.querySelector('.uxq-pr__status');
    const openCurrent=wizard.querySelector('[data-open-current]');
    const syncUrl=source=>{
      const value=String(source.value||'').trim();
      if(source!==figmaOriginal){figmaOriginal.value=value;figmaOriginal.dispatchEvent(new Event('input',{bubbles:true}));figmaOriginal.dispatchEvent(new Event('change',{bubbles:true}));}
      else if(urlInput.value!==value)urlInput.value=value;
      if(!value){status.dataset.state='empty';status.textContent='ยังไม่ได้วางลิงก์ Figma';openCurrent.href='#';openCurrent.setAttribute('aria-disabled','true');}
      else if(!isFigma(value)){status.dataset.state='bad';status.textContent='URL ไม่ถูกต้อง ต้องเป็นลิงก์ Figma';openCurrent.href='#';openCurrent.setAttribute('aria-disabled','true');}
      else{status.dataset.state='ok';status.textContent=META.mode==='create'?'Master Figma Project พร้อมใช้ต่อเนื่อง':'Project / Evidence URL พร้อมส่ง';openCurrent.href=value;openCurrent.target='_blank';openCurrent.rel='noopener noreferrer';openCurrent.removeAttribute('aria-disabled');saveMaster(value);}
    };
    urlInput.value=figmaOriginal.value||remembered||''; syncUrl(urlInput);
    urlInput.addEventListener('input',()=>syncUrl(urlInput)); figmaOriginal.addEventListener('input',()=>syncUrl(figmaOriginal));
    openCurrent.addEventListener('click',event=>{if(openCurrent.getAttribute('aria-disabled')==='true')event.preventDefault();});

    let current=0;
    const show=next=>{
      current=Math.max(0,Math.min(panels.length-1,next));
      panels.forEach((item,index)=>item.classList.toggle('is-active',index===current));
      wizard.querySelector('[data-pr-title]').textContent=`ขั้นที่ ${current+1} • ${panels[current].dataset.title}`;
      wizard.querySelector('[data-pr-count]').textContent=`${current+1}/${panels.length}`;
      wizard.querySelector('.uxq-pr__bar i').style.width=`${((current+1)/panels.length)*100}%`;
      wizard.querySelectorAll('.uxq-pr__dot').forEach((dot,index)=>{dot.classList.toggle('is-active',index===current);dot.classList.toggle('is-done',index<current);});
      const prev=wizard.querySelector('.uxq-pr__prev'),nextBtn=wizard.querySelector('.uxq-pr__next');
      prev.disabled=current===0; nextBtn.hidden=current===panels.length-1; nextBtn.textContent=current===0?'เริ่มทำ':current===panels.length-2?'ไปตรวจและส่ง':'ถัดไป';
      wizard.querySelector('.uxq-pr__progress')?.scrollIntoView?.({behavior:'smooth',block:'start'});
    };
    wizard.querySelector('.uxq-pr__prev').addEventListener('click',()=>show(current-1));
    wizard.querySelector('.uxq-pr__next').addEventListener('click',()=>show(current+1));
    show(0);

    window.dispatchEvent(new CustomEvent('uxq-studio-production-rewrite-ready',{detail:{nodeId:NODE_ID,meta:META,version:VERSION}}));
  }

  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(build,100);};
  installStyle();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(ROOT,{childList:true,subtree:true});
  window.addEventListener('uxq-mission-resume-studio',schedule);
  window.addEventListener('uxq-direct-studio-confirmed',schedule);

  window.UXQStudioProductionRewriteV1=Object.freeze({version:VERSION,plan:PLAN,build,readMaster});
})();