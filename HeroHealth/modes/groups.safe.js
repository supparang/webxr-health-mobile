// === modes/groups.safe.js (2025-11-06)
// โหมดเลือกอาหารตาม "หมวด" โดยแต่ละรอบจะสุ่มจำนวนเป้า 1 / 2 / 3 ชิ้น
// - แสดง Goal ชัดเจน: "เลือก X ชิ้น — หมวด Y"
// - เก็บคะแนน/คอมโบ + บทลงโทษถ้าเลือกผิด
// - Mini-Quest สุ่ม 3 จาก 10 ใบ (แสดงทีละใบ) และอัปเดต HUD ผ่าน hha:quest
// - กันเป้ากระจุก (anti-clump) + สุ่มความเร็ว/ชีวิตของเป้า
// - แตกกระจาย: ถ้ามี window.SHARDS.burst() จะเรียกแตก (ไม่มีก็ข้ามได้)
// - ใช้อีโมจิ (a-image) ผ่าน ../vr/emoji-sprite.js

import { emojiImage } from '../vr/emoji-sprite.js';

// --------- กลุ่มอาหาร ---------
const GROUPS = [
  { id:'veg',   label:'ผัก',     pool:['🥦','🥕','🥬','🌽','🍅','🧄','🧅'] },
  { id:'fruit', label:'ผลไม้',   pool:['🍎','🍓','🍌','🍍','🍇','🍊','🍐','🍉','🥝','🫐'] },
  { id:'grain', label:'ข้าวแป้ง', pool:['🍞','🥖','🥐','🥯','🍙','🍚','🍜','🍝','🥞'] },
  { id:'protein',label:'โปรตีน', pool:['🍳','🥩','🍗','🍖','🐟','🍤','🥜','🧀','🥚'] },
  { id:'dairy', label:'นม/โยเกิร์ต', pool:['🥛','🧈','🧀','🍦','🍨','🍧','🍮'] },
];
// ตัวลวง (ขยะ/ของคนละหมวด) — ปนไป
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🍫','🧋','🥤','🌭'];

// --------- ยูทิล ---------
function rnd(a,b){ return a + Math.random()*(b-a); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(e){} }

// กันซ้อนชื่อใน global
function safeBurst(worldPos, color){
  try{
    if(window.SHARDS && typeof window.SHARDS.burst==='function'){
      window.SHARDS.burst(worldPos, { color: color || '#93c5fd', count: 12+((Math.random()*6)|0), speed: rnd(1.6,2.2) });
    }
  }catch(e){}
}

// แสดง popup คะแนนด้วย troika-text (ถ้าโหลดไว้)
function popupScore(host, txt, pos){
  try{
    const t = document.createElement('a-entity');
    t.setAttribute('troika-text', 'value: '+txt+'; color: #fff; fontSize: 0.08;');
    t.setAttribute('position', `${pos.x} ${pos.y+0.12} ${pos.z}`);
    t.setAttribute('animation__rise', 'property: position; to: '+pos.x+' '+(pos.y+0.42)+' '+pos.z+'; dur: 520; easing: ease-out');
    t.setAttribute('animation__fade', 'property: opacity; to: 0; dur: 520; easing: linear');
    host.appendChild(t);
    setTimeout(()=>{ try{ host.removeChild(t); }catch(_e){} }, 560);
  }catch(e){}
}

// กระจายตำแหน่งแบบ anti-clump ในกรอบสี่เหลี่ยมด้านหน้ากล้อง
function planPositions(n){
  const out = [];
  const tries = Math.max(10, n*10);
  const minDist = 0.30; // เมตร ระยะกันชน
  for(let i=0;i<tries && out.length<n;i++){
    const x = rnd(-0.7, 0.7);
    const y = rnd(-0.2, 0.35); // ให้อยู่ค่อนกลางจอ
    const ok = out.every(p => {
      const dx = p.x - x, dy = p.y - y;
      return Math.sqrt(dx*dx + dy*dy) >= minDist;
    });
    if(ok) out.push({x,y,z:-1.6});
  }
  // ถ้ายังไม่ครบ ให้ยอมวางแบบใกล้ขึ้นเล็กน้อย
  while(out.length<n) out.push({x:rnd(-0.7,0.7), y:rnd(-0.2,0.35), z:-1.6});
  return out;
}

