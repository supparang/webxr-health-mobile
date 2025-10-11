
(()=>{
  const $ = (id)=>document.getElementById(id);
  const root = $("root"), sky=$("sky"), parallaxRoot=$("parallaxRoot"), parallax=$("parallax");
  const hudText=$("hudText"), hudTitle=$("hudTitle"), hudLives=$("hudLives"), hudQuest=$("hudQuest");
  const btnStart=$("btnStart"), btnReset=$("btnReset");
  const selectDiff=$("difficulty"), selectTheme=$("theme"), selectQuest=$("quest");
  const laneL=$("laneL"), laneC=$("laneC"), laneR=$("laneR");
  const isMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  let audioCtx=null, musicGain=null, sfxGain=null, musicTimer=0, musicRunning=false;
  function ensureAudio(){ if(audioCtx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    audioCtx=new AC(); musicGain=audioCtx.createGain(); musicGain.gain.value=0.08; musicGain.connect(audioCtx.destination);
    sfxGain=audioCtx.createGain(); sfxGain.gain.value=0.18; sfxGain.connect(audioCtx.destination); }
  ["pointerdown","touchend","keydown","click"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));
  function tone(freq=440,dur=0.08,type='sine',gain=0.16){ if(!audioCtx) return; const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=type; o.frequency.value=freq; o.connect(g); g.connect(sfxGain); const t=audioCtx.currentTime;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+0.01); g.gain.linearRampToValueAtTime(0,t+dur); o.start(t); o.stop(t+dur+0.02); }
  const SFX={ orb:()=>tone(660,0.07,'triangle',0.20), hit:()=>tone(180,0.1,'sawtooth',0.24), ok:()=>tone(520,0.07,'sine',0.18), next:()=>tone(740,0.1,'square',0.2) };
  function startMusic(theme){ if(!audioCtx) return; stopMusic(); musicRunning=true;
    const scale=theme==='jungle'?[220,277,330,392]:theme==='city'?[240,300,360,420]:[200,252,300,400];
    const wave=theme==='jungle'?'triangle':theme==='city'?'sine':'square'; const bpm=102, beat=60/bpm;
    function step(){ if(!musicRunning) return; const baseT=audioCtx.currentTime;
      for(let i=0;i<8;i++){ const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type=wave;
        const f=scale[(i+musicTimer)%scale.length]*(theme==='space'&&i%4===0?0.5:1);
        o.frequency.value=f; o.connect(g); g.connect(musicGain); const t=baseT+i*(beat/2);
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.08,t+0.01); g.gain.linearRampToValueAtTime(0,t+beat/2-0.02);
        o.start(t); o.stop(t+beat/2); } musicTimer++; setTimeout(step, beat*1000*4); } step(); }
  function stopMusic(){ musicRunning=false; }
  const THEME_VIS={ jungle:{sky:'#bg-jungle',parallax:'#px-jungle'}, city:{sky:'#bg-city',parallax:'#px-city'}, space:{sky:'#bg-space',parallax:'#px-space'} };
  function swapSky(theme){ const vis=THEME_VIS[theme]||THEME_VIS.jungle;
    try{ sky.setAttribute('material', `src: ${vis.sky}; color: #fff`);}catch(e){} try{ parallax.setAttribute('material', `shader:flat; transparent:true; src:${vis.parallax}; opacity:0.9`);}catch(e){} }
  const DIFF={ easy:{speed:1.8,hit:0.42,duration:40,spawnStep:0.95}, normal:{speed:2.3,hit:0.36,duration:52,spawnStep:0.85}, hard:{speed:2.7,hit:0.30,duration:58,spawnStep:0.75} };
  const STAGES=[ {name:"Warm-up Run",pattern:"mixed"}, {name:"Energy Boost",pattern:"orbs"}, {name:"Obstacle Alley",pattern:"obstacles"}, {name:"Sprint Finish",pattern:"dense"} ];
  const state={ running:false,stageIndex:0,score:0,lives:3,lane:1,elapsed:0,startTime:0,duration:45,speed:2.0,hitWindow:0.36,rafId:0,items:[],nextSpawnIdx:0,pool:[],active:[],
    lastHudTs:0,hudInterval:isMobile?250:120,theme:'jungle',questType:'collect',questTarget:12,questProgress:0,surviveOK:true,streak:0,bestStreak:0,totalOrbs:0,totalObCleared:0,obHit:0,densityMul:1.0,combo:0,accHit:0,accAll:0,
    fever:false,feverEnd:0 };
  function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); } function laneX(i){ return [-1.2,0,1.2][i]; }
  function setLivesUI(n){ hudLives.textContent="❤️".repeat(Math.max(0,n)); } function setTitle(){ hudTitle.textContent=`Stage ${state.stageIndex+1}/${STAGES.length} — ${STAGES[state.stageIndex].name}`; }
  function setHUD(m){ hudText.textContent=m; }
  function feedback(text,color="#38bdf8"){ const el=document.createElement("a-entity"); el.setAttribute("text",`value:${text}; width:5.2; align:center; color:${color}`);
    el.setAttribute("position","0 0.82 0.1"); root.appendChild(el); el.setAttribute("animation__up","property: position; to: 0 1.02 0.1; dur: 420; easing: easeOutQuad"); setTimeout(()=>{el.parentNode&&root.removeChild(el);},460); }
  function buildScene(){ clearChildren(root); const plane=document.createElement('a-entity');
    plane.setAttribute('geometry','primitive: plane; width: 3.6; height: 2.0'); plane.setAttribute('material','color:#94a3b8; opacity:0.12; shader:flat'); root.appendChild(plane);
    [-1.2,0,1.2].forEach(x=>{ const post=document.createElement('a-entity'); post.setAttribute('geometry','primitive: box; width:0.06; height:1.6; depth:0.02');
      post.setAttribute('material','color:#94a3b8; opacity:0.35; shader:flat'); post.setAttribute('position',`${x} 0 0.02`); root.appendChild(post); });
    const marker=document.createElement('a-entity'); marker.setAttribute('geometry','primitive: ring; radiusInner:0.14; radiusOuter:0.20; segmentsTheta:48');
    marker.setAttribute('material','color:#0ea5e9; opacity:0.95; shader:flat'); marker.setAttribute('position',`${[-1.2,0,1.2][state.lane]} 0 0.05`); marker.setAttribute('id','laneMarker'); root.appendChild(marker); }
  function updateLaneMarker(){ const mk=document.getElementById('laneMarker'); if(mk) mk.object3D.position.set([-1.2,0,1.2][state.lane],0,0.05); }
  function setLane(i,show=true){ state.lane=Math.max(0,Math.min(2,i)); updateLaneMarker(); if(show){ state.combo=0; feedback(['เลนซ้าย','เลนกลาง','เลนขวา'][state.lane],'#38bdf8'); } }
  function attachLaneButtons(){ laneL?.addEventListener('click',()=>setLane(0)); laneC?.addEventListener('click',()=>setLane(1)); laneR?.addEventListener('click',()=>setLane(2)); }
  function setQuestHUD(){ const t=state.questType; let txt=""; if(t==='collect') txt=`เควส: เก็บ Orb ให้ครบ ${state.questTarget} (ตอนนี้ ${state.questProgress})`;
    else if(t==='survive') txt=`เควส: เอาตัวรอดโดยไม่เสียชีวิต (สถานะ: ${state.surviveOK?'✅':'❌'})`; else if(t==='streak') txt=`เควส: หลบต่อเนื่อง ${state.questTarget} ครั้ง (สถิติ ${state.bestStreak})`; hudQuest.textContent=txt; }
  function setupQuest(){ state.questType=selectQuest.value; state.questProgress=0; state.surviveOK=true; state.streak=0; state.bestStreak=0;
    const diff=DIFF[selectDiff.value||'easy']; if(state.questType==='collect') state.questTarget=Math.round(diff.duration/3.5);
    else if(state.questType==='streak') state.questTarget=Math.max(6,Math.round(9*(diff.speed-1.6))); else state.questTarget=1; setQuestHUD(); }
  function checkQuestOnEvent(evt){ if(evt.type==='orb') state.questProgress++; else if(evt.type==='obClear'){ state.streak++; state.bestStreak=Math.max(state.bestStreak,state.streak); }
    else if(evt.type==='obHit'){ state.surviveOK=false; state.streak=0; } setQuestHUD(); }
  function buildPool(size=64){ state.pool=[]; for(let i=0;i<size;i++){ const node=document.createElement('a-entity'); node.setAttribute('visible','false');
    const body=document.createElement('a-entity'); node.appendChild(body); node.__body=body; root.appendChild(node); state.pool.push({el:node,inUse:false,kind:null,lane:1,time:0,judged:false}); } }
  function acquire(kind,lane){ for(const p of state.pool){ if(!p.inUse){ p.inUse=true; p.kind=kind; p.lane=lane; p.judged=false; p.el.setAttribute('visible','true'); const body=p.el.__body;
      if(kind==='orb'){ body.setAttribute('geometry','primitive: sphere; radius:0.16'); body.setAttribute('material','color:#22c55e; opacity:0.98; shader:flat'); }
      else{ body.setAttribute('geometry','primitive: box; width:0.7; height:0.5; depth:0.3'); body.setAttribute('material','color:#ef4444; opacity:0.95; shader:flat'); } return p; }} return null; }
  function release(p){ if(!p) return; p.inUse=false; p.el.setAttribute('visible','false'); p.el.object3D.position.set(laneX(p.lane),0,-10); }
  function makeItems(pattern,duration,step){ const items=[]; let t=1.1; const lanes=[0,1,2]; const baseDense={mixed:0.64,orbs:0.56,obstacles:0.52,dense:0.78}[pattern]||0.6;
    while(t<duration){ const dense=baseDense*state.densityMul; const lane=lanes[Math.floor(Math.random()*3)]; let kind='orb';
      if(pattern==='orbs') kind='orb'; else if(pattern==='obstacles') kind='ob'; else if(pattern==='dense') kind=Math.random()<0.45?'ob':'orb'; else kind=Math.random()<0.62?'orb':'ob';
      if(Math.random()<dense){ items.push({time:t,lane,kind}); } if(Math.random()<0.22*dense){ const b=1+Math.floor(Math.random()*2);
        for(let i=0;i<b;i++){ const ln=lanes[Math.floor(Math.random()*3)]; const k2=Math.random()<0.7?'orb':'ob'; const dt=(Math.random()*0.32)+0.12; const tt=t+dt; if(tt<duration) items.push({time:tt,lane:ln,kind:k2}); } }
      t += step + (Math.random()*0.22-0.08); } return items.slice(0, Math.min(items.length, Math.ceil(duration*50))); }
  function adaptOnJudgement(perfect){ state.accAll++; if(perfect) state.accHit++; const acc=state.accAll?(state.accHit/state.accAll):0;
    const comboBoost=Math.min(0.45, Math.floor(state.combo/10)*0.06); const accBoost=Math.min(0.35, Math.max(0,(acc-0.7))*0.7); state.densityMul=1.0+comboBoost+accBoost; }
  function initStage(diff){ const st=STAGES[state.stageIndex]; state.duration=diff.duration; state.speed=diff.speed; state.hitWindow=diff.hit; state.elapsed=0; state.startTime=performance.now()/1000;
    state.densityMul=(selectDiff.value==='hard')?1.25:(selectDiff.value==='normal'?1.10:1.0); state.items=makeItems(st.pattern,state.duration,diff.spawnStep); state.nextSpawnIdx=0; state.active=[];
    swapSky(selectTheme.value); setTitle(); setQuestHUD(); }
  function startGame(){ ensureAudio(); startMusic(selectTheme.value);
    const diff=DIFF[selectDiff.value||'easy']; state.running=true; state.stageIndex=0; state.score=0; state.lives=3; state.lane=1; state.totalOrbs=0; state.totalObCleared=0; state.obHit=0; state.combo=0; state.accHit=0; state.accAll=0;
    setLivesUI(state.lives); setTitle(); buildScene(); buildPool(isMobile?56:72); setupQuest(); initStage(diff);
    setHUD(`เริ่มเกมแล้ว • Stage ${state.stageIndex+1}: ${STAGES[state.stageIndex].name}\nเก็บ Orb — หลบสิ่งกีดขวาง`); loop(); }
  function endStage(){ state.running=false; if(state.rafId) cancelAnimationFrame(state.rafId); stopMusic();
    try{ DuoProfile?.recordSession?.({ game:'adventure', score: state.score, combo: state.combo,
      acc: state.accAll? (state.accHit/state.accAll) : 0, orbs: state.totalOrbs, dodges: state.totalObCleared, fever: 0, quest: state.questType }); }catch(e){}
    const next=document.createElement('a-entity'); next.classList.add('selectable'); next.setAttribute('geometry','primitive: plane; width: 1.2; height: 0.36');
    next.setAttribute('material','color:#ffffff; opacity:0.95; shader:flat'); next.setAttribute('position','0 -1.0 0.09');
    const txt=document.createElement('a-entity'); txt.setAttribute('text','value:Next ▶; width:4; align:center; color:#0b1220'); txt.setAttribute('position','0 0 0.01');
    next.appendChild(txt); root.appendChild(next); next.addEventListener('click',()=>{ const diff=DIFF[selectDiff.value||'easy'];
      state.stageIndex=(state.stageIndex+1)%STAGES.length; buildScene(); initStage(diff); state.running=true; loop(); next.remove(); }); }
  function gameOver(){ state.running=false; if(state.rafId) cancelAnimationFrame(state.rafId); stopMusic();
    try{ DuoProfile?.recordSession?.({ game:'adventure', score: state.score, combo: state.combo,
      acc: state.accAll? (state.accHit/state.accAll) : 0, orbs: state.totalOrbs, dodges: state.totalObCleared, fever: 0, quest: state.questType }); }catch(e){}
    setHUD(`Game Over\nคะแนนรวม: ${state.score}`); setLivesUI(0);
    const restart=document.createElement('a-entity'); restart.classList.add('selectable'); restart.setAttribute('geometry','primitive: plane; width: 1.6; height: 0.44');
    restart.setAttribute('material','color:#ffffff; opacity:0.95; shader:flat'); restart.setAttribute('position','0 -1.0 0.09');
    const txt=document.createElement('a-entity'); txt.setAttribute('text','value:Restart ⟳; width:4; align:center; color:#0b1220'); txt.setAttribute('position','0 0 0.01');
    restart.appendChild(txt); root.appendChild(restart); restart.addEventListener('click',()=>{ startGame(); }); }
  function loop(){ if(!state.running) return; const now=performance.now()/1000; state.elapsed=now-state.startTime;
    try{ parallaxRoot.object3D.position.x=Math.sin(now*0.06)*0.8; }catch(e){}
    const ms=performance.now(); if(ms-state.lastHudTs>state.hudInterval){ state.lastHudTs=ms; setHUD(`สเตจ: ${STAGES[state.stageIndex].name} • เวลา: ${Math.max(0,Math.ceil(state.duration-state.elapsed))} วิ • คะแนน: ${state.score} • เลน: ${["ซ้าย","กลาง","ขวา"][state.lane]}`); }
    const lead=1.9; while(state.nextSpawnIdx<state.items.length){ const it=state.items[state.nextSpawnIdx];
      if(it.time-state.elapsed<=lead){ const p=acquire(it.kind,it.lane); if(p){ p.time=it.time; p.el.object3D.position.set(laneX(it.lane),0,-lead*state.speed); state.active.push(p); } state.nextSpawnIdx++; } else break; }
    for(const p of state.active){ if(!p||p.judged||!p.inUse) continue; const dt=p.time-state.elapsed; p.el.object3D.position.z=dt*state.speed;
      if(Math.abs(dt)<=state.hitWindow){ if(p.kind==='orb'){ if(state.lane===p.lane){ state.totalOrbs++; state.score+=20; state.combo++; feedback("เก็บพลังงาน +20","#22c55e"); checkQuestOnEvent({type:'orb'}); } else { feedback("พลาด Orb","#eab308"); state.combo=0; } }
        else { if(state.lane===p.lane){ state.obHit++; state.lives-=1; setLivesUI(state.lives); feedback("ชนสิ่งกีดขวาง -1 ชีวิต","#ef4444"); checkQuestOnEvent({type:'obHit'}); state.combo=0; if(state.lives<=0){ gameOver(); return; } }
          else { state.totalObCleared++; state.score+=10; state.combo++; feedback("หลบสำเร็จ +10","#38bdf8"); checkQuestOnEvent({type:'obClear'}); } }
        p.judged=true; try{ p.el.setAttribute("animation__pop","property: scale; to: 1.22 1.22 1; dur: 80; dir: alternate; easing: easeOutQuad"); }catch(e){} setTimeout(()=>release(p),100);
      } else if (dt<-state.hitWindow && !p.judged){ p.judged=true; setTimeout(()=>release(p),60); } }
    if(state.elapsed>=state.duration){ endStage(); return; } state.rafId=requestAnimationFrame(loop); }
  function bindInputs(){ laneL?.addEventListener('click',()=>setLane(0)); laneC?.addEventListener('click',()=>setLane(1)); laneR?.addEventListener('click',()=>setLane(2));
    window.addEventListener('keydown',(e)=>{ const k=e.key.toLowerCase(); if(k==='a'||k==='arrowleft') setLane(0); if(k==='s'||k==='arrowup') setLane(1); if(k==='d'||k==='arrowright') setLane(2); });
    btnStart.onclick=()=>{ if(!state.running) startGame(); }; btnReset.onclick=()=>{ state.running=false; if(state.rafId) cancelAnimationFrame(state.rafId); clearChildren(root); setHUD("พร้อมเริ่ม"); setLivesUI(3); hudQuest.textContent=""; stopMusic(); };
    [selectDiff,selectTheme,selectQuest].forEach(sel=> sel?.addEventListener('change',()=> setQuestHUD())); }
  (function boot(){ setHUD("พร้อมเริ่ม\nเลือกธีม • ปุ่ม Left/Center/Right • คีย์ ← ↑ → หรือ A/S/D"); setLivesUI(3); bindInputs(); })();
  window.startGame = startGame;
})();
