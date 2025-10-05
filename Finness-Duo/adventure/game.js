// ===== Glue for menu safety-net =====
window.__ADVENTURE_LOADED__ = true;

// ----------------------------------------------------
// Utilities: selectors (ปลอดภัยต่อ element ที่อาจไม่มี)
// ----------------------------------------------------
const $ = (id)=>document.getElementById(id);

// Elements (อาจไม่มีในบางหน้า จึงต้อง null-guard)
const root = $("root");
const sky = $("sky");
const parallaxRoot = $("parallaxRoot");   // อาจไม่มีใน adventure/index.html
const parallax = $("parallax");           // อาจไม่มีใน adventure/index.html
const hudText = $("hudText");
const hudTitle = $("hudTitle");
const hudLives = $("hudLives");
const hudQuest = $("hudQuest");
const btnStart = $("btnStart");
const btnReset = $("btnReset");
const selectDiff = $("difficulty");
const selectTheme = $("theme");
const selectQuest = $("quest");
const laneL = $("laneL");
const laneC = $("laneC");
const laneR = $("laneR");
const btnL = $("btnL");
const btnC = $("btnC");
const btnR = $("btnR");

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ----------------------------------------------------
// Audio (เดิม)
// ----------------------------------------------------
let audioCtx = null, musicGain = null, sfxGain = null, musicTimer = 0, musicRunning = false;
function ensureAudio(){ if (audioCtx) return; audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  musicGain = audioCtx.createGain(); musicGain.gain.value = 0.08; musicGain.connect(audioCtx.destination);
  sfxGain = audioCtx.createGain(); sfxGain.gain.value = 0.15; sfxGain.connect(audioCtx.destination);
}
function tone(freq=440, dur=0.08, type='sine', gain=0.15){
  ensureAudio(); const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(sfxGain);
  const t = audioCtx.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t+0.01); g.gain.linearRampToValueAtTime(0, t+dur);
  o.start(t); o.stop(t+dur+0.02);
}
const SFX = { orb:()=>tone(660,0.07,'triangle',0.18), hit:()=>tone(180,0.1,'sawtooth',0.22), ok:()=>tone(520,0.07,'sine',0.16), next:()=>tone(740,0.1,'square',0.18) };
function startMusic(theme){
  ensureAudio(); stopMusic(); musicRunning = true;
  const scale = theme==='jungle'?[220,277,330,392]:theme==='city'?[240,300,360,420]:[200,252,300,400];
  const wave  = theme==='jungle'?'triangle':theme==='city'?'sine':'square';
  const bpm=96, beat=60/bpm;
  function step(){
    if(!musicRunning) return; const baseT = audioCtx.currentTime;
    for(let i=0;i<8;i++){ const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type=wave;
      const f=scale[(i+musicTimer)%scale.length]*(theme==='space'&&i%4===0?0.5:1);
      o.frequency.value=f; o.connect(g); g.connect(musicGain);
      const t=baseT+i*(beat/2); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.09,t+0.01); g.gain.linearRampToValueAtTime(0,t+beat/2-0.02);
      o.start(t); o.stop(t+beat/2);
    }
    musicTimer++; setTimeout(step, beat*1000*4);
  } step();
}
function stopMusic(){ musicRunning=false; }

// ----------------------------------------------------
// Game State / Config (เดิม)
// ----------------------------------------------------
let state = { running:false, stageIndex:0, score:0, lives:3, lane:1, elapsed:0, startTime:0,
  duration:45, speed:2.0, hitWindow:0.35, rafId:null, items:[], nextSpawnIdx:0, pool:[], active:[],
  lastHudTs:0, hudInterval:isMobile?250:120, nextButton:null, theme:'jungle',
  questType:'collect', questTarget:12, questProgress:0, surviveOK:true, streak:0, bestStreak:0,
  totalOrbs:0, totalObCleared:0, obHit:0 };

