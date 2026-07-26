/* =========================================================
 * CSAI2601 UX Quest • Three-Part AI Quest Flow v1
 * Mission → Studio Practice → Weekly Reflection
 * UI-only authority. Google Sheet remains the source of truth.
 * ========================================================= */
(() => {
  'use strict';

  const STYLE_ID = 'uxqThreePartAIQuestFlowStyleV1';
  const ROOT_CLASS = 'uxq-aiq-three-flow';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${ROOT_CLASS}{
        position:relative!important;
        display:block!important;
        width:min(100%,1100px)!important;
        margin:24px auto!important;
        padding:22px!important;
        border:1px solid rgba(68,224,181,.55)!important;
        border-radius:22px!important;
        background:linear-gradient(180deg,rgba(8,43,60,.98),rgba(5,29,47,.98))!important;
        box-shadow:0 18px 55px rgba(0,0,0,.24)!important;
        overflow:hidden!important;
      }
      .${ROOT_CLASS} .uxq-aiq-flow-head{
        display:flex!important;
        align-items:flex-start!important;
        justify-content:space-between!important;
        gap:16px!important;
        margin-bottom:20px!important;
      }
      .${ROOT_CLASS} .uxq-aiq-flow-title{
        margin:0!important;
        font-size:clamp(18px,2vw,24px)!important;
        font-weight:900!important;
        color:#f4fbff!important;
      }
      .${ROOT_CLASS} .uxq-aiq-flow-sub{
        margin-top:5px!important;
        color:#a9bfd0!important;
        font-size:14px!important;
      }
      .${ROOT_CLASS} .uxq-aiq-flow-count{
        flex:0 0 auto!important;
        padding:8px 13px!important;
        border-radius:999px!important;
        background:rgba(74,207,184,.16)!important;
        color:#d7fff4!important;
        font-weight:900!important;
        white-space:nowrap!important;
      }
      .${ROOT_CLASS} .uxq-aiq-flow-grid{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) 48px minmax(0,1fr) 48px minmax(0,1fr)!important;
        align-items:stretch!important;
        gap:0!important;
      }
      .${ROOT_CLASS} .uxq-aiq-step{
        position:relative!important;
        display:flex!important;
        flex-direction:column!important;
        min-width:0!important;
        min-height:170px!important;
        padding:20px!important;
        border-radius:18px!important;
        border:1px solid rgba(124,160,190,.34)!important;
        background:rgba(7,24,43,.72)!important;
      }
      .${ROOT_CLASS} .uxq-aiq-step.is-done{
        border-color:rgba(55,220,166,.72)!important;
        background:linear-gradient(180deg,rgba(13,78,70,.82),rgba(7,48,54,.9))!important;
      }
      .${ROOT_CLASS} .uxq-aiq-step.is-current{
        border-color:rgba(255,197,80,.72)!important;
        background:linear-gradient(180deg,rgba(70,55,24,.7),rgba(37,32,25,.84))!important;
      }
      .${ROOT_CLASS} .uxq-aiq-step-no{
        display:grid!important;
        place-items:center!important;
        width:44px!important;
        height:44px!important;
        border-radius:50%!important;
        margin-bottom:14px!important;
        background:#173b5b!important;
        color:#fff!important;
        font-size:22px!important;
        font-weight:950!important;
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)!important;
      }
      .${ROOT_CLASS} .is-done .uxq-aiq-step-no{
        background:#27c48f!important;
        color:#04271e!important;
      }
      .${ROOT_CLASS} .uxq-aiq-step-name{
        margin:0 0 8px!important;
        color:#f5fbff!important;
        font-size:18px!important;
        line-height:1.3!important;
        font-weight:900!important;
      }
      .${ROOT_CLASS} .uxq-aiq-step-status{
        margin:0 0 6px!important;
        color:#d8e8f2!important;
        font-weight:800!important;
      }
      .${ROOT_CLASS} .uxq-aiq-step-detail{
        margin:0!important;
        color:#a9bdcc!important;
        font-size:13px!important;
        line-height:1.55!important;
      }
      .${ROOT_CLASS} .uxq-aiq-connector{
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        color:#59dcb4!important;
        font-size:30px!important;
        font-weight:900!important;
      }
      .${ROOT_CLASS} .uxq-aiq-complete{
        margin-top:18px!important;
        padding:14px 16px!important;
        border-radius:14px!important;
        text-align:center!important;
        background:rgba(27,185,131,.14)!important;
        border:1px solid rgba(55,220,166,.42)!important;
        color:#e5fff6!important;
        font-weight:900!important;
      }
      .${ROOT_CLASS} .uxq-aiq-complete:not(.is-all-done){
        background:rgba(37,73,101,.4)!important;
        border-color:rgba(130,166,196,.3)!important;
        color:#c4d7e6!important;
      }
      @media (max-width:760px){
        .${ROOT_CLASS}{padding:16px!important;border-radius:18px!important;}
        .${ROOT_CLASS} .uxq-aiq-flow-head{flex-direction:column!important;align-items:stretch!important;}
        .${ROOT_CLASS} .uxq-aiq-flow-count{align-self:flex-start!important;}
        .${ROOT_CLASS} .uxq-aiq-flow-grid{
          grid-template-columns:1fr!important;
          gap:0!important;
        }
        .${ROOT_CLASS} .uxq-aiq-step{min-height:0!important;}
        .${ROOT_CLASS} .uxq-aiq-connector{
          height:44px!important;
          transform:rotate(90deg)!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function norm(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }

  function findTracker(){
    const nodes = Array.from(document.querySelectorAll('section,div,article'));
    return nodes.find(el => {
      const t = norm(el.textContent);
      return t.includes('ตรวจความครบ 3 ส่วน') &&
        t.includes('Mission / Game') &&
        t.includes('Studio Practice') &&
        t.includes('Weekly Reflection');
    }) || null;
  }

  function findSmallestTextBlock(root, phrase){
    const candidates = Array.from(root.querySelectorAll('div,section,article,li'))
      .filter(el => norm(el.textContent).includes(phrase));
    return candidates.sort((a,b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0] || null;
  }

  function parseStep(root, phrase, name, no){
    const el = findSmallestTextBlock(root, phrase);
    const text = norm(el ? el.textContent : '');
    const done = /ยืนยันแล้ว|ผ่านแล้ว|Google Sheet พบ|รับรองผลดีที่สุด|completed/i.test(text);
    let detail = text.replace(/^\s*[123][\.\)]?\s*/,'').replace(phrase,'').trim();
    if (detail.length > 180) detail = detail.slice(0,177) + '…';
    if (!detail) detail = done ? 'Google Sheet ยืนยันข้อมูลแล้ว' : 'รอการยืนยันจาก Google Sheet';
    return { no, name, done, detail };
  }

  function countFrom(root, steps){
    const text = norm(root.textContent);
    const m = text.match(/([0-3])\s*\/\s*3\s*ยืนยันจากระบบ/);
    if (m) return Number(m[1]);
    return steps.filter(s => s.done).length;
  }

  function render(root){
    if (!root || root.dataset.aiqFlowRendered === '1') return;
    const steps = [
      parseStep(root,'Mission / Game','Mission / Game',1),
      parseStep(root,'Studio Practice','Studio Practice',2),
      parseStep(root,'Weekly Reflection','Weekly Reflection',3)
    ];
    const count = countFrom(root,steps);
    const node = (new URLSearchParams(location.search).get('node') || 'W1').toUpperCase();
    const allDone = count === 3;

    root.dataset.aiqFlowRendered = '1';
    root.classList.add(ROOT_CLASS);
    root.innerHTML = `
      <div class="uxq-aiq-flow-head">
        <div>
          <h2 class="uxq-aiq-flow-title">เส้นทางภารกิจ ${node} แบบ 1–2–3</h2>
          <div class="uxq-aiq-flow-sub">Mission → Studio Practice → Weekly Reflection โดยใช้ Google Sheet เป็นหลักฐานทางการ</div>
        </div>
        <div class="uxq-aiq-flow-count">${count}/3 ยืนยันจากระบบ</div>
      </div>
      <div class="uxq-aiq-flow-grid">
        ${steps.map((s,i) => `
          <article class="uxq-aiq-step ${s.done?'is-done':'is-current'}">
            <div class="uxq-aiq-step-no">${s.done?'✓':s.no}</div>
            <h3 class="uxq-aiq-step-name">${s.no}. ${s.name}</h3>
            <p class="uxq-aiq-step-status">${s.done?'ยืนยันแล้ว':'ยังไม่ครบ'}</p>
            <p class="uxq-aiq-step-detail">${s.detail}</p>
          </article>
          ${i<2?'<div class="uxq-aiq-connector" aria-hidden="true">→</div>':''}
        `).join('')}
      </div>
      <div class="uxq-aiq-complete ${allDone?'is-all-done':''}">
        ${allDone ? `✅ ${node} Complete — Google Sheet ยืนยันครบทั้ง 3 ขั้นตอน` : `ทำตามลำดับ 1 → 2 → 3 ให้ครบ เพื่อจบ ${node}`}
      </div>
    `;
  }

  function apply(){
    installStyle();
    const tracker = findTracker();
    if (tracker) render(tracker);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, {once:true});
  } else apply();

  const observer = new MutationObserver(() => {
    const tracker = findTracker();
    if (tracker && tracker.dataset.aiqFlowRendered !== '1') render(tracker);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(apply,600);
  setTimeout(apply,1800);
})();
