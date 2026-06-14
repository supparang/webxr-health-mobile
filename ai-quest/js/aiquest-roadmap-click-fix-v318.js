
(function(){
  'use strict';

  const VERSION = 'v3.1.8-roadmap-click-fix';

  function toast(msg){
    try{
      if(typeof showToast === 'function') showToast(msg);
      else console.log('[AIQuest]', msg);
    }catch(e){ console.log('[AIQuest]', msg); }
  }

  function passedAny(id){
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

  function normalize(id){
    if(id === 's1') return 'm1';
    if(id === 's2') return 'm2';
    if(id === 's3') return 'm3';
    if(id === 's4') return 'm4';
    if(id === 's5') return 'm5';
    return id;
  }

  function ready(id){
    id = normalize(id);
    if(id === 'm1') return true;
    if(id === 'm2') return passedAny('m1');
    if(id === 'b1') return passedAny('m1') && passedAny('m2');
    if(id === 'm3') return passedAny('m1') && passedAny('m2') && passedAny('b1');
    if(id === 'm4') return passedAny('m3');
    if(id === 'm5') return passedAny('m4');
    if(id === 'b2') return passedAny('m3') && passedAny('m4') && passedAny('m5');
    return false;
  }

  function start(id){
    id = normalize(id);
    if(!ready(id)){
      toast('ยังเข้าไม่ได้: ยังไม่ผ่านเงื่อนไขก่อนหน้า');
      return false;
    }
    if(typeof startMission === 'function'){
      toast('เข้าเล่น ' + id.toUpperCase());
      startMission(id);
      return true;
    }
    toast('ยังไม่พบ startMission');
    return false;
  }

  function textGuess(card){
    const t = (card.innerText || card.textContent || '').toLowerCase();
    if(t.includes('search arena boss') || /^b2\b/i.test(card.innerText||'')) return 'b2';
    if(t.includes('rookie ai boss') || /^b1\b/i.test(card.innerText||'')) return 'b1';
    if(t.includes('ai awakening') || /^s1\b/i.test(card.innerText||'')) return 'm1';
    if(t.includes('agent builder') || /^s2\b/i.test(card.innerText||'')) return 'm2';
    if(t.includes('search maze') || /^s3\b/i.test(card.innerText||'')) return 'm3';
    if(t.includes('route cost') || /^s4\b/i.test(card.innerText||'')) return 'm4';
    if(t.includes('a* rescue') || /^s5\b/i.test(card.innerText||'')) return 'm5';
    return '';
  }

  function findStageId(card){
    return normalize(
      card.getAttribute('data-stage-id') ||
      card.dataset.stage ||
      card.dataset.id ||
      textGuess(card)
    );
  }

  function patchCards(){
    const cards = Array.from(document.querySelectorAll('.stage-card, .roadmap-card, .mission-card, [data-stage-id]'));
    let patched = 0;

    cards.forEach(card => {
      const id = findStageId(card);
      if(!['m1','m2','m3','m4','m5','b1','b2'].includes(id)) return;

      card.setAttribute('data-direct-stage-id', id);
      card.style.cursor = ready(id) ? 'pointer' : 'not-allowed';

      if(card.__roadmapClickFixV318) return;
      card.__roadmapClickFixV318 = true;
      patched++;

      card.addEventListener('click', function(ev){
        const currentId = findStageId(card);
        if(['m1','m2','m3','m4','m5','b1','b2'].includes(currentId)){
          ev.preventDefault();
          ev.stopImmediatePropagation();
          ev.stopPropagation();
          start(currentId);
          return false;
        }
      }, true);
    });

    return patched;
  }

  function addFloatingButtons(){
    let panel = document.getElementById('roadmapClickFixPanel');
    if(panel) panel.remove();

    panel = document.createElement('div');
    panel.id = 'roadmapClickFixPanel';
    panel.style.position = 'fixed';
    panel.style.right = '18px';
    panel.style.bottom = '18px';
    panel.style.zIndex = '99999';
    panel.style.display = 'flex';
    panel.style.gap = '8px';
    panel.style.flexWrap = 'wrap';
    panel.style.maxWidth = '360px';
    panel.style.padding = '10px';
    panel.style.borderRadius = '18px';
    panel.style.background = 'rgba(15,23,42,.92)';
    panel.style.border = '1px solid rgba(34,211,238,.35)';
    panel.style.boxShadow = '0 16px 40px rgba(0,0,0,.35)';

    const ids = ['m1','m2','b1','m3','m4','m5','b2'];
    const labels = {m1:'S1',m2:'S2',b1:'B1',m3:'S3',m4:'S4',m5:'S5',b2:'เข้า B2'};
    ids.forEach(id => {
      const b = document.createElement('button');
      b.textContent = labels[id];
      b.className = 'btn small';
      b.style.padding = '9px 12px';
      b.style.borderRadius = '999px';
      b.style.border = '1px solid rgba(255,255,255,.16)';
      b.style.background = id === 'b2' ? 'linear-gradient(135deg,#22c55e,#14b8a6)' : 'rgba(255,255,255,.08)';
      b.style.color = '#fff';
      b.style.fontWeight = '900';
      b.disabled = !ready(id);
      b.style.opacity = b.disabled ? '.42' : '1';
      b.onclick = () => start(id);
      panel.appendChild(b);
    });

    document.body.appendChild(panel);
  }

  function boot(){
    patchCards();
    addFloatingButtons();
    // Roadmap อาจ render ใหม่หลัง script โหลด จึง patch ซ้ำหลายรอบ
    [300,800,1500,2500].forEach(ms => setTimeout(function(){
      patchCards();
      addFloatingButtons();
    }, ms));
  }

  window.AIQUEST_ROADMAP_CLICK_FIX = {
    version: VERSION,
    start,
    ready,
    patchCards,
    refresh: boot
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_ROADMAP_CLICK_FIX);
})();
