// Hydration — centered spawns + water gauge + quests
export async function boot(opts={}){
  const host = opts.host || document.querySelector('#spawnHost');
  const diff = String(opts.difficulty||'normal');
  const dur  = +opts.duration||60;

  const rate = {easy:[900,1300], normal:[700,1100], hard:[550,900]}[diff];
  const life = {easy:1800, normal:1600, hard:1400}[diff];
  let running=true,left=dur,score=0,combo=0,hits=0,misses=0,hydr=50,timer=0,spn=0;

  function questText(t){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:t}})); }
  function scoreEvt(d){ window.dispatchEvent(new CustomEvent('hha:score',{detail:d})); }
  function timeEvt(){ window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}})); }

  // HUD water bar (ใช้ fever bar เป็นหลักในหน้า index อยู่แล้ว; ตรงนี้ส่ง event เพิ่ม)
  function waterSet(p){
    // ใช้ event ชื่อเฉพาะ เผื่อคุณมีเกจน้ำใน HUD
    window.dispatchEvent(new CustomEvent('hha:hydration',{detail:{level:Math.max(0,Math.min(100,Math.round(p)))}}));
  }

  // auto-center host
  (function(){
    const sc=document.querySelector('#scene'), cam=document.querySelector('#cam');
    function center(){
      const y=(cam?.object3D?.position?.y ?? cam.getAttribute('position')?.y ?? 1.6)-.8;
      host.setAttribute('position',{x:0,y:Math.max(.6,y),z:-1.5});
    }
    sc.addEventListener('loaded',center); sc.addEventListener('enter-vr',center);
    window.addEventListener('resize',center); setTimeout(center,80);
  })();

  function localPos(){ return {x:+((Math.random()-0.5)*1.2).toFixed(3), y:+((Math.random()-0.5)*0.6).toFixed(3), z:-0.4}; }
  function pop(x,y,t){ const p=document.createElement('div'); p.className='pop'; p.textContent=t; p.style.left=x+'px'; p.style.top=y+'px';
    document.body.appendChild(p); setTimeout(()=>p.remove(),680); }
  function burst(x,y,c='#60a5fa'){ for(let i=0;i<14;i++){ const s=document.createElement('div'); s.className='sh'; s.style.left=x+'px'; s.style.top=y+'px'; s.style.background=c;
    const dx=(Math.random()-0.5)*160, dy=(Math.random()-0.5)*110; s.style.setProperty('--dx',dx+'px'); s.style.setProperty('--dy',dy+'px');
    document.body.appendChild(s); setTimeout(()=>s.remove(),620);} }

  // deck
  const deckAll=[
    {id:'drink5', label:'ดื่มน้ำ 5 แก้ว', ok: s=>s.ok>=5, prog:s=>s.ok, goal:5},
    {id:'drink8', label:'ดื่มน้ำ 8 แก้ว', ok: s=>s.ok>=8, prog:s=>s.ok, goal:8},
    {id:'stay70', label:'รักษาเกิน 70%', ok: ()=>hydr>=70, prog:()=>hydr, goal:70},
    {id:'score400',label:'คะแนน 400+', ok: ()=>score>=400, prog:()=>score, goal:400},
    {id:'combo8', label:'คอมโบ 8', ok: s=>s.comboMax>=8, prog:s=>s.comboMax, goal:8},
    {id:'avoid6', label:'เลี่ยงน้ำหวาน 6', ok: s=>s.avoid>=6, prog:s=>s.avoid, goal:6},
    {id:'drink10',label:'ดื่ม 10 แก้ว', ok: s=>s.ok>=10, prog:s=>s.ok, goal:10},
    {id:'stay80', label:'รักษาเกิน 80%', ok: ()=>hydr>=80, prog:()=>hydr, goal:80},
    {id:'score600',label:'คะแนน 600+', ok: ()=>score>=600, prog:()=>score, goal:600},
    {id:'combo12',label:'คอมโบ 12', ok: s=>s.comboMax>=12, prog:s=>s.comboMax, goal:12},
  ];
  const st={ok:0,avoid:0,comboMax:0}; let pool=[...deckAll];
  for(let i=pool.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[pool[i],pool[j]]=[pool[j],pool[i]]}
  const deck=pool.slice(0,3); let qi=0; questText(`Quest 1/3: ${deck[0].label} (${deck[0].prog(st)}/${deck[0].goal})`);

  function updateQuest(){
    const q=deck[qi]; if(!q) return;
    if(q.ok(st)){ qi++; if(qi>=deck.length) questText('Mini Quest — สำเร็จ!');
      else questText(`Quest ${qi+1}/3: ${deck[qi].label} (${deck[qi].prog(st)}/${deck[qi].goal})`);
    }else questText(`Quest ${qi+1}/3: ${q.label} (${q.prog(st)}/${q.goal})`);
  }

  function tick(){
    if(!running) return;
    left=Math.max(0,left-1); timeEvt();
    // ค่อย ๆ ลดระดับน้ำ
    hydr=Math.max(0, hydr - 0.35); waterSet(hydr);
    if(left<=0) end('timeout');
  }

  function spawn(){
    if(!running) return;
    // 70% น้ำเปล่า, 30% น้ำหวาน
    const good = Math.random()<0.7;
    const icon = good ? '🥛' : '🧋';

    const e=document.createElement('a-entity'); e.classList.add('clickable');
    e.setAttribute('geometry','primitive: plane; width:.42; height:.42');
    e.setAttribute('text',`value:${icon}; align:center; color:#fff; width:3`);
    const p=localPos(); e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('animation__pop','property: scale; from:.6 .6 .6; to:1 1 1; dur:120; easing:easeOutQuad');

    e.addEventListener('click', ()=>{
      const rect=document.body.getBoundingClientRect(); const cx=rect.width*.5, cy=rect.height*.5;
      if(good){
        hits++; st.ok++; combo++; st.comboMax=Math.max(st.comboMax,combo);
        score+=22; hydr=Math.min(100, hydr+9); burst(cx,cy,'#22c55e'); pop(cx,cy,'+22');
      }else{
        misses++; st.avoid++; combo=0; score-=12; hydr=Math.max(0, hydr-6); burst(cx,cy,'#ef4444'); pop(cx,cy,'-12');
      }
      waterSet(hydr); scoreEvt({score,combo}); e.remove(); updateQuest();
    });

    host.appendChild(e);

    setTimeout(()=>{
      if(!e.parentNode||!running) return;
      // หมดอายุ → ถือว่าหลีก
      if(!good){ st.avoid++; score+=8; scoreEvt({score,combo}); }
      else { combo=0; score-=5; scoreEvt({score,combo}); }
      e.remove(); updateQuest();
    }, life);

    const wait = Math.floor(rate[0] + Math.random()*(rate[1]-rate[0]));
    spn=setTimeout(spawn, wait);
  }

  function start(){ timer=setInterval(tick,1000); spawn(); }
  function end(reason){
    if(!running) return; running=false; clearInterval(timer); clearTimeout(spn);
    const detail={reason,score,comboMax:st.comboMax,misses,hits,
      questsCleared: qi>=deck.length?3:qi, questsTotal:3, duration:dur-left,
      mode:'Hydration', difficulty:diff};
    window.dispatchEvent(new CustomEvent('hha:end',{detail}));
  }

  start();
  return {stop:()=>end('quit'), pause:()=>{running=false;clearInterval(timer);clearTimeout(spn);},
          resume:()=>{if(!running){running=true;start();}}};
}
export default {boot};
