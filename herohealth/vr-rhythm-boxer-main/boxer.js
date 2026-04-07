(() => {
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

  const params = {
    pid: qs.get('pid') || 'anon',
    nick: qs.get('nick') || '',
    mode: (qs.get('mode') || 'active').toLowerCase(),
    diff: (qs.get('diff') || 'normal').toLowerCase(),
    durSec: clamp(Number(qs.get('dur') || 120), 30, 600),
    bpm: clamp(Number(qs.get('bpm') || 112), 72, 180),
    view: (qs.get('view') || 'mobile').toLowerCase(),
    seed: qs.get('seed') || String(Date.now()),
    hub: qs.get('hub') || '../hub.html'
  };

  const ACTIONS = {
    jab:   { lane: 0, label: 'Jab',   icon: '👊', key: 'KeyA', alt: 'ArrowLeft'  },
    cross: { lane: 1, label: 'Cross', icon: '💥', key: 'KeyL', alt: 'ArrowRight' },
    block: { lane: 2, label: 'Block', icon: '🛡', key: 'KeyW', alt: 'ArrowUp'    },
    duck:  { lane: 3, label: 'Duck',  icon: '⬇', key: 'KeyS', alt: 'ArrowDown'  }
  };

  const WINDOWS = { perfect: 80, great: 140, good: 220 };
  const beatMs = 60000 / params.bpm;
  const totalMs = params.durSec * 1000;
  const travelMs = params.view === 'pc' ? 1500 : (params.view === 'cvr' ? 1700 : 1600);
  const startDelayMs = 3000;
  const rng = mulberry32(xmur3(`${params.seed}|${params.pid}|${params.mode}|${params.diff}`)());

  const els = {
    subline: $('subline'),
    btnBackHubTop: $('btnBackHubTop'),
    btnBackHubBottom: $('btnBackHubBottom'),
    scoreValue: $('scoreValue'),
    comboValue: $('comboValue'),
    accValue: $('accValue'),
    timeValue: $('timeValue'),
    coachText: $('coachText'),
    arena: $('arena'),
    hitLine: $('hitLine'),
    laneHitRow: $('laneHitRow'),
    noteLayer: $('noteLayer'),
    countdownLayer: $('countdownLayer'),
    countdownNum: $('countdownNum'),
    phaseBanner: $('phaseBanner'),
    feedbackPop: $('feedbackPop'),
    cvrCrosshair: $('cvrCrosshair'),
    cvrFocusLabel: $('cvrFocusLabel'),
    pcHint: $('pcHint'),
    summaryOverlay: $('summaryOverlay'),
    sumScore: $('sumScore'),
    sumAcc: $('sumAcc'),
    sumCombo: $('sumCombo'),
    summaryGrade: $('summaryGrade'),
    btnReplay: $('btnReplay')
  };

  els.subline.textContent = `${params.view.toUpperCase()} • ${params.mode.toUpperCase()} • ${params.diff.toUpperCase()} • ${params.bpm} BPM`;
  els.btnBackHubTop.href = params.hub;
  els.btnBackHubBottom.href = params.hub;

  const laneEls = [...document.querySelectorAll('.lane')];
  const laneHitButtons = [...document.querySelectorAll('.lane-hit')];
  const isTouchPrimary =
    params.view === 'mobile' ||
    ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) && params.view !== 'pc');

  if(params.view === 'cvr'){
    els.cvrCrosshair.classList.remove('hidden');
    els.cvrFocusLabel.classList.remove('hidden');
    els.pcHint.classList.add('hidden');
  } else if(params.view !== 'pc'){
    els.pcHint.classList.add('hidden');
  }

  const state = {
    started: false,
    ended: false,
    startAt: performance.now() + startDelayMs,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
    blankTap: 0,
    offsets: [],
    notes: [],
    totalNotes: 0,
    currentCvrLane: 0,
    lastFeedbackHideAt: 0
  };

  function setCoach(text){
    els.coachText.textContent = text;
  }

  function showFeedback(text){
    els.feedbackPop.textContent = text;
    els.feedbackPop.className = 'feedback-pop show';
    state.lastFeedbackHideAt = performance.now() + 360;
  }

  function clearFeedback(now){
    if(state.lastFeedbackHideAt && now >= state.lastFeedbackHideAt){
      state.lastFeedbackHideAt = 0;
      els.feedbackPop.className = 'feedback-pop';
      els.feedbackPop.textContent = '';
    }
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

  function computeAccuracyPercent(){
    if(state.totalNotes <= 0) return 0;
    const weighted = (state.perfect * 1.0) + (state.great * 0.8) + (state.good * 0.55);
    return Math.round((weighted / state.totalNotes) * 100);
  }

  function computeGrade(acc){
    const perfectRate = state.totalNotes > 0 ? (state.perfect / state.totalNotes) * 100 : 0;
    const comboScore = Math.min(100, state.maxCombo * 2.2);
    const weighted = (acc * 0.74) + (perfectRate * 0.16) + (comboScore * 0.10);
    if(weighted >= 90) return 'S';
    if(weighted >= 80) return 'A';
    if(weighted >= 70) return 'B';
    if(weighted >= 58) return 'C';
    return 'D';
  }

  function makePattern(label, steps){
    const maxBeat = Math.max(...steps.map(s => s.beat));
    return { label, steps, len: maxBeat + 1 };
  }

  const POOLS = {
    warmup: [
      makePattern('Jab', [{ action:'jab', beat:0 }]),
      makePattern('Cross', [{ action:'cross', beat:0 }]),
      makePattern('Block', [{ action:'block', beat:0 }]),
      makePattern('Duck', [{ action:'duck', beat:0 }]),
      makePattern('Jab → Cross', [{ action:'jab', beat:0 }, { action:'cross', beat:1 }])
    ],
    main: [
      makePattern('Jab → Cross', [{ action:'jab', beat:0 }, { action:'cross', beat:1 }]),
      makePattern('Block → Cross', [{ action:'block', beat:0 }, { action:'cross', beat:1 }]),
      makePattern('Jab → Duck → Cross', [{ action:'jab', beat:0 }, { action:'duck', beat:1 }, { action:'cross', beat:2 }]),
      makePattern('Jab → Cross → Block', [{ action:'jab', beat:0 }, { action:'cross', beat:1 }, { action:'block', beat:2 }])
    ],
    boss: [
      makePattern('Jab → Cross → Block', [{ action:'jab', beat:0 }, { action:'cross', beat:1 }, { action:'block', beat:2 }]),
      makePattern('Jab → Duck → Cross → Block', [{ action:'jab', beat:0 }, { action:'duck', beat:1 }, { action:'cross', beat:2 }, { action:'block', beat:3 }]),
      makePattern('Block → Jab → Cross → Duck', [{ action:'block', beat:0 }, { action:'jab', beat:1 }, { action:'cross', beat:2 }, { action:'duck', beat:3 }])
    ]
  };

  function choosePattern(segment){
    const pool = segment === 'warmup' ? POOLS.warmup : (segment === 'boss' ? POOLS.boss : POOLS.main);
    return pool[Math.floor(rng() * pool.length)];
  }

  function generateSchedule(){
    const notes = [];
    let t = 1500;
    let id = 1;

    while(t < totalMs - 800){
      const phase = t < totalMs * 0.18 ? 'warmup' : (t < totalMs * 0.78 ? 'main' : 'boss');
      const pattern = choosePattern(phase);

      for(const step of pattern.steps){
        const hitTime = t + (step.beat * beatMs);
        if(hitTime >= totalMs - 240) continue;
        notes.push({
          id:`n${id++}`,
          action: step.action,
          lane: ACTIONS[step.action].lane,
          hitTime,
          spawnTime: hitTime - travelMs,
          judged:false,
          el:null,
          phase
        });
      }

      t += (pattern.len + (phase === 'boss' ? 0.45 : 0.72) + rng() * 0.2) * beatMs;
    }

    state.totalNotes = notes.length;
    return notes.sort((a,b) => a.hitTime - b.hitTime);
  }

  function buildNoteEl(note){
    const el = document.createElement('div');
    el.className = `note note--${note.action}`;
    el.innerHTML = `<div class="note-icon">${ACTIONS[note.action].icon}</div>`;
    els.noteLayer.appendChild(el);
    note.el = el;
  }

  function layoutNote(note, elapsed){
    const arenaRect = els.arena.getBoundingClientRect();
    const lineRect = els.hitLine.getBoundingClientRect();
    const lineY = lineRect.top - arenaRect.top + (lineRect.height / 2);
    const laneWidth = arenaRect.width / 4;
    const laneCenterX = (laneWidth * note.lane) + (laneWidth / 2);

    const progress = (elapsed - note.spawnTime) / (note.hitTime - note.spawnTime);
    const clamped = clamp(progress, -0.35, 1.18);
    const easedCore = clamp(progress, 0, 1);
    const eased = 1 - Math.pow(1 - easedCore, 2.1);

    const startY = 28;
    const y = progress < 0
      ? startY + (lineY - startY) * clamped
      : startY + (lineY - startY) * eased;

    note.el.style.left = `${laneCenterX}px`;
    note.el.style.transform = `translate(-50%, ${y}px) scale(${0.86 + eased * 0.18})`;

    if(elapsed < note.spawnTime - 120) note.el.style.display = 'none';
    else note.el.style.display = '';
  }

  function nearestNote(action, elapsed){
    let best = null;
    let bestAbs = Infinity;
    for(const n of state.notes){
      if(n.action !== action || n.judged) continue;
      const abs = Math.abs(elapsed - n.hitTime);
      if(abs <= WINDOWS.good && abs < bestAbs){
        best = n;
        bestAbs = abs;
      }
    }
    return best;
  }

  function pressAction(action){
    if(state.ended || !state.started) return;
    const elapsed = performance.now() - state.startAt;
    const note = nearestNote(action, elapsed);

    if(note){
      const offset = elapsed - note.hitTime;
      const result = judgeFromOffset(offset);

      if(result !== 'miss'){
        note.judged = true;
        if(note.el) note.el.remove();

        state.offsets.push(offset);
        state.combo += 1;
        state.maxCombo = Math.max(state.maxCombo, state.combo);

        if(result === 'perfect') state.perfect += 1;
        else if(result === 'great') state.great += 1;
        else state.good += 1;

        state.score += scoreFor(result, state.combo);
        showFeedback(result.toUpperCase());
        if(state.combo > 0 && state.combo % 10 === 0){
          setCoach(`${state.combo} COMBO!`);
        }
      } else {
        state.combo = 0;
        state.miss += 1;
        showFeedback('MISS');
      }
    } else {
      state.blankTap += 1;
      state.combo = 0;
      showFeedback('MISS');
    }
  }

  function updateHUD(elapsed){
    els.scoreValue.textContent = String(Math.round(state.score));
    els.comboValue.textContent = String(state.combo);
    els.accValue.textContent = `${computeAccuracyPercent()}%`;
    const secLeft = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
    els.timeValue.textContent = fmtTime(secLeft);
  }

  function updateCvrFocus(){
    if(params.view !== 'cvr') return;
    const labelByLane = ['JAB', 'CROSS', 'BLOCK', 'DUCK'];
    els.cvrFocusLabel.textContent = labelByLane[state.currentCvrLane] || 'JAB';
  }

  function bindPcInput(){
    window.addEventListener('keydown', (ev) => {
      if(ev.repeat) return;
      const action = Object.keys(ACTIONS).find(k => ACTIONS[k].key === ev.code || ACTIONS[k].alt === ev.code);
      if(action){
        ev.preventDefault();
        pressAction(action);
      }
    });
  }

  function bindMobileInput(){
    laneHitButtons.forEach(btn => {
      const action = btn.dataset.action;
      btn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        pressAction(action);
      });
      btn.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        pressAction(action);
      }, { passive:false });
    });
  }

  function bindCvrInput(){
    let gamma = 0;

    if(window.DeviceOrientationEvent){
      window.addEventListener('deviceorientation', (ev) => {
        if(typeof ev.gamma === 'number') gamma = ev.gamma;
      });
    }

    window.addEventListener('mousemove', (ev) => {
      if(params.view !== 'cvr') return;
      const ratio = ev.clientX / Math.max(1, window.innerWidth);
      gamma = (ratio * 80) - 40;
    });

    function updateLaneFromGamma(){
      const g = clamp(gamma, -40, 40);
      const lane = g < -20 ? 0 : g < 0 ? 1 : g < 20 ? 2 : 3;
      state.currentCvrLane = lane;
      updateCvrFocus();
      requestAnimationFrame(updateLaneFromGamma);
    }
    updateLaneFromGamma();

    const trigger = () => {
      const actions = ['jab', 'cross', 'block', 'duck'];
      pressAction(actions[state.currentCvrLane] || 'jab');
    };

    window.addEventListener('click', trigger);
    window.addEventListener('touchstart', (ev) => {
      ev.preventDefault();
      trigger();
    }, { passive:false });
    window.addEventListener('keydown', (ev) => {
      if(ev.code === 'Space' || ev.code === 'Enter'){
        ev.preventDefault();
        trigger();
      }
    });
  }

  function attachInputs(){
    if(params.view === 'pc') bindPcInput();
    else if(params.view === 'mobile') bindMobileInput();
    else bindCvrInput();
  }

  function updateCountdown(now){
    const remain = state.startAt - now;
    if(remain <= 0){
      els.countdownLayer.classList.add('hidden');
      if(!state.started){
        state.started = true;
        setCoach(
          params.view === 'pc' ? 'กด A / L / W / S ตามจังหวะ'
          : params.view === 'mobile' ? 'แตะในช่องตอนโน้ตถึงเส้น'
          : 'หันเล็งช่องด้วยหัว แล้วแตะหรือกด trigger'
        );
      }
      return;
    }
    els.countdownNum.textContent = String(Math.ceil(remain / 1000));
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
    updateHUD(elapsed);

    const phase = elapsed < totalMs * 0.18 ? 'Warmup' : (elapsed < totalMs * 0.78 ? 'Main' : 'Boss');
    els.phaseBanner.textContent = phase;

    for(const note of state.notes){
      if(note.judged) continue;
      if(elapsed > note.hitTime + WINDOWS.good){
        note.judged = true;
        state.miss += 1;
        state.combo = 0;
        if(note.el) note.el.remove();
        continue;
      }
      if(note.el) layoutNote(note, elapsed);
    }

    if(elapsed >= totalMs){
      endGame();
      return;
    }

    requestAnimationFrame(tick);
  }

  function endGame(){
    if(state.ended) return;
    state.ended = true;

    const acc = computeAccuracyPercent();
    const grade = computeGrade(acc);

    els.sumScore.textContent = String(Math.round(state.score));
    els.sumAcc.textContent = `${acc}%`;
    els.sumCombo.textContent = String(state.maxCombo);
    els.summaryGrade.textContent = grade;

    els.btnReplay.href = (() => {
      const url = new URL(location.href);
      url.searchParams.set('seed', String(Date.now()));
      return url.toString();
    })();

    els.summaryOverlay.classList.remove('hidden');
  }

  function boot(){
    state.notes = generateSchedule();
    state.notes.forEach(buildNoteEl);
    attachInputs();
    updateCvrFocus();
    requestAnimationFrame(tick);
  }

  boot();
})();