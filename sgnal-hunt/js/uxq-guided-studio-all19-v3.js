/* CSAI2601 UX Quest • Guided Studio Engine ALL19 v3
 * W1-W15 + B1-B4 front-end production workflow.
 * Reuses canonical fields, draft, validation and submit controls.
 * Does not change Sheet schema, Apps Script, or official data.
 */
(() => {
  'use strict';

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE_ID = String(new URLSearchParams(location.search).get('node') || 'W1').trim().toUpperCase();
  const PACK = window.CSAI2601_UXQ_STUDIO_PRACTICE_V1;
  const SPEC = PACK?.byId?.(NODE_ID);
  if (!SPEC) return;

  let currentStep = 0;
  let observer;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  const isBoss = /^B\d+$/.test(NODE_ID);
  const artifactKind = isBoss ? 'Defense Board' : 'Studio Board';

  function installStyle() {
    if (document.getElementById('uxq-guided-all19-style-v3')) return;
    const s = document.createElement('style');
    s.id = 'uxq-guided-all19-style-v3';
    s.textContent = `
      .artifact[data-guided-all19='1']{position:relative;display:grid!important;gap:14px!important}
      .artifact[data-guided-all19='1']>.studio-flow,.artifact[data-guided-all19='1']>.studio-policy,
      .artifact[data-guided-all19='1']>.studio-field,.artifact[data-guided-all19='1']>.studio-checks,
      .artifact[data-guided-all19='1']>.studio-validation,.artifact[data-guided-all19='1']>.actions,
      .artifact[data-guided-all19='1']>.w1-guide,.artifact[data-guided-all19='1']>.w1-figma-launcher,
      .artifact[data-guided-all19='1']>.uxq-wizard-progress,.artifact[data-guided-all19='1']>.uxq-wizard-panel,
      .artifact[data-guided-all19='1']>.uxq-wizard-nav{display:none!important}
      .uxq-gs{display:grid;gap:14px}
      .uxq-gs__progress{position:sticky;top:8px;z-index:30;padding:12px;border:1px solid rgba(110,231,255,.36);border-radius:16px;background:rgba(5,18,42,.97);box-shadow:0 12px 32px rgba(0,0,0,.28);backdrop-filter:blur(12px)}
      .uxq-gs__progressTop{display:flex;justify-content:space-between;gap:12px;align-items:center}.uxq-gs__progressTop b{font-size:1rem;color:#fff}.uxq-gs__progressTop span{font-size:.78rem;color:#c0d2ef}
      .uxq-gs__bar{height:8px;margin-top:9px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}.uxq-gs__bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#6ee7ff,#79eda5);transition:width .2s ease}
      .uxq-gs__dots{display:grid;grid-template-columns:repeat(var(--steps),minmax(0,1fr));gap:5px;margin-top:8px}.uxq-gs__dot{padding:5px 3px;border:1px solid rgba(181,205,255,.18);border-radius:999px;text-align:center;font-size:.62rem;color:#8496b8}.uxq-gs__dot.is-active{background:#6ee7ff;color:#071124;border-color:#6ee7ff;font-weight:950}.uxq-gs__dot.is-done{color:#79eda5;border-color:rgba(121,237,165,.48)}
      .uxq-gs__panel{display:none;gap:13px}.uxq-gs__panel.is-active{display:grid}
      .uxq-gs__brief{display:grid;gap:10px;padding:15px;border:1px solid rgba(110,231,255,.27);border-radius:15px;background:linear-gradient(135deg,rgba(19,73,122,.22),rgba(42,29,97,.2))}.uxq-gs__brief h3,.uxq-gs__brief h4{margin:0;color:#fff}.uxq-gs__brief p{margin:0;color:#d4e2f8;line-height:1.55}.uxq-gs__brief ol,.uxq-gs__brief ul{margin:0;padding-left:1.3rem;display:grid;gap:7px;color:#dce9ff;line-height:1.5}
      .uxq-gs__artifact{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.uxq-gs__artifact article{padding:12px;border:1px solid rgba(181,205,255,.2);border-radius:13px;background:rgba(3,13,31,.36)}.uxq-gs__artifact b{display:block;color:#fff;margin-bottom:5px}.uxq-gs__artifact small{display:block;color:#adc0df;line-height:1.45}
      .uxq-gs__figma{display:grid;gap:10px;padding:14px;border:1px solid rgba(110,231,255,.4);border-radius:15px;background:rgba(16,56,105,.32)}.uxq-gs__figma h3{margin:0}.uxq-gs__figmaActions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.uxq-gs__open{display:grid;place-items:center;min-height:46px;padding:10px 14px;border-radius:12px;background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124;text-decoration:none;font-weight:950}.uxq-gs__verify{display:grid;place-items:center;min-height:46px;padding:10px 14px;border:1px solid rgba(110,231,255,.38);border-radius:12px;color:#e2eeff;text-decoration:none;font-weight:850;background:rgba(255,255,255,.04)}
      .uxq-gs__url{display:grid;gap:7px}.uxq-gs__url label{font-weight:900;color:#fff}.uxq-gs__url input{width:100%;min-height:48px;padding:10px 12px;border:1px solid rgba(181,205,255,.32);border-radius:12px;background:#07142e;color:#fff;font:inherit}.uxq-gs__urlStatus{padding:8px 10px;border-radius:10px;font-size:.78rem;font-weight:800}.uxq-gs__urlStatus[data-state='empty']{color:#ffd98a;background:rgba(255,209,102,.08)}.uxq-gs__urlStatus[data-state='bad']{color:#ff9fae;background:rgba(255,91,115,.1)}.uxq-gs__urlStatus[data-state='ok']{color:#83efb5;background:rgba(82,224,147,.1)}
      .uxq-gs__fieldProgress{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.uxq-gs__fieldState{padding:9px 10px;border:1px solid rgba(181,205,255,.18);border-radius:11px;background:rgba(3,13,31,.34);font-size:.76rem;color:#aebfda}.uxq-gs__fieldState.is-ready{color:#82efb4;border-color:rgba(82,224,147,.38)}
      .uxq-gs__panel .studio-field,.uxq-gs__panel .studio-checks,.uxq-gs__panel .studio-validation,.uxq-gs__panel .actions{display:grid!important}
      .uxq-gs__panel .studio-field{gap:6px}.uxq-gs__panel .studio-field>b{font-size:.95rem;color:#fff}.uxq-gs__panel textarea{min-height:130px!important;line-height:1.5!important}.uxq-gs__panel textarea[data-format='url']{display:none!important}
      .uxq-gs__nav{display:grid;grid-template-columns:1fr 1fr;gap:9px}.uxq-gs__nav button{min-height:47px;border-radius:12px;border:1px solid rgba(110,231,255,.35);font:inherit;font-weight:950;cursor:pointer}.uxq-gs__prev{background:rgba(255,255,255,.04);color:#dce9ff}.uxq-gs__next{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}.uxq-gs__nav button:disabled{opacity:.35;cursor:not-allowed}
      .uxq-gs__quality{display:grid;gap:8px;padding:12px;border:1px solid rgba(255,209,102,.32);border-radius:13px;background:rgba(255,209,102,.06)}.uxq-gs__quality b{color:#ffe4a3}.uxq-gs__quality p{margin:0;color:#d7e4f7;line-height:1.5;font-size:.84rem}
      @media(max-width:760px){
        .uxq-gs__progress{top:4px;padding:9px}.uxq-gs__progressTop b{font-size:.86rem}.uxq-gs__progressTop span{font-size:.68rem}.uxq-gs__dots{grid-template-columns:repeat(var(--steps),28px);overflow-x:auto;justify-content:start;padding-bottom:3px}.uxq-gs__dot{font-size:.56rem;padding:4px 2px}
        .uxq-gs__artifact{grid-template-columns:1fr}.uxq-gs__brief,.uxq-gs__figma{padding:12px}.uxq-gs__brief p,.uxq-gs__brief li{font-size:.88rem}.uxq-gs__figmaActions{grid-template-columns:1fr}.uxq-gs__fieldProgress{grid-template-columns:1fr}
        .uxq-gs__nav{position:sticky;bottom:8px;z-index:26;padding:7px;border-radius:13px;background:rgba(5,18,42,.96);box-shadow:0 8px 22px rgba(0,0,0,.32)}.uxq-gs__nav button{min-height:44px;font-size:.84rem}
        .uxq-gs__panel textarea{font-size:1rem!important;min-height:145px!important}.uxq-gs__open,.uxq-gs__verify{min-height:44px;font-size:.84rem}
      }
    `;
    document.head.appendChild(s);
  }

  function fieldWrap(artifact, key) {
    return artifact.querySelector(`[data-studio-key="${CSS.escape(key)}"]`)?.closest('.studio-field') || null;
  }

  function inputFor(artifact, key) {
    return artifact.querySelector(`[data-studio-key="${CSS.escape(key)}"]`) || null;
  }

  function makePanel(index, title, subtitle) {
    const section = document.createElement('section');
    section.className = 'uxq-gs__panel';
    section.dataset.guidedStep = String(index);
    section.dataset.title = title;
    section.dataset.subtitle = subtitle || '';
    return section;
  }

  function add(panel, elements) {
    elements.filter(Boolean).forEach(el => panel.appendChild(el));
  }

  function meaningfulFields() {
    return SPEC.fields.filter(f => !['projectId','figmaUrl','reflection'].includes(f.key));
  }

  function assignmentFrames() {
    const task = meaningfulFields();
    return task.slice(0,3).map((f,index) => ({
      title:`${isBoss ? 'Section' : 'Frame'} ${String.fromCharCode(65 + index)}`,
      detail:f.label
    }));
  }

  function urlOkay(value) {
    try {
      const u = new URL(String(value || '').trim());
      return u.protocol === 'https:' && /(^|\.)figma\.com$/i.test(u.hostname);
    } catch (_) { return false; }
  }

  function cleanPrevious(artifact) {
    artifact.querySelectorAll(':scope > .w1-guide,:scope > .w1-figma-launcher,:scope > .uxq-wizard-progress,:scope > .uxq-wizard-nav').forEach(el => el.remove());
    artifact.querySelectorAll(':scope > .uxq-wizard-panel').forEach(wrapper => {
      while (wrapper.firstChild) artifact.insertBefore(wrapper.firstChild, wrapper);
      wrapper.remove();
    });
    delete artifact.dataset.mobileWizard;
    delete artifact.dataset.w1Guided;
  }

  function build() {
    installStyle();
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact || artifact.dataset.guidedAll19 === '1') return;

    const project = fieldWrap(artifact,'projectId');
    const figmaField = fieldWrap(artifact,'figmaUrl');
    const figmaOriginal = inputFor(artifact,'figmaUrl');
    const reflection = fieldWrap(artifact,'reflection');
    const checks = artifact.querySelector('.studio-checks');
    const validation = artifact.querySelector('.studio-validation');
    const actions = artifact.querySelector(':scope > .actions');
    const tasks = meaningfulFields().map(f => fieldWrap(artifact,f.key)).filter(Boolean);
    if (!project || !figmaField || !figmaOriginal || !reflection || !checks || !actions || tasks.length < 2) return;

    cleanPrevious(artifact);
    artifact.dataset.guidedAll19 = '1';

    const panels = [];
    const p0 = makePanel(0,'โจทย์และชิ้นงาน','อ่านให้เข้าใจก่อนเริ่ม');
    const frames = assignmentFrames();
    p0.innerHTML = `<div class="uxq-gs__brief"><h3>${esc(NODE_ID)} • ${esc(SPEC.studioTitle)}</h3><p>${esc(SPEC.objective)}</p><div class="uxq-gs__artifact">${frames.map(f=>`<article><b>${esc(f.title)}</b><small>${esc(f.detail)}</small></article>`).join('')}</div><div class="uxq-gs__quality"><b>ผลลัพธ์ที่ต้องส่ง</b><p>${esc(SPEC.canonicalArtifact)} พร้อม Project ID, Figma URL, คำอธิบายจากหลักฐาน, Reflection และ Self-check ครบทุกข้อ</p></div></div>`;
    panels.push(p0);

    const p1 = makePanel(1,'ตั้งโครงการและเปิด Figma','ใช้ Project ID เดียวต่อเนื่อง');
    p1.innerHTML = `<div class="uxq-gs__figma"><h3>สร้าง ${esc(artifactKind)} ใน Figma</h3><ol>${SPEC.practiceFlow.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><div class="uxq-gs__figmaActions"><a class="uxq-gs__open" href="https://www.figma.com/files/" target="_blank" rel="noopener noreferrer">เปิด Figma เพื่อสร้างไฟล์ใหม่ ↗</a><span></span></div></div>`;
    add(p1,[project]);
    panels.push(p1);

    tasks.forEach((el,index) => {
      const fieldSpec = meaningfulFields()[index];
      const p = makePanel(panels.length, fieldSpec.label, `กรอกส่วนที่ ${index+1}/${tasks.length}`);
      p.innerHTML = `<div class="uxq-gs__brief"><h3>${esc(fieldSpec.label)}</h3><p>${esc(fieldSpec.placeholder || SPEC.practiceFlow[index] || SPEC.objective)}</p><div class="uxq-gs__quality"><b>เกณฑ์คุณภาพ</b><p>เขียนจากหลักฐานและเหตุผลที่ตรวจสอบได้ เชื่อม User → Task → Evidence → Decision → Proof และหลีกเลี่ยงข้อความกว้าง ๆ ที่ไม่มีตัวอย่าง</p></div></div>`;
      add(p,[el]);
      panels.push(p);
    });

    const pr = makePanel(panels.length,'Reflection','สรุปการเรียนรู้และสิ่งที่จะปรับ');
    pr.innerHTML = `<div class="uxq-gs__brief"><h3>Reflection ${esc(NODE_ID)}</h3><p>${esc(SPEC.reflectionPrompt || 'สรุปสิ่งที่เรียนรู้จากหลักฐานและการตัดสินใจ')}</p></div>`;
    add(pr,[reflection]);
    panels.push(pr);

    const pf = makePanel(panels.length,'ตรวจลิงก์และส่ง','ตรวจทุกส่วนก่อน Submit');
    pf.innerHTML = `<div class="uxq-gs__figma"><h3>วาง Figma Share URL</h3><p>ใน Figma กด Share → ตั้งสิทธิ์ให้ผู้ตรวจเปิดดูได้ → Copy link → วางด้านล่าง</p><div class="uxq-gs__url"><label for="uxqGsUrl">Figma Share URL</label><input id="uxqGsUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://www.figma.com/design/..."/><div class="uxq-gs__urlStatus" data-state="empty">ยังไม่ได้วางลิงก์ Figma</div></div><div class="uxq-gs__figmaActions"><a class="uxq-gs__open" href="https://www.figma.com/files/" target="_blank" rel="noopener noreferrer">เปิด Figma ↗</a><a class="uxq-gs__verify" href="#" aria-disabled="true">เปิดตรวจลิงก์นี้</a></div></div><div class="uxq-gs__fieldProgress"></div>`;
    add(pf,[figmaField,checks,validation,actions]);
    panels.push(pf);

    const guide = document.createElement('div');
    guide.className = 'uxq-gs';
    guide.style.setProperty('--steps', String(panels.length));
    guide.innerHTML = `<div class="uxq-gs__progress"><div class="uxq-gs__progressTop"><b data-gs-title></b><span data-gs-count></span></div><div class="uxq-gs__bar"><i></i></div><div class="uxq-gs__dots">${panels.map((_,i)=>`<span class="uxq-gs__dot">${i+1}</span>`).join('')}</div></div>`;
    panels.forEach(p => guide.appendChild(p));
    const nav = document.createElement('div');
    nav.className = 'uxq-gs__nav';
    nav.innerHTML = '<button type="button" class="uxq-gs__prev">ย้อนกลับ</button><button type="button" class="uxq-gs__next">เริ่มทำ</button>';
    guide.appendChild(nav);

    const head = artifact.querySelector('.studio-head');
    head?.insertAdjacentElement('afterend',guide);

    const topUrl = guide.querySelector('#uxqGsUrl');
    const status = guide.querySelector('.uxq-gs__urlStatus');
    const verify = guide.querySelector('.uxq-gs__verify');

    function syncUrl(source) {
      const value = String(source.value || '').trim();
      if (source !== figmaOriginal) {
        figmaOriginal.value = value;
        figmaOriginal.dispatchEvent(new Event('input',{bubbles:true}));
        figmaOriginal.dispatchEvent(new Event('change',{bubbles:true}));
      } else if (topUrl.value !== value) topUrl.value = value;
      if (!value) {
        status.dataset.state='empty'; status.textContent='ยังไม่ได้วางลิงก์ Figma';
        verify.href='#'; verify.setAttribute('aria-disabled','true');
      } else if (!urlOkay(value)) {
        status.dataset.state='bad'; status.textContent='URL ไม่ถูกต้อง ต้องเป็นลิงก์ https://www.figma.com/...';
        verify.href='#'; verify.setAttribute('aria-disabled','true');
      } else {
        status.dataset.state='ok'; status.textContent='ลิงก์ Figma พร้อมส่งและเชื่อมกับฟอร์มแล้ว';
        verify.href=value; verify.removeAttribute('aria-disabled'); verify.target='_blank'; verify.rel='noopener noreferrer';
      }
      updateFieldProgress();
    }

    topUrl.value = figmaOriginal.value || '';
    topUrl.addEventListener('input',()=>syncUrl(topUrl));
    figmaOriginal.addEventListener('input',()=>syncUrl(figmaOriginal));
    verify.addEventListener('click',e=>{if(verify.getAttribute('aria-disabled')==='true')e.preventDefault();});

    function updateFieldProgress() {
      const area = guide.querySelector('.uxq-gs__fieldProgress');
      const fieldSpecs = SPEC.fields;
      area.innerHTML = fieldSpecs.map(f => {
        const input = inputFor(artifact,f.key);
        const value = String(input?.value || '').trim();
        const ready = f.format === 'url' ? urlOkay(value) : value.length >= Number(f.minLength || 1);
        return `<div class="uxq-gs__fieldState ${ready?'is-ready':''}">${ready?'✓':'○'} ${esc(f.label)}</div>`;
      }).join('');
    }

    artifact.querySelectorAll('[data-studio-key]').forEach(input=>input.addEventListener('input',updateFieldProgress));
    nav.querySelector('.uxq-gs__prev').addEventListener('click',()=>show(currentStep-1,guide));
    nav.querySelector('.uxq-gs__next').addEventListener('click',()=>show(currentStep+1,guide));
    syncUrl(figmaOriginal);
    updateFieldProgress();
    show(0,guide);
  }

  function show(next, guide) {
    const panels = Array.from(guide.querySelectorAll('.uxq-gs__panel'));
    currentStep = Math.max(0,Math.min(panels.length-1,next));
    panels.forEach((p,i)=>p.classList.toggle('is-active',i===currentStep));
    const panel = panels[currentStep];
    guide.querySelector('[data-gs-title]').textContent = `ขั้นที่ ${currentStep+1} • ${panel.dataset.title}`;
    guide.querySelector('[data-gs-count]').textContent = `${currentStep+1}/${panels.length}`;
    guide.querySelector('.uxq-gs__bar i').style.width = `${((currentStep+1)/panels.length)*100}%`;
    guide.querySelectorAll('.uxq-gs__dot').forEach((dot,i)=>{dot.classList.toggle('is-active',i===currentStep);dot.classList.toggle('is-done',i<currentStep);});
    const prev = guide.querySelector('.uxq-gs__prev');
    const nextBtn = guide.querySelector('.uxq-gs__next');
    prev.disabled = currentStep===0;
    nextBtn.hidden = currentStep===panels.length-1;
    nextBtn.textContent = currentStep===0?'เริ่มทำ':currentStep===panels.length-2?'ไปตรวจงาน':'ถัดไป';
    guide.querySelector('.uxq-gs__progress')?.scrollIntoView?.({behavior:'smooth',block:'start'});
  }

  function schedule() {
    clearTimeout(schedule.timer);
    schedule.timer = setTimeout(build,100);
  }

  installStyle();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule();
  observer = new MutationObserver(schedule);
  observer.observe(ROOT,{childList:true,subtree:true});
  window.addEventListener('uxq-mission-resume-studio',schedule);
  window.addEventListener('uxq-sheet-progress-restored',schedule);
  window.UXQGuidedStudioAll19V3 = Object.freeze({build,version:'20260722-GUIDED-STUDIO-ALL19-V3'});
})();