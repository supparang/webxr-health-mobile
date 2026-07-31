/* CSAI2601 UX Quest • Three-Part Restore Authority v1
 * Google Sheet remains the sole official authority.
 * Recovers Studio/Reflection progress after mission restore and prevents permanent loading.
 */
(() => {
  'use strict';

  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  const VERSION = '20260731-THREE-PART-RESTORE-AUTHORITY-V1';
  let missionSnapshot = window.UXQMissionSheetSnapshot || null;
  let running = false;
  let lastIdentityKey = '';

  const text = (value, max = 500) => String(value == null ? '' : value).trim().slice(0, max);
  const escapeHtml = value => text(value, 1200).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function profile() {
    let value = {};
    try { value = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId: text(value.studentId, 80),
      studentName: text(value.studentName, 120),
      section: text(value.section, 80)
    };
  }

  function receiverUrl() {
    return text(window.UXQ_CLASSROOM_CONFIG?.receiverUrl || '', 900);
  }

  function overview() {
    let box = document.getElementById('uxqStudioOverview');
    if (box) return box;
    const anchor = document.querySelector('.overview-grid');
    if (!anchor) return null;
    box = document.createElement('section');
    box.id = 'uxqStudioOverview';
    box.className = 'studio-overview';
    anchor.insertAdjacentElement('afterend', box);
    return box;
  }

  function setHero(title, description, buttonLabel, disabled = true) {
    const titleEl = document.getElementById('nextTitle');
    const descEl = document.getElementById('nextDesc');
    const link = document.getElementById('nextLink');
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;
    if (link) {
      link.textContent = buttonLabel;
      link.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      if (disabled) link.href = '#';
    }
  }

  function jsonp(url, attempt) {
    return new Promise((resolve, reject) => {
      const callback = `__uxqThreePart_${Date.now()}_${attempt}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let settled = false;
      const timer = setTimeout(() => finish(new Error('studio_progress_timeout')), 18000);

      function finish(error, data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(data);
      }

      window[callback] = data => finish(null, data);
      script.onerror = () => finish(new Error('studio_progress_network'));
      script.async = true;
      script.src = url;
      document.head.appendChild(script);
    });
  }

  async function requestStudio(p) {
    const base = receiverUrl();
    if (!base) throw new Error('receiver_url_missing');
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const url = new URL(base);
      url.searchParams.set('action', 'uxq_student_studio_progress');
      url.searchParams.set('studentId', p.studentId);
      url.searchParams.set('section', p.section);
      url.searchParams.set('courseId', window.UXQ_CLASSROOM_CONFIG?.courseId || 'UXQ-ACT1-2026');
      url.searchParams.set('callback', `__placeholder_${attempt}`);
      url.searchParams.set('_', String(Date.now()));
      const callbackName = `__uxqThreePart_${Date.now()}_${attempt}_${Math.random().toString(36).slice(2)}`;
      url.searchParams.set('callback', callbackName);
      try {
        return await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          let settled = false;
          const timer = setTimeout(() => done(new Error('studio_progress_timeout')), 18000);
          function done(error, data) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
            script.remove();
            error ? reject(error) : resolve(data);
          }
          window[callbackName] = data => done(null, data);
          script.onerror = () => done(new Error('studio_progress_network'));
          script.async = true;
          script.src = url.href;
          document.head.appendChild(script);
        });
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 650 * attempt));
      }
    }
    throw lastError || new Error('studio_progress_failed');
  }

  function missionRow(id) {
    const missions = missionSnapshot?.missions || {};
    return missions[id] || missions[id.toUpperCase()] || {};
  }

  function missionPassed(id) {
    const row = missionRow(id);
    return Boolean(row.completed || row.passed || Number(row.bestStars || row.stars || 0) >= 2);
  }

  function studioRow(snapshot, id) {
    const nodes = snapshot?.nodes || {};
    return nodes[id] || nodes[id.toUpperCase()] || {};
  }

  function stateFor(snapshot, id) {
    const row = studioRow(snapshot, id);
    const mission = missionPassed(id);
    const studio = Boolean(row.submitted || row.artifactSubmitted || row.studioSubmitted || ['submitted','approved','need_revision','reviewing'].includes(text(row.reviewStatus || row.status, 40).toLowerCase()));
    const reflection = Boolean(row.reflectionSubmitted || row.hasReflection || text(row.reflection, 5000));
    return { id, mission, studio, reflection, complete: mission && studio && reflection };
  }

  function nodeHref(state) {
    const url = new URL('./csai2601-canonical-node-clean-v1.html', location.href);
    url.searchParams.set('node', state.id.toUpperCase());
    url.searchParams.set('v', 'three-part-authority-v1-20260731');
    if (state.mission && !state.complete) url.searchParams.set('phase', 'studio');
    return url.pathname + url.search;
  }

  function decorateCards(states, firstIncomplete) {
    states.forEach((state, index) => {
      const card = document.querySelector(`[data-node-id="${state.id}"]`) || document.querySelector(`[data-node="${state.id.toUpperCase()}"]`);
      if (!card) return;
      const locked = index > firstIncomplete;
      const badge = card.querySelector('.stage-state');
      const launch = card.querySelector('.campaign-launch');
      if (badge) {
        badge.textContent = state.complete ? 'ครบ 3/3' : state.mission ? `Mission ผ่านแล้ว • เหลือ ${2 - Number(state.studio) - Number(state.reflection)} ส่วน` : locked ? 'ล็อกตามลำดับ 3/3' : 'พร้อมเริ่ม Mission';
      }
      if (launch) {
        launch.href = locked ? '#' : nodeHref(state);
        launch.textContent = locked ? 'ล็อก 3/3' : !state.mission ? 'เริ่ม Mission' : !state.studio ? 'ทำ Studio Practice' : !state.reflection ? 'ทำ Weekly Reflection' : 'ดูผลงาน';
        launch.setAttribute('aria-disabled', locked ? 'true' : 'false');
        launch.onclick = locked ? event => event.preventDefault() : null;
      }
    });
  }

  function render(snapshot) {
    const states = ORDER.map(id => stateFor(snapshot, id));
    const firstIncomplete = states.findIndex(state => !state.complete);
    const contiguous = firstIncomplete < 0 ? ORDER.length : firstIncomplete;
    const missionCount = states.filter(state => state.mission).length;
    const studioCount = states.filter(state => state.studio).length;
    const reflectionCount = states.filter(state => state.reflection).length;
    const completeCount = states.filter(state => state.complete).length;
    const current = states[contiguous] || null;
    const box = overview();

    if (box) {
      box.innerHTML = `
        <h2>ความก้าวหน้ารายวิชา</h2>
        <p>Google Sheet ยืนยัน Mission, Studio Practice และ Weekly Reflection แล้ว</p>
        <div class="studio-summary">
          <span>Mission Completed<b>${missionCount}/${ORDER.length}</b></span>
          <span>Studio Submitted<b>${studioCount}/${ORDER.length}</b></span>
          <span>Reflection Submitted<b>${reflectionCount}/${ORDER.length}</b></span>
          <span>Complete 3/3<b>${completeCount}/${ORDER.length}</b></span>
        </div>
        <p>${current ? `งานถัดไป: <strong>${current.id.toUpperCase()}</strong> • ${!current.mission ? 'Mission' : !current.studio ? 'Studio Practice' : 'Weekly Reflection'}` : 'ครบทั้งหลักสูตร 19/19 Nodes แล้ว'}</p>`;
    }

    const progress = document.getElementById('progress');
    if (progress) progress.textContent = `Course Complete ${contiguous}/${ORDER.length}`;

    if (!current) {
      setHero('ครบทั้งหลักสูตร 19/19 Nodes', 'Mission, Studio Practice และ Weekly Reflection ครบทุก Node', 'Portfolio พร้อมตรวจ', true);
    } else {
      const next = !current.mission ? 'Mission' : !current.studio ? 'Studio Practice' : 'Weekly Reflection';
      setHero(`${current.id.toUpperCase()} • ${next}`, `Mission ${missionCount}/19 • Studio ${studioCount}/19 • Reflection ${reflectionCount}/19`, `เปิด ${next}`, false);
      const link = document.getElementById('nextLink');
      if (link) link.href = nodeHref(current);
    }

    decorateCards(states, contiguous);
    window.UXQStudioProgress = snapshot;
    window.UXQCombinedCourseProgress = { version: VERSION, states, missionCount, studioCount, reflectionCount, completeCount, contiguous };
    window.dispatchEvent(new CustomEvent('uxq-three-part-course-progress', { detail: window.UXQCombinedCourseProgress }));
  }

  function renderError(error) {
    const box = overview();
    const message = text(error?.message || error || 'studio_progress_failed', 300);
    if (box) {
      box.innerHTML = `<h2>ตรวจ Studio/Reflection ไม่สำเร็จ</h2><p>${escapeHtml(message)}</p><button type="button" id="uxqThreePartRetry">ลองตรวจอีกครั้ง</button>`;
      box.querySelector('#uxqThreePartRetry')?.addEventListener('click', () => boot(true));
    }
    setHero('Mission โหลดแล้ว แต่ยังตรวจ 3 ส่วนไม่สำเร็จ', message, 'ลองตรวจอีกครั้ง', false);
    const link = document.getElementById('nextLink');
    if (link) {
      link.href = '#';
      link.onclick = event => { event.preventDefault(); boot(true); };
    }
  }

  async function waitReady() {
    const start = Date.now();
    while (Date.now() - start < 12000) {
      const p = profile();
      if (p.studentId && p.section && receiverUrl() && missionSnapshot) return p;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('three_part_dependencies_not_ready');
  }

  async function boot(force = false) {
    if (running) return;
    const p = profile();
    const key = `${p.studentId}|${p.section}`;
    if (!force && key && key === lastIdentityKey && window.UXQStudioProgress?.ok) {
      render(window.UXQStudioProgress);
      return;
    }
    running = true;
    setHero('Mission โหลดแล้ว', 'กำลังตรวจ Studio Practice และ Weekly Reflection จาก Google Sheet…', 'กำลังตรวจความครบ 3 ส่วน…', true);
    try {
      const readyProfile = await waitReady();
      const data = await requestStudio(readyProfile);
      if (!data || !data.ok) throw new Error(data?.error || 'studio_progress_failed');
      lastIdentityKey = `${readyProfile.studentId}|${readyProfile.section}`;
      render(data);
    } catch (error) {
      renderError(error);
    } finally {
      running = false;
    }
  }

  window.addEventListener('uxq-sheet-progress-restored', event => {
    missionSnapshot = event.detail || missionSnapshot;
    boot(true);
  });
  window.addEventListener('uxq-mission-control-sheet-snapshot', event => {
    missionSnapshot = event.detail?.snapshot || missionSnapshot;
    boot(true);
  });
  window.addEventListener('uxq-profile-updated', () => boot(true));
  window.addEventListener('online', () => boot(true));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(() => boot(false), 900), { once: true });
  else setTimeout(() => boot(false), 900);

  window.UXQThreePartRestoreAuthority = Object.freeze({ boot: () => boot(true), version: VERSION });
})();