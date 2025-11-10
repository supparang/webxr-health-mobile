// === /HeroHealth/modes/goodjunk.safe.js (release, A-Frame safe) ===
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

  // Pools (emoji)
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

  // Spawner (กัน “เป้ากระจุก”)
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
  let noMissSec=0;

  let remain = dur;
  let timeId=0, loopId=0, watchdogId=0, noMissId=0;

  // Mini-quests (สุ่ม 3 จากพูล)
  const QUESTS = drawThree?.('goodjunk', diff) || [
    { id:'good10', label:'เก็บของดี 10 ชิ้น', check:s=>s.goodCount>=10, target:10 },
    { id:'combo10',label:'ทำคอมโบ 10', check:s=>s.comboMax>=10, target:10 },
    { id:'score500',label:'ทำคะแนน 500+', check:s=>s.score>=500, target:500 },
  ];
  let qIdx = 0;
  function questText() {
    const cur = QUESTS[qIdx];
    return `Quest ${qIdx+1}/3 — ${cur ? cur.label : 'กำลังสุ่ม…'}`;
  }
  function updateQuestHUD() {
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}}));
  }
  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest 1/3 — กำลังสุ่ม…`}}));
  setTimeout(updateQuestHUD, 400);

  // Helpers
  const rand = (a,b)=> a + Math.random()*(b-a);
  const nextGap = ()=> Math.floor(rand(C.nextGap[0], C.nextGap[1]));
  const lifeMs  = ()=> Math.floor(rand(C.life[0], C.life[1]));
  const V3 = new THREE.Vector3();

  function emitScore() {
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}}));
  }
  function emitMiss() {
    window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}}));
  }
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
      qIdx = Math.min(qIdx+1, QUESTS.length-1);
      if (qIdx < 3) updateQuestHUD();
    }
  }

  function end(reason='timeout') {
    if (!running) return;
    running=false;

    try{ clearInterval(timeId); }catch{}
    try{ clearTimeout(loopId); }catch{}
    try{ clearInterval(watchdogId); }catch{}
    try{ clearInterval(noMissId); }catch{}

    // cleanup
    try{
      Array.from(host.querySelectorAll('a-image')).forEach(n=>n.remove());
    }catch{}

    const finalStats = statsSnapshot();
    const questsCleared = QUESTS.slice(0,3).reduce((n,q)=> n + (q?.check?.(finalStats)?1:0), 0);

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

    // จำกัดจำนวนพร้อมกัน → กัน “กระจุก”
    if (host.querySelectorAll('a-image').length >= C.maxConcurrent) {
      loopId = setTimeout(spawnOne, 100);
      return;
    }

    // ชนิดชิ้น
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
      // good หมดอายุ = โทษ, junk หมดอายุ = ไม่โทษ
      if (type==='good') {
        misses++;
        combo = 0;
        score = Math.max(0, score-10);
        noMissSec = 0;
        emitMiss(); emitScore();
      }
      try{ el.remove(); }catch{}
      sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click', (ev)=>{
      if (!running) return;
      ev.preventDefault();
      clearTimeout(ttl);

      try{
        const wp = el.object3D.getWorldPosition(V3);
        if (type==='good') {
          const val = 20 + combo*2;
          score += val; combo++; maxCombo = Math.max(maxCombo, combo); hits++;
          burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.0 });
          floatScore(scene, wp, '+'+val);
        } else if (type==='junk') {
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
      }catch{/* เผื่อ object3D ยังไม่พร้อม */}

      emitScore();
      try{ el.remove(); }catch{}
      sp.unmark(rec);
      tryAdvanceQuest();

      loopId = setTimeout(spawnOne, nextGap());
    }, {passive:false});

    loopId = setTimeout(spawnOne, nextGap());
  }

  // no-miss time
  noMissId = setInterval(()=>{ if (running) noMissSec = Math.min(9999, noMissSec+1); }, 1000);

  // เวลา HUD
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timeId = setInterval(()=>{
    if(!running) return;
    remain = Math.max(0, remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if (remain<=0) end('timeout');
  }, 1000);

  // กันจอว่าง
  watchdogId = setInterval(()=>{ if(running && !host.querySelector('a-image')) spawnOne(); }, 1800);

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