/* CSAI2601 UX Quest • Mission Control Three-Part Final Authority v1
 * Runs after all Mission Control decorators.
 * Only contiguous Mission + Studio + Reflection can unlock the next node.
 */
(() => {
  'use strict';

  const VERSION = '20260727-MISSION-CONTROL-THREE-PART-FINAL-V1';
  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  let lastDetail = null;

  function profile() {
    try { return window.UXQIdentity?.get?.() || {}; } catch (_) { return {}; }
  }

  function nodeUrl(state, mode) {
    const url = new URL('./csai2601-canonical-node-clean-v1.html', location.href);
    url.searchParams.set('node', String(state.id || '').toUpperCase());
    const p = profile();
    if (p.studentId) url.searchParams.set('studentId', p.studentId);
    if (p.studentName) url.searchParams.set('studentName', p.studentName);
    if (p.section) url.searchParams.set('section', p.section);
    url.searchParams.set('courseId', window.UXQ_CLASSROOM_CONFIG?.courseId || 'UXQ-ACT1-2026');
    if (mode === 'studio') url.searchParams.set('view', 'studio');
    if (mode === 'review') {
      url.searchParams.set('review', '1');
      url.searchParams.set('complete', '1');
    }
    url.searchParams.set('v', 'three-part-final-v1-20260727');
    return url.href;
  }

  function actionFor(state) {
    if (!state.mission) return { label:'เริ่ม Mission', href:nodeUrl(state, 'mission') };
    if (!state.studio) return { label:'ทำ Studio Practice', href:nodeUrl(state, 'studio') };
    if (!state.reflection) return { label:'ทำ Weekly Reflection', href:nodeUrl(state, 'studio') };
    return { label:'ดู Studio & Reflection', href:nodeUrl(state, 'review') };
  }

  function apply(detail) {
    const states = Array.isArray(detail?.states) ? detail.states : [];
    if (!states.length) return;
    lastDetail = detail;
    const firstIncomplete = states.findIndex(state => !state.complete);
    const stop = firstIncomplete < 0 ? states.length : firstIncomplete;

    states.forEach((state, index) => {
      const element = document.querySelector(`[data-node-id="${state.id}"]`) || document.querySelector(`[data-node="${String(state.id).toUpperCase()}"]`);
      if (!element) return;
      const locked = index > stop;
      const launch = element.querySelector('.campaign-launch');
      const badge = element.querySelector('.stage-state');
      const action = actionFor(state);

      element.dataset.threePartLocked = locked ? '1' : '0';
      element.dataset.nodeComplete = state.complete ? '1' : '0';

      if (badge) {
        badge.textContent = locked
          ? `🔒 รอ ${ORDER[index - 1].toUpperCase()} ครบ 3/3`
          : state.complete
            ? '✅ Complete 3/3'
            : state.mission
              ? `Mission ผ่านแล้ว • เหลือ ${2 - Number(state.studio) - Number(state.reflection)} ส่วน`
              : 'พร้อมเริ่ม Mission';
      }

      if (launch) {
        if (locked) {
          launch.href = '#';
          launch.textContent = `🔒 รอ ${ORDER[index - 1].toUpperCase()} ครบ 3/3`;
          launch.setAttribute('aria-disabled', 'true');
          launch.onclick = event => event.preventDefault();
          launch.style.pointerEvents = 'none';
          launch.style.opacity = '.5';
        } else {
          launch.href = action.href;
          launch.textContent = action.label;
          launch.setAttribute('aria-disabled', 'false');
          launch.onclick = null;
          launch.style.pointerEvents = '';
          launch.style.opacity = '';
        }
      }
    });

    const missionCount = states.filter(state => state.mission).length;
    const heading = document.querySelector('.up-next .section-heading');
    if (heading) {
      let note = heading.querySelector('[data-uxq-final-summary]');
      if (!note) {
        note = document.createElement('p');
        note.dataset.uxqFinalSummary = '1';
        heading.appendChild(note);
      }
      note.textContent = `Mission ผ่าน ${missionCount}/${ORDER.length} • การจบ Node ต้องครบ Mission + Studio Practice + Weekly Reflection 3/3 ตามลำดับ`;
    }
  }

  window.addEventListener('uxq-three-part-course-progress', event => {
    requestAnimationFrame(() => apply(event.detail));
    setTimeout(() => apply(event.detail), 250);
    setTimeout(() => apply(event.detail), 1000);
  });

  const observer = new MutationObserver(() => {
    if (lastDetail) requestAnimationFrame(() => apply(lastDetail));
  });
  const start = () => observer.observe(document.getElementById('grid') || document.body, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true }); else start();

  window.UXQMissionControlThreePartFinalAuthorityV1 = Object.freeze({ version:VERSION, apply });
})();