// --------- Mini-Quests (สุ่ม 3 จาก 10 — แสดงทีละใบ) ---------
function makeQuestDeck(){
  const pool = [
    {id:'perfectRound', label:'รอบนี้ห้ามผิดเลย!', check:s=>s.roundPerfect>=1, prog:s=>s.roundPerfect>0?1:0, target:1},
    {id:'fast5',        label:'จบรอบใน 5 วิ',       check:s=>s.roundFast<=5 && s.roundFast>0, prog:s=>s.roundFast>0?1:0, target:1},
    {id:'streak3',      label:'ชนะติด 3 รอบ',       check:s=>s.winStreak>=3, prog:s=>Math.min(3,s.winStreak), target:3},
    {id:'combo15',      label:'คอมโบถึง 15',        check:s=>s.comboMax>=15,  prog:s=>Math.min(15,s.comboMax), target:15},
    {id:'score600',     label:'คะแนนรวม 600+',      check:s=>s.score>=600,    prog:s=>Math.min(600,s.score),   target:600},
    {id:'avoid3',       label:'เลือกผิดไม่เกิน 0 ใน 3 รอบ', check:s=>s.recentWrongMax===0 && s.roundCount>=3, prog:s=>(s.roundCount>=3 && s.recentWrongMax===0)?1:0, target:1},
    {id:'goodChain20',  label:'เก็บถูก 20 ชิ้นรวม', check:s=>s.goodTotal>=20, prog:s=>Math.min(20,s.goodTotal), target:20},
    {id:'noMiss10s',    label:'10 วิไม่พลาดเลย',    check:s=>s.noMissSec>=10,  prog:s=>Math.min(10,s.noMissSec), target:10},
    {id:'threeKinds',   label:'ผ่านครบ 3 หมวด',     check:s=>s.catCleared.size>=3, prog:s=>Math.min(3,s.catCleared.size), target:3},
    {id:'diamond1',     label:'(พิเศษ) เก็บ💎 1',     check:s=>s.diamond>=1,    prog:s=>Math.min(1,s.diamond), target:1},
  ];
  // สุ่ม 3 ใบ ไม่ซ้ำ
  const pick3 = [];
  const chosen = new Set();
  while(pick3.length<3 && chosen.size<pool.length){
    const q = pick(pool);
    if(!chosen.has(q.id)){ chosen.add(q.id); pick3.push(q); }
  }
  return pick3;
}

