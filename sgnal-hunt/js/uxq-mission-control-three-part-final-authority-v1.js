/* CSAI2601 UX Quest • Mission Control Three-Part Final Authority v1.2
 * Runs after Mission Control decorators and makes badge, three-part pills,
 * CTA and next-note render from the same canonical course-progress state.
 * Only contiguous Mission + Studio + Reflection unlocks the next node.
 */
(() => {
  'use strict';

  const VERSION = '20260809-MISSION-CONTROL-THREE-PART-FINAL-V1.2-STATE-SYNC';
  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  let lastDetail = null;

  function profile() {
    try { return window.UXQIdentity?.get?.() || {}; }
    catch (_) { return {}; }
  }

  function nodeUrl(state, mode) {
    const url = new URL('./csai2601-canonical-node-clean-v1.html', location.href);
    url.searchParams.set('node', String(state.id || '').toUpperCase());

    const p = profile();
    if (p.studentId) url.searchParams.set('studentId', p.studentId);
    if (p.studentName) url.searchParams.set('studentName', p.studentName);
    if (p.section) url.searchParams.set('section', p.section);
    url.searchParams.set('courseId', window.UXQ_CLASSROOM_CONFIG?.courseId || 'UXQ-ACT1-2026');
    url.searchParams.set('source', 'mission-control');

    if (mode === 'studio') url.searchParams.set('view', 'studio');
    if (mode === 'review') {
      url.searchParams.set('review', '1');
      url.searchParams.set('complete', '1');
    }
    url.searchParams.set('v', 'mission-control-three-part-final-v1-2-20260809');
    return url.href;
  }

  function actionFor(state) {
    if (!state.mission) return { label:'เริ่ม Mission', href:nodeUrl(state, 'mission'), detail:'ทำ Mission ให้ผ่านก่อน' };
    if (!state.studio) return { label:'ทำ Studio Practice', href:nodeUrl(state, 'studio'), detail:'เหลือ Studio Practice และ Weekly Reflection' };
    if (!state.reflection) return { label:'ทำ Weekly Reflection', href:nodeUrl(state, 'studio'), detail:'เหลือ Weekly Reflection อีก 1 ส่วน' };
    return { label:'ดู Studio & Reflection', href:nodeUrl(state, 'review'), detail:'ครบ Mission + Studio Practice + Weekly Reflection แล้ว' };
  }

  function ensureThreePartStatus(element, state) {
    let status = element.querySelector('.studio-node-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'studio-node-status';
      const launch = element.querySelector('.campaign-launch');
      if (launch?.parentNode) launch.parentNode.insertBefore(status, launch.nextSibling);
      else element.appendChild(status);
    }
    status.innerHTML = [
      `<span class="${state.mission ? 'done' : ''}">Mission ${state.mission ? '✓' : '○'}</span>`,
      `<span class="${state.studio ? 'done' : ''}">Studio ${state.studio ? '✓' : '○'}</span>`,
      `<span class="${state.reflection ? 'done' : ''}">Reflection ${state.reflection ? '✓' : '○'}</span>`
    ].join('');
    status.dataset.uxqFinalAuthority = '1';
  }

  function ensureNextNote(element, state, locked, index) {
    let note = element.querySelector('.three-part-lock-note, .node-next-note');
    if (!note) {
      note = document.createElement('div');
      element.appendChild(note);
    }

    if (locked) {
      note.className = 'three-part-lock-note';
      note.textContent = state.id.startsWith('b')
        ? `Boss Gate จะเปิดเมื่อ ${ORDER[index - 1].toUpperCase()} และทุก Node ก่อนหน้าครบ 3/3`
        : `ต้องทำ ${ORDER[index - 1].toUpperCase()} ให้ครบ Mission + Studio + Reflection ก่อน`;
      return;
    }

    const action = actionFor(state);
    note.className = 'node-next-note';
    note.textContent = state.complete ? 'ครบแล้ว • พร้อมไป Node ถัดไป' : action.detail;
    note.dataset.uxqFinalAuthority = '1';
  }

  function applyHero(states, stop) {
    const link = document.getElementById('nextLink');
    if (!link || stop >= states.length) return;
    const current = states[stop];
    const action = actionFor(current);
    link.href = action.href;
    link.textContent = action.label;
    link.setAttribute('aria-disabled', 'false');
    link.onclick = null;
    link.dataset.uxqUnifiedStudioRoute = '1';
  }

  function apply(detail) {
    const states = Array.isArray(detail?.states) ? detail.states : [];
    if (!states.length) return;
    lastDetail = detail;

    const firstIncomplete = states.findIndex(state => !state.complete);
    const stop = firstIncomplete < 0 ? states.length : firstIncomplete;

    states.forEach((state, index) => {
      const element = document.querySelector(`[data-node-id="${state.id}"]`) ||
        document.querySelector(`[data-node="${String(state.id).toUpperCase()}"]`);
      if (!element) return;

      const locked = index > stop;
      const launch = element.querySelector('.campaign-launch');
      const badge = element.querySelector('.stage-state');
      const action = actionFor(state);

      element.dataset.threePartLocked = locked ? '1' : '0';
      element.dataset.nodeComplete = state.complete ? '1' : '0';
      element.dataset.uxqFinalAuthority = '1';

      ensureThreePartStatus(element, state);
      ensureNextNote(element, state, locked, index);

      if (badge) {
        badge.textContent = locked
          ? `🔒 รอ ${ORDER[index - 1].toUpperCase()} ครบ 3/3`
          : state.complete
            ? '✅ Complete 3/3'
            : state.mission
              ? `Mission ผ่านแล้ว • เหลือ ${2 - Number(state.studio) - Number(state.reflection)} ส่วน`
              : 'พร้อมเริ่ม Mission';
        badge.dataset.uxqFinalAuthority = '1';
      }

      if (!launch) return;
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
        launch.dataset.uxqUnifiedStudioRoute = '1';
      }
    });

    applyHero(states, stop);

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
    setTimeout(() => apply(event.detail), 2500);
  });

  const observer = new MutationObserver(() => {
    if (lastDetail) requestAnimationFrame(() => apply(lastDetail));
  });
  const start = () => observer.observe(document.getElementById('grid') || document.body, {
    childList:true,
    subtree:true
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();

  window.UXQMissionControlThreePartFinalAuthorityV1 = Object.freeze({
    version:VERSION,
    apply,
    actionFor
  });
})();