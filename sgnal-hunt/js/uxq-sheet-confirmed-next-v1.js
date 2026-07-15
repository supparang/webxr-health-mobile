/* CSAI2601 UX Quest • Sheet-confirmed Next Mission Gate v1.1
 * Google Sheet is the sole authority for navigation after a mission result.
 *
 * Contract
 * - A local 2★ result may submit mission_completed, but never unlocks the next link by itself.
 * - The next link remains disabled until uxq_student_progress confirms the current mission
 *   in the contiguous canonical path.
 * - A replay of an earlier completed mission may continue to its canonical successor when
 *   that successor is already confirmed in the contiguous Sheet history.
 * - localStorage is not consulted for official navigation approval.
 */
(() => {
  'use strict';

  const VERSION = 'uxq-sheet-confirmed-next-v1.1-20260715';
  const STATUS_ATTR = 'data-sheet-next-status';
  const LINK_ATTR = 'data-sheet-next-gate';
  const ORDER = [
    'w1','w2','w3','b1','w4','w5','w6','w7','b2',
    'w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'
  ];
  const params = new URLSearchParams(location.search || '');
  const current = String(params.get('node') || params.get('id') || 'W1').trim().toLowerCase();
  const currentIndex = ORDER.indexOf(current);
  const expectedNext = currentIndex >= 0 ? (ORDER[currentIndex + 1] || '') : '';
  const cfg = () => window.UXQ_CLASSROOM_CONFIG || {};
  const identity = () => window.UXQIdentity;

  let runToken = 0;
  let activeLink = null;

  function ensureStyle() {
    if (document.getElementById('uxq-sheet-next-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'uxq-sheet-next-style-v1';
    style.textContent = `
      [${LINK_ATTR}="locked"]{opacity:.62!important;cursor:wait!important;pointer-events:auto!important;filter:saturate(.55)}
      [${LINK_ATTR}="error"]{opacity:1!important;cursor:pointer!important;border-color:rgba(255,209,102,.62)!important;background:rgba(255,209,102,.12)!important;color:#ffe7a8!important}
      [${LINK_ATTR}="confirmed"]{opacity:1!important;cursor:pointer!important;filter:none!important}
      [${STATUS_ATTR}]{width:min(820px,100%);box-sizing:border-box;border:1px solid rgba(123,232,255,.28);border-radius:14px;padding:11px 13px;background:rgba(7,25,53,.62);color:#cfe2ff;font-size:.86rem;line-height:1.48;text-align:left}
      [${STATUS_ATTR}][data-tone="ok"]{border-color:rgba(84,235,174,.52);color:#bdf6d9;background:rgba(36,120,88,.14)}
      [${STATUS_ATTR}][data-tone="error"]{border-color:rgba(255,209,102,.55);color:#ffe5a1;background:rgba(120,86,24,.14)}
      @media(max-width:760px){[${STATUS_ATTR}]{font-size:.82rem}}
    `;
    document.head.appendChild(style);
  }

  function profile() {
    const p = identity()?.get?.() || {};
    return {
      studentId: String(p.studentId || '').trim(),
      studentName: String(p.studentName || '').trim(),
      section: String(p.section || '').trim()
    };
  }

  function localResultPassed() {
    try {
      const result = window.UXQProgress?.get?.()?.missions?.[current]?.lastResult || {};
      return Boolean(result.passed || Number(result.stars || 0) >= 2);
    } catch (_) {
      return false;
    }
  }

  function cleanNodeUrl(nodeId) {
    return `./csai2601-canonical-node-clean-v1.html?node=${encodeURIComponent(String(nodeId || '').toUpperCase())}&v=sheet-next-gate-v1.1-20260715`;
  }

  function nextLink() {
    const results = document.querySelector('.results');
    if (!results || !expectedNext) return null;
    const links = Array.from(results.querySelectorAll('a.btn'));
    return links.find(link => {
      const text = String(link.textContent || '').trim().toLowerCase();
      const href = String(link.getAttribute('href') || '').toLowerCase();
      return text.includes('ไปต่อ') || href.includes(`node=${expectedNext}`);
    }) || null;
  }

  function statusBox(link) {
    const results = link?.closest('.results');
    if (!results) return null;
    let box = results.querySelector(`[${STATUS_ATTR}]`);
    if (!box) {
      box = document.createElement('div');
      box.setAttribute(STATUS_ATTR, '1');
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      const actions = link.closest('.actions');
      actions?.insertAdjacentElement('beforebegin', box);
    }
    return box;
  }

  function setStatus(link, message, tone = '') {
    const box = statusBox(link);
    if (!box) return;
    box.textContent = message;
    box.dataset.tone = tone;
  }

  function lock(link) {
    link.setAttribute(LINK_ATTR, 'locked');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('href', '#');
    link.textContent = `กำลังยืนยัน ${current.toUpperCase()} จาก Sheet…`;
  }

  function unlock(link) {
    link.setAttribute(LINK_ATTR, 'confirmed');
    link.setAttribute('aria-disabled', 'false');
    link.setAttribute('href', cleanNodeUrl(expectedNext));
    link.textContent = `ไปต่อ ${expectedNext.toUpperCase()} →`;
    setStatus(link, `Google Sheet ยืนยัน ${current.toUpperCase()} แล้ว • เปิด ${expectedNext.toUpperCase()} ได้`, 'ok');
  }

  function errorState(link, message) {
    link.setAttribute(LINK_ATTR, 'error');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('href', '#');
    link.textContent = 'ตรวจ Sheet อีกครั้ง';
    setStatus(link, message, 'error');
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = '__uxqNextGate_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(new Error('หมดเวลารอ Google Sheet')), 15000);
      function finish(error, value) {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(value);
      }
      window[callback] = value => finish(null, value);
      const u = new URL(url);
      u.searchParams.set('callback', callback);
      script.src = u.href;
      script.onerror = () => finish(new Error('เชื่อมต่อ Apps Script ไม่สำเร็จ'));
      document.head.appendChild(script);
    });
  }

  async function requestProgress() {
    const endpoint = String(cfg().receiverUrl || '').trim();
    if (!endpoint) throw new Error('ยังไม่ได้ตั้งค่า receiverUrl');
    const p = profile();
    if (!p.studentId || !p.section) throw new Error('ข้อมูลผู้เรียนไม่ครบ');
    const url = new URL(endpoint);
    url.searchParams.set('action', 'uxq_student_progress');
    url.searchParams.set('studentId', p.studentId);
    url.searchParams.set('section', p.section);
    url.searchParams.set('courseId', String(cfg().courseId || 'UXQ-ACT1-2026'));
    url.searchParams.set('_', String(Date.now()));
    try {
      const response = await fetch(url.href, { method:'GET', cache:'no-store', redirect:'follow' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return JSON.parse(await response.text());
    } catch (_) {
      return jsonp(url.href);
    }
  }

  function confirmation(result) {
    if (!result || !result.ok) return { ok:false, reason:'invalid_response' };
    const canonicalPassed = Array.isArray(result.diagnostics?.canonicalPassedMissionIds)
      ? result.diagnostics.canonicalPassedMissionIds.map(value => String(value).toLowerCase())
      : [];
    const mission = result.missions?.[current];
    const currentPassed = Boolean(
      canonicalPassed.includes(current) && mission &&
      (mission.completed || mission.passed || Number(mission.bestStars || mission.stars || 0) >= 2)
    );
    const apiNext = String(result.nextMission || '').trim().toLowerCase();
    const successorAlreadyPassed = canonicalPassed.includes(expectedNext);
    const expectedIsOfficialNext = apiNext === expectedNext;
    return {
      ok: currentPassed && (expectedIsOfficialNext || successorAlreadyPassed),
      currentPassed,
      expectedIsOfficialNext,
      successorAlreadyPassed,
      apiNext,
      canonicalPassed
    };
  }

  async function confirm(link, token) {
    const attempts = 10;
    for (let i = 0; i < attempts; i += 1) {
      if (token !== runToken || !document.contains(link)) return;
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 1500));
      setStatus(link, `กำลังรอ Google Sheet ยืนยันผล ${current.toUpperCase()}… (${i + 1}/${attempts})`);
      try {
        const result = await requestProgress();
        const checked = confirmation(result);
        if (checked.ok) {
          unlock(link);
          window.dispatchEvent(new CustomEvent('uxq-sheet-next-confirmed', {
            detail:{ current, next:expectedNext, result, confirmation:checked }
          }));
          return;
        }
      } catch (error) {
        if (i === attempts - 1) {
          errorState(link, `ยังยืนยันจาก Sheet ไม่สำเร็จ: ${error.message || error} • กดตรวจอีกครั้ง หรือกลับ Mission Control`);
          return;
        }
      }
    }
    errorState(link, `ยังไม่พบผล ${current.toUpperCase()} ที่ผ่านใน Google Sheet • กดตรวจอีกครั้ง หรือกลับ Mission Control`);
  }

  function begin(link) {
    if (!link || (link === activeLink && link.getAttribute(LINK_ATTR) === 'locked')) return;
    activeLink = link;
    ensureStyle();

    if (!localResultPassed()) {
      link.setAttribute(LINK_ATTR, 'locked');
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('href', '#');
      link.textContent = 'ต้องผ่าน 2★ ก่อน';
      setStatus(link, 'ผลในรอบนี้ยังไม่ผ่าน จึงยังไม่ส่งคำขอเปิดด่านถัดไป', 'error');
      return;
    }

    lock(link);
    setStatus(link, `ส่งผล ${current.toUpperCase()} แล้ว • กำลังรอ Google Sheet ยืนยัน`);
    try { window.CSAI2601UXQAutoSheet?.autoMission?.(); } catch (_) {}
    const token = ++runToken;
    setTimeout(() => confirm(link, token), 700);
  }

  function scan() {
    const link = nextLink();
    if (link && !link.hasAttribute(LINK_ATTR)) begin(link);
  }

  document.addEventListener('click', event => {
    const link = event.target.closest?.(`[${LINK_ATTR}]`);
    if (!link) return;
    const state = link.getAttribute(LINK_ATTR);
    if (state === 'confirmed') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (state === 'error') {
      lock(link);
      const token = ++runToken;
      confirm(link, token);
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once:true });
  else scan();
  new MutationObserver(scan).observe(document.getElementById('uxqCanonicalNode') || document.body, { childList:true, subtree:true });

  window.UXQSheetConfirmedNext = Object.freeze({ version:VERSION, requestProgress, confirmation, scan });
})();
