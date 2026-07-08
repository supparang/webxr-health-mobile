/* CSAI2601 UX Quest • Strict Gate v1
 * Locks next node when Reason Check is below threshold.
 * Weekly nodes require Reason >= 70; Boss nodes require Reason >= 75.
 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const txt = (el) => String(el?.textContent || '').trim();
  const q = () => new URLSearchParams(location.search || '');
  const nodeId = () => String(q().get('node') || q().get('id') || 'W1').toUpperCase();
  const key = () => nodeId().toLowerCase();
  const isBoss = () => /^B\d+$/i.test(nodeId());
  const requiredReason = () => isBoss() ? 75 : 70;
  const requiredAccuracy = () => 70;

  function numberFrom(textValue) {
    const m = String(textValue || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function metric(labelPattern) {
    const cards = $$('.result-grid div');
    for (const card of cards) {
      const label = txt($('span', card)).toLowerCase();
      if (labelPattern.test(label)) return numberFrom(txt($('b', card)));
    }
    return 0;
  }

  function metrics() {
    return {
      accuracy: metric(/accuracy|ถูกต้อง/),
      reason: metric(/reason|เหตุผล/),
      score: metric(/score|คะแนน/)
    };
  }

  function strictPass(m) {
    return m.accuracy >= requiredAccuracy() && m.reason >= requiredReason();
  }

  function correctProgress(m) {
    try {
      const api = window.UXQProgress;
      if (!api || !api.get || !api.save) return;
      const progress = api.get();
      const id = key();
      const row = progress.missions && progress.missions[id];
      if (!row) return;

      const last = row.lastResult || {};
      const nextStars = strictPass(m) ? Number(last.stars || row.bestStars || 0) : Math.min(1, Number(last.stars || row.bestStars || 0));
      const nextPassed = strictPass(m);
      const history = Array.isArray(row.history) ? row.history.slice() : [];
      if (history.length) {
        const i = history.length - 1;
        history[i] = Object.assign({}, history[i], { stars: nextStars, passed: nextPassed, strictGate: nextPassed ? 'pass' : 'reason_lock', reasonAccuracy: m.reason, requiredReason: requiredReason() });
      }

      row.lastResult = Object.assign({}, last, { stars: nextStars, passed: nextPassed, strictGate: nextPassed ? 'pass' : 'reason_lock', reasonAccuracy: m.reason, requiredReason: requiredReason() });
      row.history = history;
      row.completed = history.some((item) => Boolean(item.passed));
      row.bestStars = Math.max(0, ...history.map((item) => Number(item.stars || 0)));
      row.bestScore = Math.max(0, ...history.map((item) => Number(item.score || 0)));
      row.bestAccuracy = Math.max(0, ...history.map((item) => Number(item.accuracy || 0)));
      progress.missions[id] = row;
      api.save(progress);
    } catch (error) {
      console.warn('[UXQ Strict Gate] progress correction failed', error);
    }
  }

  function lockUi(m) {
    const results = $('.results');
    if (!results || results.dataset.strictGateApplied === '1') return;
    if (strictPass(m)) {
      results.dataset.strictGateApplied = '1';
      return;
    }

    const h1 = $('h1', results);
    if (h1) h1.textContent = `${nodeId()} ยังไม่ปลดล็อกด่านถัดไป`;
    const p = $('h1 + p', results);
    if (p) p.textContent = `ตอบภารกิจหลักผ่านแล้ว แต่ Reason Check ได้ ${m.reason}% ต้องได้อย่างน้อย ${requiredReason()}% จึงจะไปต่อได้`;

    const warn = document.createElement('section');
    warn.className = 'strict-gate-warning';
    warn.innerHTML = `<b>ยังต้องฝึกเหตุผลอีกนิด</b><span>เล่นซ้ำด้วย case ใหม่ แล้วเลือกเหตุผลให้โยงกับหลักฐานผู้ใช้ ไม่ใช่แค่คำตอบหลัก</span>`;
    const grid = $('.result-grid', results);
    if (grid && !$('.strict-gate-warning', results)) grid.insertAdjacentElement('afterend', warn);

    $$('a.btn', results).forEach((a) => {
      if (/ไปต่อ\s+/i.test(txt(a))) {
        a.classList.add('disabled');
        a.setAttribute('aria-disabled', 'true');
        a.removeAttribute('href');
        a.style.pointerEvents = 'none';
        a.style.opacity = '.45';
        a.textContent = `ยังไม่ผ่าน Reason ${requiredReason()}%`;
      }
    });

    results.dataset.strictGateApplied = '1';
  }

  function style() {
    if ($('#uxq-strict-gate-style')) return;
    const s = document.createElement('style');
    s.id = 'uxq-strict-gate-style';
    s.textContent = `.strict-gate-warning{width:min(820px,100%);border:1px solid rgba(255,209,102,.55);border-radius:16px;background:rgba(255,209,102,.1);padding:13px 14px;text-align:left;display:grid;gap:4px;color:#fff}.strict-gate-warning b{color:#ffe08a}.strict-gate-warning span{color:#f3e8bd;line-height:1.55}`;
    document.head.appendChild(s);
  }

  function apply() {
    const results = $('.results');
    if (!results) return;
    style();
    const m = metrics();
    correctProgress(m);
    lockUi(m);
  }

  let timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(apply, 40); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
