/* CSAI2601 UX Quest • Direct Studio Authority Sync v1
 * Keeps the three-part tracker consistent with canonical Sheet confirmation
 * used by ?view=studio|reflection direct entry.
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search || '');
  const view = String(params.get('view') || '').toLowerCase();
  if (!['studio','reflection'].includes(view)) return;
  const nodeId = String(params.get('node') || params.get('id') || 'W1').toUpperCase();
  const nodeKey = nodeId.toLowerCase();

  function confirmation() {
    const direct = window.UXQDirectStudioConfirmed;
    return direct?.confirmed && String(direct.nodeKey || '').toLowerCase() === nodeKey ? direct : null;
  }

  function remoteValues(data) {
    const row = data?.missions?.[nodeKey] || data?.missions?.[nodeId] || {};
    const stars = Number(row.bestStars || row.stars || 0);
    const score = Number(row.bestScore || row.score || 0);
    return { stars, score };
  }

  function patch() {
    const direct = confirmation();
    if (!direct) return;
    const tracker = document.getElementById('uxqThreePartCompletion');
    if (!tracker) return;

    const cards = tracker.querySelectorAll('.uxq-3part__item');
    const mission = cards[0];
    if (mission) {
      const { stars, score } = remoteValues(direct.data || {});
      mission.dataset.state = 'done';
      const title = mission.querySelector('b');
      const status = mission.querySelector('span');
      const detail = mission.querySelector('small');
      if (title) title.textContent = '1. Mission / Game';
      if (status) status.textContent = 'ผ่านแล้ว';
      if (detail) detail.textContent = `Google Sheet ยืนยัน mission_completed${stars ? ` • ${stars}/3 ดาว` : ''}${score ? ` • ${score.toLocaleString('th-TH')} คะแนน` : ''}`;
    }

    const confirmedCount = Array.from(cards).filter(card => card.dataset.state === 'done').length;
    const count = tracker.querySelector('.uxq-3part__count');
    if (count) count.textContent = `${confirmedCount}/3 ยืนยันจากระบบ`;

    const foot = tracker.querySelector('.uxq-3part__foot');
    if (foot && confirmedCount < 3) {
      foot.textContent = view === 'reflection'
        ? 'Mission ผ่านและยืนยันแล้ว • ทำ Weekly Reflection ต่อได้ทันที ไม่ต้องเล่น Mission ซ้ำ'
        : 'Mission ผ่านและยืนยันแล้ว • ทำ Studio Practice ต่อได้ทันที ไม่ต้องเล่น Mission ซ้ำ';
    }
    tracker.dataset.authority = 'canonical-direct-entry';
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(patch, 25);
  }

  window.addEventListener('uxq-direct-studio-confirmed', schedule);
  window.addEventListener('uxq-mission-resume-studio', schedule);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();
  new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true, characterData:true });

  window.UXQDirectStudioAuthoritySyncV1 = Object.freeze({ patch, version:'20260722-DIRECT-STUDIO-AUTHORITY-SYNC-V1' });
})();