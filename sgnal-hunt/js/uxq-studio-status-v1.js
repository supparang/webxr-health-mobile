/* CSAI2601 UX Quest • Three-Part Course Coordinator v4
 * Front-end only polish. No Sheet schema or Apps Script changes.
 * Full completion and unlock = mission_completed AND studio_submitted AND reflection_submitted.
 */
(() => {
  'use strict';

  const config = window.UXQ_CLASSROOM_CONFIG || {};
  const params = new URLSearchParams(location.search || '');
  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const clean = (value, max = 200) => String(value == null ? '' : value).trim().slice(0, max);

  let missionSnapshot = window.UXQMissionSheetSnapshot || null;
  let studioSnapshot = null;

  function identity() {
    let profile = {};
    try { profile = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId: clean(profile.studentId || params.get('studentId') || params.get('sid'), 80),
      section: clean(profile.section || params.get('section') || config.defaultSection, 80)
    };
  }

  function endpoint() {
    return clean(config.receiverUrl || config.progressUrl || '', 800);
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = `uxqStudioCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(new Error('studio_progress_timeout')), 12000);
      function finish(error, data) {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(data);
      }
      window[callback] = data => finish(null, data);
      script.onerror = () => finish(new Error('studio_progress_network'));
      const learner = identity();
      const query = new URLSearchParams({
        action: 'uxq_student_studio_progress',
        studentId: learner.studentId,
        section: learner.section,
        courseId: config.courseId || 'UXQ-ACT1-2026',
        callback,
        _: Date.now()
      });
      script.src = `${url}${url.includes('?') ? '&' : '?'}${query}`;
      document.head.appendChild(script);
    });
  }

  function missionPassed(id) {
    const row = missionSnapshot?.missions?.[id] || missionSnapshot?.missions?.[id.toUpperCase()] || {};
    return Boolean(row.completed || row.passed || Number(row.bestStars || row.stars || 0) >= 2);
  }

  function studioRow(id) {
    const nodes = studioSnapshot?.nodes || {};
    return nodes[id] || nodes[id.toUpperCase()] ||
      (studioSnapshot?.items || []).find(item => String(item.nodeId || item.missionId || '').toLowerCase() === id) || {};
  }

  function studioSubmitted(row) {
    return Boolean(
      row.submitted || row.artifactSubmitted || row.studioSubmitted ||
      ['submitted','approved','need_revision','reviewing'].includes(String(row.reviewStatus || row.status || '').toLowerCase())
    );
  }

  function reflectionSubmitted(row) {
    return Boolean(row.reflectionSubmitted || row.hasReflection || clean(row.reflection || '', 5000).length > 0);
  }

  function nodeState(id) {
    const row = studioRow(id);
    const mission = missionPassed(id);
    const studio = studioSubmitted(row);
    const reflection = reflectionSubmitted(row);
    return {
      id,
      mission,
      studio,
      reflection,
      complete: Boolean(mission && studio && reflection),
      reviewStatus: clean(row.reviewStatus || row.status || 'not_submitted', 40),
      projectId: clean(row.projectId || '', 160)
    };
  }

  const allStates = () => ORDER.map(nodeState);
  function firstIncompleteIndex(states) {
    const index = states.findIndex(state => !state.complete);
    return index < 0 ? states.length : index;
  }

  function nodeUrl(id) {
    return `./csai2601-canonical-node-clean-v1.html?node=${encodeURIComponent(id.toUpperCase())}&v=student-progress-v4-20260721`;
  }

  function installStyle() {
    if (document.getElementById('uxq-studio-status-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-studio-status-style';
    style.textContent = `
      .studio-overview{margin:18px 0;border:1px solid rgba(110,231,255,.32);border-radius:22px;padding:18px;background:linear-gradient(145deg,rgba(16,31,61,.96),rgba(7,17,36,.98));color:#eef6ff;box-shadow:0 18px 46px rgba(0,0,0,.18)}
      .studio-overview h2{margin:0}.studio-overview p{color:#aebedb;line-height:1.55;margin:6px 0 0}
      .course-primary{margin-top:14px;border:1px solid rgba(121,237,165,.34);border-radius:18px;padding:16px;background:linear-gradient(145deg,rgba(25,80,62,.34),rgba(4,18,36,.5));display:grid;grid-template-columns:minmax(180px,.8fr) 2fr;gap:16px;align-items:center}
      .course-primary__value small{display:block;color:#b7c9e8;font-weight:750}.course-primary__value strong{display:block;font-size:clamp(2rem,5vw,3.4rem);line-height:1;color:#fff;margin:5px 0}.course-primary__value span{color:#79eda5;font-weight:850}
      .course-bar{height:13px;background:rgba(255,255,255,.1);border-radius:999px;overflow:hidden}.course-bar i{display:block;height:100%;background:linear-gradient(90deg,#6ee7ff,#79eda5);border-radius:inherit}.course-primary__next{margin-top:9px;color:#d8e7ff;line-height:1.5}
      .studio-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:12px}.studio-summary span{border:1px solid rgba(181,205,255,.22);border-radius:14px;padding:11px;color:#b9c9e4;background:rgba(3,13,31,.38)}.studio-summary b{display:block;color:#fff;font-size:1.08rem;margin-top:3px}.studio-summary .bad{color:#ffb0bd}.studio-summary .good{color:#79eda5}
      .student-timeline{margin-top:16px;border-top:1px solid rgba(181,205,255,.18);padding-top:15px}.student-timeline__head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.student-timeline__head h3{margin:0}.student-timeline__list{display:grid;gap:7px;max-height:360px;overflow:auto;padding-right:4px}
      .timeline-row{display:grid;grid-template-columns:54px 1fr auto;gap:10px;align-items:center;border:1px solid rgba(181,205,255,.17);border-radius:13px;padding:9px 10px;background:rgba(3,13,31,.3)}.timeline-row.is-current{border-color:rgba(110,231,255,.58);background:rgba(110,231,255,.08)}.timeline-row.is-complete{border-color:rgba(121,237,165,.38)}.timeline-row.is-locked{opacity:.53}.timeline-row__id{font-weight:950}.timeline-row__steps{display:flex;gap:5px;flex-wrap:wrap}.timeline-step{border:1px solid rgba(181,205,255,.2);border-radius:999px;padding:3px 7px;font-size:.72rem;color:#8294b8}.timeline-step.done{color:#79eda5;border-color:rgba(121,237,165,.42)}.timeline-row__action{color:#6ee7ff;text-decoration:none;font-size:.78rem;font-weight:850}.timeline-row__action[aria-disabled='true']{color:#8294b8;pointer-events:none}
      .studio-node-status{margin-top:9px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;font-size:.72rem}.studio-node-status span{border:1px solid rgba(181,205,255,.2);border-radius:999px;padding:4px 7px;text-align:center;color:#8294b8}.studio-node-status span.done{color:#79eda5;border-color:rgba(121,237,165,.45);background:rgba(121,237,165,.08)}
      .campaign-preview[data-node-complete='1']{outline:2px solid rgba(121,237,165,.34)}.campaign-preview[data-three-part-locked='1']{opacity:.48;filter:saturate(.55)}.campaign-preview[data-three-part-locked='1'] .campaign-launch{pointer-events:none;opacity:.45}.three-part-lock-note{margin-top:7px;color:#ffd166;font-size:.76rem}.node-next-note{margin-top:7px;color:#cbd9f2;font-size:.77rem;line-height:1.4}.campaign-launch.uxq-primary-action{background:#6ee7ff!important;color:#071124!important;border-radius:10px;padding:7px 10px!important;font-weight:900!important;text-decoration:none!important}
      @media(max-width:760px){.course-primary{grid-template-columns:1fr}.studio-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.studio-node-status{grid-template-columns:1fr}.timeline-row{grid-template-columns:46px 1fr}.timeline-row__action{grid-column:2}}
    `;
    document.head.appendChild(style);
  }

  function overviewCard() {
    let box = document.getElementById('uxqStudioOverview');
    if (box) return box;
    const grid = document.querySelector('.overview-grid');
    if (!grid) return null;
    box = document.createElement('section');
    box.id = 'uxqStudioOverview';
    box.className = 'studio-overview';
    box.innerHTML = '<h2>ความก้าวหน้ารายวิชา</h2><p>กำลังรวมสถานะ Mission, Studio Practice และ Weekly Reflection…</p>';
    grid.insertAdjacentElement('afterend', box);
    return box;
  }

  function nextAction(state) {
    if (!state.mission) return { label:'เริ่ม Mission', detail:'ทำ Mission ให้ผ่านก่อน', href:nodeUrl(state.id) };
    if (!state.studio) return { label:'ทำ Studio Practice', detail:'เหลือ Studio Practice และ Reflection', href:nodeUrl(state.id) };
    if (!state.reflection) return { label:'ทำ Weekly Reflection', detail:'เหลือ Weekly Reflection อีก 1 ส่วน', href:nodeUrl(state.id) };
    return { label:'ดูผลงาน', detail:'Node นี้ครบ 3/3 แล้ว', href:nodeUrl(state.id) };
  }

  function decorate(states) {
    const stop = firstIncompleteIndex(states);
    states.forEach((state, index) => {
      const element = document.querySelector(`[data-node-id="${state.id}"]`) || document.querySelector(`[data-node="${state.id.toUpperCase()}"]`);
      if (!element) return;
      const locked = index > stop;
      element.dataset.nodeComplete = state.complete ? '1' : '0';
      element.dataset.threePartLocked = locked ? '1' : '0';

      let status = element.querySelector('.studio-node-status');
      if (!status) {
        status = document.createElement('div');
        status.className = 'studio-node-status';
        element.appendChild(status);
      }
      status.innerHTML = `<span class="${state.mission ? 'done' : ''}">Mission ${state.mission ? '✓' : '○'}</span><span class="${state.studio ? 'done' : ''}">Studio ${state.studio ? '✓' : '○'}</span><span class="${state.reflection ? 'done' : ''}">Reflection ${state.reflection ? '✓' : '○'}</span>`;

      const badge = element.querySelector('.stage-state');
      if (badge) {
        badge.textContent = locked
          ? `🔒 รอ ${ORDER[index - 1].toUpperCase()} ครบ 3/3`
          : state.complete
            ? '✅ Complete 3/3'
            : state.mission
              ? `เหลือ ${2 - Number(state.studio) - Number(state.reflection)} ส่วน`
              : 'พร้อมเริ่ม Mission';
      }

      const launch = element.querySelector('.campaign-launch');
      const action = nextAction(state);
      if (launch) {
        launch.classList.toggle('uxq-primary-action', !locked);
        if (locked) {
          launch.href = '#';
          launch.textContent = 'ล็อก 3/3';
          launch.setAttribute('aria-disabled', 'true');
          launch.onclick = event => event.preventDefault();
        } else {
          launch.href = action.href;
          launch.textContent = action.label;
          launch.setAttribute('aria-disabled', 'false');
          launch.onclick = null;
        }
      }

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
      } else {
        note.className = 'node-next-note';
        note.textContent = state.complete ? 'ครบแล้ว พร้อมไป Node ถัดไป' : action.detail;
      }
    });
  }

  function counts(states) {
    return {
      missionCount: states.filter(state => state.mission).length,
      studioCount: states.filter(state => state.studio).length,
      reflectionCount: states.filter(state => state.reflection).length,
      completeCount: states.filter(state => state.complete).length,
      contiguous: firstIncompleteIndex(states)
    };
  }

  function updatePrimary(states) {
    const summary = counts(states);
    const progress = document.getElementById('progress');
    if (progress) progress.textContent = `Course Complete ${summary.contiguous}/${ORDER.length}`;

    const current = states[summary.contiguous] || null;
    const title = document.getElementById('nextTitle');
    const description = document.getElementById('nextDesc');
    const link = document.getElementById('nextLink');

    if (summary.contiguous === ORDER.length) {
      if (title) title.textContent = 'ครบทั้งหลักสูตร 19/19 Nodes';
      if (description) description.textContent = 'Mission, Studio Practice และ Weekly Reflection ครบทุก Node';
      if (link) {
        link.textContent = 'Portfolio พร้อมตรวจ';
        link.href = '#';
        link.setAttribute('aria-disabled', 'true');
      }
    } else if (current) {
      const action = nextAction(current);
      const id = current.id.toUpperCase();
      if (title) title.textContent = `${id} • ${action.label}`;
      if (description) description.textContent = `${action.detail} • เมื่อครบ 3/3 จะปลดล็อก ${ORDER[summary.contiguous + 1]?.toUpperCase() || 'ขั้นถัดไป'}`;
      if (link) {
        link.href = action.href;
        link.textContent = `${action.label} →`;
        link.setAttribute('aria-disabled', 'false');
      }
    }
    return summary;
  }

  function timelineHtml(states, contiguous) {
    return states.map((state, index) => {
      const locked = index > contiguous;
      const current = index === contiguous;
      const action = nextAction(state);
      return `<div class="timeline-row ${state.complete ? 'is-complete' : ''} ${current ? 'is-current' : ''} ${locked ? 'is-locked' : ''}">
        <div class="timeline-row__id">${state.id.toUpperCase()}</div>
        <div class="timeline-row__steps">
          <span class="timeline-step ${state.mission ? 'done' : ''}">Mission ${state.mission ? '✓' : '○'}</span>
          <span class="timeline-step ${state.studio ? 'done' : ''}">Studio ${state.studio ? '✓' : '○'}</span>
          <span class="timeline-step ${state.reflection ? 'done' : ''}">Reflection ${state.reflection ? '✓' : '○'}</span>
        </div>
        <a class="timeline-row__action" href="${locked ? '#' : action.href}" aria-disabled="${locked ? 'true' : 'false'}">${locked ? 'Locked' : action.label}</a>
      </div>`;
    }).join('');
  }

  function renderCombined() {
    installStyle();
    const box = overviewCard();
    if (!box || !missionSnapshot || !studioSnapshot) return;

    const states = allStates();
    const count = updatePrimary(states);
    const review = studioSnapshot.summary || {};
    const percent = Math.round((count.contiguous / ORDER.length) * 100);
    const current = states[count.contiguous] || null;
    const action = current ? nextAction(current) : null;

    box.innerHTML = `
      <h2>ความก้าวหน้ารายวิชา</h2>
      <p>ค่าหลักคือ <strong>Course Complete</strong>: Node ต้องครบ Mission + Studio Practice + Weekly Reflection ตามลำดับต่อเนื่อง</p>
      <section class="course-primary">
        <div class="course-primary__value"><small>COURSE COMPLETE</small><strong>${count.contiguous}/${ORDER.length}</strong><span>${percent}%</span></div>
        <div><div class="course-bar"><i style="width:${percent}%"></i></div><div class="course-primary__next">${current ? `งานถัดไป: ${current.id.toUpperCase()} • ${action.label} — ${action.detail}` : 'ครบทุก Node แล้ว'}</div></div>
      </section>
      <div class="studio-summary">
        <span>Mission Completed<b>${count.missionCount}/${ORDER.length}</b></span>
        <span>Studio Submitted<b>${count.studioCount}/${ORDER.length}</b></span>
        <span>Reflection Submitted<b>${count.reflectionCount}/${ORDER.length}</b></span>
        <span class="${count.contiguous === ORDER.length ? 'good' : ''}">Course Complete<b>${count.contiguous}/${ORDER.length}</b></span>
        <span>Nodes with 3/3<b>${count.completeCount}/${ORDER.length}</b></span>
        <span>Approved<b>${Number(review.approvedCount || 0)}</b></span>
        <span class="${Number(review.revisionCount || 0) ? 'bad' : ''}">Need Revision<b>${Number(review.revisionCount || 0)}</b></span>
        <span>Portfolio<b>${studioSnapshot.portfolioReady && count.contiguous === ORDER.length ? 'พร้อม' : 'ยังไม่ครบ'}</b></span>
      </div>
      <section class="student-timeline">
        <div class="student-timeline__head"><h3>Student Timeline</h3><span>${count.contiguous}/${ORDER.length} Complete</span></div>
        <div class="student-timeline__list">${timelineHtml(states, count.contiguous)}</div>
      </section>`;

    decorate(states);
    window.UXQCombinedCourseProgress = { states, ...count, unlockPolicy:'contiguous_three_part', version:'student-progress-v4' };
    window.dispatchEvent(new CustomEvent('uxq-three-part-course-progress', { detail:window.UXQCombinedCourseProgress }));
  }

  async function loadStudio() {
    installStyle();
    const box = overviewCard();
    const learner = identity();
    if (!box || !learner.studentId || !learner.section) {
      if (box) box.innerHTML = '<h2>ความก้าวหน้ารายวิชา</h2><p>กรุณาระบุรหัสนักศึกษาและ Section</p>';
      return;
    }
    if (!endpoint()) {
      box.innerHTML = '<h2>ความก้าวหน้ารายวิชา</h2><p>ยังไม่ได้ตั้งค่า Studio Progress endpoint</p>';
      return;
    }
    try {
      const data = await jsonp(endpoint());
      if (!data?.ok) throw new Error(data?.error || 'studio_progress_failed');
      studioSnapshot = data;
      window.UXQStudioProgress = data;
      renderCombined();
    } catch (error) {
      box.innerHTML = `<h2>ความก้าวหน้ารายวิชา</h2><p>ดึงสถานะ Studio/Reflection ไม่สำเร็จ: ${esc(error.message || error)}</p>`;
    }
  }

  window.addEventListener('uxq-mission-control-sheet-snapshot', event => {
    missionSnapshot = event.detail?.snapshot || null;
    renderCombined();
  });
  window.addEventListener('uxq-sheet-progress-restored', event => {
    missionSnapshot = event.detail || null;
    renderCombined();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(loadStudio, 700));
  else setTimeout(loadStudio, 700);
})();