/* CSAI2102 AI Quest — S2 AR Persistent Entry v4.0.7
   Mirrors the stable S1 entry strategy: the normal S2 page may build #gameArea
   after this script starts, so observe the document as well as the game area.
   Presentation/launch only: does not change S2 score, gating, or main gameplay.
*/
(() => {
  'use strict';

  const CARD_ID = 'aiquestS2ArEntryV407';
  const BRIDGE_SRC = './js/aiquest-s2-ar-result-bridge-v406.js?v=20260629-s2bridge406';
  const q = new URLSearchParams(location.search);
  const routeSession = String(q.get('session') || '').toLowerCase();

  function ensureResultBridge(){
    if (
      window.AIQUEST_S2_AR_RESULT_BRIDGE &&
      window.AIQUEST_S2_AR_RESULT_BRIDGE.version === 'v4.0.6-s2-ar-reliable-event-sync'
    ) return;

    const absolute = new URL(BRIDGE_SRC, document.baseURI).href;
    const exists = [...document.scripts].some((script) => script.src === absolute);
    if (exists) return;

    const tag = document.createElement('script');
    tag.src = BRIDGE_SRC;
    tag.async = false;
    tag.dataset.aiquestS2ArBridge = 'v406';
    tag.onerror = () => console.warn('[AIQuest S2 AR] evidence bridge failed to load');
    document.head.appendChild(tag);
  }

  // Recover local evidence on the normal page and sync after direct AR completion.
  if (!routeSession || routeSession === 's2' || routeSession === 'm2') {
    ensureResultBridge();
  }

  // The AR route owns its own canvas/runtime. Never inject a launcher card there.
  if (q.get('ar') || (routeSession && routeSession !== 's2' && routeSession !== 'm2')) return;

  function saved(){
    try {
      return JSON.parse(localStorage.getItem('AIQUEST_S2_AR_RESULT_V401') || 'null');
    } catch (_) {
      return null;
    }
  }

  function isS2(){
    const heading = document.getElementById('gameHeading');
    const text = String(heading?.textContent || '');
    return /(^|\s)2\s*:\s*Agent Builder/i.test(text) || /Agent Builder/i.test(text);
  }

  function host(){
    const area = document.getElementById('gameArea');
    return area && isS2() ? area : null;
  }

  function card(){
    const result = saved();
    const done = Boolean(result && (result.arCompleted || result.completed));
    const total = Number(result?.total || 0);
    const correct = Number(result?.correct || 0);
    const score = Math.round(Number(result?.arScore ?? result?.score ?? result?.accuracy ?? 0));

    const wrap = document.createElement('section');
    wrap.id = CARD_ID;
    wrap.dataset.aiquestS2Ar = 'true';
    wrap.style.cssText = [
      'margin:0 0 14px',
      'padding:14px 16px',
      'border-radius:18px',
      'border:1px solid rgba(103,232,249,.55)',
      'background:linear-gradient(135deg,rgba(8,145,178,.18),rgba(124,58,237,.14))',
      'box-shadow:0 12px 26px rgba(0,0,0,.16)',
      'position:relative',
      'z-index:8'
    ].join(';');

    wrap.innerHTML = `
      <div style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <div style="min-width:0">
          <div style="font-weight:1000;color:#f5f3ff;font-size:16px">🤖 S2 AR Practice: Agent Builder</div>
          <div style="margin-top:4px;color:#dbeafe;font-size:13px;line-height:1.5">ใช้มือชี้ค้างหรือ pinch ฝึก Agent or Not • PEAS • Environment • Rational Agent</div>
          <div style="margin-top:5px;color:#bbf7d0;font-size:12px;font-weight:900">กิจกรรมเสริม • ไม่กระทบคะแนน S2 หลัก${done ? ` • เล่นแล้ว ${correct}/${total} = ${score}%` : ''}</div>
        </div>
        <button type="button" id="aiquestS2ArStartV407" style="border:0;border-radius:14px;padding:12px 16px;font-weight:1000;cursor:pointer;color:#082f49;background:linear-gradient(135deg,#67e8f9,#c4b5fd);box-shadow:0 8px 20px rgba(56,189,248,.25)">${done ? 'ฝึก AR อีกครั้ง' : 'เริ่ม AR Practice'}</button>
      </div>`;

    wrap.querySelector('#aiquestS2ArStartV407').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const u = new URL(location.href);
      u.searchParams.set('session', 's2');
      u.searchParams.set('ar', 'agent');
      u.searchParams.set('from', 's2');
      u.searchParams.set('v', '20260629-s2-entry407');
      location.assign(u.toString());
    }, true);

    return wrap;
  }

  function inject(){
    const area = host();
    if (!area) return;

    const old = document.getElementById(CARD_ID);
    if (old && old.parentNode === area) return;
    old?.remove();

    area.insertBefore(card(), area.firstChild);
    console.log('[AIQuest S2 AR] persistent entry visible v4.0.7');
  }

  let queued = false;
  function schedule(){
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      inject();
    }, 60);
  }

  function boot(){
    schedule();

    // #gameArea often does not exist yet when the entry script first executes.
    // A document-level observer is required so S2 gets the same resilience as S1.
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
