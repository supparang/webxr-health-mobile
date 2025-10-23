/* games/rhythm-boxer/game.js
   Rhythm Boxer · game.js
   - 15 ฟีเจอร์เพิ่มความสนุก + ไอเดียพิเศษ (Mission / Playlist / Badge / Vibration)
   - รองรับเมาส์/ทัช/VR, ปุ่มคลิกได้จริง (mouse/touch raycast)
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const getQuery=(k)=>new URLSearchParams(location.search).get(k);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const HUB_URL = `${ASSET_BASE}/vr-fitness/`; // กลับ Hub ให้ถูก

  const APPX={ badge:(t)=>console.log('[BADGE]',t) };
  function ping(msg,color='#ffcc00'){ let el=byId('toast'); if(!el){ el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
    el.style.color=color; el.textContent=msg; el.style.opacity='1'; el.style.transform='translateX(-50%) scale(1.02)';
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(-50%) scale(1)'; }, 900);
  }
  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_){} }

  // ---------- Audio / SFX ----------
  const SFXN=(p)=>{ const a=new Audio(p); a.preload='auto'; a.onerror=()=>console.warn('SFX not found:',p); return a; };
  const SFX={
    tick:SFXN(`${ASSET_BASE}/assets/sfx/tick.wav`),
    start:SFXN(`${ASSET_BASE}/assets/sfx/success.wav`),
    finish:SFXN(`${ASSET_BASE}/assets/sfx/enrage.wav`),
    miss:SFXN(`${ASSET_BASE}/assets/sfx/miss.wav`),
    good:SFXN(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect:SFXN(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    combo:SFXN(`${ASSET_BASE}/assets/sfx/combo.wav`),
    fever:SFXN(`${ASSET_BASE}/assets/sfx/boss_roar.wav`),
    milestone:SFXN(`${ASSET_BASE}/assets/sfx/hp_hit.wav`)
  };
  function play(a){ try{ a.currentTime=0; a.play(); }catch(_e){} }

  // ---------- Lanes / Notes ----------
  // laneX positions map: [-1.0, -0.33, +0.33, +1.0]
  const LANE_X=[-1.0,-0.33,0.33,1.0];
  const NOTE_SPEED_BASE=1.25; // unit/sec towards target line
  const TAP_LIFE=7.0; // seconds to fly before pass target
  const HOLD_THICK=0.08;

  // ---------- Difficulty windows (ms) ----------
  const DIFFS = {
    easy:   { title:'EASY',   timing:180, scoreMul:0.9,  feverNeed:18 },
    normal: { title:'NORMAL', timing:120, scoreMul:1.0,  feverNeed:20 },
    hard:   { title:'HARD',   timing:80,  scoreMul:1.1,  feverNeed:22 },
    final:  { title:'FINAL',  timing:50,  scoreMul:1.2,  feverNeed:24 },
  };
  const getDiffKey=()=> getQuery('diff') || localStorage.getItem('rb_diff') || 'normal';
  let D = DIFFS.normal;

  // ---------- Songs / Beatmaps (สามเพลง) ----------
  // beat times in seconds; hold notes as {t, lane, hold:duration}
  const SONGS={
    neo:{ title:'NEO', bpm:128, music:null, map:[
      {t:1.0,lane:1},{t:1.5,lane:2},{t:2.0,lane:0},{t:2.5,lane:3},
      {t:3.0,lane:1,hold:1.0}, {t:4.4,lane:2},{t:4.8,lane:1},{t:5.2,lane:3},
      {t:6.0,lane:0},{t:6.25,lane:1},{t:6.5,lane:2},{t:6.75,lane:3},
      // cross-lane burst
      {t:8.0,lane:0},{t:8.25,lane:3},{t:8.5,lane:1},{t:8.75,lane:2},
      {t:10.0,lane:2,hold:1.2},{t:12.0,lane:1},{t:12.5,lane:2},{t:13.0,lane:3},{t:13.5,lane:0},
      {t:14.0,lane:1},{t:14.25,lane:2},{t:14.5,lane:3},{t:14.75,lane:0},
    ], len: 16 },
    rush:{ title:'RUSH', bpm:142, music:null, map:[
      {t:1.0,lane:0},{t:1.25,lane:1},{t:1.5,lane:2},{t:1.75,lane:3},
      {t:2.25,lane:3},{t:2.5,lane:2},{t:2.75,lane:1},{t:3.0,lane:0},
      {t:4.0,lane:1,hold:1.2},{t:5.6,lane:2,hold:1.0},
      {t:7.0,lane:0},{t:7.2,lane:1},{t:7.4,lane:2},{t:7.6,lane:3},{t:7.8,lane:2},{t:8.0,lane:1},
      {t:9.5,lane:3},{t:9.75,lane:0},{t:10.0,lane:2},{t:10.25,lane:1},
    ], len: 12 },
    zen:{ title:'ZEN', bpm:110, music:null, map:[
      {t:1.5,lane:2},{t:2.0,lane:1},{t:2.5,lane:2},{t:3.0,lane:1},
      {t:3.5,lane:0,hold:1.5},{t:5.4,lane:3,hold:1.0},
      {t:7.0,lane:1},{t:7.5,lane:2},{t:8.0,lane:3},{t:8.5,lane:0},
      {t:9.0,lane:2},{t:9.5,lane:1},{t:10.0,lane:2},{t:10.5,lane:3},
    ], len: 14 }
  };

  // ---------- State ----------
  let running=false, paused=false, t0=0, clock=0, songKey='neo';
  let score=0, combo=0, maxCombo=0, hits=0, total=0;
  let fever=false, feverEnd=0, feverMax=10_000; // ms
  let speedEventT=0; // next random speed event time
  let mission=null, missionDone=false;
  let activeNotes=[]; // {el,t,lane,type:'tap'|'hold','holdEnd'?}
  let spawnIdx=0;
  let countdownTimer=null;
  let accuracy=0;

  // ---------- Fever BAR ----------
  const feverBar=byId('feverBar'), feverFill=byId('feverFill');

  // ---------- Raycast click (mouse/touch) ----------
  (function pointerRaycast(){
    const sceneEl=document.querySelector('a-scene');
    if(!sceneEl) return;
    const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2();
    function pick(x,y){
      const cam=sceneEl.camera; if(!cam) return;
      mouse.x=(x/window.innerWidth)*2-1; mouse.y=-(y/window.innerHeight)*2+1;
      raycaster.setFromCamera(mouse, cam);
      const objs=[]; Array.from(document.querySelectorAll('.clickable')).forEach(el=>el.object3D?.traverse(o=>objs.push(o)));
      const hits=raycaster.intersectObjects(objs,true);
      if(hits.length){ let o=hits[0].object; while(o && !o.el) o=o.parent; o?.el?.emit('click'); }
    }
    window.addEventListener('mousedown',e=>pick(e.clientX,e.clientY),{passive:true});
    window.addEventListener('touchstart',e=>{const t=e.touches?.[0]; if(t) pick(t.clientX,t.clientY);},{passive:true});
  })();

  // ---------- UI wires ----------
  function applyDropdownsFromURL(){
    const qd=getQuery('diff'), qs=getQuery('song');
    const dSel=byId('diffSel'), sSel=byId('songSel');
    if(qd && DIFFS[qd]) dSel.value=qd;
    if(qs && SONGS[qs]) sSel.value=qs;
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    applyDropdownsFromURL();

    byId('startBtn')?.addEventListener('click', startGame);
    byId('replayBtn')?.addEventListener('click', startGame);
    byId('pauseBtn')?.addEventListener('click', togglePause);
    byId('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });

    byId('enterVRBtn')?.addEventListener('click', ()=>{ try{ document.querySelector('a-scene')?.enterVR?.(); }catch(e){ console.warn(e); } });

    byId('diffSel').addEventListener('change', (e)=>{
      const v=e.target.value; localStorage.setItem('rb_diff', v);
      const url=new URL(location.href); url.searchParams.set('diff',v); history.replaceState(null,'',url);
      ping(`Difficulty: ${DIFFS[v]?.title||'NORMAL'}`);
    });
    byId('songSel').addEventListener('change', (e)=>{
      const v=e.target.value; const url=new URL(location.href); url.searchParams.set('song',v); history.replaceState(null,'',url);
      ping(`Song: ${SONGS[v]?.title||'NEO'}`);
    });
  });

  // ---------- Gameplay Core ----------
  function reset(){
    running=false; paused=false; clock=0; t0=0;
    score=0; combo=0; maxCombo=0; hits=0; total=0; accuracy=0;
    fever=false; feverEnd=0; feverBar.style.display='none'; feverFill.style.width='0';
    spawnIdx=0; activeNotes.forEach(n=>safeRemove(n.el)); activeNotes.length=0;
    byId('score').textContent='0'; byId('combo').textContent='0'; byId('acc').textContent='0%';
    byId('phase').textContent=DIFFS[getDiffKey()]?.title||'NORMAL';
    byId('results').style.display='none';
    mission = rollMission(); missionDone=false; renderMission();
  }

  // 10) Countdown + Start SFX
  function startCountdown(cb){
    let n=3; const tick=()=>{ ping(n===0?'GO!':String(n), n===0?'#00ffa3':'#ffd166'); play(n===0?SFX.start:SFX.tick); if(n===0){ clearInterval(countdownTimer); cb(); } n--; };
    tick(); countdownTimer=setInterval(tick, 500);
  }

  // Speed events (9) ทุก ~20 วิ
  function scheduleSpeedEvent(){
    speedEventT = clock + 20_000;
  }
  let speedScale=1.0;

  function startGame(){
    reset();
    const dKey=getDiffKey(); D = DIFFS[dKey] || DIFFS.normal;
    songKey = byId('songSel').value || 'neo';
    localStorage.setItem('rb_diff', dKey);

    byId('time').textContent = Math.ceil((SONGS[songKey].len||15));

    startCountdown(()=>{
      running=true; t0=performance.now(); clock=0; scheduleSpeedEvent();
      APPX.badge('Rhythm Boxer Start');
      step();
    });
  }

  function togglePause(){
    if(!running) return; paused=!paused;
    ping(paused?'PAUSED':'RESUME', paused?'#ffd166':'#00ffa3');
  }

  // NOTE spawner (รวม cross-lane, hold)
  function spawnNext(){
    const map=SONGS[songKey].map;
    while(spawnIdx<map.length && map[spawnIdx].t <= clock/1000 + TAP_LIFE){
      const note=map[spawnIdx++];
      spawnNote(note);
    }
  }

  function spawnNote(n){
    total++;
    const lane = clamp(n.lane,0,3);
    const x=LANE_X[lane];
    const z=-2.6, y=1.4 + (TAP_LIFE * NOTE_SPEED_BASE * 0.1); // spawn สูงขึ้น
    if(n.hold){
      const el=document.createElement('a-cylinder');
      el.classList.add('clickable','note'); el.dataset.type='hold';
      el.dataset.t = String(n.t); el.dataset.end = String(n.t + n.hold);
      el.setAttribute('radius', HOLD_THICK); el.setAttribute('height', (n.hold*NOTE_SPEED_BASE).toFixed(3));
      el.setAttribute('rotation','90 0 0'); el.setAttribute('color','#ffd166');
      el.setAttribute('position',`${x} ${y} ${z}`);
      byId('arena').appendChild(el);
      activeNotes.push({el,t:n.t, lane, type:'hold', holdEnd:n.t+n.hold});
    }else{
      const el=document.createElement('a-sphere');
      el.classList.add('clickable','note'); el.dataset.type='tap';
      el.dataset.t = String(n.t);
      el.setAttribute('radius','0.13'); el.setAttribute('color','#00d0ff');
      el.setAttribute('position',`${x} ${y} ${z}`);
      byId('arena').appendChild(el);
      activeNotes.push({el,t:n.t, lane, type:'tap'});
    }
  }

  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

  // Hit judge
  function judge(deltaMs){
    const w=D.timing; // perfect window half
    const abs=Math.abs(deltaMs);
    if(abs<=w/2) return 'perfect';
    if(abs<=w) return 'good';
    return 'miss';
  }

  // Fever (1, 14/Particle ผ่าน glow scale)
  function enterFever(){
    if(fever) return;
    fever=true; feverEnd=clock + feverMax;
    feverBar.style.display='block'; play(SFX.fever); APPX.badge('FEVER!');
    navigator.vibrate?.(60); // Vibration (ไอเดียพิเศษ)
    const scn=document.querySelector('a-scene'); scn?.classList.add('shake-scene'); setTimeout(()=>scn?.classList.remove('shake-scene'), 260);
  }
  function updateFever(){
    if(!fever) return;
    const left = Math.max(0, feverEnd - clock);
    feverFill.style.width = (100 * (left/feverMax)) + '%';
    if(left<=0){ fever=false; feverBar.style.display='none'; ping('Fever End','#9bd1ff'); }
  }

  // Combo burst (4): perfect 5 ติด สร้าง shockwave ล้างโน้ตใกล้เป้า
  let perfectStreak=0;
  function tryComboBurst(){
    if(perfectStreak>=5){
      perfectStreak=0;
      play(SFX.milestone);
      APPX.badge('COMBO BURST');
      const near = activeNotes.filter(n => Math.abs((n.el?.dataset?.t*1000||0)-clock) < 350);
      near.forEach(n=>{
        scoreAdd(10,true);
        safeRemove(n.el);
        n._dead=true;
      });
    }
  }

  function scoreAdd(v, silent=false){
    const mul=(fever?2:1) * (D.scoreMul||1);
    score += Math.round(v*mul);
    byId('score').textContent=String(score);
    if(!silent && (combo>0) && (combo%10===0)){ play(SFX.combo); }
  }

  function updateAcc(){
    const acc = total>0 ? Math.round((hits/total)*100) : 0;
    accuracy = acc; byId('acc').textContent = acc+'%';
  }

  function onHit(kind){
    combo++;
    if(combo>maxCombo) maxCombo=combo;
    byId('combo').textContent=String(combo);
    if(kind==='perfect'){ perfectStreak++; tryComboBurst(); }
    else perfectStreak=0;

    if(combo>= (D.feverNeed||20)) enterFever();

    // milestone sound (12)
    if(combo===10 || combo===20 || combo===30) play(SFX.milestone);
  }
  function onMiss(){
    combo=0; perfectStreak=0;
    byId('combo').textContent='0';
    play(SFX.miss);
  }

  function handleTap(note){
    const nt = note.el?.dataset?.t ? (+note.el.dataset.t)*1000 : 0;
    const res = judge(clock - nt);
    if(res==='miss'){ onMiss(); return false; }
    onHit(res);
    play(res==='perfect'?SFX.perfect:SFX.good);
    scoreAdd(res==='perfect'?30:15);
    hits++; updateAcc();
    navigator.vibrate?.(res==='perfect'?[25,40]:20);
    return true;
  }

  // Hold: ต้องกดต้นทางในหน้าต่างเวลา และ “ปล่อย” ใกล้เวลาปลาย
  let holding=null; // {note, started:boolean}
  function handleHoldPress(note){
    if(holding) return false;
    const nt = (+note.el.dataset.t)*1000;
    const res=judge(clock-nt);
    if(res==='miss'){ onMiss(); return false; }
    holding={note, started:true};
    onHit(res); play(SFX.good); scoreAdd(10,true);
    return true;
  }
  function handleHoldRelease(){
    if(!holding) return;
    const note = holding.note; holding=null;
    const endt = (+note.el.dataset.end)*1000;
    const res=judge(clock-endt);
    if(res==='miss'){ onMiss(); return false; }
    onHit(res); play(res==='perfect'?SFX.perfect:SFX.good);
    scoreAdd(res==='perfect'?40:20);
    hits++; updateAcc();
    navigator.vibrate?.(res==='perfect'?[35,60]:30);
    return true;
  }

  // Register clicks to closest note in lane (swipe = cross-lane ทำเป็น pattern map แล้ว)
  function installClickLogic(){
    // Tap/Press
    window.addEventListener('mousedown', onPress,{passive:true});
    window.addEventListener('touchstart', e=>onPress(e.changedTouches?.[0]||e),{passive:true});
    // Release for hold
    window.addEventListener('mouseup', onRelease,{passive:true});
    window.addEventListener('touchend', onRelease,{passive:true});

    function laneFromX(clientX){
      const v = (clientX/window.innerWidth)*2-1;
      // map screen x to lane rough
      if(v<-0.5) return 0; if(v<-0.1) return 1; if(v<0.5) return 2; return 3;
    }
    function onPress(e){
      if(!running || paused) return;
      // pick nearest active note time window
      const lane = laneFromX(e.clientX||0);
      const cand = activeNotes
        .filter(n=>!n._dead && n.lane===lane)
        .sort((a,b)=> Math.abs((a.el?.dataset?.t*1000||0)-clock) - Math.abs((b.el?.dataset?.t*1000||0)-clock))[0];
      if(!cand) return;
      if(cand.type==='tap'){
        const ok=handleTap(cand);
        if(ok){ safeRemove(cand.el); cand._dead=true; }
      }else{
        handleHoldPress(cand);
      }
    }
    function onRelease(){
      if(!running || paused) return;
      if(holding){
        const ok=handleHoldRelease();
        if(ok){ safeRemove(holding?.note?.el); holding.note._dead=true; holding=null; }
      }
    }
  }
  installClickLogic();

  // ---------- Step loop ----------
  function step(){
    if(!running){ endGame(); return; }
    if(paused){ requestAnimationFrame(step); return; }

    clock = performance.now() - t0;

    // speed event (9) – เพิ่ม/ลดความเร็วโน้ตชั่วคราว
    if(clock >= speedEventT){
      speedScale = (Math.random()<0.5 ? 0.85 : 1.15);
      const tag = speedScale<1 ? 'SLOW' : 'SPEED UP';
      ping(tag, '#ffd166');
      setTimeout(()=>{ speedScale=1.0; }, 6000);
      scheduleSpeedEvent();
    }

    spawnNext();
    updateNotes();
    updateFever();

    // เวลา UI = ความยาวเพลงแบบคร่าว ๆ
    const remain = Math.max(0, Math.ceil((SONGS[songKey].len||15) - clock/1000));
    byId('time').textContent = remain;

    if(remain<=0 && activeNotes.filter(n=>!n._dead).length===0){
      running=false;
    }

    requestAnimationFrame(step);
  }

  function updateNotes(){
    const z=-2.6, targetY=1.2, startYBase=1.4;
    activeNotes.forEach(n=>{
      if(n._dead) return;
      const el=n.el; if(!el) return;
      // position toward target line
      const t=(+el.dataset.t)*1000;
      const timeLeft = t - clock; // ms
      const y = targetY + (timeLeft/1000)*NOTE_SPEED_BASE*speedScale*1.0;
      el.setAttribute('position', `${LANE_X[n.lane]} ${y.toFixed(3)} ${z}`);

      // miss check
      if(timeLeft < - (D.timing+120)){
        // missed
        onMiss();
        safeRemove(el); n._dead=true;
      }

      // hold visual length adjust as we move
      if(n.type==='hold'){
        const endt=(+el.dataset.end)*1000;
        const tail = Math.max(0.15, ((endt - clock)/1000)*NOTE_SPEED_BASE*speedScale);
        el.setAttribute('height', tail.toFixed(3));
      }
    });

    // purge dead
    activeNotes = activeNotes.filter(n=>!n._dead);
  }

  // ---------- Mission (ไอเดียพิเศษ) ----------
  function rollMission(){
    const list=[
      {id:'combo50', label:'Reach Combo 50', check:()=>maxCombo>=50},
      {id:'acc90',   label:'Accuracy ≥ 90%', check:()=>accuracy>=90},
      {id:'no5miss', label:'Miss ≤ 5 notes',  check:()=> (total-hits)<=5},
    ];
    return list[Math.floor(Math.random()*list.length)];
  }
  function renderMission(){
    byId('mission').textContent = 'Mission: ' + (mission?.label || '—');
  }

  // ---------- End & Result (15 ดาว, 13 finish sfx, leaderboard) ----------
  function endGame(){
    // สรุปผล
    const stars = (accuracy>90?3:(accuracy>70?2:(accuracy>50?1:0)));
    const rStars=byId('rStars'); rStars.textContent='★'.repeat(stars)+'☆'.repeat(3-stars);
    byId('rScore').textContent = String(score);
    byId('rMaxCombo').textContent = String(maxCombo);
    byId('rAcc').textContent = accuracy+'%';
    byId('rDiff').textContent = D.title || 'NORMAL';
    byId('rSong').textContent = SONGS[songKey]?.title || 'NEO';
    missionDone = mission?.check?.() || false;
    byId('rMission').textContent = missionDone? 'Completed' : 'Failed';

    play(SFX.finish);

    // Post leaderboard (หากมีระบบ)
    try{
      window.Leaderboard?.postResult?.('rhythm-boxer', {
        score, accuracy, combo:maxCombo, stars, diff:getDiffKey(), song:songKey, mission:mission?.id||''
      });
    }catch(_){}

    // Badge / Rank (ไอเดียพิเศษ)
    if(stars===3) APPX.badge('Rank S — Outstanding!');
    else if(stars===2) APPX.badge('Rank A — Great!');
    else if(stars===1) APPX.badge('Rank B — Good!');
    else APPX.badge('Rank C — Try Again!');

    byId('results').style.display='flex';
  }

  // ---------- Keyboard helpers ----------
  document.addEventListener('keydown', (e)=>{
    if(e.key==='p' || e.key==='P') togglePause();
  });

  // ---------- Init ----------
  // ปรับตำแหน่งปุ่ม Enter VR ให้อยู่กลางล่าง (ใส่ใน index แล้ว)
  // ติดตั้ง vibration / iOS unlock
  (function unlockAudio(){
    let ctx = (window.AudioContext||window.webkitAudioContext)? new (window.AudioContext||window.webkitAudioContext)() : null;
    function resume(){ try{ ctx?.resume?.(); }catch(_){} }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev,resume,{once:true,passive:true}));
  })();

})();