// --------- ตัวเกมหลัก ---------
export async function boot(cfg){
  cfg = cfg || {};
  const host = (cfg.host) || document.getElementById('spawnHost') || document.querySelector('a-scene');
  const difficulty = String(cfg.difficulty||'normal');
  const duration = Number(cfg.duration||60); // index จะปรับตาม easy=90/normal=60/hard=45 ให้เอง
  const sceneEl = document.querySelector('a-scene');

  // state HUD
  let running = true;
  let score=0, combo=0, maxCombo=0, hits=0, wrong=0, spawns=0;
  let remain = Math.max(1, Math.round(duration));
  let timerSec = null;

  // per-round
  let targetCount = 1;             // 1 / 2 / 3
  let targetLeft  = 1;
  let roundStartAt = 0;
  let roundPerfect = true;
  let winStreak = 0;
  let roundCount = 0;
  let recentWrong = [];            // เก็บ wrong ของ 3 รอบล่าสุด
  let recentWrongMax = 0;
  let catCleared = new Set();

  // quest stats
  let goodTotal = 0;
  let noMissSec = 0;               // เพิ่มทุกวินาที หากรอบนั้นไม่กดผิด
  let diamond = 0;

  // สุ่มด่านแรก
  let currentCat = pick(GROUPS);
  targetCount = 1;
  targetLeft  = targetCount;
  roundStartAt = performance.now();

  // deck
  const deck = makeQuestDeck();
  let questIndex = 0;

  // แจ้ง HUD เริ่มเกม
  emit('hha:score', {score:0, combo:0});
  emit('hha:quest', {text: questText()});
  emit('hha:time', {sec:remain});

  // สปอนชุดแรก
  spawnWave();

  // นับเวลาเกม
  clearInterval(timerSec);
  timerSec = setInterval(function(){
    if(!running) return;
    remain -= 1; if(remain<0) remain = 0;
    emit('hha:time', {sec:remain});

    // noMissSec: ถ้ารอบนี้ยังไม่ผิดเลย ค่อย ๆ เพิ่ม
    if(roundPerfect) noMissSec = Math.min(9999, noMissSec+1);

    // เควสอาจสำเร็จจากตัวจับเวลาบางใบ
    checkQuests();

    if(remain<=0){ end('timeout'); }
  }, 1000);

  // --------- ฟังก์ชันในเกม ---------
  function nextTargetCount(){
    // ทุกระดับจะวนได้ 1 → 2 → 3 และถ้ารอบก่อนสมบูรณ์ (ไม่ผิด) ให้เพิ่มขั้น มิฉะนั้นลด
    if(roundPerfect){
      targetCount = Math.min(3, targetCount + 1);
    }else{
      targetCount = Math.max(1, targetCount - 1);
    }
    // สุ่มบ้าง 20% ให้เปลี่ยนทิศ (ไม่ให้ predictable เกินไป)
    if(Math.random()<0.20){
      targetCount = [1,2,3][(Math.random()*3)|0];
    }
  }

  function questText(){
    const q = deck[questIndex];
    const head = `Goal: เลือก ${targetLeft}/${targetCount} — หมวด ${currentCat.label}`;
    if(!q) return head;
    // ความคืบหน้าเควส (หยาบ)
    const prog = q.prog ? q.prog({ roundPerfect, roundFast:0, winStreak, comboMax:maxCombo, score, goodTotal, noMissSec, catCleared, diamond, roundCount, recentWrongMax }) : 0;
    return `${head} | Quest ${questIndex+1}/3: ${q.label}${q.target?` (${prog}/${q.target})`:''}`;
  }

  function checkQuests(){
    const q = deck[questIndex];
    if(!q) return;
    const snap = {
      roundPerfect,
      roundFast: Math.round((performance.now()-roundStartAt)/1000),
      winStreak, comboMax:maxCombo, score, goodTotal, noMissSec, catCleared, diamond, roundCount, recentWrongMax
    };
    if(q.check(snap)){
      // ผ่านใบนี้ → ไปใบถัดไป
      questIndex = Math.min(deck.length-1, questIndex+1);
      emit('hha:quest', {text: deck[questIndex] ? (`✓ เควสผ่าน: ${q.label} → ต่อไป: ${deck[questIndex].label}`) : `✓ เควสครบ 3 ใบแล้ว! เยี่ยมมาก`});
    }else{
      emit('hha:quest', {text: questText()});
    }
  }

  function spawnWave(){
    if(!running) return;
    // จำนวนเป้าต่อ wave: ให้เยอะพอให้เลือกถูกได้ แต่ไม่ล้นจอ
    const need = targetCount;
    const total = clamp(need + 3 + ((Math.random()*2)|0), 6, 8);
    const positions = planPositions(total);

    // สร้างรายการอีโมจิ (correct X ชิ้นที่ไม่ซ้ำ เท่าที่หาได้)
    const correct = [];
    const poolC = currentCat.pool.slice();
    while(correct.length<need && poolC.length){
      const i = (Math.random()*poolC.length)|0;
      correct.push(poolC.splice(i,1)[0]);
    }

    // ที่เหลือใส่ distractors
    const mix = [];
    mix.push(...correct.map(ch => ({char:ch, good:true})));
    while(mix.length<total){
      // ดึงจากกลุ่มอื่น + ขยะ
      const otherCat = pick(GROUPS.filter(g=>g.id!==currentCat.id));
      const ch = Math.random()<0.65 ? pick(otherCat.pool) : pick(JUNK);
      // หลีกเลี่ยงชนกับ correct ที่เลือกแล้วเกินไป
      mix.push({char:ch, good:false});
    }
    // สลับลำดับ
    for(let i=mix.length-1;i>0;i--){
      const j=(Math.random()*(i+1))|0; const t=mix[i]; mix[i]=mix[j]; mix[j]=t;
    }

    // สุ่มค่า life / speed ต่อชิ้น (ผูกกับความยากแบบเบา ๆ)
    const baseLife = (difficulty==='easy')? 2200 : (difficulty==='hard')? 1500 : 1800;
    const lifeJitter = 300;

    // ใส่ลงซีน
    for(let i=0;i<mix.length;i++){
      const it = mix[i]; const p = positions[i];
      const el = emojiImage(it.char, rnd(0.54,0.68), 128); // scale อิงเมตร

      el.classList.add('clickable');
      el.setAttribute('position', `${p.x} ${p.y} ${p.z}`);

      // โกลวสีพื้นเบา ๆ (แยกชิ้นดี/ลวง)
      const glow = document.createElement('a-entity');
      glow.setAttribute('geometry', 'primitive: plane; width: 0.52; height: 0.52');
      glow.setAttribute('material', `color:${it.good?'#22c55e':'#ef4444'}; opacity:0.16; transparent:true; side: double`);
      glow.setAttribute('position', `0 0 -0.01`);
      el.appendChild(glow);

      // อายุ
      const ttl = Math.max(800, baseLife + ((Math.random()<0.5? -1:1) * (lifeJitter + ((Math.random()*300)|0))));
      const kill = setTimeout(function(){
        // ถ้าหมดอายุแล้วยังอยู่ ถือว่า "พลาดเฉพาะกรณีชิ้นดีเท่านั้น"
        if(!el.parentNode || !running) return;
        try{ host.removeChild(el); }catch(_e){}
        spawns++;
        if(it.good){
          // พลาดชิ้นดี = บทลงโทษ
          roundPerfect = false;
          combo = 0; wrong++; recentWrong.push(1);
          emit('hha:miss', {count:wrong});
          emit('hha:score', {score:score, combo:combo});
        }else{
          // ปล่อยของลวงหายไป → ไม่ลงโทษ
        }
      }, ttl);

      // คลิก
      el.addEventListener('click', function(){
        if(!running) return;
        clearTimeout(kill);
        spawns++;
        const pos = el.object3D ? el.object3D.position : p;
        try{ host.removeChild(el); }catch(_e){}

        if(it.good){
          hits++; goodTotal++;
          combo = clamp(combo+1, 0, 9999);
          const base = 40; // groups ให้คะแนนต่อชิ้นมากกว่าหน่อย
          const plus = base + Math.floor(combo*2.5);
          score += plus;
          if(combo>maxCombo) maxCombo = combo;
          targetLeft = Math.max(0, targetLeft-1);

          // เอฟเฟกต์
          popupScore(host, '+'+plus, pos);
          safeBurst(pos, '#22c55e');

          // จบรอบ?
          if(targetLeft<=0){
            // รอบนี้สำเร็จ
            winStreak += 1;
            catCleared.add(currentCat.id);

            // เควสบันทึกเวลาจบ / perfect
            const sec = Math.round((performance.now()-roundStartAt)/1000);
            const wasPerfect = roundPerfect;

            // เตรียมรอบใหม่
            roundCount += 1;
            recentWrongMax = Math.max(recentWrongMax, recentWrong.reduce((a,b)=>a+b,0));
            if(recentWrong.length>3) recentWrong.shift();

            // สุ่มหมวดใหม่ + จำนวนใหม่
            currentCat = pick(GROUPS);
            nextTargetCount();
            targetLeft = targetCount;
            roundStartAt = performance.now();
            roundPerfect = true;
            recentWrong.push(0);
            if(recentWrong.length>3) recentWrong.shift();

            // แจ้ง HUD
            emit('hha:score', {score:score, combo:combo});
            emit('hha:quest', {text: questText()});

            // เช็คเควสจากจบเงื่อนไข
            checkQuests();

            // สปอนรอบถัดไป
            setTimeout(spawnWave, 180);

            // โค้ช
            try{ window.dispatchEvent(new CustomEvent('coach:say',{detail:{text: (wasPerfect? 'รอบเพอร์เฟกต์! ไปต่อเลย!':'รอบผ่าน! เยี่ยม!')}})); }catch(e){}

          }else{
            // ยังไม่ครบจำนวน → อัปเดต HUD แล้วสปอนเพิ่มเล็กน้อยให้มีตัวเลือกต่อเนื่อง
            emit('hha:score', {score:score, combo:combo});
            emit('hha:quest', {text: questText()});
            // เติมชิ้นใหม่ 1-2 เพื่อรักษาจำนวนบนจอ (ป้องกันโล่ง)
            maybeTopUp();
          }

        }else{
          // กดผิด
          wrong++; recentWrong.push(1);
          if(recentWrong.length>3) recentWrong.shift();
          roundPerfect = false;
          combo = 0;
          score = Math.max(0, score - 30);
          popupScore(host, '−30', pos);
          safeBurst(pos, '#ef4444');
          emit('hha:miss', {count:wrong});
          emit('hha:score', {score:score, combo:combo});
          // เติมเป้าใหม่เล็กน้อย เพื่อให้ยังมีตัวเลือกพอ
          maybeTopUp();
        }
      });

      host.appendChild(el);
    }
  }

  function maybeTopUp(){
    // ถ้าเหลือเป้าบนจอน้อยกว่า 4 → เติม 2 ชิ้นแบบสุ่ม (1 ดี 1 ลวง)
    if(!running) return;
    const current = host.querySelectorAll('a-image.clickable').length;
    if(current>=4) return;
    const add = 2;
    const ps = planPositions(add);
    const opt = [
      {char: pick(currentCat.pool), good:true},
      {char: (Math.random()<0.65 ? pick(pick(GROUPS.filter(g=>g.id!==currentCat.id)).pool) : pick(JUNK)), good:false}
    ];
    for(let i=0;i<add;i++){
      const it = opt[i%opt.length];
      const el = emojiImage(it.char, rnd(0.52,0.66), 128);
      el.classList.add('clickable');
      el.setAttribute('position', `${ps[i].x} ${ps[i].y} ${ps[i].z}`);

      const ttl = setTimeout(function(){
        if(!el.parentNode || !running) return;
        try{ host.removeChild(el); }catch(_e){}
        spawns++;
        if(it.good){
          roundPerfect = false;
          combo = 0; wrong++; recentWrong.push(1);
          emit('hha:miss', {count:wrong});
          emit('hha:score', {score:score, combo:combo});
        }
      }, (difficulty==='hard'? 1400: 1700) + ((Math.random()*300)|0));

      el.addEventListener('click', function(){
        if(!running) return;
        clearTimeout(ttl);
        spawns++;
        const pos = el.object3D ? el.object3D.position : ps[i];
        try{ host.removeChild(el); }catch(_e){}
        if(it.good){
          hits++; goodTotal++;
          combo = clamp(combo+1,0,9999);
          const plus = 35 + Math.floor(combo*2.2);
          score += plus; if(combo>maxCombo) maxCombo=combo;
          targetLeft = Math.max(0, targetLeft-1);
          popupScore(host, '+'+plus, pos);
          safeBurst(pos, '#22c55e');
          emit('hha:score', {score:score, combo:combo});
          emit('hha:quest', {text: questText()});
          if(targetLeft<=0){
            // ปิดรอบเหมือนด้านบน
            winStreak += 1;
            catCleared.add(currentCat.id);
            const wasPerfect = roundPerfect;
            roundCount += 1;
            recentWrongMax = Math.max(recentWrongMax, recentWrong.reduce((a,b)=>a+b,0));
            if(recentWrong.length>3) recentWrong.shift();
            currentCat = pick(GROUPS);
            nextTargetCount();
            targetLeft = targetCount;
            roundStartAt = performance.now();
            roundPerfect = true;
            recentWrong.push(0);
            if(recentWrong.length>3) recentWrong.shift();
            emit('hha:quest', {text: questText()});
            checkQuests();
            setTimeout(spawnWave, 160);
            try{ window.dispatchEvent(new CustomEvent('coach:say',{detail:{text:(wasPerfect?'รอบเพอร์เฟกต์! ไปต่อ!':'รอบผ่าน! เก่งมาก!')}})); }catch(e){}
          }else{
            maybeTopUp();
          }
        }else{
          wrong++; recentWrong.push(1); if(recentWrong.length>3) recentWrong.shift();
          roundPerfect = false; combo=0;
          score = Math.max(0, score-30);
          popupScore(host, '−30', pos);
          safeBurst(pos, '#ef4444');
          emit('hha:miss', {count:wrong});
          emit('hha:score', {score:score, combo:combo});
          maybeTopUp();
        }
      });

      host.appendChild(el);
    }
  }

  function end(reason){
    if(!running) return;
    running = false;
    clearInterval(timerSec);
    // เก็บกวาดเป้า
    try{
      const nodes = host.querySelectorAll('a-image.clickable');
      for(let i=0;i<nodes.length;i++){ try{ host.removeChild(nodes[i]); }catch(_e){} }
    }catch(_e){}
    emit('hha:end', {
      reason: reason||'done',
      mode: 'Food Groups',
      difficulty,
      score, combo, comboMax:maxCombo,
      hits, misses: wrong, spawns,
      questsCleared: questIndex, questsTotal: 3,
      duration
    });
  }

  // คืน API ให้ index เรียก
  return {
    stop: function(){ end('quit'); },
    pause: function(){ running=false; },
    resume: function(){
      if(running) return;
      running = true;
      emit('hha:quest', {text: questText()});
    }
  };
}

export default { boot };
