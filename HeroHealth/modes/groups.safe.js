// === /HeroHealth/modes/groups.safe.js (release, A-Frame safe) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

/** รอจน A-Frame และ AFRAME.THREE พร้อมก่อนค่อยทำงาน */
function waitAframe() {
  if (globalThis.AFRAME?.THREE) {
    if (!globalThis.THREE) globalThis.THREE = globalThis.AFRAME.THREE;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const tryReady = () => {
      if (globalThis.AFRAME?.THREE) {
        if (!globalThis.THREE) globalThis.THREE = globalThis.AFRAME.THREE;
        clearInterval(iv);
        resolve();
      }
    };
    const iv = setInterval(tryReady, 40);
    document.addEventListener('DOMContentLoaded', () => {
      const sc = document.getElementById('scene');
      if (sc) sc.addEventListener('loaded', tryReady, { once: true });
    });
  });
}

export async function boot(cfg = {}) {
  // ✅ กัน THREE not defined
  await waitAframe();

  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  // 5 หมู่อาหาร
  const GROUPS = {
    veg     : ['🥦','🥕','🥬','🍅','🌽','🧄','🧅'],
    fruit   : ['🍎','🍓','🍇','🍊','🍍','🍌','🥝','🍐','🍉'],
    grain   : ['🍞','🥖','🥯','🍚','🍘','🍙'],
    protein : ['🐟','🍗','🥚','🫘','🥜'],
    dairy   : ['🥛','🧀','🍦']
  };
  const KEY_LIST = Object.keys(GROUPS);
  const ALL = KEY_LIST.flatMap(k => GROUPS[k]);

  // Power-ups
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  // กำหนดจังหวะสปอนตามระดับ + กัน “กระจุก”
  const tune = {
    easy   : { nextGap:[360,560], life:[1500,1800], minDist:0.34, maxConcurrent:2, targetBias:0.30 },
    normal : { nextGap:[300,480], life:[1200,1500], minDist:0.32, maxConcurrent:3, targetBias:0.30 },
    hard   : { nextGap:[240,420], life:[1000,1300], minDist:0.30, maxConcurrent:4, targetBias:0.28 }
  };
  const C = tune[diff] || tune.normal;

  const sp = makeSpawner({
    bounds:{ x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6 },
    minDist:C.minDist,
    decaySec:2.2
  });

  // เป้าหมาย: “เลือกให้ถูกหมู่” แบบไดนามิก 1→2→3 ถ้าไม่พลาด
  let goalSize = 1;           // ต้องเลือกให้ถูกหมู่กี่ชิ้นในรอบนี้
  let correctPicked = 0;      // ความคืบหน้า goal ปัจจุบัน
  let target = KEY_LIST[(Math.random()*KEY_LIST.length)|0];

  // สถานะเกม
  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let starCount=0, diamondCount=0;
  let remain=dur, timerId=0, loopId=0, watchdog=0;

  // Mini-quests: สุ่ม 3 ใบตามระดับ
  const QUESTS_POOL = (typeof drawThree==='function' ? drawThree('groups', diff) : []).slice(0,3);
  let qIdx = 0;
  function questText(){
    const cur = QUESTS_POOL[qIdx];
    return `Quest ${qIdx+1}/3 — ${cur?.label || `เลือกหมู่ ${target.toUpperCase()} ให้ครบ ${goalSize}`}`;
  }
  function updateQuestHUD(){
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}}));
  }

  // Helper
  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>Math.floor(rand(C.nextGap[0], C.nextGap[1]));
  const lifeMs =()=>Math.floor(rand(C.life[0], C.life[1]));
  const V3 = new THREE.Vector3();

  function setNewGoal() {
    target = KEY_LIST[(Math.random()*KEY_LIST.length)|0];
    correctPicked = 0;
    updateQuestHUD();
  }
  // โชว์ “กำลังสุ่ม…” ชั่วคราว
  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest 1/3 — กำลังสุ่ม…`}}));
  setTimeout(()=>{ setNewGoal(); }, 400);

  function emitScore(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}})); }
  function emitMiss(){ window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }

  function statsSnapshot(){
    return {
      score,
      goodCount: hits,     // นับชิ้นที่คลิกถูก (ในเกมนี้นับเป็น hits)
      comboMax:  maxCombo,
      star:      starCount,
      diamond:   diamondCount,
      junkMiss:  misses,
      noMissTime: 0,
      feverCount: 0
    };
  }
  function tryAdvanceQuest(){
    const cur = QUESTS_POOL[qIdx];
    if (!cur || typeof cur.check!=='function') return;
    if (cur.check(statsSnapshot())) {
      qIdx = Math.min(qIdx+1, QUESTS_POOL.length-1);
      if (qIdx < 3) updateQuestHUD();
    }
  }

  function end(reason='timeout'){
    if(!running) return;
    running=false;
    try{ clearInterval(timerId);}catch{}
    try{ clearTimeout(loopId);}catch{}
    try{ clearInterval(watchdog);}catch{}
    try{ Array.from(host.querySelectorAll('a-image')).forEach(n=>n.remove()); }catch{}

    // นับเคลียร์ตาม check จริงของทั้ง 3 ใบ
    const st = statsSnapshot();
    const questsCleared = QUESTS_POOL.reduce((n,q)=> n + (q?.check?.(st)?1:0), 0);

    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Food Groups',
      difficulty:diff,
      score,
      comboMax:maxCombo,
      misses, hits, spawns,
      duration:dur,
      questsCleared,
      questsTotal:3,
      reason
    }}));
  }

  function spawnOne(){
    if(!running) return;

    // จำกัดจำนวนเป้าพร้อมกัน (กัน “กระจุก”)
    if (host.querySelectorAll('a-image').length >= C.maxConcurrent) {
      loopId=setTimeout(spawnOne, 100);
      return;
    }

    // 30% ดึงจากหมู่เป้าหมายโดยตรง เพื่อให้ทำ goal ได้จริง
    let ch, inTarget=false, groupKey=null, type='food';
    const r = Math.random();

    if      (r < 0.05) { ch=STAR;   type='star'; }
    else if (r < 0.07) { ch=DIA;    type='diamond'; }
    else if (r < 0.10) { ch=SHIELD; type='shield'; }
    else {
      if (Math.random() < C.targetBias) {
        groupKey = target;
      } else {
        groupKey = KEY_LIST[(Math.random()*KEY_LIST.length)|0];
      }
      const pool = GROUPS[groupKey];
      ch = pool[(Math.random()*pool.length)|0];
      inTarget = (groupKey === target);
    }

    const pos = sp.sample();
    const el  = emojiImage(ch, 0.68, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      // พลาด = ถ้าเป็นชิ้น “ในหมู่เป้า” เท่านั้น
      if(type==='food' && inTarget){
        misses++; combo=0; score=Math.max(0, score-10);
        emitMiss(); emitScore();
      }
      try{ el.remove(); }catch{}; sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running) return;
      ev.preventDefault(); clearTimeout(ttl);
      const wp = el.object3D.getWorldPosition(V3);

      if(type==='food'){
        if(inTarget){
          const val = 25 + combo*2;
          score += val; combo++; maxCombo=Math.max(maxCombo,combo); hits++; correctPicked++;
          burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.05 });
          floatScore(scene, wp, '+'+val);

          // เป้าหมายถึงจำนวน → เพิ่มระดับเป้า (สูงสุด 3) แล้วสุ่มหมู่ใหม่
          if (correctPicked >= goalSize) {
            goalSize = Math.min(3, goalSize+1);
            setNewGoal();
          }
        } else {
          // คลิกผิดหมู่ → โทษเบา ๆ
          combo=0; score=Math.max(0, score-12); misses++;
          burstAt(scene, wp, { color:'#ef4444', count:12, speed:0.9 });
          floatScore(scene, wp, '-12');
          emitMiss();
        }
      } else if (type==='star') {
        starCount++; score += 40;
        burstAt(scene, wp, { color:'#fde047', count:20, speed:1.1 });
        floatScore(scene, wp, '+40 ⭐');
      } else if (type==='diamond') {
        diamondCount++; score += 80;
        burstAt(scene, wp, { color:'#a78bfa', count:24, speed:1.2 });
        floatScore(scene, wp, '+80 💎');
      } else if (type==='shield') {
        shield = Math.min(3, shield+1);
        burstAt(scene, wp, { color:'#60a5fa', count:18, speed:1.0 });
        floatScore(scene, wp, '🛡️+1');
      }

      emitScore();
      try{ el.remove(); }catch{}; sp.unmark(rec);
      tryAdvanceQuest();

      loopId=setTimeout(spawnOne, nextGap());
    }, {passive:false});

    loopId=setTimeout(spawnOne, nextGap());
  }

  // เวลา HUD
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timerId=setInterval(()=>{
    if(!running) return;
    remain = Math.max(0, remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if(remain<=0) end('timeout');
  },1000);

  // กันจอว่าง (ถ้าพลาดลบหมดแล้วไม่มีเป้าบนจอ ให้สปอนใหม่)
  watchdog = setInterval(()=>{ if (running && !host.querySelector('a-image')) spawnOne(); }, 1800);

  // go!
  window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}}));
  spawnOne();

  return {
    stop(){ end('quit'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; spawnOne(); } }
  };
}

export default { boot };