/* CSAI2601 UX Quest • Mission Status Final Authority v1
 * Reconciles local mission records across best/last/history and aligns CTA copy.
 * Google Sheet remains the only official completion authority.
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search || '');
  if (params.get('contentPreview') === '1' || /^content-preview/i.test(params.get('v') || '')) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE_ID = String(params.get('node') || params.get('id') || 'W1').trim().toUpperCase();
  const NODE_KEY = NODE_ID.toLowerCase();
  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const starsText = value => {
    const stars = Math.max(0, Math.min(3, Math.round(n(value))));
    return `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
  };

  function record() {
    try { return window.UXQProgress?.get?.()?.missions?.[NODE_KEY] || {}; }
    catch (_) { return {}; }
  }

  function reconciled() {
    const row = record();
    const last = row.lastResult || {};
    const history = Array.isArray(row.history) ? row.history : [];
    const all = [row, last, ...history];
    const stars = Math.max(0, ...all.map(item => n(item?.stars ?? item?.bestStars)));
    const score = Math.max(0, n(row.bestScore), n(last.score), ...history.map(item => n(item?.score)));
    const attempts = Math.max(n(row.attempts), history.length, (score > 0 || stars > 0) ? 1 : 0);
    const localPassed = Boolean(
      row.completed || last.passed || history.some(item => item?.passed || item?.completed) || stars >= 2
    );
    return { row, stars, score, attempts, localPassed };
  }

  function officialCount() {
    const badge = document.querySelector('#uxqThreePartCompletion .uxq-3part__count');
    const match = String(badge?.textContent || '').match(/([0-3])\s*\/\s*3/);
    return match ? Number(match[1]) : null;
  }

  function patchStatus() {
    const hero = ROOT.querySelector('.panel .hero');
    if (!hero) return;
    const state = reconciled();
    let line = hero.querySelector('.uxq-attempt-status');
    if (!state.attempts) {
      if (line) line.remove();
      return;
    }
    if (!line) {
      line = document.createElement('p');
      line.className = 'lede uxq-attempt-status';
      hero.insertBefore(line, hero.querySelector('.actions') || null);
    }

    const count = officialCount();
    if (state.localPassed) {
      line.textContent = count === 3
        ? `สมบูรณ์แล้ว: ${starsText(state.stars)} • คะแนนดีที่สุด ${state.score.toLocaleString('th-TH')} • ระบบยืนยันครบ 3/3 ส่วน`
        : `ผ่าน Mission ในเครื่อง: ${starsText(state.stars)} • คะแนนดีที่สุด ${state.score.toLocaleString('th-TH')} • ทำ Studio Practice และ Weekly Reflection ต่อ`;
      line.dataset.state = 'passed';
    } else if (state.score > 0 && state.stars < 2) {
      line.textContent = `มีผลการเล่นเดิม: ${starsText(state.stars)} • คะแนนดีที่สุด ${state.score.toLocaleString('th-TH')} • ต้องเล่นใหม่ให้ได้อย่างน้อย 2/3 ดาว`;
      line.dataset.state = 'retry';
    }
  }

  function patchCTA() {
    const hero = ROOT.querySelector('.panel .hero');
    const action = hero?.querySelector('.actions a, .actions button');
    if (!action) return;
    const state = reconciled();
    const count = officialCount();
    if (!state.attempts) action.textContent = `เริ่ม ${NODE_ID} →`;
    else if (state.localPassed && count !== 3) action.textContent = 'ทำ Studio Practice ต่อ →';
    else if (state.localPassed && count === 3) action.textContent = 'ทบทวน Mission →';
    else action.textContent = `เล่น ${NODE_ID} ใหม่ →`;
  }

  function apply() {
    patchStatus();
    patchCTA();
  }

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue, { once:true });
  else queue();
  new MutationObserver(queue).observe(ROOT, { childList:true, subtree:true, characterData:true });
  ['uxq-progress-updated','uxq-mission-completed','uxq-sheet-progress-restored'].forEach(name => window.addEventListener(name, queue));
  [200,600,1200,2500].forEach(ms => setTimeout(apply, ms));

  window.UXQMissionStatusFinalAuthorityV1 = Object.freeze({ version:'20260729-MISSION-STATUS-FINAL-V1', apply, reconciled });
})();