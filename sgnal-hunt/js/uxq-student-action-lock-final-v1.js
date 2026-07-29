/* CSAI2601 UX Quest • Student Action Lock Final v2
 * Controls Studio visibility only. The unified runtime polish owns the single
 * hero CTA. Google Sheet remains official authority.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  const preview = q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '');
  if (preview) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE = String(q.get('node') || q.get('id') || 'W1').trim().toUpperCase();
  const STYLE_ID = 'uxq-student-action-lock-final-v2-style';
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
      .uxq-final-primary-action,#uxqRuntimeNextCard,.uxq-runtime-next-card{display:none!important}
      [data-uxq-obsolete-action='1']{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function markObsoleteControls(pass) {
    ROOT.querySelectorAll('a,button').forEach(control => {
      const text = String(control.textContent || '').replace(/\s+/g,' ').trim();
      if (!text) return;
      const inHero = Boolean(control.closest('.panel .hero,.hero-card,.mission-card'));
      const inBanner = Boolean(control.closest('#uxqStudentRuntimeBanner'));
      const inStudio = Boolean(control.closest('#uxqStudentStudioFinalV2,.uxq-pr,.artifact'));
      if (inHero || inBanner) return;
      const duplicate = /เล่นซ้ำด้วย\s*case\s*ใหม่|กำลังยืนยัน.*Sheet|ตรวจ\s*Sheet\s*อีกครั้ง/i.test(text);
      const lockedStudioStart = !pass && inStudio && /เริ่มทำ|ทำ Studio Practice/i.test(text);
      if (duplicate || lockedStudioStart) control.dataset.uxqObsoleteAction = '1';
      else control.removeAttribute('data-uxq-obsolete-action');
    });
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
    document.querySelectorAll('.uxq-final-primary-action,#uxqRuntimeNextCard,.uxq-runtime-next-card').forEach(el => el.remove());
    markObsoleteControls(pass);
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
  window.UXQStudentActionLockFinalV1 = Object.freeze({version:'20260729-STUDENT-ACTION-LOCK-FINAL-V2',refresh:queue});
})();