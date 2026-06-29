/* CSAI2102 AI Quest — S2 AR Persistent Entry v4.0.5
   Keeps an optional S2 Agent Builder AR card visible after Session 2 renders.
*/
(() => {
  'use strict';
  const CARD_ID = 'aiquestS2ArEntryV405';
  const q = new URLSearchParams(location.search);
  const routeSession = String(q.get('session') || '').toLowerCase();
  if (q.get('ar') || (routeSession && routeSession !== 's2' && routeSession !== 'm2')) return;

  function saved(){
    try { return JSON.parse(localStorage.getItem('AIQUEST_S2_AR_RESULT_V401') || 'null'); }
    catch (_) { return null; }
  }
  function isS2(){
    const heading = document.getElementById('gameHeading');
    const text = String(heading?.textContent || '');
    return /(^|\s)2\s*:\s*Agent Builder/i.test(text) || /Agent Builder/i.test(text);
  }
  function host(){ const area = document.getElementById('gameArea'); return area && isS2() ? area : null; }
  function card(){
    const result = saved();
    const done = Boolean(result && (result.arCompleted || result.completed));
    const total = Number(result?.total || 0);
    const correct = Number(result?.correct || 0);
    const score = Math.round(Number(result?.arScore ?? result?.score ?? result?.accuracy ?? 0));
    const wrap = document.createElement('section');
    wrap.id = CARD_ID;
    wrap.dataset.aiquestS2Ar = 'true';
    wrap.style.cssText = 'margin:0 0 14px;padding:14px 16px;border-radius:18px;border:1px solid rgba(103,232,249,.55);background:linear-gradient(135deg,rgba(8,145,178,.18),rgba(124,58,237,.14));box-shadow:0 12px 26px rgba(0,0,0,.16);position:relative;z-index:8';
    wrap.innerHTML = `
      <div style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <div style="min-width:0">
          <div style="font-weight:1000;color:#f5f3ff;font-size:16px">🤖 S2 AR Practice: Agent Builder</div>
          <div style="margin-top:4px;color:#dbeafe;font-size:13px;line-height:1.5">ใช้มือชี้ค้างหรือ pinch ฝึก PEAS • Percept • Environment • Rational Agent</div>
          <div style="margin-top:5px;color:#bbf7d0;font-size:12px;font-weight:900">กิจกรรมเสริม • ไม่กระทบคะแนน S2 หลัก${done ? ` • เล่นแล้ว ${correct}/${total} = ${score}%` : ''}</div>
        </div>
        <button type="button" id="aiquestS2ArStartV405" style="border:0;border-radius:14px;padding:12px 16px;font-weight:1000;cursor:pointer;color:#082f49;background:linear-gradient(135deg,#67e8f9,#c4b5fd);box-shadow:0 8px 20px rgba(56,189,248,.25)">${done ? 'ฝึก AR อีกครั้ง' : 'เริ่ม AR Practice'}</button>
      </div>`;
    wrap.querySelector('#aiquestS2ArStartV405').addEventListener('click', (event) => {
      event.preventDefault(); event.stopPropagation();
      const u = new URL(location.href);
      u.searchParams.set('session','s2');
      u.searchParams.set('ar','agent');
      u.searchParams.set('from','s2');
      u.searchParams.set('v','20260629-s2-entry405');
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
    console.log('[AIQuest S2 AR] persistent entry visible');
  }
  let queued = false;
  function schedule(){ if(queued) return; queued=true; setTimeout(() => { queued=false; inject(); }, 60); }
  function boot(){
    schedule();
    const area = document.getElementById('gameArea');
    if (area) new MutationObserver(schedule).observe(area, {childList:true, subtree:false});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
