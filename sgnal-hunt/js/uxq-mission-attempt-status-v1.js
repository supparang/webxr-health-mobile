/* CSAI2601 UX Quest • Mission Attempt Status v1
 * Prevents a historical score from being mistaken for a pass.
 * Also preserves device and identity query parameters in internal navigation.
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search || '');
  const nodeId = String(params.get('node') || params.get('id') || 'W1').toUpperCase();
  const nodeKey = nodeId.toLowerCase();
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const starsText = value => `${'★'.repeat(Math.max(0,Math.min(3,number(value))))}${'☆'.repeat(3-Math.max(0,Math.min(3,number(value))))}`;

  function record() {
    try { return window.UXQProgress?.get?.()?.missions?.[nodeKey] || {}; }
    catch (_) { return {}; }
  }

  function statusText() {
    const row = record();
    const last = row.lastResult || {};
    const stars = Math.max(number(row.bestStars), number(last.stars));
    const score = Math.max(number(row.bestScore), number(last.score));
    const attempts = Math.max(number(row.attempts), Array.isArray(row.history) ? row.history.length : 0);
    const passed = Boolean(row.completed || last.passed || stars >= 2);
    if (!attempts && !score && !stars) return '';
    if (passed) return `ผ่านแล้ว: ${starsText(stars)} • คะแนนดีที่สุด ${score.toLocaleString('th-TH')} • เล่นซ้ำเพื่อฝึกกับ Case ใหม่ได้`;
    return `เล่นแล้วแต่ยังไม่ผ่าน: ${starsText(stars)} • คะแนนดีที่สุด ${score.toLocaleString('th-TH')} • ต้องได้อย่างน้อย 2/3 ดาว`;
  }

  function patchIntro() {
    const hero = document.querySelector('.panel .hero');
    if (!hero) return;
    const text = statusText();
    if (!text) return;
    const candidates = Array.from(hero.querySelectorAll('p.lede'));
    let line = candidates.find(el => /สถิติดีที่สุดเดิม|คะแนนดีที่สุด|เล่นแล้วแต่ยังไม่ผ่าน|ผ่านแล้ว:/.test(el.textContent || ''));
    if (!line) {
      line = document.createElement('p');
      line.className = 'lede uxq-attempt-status';
      const actions = hero.querySelector('.actions');
      hero.insertBefore(line, actions || null);
    }
    line.classList.add('uxq-attempt-status');
    line.textContent = text;
    const passed = number(record().bestStars) >= 2 || Boolean(record().completed || record().lastResult?.passed);
    line.dataset.state = passed ? 'passed' : 'retry';
  }

  function preserveContext() {
    const keep = ['device','studentId','studentName','section','sid','name'];
    document.querySelectorAll('a[href]').forEach(anchor => {
      let url;
      try { url = new URL(anchor.getAttribute('href'), location.href); } catch (_) { return; }
      if (url.origin !== location.origin || !/csai2601-(canonical-node|mission-control)/.test(url.pathname)) return;
      keep.forEach(key => {
        const value = params.get(key);
        if (value && !url.searchParams.has(key)) url.searchParams.set(key,value);
      });
      anchor.href = url.href;
    });
  }

  function installStyle() {
    if (document.getElementById('uxq-attempt-status-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'uxq-attempt-status-style-v1';
    style.textContent = `
      .uxq-attempt-status{padding:10px 12px!important;border-radius:13px;border:1px solid rgba(181,205,255,.25);background:rgba(5,15,35,.42)}
      .uxq-attempt-status[data-state='passed']{border-color:rgba(74,222,128,.5);background:rgba(34,197,94,.09);color:#d6ffe4!important}
      .uxq-attempt-status[data-state='retry']{border-color:rgba(251,191,36,.56);background:rgba(245,158,11,.09);color:#ffe7a8!important}
    `;
    document.head.appendChild(style);
  }

  let timer = 0;
  function apply() {
    clearTimeout(timer);
    timer = setTimeout(() => { installStyle(); patchIntro(); preserveContext(); }, 30);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('uxq-progress-updated',apply);
  window.addEventListener('uxq-mission-completed',apply);

  window.UXQMissionAttemptStatusV1 = Object.freeze({apply,version:'20260722-MISSION-ATTEMPT-STATUS-V1'});
})();