
(function(){
  'use strict';

  const VERSION = 'v3.3.0-phase1-ready-cleanup';

  function recentlySubmitted(){
    try{
      const until = Number(sessionStorage.getItem('AIQUEST_SUPPRESS_AUTOSTART_UNTIL') || 0);
      return Date.now() < until;
    }catch(e){
      return false;
    }
  }

  function suppressAutoStart(ms){
    try{
      sessionStorage.setItem('AIQUEST_SUPPRESS_AUTOSTART_UNTIL', String(Date.now() + (ms || 8000)));
    }catch(e){}
  }

  window.AIQUEST_SUPPRESS_AUTOSTART = suppressAutoStart;

  function toast(msg){
    try{
      if(typeof showToast === 'function') showToast(msg);
      else console.log('[AIQuest]', msg);
    }catch(e){ console.log('[AIQuest]', msg); }
  }

  function passed(id){
    try{
      return !!(
        state.completed[id] ||
        state.stars[id] ||
        state.mastered[id] ||
        Number(state.bestScore[id] || 0) >= 60
      );
    }catch(e){
      return false;
    }
  }

  function ready(id){
    if(id === 'm1') return true;
    if(id === 'm2') return passed('m1');
    if(id === 'b1') return passed('m1') && passed('m2');
    if(id === 'm3') return passed('m1') && passed('m2') && passed('b1');
    if(id === 'm4') return passed('m3');
    if(id === 'm5') return passed('m4');
    if(id === 'b2') return passed('m3') && passed('m4') && passed('m5');
    return false;
  }

  function inferStageFromText(el){
    const raw = String(el && (el.innerText || el.textContent) || '');
    const t = raw.toLowerCase().replace(/\s+/g,' ').trim();

    // ต้องเช็ก B2/B1 ก่อน เพราะมีคำว่า Boss ซ้ำ
    if(/\bb2\b/i.test(raw) || t.includes('search arena boss')) return 'b2';
    if(/\bb1\b/i.test(raw) || t.includes('rookie ai boss')) return 'b1';
    if(/\bs1\b/i.test(raw) || t.includes('ai awakening')) return 'm1';
    if(/\bs2\b/i.test(raw) || t.includes('agent builder')) return 'm2';
    if(/\bs3\b/i.test(raw) || t.includes('search maze')) return 'm3';
    if(/\bs4\b/i.test(raw) || t.includes('route cost')) return 'm4';
    if(/\bs5\b/i.test(raw) || t.includes('a* rescue') || t.includes('heuristic')) return 'm5';
    return '';
  }

  function isRoadmapArea(el){
    if(!el) return false;
    const t = String(el.innerText || el.textContent || '').toLowerCase();
    // การ์ด roadmap จะมี title + status พวกนี้
    return t.includes('passed') || t.includes('mastery') || t.includes('boss gate open') || t.includes('locked') || t.includes('กดเพื่อเข้า');
  }

  function nearestCard(target){
    let el = target;
    for(let i=0; el && i<8; i++, el=el.parentElement){
      if(!el || el === document.body) break;
      const id = inferStageFromText(el);
      if(id && isRoadmapArea(el)) return {el,id};
    }
    return null;
  }

  function go(id, force){
    if(!force && recentlySubmitted()){
      toast('บันทึกแล้ว: กลับหน้ารวม ไม่เริ่มรอบใหม่อัตโนมัติ');
      return false;
    }
    if(!ready(id)){
      toast('ยังเข้าไม่ได้: ยังไม่ผ่านเงื่อนไขก่อนหน้า');
      return false;
    }
    if(typeof startMission === 'function'){
      toast((passed(id) ? 'Replay ' : 'เข้า ') + id.toUpperCase());
      startMission(id);
      return true;
    }
    toast('ไม่พบ startMission');
    return false;
  }

  function installGlobalCapture(){
    if(window.__AIQUEST_CARD_CLICK_NATIVE_V319) return;
    window.__AIQUEST_CARD_CLICK_NATIVE_V319 = true;

    document.addEventListener('click', function(ev){
      if(recentlySubmitted()) return;
      if(ev.target && ev.target.closest && ev.target.closest('button, textarea, input, select, form, #gameScreen, #missionScreen, #playScreen, #summaryScreen, #resultScreen, [data-no-roadmap-click]')){
        return;
      }
      const found = nearestCard(ev.target);
      if(!found) return;

      // ปล่อยปุ่มลอย/ปุ่มจริงทำงานเอง ถ้าไม่ใช่การ์ด
      if(ev.target && ev.target.closest && ev.target.closest('#roadmapClickFixPanel_DISABLED')) return;

      const id = found.id;
      if(!['m1','m2','m3','m4','m5','b1','b2'].includes(id)) return;

      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();

      go(id, false);
      return false;
    }, true);
  }

  function markCards(){
    const all = Array.from(document.querySelectorAll('div, article, section, button'));
    let marked = 0;
    all.forEach(el => {
      const id = inferStageFromText(el);
      if(!id) return;
      if(!isRoadmapArea(el)) return;

      // เลือก element ที่ดูเป็น card: มีข้อความไม่ยาวเกินไปและมี border/radius จาก class/card
      const txt = String(el.innerText || el.textContent || '');
      if(txt.length > 260) return;

      el.setAttribute('data-aiquest-direct-card', id);
      el.style.cursor = ready(id) ? 'pointer' : 'not-allowed';
      el.title = ready(id) ? 'กดเพื่อเข้าเล่น / Replay' : 'ยังไม่ผ่านเงื่อนไข';
      marked++;
    });
    return marked;
  }

  function removeOldDuplicatePanels(){
    ['roadmapClickFixPanel','roadmapClickFixPanel_DISABLED','roadmapDirectEntryPanel'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.remove();
    });
  }

  function addTopReplayButton(){
    removeOldDuplicatePanels();
    try{
      const qs = new URLSearchParams(location.search);
      if(qs.get('teacher') === '1'){
        const oldBar=document.getElementById('aiquestNativeTopBar');
        if(oldBar) oldBar.remove();
        return;
      }
    }catch(e){}
    let bar = document.getElementById('aiquestNativeTopBar');
    if(bar) bar.remove();

    const header = document.querySelector('.topbar, header, .hero, .app-header') || document.body;
    bar = document.createElement('div');
    bar.id = 'aiquestNativeTopBar';
    bar.style.position = 'fixed';
    bar.style.left = '50%';
    bar.style.transform = 'translateX(-50%)';
    bar.style.bottom = '18px';
    bar.style.zIndex = '100000';
    bar.style.display = 'flex';
    bar.style.gap = '8px';
    bar.style.padding = '8px';
    bar.style.borderRadius = '18px';
    bar.style.background = 'rgba(15,23,42,.92)';
    bar.style.border = '1px solid rgba(34,211,238,.35)';
    bar.style.boxShadow = '0 18px 44px rgba(0,0,0,.38)';

    const ids = ['m1','m2','b1','m3','m4','m5','b2'];
    const labels = {m1:'S1',m2:'S2',b1:'B1',m3:'S3',m4:'S4',m5:'S5',b2:'B2'};
    ids.forEach(id=>{
      const btn=document.createElement('button');
      btn.textContent=labels[id];
      btn.className='btn small';
      btn.style.borderRadius='999px';
      btn.style.padding='8px 12px';
      btn.style.fontWeight='900';
      btn.style.border='1px solid rgba(255,255,255,.15)';
      btn.style.background=id==='b2'?'linear-gradient(135deg,#22c55e,#14b8a6)':'rgba(255,255,255,.08)';
      btn.style.color='#fff';
      btn.disabled=!ready(id);
      btn.style.opacity=btn.disabled?'.42':'1';
      btn.onclick=(e)=>{e.preventDefault();e.stopPropagation();go(id, true);};
      bar.appendChild(btn);
    });
    document.body.appendChild(bar);
  }

  function boot(){
    installGlobalCapture();
    markCards();
    addTopReplayButton();
    [250,700,1300,2200,3500].forEach(ms=>setTimeout(()=>{
      markCards();
      addTopReplayButton();
    },ms));
  }

  window.AIQUEST_CARD_CLICK_NATIVE = {
    version: VERSION,
    go,
    ready,
    markCards,
    refresh: boot
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_CARD_CLICK_NATIVE);
})();
