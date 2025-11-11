// === /HeroHealth/modes/groups.safe.js (final, release-safe) ===
const THREE = window.THREE;
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore, setShardMode } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

export async function boot(cfg = {}) {
  // ตั้งพาเล็ตเอฟเฟกต์สำหรับโหมดนี้
  setShardMode('groups');

  // พื้นฐานฉาก
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  // หมวดอาหาร
  const GROUPS = {
    veg    : ['🥦','🥕','🥬','🍅','🌽','🧄','🧅'],
    fruit  : ['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'],
    grain  : ['🍞','🥖','🥯','🍚','🍘'],
    protein: ['🐟','🍗','🥚','🫘','🥜'],
    dairy  : ['🥛','🧀','🍦','🍨']
  };
  const ALL = Object.values(GROUPS).flat();

  // พาวเวอร์อัพ
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  // ปรับจูนตามระดับ + กันกระจุก
  const tune = {
    easy   : { nextGap:[420,680], life:[1500,1800], minDist:0.34, maxConcurrent:2 },
    normal : { nextGap:[320,560], life:[1200,1500], minDist:0.32, maxConcurrent:3 },
    hard   : { nextGap:[250,460], life:[1000,1300], minDist:0.30, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;

  const sp = makeSpawner({
    bounds:  { x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6 },
    minDist: C.minDist,
    decaySec: 2.2
  });

  // สถานะเกม
  let running = true;
  let score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let remain = dur;
  let timerId=0, loopId=0;

  // ===== Goal ระบบ “เลือกหมวดให้ถูก × N ชิ้น” =====
  const keys = Object.keys(GROUPS);
  let targetKey = keys[(Math.random()*keys.length)|0];
  // เริ่มเป้าตามระดับ + ขยายทีละขั้นเมื่อทำสำเร็จโดยไม่พลาด
  let goalSize = (diff==='easy'?1 : diff==='hard'?3 : 2);
  let goalCount = 0;
  function pickNewTarget() {
    targetKey = keys[(Math.random()*keys.length)|0];
    goalCount = 0;
    emitGoalHUD();
  }
  function emitGoalHUD(){
    window.dispatchEvent(new CustomEvent('hha:goal', {
      detail: {
        label: `เป้า: เลือกให้ถูกหมวด (${targetKey.toUpperCase()}) — ${goalCount}/${goalSize}`,
        value: goalCount,
        max: goalSize,
        mode: 'Food Groups'
      }
    }));
  }
  pickNewTarget();

  // ===== Mini Quests (สุ่ม 3 จากพูล, แสดงทีละใบ) =====
  const QUESTS = drawThree('groups', diff);   // [{id,label,check,...}] ยาว 3 ใบ
  let qIdx = 0;
  function emitQuestHUD(){
    const q = QUESTS[qIdx];
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: { label: q ? q.label : 'จบเควสต์', currentIndex: q ? qIdx : 3, total: 3 }
    }));
  }
  function tryAdvanceQuest(){
    const s = { score, goodCount:hits, junkMiss:misses, comboMax:maxCombo, feverCount:0, star:0, diamond:0, noMissTime:0 };
    const q = QUESTS[qIdx];
    if (q && typeof q.check==='function' && q.check(s)) {
      qIdx = Math.min(qIdx+1, 3);
      emitQuestHUD();
    }
  }
  emitQuestHUD();

  // เครื่องมือสุ่มเวลา/อายุ
  const rand = (a,b)=> a + Math.random()*(b-a);
  const nextGap = ()=> rand(C.nextGap[0], C.nextGap[1]);
  const lifeMs  = ()=> rand(C.life[0],    C.life[1]);

  function end(reason='timeout'){
    if(!running) return;
    running=false;
    try{ clearInterval(timerId); }catch{}
    try{ clearTimeout(loopId); }catch{}
    Array.from(host.querySelectorAll('a-image')).forEach(n=>{ try{ n.remove(); }catch{}; });
    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        mode: 'Food Groups',
        difficulty: diff,
        score,
        combo: maxCombo,
        misses,
        hits,
        spawns,
        duration: dur,
        questsCleared: Math.min(qIdx,3),
        questsTotal: 3,
        reason
      }
    }));
  }

  function emitScore(){ window.dispatchEvent(new CustomEvent('hha:score', { detail:{ score, combo } })); }

  function spawnOne(){
    if(!running) return;

    // จำกัดจำนวนพร้อมกัน เพื่อลด “กระจุก”
    if (host.querySelectorAll('a-image').length >= C.maxConcurrent) {
      loopId = setTimeout(spawnOne, 120);
      return;
    }

    // 30% การันตีเป้าหมาย, 70% สุ่มอะไรก็ได้
    let ch, inTarget=false, type='food';
    const r = Math.random();
    if      (r < 0.05) { ch=STAR;   type='star'; }
    else if (r < 0.07) { ch=DIA;    type='diamond'; }
    else if (r < 0.10) { ch=SHIELD; type='shield'; }
    else {
      if (Math.random() < 0.30) {
        const pool = GROUPS[targetKey]; ch = pool[(Math.random()*pool.length)|0]; inTarget = true;
      } else {
        ch = ALL[(Math.random()*ALL.length)|0];
        inTarget = GROUPS[targetKey].includes(ch);
      }
    }

    // วางตำแหน่งแบบไม่ทับ
    const pos = sp.sample();
    const el  = emojiImage(ch, 0.70, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{
      // หมดอายุ: ถ้าของที่ตรงหมวดหลุด → นับพลาด
      if (el.parentNode) {
        if (type==='food' && inTarget) {
          combo=0; score=Math.max(0, score-8); misses++;
          window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}}));
          emitScore();
        }
        try{ el.remove(); }catch{}
        sp.unmark(rec);
      }
    }, lifeMs());

    el.addEventListener('click', (ev)=>{
      if(!running) return;
      ev.preventDefault();
      clearTimeout(ttl);

      const wp = el.object3D.getWorldPosition(new THREE.Vector3());
      if (type==='food') {
        if (inTarget) {
          const val = 25 + combo*2;
          score += val; hits++; combo++; maxCombo = Math.max(maxCombo, combo);
          goalCount++;
          burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.05 });
          floatScore(scene, wp, '+'+val);

          // สำเร็จเป้าหมายใบนี้ → สุ่มหมวดใหม่ และ (อาจ) เพิ่มขนาดเป้า
          if (goalCount >= goalSize) {
            // เพิ่มความท้าทายแบบค่อย ๆ
            goalSize = Math.min(3, goalSize + 1);
            pickNewTarget();
          } else {
            emitGoalHUD();
          }
        } else {
          // ตีผิดหมวด → โทษเล็กน้อย
          combo = 0;
          score = Math.max(0, score - 12);
          burstAt(scene, wp, { color:'#ef4444', count:12, speed:0.9 });
          floatScore(scene, wp, '-12');
        }
      } else if (type==='star') {
        score += 40; burstAt(scene, wp, { color:'#fde047', count:20, speed:1.1 });
        floatScore(scene, wp, '+40 ⭐');
      } else if (type==='diamond') {
        score += 80; burstAt(scene, wp, { color:'#a78bfa', count:24, speed:1.2 });
        floatScore(scene, wp, '+80 💎');
      } else if (type==='shield') {
        shield = Math.min(3, shield+1);
        burstAt(scene, wp, { color:'#60a5fa', count:18, speed:1.0 });
        floatScore(scene, wp, '🛡️ +1');
      }

      try{ el.remove(); }catch{}
      sp.unmark(rec);
      tryAdvanceQuest();
      emitScore();

      loopId = setTimeout(spawnOne, nextGap());
    }, {passive:false});

    // นัดรอบถัดไป
    loopId = setTimeout(spawnOne, nextGap());
  }

  // นาฬิกา
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timerId = setInterval(()=>{
    if(!running) return;
    remain = Math.max(0, remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if (remain<=0) end('timeout');
  }, 1000);

  // เริ่มทำงาน
  spawnOne();

  // API ควบคุมจากภายนอก (index ใช้)
  return {
    stop(){ end('quit'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; spawnOne(); } }
  };
}

export default { boot };