const DIFF = {
  easy:{speed:1.8, hit:0.40, duration:40, spawnStep:1.2},
  normal:{speed:2.2, hit:0.35, duration:50, spawnStep:1.0},
  hard:{speed:2.6, hit:0.30, duration:55, spawnStep:0.8}
};
const STAGES = [
  { name:"Run Path 1", pattern:"mixed" },
  { name:"Energy Boost", pattern:"orbs" },
  { name:"Obstacle Zone", pattern:"obstacles" },
  { name:"Run Path 2", pattern:"dense" }
];

// สี fallback สำหรับธีม (กรณีไม่มีรูป)
const THEME_VIS = {
  jungle: { skyColor:'#0e2412' },
  city:   { skyColor:'#0f141a' },
  space:  { skyColor:'#050914' },
};

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
function clearChildren(el){ while(el && el.firstChild) el.removeChild(el.firstChild); }
function laneX(i){ return [-1.2,0,1.2][i]; }
function setLivesUI(n){ if(hudLives) hudLives.textContent = "❤️".repeat(Math.max(0,n)); }
function setTitle(){ if(hudTitle) hudTitle.textContent = `Stage ${state.stageIndex+1}/${STAGES.length} — ${STAGES[state.stageIndex].name}`; }
function setHUD(m){ if(hudText) hudText.textContent = m; }

// เปลี่ยนท้องฟ้า: ถ้ามีรูปจะใช้รูป, ถ้าไม่มีให้เปลี่ยนสีแทน (ไม่พัง)
function swapSky(theme){
  const v = THEME_VIS[theme] || THEME_VIS.jungle;
  if (sky){
    // ถ้าเคยตั้ง src เป็นรูป (เช่นจากเวอร์ชันอื่น) คงไว้ได้ แต่ถ้าไม่มี ให้ใช้สี
    sky.removeAttribute('material'); // ล้าง material ที่อาจมีจากเวอร์ชันก่อน
    if (v.sky) {
      sky.setAttribute('material', `src: ${v.sky}; color: #ffffff`);
    } else {
      sky.setAttribute('color', v.skyColor || '#0b1220');
    }
  }
  // parallax อาจไม่มี ให้เช็คก่อน
  if (parallax){
    if (v.parallax) parallax.setAttribute('material', `shader:flat; transparent:true; src:${v.parallax}; opacity:0.9`);
    else parallax.setAttribute('visible','false');
  }
}

