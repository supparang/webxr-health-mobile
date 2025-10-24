/* games/rhythm-boxer/game.js
   Rhythm Boxer · 1–15 Features + Boss Note + Themed Stages
   - Cursor/Mouse/Tap คลิกติดแน่
   - เริ่มช้าแล้วเร่ง (Adaptive Curve)
   - ชนิดโน้ต: Tap / Hold / Slide / Burst
   - Pattern/Setlist/Modifiers/Fever/Micro-Quests/Crowd/Coach
   - คะแนน–เกรด–เลเวล–โกสต์(บันทึกรีเพลย์พื้นฐาน)
   - ธีมฉาก (กลางคืน/นีออน/พายุ), Boss Note ช่วงท้ายเพลง
   - ปุ่ม Start/Pause/End/Replay/Back to Hub ทำงานครบ
   - Back to Hub: https://supparang.github.io/webxr-health-mobile/vr-fitness/
*/
(function(){
  "use strict";

  // ---------- Shortcuts / Const ----------
  const $ = (id)=>document.getElementById(id);
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const lerp =(a,b,t)=>a+(b-a)*t;
  const nowms=()=>performance.now();

  // ---------- Themes ----------
  const THEMES = {
    night : { bg:'#06101a', hit:'#27ff8a', lane:'#0f2030', fog:'#06101a' },
    neon  : { bg:'#0a0014', hit:'#00ffd5', lane:'#170033', fog:'#0a0014' },
    storm : { bg:'#0b0f14', hit:'#53ff33', lane:'#101a26', fog:'#0b0f14' }
  };
  function applyTheme(key){
    const t = THEMES[key] || THEMES.night;
    try{
      const sc = document.querySelector('a-scene');
      sc?.setAttribute('background', `color: ${t.bg}`);
      const line = $('hitLine'); if(line) line.setAttribute('color', t.hit);
      // สร้างเส้น lane (จางๆ) 3 เส้น
      const arena = $('arena');
      if(arena && !arena.querySelector('.lane-line')){
        [-0.8,0,0.8].forEach((x,i)=>{
          const ln=document.createElement('a-entity');
          ln.classList.add('lane-line');
          ln.setAttribute('geometry','primitive: box; height: 0.01; width: 0.02; depth: 2.6');
          ln.setAttribute('material','color: '+t.lane+'; opacity: 0.28; transparent: true');
          ln.setAttribute('position', `${x} 1.6 -2.3`);
          arena.appendChild(ln);
        });
      }
    }catch(_){}
  }

  // ---------- SFX ----------
  const SFX = {
    tapGood   : new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    tapPerf   : new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss      : new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo     : new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui        : new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    crowd10   : new Audio(`${ASSET_BASE}/assets/sfx/crowd10.mp3`),
    crowd20   : new Audio(`${ASSET_BASE}/assets/sfx/crowd20.mp3`),
    coachGo   : new Audio(`${ASSET_BASE}/assets/sfx/coach_go.mp3`),
    coachNice : new Audio(`${ASSET_BASE}/assets/sfx/coach_nice.mp3`),
  };
  Object.values(SFX).forEach(a=>{ try{a.preload='auto'; a.crossOrigin='anonymous';}catch(_){} });

  // ---------- Music ----------
  const music = new Audio(); music.crossOrigin='anonymous'; music.preload='auto';

  // ---------- Global State ----------
  const RB = window.RB = (window.RB||{});
  RB.running=false; RB.paused=false;
  RB.ghost = [];        // บันทึกรีเพลย์พื้นฐาน (timestamp ของ hit/miss)
  RB.offsetMs = +(localStorage.getItem('rb_offset_ms')||0);  // Calibration

  // HUD / Score State
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let accuracy=0; // อัปเดตปลายเกม
  // Timers
  let timer=null, spawnTimer=null, accelRAF=null, feverRAF=null;
  // Speed & Spawn
  let speedPreset='standard';           // beginner/standard/challenge
  let fineTune = 0;                     // -2..+2
  let fallSpeed=0.7;                    // m/s
  let spawnInt=1200;                    // ms
  let accelEvery=4000;                  // ms
  let lastAccel=0;
  // Hit Windows (เมตริกตามระยะห่างแกน Y)
  const HIT_Y = 1.08;
  const BASE_GOOD = 0.19;
  const BASE_PERF = 0.10;
  let HIT_WIN_GOOD = BASE_GOOD;
  let HIT_WIN_PERF = BASE_PERF;

  // Fever
  let fever = { meter:0, active:false, until:0 };
  const FEVER_GAIN_PERF = 7, FEVER_GAINGOOD=3, FEVER_REQ=100, FEVER_DUR=9000, FEVER_MUL=1.5;

  // Micro-Quests
  let MQ = null; // {need, done, until, title}

  // Modifiers (อ่านจาก URL | localStorage)
  const MODS = {
    mirror:false, hidden:false, sudden:false, nofail:false, feverPlus:false
  };
  function loadMods(){
    try{
      const sp=new URLSearchParams(location.search);
      ['mirror','hidden','sudden','nofail','feverPlus'].forEach(k=>{
        const v = sp.get(k) ?? localStorage.getItem('rb_mod_'+k);
        if(v!=null) MODS[k] = v==='1' || v==='true';
      });
      if(MODS.feverPlus) fever.meter = Math.min(FEVER_REQ-20, fever.meter+20);
      // ปรับหน้าต่างตรวจจับให้ยากขึ้น/ง่ายลงเล็กน้อยตาม mod
      if(MODS.hidden) HIT_WIN_PERF *= 0.95, HIT_WIN_GOOD*=0.95;
      if(MODS.sudden) HIT_WIN_PERF *= 0.95, HIT_WIN_GOOD*=0.95;
      if(MODS.nofail) timeLeft = 99;
    }catch(_){}
  }

  // Colors & Kinds
  const COLORS=["#00d0ff","#ffd166","#ff6b6b","#00ffa3","#a899ff","#ff9c6b"];
  const NOTE_SIZE=0.22; // ใหญ่ขึ้น
  const LANES = [-0.8, -0.4, 0, 0.4, 0.8];

  // Notes live set
  const live = new Set(); // {el, kind, alive, born, lane, yStart, linkId? holdEnd? slideSeq? judged?}

  // ---------- HUD ----------
  function updateHUD(){
    $('hudScore') && ($('hudScore').textContent = Math.round(score));
    $('hudCombo') && ($('hudCombo').textContent = combo);
    $('hudTime')  && ($('hudTime').textContent  = timeLeft);
    $('hudSpeed') && ($('hudSpeed').textContent = presetName(speedPreset)+(fineTune?` (${fineTune>0?'+':''}${fineTune})`:''));
    $('feverVal') && ($('feverVal').style.width = Math.min(100, fever.meter)+'%');
  }
  function presetName(v){ return v==='beginner'?'Beginner':v==='challenge'?'Challenge':'Standard'; }

  function pulseHitLine(){
    const hl=$('hitLine'); if(!hl) return;
    hl.setAttribute('animation__pulse','property: scale; to: 1.15 1 1; dir: alternate; dur: 120; loop: 1; easing: easeOutQuad');
    // reset automatically by A-Frame
  }

  function floatText(text,color,pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.23;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:520,delay:120,easing:'linear'});
    $('arena')?.appendChild(e);
    setTimeout(()=>{ try{e.remove();}catch(_e){} },840);
  }

  // ---------- Patterns ----------
  let seed=123456;
  function srand(n){ seed=(seed*1664525+1013904223)>>>0; return (seed&0x7fffffff)/0x80000000; }
  function pickLane(){ return LANES[(srand() * LANES.length)|0]; }
  function pickColor(){ return COLORS[(srand() * COLORS.length)|0]; }

  function scheduleBurst(){
    for(let i=0;i<3;i++) setTimeout(()=>spawnNote('burst'), i*140);
  }
  function scheduleSlide(){
    // สไลด์ 3 จุด L -> C -> R
    const lanes=[-0.8, 0, 0.8];
    lanes.forEach((x,i)=> setTimeout(()=>spawnNote('slide', x), i*230));
  }
  function patternTick(){
    // โอกาสสุ่ม pattern แม้ในโหมดทั่วไป
    if(!RB.running) return;
    if(srand()<0.08) scheduleBurst();
    if(srand()<0.06) scheduleSlide();
  }

  // ---------- Spawning ----------
  function spawnNote(kind='tap', forceX=null){
    spawns++;
    const x = (forceX!=null? forceX : pickLane());
    const yStart = 2.7, z=-2.3;
    const shape = (kind==='slide'? 'a-box' : (srand()<0.5?'a-sphere':'a-box'));
    const c = pickColor();

    const el=document.createElement(shape);
    el.classList.add('clickable','rb-note');
    if(shape==='a-sphere'){
      el.setAttribute('radius', NOTE_SIZE);
    }else{
      el.setAttribute('width', NOTE_SIZE*1.85);
      el.setAttribute('height', NOTE_SIZE*1.85);
      el.setAttribute('depth', NOTE_SIZE*1.85);
    }
    el.setAttribute('material', `color:${c}; opacity:${MODS.hidden?0.6:0.95}; transparent:true; metalness:0.1; roughness:0.4`);
    el.setAttribute('position', `${x} ${yStart} ${z}`);
    if(MODS.sudden) el.setAttribute('opacity','0.1');

    $('arena')?.appendChild(el);

    const N = { el, kind, alive:true, born: nowms(), lane:x, yStart, judged:false, linkId:null };
    live.add(N);

    // Input binding (กัน Double-Judge โดยเช็ค N.judged ก่อน)
    const hitHandler=()=>{ judgeHit(N); };
    el.addEventListener('click', hitHandler);
    el.addEventListener('mousedown', hitHandler);

    // แบบ Hold: สร้างแถบเงา
    if(kind==='hold'){
      const bar=document.createElement('a-entity');
      bar.setAttribute('geometry','primitive: box; height: 0.05; width: 0.08; depth: 0.7');
      bar.setAttribute('material', `color:${c}; opacity:0.45; transparent:true`);
      bar.setAttribute('position', `${x} ${yStart-0.35} ${z}`);
      N.holdBar=bar; $('arena')?.appendChild(bar);
      N.holdEnd = nowms() + 850; // ต้องกดค้าง ~0.85s
    }

    // Loop ตก
    const startT=nowms();
    (function step(){
      if(!N.alive || !RB.running) return;
      const dt = (nowms()-startT)/1000;
      const y = N.yStart - dt*fallSpeed;
      el.setAttribute('position', `${x} ${y.toFixed(3)} ${z}`);
      if(N.holdBar){ N.holdBar.setAttribute('position', `${x} ${(y-0.35).toFixed(3)} ${z}`); }

      // sudden เผยตัวเมื่อใกล้ Hit Line
      if(MODS.sudden){
        const d=Math.abs(y-HIT_Y);
        const alpha = clamp(1 - (d/0.8), 0.1, 0.95);
        el.setAttribute('material', `color:${c}; opacity:${alpha}; transparent:true`);
      }

      // Miss ถ้าเลย Hit Line ต่ำกว่า window และยังไม่ตัดสิน
      if(y <= HIT_Y - HIT_WIN_GOOD*1.4){
        // ป้องกัน Miss ซ้ำหลัง Perfect/Good: ถ้า judged แล้วให้ข้าม
        if(!N.judged){
          N.alive=false; live.delete(N);
          try{ el.remove(); }catch(_){}
          if(N.holdBar){ try{N.holdBar.remove();}catch(_){ } }
          onMiss(new THREE.Vector3(x,HIT_Y,z));
        }
        return;
      }
      requestAnimationFrame(step);
    })();
  }

  // ---------- Judge ----------
  function judgeHit(N){
    if(!RB.running || !N.alive || N.judged) return;
    const el = N.el;
    const p = el.object3D.getWorldPosition(new THREE.Vector3());
    // ชดเชย Calibration offset -> แปลง ms เป็นระยะ (fallSpeed m/s)
    const deltaYfromOffset = (RB.offsetMs/1000)*fallSpeed;
    const dy = Math.abs((p.y - HIT_Y) - deltaYfromOffset);

    let quality='good';
    if(dy <= HIT_WIN_PERF) quality='perfect';
    else if(dy <= HIT_WIN_GOOD) quality='good';
    else quality='miss';

    // Hold ต้องกดค้างจนถึงเวลา
    if(N.kind==='hold'){
      if(quality==='miss'){ finalizeMiss(); return; }
      // เริ่มกด: ตัดสินเป็น "holdStart" และต้องถือไว้จนถึง N.holdEnd
      const startT=nowms();
      const keep = ()=>{
        if(!RB.running){ finalizeMiss(); return; }
        const ok = nowms()>= (N.holdEnd||startT);
        if(ok){
          finalizeHit('perfect', true); // hold สำเร็จให้ perfect
        }else{
          requestAnimationFrame(keep);
        }
      };
      keep();
      // ล็อคไม่ให้ Miss อัตโนมัติ
      N.judged=true; N.alive=false; live.delete(N);
      try{ el.remove(); }catch(_){}
      if(N.holdBar){ try{N.holdBar.remove();}catch(_){ } }
      return;
    }

    if(quality==='miss'){ finalizeMiss(); return; }
    finalizeHit(quality, false);

    function finalizeHit(q, silent){
      N.judged=true; N.alive=false; live.delete(N);
      try{ el.remove(); }catch(_){}
      if(N.holdBar){ try{N.holdBar.remove();}catch(_){ } }

      const base = (q==='perfect'? 20:10);
      const mul  = fever.active? FEVER_MUL:1;
      score += base*mul;
      hits++; combo++; maxCombo=Math.max(maxCombo,combo);
      if(!silent){
        (q==='perfect'? SFX.tapPerf:SFX.tapGood).play();
        floatText(q.toUpperCase(), q==='perfect' ? '#00ffa3' : '#00d0ff', p);
        pulseHitLine();
        if(combo%10===0) SFX.combo.play();
      }
      // Fever gain
      fever.meter = clamp(fever.meter + (q==='perfect'?FEVER_GAIN_PERF:FEVER_GAINGOOD), 0, 100);
      updateHUD();
      crowdCoachTick();
      adaptAfterEvent(true);
    }
    function finalizeMiss(){
      N.judged=true; N.alive=false; live.delete(N);
      try{ el.remove(); }catch(_){}
      if(N.holdBar){ try{N.holdBar.remove();}catch(_){ } }
      onMiss(p);
      adaptAfterEvent(false);
    }
  }

  function onMiss(p){
    combo=0;
    if(!MODS.nofail) score = Math.max(0, score-4);
    SFX.miss.play();
    floatText('MISS','#ff5577', p);
    updateHUD();
  }

  // ---------- Adaptive Curve ----------
  function setBaseByPreset(){
    if(speedPreset==='beginner'){
      fallSpeed=0.52; spawnInt=1650; accelEvery=5200;
    }else if(speedPreset==='challenge'){
      fallSpeed=0.9;  spawnInt=900;  accelEvery=3600;
    }else{ // standard
      fallSpeed=0.7;  spawnInt=1200; accelEvery=4200;
    }
    // Fine tune (-2..+2) => ~±12%
    const t = clamp(+fineTune, -2, 2);
    const k = 1 + (t*0.06);
    fallSpeed*=k; spawnInt = Math.round(spawnInt / k);
  }
  function adaptAfterEvent(hit){
    // เรียกทุกครั้งหลัง Judge
    const acc = spawns? hits/spawns : 0;
    // โค้ง: ถ้า hit ต่อเนื่อง & acc สูง -> เร่งเล็กน้อย, ถ้าพลาดบ่อย -> ผ่อน
    if(hit && combo>=10 && acc>0.85){
      fallSpeed = clamp(fallSpeed + 0.02, 0.45, 2.2);
      spawnInt  = clamp(spawnInt - 18, 420, 2400);
    }else if(!hit){
      fallSpeed = clamp(fallSpeed - 0.03, 0.45, 2.2);
      spawnInt  = clamp(spawnInt + 30, 420, 2400);
    }
    clearInterval(spawnTimer);
    spawnTimer=setInterval(()=>{ spawnNote(); patternTick(); }, spawnInt);
  }

  // ---------- Fever ----------
  function tryActivateFever(){
    if(fever.active) return;
    if(fever.meter>=FEVER_REQ){
      fever.active=true;
      fever.until = nowms() + (MODS.feverPlus ? FEVER_DUR+4000 : FEVER_DUR);
      $('feverBox') && ($('feverBox').classList.add('active'));
      feverLoop();
    }
  }
  function feverLoop(){
    if(!fever.active) return;
    if(nowms()>=fever.until){
      fever.active=false;
      $('feverBox') && ($('feverBox').classList.remove('active'));
      return;
    }
    feverRAF=requestAnimationFrame(feverLoop);
  }

  // ---------- Micro-Quests ----------
  function rollMicroQuest(){
    if(MQ || !RB.running) return;
    if(Math.random()<0.12){
      MQ = { need:5, done:0, until: nowms()+9000, title:'Perfect x5!' };
      $('quest') && ($('quest').textContent = MQ.title);
      $('quest') && ($('quest').style.opacity = '1');
      setTimeout(()=>{ if(MQ && nowms()>MQ.until){ $('quest').style.opacity='0'; MQ=null; } }, 9500);
    }
  }
  function onPerfectMQ(){
    if(MQ){ MQ.done++; if(MQ.done>=MQ.need){ score+=120; fever.meter = clamp(fever.meter+25,0,100); $('quest').textContent='OBJ CLEAR! +120'; setTimeout(()=>{$('quest').style.opacity='0';},800); MQ=null; } }
  }

  // ---------- Crowd / Coach ----------
  function crowdCoachTick(){
    if(combo===5){ try{SFX.coachGo.play();}catch(_){ } }
    if(combo===10){ try{SFX.crowd10.play();}catch(_){ } }
    if(combo===20){ try{SFX.crowd20.play();}catch(_){ } }
    if(combo>0 && combo%15===0){ try{SFX.coachNice.play();}catch(_){ } }
  }

  // ---------- Flow ----------
  function clearNotes(){ document.querySelectorAll('.rb-note').forEach(n=>{ try{n.remove();}catch(_){ } }); live.clear(); }
  function playSelectedSong(){
    const opt = $('songSel')?.selectedOptions?.[0]; const url = opt?.value;
    const title = opt?.dataset?.title || opt?.textContent || '—';
    $('hudSong') && ($('hudSong').textContent = title||'—');
    if(!url || url==='none'){ try{ music.pause(); }catch(_){ } return; }
    try{ music.src = url; music.currentTime=0; music.play().catch(()=>{}); }catch(_){}
  }

  function start(){
    if(RB.running) return;
    RB.running=true; RB.paused=false;
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; fever={meter:0,active:false,until:0}; MQ=null;
    RB.ghost.length=0;
    setBaseByPreset(); updateHUD(); applyTheme(($('themeSel')?.value)||'night');

    loadMods(); updateHUD();

    // เวลา
    clearInterval(timer); timer=setInterval(()=>{ if(!RB.running) return; timeLeft--; $('hudTime') && ($('hudTime').textContent=timeLeft); if(timeLeft<=0 && !MODS.nofail) endGame(); }, 1000);

    // Spawn สายแรก
    clearInterval(spawnTimer);
    spawnNote(); patternTick();
    spawnTimer=setInterval(()=>{ spawnNote(); patternTick(); }, spawnInt);

    // Progressive Accel (นอกจาก Adaptive)
    lastAccel=nowms();
    const accelTick=()=>{
      if(!RB.running) return;
      const t=nowms();
      if(t-lastAccel>=accelEvery){
        lastAccel=t; fallSpeed=clamp(fallSpeed+0.03,0.45,2.2); spawnInt=clamp(spawnInt-50,420,2400);
        clearInterval(spawnTimer);
        spawnTimer=setInterval(()=>{ spawnNote(); patternTick(); }, spawnInt);
      }
      accelRAF=requestAnimationFrame(accelTick);
    }; accelTick();

    playSelectedSong();

    // Boss Note (20 วิ สุดท้าย): hit window แคบ+pattern หลอกจังหวะ
    const bossTimer = setInterval(()=>{
      if(!RB.running){ clearInterval(bossTimer); return; }
      if(timeLeft<=20){
        HIT_WIN_PERF = BASE_PERF*0.8; HIT_WIN_GOOD = BASE_GOOD*0.85;
        // หลอกจังหวะ: ชุด burst แทรกสไลด์
        scheduleBurst(); setTimeout(scheduleSlide, 420); setTimeout(scheduleBurst, 820);
        clearInterval(bossTimer);
      }
    }, 500);
  }

  function pause(){
    if(!RB.running || RB.paused) return;
    RB.paused=true;
    clearInterval(timer); clearInterval(spawnTimer);
    if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    if(feverRAF){ cancelAnimationFrame(feverRAF); feverRAF=null; }
    try{ music.pause(); }catch(_){}
  }
  function resume(){
    if(!RB.running || !RB.paused) return;
    RB.paused=false;
    timer=setInterval(()=>{ if(!RB.running) return; timeLeft--; $('hudTime').textContent=timeLeft; if(timeLeft<=0 && !MODS.nofail) endGame(); }, 1000);
    spawnTimer=setInterval(()=>{ spawnNote(); patternTick(); }, spawnInt);
    lastAccel=nowms();
    const accelTick=()=>{ if(!RB.running||RB.paused) return; const t=nowms(); if(t-lastAccel>=accelEvery){ lastAccel=t; fallSpeed=clamp(fallSpeed+0.03,0.45,2.2); spawnInt=clamp(spawnInt-50,420,2400); clearInterval(spawnTimer); spawnTimer=setInterval(()=>{ spawnNote(); patternTick(); }, spawnInt);} accelRAF=requestAnimationFrame(accelTick); }; accelTick();
    music.play().catch(()=>{});
  }

  function endGame(){
    if(!RB.running) return;
    RB.running=false; RB.paused=false;
    clearInterval(timer); clearInterval(spawnTimer);
    if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    if(feverRAF){ cancelAnimationFrame(feverRAF); feverRAF=null; }
    try{ music.pause(); }catch(_){}
    clearNotes();

    accuracy = spawns? Math.round((hits/spawns)*100) : 0;
    const grade = (accuracy>=95?'S': accuracy>=88?'A': accuracy>=78?'B': accuracy>=67?'C':'D');
    $('rSong')  && ($('rSong').textContent = $('hudSong')?.textContent || '—');
    $('rScore') && ($('rScore').textContent = Math.round(score));
    $('rMaxCombo') && ($('rMaxCombo').textContent = maxCombo);
    $('rAcc')   && ($('rAcc').textContent = accuracy+'%');
    $('rGrade') && ($('rGrade').textContent = grade);
    $('results')&& ($('results').style.display='grid');
    SFX.ui.play();

    // XP/Level (พื้นฐาน)
    try{
      const st = JSON.parse(localStorage.getItem('rb_profile')||'{}');
      st.xp = (st.xp||0) + Math.max(0, Math.round(score/10));
      st.level = 1 + Math.floor((st.xp||0)/500);
      localStorage.setItem('rb_profile', JSON.stringify(st));
    }catch(_){}

    // Ghost baseline (แค่นับเวลาต่อ hit/miss)
    try{
      localStorage.setItem('rb_ghost_last', JSON.stringify({acc:accuracy, maxCombo, score:Math.round(score)}));
    }catch(_){}
  }

  // ---------- Calibration / Practice ----------
  function setOffsetMs(ms){
    RB.offsetMs = clamp(ms, -180, 180);
    localStorage.setItem('rb_offset_ms', RB.offsetMs);
    $('offsetVal') && ($('offsetVal').textContent = (RB.offsetMs>0?'+':'')+RB.offsetMs+'ms');
  }
  function setSpeedPreset(v){ speedPreset = v||'standard'; setBaseByPreset(); updateHUD(); }
  function setFineTune(n){ fineTune = parseInt(n||0,10); setBaseByPreset(); updateHUD(); }
  function setTheme(v){ applyTheme(v||'night'); }

  // ---------- Wire UI ----------
  function wireUI(){
    $('btnStart')?.addEventListener('click', start);
    $('btnPause')?.addEventListener('click', ()=>{
      if(!RB.running) return;
      if(!RB.paused){ pause();  $('btnPause').textContent='Resume'; }
      else          { resume(); $('btnPause').textContent='Pause';  }
    });
    $('btnEnd')?.addEventListener('click', endGame);
    $('replayBtn')?.addEventListener('click', ()=>{ $('results').style.display='none'; start(); });
    $('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });

    $('songSel')?.addEventListener('change', playSelectedSong);
    $('speedSel')?.addEventListener('change', e=> setSpeedPreset(e.target.value));
    $('fineSel')?.addEventListener('change', e=> setFineTune(e.target.value));
    $('themeSel')?.addEventListener('change', e=> setTheme(e.target.value));

    $('feverBtn')?.addEventListener('click', tryActivateFever);

    $('offsetMinus')?.addEventListener('click', ()=> setOffsetMs(RB.offsetMs-10));
    $('offsetPlus') ?.addEventListener('click', ()=> setOffsetMs(RB.offsetMs+10));

    // Enter VR (กลางล่าง)
    $('enterVRBtn')?.addEventListener('click', ()=>{ try{ document.querySelector('a-scene')?.enterVR?.(); }catch(_){ } });

    // Hotkeys
    addEventListener('keydown', (ev)=>{
      if(ev.code==='Space'){ ev.preventDefault(); if(!RB.running) start(); else if(RB.paused) resume(); else pause(); }
      if(ev.code==='KeyF'){ tryActivateFever(); }
      if(ev.code==='Escape'){ endGame(); }
    });
  }

  function boot(){
    wireUI();
    setBaseByPreset();
    updateHUD();
    // Hit line (สีเรือง)
    const line = $('hitLine');
    if(line){
      line.setAttribute('material', 'color: '+(THEMES.night.hit)+'; emissive: #00ff88; emissiveIntensity: 0.7; opacity: 0.9; transparent: true');
    }
    applyTheme('night');
    setOffsetMs(RB.offsetMs||0);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // ----- Pointer Raycast (คลิกโดนแน่) -----
  (function installPointerRaycast(){
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function pick(clientX, clientY){
      const cam = sceneEl.camera; if (!cam) return;
      mouse.x =  (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, cam);
      const clickable = Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const objects=[]; clickable.forEach(o=>o.traverse(ch=>objects.push(ch)));
      const hits = raycaster.intersectObjects(objects, true);
      if (hits && hits.length){
        let obj = hits[0].object; while(obj && !obj.el) obj=obj.parent;
        if(obj && obj.el){ obj.el.emit('click'); }
      }
    }
    window.addEventListener('mousedown', e=>pick(e.clientX, e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{ const t=e.touches?.[0]; if(!t) return; pick(t.clientX, t.clientY); }, {passive:true});
  })();

  // ----- iOS audio unlock -----
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext);
    let ctx = Ctx? new Ctx() : null;
    function resume(){ if(unlocked||!ctx) return; ctx.resume?.(); unlocked=(ctx.state==='running'); }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>addEventListener(ev, resume, {once:true, passive:true}));
  })();

})();
