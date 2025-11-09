// === plate.quest.js — Healthy Plate (complete 5 groups per round) ===
export async function boot(cfg){
  cfg = cfg || {};
  const host = cfg.host || document.body;
  const DIFF = String(cfg.difficulty||'normal');
  const DURATION = +cfg.duration || 60;

  document.querySelectorAll('.hha-layer').forEach(n=>n.remove());
  const layer = document.createElement('div');
  layer.className='hha-layer';
  document.body.appendChild(layer);

  // state
  let running=true, score=0, combo=0, hits=0, misses=0, spawns=0, left=DURATION, fever=0, feverActive=false;

  // 5 หมู่
  const G = {
    grains:  ['🍞','🍚','🥐','🥖','🥨','🫓'],
    protein:['🐟','🍗','🥩','🥚','🫘'],
    veggie: ['🥦','🥕','🥬','🌽','🍅'],
    fruit:  ['🍎','🍓','🍌','🍇','🍍','🍊','🍐','🥝'],
    dairy:  ['🥛','🧀','🍦']
  };
  const ALL = Object.values(G).flat();
  const groupsOrder = ['grains','protein','veggie','fruit','dairy'];

  // รอบปัจจุบัน ต้องเก็บครบ 5 หมู่
  let need = new Set(groupsOrder);

  // Quests 3/10
  const QUEST_POOL = [
    {id:'p1', label:'จัดครบ 5 หมู่ ภายใน 15 วิ', check:s=>s.roundDoneFast>=1, prog:s=>s.roundDoneFast?1:0, target:1},
    {id:'p2', label:'ทำคอมโบ 12', check:s=>s.comboMax>=12, prog:s=>Math.min(12,s.comboMax), target:12},
    {id:'p3', label:'คะแนนถึง 500', check:s=>s.score>=500, prog:s=>Math.min(500,s.score), target:500},
    {id:'p4', label:'หลบผิดหมู่ 6 ครั้ง', check:s=>s.avoid>=6, prog:s=>Math.min(6,s.avoid), target:6},
    {id:'p5', label:'เข้า Fever 1 ครั้ง', check:s=>s.fever>=1, prog:s=>s.fever?1:0, target:1},
    {id:'p6', label:'เก็บผัก 6 ชิ้น', check:s=>s.veggie>=6, prog:s=>Math.min(6,s.veggie), target:6},
    {id:'p7', label:'เก็บผลไม้ 6 ชิ้น', check:s=>s.fruit>=6, prog:s=>Math.min(6,s.fruit), target:6},
    {id:'p8', label:'ไม่พลาด 10 วิ', check:s=>s.noMiss>=10, prog:s=>Math.min(10,s.noMiss), target:10},
    {id:'p9', label:'จบ 2 รอบ', check:s=>s.round>=2, prog:s=>Math.min(2,s.round), target:2},
    {id:'p10',label:'โปรตีน 5 ชิ้น', check:s=>s.protein>=5, prog:s=>Math.min(5,s.protein), target:5},
  ];
  function sample3(pool){ const s=[...pool]; const out=[]; while(out.length<3&&s.length){ out.push(s.splice(Math.floor(Math.random()*s.length),1)[0]); } return out; }
  const quests = sample3(QUEST_POOL); let qIndex=0;
  const stats={round:0, roundTimer:0, roundDoneFast:0, comboMax:0, score:0, fever:0, avoid:0, veggie:0, fruit:0, protein:0, noMiss:0};

  function pushQuest(){ const cur=quests[qIndex]; dispatch('hha:quest',{text: cur?`เควส: ${cur.label}`:'เควสครบแล้ว!'}); }
  pushQuest();

  // time
  const tmr=setInterval(()=>{
    if(!running) return;
    left=Math.max(0,left-1);
    stats.roundTimer++;
    stats.noMiss = Math.min(9999, stats.noMiss+1);
    dispatch('hha:time',{sec:left});
    const cur=quests[qIndex];
    if(cur && cur.check(stats)){ qIndex=Math.min(quests.length-1,qIndex+1); pushQuest(); }
    if(left<=0) end('timeout');
  },1000);

  // helpers
  function vw(){return innerWidth;} function vh(){return innerHeight;}
  function rndPos(){ return { x:Math.floor(vw()*0.3 + Math.random()*vw()*0.4), y:Math.floor(vh()*0.42 + Math.random()*vh()*0.16) }; }
  function groupOf(e){
    if(G.grains.includes(e)) return 'grains';
    if(G.protein.includes(e))return 'protein';
    if(G.veggie.includes(e)) return 'veggie';
    if(G.fruit.includes(e))  return 'fruit';
    if(G.dairy.includes(e))  return 'dairy';
    return null;
  }

  function spawn(){
    if(!running) return;
    spawns++;
    const e = ALL[Math.floor(Math.random()*ALL.length)];
    const el = document.createElement('div'); el.className='hha-tgt'; el.textContent=e;
    const {x,y}=rndPos(); el.style.left=x+'px'; el.style.top=y+'px';
    let life = 1900; if(DIFF==='normal') life=1700; if(DIFF==='hard') life=1400;
    let clicked=false;

    el.addEventListener('click',hit); el.addEventListener('touchstart',hit,{passive:false});
    function hit(ev){
      if(clicked) return; clicked=true; ev.preventDefault?.();
      layer.removeChild(el); hits++; combo++;
      const g=groupOf(e);
      if(g && need.has(g)){
        need.delete(g);
        // นับสถิติหมวด
        if(g==='veggie') stats.veggie++;
        if(g==='fruit')  stats.fruit++;
        if(g==='protein')stats.protein++;
        score += 30 + combo*2; stats.score=score; if(combo>stats.comboMax) stats.comboMax=combo;
        fever = Math.min(100, fever + 12); dispatch('hha:fever',{state:'change', level:fever});
        if(!feverActive && fever>=100){ feverActive=true; stats.fever++; dispatch('hha:fever',{state:'start', level:100}); setTimeout(()=>{feverActive=false; fever=0; dispatch('hha:fever',{state:'end'});}, 8000); }

        if(need.size===0){
          // จบหนึ่งรอบ
          stats.round++;
          if(stats.roundTimer<=15) stats.roundDoneFast++;
          // เริ่มรอบใหม่
          need = new Set(groupsOrder);
          stats.roundTimer=0;
          dispatch('hha:quest',{text:`รอบใหม่ #${stats.round+1} — จัด 5 หมู่ให้ครบ!`});
        }
      }else{
        // ผิดหมู่ (หรือซ้ำหมู่) → โทษและคอมโบหลุด
        score = Math.max(0, score-12); combo=0; stats.noMiss=0; stats.avoid++; misses++;
        dispatch('hha:miss',{count:misses});
      }
      dispatch('hha:score',{score, combo});
      setTimeout(spawn, nextGap());
      // อัปเดตเควสปัจจุบัน
      const cur=quests[qIndex]; if(cur && cur.check(stats)){ qIndex=Math.min(quests.length-1,qIndex+1); pushQuest(); }
    }

    setTimeout(()=>{
      if(!running||clicked) return;
      layer.contains(el) && layer.removeChild(el);
      // ปล่อยให้ผ่าน = พลาด/โอกาสเสียรอบช้าลง
      combo = 0; stats.noMiss=0; misses++; dispatch('hha:miss',{count:misses});
      setTimeout(spawn, nextGap());
    }, life);

    layer.appendChild(el);
  }
  function nextGap(){ if(DIFF==='easy') return 650; if(DIFF==='hard') return 420; return 520; }

  // boot
  dispatch('hha:score',{score, combo});
  dispatch('hha:time',{sec:left});
  setTimeout(spawn, 250);
  const watchdog=setInterval(()=>{ if(!running) return; if(layer.querySelectorAll('.hha-tgt').length===0) spawn(); }, 1800);

  function end(reason='done'){
    if(!running) return; running=false;
    clearInterval(tmr); clearInterval(watchdog);
    layer.querySelectorAll('.hha-tgt').forEach(n=>n.remove());
    dispatch('hha:end',{
      mode:'Healthy Plate', difficulty:DIFF,
      score, comboMax: stats.comboMax, hits, misses, spawns, duration:DURATION,
      questsCleared: qIndex>=quests.length? quests.length : qIndex, questsTotal: quests.length
    });
    layer.remove();
  }

  return { stop(){end('stop');}, pause(){running=false;}, resume(){ if(!running){ running=true; spawn(); } } };
}

function dispatch(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }
export default { boot };
