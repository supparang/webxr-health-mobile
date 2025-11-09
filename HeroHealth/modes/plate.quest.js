// Healthy Plate — centered spawns + quests
export async function boot(opts={}){
  const host = opts.host || document.querySelector('#spawnHost');
  const diff = String(opts.difficulty||'normal');
  const dur  = +opts.duration||60;

  const rate = {easy:[900,1300], normal:[700,1100], hard:[550,900]}[diff];
  const life = {easy:1800, normal:1600, hard:1400}[diff];

  let running=true,left=dur,score=0,combo=0,hits=0,misses=0,timer=0,spn=0;

  const plateOK = ['🥗','🐟','🍚','🥛','🍎','🥦','🍞'];
  const plateNG = ['🍩','🍟','🍔','🍕','🧁','🍫','🥤'];

  function questText(t){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:t}})); }
  function scoreEvt(d){ window.dispatchEvent(new CustomEvent('hha:score',{detail:d})); }
  function timeEvt(){ window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}})); }

  // center host
  (function(){
    const sc=document.querySelector('#scene'), cam=document.querySelector('#cam');
    function center(){ const y=(cam?.object3D?.position?.y ?? cam.getAttribute('position')?.y ?? 1.6)-.8;
      host.setAttribute('position',{x:0,y:Math.max(.6,y),z:-1.5});}
    sc.addEventListener('loaded',center); sc.addEventListener('enter-vr',center); window.addEventListener('resize',center); setTimeout(center,80);
  })();

  function localPos(){ return {x:+((Math.random()-0.5)*1.2).toFixed(3), y:+((Math.random()-0.5)*0.6).toFixed(3), z:-0.4}; }
  function pop(x,y,t){ const p=document.createElement('div'); p.className='pop'; p.textContent=t; p.style.left=x+'px'; p.style.top=y+'px';
    document.body.appendChild(p); setTimeout(()=>p.remove(),680); }
  function burst(x,y,c='#7dd3fc'){ for(let i=0;i<14;i++){ const s=document.createElement('div'); s.className='sh'; s.style.left=x+'px'; s.style.top=y+'px'; s.style.background=c;
    const dx=(Math.random()-0.5)*160, dy=(Math.random()-0.5)*110; s.style.setProperty('--dx',dx+'px'); s.style.setProperty('--dy',dy+'px');
    document.body.appendChild(s); setTimeout(()=>s.remove(),620);} }

  const st={ok:0,avoid:0,comboMax:0};
  const deckAll=[
    {id:'ok10', label:'วางอาหารดี 10 ชิ้น', ok:s=>s.ok>=10, prog:s=>s.ok, goal:10},
    {id:'avoid6', label:'หลีกอาหารขยะ 6', ok:s=>s.avoid>=6, prog:s=>s.avoid, goal:6},
    {id:'combo10', label:'คอมโบ 10', ok:s=>s.comboMax>=10, prog:s=>s.comboMax, goal:10},
    {id:'score500', label:'คะแนน 500+', ok:()=>score>=500, prog:()=>score, goal:500},
    {id:'ok15', label:'อาหารดี 15 ชิ้น', ok:s=>s.ok>=15, prog:s=>s.ok, goal:15},
    {id:'combo14', label:'คอมโบ 14', ok:s=>s.comboMax>=14, prog:s=>s.comboMax, goal:14},
    {id:'avoid10', label:'หลีกขยะ 10', ok:s=>s.avoid>=10, prog:s=>s.avoid, goal:10},
    {id:'score650', label:'คะแนน 650+', ok:()=>score>=650, prog:()=>score, goal:650},
    {id:'ok20', label:'อาหารดี 20 ชิ้น', ok:s=>s.ok>=20, prog:s=>s.ok, goal:20},
    {id:'combo16', label:'คอมโบ 16', ok:s=>s.comboMax>=16, prog:s=>s.comboMax, goal:16},
  ];
  const pool=[...deckAll]; for(let i=pool.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[pool[i],pool[j]]=[pool[j],pool[i]]}
  const deck=pool.slice(0,3); let qi=0; questText(`Quest 1/3: ${deck[0].label} (${deck[0].prog(st)}/${deck[0].goal})`);

  function updateQuest(){
    const q=deck[qi]; if(!q) return;
    if(q.ok(st)){ qi++; if(qi>=deck.length) questText('Mini Quest — สำเร็จ!');
      else questText(`Quest ${qi+1}/3: ${deck[qi].label} (${deck[qi].prog(st)}/${deck[qi].goal})`);
    }else questText(`Quest ${qi+1}/3: ${q.label} (${q.prog(st)}/${q.goal})`);
  }

  function tick(){
    if(!running) return; left=Math.max(0,left-1); timeEvt(); if(left<=0) end('timeout');
  }

  function spawn(){
    if(!running) return;
    const good = Math.random()<0.72;
    const icon = (good?plateOK:plateNG)[(Math.random()*(good?plateOK:plateNG).length)|0];

    const e=document.createElement('a-entity'); e.classList.add('clickable');
    e.setAttribute('geometry','primitive: plane; width:.42; height:.42');
    e.setAttribute('text',`value:${icon}; align:center; color:#fff; width:3`);
    const p=localPos(); e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('animation__pop','property: scale; from:.6 .6 .6; to:1 1 1; dur:120; easing:easeOutQuad');

    e.addEventListener('click', ()=>{
      const rect=document.body.getBoundingClientRect(); const cx=rect.width*.5, cy=rect.height*.5;
      if(good){ hits++; st.ok++; combo++; st.comboMax=Math.max(st.comboMax,combo); score+=20; burst(cx,cy,'#22c55e'); pop(cx,cy,'+20'); }
      else { misses++; st.avoid++; combo=0; score-=15; burst(cx,cy,'#ef4444'); pop(cx,cy,'-15'); }
      scoreEvt({score,combo}); e.remove(); updateQuest();
    });

    host.appendChild(e);

    setTimeout(()=>{
      if(!e.parentNode||!running) return;
      if(!good){ st.avoid++; score+=8; } else { misses++; combo=0; score-=5; }
      e.remove(); scoreEvt({score,combo}); updateQuest();
    }, life);

    const wait=Math.floor(rate[0]+Math.random()*(rate[1]-rate[0]));
    spn=setTimeout(spawn, wait);
  }

  function start(){ timer=setInterval(tick,1000); spawn(); }
  function end(reason){
    if(!running) return; running=false; clearInterval(timer); clearTimeout(spn);
    const detail={reason,score,comboMax:st.comboMax,misses,hits,
      questsCleared: qi>=deck.length?3:qi, questsTotal:3, duration:dur-left,
      mode:'Healthy Plate', difficulty:diff};
    window.dispatchEvent(new CustomEvent('hha:end',{detail}));
  }

  start();
  return {stop:()=>end('quit'), pause:()=>{running=false;clearInterval(timer);clearTimeout(spn);},
          resume:()=>{if(!running){running=true;start();}}};
}
export default {boot};