// ----------------------------------------------------
// Pool / Spawner / Stats / Quests
// ----------------------------------------------------
function setQuestHUD(){
  const t = state.questType;
  let txt=""; 
  if(t==='collect') txt=`เควส: เก็บ Orb ให้ครบ ${state.questTarget} ลูก (ตอนนี้ ${state.questProgress})`;
  else if(t==='survive') txt=`เควส: เอาตัวรอดโดยไม่เสียชีวิต (สถานะ: ${state.surviveOK?'✅':'❌'})`;
  else if(t==='streak') txt=`เควส: หลบสิ่งกีดขวางต่อเนื่อง ${state.questTarget} ครั้ง (สถิติ ${state.bestStreak})`;
  if (hudQuest) hudQuest.textContent = txt;
}
function buildPool(size=44){
  state.pool=[]; for(let i=0;i<size;i++){
    const node=document.createElement('a-entity'); node.setAttribute('visible','false');
    const body=document.createElement('a-entity'); node.appendChild(body); node.__body=body; if(root) root.appendChild(node);
    state.pool.push({el:node, inUse:false, kind:null, lane:1, time:0, judged:false});
  }
}
function acquire(kind,lane){
  for(const p of state.pool){ if(!p.inUse){
    p.inUse=true; p.kind=kind; p.lane=lane; p.judged=false; p.el.setAttribute('visible','true');
    const body=p.el.__body;
    if(kind==='orb'){ body.setAttribute('geometry','primitive: sphere; radius:0.16'); body.setAttribute('material','color:#22c55e; opacity:0.98; shader:flat'); }
    else { body.setAttribute('geometry','primitive: box; width:0.7; height:0.5; depth:0.3'); body.setAttribute('material','color:#ef4444; opacity:0.95; shader:flat'); }
    return p;
  }} return null;
}
function release(p){ if(!p) return; p.inUse=false; p.el.setAttribute('visible','false'); p.el.object3D.position.set(laneX(p.lane),0,-10); }
function makeItems(pattern,duration,step){
  const items=[]; let t=1.2; const lanes=[0,1,2];
  while(t<duration){ const lane=lanes[Math.floor(Math.random()*3)];
    let kind='orb'; if(pattern==='orbs') kind='orb'; else if(pattern==='obstacles') kind='ob';
    else if(pattern==='dense') kind=Math.random()<0.45?'ob':'orb'; else kind=Math.random()<0.65?'orb':'ob';
    items.push({time:t,lane,kind}); t += step + (Math.random()*0.2-0.1);
  } return items;
}
const STAT_KEY="fitnessAdventureStats_v2"; function loadStats(){try{return JSON.parse(localStorage.getItem(STAT_KEY)||"{}");}catch(e){return{}}}
function saveStats(s){try{localStorage.setItem(STAT_KEY,JSON.stringify(s));}catch(e){}}
function setupQuest(){
  state.questType=selectQuest ? selectQuest.value : 'collect';
  state.questProgress=0; state.surviveOK=true; state.streak=0; state.bestStreak=0;
  const diff=DIFF[(selectDiff && selectDiff.value) || 'easy'];
  if(state.questType==='collect') state.questTarget=Math.round(diff.duration/4);
  else if(state.questType==='streak') state.questTarget=Math.max(5, Math.round(8*(diff.speed-1.6))); else state.questTarget=1;
  setQuestHUD();
}
function checkQuestOnEvent(evt){
  if(evt.type==='orb') state.questProgress++;
  else if(evt.type==='obClear'){ state.streak++; state.bestStreak=Math.max(state.bestStreak,state.streak); }
  else if(evt.type==='obHit'){ state.surviveOK=false; state.streak=0; }
  setQuestHUD();
}
function isQuestCleared(){ if(state.questType==='collect') return state.questProgress>=state.questTarget; if(state.questType==='survive') return state.surviveOK; if(state.questType==='streak') return state.bestStreak>=state.questTarget; return false; }

// ----------------------------------------------------
// Scene / UI
// ----------------------------------------------------
function buildScene(){
  clearChildren(root);

  const lanePlane=document.createElement('a-entity');
  lanePlane.setAttribute('geometry','primitive: plane; width: 3.6; height: 2.0');
  lanePlane.setAttribute('material','color:#94a3b8; opacity:0.12; shader:flat');
  root.appendChild(lanePlane);

  [-1.2,0,1.2].forEach(x=>{
    const post=document.createElement('a-entity');
    post.setAttribute('geometry','primitive: box; width:0.06; height:1.6; depth:0.02');
    post.setAttribute('material','color:#94a3b8; opacity:0.35; shader:flat');
    post.setAttribute('position',`${x} 0 0.02`);
    root.appendChild(post);
  });

  const marker=document.createElement('a-entity');
  marker.setAttribute('geometry','primitive: ring; radiusInner:0.14; radiusOuter:0.20; segmentsTheta:48');
  marker.setAttribute('material','color:#0ea5e9; opacity:0.95; shader:flat');
  marker.setAttribute('position',`${[-1.2,0,1.2][state.lane]} 0 0.05`);
  marker.setAttribute('id','laneMarker');
  root.appendChild(marker);
}
function updateLaneMarker(){ const mk=$('laneMarker'); if(mk && mk.object3D) mk.object3D.position.set([ -1.2,0,1.2 ][state.lane],0,0.05); }
function setLane(i, show=true){ state.lane=Math.max(0,Math.min(2,i)); updateLaneMarker(); if(show){ SFX.ok(); feedback(['เลนซ้าย','เลนกลาง','เลนขวา'][state.lane],'#38bdf8'); } }
function attachLaneButtons(){ if(laneL) laneL.addEventListener('click',()=>setLane(0)); if(laneC) laneC.addEventListener('click',()=>setLane(1)); if(laneR) laneR.addEventListener('click',()=>setLane(2)); }

