// === /HeroHealth/modes/goodjunk.safe.js (release, stable) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore, setShardMode } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

// ปลอดภัยกับลำดับโหลด A-Frame/THREE
const THREE_SAFE = (typeof window !== 'undefined' && window.AFRAME && AFRAME.THREE)
  || (typeof window !== 'undefined' && window.THREE)
  || null;

export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  // เลือกพาเล็ตเอฟเฟกต์ตามโหมดนี้
  try { setShardMode('goodjunk'); } catch {}

  // Pools
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR = '⭐', DIA='💎', SHIELD='🛡️';

  // Tuning per difficulty
  const tune = {
    easy:   { nextGap:[360,560], life:[1400,1700], minDist:0.34, junkRate:0.28, maxConcurrent:2 },
    normal: { nextGap:[300,480], life:[1200,1500], minDist:0.32, junkRate:0.35, maxConcurrent:3 },
    hard:   { nextGap:[240,420], life:[1000,1300], minDist:0.30, junkRate:0.42, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;

  const sp = makeSpawner({
    bounds:{ x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6 },
    minDist:C.minDist,
    decaySec:2.2
  });

  // State
  let running=true;
  let score=0, combo=0, maxCombo=0;
  let misses=0, hits=0, spawns=0;
  let shield=0;                 // 0..3
  let starCount=0, diamondCount=0;
  let noMissSec=0;              // วินาทีที่ไม่พลาดต่อเนื่อง

  let remain = dur;
  let timeId=0, loopId=0, watchdogId=0, noMissId=0;

  // Mini-quests (สุ่ม 3 แบบจากคลัง)
  const QUESTS = drawThree('goodjunk', diff); // [{id,label,check,prog?,target?}] length=3
  let qIdx = 0;
  function questText() {
    const cur = QUESTS[qIdx];
    return (cur ? `Quest ${qIdx+1}/3 — ${cur.label}` : 'Quest 3/3 — เสร็จสิ้น!');
  }
  function updateQuestHUD() {
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}}));
  }
  // แสดง “กำลังสุ่ม…” ชั่วคราว แล้วโชว์เควสต์จริง
  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest 1/3 — กำลังสุ่ม…`}}));
  setTimeout(updateQuestHUD, 400);

  // Helpers
  const rand = (a,b)=> a + Math.random()*(b-a);
  const nextGap = ()=> Math.floor(rand(C.nextGap[0], C.nextGap[1]));
  const lifeMs  = ()=> Math.floor(rand(C.life[0], C.life[1]));
  const emitScore = ()=> window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}}));
  const emitMiss  = ()=> window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}}));

  function statsSnapshot() {
    return {
      score,
      goodCount: hits,
      comboMax:  maxCombo,
      star:      starCount,
      diamond:   diamondCount,
      junkMiss:  misses,
      noMissTime:noMissSec,
      feverCount: 0
    };
  }

  function tryAdvanceQuest() {
    const cur = QUESTS[qIdx];
    if (!cur || typeof cur.check!=='function') return;
    if (cur.check(statsSnapshot())) {
      if (qIdx < 2) { // ยังมีเควสต์ถัดไป
        qIdx++;
        updateQuestHUD();
      } else {
        // ผ่านครบ 3
        window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:'Mini Quest — สำเร็จครบ 3/3! 🎉'}}));
      }
    }
  }

  function end(reason='timeout') {
    if (!running) return;
    running=false;

    try{ clearInterval(timeId); }catch{}
    try{ clearTimeout(loopId); }catch{}
    try{ clearInterval(watchdogId); }catch{}
    try{ clearInterval(noMissId); }catch{}

    // ลบเป้าที่ยังค้าง
    try{
      Array.from(host.querySelectorAll('a-image')).forEach(n=>{
        try{ n.parentNode && n.parentNode.removeChild(n); }catch{}
      });
    }catch{}

    // คำนวณจำนวนเควสต์ที่ผ่านจริง
    const finalStats = statsSnapshot();
    const questsCleared = QUESTS.reduce((n,q)=> n + (q && q.check ? (q.check(finalStats)?1:0) : 0), 0);

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail:{
        mode:'Good vs Junk',
        difficulty: diff,
        score,
        comboMax: maxCombo,
        combo,
        misses,
        hits,
        spawns,
        duration: dur,
        questsCleared,
        questsTotal: 3,
        reason
      }
    }));
  }

  function spawnOne() {
    if (!running) return;

    // จำกัดจำนวนเป้าพร้อมกัน ป้องกัน “กระจุก”
    const nowCount = host.querySelectorAll('a-image').length;
    if (nowCount >= C.maxConcurrent) {
      loopId = setTimeout(spawnOne, 100);
      return;
    }

    // สุ่มชนิด
    let ch, type;
    const r = Math.random();
    if      (r < 0.04) { ch=STAR;   type='star'; }
    else if (r < 0.06) { ch=DIA;    type='diamond'; }
    else if (r < 0.10) { ch=SHIELD; type='shield'; }
    else {
      const goodPick = Math.random() > C.junkRate;
      ch   = goodPick ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
      type = goodPick ? 'good' : 'junk';
    }

    const pos = sp.sample();
    const el  = emojiImage(ch, 0.68, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el);
    spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{
      if (!el.parentNode) return;
      // หมดอายุ = พลาด (เฉพาะ good)
      if (type==='good') {
        misses++;
        combo = 0;
        score = Math.max(0, score-10);
        noMissSec = 0;
        emitMiss();
        emitScore();
        tryAdvanceQuest(); // บางเควสต์เช็ก noMissTime/นับ miss
      }
      try{ host.removeChild(el);}catch{}
      sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click', (ev)=>{
      if (!running) return;
      ev.preventDefault();
      clearTimeout(ttl);

      // หา world position แบบกันพลาดกรณี THREE ยังไม่พร้อม (จะ fallback เป็น local pos)
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

      if (type==='good') {
        const val = 20 + combo*2;
        score += val; combo++; maxCombo = Math.max(maxCombo, combo); hits++;
        burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.0 });
        floatScore(scene, wp, '+'+val);
      } else if (type==='junk') {
        // คลิก junk → โทษ เว้นแต่มี shield
        if (shield>0) {
          shield--;
          floatScore(scene, wp, 'Shield!');
          burstAt(scene, wp, { color:'#60a5fa', count:14, speed:0.9 });
        } else {
          combo=0; score=Math.max(0, score-15); misses++; noMissSec=0;
          burstAt(scene, wp, { color:'#ef4444', count:12, speed:0.9 });
          floatScore(scene, wp, '-15');
          emitMiss();
        }
      } else if (type==='star') {
        starCount++;
        score += 40;
        burstAt(scene, wp, { color:'#fde047', count:20, speed:1.1 });
        floatScore(scene, wp, '+40 ⭐');
      } else if (type==='diamond') {
        diamondCount++;
        score += 80;
        burstAt(scene, wp, { color:'#a78bfa', count:24, speed:1.2 });
        floatScore(scene, wp, '+80 💎');
      } else if (type==='shield') {
        shield = Math.min(3, shield+1);
        burstAt(scene, wp, { color:'#60a5fa', count:18, speed:1.0 });
        floatScore(scene, wp, '🛡️+1');
      }

      emitScore();
      try{ host.removeChild(el);}catch{}
      sp.unmark(rec);
      tryAdvanceQuest();

      loopId = setTimeout(spawnOne, nextGap());
    }, {passive:false});

    // สปอนรอบถัดไป
    loopId = setTimeout(spawnOne, nextGap());
  }

  // นับ noMissSec เพิ่มทุกวินาทีถ้าไม่มี miss เกิดขึ้น
  noMissId = setInterval(()=>{ if (running) noMissSec = Math.min(9999, noMissSec+1); }, 1000);

  // time HUD
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timeId = setInterval(()=>{
    if(!running) return;
    remain = Math.max(0, remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if (remain<=0) end('timeout');
  }, 1000);

  // watchdog กันจอว่าง
  watchdogId = setInterval(()=>{ if(running && !host.querySelector('a-image')) spawnOne(); }, 1800);

  // start
  window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}}));
  spawnOne();

  return {
    stop(){ end('quit'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; spawnOne(); } }
  };
}

export default { boot };