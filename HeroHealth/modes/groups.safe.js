// === /HeroHealth/modes/groups.safe.js (release, stable) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore, setShardMode } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

// ป้องกันลำดับโหลด: ใช้ AFRAME.THREE ก่อน, ค่อย fallback ไป window.THREE
const THREE_SAFE = (typeof window !== 'undefined' && window.AFRAME && AFRAME.THREE)
  || (typeof window !== 'undefined' && window.THREE)
  || null;

export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  // ให้สี shards ตรงกับโหมด groups
  try { setShardMode('groups'); } catch {}

  // หมวดอาหาร
  const GROUPS = {
    veg:     ['🥦','🥕','🥬','🍅','🧄','🧅','🌽'],
    fruit:   ['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'],
    grain:   ['🍞','🥖','🥯','🥐','🍚','🍙','🍘'],
    protein: ['🐟','🍗','🍖','🥚','🫘','🥜'],
    dairy:   ['🥛','🧀','🍦','🍨','🍮']
  };
  const ALL = Object.values(GROUPS).flat();

  // Power-ups
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  // จูนตามความยาก
  const tune = {
    easy:   { nextGap:[360,560], life:[1500,1800], minDist:0.34, maxConcurrent:2, powerRate:{star:0.04, dia:0.06, shield:0.10} },
    normal: { nextGap:[300,480], life:[1200,1500], minDist:0.32, maxConcurrent:3, powerRate:{star:0.04, dia:0.06, shield:0.10} },
    hard:   { nextGap:[240,420], life:[1000,1300], minDist:0.30, maxConcurrent:4, powerRate:{star:0.05, dia:0.08, shield:0.12} }
  };
  const C = tune[diff] || tune.normal;

  const sp = makeSpawner({
    bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6},
    minDist:C.minDist,
    decaySec:2.2
  });

  // สถานะเกม
  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
  let remain=dur, timerId=0, loopId=0, questNoMissId=0;
  let shield=0; // 0..3

  // เป้าหมาย: เลือกหมวดให้ถูก × 1 → 2 → 3 (เพิ่มเฉพาะเมื่อสำเร็จโดยไม่พลาด)
  const groupKeys = Object.keys(GROUPS);
  let target = groupKeys[(Math.random()*groupKeys.length)|0];
  let goalSize = 1;
  let correctPicked = 0;

  // Mini quests (สุ่ม 3 จากคลังตามระดับ)
  const QUESTS = drawThree('groups', diff);
  let qIdx = 0;

  function questText(){
    const cur = QUESTS[qIdx];
    return (cur ? `Quest ${qIdx+1}/3 — ${cur.label}` : 'Quest 3/3 — เสร็จสิ้น!');
  }
  function updateQuestHUD(){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}})); }

  // โชว์ “กำลังสุ่ม…” ก่อน แล้วค่อยโชว์เควสต์จริง
  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:'Quest 1/3 — กำลังสุ่ม…'}}));
  setTimeout(updateQuestHUD, 400);

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>Math.floor(rand(C.nextGap[0], C.nextGap[1]));
  const lifeMs =()=>Math.floor(rand(C.life[0], C.life[1]));

  function setNewGoal(resetSize=false){
    if (resetSize) goalSize = 1;
    target = groupKeys[(Math.random()*groupKeys.length)|0];
    correctPicked = 0;
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`เป้า: เลือกให้ถูกหมู่ (${target.toUpperCase()}) × ${goalSize}`}}));
  }
  setNewGoal(true);

  function emitScore(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}})); }
  function emitMiss(){ window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }

  function statsSnapshot(){
    return {
      score, goodCount:hits, junkMiss:misses, comboMax:maxCombo,
      feverCount:0, star:0, diamond:0, noMissTime:0
    };
  }

  function tryAdvanceQuest(){
    const q=QUESTS[qIdx]; if(!q || typeof q.check!=='function') return;
    if(q.check(statsSnapshot())){
      if (qIdx<2){ qIdx++; updateQuestHUD(); }
      else { window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:'Mini Quest — สำเร็จครบ 3/3! 🎉'}})); }
    }
  }

  function end(reason='timeout'){
    if(!running) return;
    running=false;
    try{ clearInterval(timerId); }catch{}
    try{ clearTimeout(loopId); }catch{}
    try{ clearInterval(questNoMissId); }catch{}

    // เคลียร์เป้าที่ค้าง
    try{ host.querySelectorAll('a-image').forEach(n=>n.remove()); }catch{}

    // สรุปเควสต์ที่ผ่านจริง
    const finalStats = statsSnapshot();
    const questsCleared = QUESTS.reduce((n,q)=> n + (q && q.check ? (q.check(finalStats)?1:0) : 0), 0);

    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Food Groups', difficulty:diff, score, combo:maxCombo, misses, hits, spawns,
      duration:dur, questsCleared, questsTotal:3, reason
    }}));
  }

  function pickEmoji(){
    // อัตรา power-ups
    const r = Math.random();
    if (r < C.powerRate.star)   return { ch: STAR, type:'star' };
    if (r < C.powerRate.dia)    return { ch: DIA,  type:'diamond' };
    if (r < C.powerRate.shield) return { ch: SHIELD, type:'shield' };

    // เป้าหมาย: 30% ดึงจาก group เป้าหมายโดยตรง
    if (Math.random() < 0.30){
      const pool = GROUPS[target];
      const ch = pool[(Math.random()*pool.length)|0];
      return { ch, type:'food', inTarget:true };
    }
    // ที่เหลือสุ่มทั้งหมด
    const ch = ALL[(Math.random()*ALL.length)|0];
    return { ch, type:'food', inTarget: GROUPS[target].includes(ch) };
  }

  function spawnOne(){
    if(!running) return;
    // กัน “กระจุก”
    const now = host.querySelectorAll('a-image').length;
    if(now>=C.maxConcurrent){ loopId=setTimeout(spawnOne,100); return; }

    const pick = pickEmoji();
    const pos  = sp.sample();
    const el   = emojiImage(pick.ch, 0.68, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      // ถ้าหมดอายุแล้วเป็น "inTarget" ถือว่าพลาด
      if(pick.type==='food' && pick.inTarget){
        misses++; combo=0; score=Math.max(0, score-10);
        emitMiss(); emitScore();
      }
      try{ host.removeChild(el);}catch{} sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running) return;
      ev.preventDefault(); clearTimeout(ttl);

      // world position (fallback ถ้า THREE ยังไม่พร้อม)
      let wp = {x:pos.x, y:pos.y, z:pos.z};
      try{
        if (THREE_SAFE && el.object3D?.getWorldPosition) {
          const v = el.object3D.getWorldPosition(new THREE_SAFE.Vector3());
          wp = {x:v.x,y:v.y,z:v.z};
        } else {
          const p = el.object3D?.position || pos;
          wp = {x:p.x,y:p.y,z:p.z};
        }
      }catch{}

      if (pick.type==='food'){
        if (pick.inTarget){
          const val = 25 + combo*2;
          score += val; combo++; maxCombo=Math.max(maxCombo,combo); hits++; correctPicked++;
          burstAt(scene, wp, { color:'#22c55e',count:18, speed:1.05 });
          floatScore(scene, wp, '+'+val);

          if (correctPicked >= goalSize){
            // ทำครบชุด — เพิ่ม goalSize (สูงสุด 3) แล้วตั้งเป้าใหม่
            goalSize = Math.min(3, goalSize+1);
            setNewGoal(false);
          }
        } else {
          combo=0; score=Math.max(0, score-12); misses++;
          burstAt(scene, wp, { color:'#ef4444',count:12, speed:0.9 });
          floatScore(scene, wp, '-12');
          emitMiss();
          // ถ้าพลาด ให้รีเซ็ตเป้าเป็น ×1 ใหม่
          setNewGoal(true);
        }
      } else if (pick.type==='star'){
        score += 40;
        burstAt(scene, wp, { color:'#fde047',count:20, speed:1.1 });
        floatScore(scene, wp, '+40 ⭐');
      } else if (pick.type==='diamond'){
        score += 80;
        burstAt(scene, wp, { color:'#a78bfa',count:24, speed:1.2 });
        floatScore(scene, wp, '+80 💎');
      } else if (pick.type==='shield'){
        shield = Math.min(3, shield+1);
        burstAt(scene, wp, { color:'#60a5fa',count:18, speed:1.0 });
        floatScore(scene, wp, '🛡️+1');
      }

      emitScore();
      try{ host.removeChild(el);}catch{} sp.unmark(rec);
      tryAdvanceQuest();
    }, {passive:false});

    loopId=setTimeout(spawnOne, nextGap());
  }

  // เวลา
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timerId=setInterval(()=>{
    if(!running) return;
    remain = Math.max(0, remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if(remain<=0) end('timeout');
  }, 1000);

  // เริ่มสปอน
  window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
  spawnOne();

  return {
    stop(){ end('quit'); },
    pause(){ running=false