// ----------------------------------------------------
// Flow
// ----------------------------------------------------
function startGame(){
  ensureAudio();
  state.theme = (selectTheme && selectTheme.value) || 'jungle';
  startMusic(state.theme);
  swapSky(state.theme);

  const diff=DIFF[(selectDiff && selectDiff.value) || 'easy'];
  state.running=true; state.stageIndex=0; state.score=0; state.lives=3; state.lane=1; state.totalOrbs=0; state.totalObCleared=0; state.obHit=0;

  setLivesUI(state.lives); setTitle(); buildScene(); buildPool(isMobile?36:48); setupQuest(); initStage(diff);
  setHUD(`เริ่มเกมแล้ว • Stage ${state.stageIndex+1}: ${STAGES[state.stageIndex].name}\nกำลังสปอว์นไอเท็ม...`);
  loop();
}
function initStage(diff){
  const st=STAGES[state.stageIndex];
  state.duration=diff.duration; state.speed=diff.speed; state.hitWindow=diff.hit; state.elapsed=0; state.startTime=performance.now()/1000;
  state.items=makeItems(st.pattern,state.duration,diff.spawnStep); state.nextSpawnIdx=0; state.active=[];
  swapSky(state.theme);
  setTitle(); setQuestHUD();
}
function endStage(){
  state.running=false; if(state.rafId) cancelAnimationFrame(state.rafId); stopMusic();
  SFX.next(); setHUD(`จบสเตจ: ${STAGES[state.stageIndex].name}\nคะแนนรวม: ${state.score}`);
  evalBadgesAndShow(); // ป้องกันด้วย no-op ข้างล่าง
}
function gameOver(){
  state.running=false; if(state.rafId) cancelAnimationFrame(state.rafId); stopMusic();
  setHUD(`Game Over\nคะแนนรวม: ${state.score}`); setLivesUI(0);
  const restart=document.createElement('a-entity'); restart.classList.add('selectable');
  restart.setAttribute('geometry','primitive: plane; width: 1.6; height: 0.44');
  restart.setAttribute('material','color:#ffffff; opacity:0.95; shader:flat');
  restart.setAttribute('position','0 -1.0 0.09');
  const txt=document.createElement('a-entity'); txt.setAttribute('text','value:Restart ⟳; width:4; align:center; color:#0b1220'); txt.setAttribute('position','0 0 0.01');
  restart.appendChild(txt); root.appendChild(restart); restart.addEventListener('click',()=>{ SFX.next(); startGame(); });
}

