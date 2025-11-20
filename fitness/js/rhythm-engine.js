// === Rhythm Boxer Engine — rhythm-engine.js ===
// (2025-11-20 — CSV + pause + multi-lane + mobile height fix)

export function initRhythmBoxer() {
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  const views = {
    menu:    $('#view-menu'),
    research:$('#view-research-form'),
    play:    $('#view-play'),
    result:  $('#view-result'),
  };

  const stat = {
    mode:    $('#stat-mode'),
    diff:    $('#stat-diff'),
    score:   $('#stat-score'),
    combo:   $('#stat-combo'),
    perfect: $('#stat-perfect'),
    miss:    $('#stat-miss'),
    time:    $('#stat-time'),
  };

  const res = {
    mode:       $('#res-mode'),
    diff:       $('#res-diff'),
    reason:     $('#res-endreason'),
    score:      $('#res-score'),
    maxcombo:   $('#res-maxcombo'),
    miss:       $('#res-miss'),
    acc:        $('#res-accuracy'),
    totalHits:  $('#res-totalhits'),
    rtNormal:   $('#res-rt-normal'),
    rtOffset:   $('#res-rt-decoy'),
    pid:        $('#res-participant'),
  };

  const grooveFill   = $('#groove-fill');
  const grooveStatus = $('#groove-status');
  const trackFill    = $('#track-fill');
  const trackName    = $('#track-name');
  const targetLayer  = $('#target-layer');

  const sfxHit  = $('#sfx-hit');
  const sfxBeat = $('#sfx-beat');

  const pauseOverlay   = $('#pause-overlay');
  const pauseResumeBtn = pauseOverlay?.querySelector('[data-action="resume-play"]');
  const pauseStopBtn   = pauseOverlay?.querySelector('[data-action="stop-early"]');

  let lastResult = null;
  let lastMeta   = null;
  let lastConfig = null;
  let currentGame = null;

  function show(name){
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[name].classList.remove('hidden');
  }

  // ---------- summary & CSV ----------

  function saveSummaryToStorage(result, meta){
    const summary = {
      game: 'rhythm-boxer',
      timestamp: result.timestamp,
      mode: result.mode,
      difficulty: result.difficulty,
      bpm: result.bpm,
      score: result.score,
      maxCombo: result.maxCombo,
      miss: result.miss,
      totalHits: result.totalHits,
      accuracy: result.rhythmAccuracy,
      avgOffset: result.avgOffset,
      participantId: meta?.pid || '',
      group: meta?.group || '',
      note: meta?.note || '',
    };
    try{
      localStorage.setItem('vf-rhythm-latest', JSON.stringify(summary));
      window.dispatchEvent(new CustomEvent('vf-rhythm-updated', {detail:summary}));
    }catch(e){}
  }

  function downloadCSV(result, meta){
    if(!result){
      alert('ยังไม่มีข้อมูลรอบล่าสุด');
      return;
    }
    const rows = [];
    rows.push(['Game','Rhythm Boxer']);
    rows.push(['Timestamp', result.timestamp]);
    rows.push(['Mode', result.mode]);
    rows.push(['Difficulty', result.difficulty]);
    rows.push(['BPM', result.bpm]);
    rows.push(['DurationSec', (result.durationMs/1000).toFixed(1)]);
    rows.push(['ParticipantID', meta?.pid || '']);
    rows.push(['Group', meta?.group || '']);
    rows.push(['Note', meta?.note || '']);
    rows.push([]);
    rows.push(['Metric','Value']);
    rows.push(['Score', result.score]);
    rows.push(['MaxCombo', result.maxCombo]);
    rows.push(['Miss', result.miss]);
    rows.push(['TotalHits', result.totalHits]);
    rows.push(['Accuracy', (result.rhythmAccuracy*100).toFixed(2)+'%']);
    rows.push(['AvgOffsetMs', result.avgOffset.toFixed(1)]);

    const csv = rows
      .map(r => r.map(x => '"' + String(x).replace(/"/g,'""') + '"').join(','))
      .join('\r\n');

    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'rhythm-boxer-' + Date.now() + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onGameFinish(result, meta){
    res.mode.textContent       = result.mode === 'research' ? 'Research' : 'Normal';
    res.diff.textContent       = result.difficulty;
    res.reason.textContent     = result.reason;
    res.score.textContent      = result.score;
    res.maxcombo.textContent   = result.maxCombo;
    res.miss.textContent       = result.miss;
    res.totalHits.textContent  = result.totalHits;
    res.acc.textContent        = (result.rhythmAccuracy*100).toFixed(1)+'%';
    res.rtNormal.textContent   = result.avgOffset.toFixed(1)+' ms';
    res.rtOffset.textContent   = result.avgOffset.toFixed(1)+' ms';
    const pid = meta?.pid || $('#research-id')?.value || '-';
    res.pid.textContent        = pid || '-';
    show('result');
  }

  // ---------- main game factory ----------

  function createGame(config){
    const difficulty = config.difficulty || 'normal';
    const mode       = config.mode || 'normal';
    const meta       = config.meta || {};

    const bpm = (difficulty === 'easy'
      ? 80
      : difficulty === 'hard'
        ? 130
        : 104);

    const beatInterval = 60000 / bpm;
    const durationMs   = 60000; // 60s

    const perfectWin = (difficulty === 'easy' ? 80 :
                        difficulty === 'hard' ? 40 : 60);
    const goodWin    = (difficulty === 'easy' ? 150 :
                        difficulty === 'hard' ? 90 : 120);
    const missWindow = (difficulty === 'easy' ? 300 :
                        difficulty === 'hard' ? 160 : 220);

    const state = {
      running: false,
      paused: false,
      pauseAt: 0,
      startTime: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      miss: 0,
      totalHits: 0,
      offsets: [],
      beatIndex: 0,
      timeLeft: 60,
      rafId: null,
      beatTimer: null,
    };

    function updateHUD(){
      stat.mode.textContent    = mode === 'research' ? 'Research' : 'Normal';
      stat.diff.textContent    = difficulty;
      stat.score.textContent   = state.score;
      stat.combo.textContent   = state.combo;
      stat.perfect.textContent = state.perfect;
      stat.miss.textContent    = state.miss;
      stat.time.textContent    = state.timeLeft.toFixed(1);
    }

    function updateGroove(){
      const w = Math.min(100, state.combo*2);
      grooveFill.style.width = w + '%';
      if(state.combo >= 16)      grooveStatus.textContent = 'GROOVE MAX!';
      else if(state.combo >=10)  grooveStatus.textContent = 'GREAT!';
      else if(state.combo >= 5)  grooveStatus.textContent = 'ON BEAT';
      else                       grooveStatus.textContent = 'WARM UP';
    }

    function updateTrackProgress(progress){
      const p = Math.min(1, Math.max(0, progress));
      trackFill.style.width = (p*100).toFixed(1)+'%';
      trackName.textContent = p >= 0.99 ? 'Track — ENDING' : 'Track 1 — Basic Beat';
    }

    function spawnHitLabel(x,y,text,cssClass){
      const label = document.createElement('div');
      label.className = 'rb-hit-label';
      if(cssClass) label.classList.add(cssClass);
      label.textContent = text;
      label.style.left = x+'px';
      label.style.top  = y+'px';
      targetLayer.appendChild(label);
      setTimeout(()=>{ label.remove(); },420);
    }

    // ---------- spawnTarget (มี fallback แก้จอดำ) ----------
    function spawnTarget(beatIndex){
      if(!targetLayer) return;

      const rect = targetLayer.getBoundingClientRect();
      const w = rect.width  || targetLayer.clientWidth  || 320;
      const h = rect.height || targetLayer.clientHeight || 320;

      const laneIndex  = beatIndex % 3;
      const laneXRatio = [0.25,0.5,0.75][laneIndex];
      const x = laneXRatio * w;
      const baseY = h * 0.65;
      const y = baseY + (Math.random()*16 - 8);

      const laneEmojis = ['🥊','🎵','✨'];
      let emoji = laneEmojis[laneIndex];

      const isStrong = (beatIndex % 4 === 0);
      if(isStrong) emoji = '💥';

      const el = document.createElement('div');
      el.className = 'rb-target lane-' + laneIndex + (isStrong ? ' rb-target-strong' : '');
      el.textContent = emoji;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';

      const beatTimeMs = beatIndex * beatInterval;

      const target = {
        el,
        beatTimeMs,
        hit:false,
        laneIndex,
        strong:isStrong,
      };

      el.addEventListener('pointerdown',(ev)=>{
        ev.preventDefault();
        if(!state.running || state.paused || target.hit) return;
        target.hit = true;
        handleHit(target);
      },{passive:false});

      targetLayer.appendChild(el);

      setTimeout(()=>{
        if(!state.running || state.paused || target.hit) return;
        target.hit = true;
        handleMiss(target);
      },missWindow);
    }

    function handleHit(target){
      const nowDelta = performance.now() - state.startTime;
      const offsetMs = nowDelta - target.beatTimeMs;
      const abs = Math.abs(offsetMs);

      let grade, delta;
      if(abs <= perfectWin){
        grade = 'PERFECT';
        delta = target.strong ? 500 : 300;
        state.perfect++;
      }else if(abs <= goodWin){
        grade = 'GOOD';
        delta = target.strong ? 260 : 150;
      }else{
        grade = 'BAD';
        delta = 50;
      }

      state.score += delta;
      state.combo++;
      state.totalHits++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.offsets.push(offsetMs);

      const r = target.el.getBoundingClientRect();
      const host = targetLayer.getBoundingClientRect();
      const cx = r.left + r.width/2 - host.left;
      const cy = r.top  + r.height/2 - host.top;

      target.el.style.transform += ' scale(0.8)';
      target.el.style.opacity = '0';
      setTimeout(()=>{ target.el.remove(); },120);

      const cls =
        grade === 'PERFECT' ? 'rb-hit-perfect' :
        grade === 'GOOD'    ? 'rb-hit-good'    :
                               'rb-hit-bad';
      spawnHitLabel(cx, cy-24, grade, cls);

      if(sfxHit){
        try{ sfxHit.currentTime = 0; sfxHit.play(); }catch(e){}
      }

      updateGroove();
      updateHUD();
    }

    function handleMiss(target){
      state.miss++;
      state.combo = 0;

      const r = target.el.getBoundingClientRect();
      const host = targetLayer.getBoundingClientRect();
      const cx = r.left + r.width/2 - host.left;
      const cy = r.top  + r.height/2 - host.top;

      spawnHitLabel(cx, cy-20, 'MISS', 'rb-hit-miss');
      target.el.remove();

      updateGroove();
      updateHUD();
    }

    function loopTime(){
      if(!state.running || state.paused) return;
      const now = performance.now();
      const elapsed = now - state.startTime;
      const leftMs = Math.max(0, durationMs - elapsed);
      state.timeLeft = leftMs/1000;
      updateHUD();
      updateTrackProgress(elapsed/durationMs);
      if(leftMs <= 0){
        finish('timeout');
        return;
      }
      state.rafId = requestAnimationFrame(loopTime);
    }

    function startBeatLoop(resetIndex=true){
      if(state.beatTimer) clearInterval(state.beatTimer);
      if(resetIndex) state.beatIndex = 0;
      state.beatTimer = setInterval(()=>{
        if(!state.running || state.paused) return;
        const now = performance.now();
        const elapsed = now - state.startTime;
        if(elapsed >= durationMs){
          clearInterval(state.beatTimer);
          return;
        }
        spawnTarget(state.beatIndex);
        if(sfxBeat){
          try{ sfxBeat.currentTime = 0; sfxBeat.play(); }catch(e){}
        }
        state.beatIndex++;
      },beatInterval);
    }

    function pauseGame(){
      if(!state.running || state.paused) return;
      state.paused = true;
      state.pauseAt = performance.now();
      if(state.rafId){
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
      if(state.beatTimer){
        clearInterval(state.beatTimer);
        state.beatTimer = null;
      }
      pauseOverlay?.classList.remove('hidden');
    }

    function resumeGame(){
      if(!state.running || !state.paused) return;
      const now = performance.now();
      const pausedDuration = now - state.pauseAt;
      state.startTime += pausedDuration;
      state.paused = false;
      pauseOverlay?.classList.add('hidden');
      state.rafId = requestAnimationFrame(loopTime);
      startBeatLoop(false);
    }

    function visibilityHandler(){
      if(document.hidden && state.running && !state.paused){
        pauseGame();
      }
    }

    function start(){
      targetLayer.innerHTML = '';
      grooveFill.style.width = '0%';
      grooveStatus.textContent = 'WARM UP';
      trackFill.style.width = '0%';
      trackName.textContent = 'Track 1 — Basic Beat';

      state.score = 0;
      state.combo = 0;
      state.maxCombo = 0;
      state.perfect = 0;
      state.miss = 0;
      state.totalHits = 0;
      state.offsets.length = 0;
      state.timeLeft = 60;
      state.paused = false;

      updateHUD();

      state.running = true;
      state.startTime = performance.now();

      state.rafId = requestAnimationFrame(loopTime);
      startBeatLoop(true);

      document.addEventListener('visibilitychange', visibilityHandler);
      window.addEventListener('blur', visibilityHandler);
    }

    function finish(reason){
      if(!state.running) return;
      state.running = false;
      state.paused = false;

      if(state.rafId){
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
      if(state.beatTimer){
        clearInterval(state.beatTimer);
        state.beatTimer = null;
      }
      pauseOverlay?.classList.add('hidden');

      document.removeEventListener('visibilitychange', visibilityHandler);
      window.removeEventListener('blur', visibilityHandler);

      let avgOffset = 0;
      if(state.offsets.length){
        avgOffset = state.offsets.reduce((a,b)=>a+b,0)/state.offsets.length;
      }
      const totalEvents = Math.max(1, state.beatIndex);
      const acc = state.totalHits / totalEvents;
      const timestamp = new Date().toISOString();

      const result = {
        mode,
        difficulty,
        bpm,
        durationMs,
        reason,
        score: state.score,
        maxCombo: state.maxCombo,
        miss: state.miss,
        totalHits: state.totalHits,
        rhythmAccuracy: acc,
        avgOffset,
        timestamp,
      };

      lastResult = result;
      lastMeta   = meta;
      saveSummaryToStorage(result, meta);
      onGameFinish(result, meta);
    }

    function stopEarly(){ finish('user-stop'); }

    return { start, stopEarly, resumeGame };
  }

  // ---------- startGame & bindings ----------

  function startGame(cfg){
    lastConfig = cfg;
    currentGame = createGame(cfg);
    show('play');
    currentGame.start();
  }

  // menu buttons
  const btnStartResearch = views.menu.querySelector('[data-action="start-research"]');
  const btnStartNormal   = views.menu.querySelector('[data-action="start-normal"]');

  btnStartResearch?.addEventListener('click', ()=>{ show('research'); });

  btnStartNormal?.addEventListener('click', ()=>{
    const diff = $('#difficulty').value || 'normal';
    startGame({ mode:'normal', difficulty: diff });
  });

  // research form
  $$('#view-research-form [data-action="back-to-menu"]').forEach(btn=>{
    btn.addEventListener('click', ()=>show('menu'));
  });

  const btnResearchBegin = $('#view-research-form [data-action="research-begin-play"]');
  btnResearchBegin?.addEventListener('click', ()=>{
    const diff = $('#difficulty').value || 'normal';
    const meta = {
      pid:   $('#research-id')?.value || '',
      group: $('#research-group')?.value || '',
      note:  $('#research-note')?.value || '',
    };
    startGame({ mode:'research', difficulty: diff, meta });
  });

  // play view buttons
  $('#view-play [data-action="stop-early"]')?.addEventListener('click', ()=>{
    if(currentGame) currentGame.stopEarly();
  });

  pauseResumeBtn?.addEventListener('click', ()=>{
    if(currentGame && currentGame.resumeGame) currentGame.resumeGame();
  });

  pauseStopBtn?.addEventListener('click', ()=>{
    if(currentGame) currentGame.stopEarly();
  });

  // result view buttons
  $('#view-result [data-action="back-to-menu"]')?.addEventListener('click', ()=>{
    show('menu');
  });

  $('#view-result [data-action="play-again"]')?.addEventListener('click', ()=>{
    if(lastConfig) startGame(lastConfig);
    else show('menu');
  });

  $('#view-result [data-action="download-csv"]')?.addEventListener('click', ()=>{
    downloadCSV(lastResult, lastMeta);
  });

  // start at menu
  show('menu');
}