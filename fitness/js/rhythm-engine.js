// === Rhythm Boxer Engine — rhythm-engine.js (2025-11-20) ===

export function initRhythmBoxer() {
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  const views = {
    menu: $('#view-menu'),
    research: $('#view-research-form'),
    play: $('#view-play'),
    result: $('#view-result'),
  };

  const stat = {
    mode:  $('#stat-mode'),
    diff:  $('#stat-diff'),
    score: $('#stat-score'),
    combo: $('#stat-combo'),
    perfect: $('#stat-perfect'),
    miss: $('#stat-miss'),
    time: $('#stat-time'),
  };

  const res = {
    mode:   $('#res-mode'),
    diff:   $('#res-diff'),
    reason: $('#res-endreason'),
    score:  $('#res-score'),
    maxcombo: $('#res-maxcombo'),
    miss:   $('#res-miss'),
    acc:    $('#res-accuracy'),
    totalHits: $('#res-totalhits'),
    rtNormal:  $('#res-rt-normal'),
    rtOffset:  $('#res-rt-decoy'),
    pid:       $('#res-participant'),
  };

  const grooveFill   = $('#groove-fill');
  const grooveStatus = $('#groove-status');
  const trackFill    = $('#track-fill');
  const trackName    = $('#track-name');
  const targetLayer  = $('#target-layer');

  const sfxHit  = $('#sfx-hit');
  const sfxBeat = $('#sfx-beat');

  let game = null;

  function show(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
  }

  // ---------- GAME CORE ----------

  function createGame(config) {
    const difficulty = config.difficulty || 'normal';
    const mode       = config.mode || 'normal';

    // BPM & beat window ตาม diff
    const bpm = (difficulty==='easy'? 80 : difficulty==='hard'? 130 : 104);
    const beatInterval = 60000/bpm;
    const durationMs   = 60000;  // 60 sec

    const pattern = [];
    for(let t=0; t<durationMs; t+=beatInterval){
      pattern.push(t);
    }

    const state = {
      running: false,
      startTime: 0,
      lastTimeLeft: 60,
      idx: 0,
      score:0,
      combo:0,
      maxCombo:0,
      perfect:0,
      miss:0,
      totalHits:0,
      offsets:[],
    };

    function updateHUD() {
      stat.mode.textContent    = mode==='research' ? 'Research' : 'Normal';
      stat.diff.textContent    = difficulty;
      stat.score.textContent   = state.score;
      stat.combo.textContent   = state.combo;
      stat.perfect.textContent = state.perfect;
      stat.miss.textContent    = state.miss;
      stat.time.textContent    = state.lastTimeLeft.toFixed(1);
    }

    function updateGroove() {
      const w = Math.min(100, state.combo * 2);
      grooveFill.style.width = w + '%';
      if (state.combo >= 10) grooveStatus.textContent = 'GREAT!';
      else if (state.combo >= 5) grooveStatus.textContent = 'ON BEAT';
      else grooveStatus.textContent = 'WARM UP';
    }

    function updateTrackProgress(progress) {
      trackFill.style.width = (progress*100).toFixed(1)+'%';
      if (progress >= 0.99) trackName.textContent = 'Track — ENDING';
    }

    function spawnTarget(beatTimeMs) {
      const hostRect = targetLayer.getBoundingClientRect();
      const x = (0.25 + Math.random()*0.5) * hostRect.width;
      const y = (0.25 + Math.random()*0.5) * hostRect.height;

      const el = document.createElement('div');
      el.className = 'rb-target';
      el.textContent = '🥊';
      el.style.left = x+'px';
      el.style.top  = y+'px';

      const target = {
        el,
        beatTimeMs,
        hit: false,
      };

      el.addEventListener('pointerdown',(ev)=>{
        ev.preventDefault();
        if(!state.running || target.hit) return;
        target.hit = true;
        handleHit(target);
      }, {passive:false});

      targetLayer.appendChild(el);

      // auto miss ถ้าไม่แตะภายใน window
      const missWindow = (difficulty==='easy'? 200 : difficulty==='hard'? 120 : 150);
      setTimeout(()=>{
        if (!target.hit && state.running) {
          handleMiss(target);
        }
      }, missWindow+40);
    }

    function handleHit(target) {
      const nowMs    = performance.now() - state.startTime;
      const offsetMs = nowMs - target.beatTimeMs;
      const abs      = Math.abs(offsetMs);

      // grade
      let grade, delta;
      if (abs <= 60) { grade='PERFECT'; delta=300; state.perfect++; }
      else if (abs <= 120) { grade='GOOD'; delta=150; }
      else { grade='BAD'; delta=50; }

      state.score += delta;
      state.combo++;
      state.totalHits++;
      state.maxCombo = Math.max(state.maxCombo,state.combo);
      state.offsets.push(offsetMs);

      target.el.classList.add('rb-hit');
      target.el.style.opacity = '0.0';
      setTimeout(()=>{ if(target.el.parentNode) target.el.parentNode.remove(); },120);

      if(sfxHit) { sfxHit.currentTime=0; sfxHit.play().catch(()=>{}); }

      updateGroove();
      updateHUD();
    }

    function handleMiss(target) {
      state.miss++;
      state.combo=0;
      if(target.el && target.el.parentNode) target.el.parentNode.remove();
      updateGroove();
      updateHUD();
    }

    function loopTime() {
      if(!state.running) return;
      const now   = performance.now();
      const delta = now - state.startTime;
      const left  = Math.max(0, (durationMs - delta)/1000);
      state.lastTimeLeft = left;
      updateHUD();
      updateTrackProgress(Math.min(1, delta/durationMs));

      if(left <= 0) {
        return finish('timeout');
      }
      requestAnimationFrame(loopTime);
    }

    function loopBeat() {
      if(!state.running) return;
      const nowDelta = performance.now() - state.startTime;

      while(state.idx < pattern.length && pattern[state.idx] <= nowDelta+30) {
        const bt = pattern[state.idx];
        spawnTarget(bt);
        if(sfxBeat) { sfxBeat.currentTime=0; sfxBeat.play().catch(()=>{}); }
        state.idx++;
      }
      if(state.idx >= pattern.length) return;
      requestAnimationFrame(loopBeat);
    }

    function start() {
      // reset
      targetLayer.innerHTML='';
      state.running = true;
      state.idx     = 0;
      state.score   = 0;
      state.combo   = 0;
      state.maxCombo=0;
      state.perfect =0;
      state.miss    =0;
      state.totalHits=0;
      state.offsets.length=0;
      grooveFill.style.width='0%';
      grooveStatus.textContent='WARM UP';
      trackFill.style.width='0%';
      trackName.textContent='Track 1 — Basic Beat';

      updateHUD();

      state.startTime = performance.now();
      requestAnimationFrame(loopTime);
      requestAnimationFrame(loopBeat);
    }

    function finish(reason) {
      if(!state.running) return;
      state.running=false;

      // คำนวณค่าเฉลี่ย offset / accuracy
      let avgOffset = 0;
      if(state.offsets.length>0){
        avgOffset = state.offsets.reduce((a,b)=>a+b,0)/state.offsets.length;
      }

      const totalEvents = pattern.length;
      const acc = totalEvents>0 ? (state.totalHits / totalEvents) : 0;

      const result = {
        mode,
        difficulty,
        reason,
        score: state.score,
        maxCombo: state.maxCombo,
        miss: state.miss,
        totalHits: state.totalHits,
        rhythmAccuracy: acc,
        avgOffset,
      };

      onGameFinish(result);
    }

    function stopEarly() {
      finish('user-stop');
    }

    return { start, stopEarly, finish };
  }

  // ---------- Bind UI ----------

  let currentGame = null;
  let lastConfig  = null;

  function startGame(config) {
    lastConfig = config;
    currentGame = createGame(config);
    show('play');
    currentGame.start();
  }

  function onGameFinish(result) {
    // เติม result view
    res.mode.textContent      = result.mode==='research'?'Research':'Normal';
    res.diff.textContent      = result.difficulty;
    res.reason.textContent    = result.reason;
    res.score.textContent     = result.score;
    res.maxcombo.textContent  = result.maxCombo;
    res.miss.textContent      = result.miss;
    res.totalHits.textContent = result.totalHits;
    res.acc.textContent       = (result.rhythmAccuracy*100).toFixed(1)+'%';
    res.rtNormal.textContent  = result.offsetsMean
      ? result.offsetsMean.toFixed(1)+' ms'
      : result.avgOffset.toFixed(1)+' ms';
    res.rtOffset.textContent  = result.avgOffset.toFixed(1)+' ms';

    // participant (ถ้าโหมดวิจัย)
    const pid = $('#research-id')?.value || '-';
    res.pid.textContent = pid;

    show('result');
  }

  // ปุ่มต่าง ๆ

  // เมนูหลัก
  const btnStartResearch = views.menu.querySelector('[data-action="start-research"]');
  const btnStartNormal   = views.menu.querySelector('[data-action="start-normal"]');

  btnStartResearch?.addEventListener('click', ()=>{
    show('research');
  });

  btnStartNormal?.addEventListener('click', ()=>{
    const diff = $('#difficulty').value || 'normal';
    startGame({ mode:'normal', difficulty: diff });
  });

  // Research form
  $$('#view-research-form [data-action="back-to-menu"], #view-research-form [data-action="back-menu"]')
    .forEach(btn => btn.addEventListener('click', ()=>show('menu')));

  const btnResearchBegin = $('#view-research-form [data-action="research-begin-play"]');
  btnResearchBegin?.addEventListener('click', ()=>{
    const diff = $('#difficulty').value || 'normal';
    startGame({ mode:'research', difficulty: diff });
  });

  // Play view buttons
  $('#view-play [data-action="stop-early"]')?.addEventListener('click', ()=>{
    if(currentGame) currentGame.stopEarly();
  });

  $('#view-play [data-action="back-to-menu"]')?.addEventListener('click', ()=>{
    show('menu');
  });

  // Result view buttons
  $('#view-result [data-action="back-to-menu"]')?.addEventListener('click', ()=>{
    show('menu');
  });

  $('#view-result [data-action="play-again"]')?.addEventListener('click', ()=>{
    if(lastConfig) startGame(lastConfig);
    else show('menu');
  });

  // download CSV (hook ไว้ ยังไม่ implement export จริง)
  $('#view-result [data-action="download-csv"]')?.addEventListener('click', ()=>{
    alert('TODO: CSV Export (จะใช้โครงเดียวกับ Shadow Breaker)');
  });

  // เริ่มต้นที่เมนู
  show('menu');
}