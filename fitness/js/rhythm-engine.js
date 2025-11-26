// === fitness/js/rhythm-engine.js — Rhythm Boxer (Hit FX at note position, 2025-11-30) ===
'use strict';

(function(){

  // ===== CONFIG =====
  const LANES = [0, 1, 2, 3, 4]; // L2, L1, C, R1, R2
  const NOTE_EMOJI_BY_LANE = ['🎵', '🎶', '🎵', '🎶', '🎼'];
  const HIT_WINDOWS = { perfect: 0.06, great: 0.12, good: 0.20 };
  const PRE_SPAWN_SEC = 2.0;

  const TRACKS = [
    {
      id: 't1',
      name: 'Warm-up Groove (ง่าย)',
      audio: 'audio/warmup-groove.mp3',
      duration: 32,
      bpm: 100,
      diff: 'easy',
      chart: makeWarmupChart(100, 32)
    },
  ];

  // ===== UTIL =====
  function clamp(v,a,b){return v<a?a:(v>b?b:v);}
  function $(id){return document.getElementById(id);}

  function makeWarmupChart(bpm,dur){
    const out=[],beat=60/bpm;let t=2.0;
    const seq=[2,1,3,2,1,3,2,3];
    const total=Math.floor((dur-3)/beat);
    let i=0;
    while(t<dur-2 && i<total){
      out.push({time:t,lane:seq[i%seq.length],type:'note'});
      t+=beat;i++;
    }
    // ตัวอย่าง event เสริม (hp/shield) ถ้าจะใช้ต่อ
    // out.push({time:t+beat*0.5,lane:0,type:'hp'});
    // out.push({time:t+beat*1.5,lane:4,type:'shield'});
    return out;
  }

  // ===== STATE =====
  let lanesEl,elField,hitLineEl,hudScore,hudCombo,hudAcc,hudHp,hudShield,hudTime,feedbackEl,flashEl;
  let score=0,combo=0,hp=100,shield=0;
  let started=false,running=false,startPerf=0,lastPerf=0,currentSongTime=0;
  let activeNotes=[],chartIndex=0,currentTrack=TRACKS[0];

  // ===== INIT =====
  function init(){
    lanesEl   = $('rb-lanes');
    elField   = $('rb-field');
    hitLineEl = document.querySelector('.rb-hit-line');

    hudScore  = $('rb-hud-score');
    hudCombo  = $('rb-hud-combo');
    hudAcc    = $('rb-hud-acc');
    hudHp     = $('rb-hud-hp');
    hudShield = $('rb-hud-shield');
    hudTime   = $('rb-hud-time');

    feedbackEl = $('rb-feedback');
    flashEl    = $('rb-flash');

    const btn = $('rb-btn-start');
    if(btn) btn.addEventListener('click',startGame);

    if(lanesEl) lanesEl.addEventListener('pointerdown',onLaneTap);
  }

  // ===== GAME FLOW =====
  function startGame(){
    started=false;
    running=false;

    score=0;
    combo=0;
    hp=100;
    shield=0;
    activeNotes=[];
    chartIndex=0;
    currentTrack = TRACKS[0]; // ตอนนี้ใช้เพลง t1 อย่างเดียว

    showFeedback('แตะ lane เพื่อเริ่มเพลง 🎵');
    $('rb-view-menu')?.classList.add('hidden');
    $('rb-view-play')?.classList.remove('hidden');

    updateHUD();
  }

  function handleFirstTap(){
    if(started) return;
    started=true;
    running=true;
    startPerf=performance.now();
    lastPerf=startPerf;
    currentSongTime=0;
    requestAnimationFrame(loop);
  }

  function loop(now){
    if(!running) return;
    const dt=(now-lastPerf)/1000;
    lastPerf=now;
    currentSongTime += dt;

    const dur=currentTrack.duration||30;
    updateTimeline(currentSongTime,dt);
    updateHUD();

    if(currentSongTime>=dur){
      running=false;
      showFeedback('เพลงจบแล้ว! ✅');
      return;
    }
    requestAnimationFrame(loop);
  }

  function updateTimeline(songTime,dt){
    spawnNotes(songTime);
    updateNotePositions(songTime);
    autoJudgeMiss(songTime);

    // ทำให้เส้นจังหวะมี life นิดหน่อย
    if(hitLineEl){
      const phase=(songTime*(currentTrack.bpm||100)/60)%1;
      hitLineEl.style.opacity = phase<0.15 ? 1 : 0.6;
    }
  }

  // ===== NOTES SPAWN & MOTION =====
  function spawnNotes(songTime){
    const chart=currentTrack.chart;
    const pre=PRE_SPAWN_SEC;
    while(chartIndex<chart.length && chart[chartIndex].time<=songTime+pre){
      createNote(chart[chartIndex]);
      chartIndex++;
    }
  }

  function createNote(info){
    const laneIndex=clamp(info.lane|0,0,4);
    const laneEl = lanesEl?.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);
    if(!laneEl) return;

    const noteEl=document.createElement('div');
    noteEl.className='rb-note';
    const inner=document.createElement('div');
    inner.className='rb-note-inner';
    inner.textContent=NOTE_EMOJI_BY_LANE[laneIndex]||'🎵';
    noteEl.appendChild(inner);
    laneEl.appendChild(noteEl);

    // ค่อย ๆ fade-in ตอนเกิด
    setTimeout(()=>noteEl.classList.add('rb-note-spawned'),20);

    activeNotes.push({
      lane: laneIndex,
      time: info.time,
      el: noteEl,
      judged:false,
      removed:false
    });
  }

  // ให้โน้ตตกจากด้านบนลงมาเส้นตี
  function updateNotePositions(songTime){
    if(!lanesEl) return;
    const rect=lanesEl.getBoundingClientRect();
    const h=rect.height||1;
    const pre=PRE_SPAWN_SEC;
    const travel=h*0.85;

    for(const n of activeNotes){
      if(!n.el || n.removed) continue;
      const dt=n.time - songTime;
      const progress = 1 - (dt/pre);           // 0 → 1 ก่อนเวลาถึงเส้น
      const pClamp   = clamp(progress,0,1.2);  // เกิน 1 นิดหน่อยแล้วค่อยจางหาย
      const y=(pClamp-1)*travel;              // 0 ที่เส้นตี, ลบขึ้นบน

      n.el.style.transform = `translateX(-50%) translateY(${y}px)`;
      n.el.style.opacity   = (pClamp<=1.0) ? 1 : clamp(1.2-pClamp,0,1);
    }
  }

  function autoJudgeMiss(songTime){
    const missWindow = HIT_WINDOWS.good + 0.05;
    for(const n of activeNotes){
      if(n.judged) continue;
      if(songTime > n.time + missWindow){
        applyMiss(n);
      }
    }
    activeNotes = activeNotes.filter(n=>!n.removed);
  }

  // ===== INPUT =====
  function onLaneTap(ev){
    if(!running){
      handleFirstTap();
      return;
    }
    const laneEl = ev.target.closest('.rb-lane');
    if(!laneEl) return;
    const lane = parseInt(laneEl.dataset.lane||'0',10);

    // หาโน้ตที่ใกล้ที่สุดใน lane นี้
    let best=null;
    let bestAbs=Infinity;
    const nowT=currentSongTime;
    for(const n of activeNotes){
      if(n.judged || n.removed) continue;
      if(n.lane!==lane) continue;
      const off = nowT - n.time;
      const abs = Math.abs(off);
      if(abs < bestAbs && abs <= HIT_WINDOWS.good+0.05){
        best = n;
        bestAbs = abs;
      }
    }

    if(best){
      applyHit(best, nowT - best.time);
    }else{
      showFeedback('ลองแตะให้ใกล้เส้นด้านล่างมากขึ้นนะ 🎧');
    }
  }

  // ===== POPUP FX (คะแนนเด้งตรงเป้า) =====
  function spawnScorePopup(note, grade, scoreDelta){
    if(!elField) return;

    const fieldRect = elField.getBoundingClientRect();
    let cx = fieldRect.left + fieldRect.width/2;
    let cy = fieldRect.top  + fieldRect.height*0.6;

    // ถ้า note ยังมี DOM ใช้จุดกลางของโน้ตเป็นตำแหน่งเอฟเฟกต์
    if(note && note.el){
      const nr = note.el.getBoundingClientRect();
      cx = nr.left + nr.width/2;
      cy = nr.top  + nr.height/2;
    }else if(lanesEl && note){
      const laneEl = lanesEl.querySelector(`.rb-lane[data-lane="${note.lane}"]`);
      if(laneEl){
        const lr = laneEl.getBoundingClientRect();
        cx = lr.left + lr.width/2;
        // แถว ๆ เส้นตี (ใกล้ด้านล่างเลน)
        cy = lr.bottom - 40;
      }
    }

    const x = cx - fieldRect.left;
    const y = cy - fieldRect.top - 10; // ยกขึ้นนิดนึง

    const pop = document.createElement('div');
    pop.className = 'rb-score-popup';

    if(grade === 'perfect') pop.classList.add('rb-score-perfect');
    else if(grade === 'great') pop.classList.add('rb-score-great');
    else if(grade === 'good')  pop.classList.add('rb-score-good');
    else if(grade === 'miss')  pop.classList.add('rb-score-miss');

    let label = '';
    if(grade === 'perfect') label = `PERFECT +${scoreDelta}`;
    else if(grade === 'great') label = `GREAT +${scoreDelta}`;
    else if(grade === 'good')  label = `GOOD +${scoreDelta}`;
    else if(grade === 'miss')  label = `MISS`;
    else label = `+${scoreDelta}`;

    pop.textContent = label;

    pop.style.position = 'absolute';
    pop.style.left = x + 'px';
    pop.style.top  = y + 'px';
    pop.style.bottom = 'auto'; // override ค่า default ถ้ามี

    elField.appendChild(pop);
    setTimeout(()=>{ pop.remove(); }, 700);
  }

  // ===== HIT / MISS =====
  function applyHit(n, offset){
    // ให้ popup ใช้ตำแหน่ง note ก่อนลบ
    const scoreDelta = 100;
    spawnScorePopup(n, 'perfect', scoreDelta);

    n.judged=true;
    n.removed=true;
    if(n.el) n.el.remove();

    score += scoreDelta;
    combo++;

    showFeedback('Perfect! 🎯');
    updateHUD();
  }

  function applyMiss(n){
    // popup MISS ก่อนลบ
    spawnScorePopup(n, 'miss', 0);

    n.judged=true;
    n.removed=true;
    if(n.el) n.el.remove();

    combo = 0;
    hp = clamp(hp-5,0,100);
    showFeedback('พลาดจังหวะ! 🎧');
    updateHUD();
  }

  // ===== HUD =====
  function updateHUD(){
    if(hudScore)  hudScore.textContent = score;
    if(hudCombo)  hudCombo.textContent = combo;

    // ยังไม่มีคำนวณ accuracy จริงจัง ใช้ placeholder ไว้ก่อน
    if(hudAcc)    hudAcc.textContent   = '0.0%';

    if(hudHp)     hudHp.textContent    = hp;
    if(hudShield) hudShield.textContent= shield;
    if(hudTime)   hudTime.textContent  = currentSongTime.toFixed(1);
  }

  function showFeedback(msg){
    if(!feedbackEl) return;
    feedbackEl.classList.remove('perfect','good','miss','bomb');
    feedbackEl.textContent = msg;
  }

  // ===== BOOT =====
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',init);
  else
    init();

})();
