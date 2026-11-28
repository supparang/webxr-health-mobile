/* CSAI2601 UX Quest • Mission Control Three-Part Final Authority v1.4
 * Single deterministic decorator for Mission Control cards and hero CTA.
 * Only contiguous Mission + Studio Practice + Weekly Reflection (3/3) unlocks the next node.
 * v1.4: removes self-triggering MutationObserver loops, forwards both view=studio & phase=studio,
 * preserves classroom query context, and cleanly handles already-ready state on load.
 */
(() => {
  'use strict';

  const VERSION = '20261127-MISSION-CONTROL-THREE-PART-FINAL-V1.4';
  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];

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

    const q = new URLSearchParams(location.search || '');
    ['classroom', 'device'].forEach(k => {
      const v = q.get(k);
      if (v) url.searchParams.set(k, v);
    });

    if (mode === 'studio') {
      url.searchParams.set('view', 'studio');
      url.searchParams.set('phase', 'studio');
    } else if (mode === 'review') {
      url.searchParams.set('review', '1');
      url.searchParams.set('complete', '1');
    }
    url.searchParams.set('v', 'mission-control-three-part-final-v1-4-20261127');
    return url.pathname + url.search;
  }

  function actionFor(state) {
    if (!state.mission) return { label:'เริ่ม Mission', href:nodeUrl(state, 'mission'), detail:'ทำ Mission ให้ผ่านอย่างน้อย 2★ ก่อน' };
    if (!state.studio) return { label:'ทำ Studio Practice', href:nodeUrl(state, 'studio'), detail:'Mission ผ่านแล้ว • เหลือ Studio Practice และ Weekly Reflection' };
    if (!state.reflection) return { label:'ทำ Weekly Reflection', href:nodeUrl(state, 'studio'), detail:'Mission + Studio ผ่านแล้ว • เหลือ Weekly Reflection อีก 1 ส่วน' };
    return { label:'ดู Studio & Reflection', href:nodeUrl(state, 'review'), detail:'ครบ Mission + Studio Practice + Weekly Reflection แล้ว' };
  }

  function ensureThreePartStatus(element, state) {
    let status = element.querySelector('.studio-node-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'studio-node-status';
      element.appendChild(status);
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
    document.querySelectorAll('#uxqStudentRecoveryActions,[data-sheet-recovery-action],.uxq-cloud-recovery-actions').forEach(el => el.remove());
    const link = document.getElementById('nextLink');
    if (!link) return;
    if (stop >= states.length) {
      link.href = '#';
      link.textContent = 'Portfolio พร้อมตรวจ';
      link.setAttribute('aria-disabled', 'true');
      link.onclick = event => event.preventDefault();
      return;
    }
    const current = states[stop];
    const action = actionFor(current);
    link.href = action.href;
    link.textContent = `${action.label} →`;
    link.setAttribute('aria-disabled', 'false');
    link.onclick = null;
    link.dataset.uxqUnifiedStudioRoute = '1';
  }

  function apply(detail) {
    const states = Array.isArray(detail?.states) ? detail.states : [];
    if (!states.length) return;

    const firstIncomplete = states.findIndex(state => !state.complete);
    const stop = firstIncomplete < 0 ? states.length : firstIncomplete;

    states.forEach((state, index) => {
      const element = document.querySelector(`[data-node-id="${state.id}"]`) ||
        document.querySelector(`[data-node="${String(state.id).toUpperCase()}"]`);
      if (!element) return;

      const locked = index > stop;
      const launch = element.querySelector('.campaign-launch');
      const badge = element.querySelector('.stage-state');
      const footerSpan = element.querySelector('.compact-stage__footer > span, .boss-preview__footer > span');
      const action = actionFor(state);

      element.dataset.missionPassed = state.mission ? '1' : '0';
      element.dataset.threePartLocked = locked ? '1' : '0';
      element.dataset.nodeComplete = state.complete ? '1' : '0';
      element.dataset.uxqFinalAuthority = '1';
      element.classList.toggle('is-locked', locked);
      element.classList.toggle('is-ready', !locked);
      element.classList.toggle('is-cleared', state.complete);
      element.style.opacity = '';
      element.style.filter = '';

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

      if (footerSpan) {
        footerSpan.textContent = locked
          ? `รอ ${ORDER[index - 1].toUpperCase()} ครบ Mission + Studio + Reflection`
          : action.detail;
      }

      if (!launch) return;
      launch.classList.toggle('uxq-primary-action', !locked);
      launch.classList.toggle('is-disabled', locked);
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
        launch.setAttribute('aria-label', `${action.label} ของ ${state.id.toUpperCase()}`);
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
    apply(event.detail);
  });

  if (window.UXQCombinedCourseProgress?.states?.length) {
    queueMicrotask(() => apply(window.UXQCombinedCourseProgress));
  }

  window.UXQMissionControlThreePartFinalAuthorityV1 = Object.freeze({
    version: VERSION,
    apply,
    actionFor
  });
})();