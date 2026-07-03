/*
  CSAI2102 AI Quest
  v3.6.5 — Canonical native card navigation
  ------------------------------------------------------------
  Retains safe click handling for legacy cards, but every route now follows:
  S1 -> S2 -> S3 -> B1 -> S4 -> S5 -> S6 -> B2
  The obsolete floating native navigation is retired; the canonical Roadmap
  is the single visible navigation surface.
*/
(function(){
  'use strict';

  const VERSION = 'v3.6.5-canonical-card-navigation';
  const STORAGE_KEY = 'CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const FLOW = ['m1','m2','m3','b1','m4','m5','m6','b2'];

  function recentlySubmitted(){
    try{
      const until = Number(sessionStorage.getItem('AIQUEST_SUPPRESS_AUTOSTART_UNTIL') || 0);
      return Date.now() < until;
    }catch(error){
      return false;
    }
  }

  function suppressAutoStart(ms){
    try{
      sessionStorage.setItem('AIQUEST_SUPPRESS_AUTOSTART_UNTIL', String(Date.now() + (ms || 8000)));
    }catch(error){}
  }

  window.AIQUEST_SUPPRESS_AUTOSTART = suppressAutoStart;

  function toast(message){
    try{
      if(typeof showToast === 'function') showToast(message);
      else console.log('[AIQuest]', message);
    }catch(error){
      console.log('[AIQuest]', message);
    }
  }

  function localState(){
    try{
      return typeof state === 'object' && state ? state : JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    }catch(error){
      return {};
    }
  }

  function passed(id){
    const current = localState();
    return !!(
      (current.completed && current.completed[id]) ||
      (current.stars && Number(current.stars[id] || 0) > 0) ||
      (current.mastered && current.mastered[id]) ||
      (current.bestScore && Number(current.bestScore[id] || 0) >= 60)
    );
  }

  function ready(id){
    if(id === 'm1') return true;
    if(id === 'm2') return passed('m1');
    if(id === 'm3') return passed('m2');
    if(id === 'b1') return ['m1','m2','m3'].every(passed);
    if(id === 'm4') return passed('b1');
    if(id === 'm5') return passed('m4');
    if(id === 'm6') return passed('m5');
    if(id === 'b2') return ['m4','m5','m6'].every(passed);
    return false;
  }

  function inferStageFromText(element){
    const raw = String(element && (element.innerText || element.textContent) || '');
    const value = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    if(/\bb2\b/i.test(raw) || value.includes('applied ai boss gate') || value.includes('search arena boss')) return 'b2';
    if(/\bb1\b/i.test(raw) || value.includes('foundation boss gate') || value.includes('rookie ai boss')) return 'b1';
    if(/\bs1\b/i.test(raw) || value.includes('ai awakening')) return 'm1';
    if(/\bs2\b/i.test(raw) || value.includes('agent builder')) return 'm2';
    if(/\bs3\b/i.test(raw) || value.includes('search maze')) return 'm3';
    if(/\bs4\b/i.test(raw) || value.includes('route cost')) return 'm4';
    if(/\bs5\b/i.test(raw) || value.includes('a* rescue') || value.includes('heuristic')) return 'm5';
    if(/\bs6\b/i.test(raw) || value.includes('knowledge base forge') || value.includes('ฐานความรู้')) return 'm6';
    return '';
  }

  function isRoadmapArea(element){
    if(!element) return false;
    const value = String(element.innerText || element.textContent || '').toLowerCase();
    return value.includes('passed') || value.includes('mastery') || value.includes('boss gate open') || value.includes('locked') || value.includes('กดเพื่อเข้า');
  }

  function nearestLegacyCard(target){
    let element = target;
    for(let depth=0; element && depth<8; depth++,element=element.parentElement){
      if(!element || element === document.body) break;
      if(element.hasAttribute && element.hasAttribute('data-aiq-flow-id')) return null;
      const id = inferStageFromText(element);
      if(id && isRoadmapArea(element)) return {element,id};
    }
    return null;
  }

  function go(id, force){
    if(!force && recentlySubmitted()){
      toast('บันทึกแล้ว: กลับหน้ารวม ไม่เริ่มรอบใหม่อัตโนมัติ');
      return false;
    }
    if(!ready(id)){
      toast('ยังเข้าไม่ได้: ต้องผ่านด่านก่อนหน้าตามลำดับรายวิชา');
      return false;
    }
    if(typeof window.startMission === 'function'){
      toast((passed(id) ? 'เล่นซ้ำ: ' : 'เข้าสู่ ') + id.toUpperCase());
      window.startMission(id);
      return true;
    }
    toast('ไม่พบ startMission');
    return false;
  }

  function installGlobalCapture(){
    if(window.__AIQUEST_CARD_CLICK_NATIVE_V365) return;
    window.__AIQUEST_CARD_CLICK_NATIVE_V365 = true;

    document.addEventListener('click', function(event){
      if(recentlySubmitted()) return;
      if(event.target && event.target.closest && event.target.closest('button, textarea, input, select, form, #gameScreen, #missionScreen, #playScreen, #summaryScreen, #resultScreen, [data-no-roadmap-click]')){
        return;
      }
      const found = nearestLegacyCard(event.target);
      if(!found) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      go(found.id, false);
      return false;
    }, true);
  }

  function markLegacyCards(){
    let marked = 0;
    Array.from(document.querySelectorAll('div, article, section, button')).forEach(element => {
      if(element.hasAttribute && element.hasAttribute('data-aiq-flow-id')) return;
      const id = inferStageFromText(element);
      if(!id || !isRoadmapArea(element)) return;
      const content = String(element.innerText || element.textContent || '');
      if(content.length > 260) return;
      element.setAttribute('data-aiquest-direct-card', id);
      element.style.cursor = ready(id) ? 'pointer' : 'not-allowed';
      element.title = ready(id) ? 'กดเพื่อเข้าเล่น / เล่นซ้ำ' : 'ยังไม่ผ่านเงื่อนไขตามลำดับรายวิชา';
      marked++;
    });
    return marked;
  }

  function removeRetiredNativeNavigation(){
    ['roadmapClickFixPanel','roadmapClickFixPanel_DISABLED','roadmapDirectEntryPanel','aiquestNativeTopBar'].forEach(id => {
      const element = document.getElementById(id);
      if(element) element.remove();
    });
  }

  function boot(){
    installGlobalCapture();
    removeRetiredNativeNavigation();
    markLegacyCards();
    [250,700,1300,2200,3500].forEach(ms => setTimeout(() => {
      removeRetiredNativeNavigation();
      markLegacyCards();
    }, ms));
  }

  window.AIQUEST_CARD_CLICK_NATIVE = {
    version:VERSION,
    go,
    ready,
    markCards:markLegacyCards,
    refresh:boot,
    flow:FLOW.slice()
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.log('[AIQuest] ' + VERSION + ' loaded', window.AIQUEST_CARD_CLICK_NATIVE);
})();
