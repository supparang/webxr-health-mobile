/* games/rhythm-boxer/game.js
   Rhythm Boxer · Coach System Added
   - โค้ชพูด/ให้กำลังใจ/เตือนจังหวะ พร้อมกล่องข้อความ + เสียง
   - ผูกทริกเกอร์: เริ่มเกม, คอมโบ, พลาดติดกัน, Fever พร้อมใช้, ใกล้ช่วงบอส, จบเกม
   - คงฟีเจอร์หลักเดิม: เริ่มช้าแล้วเร่ง, คลิกโดนแน่ (Pointer Raycast), HUD/ผลลัพธ์, ธีมฉาก, Boss Note, Crowd
   - Back to Hub: https://supparang.github.io/webxr-health-mobile/vr-fitness/
*/
(function(){
  "use strict";

  // ---------- Shortcuts / Const ----------
  const $ = (id)=>document.getElementById(id);
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const nowms=()=>performance.now();

  // ---------- Themes ----------
  const THEMES = {
    night : { bg:'#06101a', hit:'#27ff8a', lane:'#0f2030' },
    neon  : { bg:'#0a0014', hit:'#00ffd5', lane:'#170033' },
    storm : { bg:'#0b0f14', hit:'#53ff33', lane:'#101a26' }
  };
  function applyTheme(key){
    const t = THEMES[key] || THEMES.night;
    try{
      const sc = document.querySelector('a-scene');
      sc?.setAttribute('background', `color: ${t.bg}`);
      const line = $('hitLine'); if(line){
        line.setAttribute('material', `color: ${t.hit}; emissive: ${t.hit}; emissiveIntensity: 0.7; opacity: 0.95; transparent: true`);
      }
      // lane lines once
      const arena = $('arena');
      if(arena && !arena.querySelector('.lane-line')){
        [-0.8,0,0.8].forEach(x=>{
          const ln=document.createElement('a-entity');
          ln.classList.add('lane-line');
          ln.setAttribute('geometry','primitive: box; height: 0.01; width: 0.02; depth: 2.6');
          ln.setAttribute('material',`color:${t.lane}; opacity:.28; transparent:true`);
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
    coachWarn : new Audio(`${ASSET_BASE}/assets/sfx/coach_warn.mp3`),
    coachFvr  : new Audio(`${ASSET_BASE}/assets/sfx/coach_fever.mp3`),
    coachBoss : new Audio(`${ASSET_BASE}/assets/sfx/coach_boss.mp3`),
    coachEnd  : new Audio(`${ASSET_BASE}/assets/sfx/coach_end.mp3`),
  };
  Object.values(SFX).forEach(a=>{ try{a.preload='auto'; a.crossOrigin='anonymous';}catch(_){} });

  // ---------- Music ----------
  const music = new Audio(); music.crossOrigin='anonymous'; music.preload='auto';

  // ---------- Global State ----------
  const RB = window.RB = (window.RB||{});
  RB.running=false; RB.paused=false;
  RB.offsetMs = +(localStorage.getItem('rb_offset_ms')||0);

  // HUD / Score
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60, accuracy=0;
  // Timers
  let timer=null, spawnTimer=null, accelRAF=null, feverRAF=null;
  // Speed & Spawn
  let speedPreset='standard';
  let fineTune=0;
  let fallSpeed=0.7, spawnInt=1200, accelEvery=4200, lastAccel=0;

  // Hit windows
  const HIT_Y=1.08;
  const BASE_GOOD=0.19, BASE_PERF=0.10;
  let HIT_WIN_GOOD=BASE_GOOD, HIT_WIN_PERF=BASE_PERF;

  // Fever
  let fever = { meter:0, active:false, until:0 };
  const FEVER_GAIN_PERF=7, FEVER_GAINGOOD=3, FEVER_REQ=100, FEVER_DUR=9000, FEVER_MUL=1.5;

  // Mods
  const MODS={ mirror:false, hidden:false, sudden:false, nofail:false, feverPlus:false };
  function loadMods(){
    try{
      const sp=new URLSearchParams(location.search);
      ['mirror','hidden','sudden','nofail','feverPlus'].forEach(k=>{
        const v = sp.get(k) ?? localStorage.getItem('rb_mod_'+k);
        if(v!=null) MODS[k] = v==='1'||v==='true';
      });
      if(MODS.hidden||MODS.sudden){ HIT_WIN_PERF*=0.95; HIT_WIN_GOOD*=0.95; }
      if(MODS.nofail) timeLeft=99;
      if(MODS.feverPlus) fever.meter=Math.min(FEVER_REQ-20, fever.meter+20);
    }catch(_){}
  }

  // Colors/Lanes
  const COLORS=["#00d0ff","#ffd166","#ff6b6b","#00ffa3","#a899ff","#ff9c6b"];
  const NOTE_SIZE=0.22;
  const LANES=[-0.8,-0.4,0,0.4,0.8];

  // Notes
  const live=new Set(); // {el, kind, alive, born, lane, yStart, judged?}

  // ---------- HUD ----------
  function updateHUD(){
    if($('hudScore')) $('hudScore').textContent=Math.round(score);
    if($('hudCombo')) $('hudCombo').textContent=combo;
    if($('hudTime'))  $('hudTime').textContent=timeLeft;
    if($('hudSpeed')) $('hudSpeed').textContent=presetName(speedPreset)+(fineTune?` (${fineTune>0?'+':''}${fineTune})`:'');
    if($('feverVal')) $('feverVal').style.width=Math.min(100,fever.meter)+'%';
  }
  function presetName(v){ return v==='beginner'?'Beginner':v==='challenge'?'Challenge':'Standard'; }

  function floatText(text,color,pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.23;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:520,delay:120,easing:'linear'});
    $('arena')?.appendChild(e); setTimeout(()=>{ try{e.remove();}catch(_e){} },840);
  }
  function pulseHitLine(){ const hl=$('hitLine'); if(!hl) return;
    hl.setAttribute('animation__pulse','property: scale; to: 1.15 1 1; dir: alternate; dur: 120; loop: 1; easing: easeOutQuad'); }

  // ---------- Coach System ----------
  // UI: กล่องโค้ชมุมล่างซ้าย + อวาตาร์เล็ก
  (function installCoachUI(){
    if($('coachBox')) return;
    const box=document.createElement('div'); box.id='coachBox';
    Object.assign(box.style,{
      position:'fixed',left:'12px',bottom:'12px',zIndex:9999,
      display:'flex',gap:'8px',alignItems:'center',
      background:'rgba(6,14,24,.82)',border:'1px solid rgba(0,255,170,.25)',
      color:'#cff',padding:'8px 10px',borderRadius:'12px',maxWidth:'52vw',
      font:'600 13px/1.25 system-ui,Segoe UI,Arial'
    });
    const avatar=document.createElement('div'); avatar.id='coachAvatar';
    Object.assign(avatar.style,{
      width:'36px',height:'36px',borderRadius:'50%',background:'radial-gradient(#00c9a7,#006b62)',
      boxShadow:'0 0 12px rgba(0,255,200,.45) inset'
    });
    const text=document.createElement('div'); text.id='coachText'; text.textContent='พร้อมลุย!';
    box.appendChild(avatar); box.appendChild(text); document.body.appendChild(box);
  })();

  const coachQ=[]; let coachBusy=false; let lastCoachAt=0;
  function coachSay(msg, sfx=null, ttl=2200){
    // กันสแปม: เว้น 600ms
    const t=nowms(); if(t-lastCoachAt<600){ coachQ.push({msg,sfx,ttl}); return; }
    lastCoachAt=t;
    const el=$('coachText'); if(!el) return;
    el.textContent=msg;
    if(sfx){ try{sfx.currentTime=0; sfx.play();}catch(_){ } }
    if(coachBusy) return;
    coachBusy=true;
    setTimeout(()=>{
      coachBusy=false;
      if(coachQ.length){ const n=coachQ.shift(); coachSay(n.msg,n.sfx,n.ttl); }
    }, ttl);
  }

  function coachStart(){
    coachSay('เริ่มจากช้า ๆ โฟกัสเส้นเขียว!', SFX.coachGo, 2400);
  }
  function coachCombo(c){
    if(c===5)  coachSay('จังหวะดีมาก! คงไว้!', SFX.coachNice);
    if(c===10) coachSay('ต่อเนื่องสุด ๆ!','',1800), SFX.crowd10.play?.();
    if(c===20) coachSay('สุดยอด! อย่าพลาดนะ!', '', 2000), SFX.crowd20.play?.();
  }
  function coachMissStreak(n){
    if(n===2) coachSay('ช้าไปนิด ลองตัดให้ตรงเส้น!', SFX.coachWarn);
    if(n>=4)  coachSay('ปรับตั้งค่า Offset ได้ที่เมนู!', SFX.coachWarn, 2600);
  }
  function coachFeverReady(){ coachSay('FEVER พร้อม! กดเลย!', SFX.coachFvr); }
  function coachBossSoon(){ coachSay('บอสโน้ตใกล้มา! หน้าต่างแคบลง ระวัง!', SFX.coachBoss, 2600); }
  function coachEndSummary(grade){ coachSay(`จบ! เกรด ${grade} — ดีมาก!`, SFX.coachEnd, 2600); }

  // ---------- RNG / Pattern ----------
  let seed=123456;
  function srand(){ seed=(seed*1664525+1013904223)>>>0; return (seed&0x7fffffff)/0x80000000; }
  function pickLane(){ return LANES[(srand()*LANES.length)|0]; }
  function pickColor(){ return COLORS[(srand()*COLORS.length)|0]; }

  function scheduleBurst(){ for(let i=0;i<3;i++) setTimeout(()=>spawnNote('tap'), i*140); }
  function scheduleSlide(){
    const arr=[-0.8,0,0.8];
    arr.forEach((x,i)=> setTimeout(()=>spawnNote('slide', x), i*230));
  }
  function patternTick(){ if(!RB.running) return; if(srand()<0.08) scheduleBurst(); if(srand()<0.06) scheduleSlide(); }

  // ---------- Spawning ----------
  function spawnNote(kind='tap', forceX=null){
    spawns++;
    const x = (forceX!=null? forceX : pickLane());
    const yStart=2.7, z=-2.3;
    const shape=(kind==='slide' ? 'a-box' : (srand()<0.5?'a-sphere':'a-box'));
    const c = pickColor();

    const el=document.createElement(shape);
    el.classList.add('clickable','rb-note');
    if(shape==='a-sphere') el.setAttribute('radius', NOTE_SIZE);
    else { el.setAttribute('width', NOTE_SIZE*1.85); el.setAttribute('height', NOTE_SIZE*1.85); el.setAttribute('depth', NOTE_SIZE*1.85); }
    el.setAttribute('material', `color:${c}; opacity:${MODS.hidden?0.6:0.95}; transparent:true; metalness:0.1; roughness:0.4`);
    el.setAttribute('position', `${x} ${yStart} ${z}`);
    if(MODS.sudden) el.setAttribute('opacity','0.1');
    $('arena')?.appendChild(el);

    const N={el, kind, alive:true, born:nowms(), lane:x, yStart, judged:false};
    live.add(N);

    const hitHandler=()=>judgeHit(N);
    el.addEventListener('click', hitHandler);
    el.addEventListener('mousedown', hitHandler);

    // fall loop
    const startT=nowms();
    (function step(){
      if(!N.alive || !RB.running) return;
      const dt=(nowms()-startT)/1000;
      const y=N.yStart - dt*fallSpeed;
      el.setAttribute('position', `${x} ${y.toFixed(3)} ${z}`);

      if(MODS.sudden){
        const d=Math.abs(y-HIT_Y); const alpha=clamp(1-(d/0.8),0.1,0.95);
        el.setAttribute('material', `color:${c}; opacity:${alpha}; transparent:true`);
      }

      // auto miss if passed
      if(y <= HIT_Y - HIT_WIN_GOOD*1.4){
        if(!N.judged){
          N.alive=false; live.delete(N); try{el.remove();}catch(_){}
          onMiss(new THREE.Vector3(x,HIT_Y,z));
        }
        return;
      }
      requestAnimationFrame(step);
    })();
  }

  // ---------- Judge ----------
  let missStreak=0;
  function judgeHit(N){
    if(!RB.running || !N.alive || N.judged) return;
    const el=N.el;
    const p=el.object3D.getWorldPosition(new THREE.Vector3());
    const dy = Math.abs((p.y - HIT_Y) - ((RB.offsetMs/1000)*fallSpeed));
    let q = (dy<=HIT_WIN_PERF ? 'perfect' : (dy<=HIT_WIN_GOOD ? 'good' : 'miss'));

    N.judged=true; N.alive=false; live.delete(N);
    try{el.remove();}catch(_){}

    if(q==='miss'){ onMiss(p); adaptAfterEvent(false); return; }

    const base = (q==='perfect'?20:10), mul = (fever.active?FEVER_MUL:1);
    score+=base*mul; hits++; combo++; maxCombo=Math.max(maxCombo,combo);
    missStreak=0;
    (q==='perfect'?SFX.tapPerf:SFX.tapGood).play();
    floatText(q.toUpperCase(), q==='perfect'?'#00ffa3':'#00d0ff', p);
    pulseHitLine();
    if(combo%10===0) SFX.combo.play();
    if(q==='perfect') onPerfectMQ();
    fever.meter = clamp(fever.meter + (q==='perfect'?FEVER_GAIN_PERF:FEVER_GAINGOOD), 0, 100);
    if(fever.meter>=FEVER_REQ && !fever.active) coachFeverReady();

    coachCombo(combo);
    updateHUD();
    adaptAfterEvent(true);
  }

  function onMiss(p){
    combo=0; missStreak++;
    if(!MODS.nofail) score=Math.max(0, score-4);
    SFX.miss.play(); floatText('MISS','#ff5577', p);
    coachMissStreak(missStreak);
    updateHUD();
  }

  // ---------- Adaptive ----------
  function setBaseByPreset(){
    if(speedPreset==='beginner'){ fallSpeed=0.52; spawnInt=1650; accelEvery=5200; }
    else if(speedPreset==='challenge'){ fallSpeed=0.9; spawnInt=900; accelEvery=3600; }
    else { fallSpeed=0.7; spawnInt=1200; accelEvery=4200; }
    const t=clamp(+fineTune,-2,2), k=1+(t*0.06); fallSpeed*=k; spawnInt=Math.round(spawnInt/k);
  }
  function adaptAfterEvent(hit){
    const acc = spawns? hits/spawns : 0;
    if(hit && combo>=10 && acc>0.85){ fallSpeed=clamp(fallSpeed+0.02,0.45,2.2); spawnInt=clamp(spawnInt-18,420,2400); }
    else if(!hit){ fallSpeed=clamp(fallSpeed-0.03,0.45,2.2); spawnInt=clamp(spawnInt+30,420,2400); }
    clearInterval(spawnTimer);
    spawnTimer=setInterval(()=>{ spawnNote(); patternTick(); }, spawnInt);
  }

  // ---------- Fever ----------
  function tryActivateFever(){
    if(fever.active || fever.meter<FEVER_REQ) return;
    fever.active=true; fever.until=nowms()+(MODS.feverPlus?FEVER_DUR+4000:FEVER_DUR);
    $('feverBox')?.classList.add('active');
    coachSay('Fever On! แต้มคูณแล้ว!', SFX.coachFvr, 1600);
    feverLoop();
  }
  function feverLoop(){
    if(!fever.active) return;
    if(nowms()>=fever.until){ fever.active=false; $('feverBox')?.classList.remove('active'); return; }
    feverRAF=requestAnimationFrame(feverLoop);
  }

  // ---------- Micro-Quest ----------
  let MQ=null;
  function rollMicroQuest(){
    if(MQ||!RB.running) return;
    if(Math.random()<0.12){
      MQ={need:5,done:0,until:nowms()+9000,title:'Perfect x5!'}; const el=$('quest');
      if(el){ el.textContent=MQ.title; el.style.opacity='1'; }
      coachSay('ภารกิจ: เพอร์เฟ็กต์ 5 ครั้ง!', null, 1600);
      setTimeout(()=>{ if(MQ && nowms()>MQ.until){ if(el) el.style.opacity='0'; MQ=null; } }, 9500);
    }
  }
  function onPerfectMQ(){
    if(MQ){ MQ.done++; if(MQ.done>=MQ.need){ score+=120; fever.meter=clamp(fever.meter+25,0,100); const el=$('quest'); if(el){ el.textContent='OBJ CLEAR! +120'; setTimeout(()=>{el.style.opacity='0';},800);} MQ=null; coachSay('ทำภารกิจสำเร็จ!', SFX.ui); } }
  }

  // ---------- Flow ----------
  function clearNotes(){ document.querySelectorAll('.rb-note').forEach(n=>{ try{n.remove();}catch(_){ } }); live.clear(); }
  function playSelectedSong(){
    const opt=$('songSel')?.selectedOptions?.[0]; const url=opt?.value; const title=opt?.dataset?.title||opt?.textContent||'—';
    if($('hudSong')) $('hudSong').textContent=title||'—';
    if(!url||url==='none'){ try{music.pause();}catch(_){ } return; }
    try{ music.src=url; music.currentTime=0; music.play().catch(()=>{}); }catch(_){}
  }

  function start(){
    if(RB.running) return;
    RB.running=true; RB.paused=false;
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; accuracy=0; fever={meter:0,active:false,until:0}; MQ=null; missStreak=0;
    setBaseByPreset(); updateHUD(); applyTheme(($('themeSel')?.value)||'night'); loadMods();

    // coach intro
    coachStart();

    // timer
    clearInterval(timer);
    timer=setInterval(()=>{
      if(!RB.running) return;
      timeLeft--; if($('hudTime')) $('hudTime').textContent=timeLeft;
      if(timeLeft===30) rollMicroQuest();
      if(timeLeft===25) coachSay('กลางเพลงแล้ว! รักษาคอมโบ!', null, 1600);
      if(timeLeft===22) coachBossSoon();
      if(timeLeft<=0 && !MODS.nofail) endGame();
    },1000);

    // spawn
    clearInterval(spawnTimer);
    spawnNote(); patternTick();
    spawnTimer=setInterval(()=>{ spawnNote(); patternTick(); }, spawnInt);

    // progressive accel
    lastAccel=nowms();
    const accelTick=()=>{
      if(!RB.running) return;
      const t=nowms();
      if(t-lastAccel>=accelEvery){
        lastAccel=t; fallSpeed=clamp(fallSpeed+0.03,0.45,2.2); spawnInt=clamp(spawnInt-50,420,2400);
        clearInterval(spawnTimer); spawnTimer=setInterval(()=>{ spawnNote(); patternTick(); }, spawnInt);
      }
      accelRAF=requestAnimationFrame(accelTick);
    }; accelTick();

    playSelectedSong();

    // Boss note: window แคบ + ลวงจังหวะช่วงท้าย
    const bossTimer=setInterval(()=>{
      if(!RB.running){ clearInterval(bossTimer); return; }
      if(timeLeft<=20){
        HIT_WIN_PERF=BASE_PERF*0.8; HIT_WIN_GOOD=BASE_GOOD*0.85;
        scheduleBurst(); setTimeout(scheduleSlide, 420); setTimeout(scheduleBurst, 820);
        clearInterval(bossTimer);
      }
    },500);
  }

  function pause(){
    if(!RB.running||RB.paused) return;
    RB.paused=true;
    clearInterval(timer); clearInterval(spawnTimer);
    if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    if(feverRAF){ cancelAnimationFrame(feverRAF); feverRAF=null; }
    try{ music.pause(); }catch(_){}
    coachSay('พักหายใจก่อน แล้วไปต่อ!', null, 1500);
  }
  function resume(){
    if(!RB.running||!RB.paused) return;
    RB.paused=false;
    timer=setInterval(()=>{ if(!RB.running) return; timeLeft--; if($('hudTime')) $('hudTime').textContent=timeLeft; if(timeLeft<=0 && !MODS.nofail) endGame(); },1000);
    spawnTimer=setInterval(()=>{ spawnNote(); patternTick(); }, spawnInt);
    const accelTick=()=>{ if(!RB.running||RB.paused) return; const t=nowms(); if(t-lastAccel>=accelEvery){ lastAccel=t; fallSpeed=clamp(fallSpeed+0.03,0.45,2.2); spawnInt=clamp(spawnInt-50,420,2400); clearInterval(spawnTimer); spawnTimer=setInterval(()=>{ spawnNote(); patternTick(); }, spawnInt);} accelRAF=requestAnimationFrame(accelTick); }; accelTick();
    music.play().catch(()=>{});
    coachSay('ลุยต่อ!', null, 900);
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
    if($('rSong')) $('rSong').textContent = $('hudSong')?.textContent || '—';
    if($('rScore')) $('rScore').textContent = Math.round(score);
    if($('rMaxCombo')) $('rMaxCombo').textContent = maxCombo;
    if($('rAcc')) $('rAcc').textContent = accuracy+'%';
    if($('rGrade')) $('rGrade').textContent = grade;
    if($('results')) $('results').style.display='grid';
    SFX.ui.play();
    coachEndSummary(grade);
  }

  // ---------- Calibration / Options ----------
  function setOffsetMs(ms){
    RB.offsetMs=clamp(ms,-180,180);
    localStorage.setItem('rb_offset_ms', RB.offsetMs);
    if($('offsetVal')) $('offsetVal').textContent=(RB.offsetMs>0?'+':'')+RB.offsetMs+'ms';
  }
  function setSpeedPreset(v){ speedPreset=v||'standard'; setBaseByPreset(); updateHUD(); }
  function setFineTune(n){ fineTune=parseInt(n||0,10); setBaseByPreset(); updateHUD(); }
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
    $('backBtn')?.addEventListener('click', ()=>{ location.href=HUB_URL; });

    $('songSel')?.addEventListener('change', playSelectedSong);
    $('speedSel')?.addEventListener('change', e=> setSpeedPreset(e.target.value));
    $('fineSel') ?.addEventListener('change', e=> setFineTune(e.target.value));
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
    applyTheme('night');
    setOffsetMs(RB.offsetMs||0);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // ----- Pointer Raycast (คลิกโดนแน่) -----
  (function installPointerRaycast(){
    const sceneEl=document.querySelector('a-scene'); if(!sceneEl) return;
    const ray=new THREE.Raycaster(); const v=new THREE.Vector2();
    function pick(x,y){
      const cam=sceneEl.camera; if(!cam) return;
      v.x=(x/window.innerWidth)*2-1; v.y=-(y/window.innerHeight)*2+1;
      ray.setFromCamera(v,cam);
      const objs=[]; Array.from(document.querySelectorAll('.clickable')).forEach(el=>el.object3D?.traverse(ch=>objs.push(ch)));
      const hits=ray.intersectObjects(objs,true);
      if(hits && hits.length){ let o=hits[0].object; while(o && !o.el) o=o.parent; if(o?.el) o.el.emit('click'); }
    }
    addEventListener('mousedown',e=>pick(e.clientX,e.clientY),{passive:true});
    addEventListener('touchstart',e=>{const t=e.touches?.[0]; if(!t) return; pick(t.clientX,t.clientY);},{passive:true});
  })();

  // ----- iOS audio unlock -----
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext), ctx=Ctx?new Ctx():null;
    function resume(){ if(unlocked||!ctx) return; ctx.resume?.(); unlocked=(ctx.state==='running'); }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>addEventListener(ev,resume,{once:true,passive:true}));
  })();

})();
