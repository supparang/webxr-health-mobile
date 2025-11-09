// HeroHealth — Good vs Junk (DOM layer) — centered + quests + fever + shards + coach
export async function boot(config={}){
  const host  = document.body;               // DOM overlay layer
  const dur   = +config.duration||60;
  const diff  = String(config.difficulty||'normal');

  // tuning by difficulty
  const tune = {easy:{min:900,max:1300,life:1800,goodRate:.75},
                normal:{min:700,max:1100,life:1600,goodRate:.7},
                hard:{min:550,max:900, life:1400,goodRate:.65}}[diff];

  // DOM style once
  if(!document.getElementById('gj-style')){
    const st=document.createElement('style'); st.id='gj-style';
    st.textContent=`
    .gj-layer{position:fixed;inset:0;z-index:700;pointer-events:auto}
    .gj-tgt{position:absolute;transform:translate(-50%,-50%);
      font-size:64px;line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));
      transition:transform .12s ease,opacity .24s ease;opacity:1;user-select:none;cursor:pointer}
    .gj-tgt.hit{transform:translate(-50%,-50%) scale(.85);opacity:.15}
    .pop{position:fixed;pointer-events:none;font-weight:900;color:#fff;
      text-shadow:0 2px 10px #000c;animation:pop .7s ease-out forwards}
    @keyframes pop{from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(-28px)}}
    .sh{position:fixed;pointer-events:none;width:6px;height:6px;border-radius:2px;opacity:.95;
      mix-blend-mode:screen;animation:shA .6s ease-out forwards}
    @keyframes shA{to{transform:translate(var(--dx),var(--dy)) scale(0.6);opacity:0}}
    `;
    document.head.appendChild(st);
  }

  // state
  const layer=document.createElement('div'); layer.className='gj-layer'; host.appendChild(layer);
  let running=true, score=0, combo=0, hits=0, misses=0, left=dur, fever=0, feverOn=false;
  let timer=null, spawner=null;

  const POOL_GOOD='🍎🍐🍇🥕🥦🍊🍌🫐🍍🍋🍉🥝🥛🥗🐟'.split('');
  const POOL_JUNK='🍔🍟🍕🍩🍪🧁🥤🧋🥓🍫🌭'.split('');

  // quests (10 แบบ สุ่มทีละ 3)
  const QUESTS = [
    {id:'good10',  label:'เก็บของดี 10 ชิ้น',      ok:s=>s.good>=10,    prog:s=>s.good,  goal:10},
    {id:'avoid5',  label:'เลี่ยงขยะ 5 ครั้ง',       ok:s=>s.avoid>=5,    prog:s=>s.avoid, goal:5},
    {id:'combo10', label:'ทำคอมโบ 10',              ok:s=>s.comboMax>=10,prog:s=>s.comboMax,goal:10},
    {id:'score500',label:'ทำคะแนน 500+',            ok:s=>s.score>=500,  prog:s=>s.score, goal:500},
    {id:'star3',   label:'เก็บดาว ⭐ 3 ดวง',          ok:s=>s.star>=3,     prog:s=>s.star, goal:3},
    {id:'dia1',    label:'เก็บเพชร 💎 1 เม็ด',        ok:s=>s.dia>=1,      prog:s=>s.dia,  goal:1},
    {id:'good20',  label:'ของดี 20 ชิ้น',            ok:s=>s.good>=20,    prog:s=>s.good, goal:20},
    {id:'fever2',  label:'เข้า FEVER 2 ครั้ง',       ok:s=>s.fever>=2,    prog:s=>s.fever,goal:2},
    {id:'nostreak',label:'ไม่พลาด 10 วิ',            ok:s=>s.secNoMiss>=10, prog:s=>s.secNoMiss,goal:10},
    {id:'combo20', label:'คอมโบ 20',                 ok:s=>s.comboMax>=20, prog:s=>s.comboMax,goal:20},
  ];
  const stats = {good:0,avoid:0,comboMax:0,score:0,star:0,dia:0,fever:0,secNoMiss:0};

  // coach
  function say(msg){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:msg}})); }

  // fever
  function feverAdd(v){
    if(feverOn) return;
    fever = Math.min(100, fever + v);
    window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:'change',level:fever}}));
    if(fever>=100){ feverOn=true; stats.fever++; window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:'start',level:100}}));
      setTimeout(()=>{ feverOn=false; fever=0; window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:'end',level:0}})); }, 10000);
    }
  }

  // shards + popup
  function burst(x,y,color='#7dd3fc'){
    for(let i=0;i<16;i++){
      const s=document.createElement('div'); s.className='sh';
      s.style.left=x+'px'; s.style.top=y+'px';
      s.style.background=color;
      const dx=(Math.random()-0.5)*180, dy=(Math.random()-0.5)*120;
      s.style.setProperty('--dx', dx+'px'); s.style.setProperty('--dy', dy+'px');
      document.body.appendChild(s); setTimeout(()=>s.remove(),620);
    }
  }
  function popup(x,y,text){
    const p=document.createElement('div'); p.className='pop'; p.style.left=x+'px'; p.style.top=y+'px';
    p.textContent=text; document.body.appendChild(p); setTimeout(()=>p.remove(),680);
  }

  // centered position (DOM)
  function vw(){return Math.max(320,window.innerWidth||320)}
  function vh(){return Math.max(320,window.innerHeight||320)}
  function centeredXY(){
    const cx = vw()*0.5, cy = vh()*0.5;
    const rx = (Math.random()-0.5) * vw()*0.56;
    const ry = (Math.random()-0.5) * vh()*0.44;
    return {x:Math.round(cx+rx), y:Math.round(cy+ry)};
  }

  // quest deck (3 จาก 10 — sequential)
  let deck=[], qi=0;
  (function draw3(){
    const pool=[...QUESTS]; for(let i=pool.length-1;i>0;i--){const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]}
    deck = pool.slice(0,3); qi=0; say(`Quest 1/3: ${deck[0].label} (${deck[0].prog(stats)}/${deck[0].goal})`);
  })();

  function updateQuest(){
    const q=deck[qi]; if(!q) return;
    if(q.ok(stats)){ qi++; if(qi>=deck.length){ say(`Mini Quest — สำเร็จ!`); feverAdd(50); } else {
        say(`Quest ${qi+1}/3: ${deck[qi].label} (${deck[qi].prog(stats)}/${deck[qi].goal})`);
    }}
    else say(`Quest ${qi+1}/3: ${q.label} (${q.prog(stats)}/${q.goal})`);
  }

  // game loop
  function onTickTime(){
    if(!running) return;
    left = Math.max(0,left-1);
    stats.secNoMiss = Math.min(9999, stats.secNoMiss+1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}}));
    if(left<=0) end('timeout');
  }

  function spawn(){
    if(!running) return;
    const isGood = Math.random() < tune.goodRate;
    const ch = isGood ? POOL_GOOD[(Math.random()*POOL_GOOD.length)|0]
                      : POOL_JUNK[(Math.random()*POOL_JUNK.length)|0];

    const el=document.createElement('div'); el.className='gj-tgt'; el.textContent=ch;
    const {x,y}=centeredXY(); el.style.left=x+'px'; el.style.top=y+'px';
    let clicked=false;

    el.onclick=(ev)=>{
      if(clicked) return; clicked=true;
      const good = POOL_GOOD.includes(ch);
      if(good){
        hits++; stats.good++; combo++; stats.comboMax=Math.max(stats.comboMax,combo);
        const gain = feverOn? 40 : 20;
        score += gain; stats.score=score;
        feverAdd(6);
        burst(x,y,'#22c55e'); popup(x,y,`+${gain}`);
        window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
      }else{
        // click junk = โทษ (ควรหลบ)
        misses++; combo=0; stats.secNoMiss=0;
        score -= 15; stats.score=score;
        burst(x,y,'#ef4444'); popup(x,y,`-15`);
        window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}}));
        window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
      }
      el.classList.add('hit'); el.remove();
      updateQuest();
    };

    // ไม่คลิกจนหมดอายุ
    const ttl=setTimeout(()=>{
      if(clicked||!running) return;
      const good = POOL_GOOD.includes(ch);
      if(good){
        // พลาดของดี → โทษเล็กน้อย
        score -= 5; stats.score=score; combo=0; stats.secNoMiss=0; misses++;
        popup(x,y,'-5'); burst(x,y,'#f97316');
        window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}}));
        window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
      }else{
        // หลบขยะได้ → รางวัล
        stats.avoid++; score += 8; stats.score=score; feverAdd(4);
        popup(x,y,'+8'); burst(x,y,'#60a5fa');
        window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
      }
      el.remove(); updateQuest();
    }, tune.life);

    layer.appendChild(el);

    // next
    const wait = Math.floor(tune.min + Math.random()*(tune.max-tune.min));
    spawner=setTimeout(spawn, wait);
  }

  function start(){
    timer=setInterval(onTickTime,1000);
    spawn();
  }

  function end(reason){
    if(!running) return; running=false;
    try{ clearInterval(timer);}catch(_){}
    try{ clearTimeout(spawner);}catch(_){}
    layer.querySelectorAll('.gj-tgt').forEach(n=>n.remove());
    const detail={reason,score,comboMax:stats.comboMax,misses,hits,
      questsCleared: qi>=deck.length?3:qi, questsTotal:3, duration:dur-left,
      mode:'Good vs Junk', difficulty:diff};
    window.dispatchEvent(new CustomEvent('hha:end',{detail}));
    try{ host.removeChild(layer);}catch(_){}
  }

  say('โค้ช: โฟกัสกลางจอ—ดีคลิก, ขยะอย่าแตะ!'); start();

  return {
    stop:()=>end('quit'),
    pause:()=>{running=false; clearInterval(timer); clearTimeout(spawner);},
    resume:()=>{ if(!running){running=true; start();} }
  };
}
export default {boot};
