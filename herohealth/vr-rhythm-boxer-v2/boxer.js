(function(){
  'use strict';

  const qs = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtTime = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;

  function xmur3(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for(let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const MODE_PRESETS = {
    learn: { bpm: 96, density: 0.58, banner: 'Learn Mode' },
    active: { bpm: 112, density: 0.74, banner: 'Active Mode' },
    cardio: { bpm: 120, density: 0.84, banner: 'Cardio Mode' }
  };

  const DIFF_PRESETS = {
    easy: { densityBonus: -0.08, offbeatChance: 0.00, blockDuckBoost: 0.00 },
    normal: { densityBonus: 0.00, offbeatChance: 0.12, blockDuckBoost: 0.06 },
    challenge: { densityBonus: 0.08, offbeatChance: 0.24, blockDuckBoost: 0.12 }
  };

  const ACTIONS = {
    jab:   { lane: 0, label: 'Jab',   icon: '👊', key: 'KeyA', alt: 'ArrowLeft' },
    cross: { lane: 1, label: 'Cross', icon: '💥', key: 'KeyL', alt: 'ArrowRight' },
    block: { lane: 2, label: 'Block', icon: '🛡', key: 'KeyW', alt: 'ArrowUp' },
    duck:  { lane: 3, label: 'Duck',  icon: '⬇', key: 'KeyS', alt: 'ArrowDown' }
  };

  const WINDOWS = {
    perfect: 80,
    great: 140,
    good: 220
  };

  const STORAGE_LAST = 'HHA_LAST_SUMMARY';
  const STORAGE_HISTORY = 'HHA_SUMMARY_HISTORY';

  const params = {
    pid: qs.get('pid') || 'anon',
    nick: qs.get('nick') || '',
    mode: (qs.get('mode') || 'active').toLowerCase(),
    diff: (qs.get('diff') || 'normal').toLowerCase(),
    durSec: clamp(Number(qs.get('dur') || 120), 30, 600),
    bpm: clamp(Number(qs.get('bpm') || MODE_PRESETS[qs.get('mode') || 'active']?.bpm || 112), 72, 180),
    view: (qs.get('view') || 'mobile').toLowerCase(),
    seed: qs.get('seed') || String(Date.now()),
    hub: qs.get('hub') || '../hub.html',
    run: qs.get('run') || 'play',
    audio: (qs.get('audio') || '1') !== '0',
    gameId: qs.get('game') || 'rhythm-boxer-v2',
    zone: qs.get('zone') || 'fitness',
    studyId: qs.get('studyId') || '',
    phase: qs.get('phase') || '',
    conditionGroup: qs.get('conditionGroup') || ''
  };

  const modePreset = MODE_PRESETS[params.mode] || MODE_PRESETS.active;
  const diffPreset = DIFF_PRESETS[params.diff] || DIFF_PRESETS.normal;
  const density = clamp(modePreset.density + diffPreset.densityBonus, 0.42, 0.94);
  const beatMs = 60000 / params.bpm;
  const totalMs = params.durSec * 1000;
  const travelMs = params.view === 'mobile' ? 1650 : 1500;
  const startDelayMs = 3200;

  const seeded = mulberry32(xmur3(`${params.seed}|${params.pid}|${params.mode}|${params.diff}`)());

  const els = {
    shell: $('rbShell'),
    subline: $('subline'),
    scoreValue: $('scoreValue'),
    comboValue: $('comboValue'),
    accValue: $('accValue'),
    timeValue: $('timeValue'),
    coachText: $('coachText'),
    arena: $('arena'),
    noteLayer: $('noteLayer'),
    hitLine: $('hitLine'),
    phaseBanner: $('phaseBanner'),
    countdownLayer: $('countdownLayer'),
    countdownNum: $('countdownNum'),
    feedbackPop: $('feedbackPop'),
    arenaPulse: $('arenaPulse'),
    audioToggle: $('audioToggle'),
    summaryOverlay: $('summaryOverlay'),
    sumScore: $('sumScore'),
    sumAcc: $('sumAcc'),
    sumCombo: $('sumCombo'),
    sumTime: $('sumTime'),
    sumPerfect: $('sumPerfect'),
    sumGreat: $('sumGreat'),
    sumGood: $('sumGood'),
    sumMiss: $('sumMiss'),
    sumCoach: $('sumCoach'),
    summarySub: $('summarySub'),
    summaryGrade: $('summaryGrade'),
    btnReplay: $('btnReplay'),
    btnBackHubTop: $('btnBackHubTop'),
    btnBackHubBottom: $('btnBackHubBottom')
  };

  els.audioToggle.checked = params.audio;
  els.btnBackHubTop.href = params.hub;
  els.btnBackHubBottom.href = params.hub;
  els.subline.textContent =
    `${params.mode.toUpperCase()} • ${params.diff.toUpperCase()} • ${params.bpm} BPM • ${params.durSec}s`;

  const inputButtons = Array.from(document.querySelectorAll('.pad-btn'));
  const laneEls = Array.from(document.querySelectorAll('.lane'));

  const state = {
    started: false,
    ended: false,
    startAt: performance.now() + startDelayMs,
    beatIndex: -1,
    beatFlashUntil: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    blankTap: 0,
    totalNotes: 0,
    judgedNotes: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
    actions: { jab: 0, cross: 0, block: 0, duck: 0 },
    offsets: [],
    notes: [],
    lastCoachAt: 0,
    feedbackHideAt: 0,
    coachText: 'ฟังจังหวะ แล้วกดตอนโน้ตแตะเส้นล่างนะ',
    events: [],
    sessionSaved: false,
    audioCtx: null
  };

  function ensureAudio(){
    if(state.audioCtx) return state.audioCtx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx) return null;
    try{
      state.audioCtx = new AudioCtx();
    }catch(_){
      state.audioCtx = null;
    }
    return state.audioCtx;
  }

  function beep(freq, dur, vol){
    if(!els.audioToggle.checked) return;
    const ctx = ensureAudio();
    if(!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function weightedChoice(weights){
    const total = weights.reduce((s, x) => s + x.w, 0);
    let r = seeded() * total;
    for(const item of weights){
      r -= item.w;
      if(r <= 0) return item.k;
    }
    return weights[weights.length - 1].k;
  }

  function chooseAction(recent, counts){
    const base = [
      { k: 'jab', w: 1.25 },
      { k: 'cross', w: 1.20 },
      { k: 'block', w: 0.68 + diffPreset.blockDuckBoost },
      { k: 'duck', w: 0.64 + diffPreset.blockDuckBoost }
    ];

    for(const row of base){
      if(recent.length >= 2 && recent[recent.length - 1] === row.k && recent[recent.length - 2] === row.k){
        row.w *= 0.18;
      }
      if(counts[row.k] === 0){
        row.w *= 1.14;
      }
    }

    const jabCrossGap = Math.abs((counts.jab || 0) - (counts.cross || 0));
    if(jabCrossGap > 4){
      if((counts.jab || 0) < (counts.cross || 0)) base.find(x => x.k === 'jab').w *= 1.2;
      else base.find(x => x.k === 'cross').w *= 1.2;
    }

    return weightedChoice(base);
  }

  function makeNote(id, action, hitTime){
    return {
      id,
      action,
      lane: ACTIONS[action].lane,
      hitTime,
      spawnTime: hitTime - travelMs,
      judged: false,
      result: '',
      offsetMs: null,
      el: null
    };
  }

  function generateSchedule(){
    const notes = [];
    const recent = [];
    const counts = { jab: 0, cross: 0, block: 0, duck: 0 };
    let noteId = 0;
    let t = 1800;

    while(t < totalMs - 500){
      const useNote = seeded() < density;
      if(useNote){
        const action = chooseAction(recent, counts);
        notes.push(makeNote(`n${noteId++}`, action, t));
        counts[action] += 1;
        recent.push(action);
        if(recent.length > 4) recent.shift();

        const canOffbeat = (
          params.diff !== 'easy' &&
          seeded() < diffPreset.offbeatChance &&
          (t + beatMs * 0.5) < totalMs - 300
        );

        if(canOffbeat){
          let action2 = chooseAction(recent, counts);
          if(action2 === action && seeded() < 0.6){
            action2 = (action === 'jab') ? 'cross' : (action === 'cross' ? 'jab' : (seeded() < 0.5 ? 'jab' : 'cross'));
          }
          notes.push(makeNote(`n${noteId++}`, action2, t + beatMs * 0.5));
          counts[action2] += 1;
          recent.push(action2);
          if(recent.length > 4) recent.shift();
        }
      }
      t += beatMs;
    }

    notes.sort((a, b) => a.hitTime - b.hitTime);
    state.totalNotes = notes.length;
    return notes;
  }

  function buildNoteEl(note){
    const el = document.createElement('div');
    el.className = `note note--${note.action}`;
    el.dataset.noteId = note.id;
    el.innerHTML = `
      <div class="note-inner">
        <div class="note-icon">${ACTIONS[note.action].icon}</div>
        <div class="note-label">${ACTIONS[note.action].label.toUpperCase()}</div>
        <div class="note-small">${note.action === 'duck' ? 'ลงต่ำ' : 'ตรงเส้น'}</div>
      </div>
    `;
    els.noteLayer.appendChild(el);
    note.el = el;
  }

  function buildNotes(){
    state.notes = generateSchedule();
    for(const n of state.notes) buildNoteEl(n);
  }

  function scoreFor(result, combo){
    const base = { perfect: 100, great: 72, good: 44, miss: 0 }[result] || 0;
    const comboBonus = Math.min(60, Math.floor(combo / 5) * 6);
    return base + comboBonus;
  }

  function judgeFromOffset(offsetMs){
    const a = Math.abs(offsetMs);
    if(a <= WINDOWS.perfect) return 'perfect';
    if(a <= WINDOWS.great) return 'great';
    if(a <= WINDOWS.good) return 'good';
    return 'miss';
  }

  function setCoach(text){
    state.coachText = text;
    els.coachText.textContent = text;
  }

  function pulseArena(){
    state.beatFlashUntil = performance.now() + 120;
    els.arenaPulse.classList.add('is-beat');
    setTimeout(() => els.arenaPulse.classList.remove('is-beat'), 120);
  }

  function showFeedback(result, text){
    const el = els.feedbackPop;
    el.className = 'feedback-pop show ' + result;
    el.textContent = text;
    state.feedbackHideAt = performance.now() + 380;
  }

  function clearFeedback(now){
    if(state.feedbackHideAt && now >= state.feedbackHideAt){
      state.feedbackHideAt = 0;
      els.feedbackPop.className = 'feedback-pop';
      els.feedbackPop.textContent = '';
    }
  }

  function updateHUD(elapsed){
    els.scoreValue.textContent = String(Math.round(state.score));
    els.comboValue.textContent = String(state.combo);
    const acc = computeAccuracyPercent();
    els.accValue.textContent = `${acc}%`;
    const secLeft = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
    els.timeValue.textContent = fmtTime(secLeft);
  }

  function computeAccuracyPercent(){
    if(state.totalNotes <= 0) return 0;
    const weighted = (state.perfect * 1.0) + (state.great * 0.8) + (state.good * 0.55);
    return Math.round((weighted / state.totalNotes) * 100);
  }

  function nearestNote(action, elapsed){
    let best = null;
    let bestAbs = Infinity;

    for(const note of state.notes){
      if(note.action !== action || note.judged) continue;
      const abs = Math.abs(elapsed - note.hitTime);
      if(abs <= WINDOWS.good && abs < bestAbs){
        best = note;
        bestAbs = abs;
      }
    }
    return best;
  }

  function pressPad(action){
    const btn = document.querySelector(`.pad-btn[data-action="${action}"]`);
    if(!btn) return;
    btn.classList.add('is-pressed');
    setTimeout(() => btn.classList.remove('is-pressed'), 90);
  }

  function flashLane(action){
    const lane = document.querySelector(`.lane[data-action="${action}"]`);
    if(!lane) return;
    lane.animate(
      [
        { filter: 'brightness(1)', transform: 'scale(1)' },
        { filter: 'brightness(1.08)', transform: 'scale(1.003)' },
        { filter: 'brightness(1)', transform: 'scale(1)' }
      ],
      { duration: 120, easing: 'ease-out' }
    );
  }

  function registerHit(note, elapsed){
    const offset = elapsed - note.hitTime;
    const result = judgeFromOffset(offset);
    if(result === 'miss') return false;

    note.judged = true;
    note.result = result;
    note.offsetMs = offset;
    state.judgedNotes += 1;
    state.offsets.push(offset);
    state.actions[note.action] += 1;

    if(note.el){
      note.el.classList.add('is-hit');
      setTimeout(() => { if(note.el) note.el.style.display = 'none'; }, 120);
    }

    if(result === 'perfect'){
      state.perfect += 1;
      state.combo += 1;
      state.score += scoreFor(result, state.combo);
      showFeedback('perfect', 'Perfect!');
      setCoach('แม่นมาก! กดตรงจังหวะพอดีเลย');
      beep(980, 0.04, 0.028);
    }else if(result === 'great'){
      state.great += 1;
      state.combo += 1;
      state.score += scoreFor(result, state.combo);
      showFeedback('great', 'Great!');
      setCoach('ดีมาก! ใกล้เป๊ะแล้ว');
      beep(860, 0.035, 0.024);
    }else{
      state.good += 1;
      state.combo += 1;
      state.score += scoreFor(result, state.combo);
      showFeedback('good', 'Good!');
      setCoach('ดีเลย ลองให้ตรงเส้นอีกนิดนะ');
      beep(720, 0.03, 0.020);
    }

    if(state.combo > state.maxCombo) state.maxCombo = state.combo;

    state.events.push({
      eventType: 'note_result',
      ts: Date.now(),
      noteId: note.id,
      action: note.action,
      hitTimeMs: Math.round(note.hitTime),
      inputElapsedMs: Math.round(elapsed),
      offsetMs: Math.round(offset),
      result,
      combo: state.combo,
      score: Math.round(state.score)
    });

    return true;
  }

  function registerMiss(note){
    if(note.judged) return;
    note.judged = true;
    note.result = 'miss';
    note.offsetMs = null;
    state.judgedNotes += 1;
    state.miss += 1;
    state.combo = 0;

    if(note.el){
      note.el.classList.add('is-miss');
      setTimeout(() => { if(note.el) note.el.style.display = 'none'; }, 180);
    }

    state.events.push({
      eventType: 'note_result',
      ts: Date.now(),
      noteId: note.id,
      action: note.action,
      hitTimeMs: Math.round(note.hitTime),
      inputElapsedMs: null,
      offsetMs: null,
      result: 'miss',
      combo: 0,
      score: Math.round(state.score)
    });

    if(performance.now() - state.lastCoachAt > 500){
      setCoach('ไม่เป็นไร ลองฟังจังหวะก่อนแล้วค่อยกดนะ');
      state.lastCoachAt = performance.now();
    }
  }

  function handleInput(action){
    if(state.ended) return;
    const now = performance.now();

    if(!state.started){
      ensureAudio();
      if(state.audioCtx && state.audioCtx.state === 'suspended'){
        state.audioCtx.resume().catch(() => {});
      }
      return;
    }

    const elapsed = now - state.startAt;
    pressPad(action);
    flashLane(action);

    const note = nearestNote(action, elapsed);
    if(note){
      registerHit(note, elapsed);
    }else{
      state.blankTap += 1;
      if(now - state.lastCoachAt > 550){
        setCoach('ฟังจังหวะก่อนนะ แล้วกดตอนแตะเส้น');
        state.lastCoachAt = now;
      }
      showFeedback('miss', 'Wait for the beat');
      beep(440, 0.02, 0.012);
    }
  }

  function attachInputs(){
    for(const btn of inputButtons){
      const action = btn.dataset.action;
      btn.addEventListener('pointerdown', () => handleInput(action));
      btn.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        handleInput(action);
      }, { passive: false });
      btn.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
      });
    }

    window.addEventListener('keydown', (ev) => {
      if(ev.repeat) return;
      const action = Object.keys(ACTIONS).find((k) => ACTIONS[k].key === ev.code || ACTIONS[k].alt === ev.code);
      if(action){
        ev.preventDefault();
        handleInput(action);
      }
    });
  }

  function layoutNote(note, elapsed){
    const arenaRect = els.arena.getBoundingClientRect();
    const lineRect = els.hitLine.getBoundingClientRect();

    const lineY = lineRect.top - arenaRect.top + (lineRect.height / 2);
    const laneWidth = arenaRect.width / 4;
    const laneCenterX = (laneWidth * note.lane) + (laneWidth / 2);

    const progress = (elapsed - note.spawnTime) / (note.hitTime - note.spawnTime);
    const clamped = clamp(progress, -0.35, 1.18);
    const startY = 28;
    const y = startY + (lineY - startY) * clamped;
    const scale = 0.88 + clamp(progress, 0, 1) * 0.16;

    note.el.style.left = `${laneCenterX}px`;
    note.el.style.transform = `translate(-50%, ${y}px) scale(${scale})`;

    if(Math.abs(elapsed - note.hitTime) <= WINDOWS.good){
      note.el.classList.add('is-near');
    }else{
      note.el.classList.remove('is-near');
    }

    if(elapsed < note.spawnTime - 120){
      note.el.style.display = 'none';
    }else{
      note.el.style.display = '';
    }
  }

  function buildReplayUrl(){
    const url = new URL(location.href);
    url.searchParams.set('seed', String(Date.now()));
    return url.toString();
  }

  function computeCoachSummary(acc){
    if(acc >= 90) return 'เยี่ยมมาก! วันนี้จับจังหวะได้แม่นสุด ๆ และคุมเกมได้ดีมาก';
    if(acc >= 80) return 'ดีมากเลย จังหวะเริ่มนิ่งแล้ว รอบหน้าลองเก็บ Perfect เพิ่มอีกนิด';
    if(state.miss > Math.max(8, state.totalNotes * 0.18)) return 'ลองฟังเสียงและดูเส้นล่างให้มากขึ้น จะช่วยให้กดตรงจังหวะขึ้น';
    if(state.blankTap > Math.max(6, state.totalNotes * 0.12)) return 'วันนี้มีการกดเร็วไปนิด ลองรอให้โน้ตแตะเส้นก่อนค่อยกด';
    return 'ทำได้ดีมาก ลองฝึกต่ออีกนิด แล้ว Accuracy จะสูงขึ้นเรื่อย ๆ';
  }

  function computeGrade(acc){
    if(acc >= 92) return 'S';
    if(acc >= 84) return 'A';
    if(acc >= 72) return 'B';
    if(acc >= 60) return 'C';
    return 'D';
  }

  function saveSummary(summary){
    try{
      localStorage.setItem(STORAGE_LAST, JSON.stringify(summary));
      const arr = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
      arr.unshift(summary);
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(arr.slice(0, 30)));
    }catch(_){}
  }

  function endGame(){
    if(state.ended) return;
    state.ended = true;
    els.phaseBanner.textContent = 'Summary';

    const acc = computeAccuracyPercent();
    const coach = computeCoachSummary(acc);
    const grade = computeGrade(acc);

    const summary = {
      gameId: params.gameId,
      zone: params.zone,
      pid: params.pid,
      nick: params.nick,
      mode: params.mode,
      diff: params.diff,
      bpm: params.bpm,
      durationSec: params.durSec,
      seed: params.seed,
      run: params.run,
      score: Math.round(state.score),
      accuracy: acc,
      maxCombo: state.maxCombo,
      perfect: state.perfect,
      great: state.great,
      good: state.good,
      miss: state.miss,
      blankTap: state.blankTap,
      jab: state.actions.jab,
      cross: state.actions.cross,
      block: state.actions.block,
      duck: state.actions.duck,
      coach,
      grade,
      studyId: params.studyId,
      phase: params.phase,
      conditionGroup: params.conditionGroup,
      ts: Date.now()
    };

    saveSummary(summary);

    els.sumScore.textContent = String(summary.score);
    els.sumAcc.textContent = `${summary.accuracy}%`;
    els.sumCombo.textContent = String(summary.maxCombo);
    els.sumTime.textContent = `${summary.durationSec}s`;
    els.sumPerfect.textContent = String(summary.perfect);
    els.sumGreat.textContent = String(summary.great);
    els.sumGood.textContent = String(summary.good);
    els.sumMiss.textContent = String(summary.miss);
    els.sumCoach.textContent = summary.coach;
    els.summarySub.textContent = `${params.mode.toUpperCase()} • ${params.diff.toUpperCase()} • ${params.bpm} BPM`;
    els.summaryGrade.textContent = grade;
    els.btnReplay.href = buildReplayUrl();

    els.summaryOverlay.classList.remove('hidden');
  }

  function updateCountdown(now){
    const remain = state.startAt - now;
    if(remain <= 0){
      els.countdownLayer.classList.add('hidden');
      if(!state.started){
        state.started = true;
        els.phaseBanner.textContent = modePreset.banner;
        setCoach('เริ่มแล้ว! ตีตอนโน้ตแตะเส้นล่างนะ');
        ensureAudio();
        if(state.audioCtx && state.audioCtx.state === 'suspended'){
          state.audioCtx.resume().catch(() => {});
        }
      }
      return;
    }

    const sec = Math.ceil(remain / 1000);
    els.countdownNum.textContent = String(sec);
    if(sec === 3) els.phaseBanner.textContent = 'Ready';
    if(sec === 2) els.phaseBanner.textContent = 'Set';
    if(sec === 1) els.phaseBanner.textContent = 'Go Soon';
  }

  function tick(now){
    updateCountdown(now);
    clearFeedback(now);

    if(!state.started){
      updateHUD(0);
      requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - state.startAt;

    const nextBeat = Math.floor(elapsed / beatMs);
    if(nextBeat > state.beatIndex){
      state.beatIndex = nextBeat;
      pulseArena();
      if(nextBeat >= 0){
        beep(620, 0.025, 0.013);
      }
    }

    for(const note of state.notes){
      if(note.judged){
        continue;
      }

      if(elapsed > note.hitTime + WINDOWS.good){
        registerMiss(note);
        continue;
      }

      if(note.el){
        layoutNote(note, elapsed);
      }
    }

    updateHUD(elapsed);

    if(elapsed >= totalMs){
      endGame();
      return;
    }

    requestAnimationFrame(tick);
  }

  function boot(){
    buildNotes();
    attachInputs();
    updateHUD(0);
    els.phaseBanner.textContent = 'Ready';
    setCoach('ฟังจังหวะ แล้วกดตอนโน้ตแตะเส้นล่างนะ');

    if(params.audio){
      ensureAudio();
    }

    requestAnimationFrame(tick);
  }

  boot();
})();