// ----------------------------------------------------
// Loop (ป้องกัน parallaxRoot null)
// ----------------------------------------------------
function loop(){
  if(!state.running) return;
  const now=performance.now()/1000; state.elapsed=now-state.startTime;

  // เคลื่อน parallax ช้า ๆ (ถ้ามี)
  if (parallaxRoot && parallaxRoot.object3D){
    const t=performance.now()/1000;
    const x = Math.sin(t*0.06)*0.8;
    parallaxRoot.object3D.position.x = x;
  }

  // HUD
  const ms=performance.now(); if(ms-state.lastHudTs>state.hudInterval){
    state.lastHudTs=ms; setHUD(`สเตจ: ${STAGES[state.stageIndex].name}\nเวลา: ${Math.max(0,Math.ceil(state.duration-state.elapsed))} วิ\nคะแนน: ${state.score}\nเลน: ${["ซ้าย","กลาง","ขวา"][state.lane]}`);
  }

  // Spawn
  const lead=2.0;
  while(state.nextSpawnIdx<state.items.length){
    const it=state.items[state.nextSpawnIdx];
    if(it.time-state.elapsed<=lead){
      const p=acquire(it.kind,it.lane);
      if(p){ p.time=it.time; p.el.object3D.position.set(laneX(it.lane),0,-lead*state.speed); state.active.push(p); }
      state.nextSpawnIdx++;
    } else break;
  }

  // Move & judge
  for(const p of state.active){
    if(!p||p.judged||!p.inUse) continue;
    const dt=p.time-state.elapsed;
    p.el.object3D.position.z = dt*state.speed;

    if(Math.abs(dt)<=state.hitWindow){
      if(p.kind==='orb'){
        if(state.lane===p.lane){ state.totalOrbs++; scoreAdd(20,"เก็บพลังงาน +20","#22c55e"); SFX.orb(); checkQuestOnEvent({type:'orb'}); }
        else { feedback("พลาด Orb","#eab308"); }
      }else{
        if(state.lane===p.lane){ state.obHit++; loseLife(); SFX.hit(); checkQuestOnEvent({type:'obHit'}); }
        else { state.totalObCleared++; feedback("หลบสิ่งกีดขวางสำเร็จ","#38bdf8"); checkQuestOnEvent({type:'obClear'}); }
      }
      p.judged=true; try{ p.el.setAttribute("animation__pop","property: scale; to: 1.25 1.25 1; dur: 80; dir: alternate; easing: easeOutQuad"); }catch(e){}
      setTimeout(()=>release(p),100);
    } else if (dt<-state.hitWindow && !p.judged){
      p.judged=true; setTimeout(()=>release(p),50);
    }
  }

  if(state.elapsed>=state.duration){ endStage(); return; }
  state.rafId=requestAnimationFrame(loop);
}

// ----------------------------------------------------
// Score/Life/Feedback/Controls
// ----------------------------------------------------
function scoreAdd(n,msg="",color="#38bdf8"){ state.score+=n; if(msg) feedback(msg,color); }
function loseLife(){ state.lives-=1; setLivesUI(state.lives); feedback("ชนสิ่งกีดขวาง -1 ชีวิต","#ef4444"); if(state.lives<=0) gameOver(); }
function feedback(text,color="#38bdf8"){ const el=document.createElement("a-entity");
  el.setAttribute("text",`value:${text}; width:5.2; align:center; color:${color}`);
  el.setAttribute("position","0 0.8 0.1"); root.appendChild(el);
  el.setAttribute("animation__up","property: position; to: 0 1.0 0.1; dur: 420; easing: easeOutQuad");
  setTimeout(()=>{ if(el.parentNode) root.removeChild(el); },460);
}

// ปุ่ม UI
if (btnStart) btnStart.onclick=()=>{ if(!state.running) startGame(); };
if (btnReset) btnReset.onclick=()=>{ state.running=false; if(state.rafId) cancelAnimationFrame(state.rafId);
  clearChildren(root);
  setHUD("พร้อมเริ่ม"); setLivesUI(3); if(hudQuest) hudQuest.textContent=""; stopMusic(); };

function attachLaneButtons(){ if(laneL) laneL.addEventListener('click',()=>setLane(0)); if(laneC) laneC.addEventListener('click',()=>setLane(1)); if(laneR) laneR.addEventListener('click',()=>setLane(2)); }
attachLaneButtons();

window.addEventListener('keydown',(e)=>{ const k=e.key.toLowerCase();
  if(k==='a'||k==='arrowleft') setLane(0);
  if(k==='s'||k==='arrowup')   setLane(1);
  if(k==='d'||k==='arrowright')setLane(2);
});

// เริ่มต้น HUD
setHUD("พร้อมเริ่ม\nเลือกธีม • ปุ่ม Left/Center/Right • คีย์ ← ↑ → หรือ A/S/D");
setLivesUI(3);

// ----------------------------------------------------
// ป้องกัน error: evalBadgesAndShow ไม่มีให้ใช้งานในหน้านี้
// ----------------------------------------------------
function evalBadgesAndShow(){ /* no-op for this build */ }

// ----------------------------------------------------
// Export startGame ให้เมนูเรียกได้แน่ ๆ
// ----------------------------------------------------
window.startGame = startGame;
