// === Good vs Junk — Production build (coach + powerups + SFX + clean logs) ===
/* global AFRAME */

export async function boot(cfg = {}) {
  // ---------- Config ----------
  const host   = cfg.host || document.getElementById('spawnHost') || document.body;
  const diff   = String(cfg.difficulty || 'normal');
  const DURA   = Math.max(10, Number(cfg.duration || 60));
  const SFXMAP = cfg.sfx || {}; // {hit:'#id', miss:'#id', ...}

  // Pools
  const POOL_GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🥛','🍞','🐟','🥗'];
  const POOL_JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  const P_STAR = 0.06;     // 6% โผล่ ⭐
  const P_DIAM = 0.03;     // 3% โผล่ 💎
  const P_SHLD = 0.04;     // 4% โผล่ 🛡

  // Difficulty tuning
  let cfgRate = { easy:850, normal:650, hard:520 }[diff] || 650;
  let lifeMs  = { easy:2100, normal:1700, hard:1400 }[diff] || 1700;
  let fontPx  = { easy:96, normal:88,  hard:82 }[diff] || 88;
  const MAX_ACTIVE = { easy:5, normal:6, hard:7 }[diff] || 6;
  const MIN_DIST   = 0.26; // ระยะกันชนบนจอ (หน่วย = สัดส่วนกว้าง/สูงของ viewport)

  // Fever
  let fever = { level:0, active:false };
  const FEVER_THR = 100;
  const FEVER_GAIN_GOOD = 8;
  const FEVER_GAIN_STAR = 18;
  const FEVER_GAIN_DIAM = 30;
  const FEVER_DECAY_IDLE = 4;
  const FEVER_DECAY_ACTIVE = 14;
  let lastTick = performance.now();

  // Stats
  let running = true;
  let left = DURA;
  let score = 0, combo = 0, comboMax = 0, hits=0, misses=0, spawns=0;
  let goodCount=0, junkAvoid=0, starCount=0, diamondCount=0;
  let shieldUntil = 0; // timestamp ช่วงมีเกราะ
  const active = new Set();

  // Mini-Quest (สุ่ม 3/10)
  const questsPool = [
    { id:'good10',   text:'เก็บของดี 10 ชิ้น', check:()=>goodCount>=10, prog:()=>`${goodCount}/10` },
    { id:'avoid5',   text:'เลี่ยงขยะ 5 ครั้ง', check:()=>junkAvoid>=5,   prog:()=>`${junkAvoid}/5` },
    { id:'combo10',  text:'ทำคอมโบ 10',       check:()=>comboMax>=10,   prog:()=>`${comboMax}/10` },
    { id:'score400', text:'ทำคะแนน 400+',      check:()=>score>=400,     prog:()=>`${score}/400` },
    { id:'star2',    text:'เก็บดาว ⭐ 2 ดวง',   check:()=>starCount>=2,   prog:()=>`${starCount}/2` },
    { id:'diamond1', text:'เก็บเพชร 💎 1 เม็ด', check:()=>diamondCount>=1,prog:()=>`${diamondCount}/1` },
    { id:'combo20',  text:'คอมโบ 20',         check:()=>comboMax>=20,   prog:()=>`${comboMax}/20` },
    { id:'good20',   text:'เก็บของดี 20 ชิ้น', check:()=>goodCount>=20,  prog:()=>`${goodCount}/20` },
    { id:'time15',   text:'อยู่รอด 15 วินาที', check:()=> (DURA-left)>=15, prog:()=>`${Math.min(DURA-left,15)}/15s` },
    { id:'fever1',   text:'เปิด FEVER 1 ครั้ง', check:()=>feverTimes>=1,  prog:()=>`${feverTimes}/1` }
  ];
  let feverTimes=0;
  const deck = pick3(questsPool);
  let qIdx=0;

  // ---------- Utilities ----------
  const $ = s=>document.querySelector(s);
  const vw = ()=>Math.max(320, window.innerWidth||320);
  const vh = ()=>Math.max(320, window.innerHeight||320);
  const rand = (a,b)=>a+Math.random()*(b-a);
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const now = ()=>performance.now();
  const play = (sel)=>{ try{ const a = document.querySelector(sel); a && a.play && a.play().catch(()=>{});}catch{} };
  const coach = (text)=>{ try{ window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text}})); }catch{} };
  const coachLines = {
    start:['พร้อมลุย!','สู้ไปด้วยกัน!','เริ่มเลย!'],
    good :['เยี่ยมมาก!','สุดยอด!','ดีมาก!','โฟกัสดี!'],
    miss :['ระวังของขยะ!','อย่าพลาดนะ!','ตั้งสติ!'],
    combo:(c)=>[`คอมโบ x${c}! ไปต่อ!`,`โหดมาก! x${c}`],
    fever:['🔥 FEVER MODE! ยิงยาว!', 'พลังเต็ม! ลุยเลย!'],
    shield:['ได้เกราะแล้ว! กันพลาดชั่วคราว!']
  };

  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }
  function emojiTexture(char, px=96){
    const pad=Math.floor(px*0.45), W=px+pad*2, H=px+pad*2;
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const ctx=cv.getContext('2d');
    ctx.clearRect(0,0,W,H);
    ctx.shadowColor='rgba(0,0,0,.35)'; ctx.shadowBlur=Math.floor(px*.18);
    ctx.shadowOffsetX=Math.floor(px*.04); ctx.shadowOffsetY=Math.floor(px*.06);
    ctx.font=`${px}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(char, W/2, H/2);
    return cv.toDataURL('image/png');
  }
  function spawnImage(char, scale=0.6){
    const src = emojiTexture(char, fontPx);
    const el = document.createElement('a-image');
    el.setAttribute('src', src);
    el.setAttribute('transparent', true);
    el.setAttribute('material', 'transparent:true; side:double; alphaTest:0.01');
    el.setAttribute('scale', `${scale} ${scale} ${scale}`);
    return el;
  }
  function inViewBox(x,y,others){
    // กันซ้อน: ตรวจระยะเชิงหน้าจอ (สัดส่วน)
    return !others.some(o=>{
      const dx = (x - o.x), dy = (y - o.y);
      return Math.hypot(dx,dy) < MIN_DIST;
    });
  }
  function pick3(list){
    // เอา easy/normal/hard อย่างละ 1 ถ้าอยาก strict ก็เลือกแบบแบ่งระดับ
    const copy=[...list];
    const out=[];
    while(out.length<3 && copy.length){
      out.push(copy.splice((Math.random()*copy.length)|0,1)[0]);
    }
    return out;
  }
  function updateQuestHUD(){
    const q = deck[qIdx];
    fire('hha:quest', {text: `Quest ${qIdx+1}/3: ${q.text} (${q.prog()})`});
  }
  function coachSay(arr){ coach(arr[(Math.random()*arr.length)|0]); }

  // ---------- Shard & Score FX ----------
  function burstShards(scene, pos3, color='#6ee7b7', count=12, speed=1.2){
    for(let i=0;i<count;i++){
      const p=document.createElement('a-plane');
      p.setAttribute('width','0.06'); p.setAttribute('height','0.12');
      p.setAttribute('material', `color:${color}; opacity:0.95; side:double`);
      p.object3D.position.set(pos3.x,pos3.y,pos3.z);
      const ang = Math.random()*Math.PI*2;
      const v = speed*(.6 + Math.random()*0.8);
      const to = `${pos3.x + Math.cos(ang)*v} ${pos3.y + (Math.random()*0.9+0.4)} ${pos3.z + Math.sin(ang)*v}`;
      p.setAttribute('animation__fly', `property: position; to:${to}; dur:${500+Math.random()*500|0}; easing:easeOutCubic`);
      p.setAttribute('animation__fade', `property: material.opacity; to:0; dur:600; delay:200`);
      scene.appendChild(p);
      setTimeout(()=>{ try{ scene.removeChild(p);}catch{} }, 1200);
    }
  }
  function floatScore(scene, pos3, txt="+1"){
    const t=document.createElement('a-text');
    t.setAttribute('value', txt);
    t.setAttribute('color', '#e8eefc');
    t.setAttribute('align','center');
    t.setAttribute('width','2.5');
    t.object3D.position.set(pos3.x, pos3.y+0.12, pos3.z);
    t.setAttribute('animation__up', 'property: position; to: 0 0.5 0; dur:700; easing:easeOutCubic; isRawProperty:true');
    t.setAttribute('animation__fade','property: opacity; to:0; dur:700; easing:linear');
    scene.appendChild(t);
    setTimeout(()=>{ try{ scene.removeChild(t);}catch{} }, 800);
  }

  // ---------- Spawn ----------
  const scene = host.closest('a-scene') || document.querySelector('a-scene') || document.body;
  const spawnArea = []; // เก็บจุดสำหรับกันชน

  function randomScreenPos(){
    // กลางจอ (สัดส่วน) 0..1
    for(let safety=0;safety<40;safety++){
      const x = rand(0.18,0.82);
      const y = rand(0.28,0.70);
      if(inViewBox(x,y, spawnArea)) return {x,y};
    }
    return {x:0.5,y:0.5};
  }

  function screenToWorld(x,y){
    // map สัดส่วนหน้าจอ → world ใกล้ ๆ spawnHost
    const base = host.object3D || {position:{x:0,y:1,z:-1.6}};
    const dx = (x-0.5)*1.4; // กว้างราว 1.4m
    const dy = (0.58 - y)*1.2; // ย้ายขึ้นลง
    return { x: base.position.x + dx, y: base.position.y + dy, z: base.position.z };
  }

  function plan(){
    if(!running) return;
    if(active.size >= MAX_ACTIVE){ setTimeout(plan, 120); return; }
    const delay = cfgRate + Math.random()*220;
    setTimeout(spawnOne, delay);
  }

  function spawnOne(){
    if(!running) return;

    // เลือกชนิด: power-up vs normal
    let kind='normal', char=null;
    const r=Math.random();
    if(r < P_DIAM){ kind='diamond'; char='💎'; }
    else if(r < P_DIAM+P_SHLD){ kind='shield'; char='🛡'; }
    else if(r < P_DIAM+P_SHLD+P_STAR){ kind='star'; char='⭐'; }

    if(kind==='normal'){
      const good = Math.random() < 0.65;
      char = good ? POOL_GOOD[(Math.random()*POOL_GOOD.length)|0] : POOL_JUNK[(Math.random()*POOL_JUNK.length)|0];
      kind = good ? 'good' : 'junk';
    }

    const pos = randomScreenPos();
    spawnArea.push(pos);
    setTimeout(()=>{ // ล้างจุดกันชนหลัง 1 วิ
      const i = spawnArea.indexOf(pos); if(i>=0) spawnArea.splice(i,1);
    }, 1000);

    const p3 = screenToWorld(pos.x,pos.y);
    const el = spawnImage(char, 0.62);
    el.classList.add('clickable');
    el.object3D.position.set(p3.x, p3.y, p3.z);
    scene.appendChild(el);

    spawns++;
    active.add(el);

    let clicked=false;
    const clear=()=>{
      try{ active.delete(el); scene.removeChild(el);}catch{}
    };

    const onHit=(ev)=>{
      if(clicked||!running) return; clicked=true; ev?.preventDefault?.();
      // ผลลัพธ์ตามชนิด
      if(kind==='good'){
        score += fever.active ? 4 : 2; combo++; comboMax=Math.max(comboMax,combo); goodCount++;
        play(SFXMAP.hit); coachSay(coachLines.good);
        floatScore(scene, p3, fever.active?'+4':'+2');
        burstShards(scene,p3,'#6ee7b7', 10, 1.2);
        fever.level = clamp(fever.level + FEVER_GAIN_GOOD, 0, 100);
      }else if(kind==='junk'){
        // โดน junk = โทษ (ยกเว้นมีเกราะ)
        if(now() < shieldUntil){
          // กันโทษ แต่ไม่นับพลาด
          play(SFXMAP.shield);
          burstShards(scene,p3,'#60a5fa', 8, 1.2);
          floatScore(scene,p3,'Guard!');
        }else{
          combo=0; misses++; play(SFXMAP.miss); coachSay(coachLines.miss);
          burstShards(scene,p3,'#fca5a5', 10, 1.1);
        }
      }else if(kind==='star'){
        starCount++; score += 6; fever.level = clamp(fever.level + FEVER_GAIN_STAR, 0, 100);
        play(SFXMAP.star); coachSay(coachLines.good);
        floatScore(scene,p3,'⭐ +6'); burstShards(scene,p3,'#fde047', 14, 1.3);
      }else if(kind==='diamond'){
        diamondCount++; score += 12; fever.level = clamp(fever.level + FEVER_GAIN_DIAM, 0, 100);
        play(SFXMAP.diamond); coach('เพชรมาแล้ว! คะแนนพุ่ง!');
        floatScore(scene,p3,'💎 +12'); burstShards(scene,p3,'#a78bfa', 18, 1.4);
      }else if(kind==='shield'){
        shieldUntil = now() + 6000; // 6 วินาที
        play(SFXMAP.shield); coachSay(coachLines.shield);
        floatScore(scene,p3,'🛡 Guard'); burstShards(scene,p3,'#60a5fa', 12, 1.2);
      }

      fire('hha:score',{score,combo});
      checkQuest();
      clear();
      plan();
    };

    el.addEventListener('click', onHit, {passive:false});
    el.addEventListener('touchstart', onHit, {passive:false});

    setTimeout(()=>{
      if(clicked||!running) return;
      // หมดอายุ → ถ้าเป็น junk = นับ "เลี่ยงขยะ" ให้คะแนนเล็กน้อย
      if(kind==='junk'){
        junkAvoid++; score += 1; play(SFXMAP.score);
        floatScore(scene,p3,'+1'); burstShards(scene,p3,'#94a3b8', 6, 0.9);
      }else if(kind==='good'){
        // พลาดของดี → โทษ
        if(now() < shieldUntil){
          // มีเกราะอยู่ → ไม่หัก
        }else{
          combo=0; misses++; play(SFXMAP.miss);
        }
      }
      fire('hha:score',{score,combo});
      clear();
      plan();
    }, lifeMs);
  }

  // ---------- Quest cycle ----------
  function checkQuest(){
    const q = deck[qIdx];
    if(q && q.check()){
      qIdx = Math.min(qIdx+1, deck.length-1);
      play(SFXMAP.quest);
      if(qIdx < deck.length) {
        fire('hha:quest',{text:`สำเร็จ! → ${deck[qIdx].text} (${deck[qIdx].prog()})`});
      } else {
        fire('hha:quest',{text:`Mini Quest — สำเร็จ! FEVER กำลังทำงาน...`});
      }
    } else {
      updateQuestHUD();
    }
  }

  // ---------- Fever loop ----------
  function tick(){
    if(!running) return;
    const t = now();
    const dt = Math.max(0, (t-lastTick)/1000); // s
    lastTick = t;

    const dec = fever.active ? FEVER_DECAY_ACTIVE : FEVER_DECAY_IDLE;
    if(dec>0){
      fever.level = clamp(fever.level - dec*dt, 0, 100);
      fire('hha:fever', {state:'change', level:fever.level, active:fever.active});
    }

    if(!fever.active && fever.level>=FEVER_THR){
      fever.active = true; feverTimes++;
      fire('hha:fever',{state:'start', level:100, active:true});
      play(SFXMAP.fever); coach(coachLines.fever[(Math.random()*coachLines.fever.length)|0]);
      setTimeout(()=>{ // auto end
        if(!running) return;
        fever.active=false; fever.level=0;
        fire('hha:fever',{state:'end', level:0, active:false});
      }, 10000);
    }
    requestAnimationFrame(tick);
  }

  // ---------- Time loop ----------
  const timeTimer = setInterval(()=>{
    if(!running) return;
    left = Math.max(0, left-1);
    fire('hha:time', {sec:left});
    if(left<=0) end('timeout');
  }, 1000);

  // ---------- Start ----------
  coachSay(coachLines.start);
  updateQuestHUD();
  fire('hha:score',{score,combo});
  fire('hha:time',{sec:left});
  plan();
  requestAnimationFrame(()=>{ lastTick=now(); tick(); });

  // ---------- End/Controls ----------
  function end(reason='done'){
    if(!running) return;
    running=false;
    try{ clearInterval(timeTimer);}catch{}
    // ล้างเป้า
    active.forEach(el=>{ try{ scene.removeChild(el);}catch{} });
    active.clear();

    fire('hha:end', {
      reason, score, combo, comboMax, misses, hits, spawns,
      duration:DURA, mode:'Good vs Junk', difficulty:diff,
      questsCleared:qIdx>=deck.length-1 && deck[deck.length-1].check()?3: qIdx,
      questsTotal:3
    });
  }

  return {
    stop: ()=>end('quit'),
    pause: ()=>{ running=false; },
    resume: ()=>{ if(!running){ running=true; lastTick=now(); requestAnimationFrame(tick); plan(); } }
  };
}

export default { boot };
