/* CSAI2102 AI Quest — S6 Knowledge Base Forge Access Gate v4.1.2
   Enables the already-installed S6 engine only after B2 has been passed.
   Does not open S7+ or alter any core score/unlock rule beyond S6 entry.
*/
(function(){
  'use strict';

  const STORAGE_KEY = 'CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const S6 = 'm6';
  const B2 = 'b2';

  function readState(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function passed(st, id){
    return !!(st.completed && st.completed[id]) ||
      Number(st.stars && st.stars[id] || 0) > 0 ||
      Number(st.bestScore && st.bestScore[id] || 0) >= 60;
  }

  function notify(message){
    if (typeof window.showToast === 'function') window.showToast(message);
    else window.alert(message);
  }

  function canOpenS6(){ return passed(readState(), B2); }

  function startS6(){
    if (!canOpenS6()) {
      notify('S6 จะเปิดหลังผ่าน B2 Search Arena Boss อย่างน้อย 1 ดาว');
      return;
    }
    if (typeof window.startMission === 'function') {
      window.startMission(S6);
      return;
    }
    notify('ยังโหลด S6 engine ไม่ครบ กรุณา refresh หน้าอีกครั้ง');
  }

  function tuneCard(card){
    if (!card || card.dataset.s6AccessV412 === '1') return;
    card.dataset.s6AccessV412 = '1';
    card.classList.remove('locked');
    card.classList.add('open');
    card.removeAttribute('aria-disabled');

    const status = card.querySelector('.roadmapStatus');
    if (status) {
      status.textContent = canOpenS6() ? 'Open' : 'Locked';
      status.className = 'roadmapStatus ' + (canOpenS6() ? 'open' : 'locked');
    }

    const hint = card.querySelector('.roadmapClickHint');
    if (hint) hint.textContent = canOpenS6()
      ? 'กดเพื่อเริ่ม S6 Knowledge Base Forge'
      : 'ผ่าน B2 Search Arena Boss ก่อน';

    const detail = card.querySelectorAll('.roadmapTopic');
    if (detail.length > 1) detail[1].textContent = canOpenS6()
      ? 'เปิดตามเกณฑ์: ผ่าน B2 Search Arena Boss'
      : 'เงื่อนไข: ผ่าน B2 Search Arena Boss';
  }

  function tuneRoadmap(){
    document.querySelectorAll('[data-roadmap-id="m6"]').forEach(tuneCard);

    document.querySelectorAll('.pill, .subtitle, .tagline, p, div').forEach(function(el){
      if (el.dataset && el.dataset.s6LabelV412 === '1') return;
      const t = String(el.textContent || '').trim();
      if (t === 'Phase 1 Ready: S1–S5 + B1–B2 พร้อมใช้งาน') {
        el.dataset.s6LabelV412 = '1';
        el.textContent = 'Phase 1 Complete • S6 เปิดตามเกณฑ์ B2';
      }
    });
  }

  // Capture phase runs before the roadmap card's legacy bubble handler.
  document.addEventListener('click', function(ev){
    const card = ev.target && ev.target.closest ? ev.target.closest('[data-roadmap-id="m6"]') : null;
    if (!card) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    startS6();
  }, true);

  function boot(){
    tuneRoadmap();
    const observer = new MutationObserver(tuneRoadmap);
    observer.observe(document.documentElement, {childList:true, subtree:true});
    setInterval(tuneRoadmap, 1200);
    window.AIQuestS6AccessGateV412 = { canOpenS6, startS6, tuneRoadmap };
    console.log('[AIQuest] S6 access gate v4.1.2 loaded');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();