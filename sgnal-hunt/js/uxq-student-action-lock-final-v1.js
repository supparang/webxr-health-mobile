/* CSAI2601 UX Quest • Student Action Lock Final v1
 * Final student-mode controller for lock state and duplicate actions.
 * Front-end only; Google Sheet remains official authority.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  const preview = q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '');
  if (preview) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE = String(q.get('node') || q.get('id') || 'W1').trim().toUpperCase();
  const STYLE_ID = 'uxq-student-action-lock-final-v1-style';
  let queued = false;

  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function missionRecord() {
    try { return window.UXQProgress?.get?.()?.missions?.[NODE.toLowerCase()] || {}; }
    catch (_) { return {}; }
  }

  function missionPassed() {
    const row = missionRecord();
    const history = Array.isArray(row.history) ? row.history : [];
    const results = [row.lastResult || {}, ...history];
    const stars = Math.max(number(row.bestStars), ...results.map(item => number(item.stars)));
    return Boolean(row.completed || results.some(item => item.passed === true) || stars >= 2);
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body[data-uxq-mission-pass='0'] #uxqStudentStudioFinalV2,
      body[data-uxq-mission-pass='0'] .artifact[data-studio-practice-v1],
      body[data-uxq-mission-pass='0'] [data-studio-wizard],
      body[data-uxq-mission-pass='0'] .uxq-pr{display:none!important}

      .uxq-final-primary-action{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;width:min(820px,calc(100% - 24px))!important;margin:16px auto!important;padding:15px 17px!important;border:1px solid rgba(110,231,255,.42)!important;border-radius:16px!important;background:linear-gradient(135deg,rgba(18,73,126,.82),rgba(61,39,125,.72))!important;color:#fff!important}
      .uxq-final-primary-action__copy{display:grid;gap:4px;min-width:0}.uxq-final-primary-action__copy strong{font-size:1.05rem}.uxq-final-primary-action__copy small{color:#bfd0eb;line-height:1.4}
      .uxq-final-primary-action a,.uxq-final-primary-action button{flex:0 0 auto;min-height:44px;padding:10px 16px;border:0;border-radius:12px;background:linear-gradient(135deg,#67e8f9,#86efac);color:#071124;text-decoration:none;font:inherit;font-weight:950;cursor:pointer}
      [data-uxq-obsolete-action='1']{display:none!important}
      @media(max-width:720px){.uxq-final-primary-action{display:grid!important}.uxq-final-primary-action a,.uxq-final-primary-action button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function missionButton() {
    const hero = ROOT.querySelector('.panel .hero, .hero');
    return hero?.querySelector('.actions a:first-child,.actions button:first-child') || null;
  }

  function markDuplicateActions(pass) {
    const phrases = [
      /เล่นซ้ำด้วย\s*case\s*ใหม่/i,
      /กำลังยืนยัน.*Sheet/i,
      /ตรวจ\s*Sheet\s*อีกครั้ง/i,
      /เริ่มทำ/i
    ];
    ROOT.querySelectorAll('a,button').forEach(control => {
      const text = String(control.textContent || '').replace(/\s+/g,' ').trim();
      if (!text) return;
      const isStudioStart = /เริ่มทำ/i.test(text) && control.closest('#uxqStudentStudioFinalV2,.uxq-pr,.artifact');
      const obsolete = phrases.some(rx => rx.test(text));
      if (!obsolete) return;
      if (pass && isStudioStart) {
        control.removeAttribute('data-uxq-obsolete-action');
      } else {
        control.dataset.uxqObsoleteAction = '1';
      }
    });
  }

  function removeOldPrimary() {
    document.querySelectorAll('.uxq-final-primary-action').forEach(el => el.remove());
  }

  function mountPrimary(pass) {
    removeOldPrimary();
    const tracker = document.getElementById('uxqThreePartCompletion');
    const hero = ROOT.querySelector('.panel .hero, .hero');
    const anchor = tracker || hero;
    if (!anchor?.parentNode) return;

    const box = document.createElement('section');
    box.className = 'uxq-final-primary-action';
    if (!pass) {
      const btn = missionButton();
      const href = btn?.tagName === 'A' ? btn.getAttribute('href') : '#';
      box.innerHTML = `<div class="uxq-final-primary-action__copy"><strong>ทำ Mission ให้ผ่านก่อน</strong><small>ต้องได้อย่างน้อย 2/3 ดาว จึงเปิด Studio Practice และ Weekly Reflection</small></div><a href="${href || '#'}">เริ่ม ${NODE}</a>`;
      if (btn?.tagName !== 'A') {
        const link = box.querySelector('a');
        link.href = '#';
        link.addEventListener('click', event => { event.preventDefault(); btn?.click(); });
      }
    } else {
      box.innerHTML = `<div class="uxq-final-primary-action__copy"><strong>ขั้นตอนถัดไป: Studio Practice</strong><small>ทำ Studio ให้ครบ แล้วเขียน Weekly Reflection เพื่อให้ครบ 3 ส่วน</small></div><button type="button">ทำ Studio Practice ต่อ</button>`;
      box.querySelector('button')?.addEventListener('click', () => {
        const studio = document.getElementById('uxqStudentStudioFinalV2') || ROOT.querySelector('.artifact[data-studio-practice-v1]');
        studio?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    }
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
  }

  function normalizeSheetWaiting() {
    ROOT.querySelectorAll('*').forEach(el => {
      if (el.children.length) return;
      const text = String(el.textContent || '').trim();
      if (/กำลังรอ Google Sheet ยืนยันผล|กำลังยืนยัน.*Sheet/i.test(text)) {
        el.textContent = 'สถานะทางการยังรอการยืนยันจาก Google Sheet';
      }
    });
  }

  function apply() {
    queued = false;
    installStyle();
    const pass = missionPassed();
    document.body.dataset.uxqMissionPass = pass ? '1' : '0';
    markDuplicateActions(pass);
    mountPrimary(pass);
    normalizeSheetWaiting();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, {once:true});
  else queue();
  new MutationObserver(queue).observe(ROOT,{childList:true,subtree:true,characterData:true});
  ['uxq-progress-updated','uxq-mission-completed','uxq-sheet-progress-restored'].forEach(name => window.addEventListener(name,queue));
  [250,800,1600,3200].forEach(ms => setTimeout(queue,ms));

  window.UXQStudentActionLockFinalV1 = Object.freeze({version:'20260729-STUDENT-ACTION-LOCK-FINAL-V1',refresh:queue});
})();