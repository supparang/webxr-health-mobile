/* /fitness/js/hub.js — Mode toggle + routing (Hub) */
'use strict';

(function(){
  const $ = (id)=>document.getElementById(id);

  const btnNormal = $('mode-normal');
  const btnResearch = $('mode-research');
  const desc = $('mode-desc');

  const MODE_KEY = 'VRFIT_MODE';
  const getMode = ()=> (localStorage.getItem(MODE_KEY) || 'normal');
  const setMode = (m)=> localStorage.setItem(MODE_KEY, m);

  function applyMode(m){
    if(btnNormal) btnNormal.classList.toggle('active', m==='normal');
    if(btnResearch) btnResearch.classList.toggle('active', m==='research');

    if(desc){
      desc.textContent = (m==='research')
        ? 'Research: สำหรับเก็บข้อมูล (Session / Event CSV) — กรุณากรอก Participant/Group ในเกมที่รองรับ'
        : 'Normal: สำหรับเล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
    }
  }

  function go(game){
    const m = getMode();
    const map = {
      shadow: './shadow-breaker.html?mode='+m+'&from=hub',
      'shadow-vr': './shadow-breaker.html?mode='+m+'&view=vr&from=hub',
      rhythm: './rhythm.html?mode='+m+'&from=hub',
      jump: './jump-duck.html?mode='+m+'&from=hub',
      balance: './balance-hold.html?mode='+m+'&from=hub'
    };
    const url = map[game];
    if(url) location.href = url;
  }

  // bind
  if(btnNormal) btnNormal.addEventListener('click', ()=>{ setMode('normal'); applyMode('normal'); });
  if(btnResearch) btnResearch.addEventListener('click', ()=>{ setMode('research'); applyMode('research'); });

  document.addEventListener('click', (e)=>{
    const t = e.target.closest('[data-game]');
    if(!t) return;
    const key = t.getAttribute('data-game');
    if(t.classList.contains('btn-disabled')) return;
    go(key);
  });

  applyMode(getMode());
})();