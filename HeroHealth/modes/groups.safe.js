// Food Groups — centered spawns + quests + shards
export async function boot(opts={}){
  const sceneHost = opts.host || document.querySelector('#spawnHost');
  const diff = String(opts.difficulty||'normal');
  const dur  = +opts.duration||60;

  const rate = {easy:[900,1300], normal:[700,1100], hard:[550,900]}[diff];
  const life = {easy:1800, normal:1600, hard:1400}[diff];

  const groups = {
    fruit: ['🍎','🍐','🍇','🍉','🍋','🍓','🍌','🍍','🫐'],
    veg  : ['🥕','🥦','🥬','🧄','🧅','🌽'],
    protein:['🥚','🐟','🍗','🥩','🫘','🥜'],
    grain:['🍞','🥖','🥨','🍚','🍙','🍘'],
    dairy:['🥛','🧀','🍦','🍨']
  };
  const bad = ['🍩','🍪','🍟','🍔','🍕','🧁','🍫','🥤','🧋'];

  // HUD helper
  function questText(t){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:t}})); }
  function scoreEvt(d){ window.dispatchEvent(new CustomEvent('hha:score',{detail:d})); }
  function missEvt(n){ window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:n}})); }

  // shards/popup
  function pop(x,y,t){ const p=document.createElement('div'); p.className='pop'; p.textContent=t;
    p.style.left=x+'px'; p.style.top=y+'px'; document.body.appendChild(p); setTimeout(()=>p.remove(),680); }
  function burst(x,y,c='#7dd3fc'){ for(let i=0;i<14;i++){ const s=document.createElement('div'); s.className='sh';
    s.style.left=x+'px'; s.style.top=y+'px'; s.style.background=c;
    const dx=(Math.random()-0.5)*160, dy=(Math.random()-0.5)*110;
    s.style.setProperty('--dx',dx+'px'); s.style.setProperty('--dy',dy+'px'); document.body.appendChild(s); setTimeout(()=>s.remove(),620);} }

  // auto-center host
  (function(){
    const sc=document.querySelector('#scene'), cam=document.querySelector('#cam'), host=sceneHost;
    function center(){
      const y=(cam?.object3D?.position?.y ?? cam.getAttribute('position')?.y ?? 1.6) - .8;
      host.setAttribute('position',{x:0,y:Math.max(.6,y),z:-1.5});
    }
    sc.addEventListener('loaded',center); sc.addEventListener('enter-vr',center);
    window.addEventListener('resize',center); setTimeout(center,80);
  })();

  // local spawn pos (รอบ ๆ ศูนย์กลาง)
  function localPos(){ return {x:+((Math.random()-0.5)*1.2).toFixed(3), y:+((Math.random()-0.5)*0.6).toFixed(3), z:-0.4}; }

  // state
  let running=true, left=dur, score=0, combo=0, hits=0, misses=0, timeTimer=0, nextTimer=0;
  const stats={ok:0,badAvoid:0,comboMax:0};

  // quest deck (3 จาก 10)
  const deckAll=[
    {id:'fruit6', label:'เลือก “ผลไม้” 6 ชิ้น',   ok:s=>s.ok>=6,  prog:s=>s.ok,  goal:6},
    {id:'ok10',   label:'เลือกถูก 10 ชิ้น',       ok:s=>s.ok>=10, prog:s=>s.ok,  goal:10},
    {id:'combo8', label:'ทำคอมโบ 8',              ok:s=>s.comboMax>=8, prog:s=>s.comboMax, goal:8},
    {id:'avoid6', label:'เลี่ยงของขยะ 6 ครั้ง',   ok:s=>s.badAvoid>=6, prog:s=>s.badAvoid, goal:6},
    {id:'score400',label:'ทำคะแนน 400+',          ok:()=>score>=400, prog:()=>score, goal:400},
    {id:'ok15',   label:'เลือกถูก 15 ชิ้น',       ok:s=>s.ok>=15, prog:s=>s.ok, goal:15},
    {id:'combo12',label:'คอมโบ 12',               ok:s=>s.comboMax>=12, prog:s=>s.comboMax, goal:12},
    {id:'fruit10',label:'ผลไม้ 10 ชิ้น',          ok:s=>s.ok>=10, prog:s=>s.ok, goal:10},
    {id:'avoid10',label:'เลี่ยงขยะ 10 ครั้ง',     ok:s=>s.badAvoid>=10, prog:s=>s.badAvoid, goal:10},
    {id:'score600',label:'คะแนนถึง 600',          ok:()=>score>=600, prog:()=>score, goal:600},
  ];
  const pool=[...deckAll]; for(let i=pool.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[pool[i],pool[j]]=[pool[j],pool[i]]}
  const deck=pool.slice(0,3); let qi=0; questText(`Quest 1/3: ${deck[0].label} (${deck[0].prog(stats)}/${deck[0].goal})`);

  function updateQuest(){
    const q=deck[qi]; if(!q) return;
    if(q.ok(stats)){ qi++; if(qi>=deck.length) questText('Mini Quest — สำเร็จ!');
      else questText(`Quest ${qi+1}/3: ${deck[qi].label} (${deck[qi].prog(stats)}/${deck[qi].goal})`);
    }else questText(`Quest ${qi+1}/3: ${q.label} (${q.prog(stats)}/${q.goal})`);
  }

  function tickTime(){
    if(!running) return;
    left=Math.max(0,left-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}}));
    if(left<=0) end('timeout');
  }

  function spawn(){
    if(!running) return;
    const goodPool = Object.values(groups).flat();
    const all = Math.random()<0.75 ? goodPool : bad;
    const ch = all[(Math.random()*all.length)|0];

    const e=document.createElement('a-entity'); e.classList.add('clickable');
    e.setAttribute('geometry','primitive: plane; width:.42; height:.42');
    e.setAttribute('text',`value:${ch}; align:center; color:#fff; width:3`); // ใช้ text ง่าย ๆ; ถ้ามีสไปรท์ปรับเองได้
    const p=localPos(); e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('animation__pop','property: scale; from:.6 .6 .6; to:1 1 1; dur:120; easing:easeOutQuad');

    // click
    e.addEventListener('click', ev=>{
      const world = e.object3D.getWorldPosition(new THREE.Vector3());
      const rect = document.body.getBoundingClientRect();
      const cx = rect.width*.5, cy=rect.height*.5; // คร่าว ๆ ให้พอวาง shards กลางจอ
      const isGood = goodPool.includes(ch);
      if(isGood){
        hits++; stats.ok++; combo++; stats.comboMax=Math.max(stats.comboMax,combo);
        score += 20; burst(cx,cy,'#22c55e'); pop(cx,cy,'+20'); scoreEvt({score,combo});
      }else{
        misses++; combo=0; score -= 15; burst(cx,cy,'#ef4444'); pop(cx,cy,'-15');
        scoreEvt({score,combo}); missEvt(misses);
      }
      e.remove(); updateQuest();
    });

    sceneHost.appendChild(e);

    // expire
    setTimeout(()=>{
      if(!e.parentNode||!running) return;
      const isBad = bad.includes(ch);
      if(isBad){ stats.badAvoid++; score += 8; scoreEvt({score,combo}); }
      else { misses++; combo=0; score -= 5; missEvt(misses); scoreEvt({score,combo}); }
      e.remove(); updateQuest();
    }, life);

    const wait = Math.floor(rate[0] + Math.random()*(rate[1]-rate[0]));
    nextTimer=setTimeout(spawn, wait);
  }

  function start(){ timeTimer=setInterval(tickTime,1000); spawn(); }
  function end(reason){
    if(!running) return; running=false;
    clearInterval(timeTimer); clearTimeout(nextTimer);
    const detail={reason,score,comboMax:stats.comboMax,misses,hits,
      questsCleared: qi>=deck.length?3:qi, questsTotal:3, duration:dur-left,
      mode:'Food Groups', difficulty:diff};
    window.dispatchEvent(new CustomEvent('hha:end',{detail}));
  }

  start();
  return {stop:()=>end('quit'), pause:()=>{running=false;clearInterval(timeTimer);clearTimeout(nextTimer);},
          resume:()=>{if(!running){running=true;start();}}};
}
export default {boot};
