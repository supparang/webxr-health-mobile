/* EAP Hero v1z101 – Boss context integrity and reward clarity */
(() => {
  'use strict';
  const BOSS = {
    'Confusion Slime':{session:'Session 1',area:'Orientation Gate',icon:'🫧'},
    'Lazy Word Goblin':{session:'Session 2',area:'Word Lab',icon:'👺'},
    'Detail Trap Spider':{session:'Session 3',area:'Library Gate',icon:'🕷️'},
    'Noise Monster':{session:'Session 4',area:'Library Gate',icon:'📢'},
    'Fake News Phantom':{session:'Session 5',area:'Library Gate',icon:'👻'},
    'Copy-Paste Zombie':{session:'Session 6',area:'Writing Studio',icon:'🧟'},
    'Casual Talk Troll':{session:'Session 7',area:'Writing Studio',icon:'🧌'},
    'Structure Maze Warden':{session:'Session 8',area:'Writing Studio',icon:'🐍'},
    'Broken Paragraph Beast':{session:'Session 9',area:'Writing Studio',icon:'🐺'},
    'Graph Fog Dragon':{session:'Session 10',area:'Data Tower',icon:'🐉'},
    'Rude Mail Gremlin':{session:'Session 11',area:'Ethics Court',icon:'👹'},
    'Plagiarism Monster':{session:'Session 12',area:'Ethics Court',icon:'👾'},
    'Lecture Storm':{session:'Session 13',area:'Lecture Hall',icon:'🌪️'},
    'Nervous Ghost':{session:'Session 14',area:'Conference Arena',icon:'👻'},
    'Stagnation Emperor':{session:'Session 15',area:'Society Core',icon:'👑'}
  };
  function q(sel,root=document){return root.querySelector(sel);}
  function bossInfo(){
    const text=document.getElementById('app')?.innerText||'';
    return Object.entries(BOSS).find(([name])=>text.includes(name));
  }
  function fix(){
    const found=bossInfo(); if(!found) return;
    const [name,info]=found;
    const app=document.getElementById('app');
    const hud=q('.mf-hud',app);
    if(hud){
      const title=q('.mf-hud-main h3',hud); const sub=q('.mf-hud-main p',hud); const icon=q('.mf-mission-icon',hud); const kicker=q('.mf-kicker',hud); const stage=q('.mf-stage',hud);
      if(title) title.textContent=`${name} defeated`;
      if(sub) sub.textContent=`${info.session} · ${info.area}`;
      if(icon) icon.textContent=info.icon;
      if(kicker) kicker.textContent='⚔️ BOSS RESCUE COMPLETE';
      if(stage) stage.textContent='BOSS CLEARED';
      hud.dataset.bossContext='true';
    }
    const reward=q('.mf-reward-choice',app);
    if(reward && !reward.querySelector('.mf-boss-reward-note')){
      const p=q('p',reward);
      if(p) p.textContent='Choose one play-support reward for your next learning mission. It never changes your course score, pass status, or teacher record.';
      reward.insertAdjacentHTML('afterbegin',`<div class="mf-boss-reward-note">${info.icon} <b>${name}</b> cleared · ${info.session} secure</div>`);
    }
  }
  function boot(){
    const root=document.getElementById('app'); if(!root) return setTimeout(boot,100);
    const observer=new MutationObserver(()=>setTimeout(fix,20)); observer.observe(root,{childList:true,subtree:true}); fix();
  }
  boot();
})();
