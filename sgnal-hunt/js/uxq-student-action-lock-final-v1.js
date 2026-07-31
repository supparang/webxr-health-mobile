/* CSAI2601 UX Quest • Student Action Lock Final v3
 * Google Sheet is authoritative in Student Mode.
 * Never hides Studio wizard navigation after Sheet confirms mission_completed.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  const preview = q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '');
  if (preview) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE = String(q.get('node') || q.get('id') || 'W1').trim().toUpperCase();
  const STYLE_ID = 'uxq-student-action-lock-final-v3-style';
  let queued = false;
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function localMissionPassed() {
    try {
      const row = window.UXQProgress?.get?.()?.missions?.[NODE.toLowerCase()] || {};
      const history = Array.isArray(row.history) ? row.history : [];
      const results = [row.lastResult || {}, ...history];
      const stars = Math.max(number(row.bestStars), ...results.map(item => number(item?.stars)));
      return Boolean(row.completed || results.some(item => item?.passed === true) || stars >= 2);
    } catch (_) {
      return false;
    }
  }

  function missionPassed() {
    const sheet = window.UXQNodeSheetAuthority;
    if (sheet && sheet.nodeId === NODE && sheet.missionPassed === true) return true;
    if (document.body.dataset.uxqSheetMission === '1') return true;
    return localMissionPassed();
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body[data-uxq-mission-pass='0'] #uxqStudentStudioFinalV2,
      body[data-uxq-mission-pass='0'] .artifact[data-studio-practice-v1],
      body[data-uxq-mission-pass='0'] [data-studio-wizard]{display:none!important}
      .uxq-final-primary-action,#uxqRuntimeNextCard,.uxq-runtime-next-card{display:none!important}
      [data-uxq-obsolete-action='1']{display:none!important}
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2,
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 *{pointer-events:auto!important}
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__nav{display:grid!important;visibility:visible!important;opacity:1!important}
      body[data-uxq-route-phase='studio'] #uxqStudentStudioFinalV2 .uxq-sv2__next:not([hidden]){display:block!important}
    `;
    document.head.appendChild(style);
  }

  function markObsoleteControls(pass) {
    ROOT.querySelectorAll('a,button').forEach(control => {
      const text = String(control.textContent || '').replace(/\s+/g,' ').trim();
      if (!text) return;
      const inHero = Boolean(control.closest('.panel .hero,.hero-card,.mission-card'));
      const inBanner = Boolean(control.closest('#uxqStudentRuntimeBanner'));
      const inWizard = Boolean(control.closest('#uxqStudentStudioFinalV2'));
      if (inHero || inBanner || inWizard) {
        control.removeAttribute('data-uxq-obsolete-action');
        return;
      }
      const duplicate = /เล่นซ้ำด้วย\s*case\s*ใหม่|กำลังยืนยัน.*Sheet|ตรวจ\s*Sheet\s*อีกครั้ง/i.test(text);
      if (duplicate) control.dataset.uxqObsoleteAction = '1';
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

  function restoreWizardControls() {
    const wizard = document.getElementById('uxqStudentStudioFinalV2');
    if (!wizard) return;
    wizard.querySelectorAll('button,a,input,textarea,select,label').forEach(control => {
      control.removeAttribute('data-uxq-obsolete-action');
      control.style.removeProperty('pointer-events');
    });
    const next = wizard.querySelector('.uxq-sv2__next');
    if (next && !next.hidden) {
      next.disabled = false;
      next.removeAttribute('aria-disabled');
      next.style.setProperty('display','block','important');
    }
  }

  function apply() {
    queued = false;
    installStyle();
    const pass = missionPassed();
    document.body.dataset.uxqMissionPass = pass ? '1' : '0';
    document.querySelectorAll('.uxq-final-primary-action,#uxqRuntimeNextCard,.uxq-runtime-next-card').forEach(el => el.remove());
    markObsoleteControls(pass);
    normalizeSheetWaiting();
    if (pass) restoreWizardControls();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, {once:true});
  else queue();
  new MutationObserver(queue).observe(ROOT,{childList:true,subtree:true,characterData:true});
  ['uxq-progress-updated','uxq-mission-completed','uxq-sheet-progress-restored','uxq-node-sheet-authority-ready'].forEach(name => window.addEventListener(name,queue));
  [250,800,1600,3200].forEach(ms => setTimeout(queue,ms));
  window.UXQStudentActionLockFinalV1 = Object.freeze({version:'20260731-STUDENT-ACTION-LOCK-FINAL-V3',refresh:queue});
})();