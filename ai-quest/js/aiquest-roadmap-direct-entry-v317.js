
(function(){
  'use strict';

  const VERSION = 'v3.1.7-roadmap-direct-entry';

  function toast(msg){
    try{
      if(typeof showToast === 'function') showToast(msg);
      else console.log('[AIQuest]', msg);
    }catch(e){ console.log('[AIQuest]', msg); }
  }

  function passedAny(id){
    try{
      return !!(state.completed[id] || state.stars[id] || state.mastered[id] || Number(state.bestScore[id] || 0) >= 60);
    }catch(e){
      return false;
    }
  }

  function directReady(id){
    if(id === 'm1' || id === 's1') return true;
    if(id === 'm2' || id === 's2') return passedAny('m1');
    if(id === 'b1') return passedAny('m1') && passedAny('m2');
    if(id === 'm3' || id === 's3') return passedAny('m1') && passedAny('m2') && passedAny('b1');
    if(id === 'm4' || id === 's4') return passedAny('m3');
    if(id === 'm5' || id === 's5') return passedAny('m4');
    if(id === 'b2') return passedAny('m3') && passedAny('m4') && passedAny('m5');
    return false;
  }

  function canonicalId(id){
    if(id === 's1') return 'm1';
    if(id === 's2') return 'm2';
    if(id === 's3') return 'm3';
    if(id === 's4') return 'm4';
    if(id === 's5') return 'm5';
    return id;
  }

  function startFromRoadmap(id){
    const realId = canonicalId(id);
    if(!directReady(realId)){
      toast('ด่านนี้ยังล็อก หรือยังไม่ผ่านเงื่อนไขก่อนหน้า');
      return false;
    }
    if(typeof startMission === 'function'){
      toast('เข้าสู่ ' + realId.toUpperCase());
      startMission(realId);
      return true;
    }
    return false;
  }

  function patchRoadmapCards(){
    const cards = Array.from(document.querySelectorAll('[data-stage-id], .stage-card, .roadmap-card, .mission-card'));
    cards.forEach(card => {
      if(card.__roadmapDirectV317) return;
      const id =
        card.getAttribute('data-stage-id') ||
        card.dataset.stage ||
        card.dataset.id ||
        '';

      if(!id) return;
      if(!['m1','m2','m3','m4','m5','s1','s2','s3','s4','s5','b1','b2'].includes(id)) return;

      card.__roadmapDirectV317 = true;
      card.style.cursor = 'pointer';
      card.addEventListener('dblclick', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        startFromRoadmap(id);
      }, true);
    });
  }

  function addDirectEntryPanel(){
    const old = document.getElementById('roadmapDirectEntryPanel');
    if(old) old.remove();

    const host = document.querySelector('#roadmapScreen .card') || document.querySelector('#roadmapScreen') || document.body;
    if(!host) return;

    const panel = document.createElement('div');
    panel.id = 'roadmapDirectEntryPanel';
    panel.className = 'card';
    panel.style.marginTop = '14px';
    panel.style.border = '1px solid rgba(34,211,238,.28)';
    panel.style.background = 'rgba(15,23,42,.62)';
    panel.innerHTML = `
      <h3 style="margin:0 0 8px">เข้าเล่นจากหน้ารวม Session</h3>
      <p class="muted" style="margin:0 0 10px">กดปุ่มเพื่อเข้าเล่น/replay โดยตรงตามเงื่อนไขที่เปิดแล้ว</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn small" data-direct-stage="m1">S1</button>
        <button class="btn small" data-direct-stage="m2">S2</button>
        <button class="btn small" data-direct-stage="b1">B1</button>
        <button class="btn small" data-direct-stage="m3">S3</button>
        <button class="btn small" data-direct-stage="m4">S4</button>
        <button class="btn small" data-direct-stage="m5">S5</button>
        <button class="btn small primary" data-direct-stage="b2">B2</button>
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px">Tip: ดับเบิลคลิกการ์ด Roadmap ก็เข้าเล่นได้</div>
    `;
    host.appendChild(panel);

    panel.querySelectorAll('[data-direct-stage]').forEach(btn => {
      const id = btn.getAttribute('data-direct-stage');
      const ready = directReady(id);
      btn.disabled = !ready;
      btn.style.opacity = ready ? '1' : '.45';
      btn.title = ready ? 'เข้าเล่นได้' : 'ยังไม่ผ่านเงื่อนไข';
      btn.onclick = () => startFromRoadmap(id);
    });
  }

  function boot(){
    patchRoadmapCards();
    addDirectEntryPanel();
    setTimeout(patchRoadmapCards, 700);
    setTimeout(addDirectEntryPanel, 900);
  }

  window.AIQUEST_ROADMAP_DIRECT_ENTRY = {
    version: VERSION,
    start: startFromRoadmap,
    ready: directReady,
    refresh: boot
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_ROADMAP_DIRECT_ENTRY);
})();
