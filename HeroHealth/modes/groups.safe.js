// === groups.safe.js — Food Groups (center viewport, quests, fever hooks) ===
export async function boot(cfg){
  cfg = cfg || {};
  const host = cfg.host || document.body;
  const DIFF = String(cfg.difficulty||'normal');
  const DURATION = +cfg.duration || 60;

  // DOM overlay layer (ล้างของเก่า)
  document.querySelectorAll('.hha-layer').forEach(n=>n.remove());
  const layer = document.createElement('div');
  layer.className='hha-layer';
  document.body.appendChild(layer);

  // state
  let running=true, score=0, combo=0, hits=0, misses=0, spawns=0, left=DURATION, fever=0, feverActive=false;

  // กลุ่มอาหาร
  const GROUPS = {
    grains:  ['🍞','🍚','🥐','🥖','🥨','🫓'],
    protein:['🐟','🍗','🥩','🥚','🫘','🧈'],
    veggie: ['🥦','🥕','🥬','🌽','🍅'],
    fruit:  ['🍎','🍓','🍌','🍇','🍍','🍊','🍐','🥝'],
    dairy:  ['🥛','🧀','🍦','🍨']
  };
  const ALL = Object.values(GROUPS).flat();

  // Quests (สุ่ม 3/10 แสดงทีละใบ)
  const QUEST_POOL = [
    {id:'q1', label:'เลือก “ผัก” ให้ครบ 6',        check:s=>s.veggie>=6, prog:s=>Math.min(6,s.veggie), target:6},
    {id:'q2', label:'เลือก “ผลไม้” 6',             check:s=>s.fruit>=6,  prog:s=>Math.min(6,s.fruit),  target:6},
    {id:'q3', label:'เลือก “โปรตีน” 5',            check:s=>s.protein>=5,prog:s=>Math.min(5,s.protein),target:5},
    {id:'q4', label:'เลือก “ธัญพืช/ข้าวแป้ง” 6',  check:s=>s.grains>=6, prog:s=>Math.min(6,s.grains), target:6},
    {id:'q5', label:'เลือก “นม/นมเปรี้ยว/ชีส” 4', check:s=>s.dairy>=4,  prog:s=>Math.min(4,s.dairy),  target:4},
    {id:'q6', label:'ทำคอมโบ 10',                 check:s=>s.comboMax>=10, prog:s=>Math.min(10,s.comboMax), target:10},
    {id:'q7', label:'ไม่พลาด 8 วิ',                check:s=>s.noMiss>=8, prog:s=>Math.min(8,s.noMiss), target:8},
    {id:'q8', label:'เข้า Fever 1 ครั้ง',          check:s=>s.fever>=1,  prog:s=>s.fever?1:0, target:1},
    {id:'q9', label:'คะแนนถึง 400',                check:s=>s.score>=400,prog:s=>Math.min(400,s.score), target:400},
    {id:'q10',label:'เก็บให้ถูก 15 ชิ้น',          check:s=>s.correct>=15,prog:s=>Math.min(15,s.correct), target:15},
  ];
  function sample3(pool){
    const s=[...pool]; const out=[];
    while(out.length<3 && s.length){ out.push(s.splice(Math.floor(Math.random()*s.length),1)[0]); }
    return out;
  }
  const quests = sample3(QUEST_POOL);
  let qIndex=0;

  const statsQuest = {grains:0,protein:0,veggie:0,fruit:0,dairy:0, comboMax:0, noMiss:0, fever:0, score:0, correct:0};
  function updateQuestProgress(tickNoMiss = true){
    if(tickNoMiss) statsQuest.noMiss = Math.min(9999, statsQuest.noMiss+1);
    const cur = quests[qIndex];
    if(cur && cur.check(statsQuest)){
      qIndex = Math.min(quests.length-1, qIndex+1);
      pushQuestText();
    }
  }
  function pushQuestText(){
    const cur = quests[qIndex];
    const text = cur ? `เควส: ${cur.label}` : 'เควสครบแล้ว!';
    dispatch('hha:quest',{text});
  }

  // HUD
  dispatch('hha:score',{score, combo});

  // time loop
  const tmr = setInterval(()=>{
    if(!running) return;
    left=Math.max(0,left-1);
    dispatch('hha:time',{sec:left});
    updateQuestProgress(true);
    if(left<=0) end('timeout');
  },1000);

  // spawn
  function vw(){return innerWidth;}
  function vh(){return innerHeight;}
  function rndPos(){
    return {
      x: Math.floor(vw()*0.3 + Math.random()*vw()*0.4),
      y: Math.floor(vh()*0.42 + Math.random()*vh()*0.16)
    };
  }
  function spawn(){
    if(!running) return;
    spawns++;
    const emoji = ALL[Math.floor(Math.random()*ALL.length)];
    const el = document.createElement('div');
    el.className='hha-tgt'; el.textContent=emoji;
    const {x,y}=rndPos(); el.style.left=x+'px'; el.style.top=y+'px';
    let life = 1900; if(DIFF==='normal') life=1700; if(DIFF==='hard') life=1400;
    let clicked=false;

    el.addEventListener('click', onHit);
    el.addEventListener('touchstart', onHit, {passive:false});
    function onHit(ev){
      if(clicked) return; clicked=true; ev.preventDefault?.();
      layer.removeChild(el);
      const group = groupOf(emoji);
      let good=false;
      if(group){
        good=true; hits++; combo++; statsQuest[group]++; statsQuest.correct++;
        score += 20 + combo*2; statsQuest.score=score; if(combo>statsQuest.comboMax) statsQuest.comboMax=combo;
        // fever fill & start
        fever = Math.min(100, fever + 10);
        dispatch('hha:fever',{state:'change', level:fever});
        if(!feverActive && fever>=100){ feverActive=true; statsQuest.fever++; dispatch('hha:fever',{state:'start', level:100}); setTimeout(()=>{feverActive=false; fever=0; dispatch('hha:fever',{state:'end'});}, 8000); }
      }else{
        misses++; combo=0;
        score = Math.max(0, score-10);
      }
      dispatch('hha:score',{score, combo});
      emitMissIfNeeded();
      setTimeout(spawn, nextGap());
      updateQuestProgress(false);
    }
    const to= setTimeout(()=>{
      if(!running||clicked) return;
      // หมดอายุ = พลาด
      layer.contains(el) && layer.removeChild(el);
      misses++; combo=0;
      dispatch('hha:score',{score, combo});
      emitMissIfNeeded();
      setTimeout(spawn, nextGap());
      // พลาด = noMiss รีเซ็ต
      statsQuest.noMiss=0;
    }, life);

    layer.appendChild(el);
  }
  function nextGap(){
    if(DIFF==='easy') return 650;
    if(DIFF==='hard') return 420;
    return 520;
  }
  function emitMissIfNeeded(){
    dispatch('hha:miss',{count:misses});
  }
  function groupOf(e){
    if(GROUPS.grains.includes(e)) return 'grains';
    if(GROUPS.protein.includes(e))return 'protein';
    if(GROUPS.veggie.includes(e)) return 'veggie';
    if(GROUPS.fruit.includes(e))  return 'fruit';
    if(GROUPS.dairy.includes(e))  return 'dairy';
    return null;
  }

  // boot
  pushQuestText();
  dispatch('hha:time',{sec:left});
  setTimeout(spawn, 250);
  const watchdog = setInterval(()=>{
    if(!running) return;
    if(layer.querySelectorAll('.hha-tgt').length===0) spawn();
  }, 1800);

  function end(reason='done'){
    if(!running) return;
    running=false;
    clearInterval(tmr); clearInterval(watchdog);
    // cleanup
    layer.querySelectorAll('.hha-tgt').forEach(n=>n.remove());
    // result
    dispatch('hha:end',{
      mode:'Food Groups', difficulty:DIFF,
      score, comboMax: statsQuest.comboMax, hits, misses, spawns, duration:DURATION,
      questsCleared: qIndex>=quests.length? quests.length : qIndex, questsTotal: quests.length
    });
    layer.remove();
  }

  return {
    stop(){ end('stop'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; spawn(); } }
  };
}

function dispatch(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }

export default { boot };
