// === hydration.quest.js — tuned speed/score & quest-aware ===
export async function boot(cfg){
  cfg = cfg || {};
  const DIFF = String(cfg.difficulty||'normal');
  const DURATION = +cfg.duration || 60;

  document.querySelectorAll('.hha-layer').forEach(n=>n.remove());
  const layer = document.createElement('div'); layer.className='hha-layer'; document.body.appendChild(layer);

  // Difficulty tune
  const TUNE = {
    easy:   { nextGap: 580, life: 2200, scoreBase: 20, comboMul: 2, feverGain: 11, missPenalty: 6  },
    normal: { nextGap: 460, life: 1750, scoreBase: 24, comboMul: 2, feverGain: 12, missPenalty: 9  },
    hard:   { nextGap: 380, life: 1450, scoreBase: 26, comboMul: 3, feverGain: 13, missPenalty: 12 },
  }[DIFF];

  // state
  let running=true, score=0, combo=0, hits=0, misses=0, spawns=0, left=DURATION, fever=0, feverActive=false;
  let lastEmoji=null;
  let water=55;

  const GOOD = ['💧','🫗','🍵','🥛'];   // ให้เป็นฝั่งดี (บาลานซ์)
  const JUNK = ['🍺','🍷','🧋','🥤'];   // รบกวนบาลานซ์
  const ALL = [...GOOD,'💧','💧',...JUNK];

  // Quests 3/10
  const POOL = [
    {id:'h1', label:'อยู่ในโซนพอดี 15 วิ', check:s=>s.stable>=15, prog:s=>Math.min(15,s.stable), target:15},
    {id:'h2', label:'ดื่มถูกต้อง 8 ครั้งติด', check:s=>s.comboMax>=8, prog:s=>Math.min(8,s.comboMax), target:8},
    {id:'h3', label:'แก้จาก HIGH → GREEN ภายใน 3 วิ', check:s=>s.recoverHigh>=1, prog:s=>s.recoverHigh?1:0, target:1},
    {id:'h4', label:'คะแนนถึง 400', check:s=>s.score>=400, prog:s=>Math.min(400,s.score), target:400},
    {id:'h5', label:'เข้า Fever 1 ครั้ง', check:s=>s.fever>=1, prog:s=>s.fever?1:0, target:1},
    {id:'h6', label:'ดื่มถูกต้อง 12 ชิ้น', check:s=>s.good>=12, prog:s=>Math.min(12,s.good), target:12},
    {id:'h7', label:'หลบของไม่ดี 6 ชิ้น', check:s=>s.avoid>=6, prog:s=>Math.min(6,s.avoid), target:6},
    {id:'h8', label:'ไม่พลาด 10 วิ', check:s=>s.noMiss>=10, prog:s=>Math.min(10,s.noMiss), target:10},
    {id:'h9', label:'แก้จาก LOW → GREEN ภายใน 3 วิ', check:s=>s.recoverLow>=1, prog:s=>s.recoverLow?1:0, target:1},
    {id:'h10',label:'อยู่ GREEN 20 วิ', check:s=>s.stable>=20, prog:s=>Math.min(20,s.stable), target:20},
  ];
  function sample3(p){ const s=[...p]; const out=[]; while(out.length<3&&s.length){ out.push(s.splice(Math.floor(Math.random()*s.length),1)[0]); } return out; }
  const quests = sample3(POOL); let qIndex=0;
  const stats={stable:0, comboMax:0, recoverHigh:0, recoverLow:0, score:0, fever:0, good:0, avoid:0, noMiss:0};

  function pushQuest(){ const cur=quests[qIndex]; dispatch('hha:quest',{text:cur?`เควส: ${cur.label}`:'เควสครบแล้ว!'}); }
  pushQuest();

  // HUD & time
  dispatch('hha:score',{score, combo});
  dispatch('hha:time',{sec:left});
  const tmr=setInterval(()=>{
    if(!running) return;
    left=Math.max(0,left-1);
    dispatch('hha:time',{sec:left});
    if(water>=40&&water<=70) stats.stable=Math.min(9999,stats.stable+1);
    stats.noMiss=Math.min(9999,stats.noMiss+1);
    const cur=quests[qIndex]; if(cur && cur.check(stats)){ qIndex=Math.min(quests.length-1,qIndex+1); pushQuest(); }
    if(left<=0) end('timeout');
  },1000);

  // spawn helpers
  function vw(){return innerWidth;} function vh(){return innerHeight;}
  function rndPos(){ return { x:Math.floor(vw()*0.3 + Math.random()*vw()*0.4), y:Math.floor(vh()*0.42 + Math.random()*vh()*0.16) }; }
  function pickEmoji(){
    const bias = (water<40) ? GOOD : (water>70 ? [] : GOOD);
    const pool = [...ALL, ...bias]; // ถ้าน้ำต่ำ → bias GOOD มากขึ้น
    let e = pool[Math.floor(Math.random()*pool.length)];
    if(pool.length>1 && e===lastEmoji){ let tries=8; while(tries-- && e===lastEmoji){ e=pool[Math.floor(Math.random()*pool.length)]; } }
    lastEmoji=e; return e;
  }
  function nextGap(){ return TUNE.nextGap; }

  function spawn(){
    if(!running) return;
    spawns++;
    const emo = pickEmoji();
    const el = document.createElement('div'); el.className='hha-tgt'; el.textContent=emo;
    const {x,y}=rndPos(); el.style.left=x+'px'; el.style.top=y+'px';
    let clicked=false;
    const life = TUNE.life;

    const wasHigh = water>70; const wasLow = water<40;

    el.addEventListener('click', hit, {passive:false});
    el.addEventListener('touchstart', hit, {passive:false});
    function hit(ev){
      if(clicked) return; clicked=true; ev.preventDefault?.();
      layer.removeChild(el); hits++; combo++;
      const good = GOOD.includes(emo);
      if(good){
        stats.good++;
        // ปรับน้ำเข้าหาโซนกลาง
        water = clamp(water + (water<40? +10 : water>70? -10 : +6), 0, 100);
        score += TUNE.scoreBase + Math.min(combo*TUNE.comboMul, 28);
        stats.score=score; if(combo>stats.comboMax) stats.comboMax=combo;

        fever = Math.min(100, fever + TUNE.feverGain);
        dispatch('hha:fever',{state:'change', level:fever});
        if(!feverActive && fever>=100){
          feverActive=true; stats.fever++;
          dispatch('hha:fever',{state:'start', level:100});
          setTimeout(()=>{feverActive=false; fever=0; dispatch('hha:fever',{state:'end'});}, 8000);
        }

        if(wasHigh && water<=70 && water>=40) stats.recoverHigh++;
        if(wasLow  && water>=40 && water<=70) stats.recoverLow++;
      }else{
        // ของไม่ดี
        if(water<40){ score=Math.max(0, score - (TUNE.missPenalty+6)); combo=0; misses++; stats.noMiss=0; water=clamp(water-8,0,100); }
        else if(water>70){ score += 4; water=clamp(water+2,0,100); }
        else { score=Math.max(0, score - TUNE.missPenalty); combo=0; misses++; stats.noMiss=0; water=clamp(water-4,0,100); }
      }
      dispatch('hha:score',{score, combo});
      dispatch('hha:miss',{count:misses});
      setTimeout(spawn, nextGap());
    }

    setTimeout(()=>{
      if(!running||clicked) return;
      layer.contains(el) && layer.removeChild(el);
      // ปล่อยผ่าน = นับเป็น avoid (ไม่หักหนัก) เพื่อรองรับเควสหลบ
      stats.avoid++; combo=Math.max(0, combo-1);
      setTimeout(spawn, nextGap());
    }, life);

    layer.appendChild(el);
  }

  // boot
  setTimeout(spawn, 220);
  const watchdog=setInterval(()=>{ if(!running) return; if(layer.querySelectorAll('.hha-tgt').length===0) spawn(); }, 1600);

  function end(reason='done'){
    if(!running) return; running=false;
    clearInterval(tmr); clearInterval(watchdog);
    layer.querySelectorAll('.hha-tgt').forEach(n=>n.remove());
    dispatch('hha:end',{
      mode:'Hydration', difficulty:DIFF,
      score, comboMax: stats.comboMax, hits, misses, spawns, duration:DURATION,
      questsCleared: qIndex>=quests.length? quests.length : qIndex, questsTotal: quests.length
    });
    layer.remove();
  }

  return { stop(){end('stop');}, pause(){running=false;}, resume(){ if(!running){ running=true; spawn(); } } };
}

function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function dispatch(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }
export default { boot };
