/* CSAI2601 UX Quest • Mobile Studio Wizard + Result Status Bridge v1
 * Front-end UX only. Does not write, alter Sheet schema, or change official unlock rules.
 */
(() => {
  'use strict';
  const mq = window.matchMedia('(max-width: 760px)');
  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  let activeStep = 0;

  function installStyle() {
    if (document.getElementById('uxq-mobile-studio-wizard-style-v1')) return;
    const s = document.createElement('style');
    s.id = 'uxq-mobile-studio-wizard-style-v1';
    s.textContent = `
      @media(max-width:760px){
        .uxq-3part{margin:12px 0!important;padding:12px!important;border-radius:17px!important}
        .uxq-3part__head{display:grid!important;grid-template-columns:1fr auto!important;gap:8px!important;margin-bottom:9px!important}
        .uxq-3part__head h3{font-size:1rem!important;line-height:1.25!important}
        .uxq-3part__head p{display:none!important}
        .uxq-3part__count{margin:0!important;padding:5px 8px!important;font-size:.72rem!important}
        .uxq-3part__grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important}
        .uxq-3part__item{min-height:0!important;padding:8px 5px!important;text-align:center!important;border-radius:11px!important}
        .uxq-3part__item b{font-size:.65rem!important;margin:0 0 3px!important}
        .uxq-3part__item span{font-size:.72rem!important;font-weight:850!important}
        .uxq-3part__item small{display:none!important}
        .uxq-3part__foot{font-size:.7rem!important;padding:8px!important;line-height:1.4!important}

        .artifact[data-studio-practice-v1]{padding:12px!important;gap:10px!important;border-radius:18px!important}
        .artifact[data-studio-practice-v1] .studio-head{gap:4px!important}
        .artifact[data-studio-practice-v1] .studio-head .kicker{font-size:.66rem!important}
        .artifact[data-studio-practice-v1] .studio-head h2{font-size:1.3rem!important;line-height:1.15!important}
        .artifact[data-studio-practice-v1] .studio-head>p{font-size:.8rem!important;line-height:1.4!important;margin:0!important}
        .artifact[data-studio-practice-v1] .studio-meta{gap:5px!important}
        .artifact[data-studio-practice-v1] .studio-meta span{font-size:.65rem!important;padding:4px 7px!important}
        .artifact[data-studio-practice-v1] .studio-policy{display:none!important}
        .artifact[data-studio-practice-v1] .studio-flow{display:none!important}

        .uxq-wizard-progress{position:sticky;top:0;z-index:8;margin:2px 0 10px;padding:8px;border:1px solid rgba(110,231,255,.28);border-radius:13px;background:rgba(5,18,42,.96);backdrop-filter:blur(12px)}
        .uxq-wizard-progress__top{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:.72rem;color:#c9d8f2;margin-bottom:7px}
        .uxq-wizard-progress__top b{color:#fff;font-size:.82rem}
        .uxq-wizard-progress__bar{height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}
        .uxq-wizard-progress__bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#6ee7ff,#79eda5);transition:width .2s ease}
        .uxq-wizard-dots{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:7px}
        .uxq-wizard-dot{border:1px solid rgba(181,205,255,.22);border-radius:999px;padding:4px 2px;text-align:center;font-size:.58rem;color:#8294b8}
        .uxq-wizard-dot.is-active{color:#071124;background:#6ee7ff;border-color:#6ee7ff;font-weight:900}
        .uxq-wizard-dot.is-done{color:#79eda5;border-color:rgba(121,237,165,.46)}

        .uxq-wizard-panel{display:none!important}
        .uxq-wizard-panel.is-active{display:grid!important;gap:11px!important}
        .studio-field{gap:5px!important}
        .studio-field b{font-size:.9rem!important;line-height:1.3!important}
        .studio-field textarea{min-height:132px!important;font-size:1rem!important;line-height:1.5!important;padding:12px!important;border-radius:14px!important;resize:vertical!important}
        .studio-field textarea[data-format='url']{min-height:58px!important}
        .studio-checks{padding:11px!important;gap:7px!important}
        .studio-checks h3{font-size:1rem!important}
        .studio-check{display:grid!important;grid-template-columns:26px 1fr!important;gap:9px!important;align-items:start!important;padding:7px 0!important;border-bottom:1px solid rgba(181,205,255,.12)}
        .studio-check:last-child{border-bottom:0}
        .studio-check input{width:22px!important;height:22px!important;margin:1px 0 0!important}
        .studio-check span{font-size:.9rem!important;line-height:1.42!important;word-break:normal!important}

        .uxq-wizard-nav{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
        .uxq-wizard-nav button{min-height:44px;border-radius:12px;border:1px solid rgba(110,231,255,.34);font-weight:900;font-size:.85rem}
        .uxq-wizard-prev{background:rgba(255,255,255,.04);color:#dce9ff}
        .uxq-wizard-next{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}
        .uxq-wizard-nav button:disabled{opacity:.35}
        .artifact[data-studio-practice-v1]>.actions{display:none!important}
        .uxq-wizard-panel[data-step='3'] .actions{display:grid!important;gap:7px!important}
        .uxq-wizard-panel[data-step='3'] .actions .btn{min-height:48px!important;padding:10px!important;font-size:.92rem!important}
        .uxq-wizard-panel[data-step='3'] .actions small{font-size:.7rem!important;line-height:1.4!important;text-align:center!important}
        .studio-validation{font-size:.78rem!important}
      }
    `;
    document.head.appendChild(s);
  }

  function resultMissionPassed() {
    const text = String(ROOT.textContent || '');
    const stars = Number((text.match(/(\d)★\s*BEST STARS/i) || [])[1] || 0);
    return /MISSION COMPLETE/i.test(text) && (/ผ่านแล้ว\s*MISSION/i.test(text) || stars >= 2 || /BEST STARS/i.test(text));
  }

  function bridgeTracker() {
    if (!mq.matches || !resultMissionPassed()) return;
    const tracker = document.getElementById('uxqThreePartCompletion');
    if (!tracker) return;
    const item = tracker.querySelector('.uxq-3part__item');
    if (item) {
      item.dataset.state = 'done';
      const status = item.querySelector('span');
      const detail = item.querySelector('small');
      if (status) status.textContent = 'ผ่านแล้ว';
      if (detail) detail.textContent = 'ผล Mission ของหน้านี้ยืนยันว่าผ่านแล้ว';
    }
    const count = tracker.querySelector('.uxq-3part__count');
    if (count) {
      const current = parseInt(count.textContent, 10) || 0;
      if (current < 1) count.textContent = '1/3 ยืนยันจากระบบ';
    }
    const foot = tracker.querySelector('.uxq-3part__foot');
    if (foot && /เชื่อม Receiver|ไม่สำเร็จ|หมดเวลารอ/i.test(foot.textContent || '')) {
      foot.textContent = 'Mission ผ่านแล้ว • Studio และ Reflection จะถือว่าครบเมื่อระบบเชื่อมต่อและยืนยันข้อมูลสำเร็จ';
    }
  }

  function visibleFields(artifact) {
    return Array.from(artifact.querySelectorAll(':scope > .studio-field'));
  }

  function makePanel(step) {
    const panel = document.createElement('section');
    panel.className = 'uxq-wizard-panel';
    panel.dataset.step = String(step);
    return panel;
  }

  function buildWizard() {
    if (!mq.matches) return;
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact || artifact.dataset.mobileWizard === '1') return;
    const fields = visibleFields(artifact);
    const checks = artifact.querySelector('.studio-checks');
    const validation = artifact.querySelector('.studio-validation');
    const actions = artifact.querySelector(':scope > .actions');
    if (fields.length < 2 || !checks || !actions) return;

    artifact.dataset.mobileWizard = '1';
    const reflection = fields.find(field => field.querySelector('[data-studio-key="reflection"]'));
    const normal = fields.filter(field => field !== reflection);
    const cut1 = Math.max(1, Math.ceil(normal.length * .34));
    const cut2 = Math.max(cut1 + 1, Math.ceil(normal.length * .67));
    const groups = [normal.slice(0, cut1), normal.slice(cut1, cut2), normal.slice(cut2), []];
    if (reflection) groups[3].push(reflection);

    const progress = document.createElement('div');
    progress.className = 'uxq-wizard-progress';
    progress.innerHTML = `<div class="uxq-wizard-progress__top"><b data-wizard-title>ขั้นที่ 1 • ปัญหา</b><span data-wizard-count>1/4</span></div><div class="uxq-wizard-progress__bar"><i></i></div><div class="uxq-wizard-dots"><span class="uxq-wizard-dot">ปัญหา</span><span class="uxq-wizard-dot">หลักฐาน</span><span class="uxq-wizard-dot">แนวทางแก้</span><span class="uxq-wizard-dot">Reflection</span></div>`;
    const anchor = artifact.querySelector('.studio-head')?.nextElementSibling || artifact.firstChild;
    artifact.insertBefore(progress, anchor);

    const panels = [0,1,2,3].map(makePanel);
    groups.forEach((group, index) => group.forEach(el => panels[index].appendChild(el)));
    panels[3].appendChild(checks);
    if (validation) panels[3].appendChild(validation);
    panels[3].appendChild(actions);

    const nav = document.createElement('div');
    nav.className = 'uxq-wizard-nav';
    nav.innerHTML = '<button type="button" class="uxq-wizard-prev">ย้อนกลับ</button><button type="button" class="uxq-wizard-next">ถัดไป</button>';
    panels.forEach(panel => artifact.appendChild(panel));
    artifact.appendChild(nav);

    nav.querySelector('.uxq-wizard-prev').addEventListener('click', () => showStep(activeStep - 1, artifact));
    nav.querySelector('.uxq-wizard-next').addEventListener('click', () => showStep(activeStep + 1, artifact));
    showStep(0, artifact);
  }

  function showStep(step, artifact) {
    const panels = Array.from(artifact.querySelectorAll('.uxq-wizard-panel'));
    activeStep = Math.max(0, Math.min(3, step));
    panels.forEach((panel, index) => panel.classList.toggle('is-active', index === activeStep));
    const titles = ['ขั้นที่ 1 • ปัญหาและผู้ใช้','ขั้นที่ 2 • หลักฐานและผลกระทบ','ขั้นที่ 3 • แนวทางแก้และการทดสอบ','ขั้นที่ 4 • Reflection และตรวจงาน'];
    artifact.querySelector('[data-wizard-title]').textContent = titles[activeStep];
    artifact.querySelector('[data-wizard-count]').textContent = `${activeStep + 1}/4`;
    artifact.querySelector('.uxq-wizard-progress__bar i').style.width = `${(activeStep + 1) * 25}%`;
    artifact.querySelectorAll('.uxq-wizard-dot').forEach((dot,index) => {
      dot.classList.toggle('is-active', index === activeStep);
      dot.classList.toggle('is-done', index < activeStep);
    });
    const prev = artifact.querySelector('.uxq-wizard-prev');
    const next = artifact.querySelector('.uxq-wizard-next');
    prev.disabled = activeStep === 0;
    next.hidden = activeStep === 3;
    next.textContent = activeStep === 2 ? 'ไป Reflection' : 'ถัดไป';
    artifact.querySelector('.uxq-wizard-progress')?.scrollIntoView?.({behavior:'smooth', block:'start'});
  }

  function simplifyResult() {
    if (!mq.matches) return;
    const text = String(ROOT.textContent || '');
    if (!/MISSION COMPLETE/i.test(text)) return;
    ROOT.querySelectorAll('section,article,div').forEach(el => {
      const t = String(el.textContent || '').trim();
      if (/ยังต้องฝึกเหตุผลอีกนิด/.test(t) && t.length < 300) el.style.display = 'none';
    });
  }

  function apply() {
    installStyle();
    if (!mq.matches) return;
    bridgeTracker();
    buildWizard();
    simplifyResult();
  }

  let timer;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(apply, 100); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once:true});
  else schedule();
  window.addEventListener('resize', schedule);
  window.addEventListener('uxq-sheet-progress-restored', schedule);
  new MutationObserver(schedule).observe(ROOT, {childList:true, subtree:true});
  window.UXQMobileStudioWizardV1 = Object.freeze({apply, version:'20260721-MOBILE-STUDIO-WIZARD-V1'});
})();