// === Rhythm Boxer Engine — rhythm-engine.js (2025-11-20 — stable beat spawn) ===

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

  let currentGame = null;
  let lastConfig  = null;

  function show(name) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[name].classList.remove('hidden');
  }

  // ---------- เมื่อเกมจบ: เติม result view ----------
  function onGameFinish(result) {
    res.mode.textContent      = result.mode === 'research' ? 'Research' : 'Normal';
    res.diff.textContent      = result.difficulty;
    res.reason.textContent    = result.reason;
    res.score.textContent     = result.score;
    res.maxcombo.textContent  = result.maxCombo;
    res.miss.textContent      = result.miss;
    res.totalHits.textContent = result.totalHits;

    res.acc.textContent       = (result.rhythmAccuracy * 100).toFixed(1) + '%';
    res.rtNormal.textContent  = result.avgOffset.toFixed(1) + ' ms';
    res.rtOffset.textContent  = result.avgOffset.toFixed(1) + ' ms';

    const pid = $('#research-id')?.value || '-';
    res.pid.textContent = pid;

    show('result');
  }

  // ---------- Core เกม Rhythm Boxer ----------
  function createGame(config) {
    const difficulty = config.difficulty || 'normal';
    const mode       = config.mode || 'normal';

    // ตั้งค่า BPM ตามระดับ
    const bpm = (difficulty === 'easy'
      ? 80
      : difficulty === 'hard'
        ? 130
        : 104);

    const beatInterval = 60000 / bpm;   // ms ต่อ 1 beat
    const durationMs   = 60000;         // เล่น 60 วิ

    const state = {
      running: false,
      startTime: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      miss: 0,
      totalHits: 0,
      offsets: [],        // เก็บ offset ms ของการตี
      beatIndex: 0,
      timeLeft: 60,
      rafId: null,
      beatTimer: null,
    };

    function updateHUD() {
      stat.mode.textContent    = mode === 'research' ? 'Research' : 'Normal';
      stat.diff.textContent    = difficulty;
      stat.score.textContent   = state.score;
      stat.combo.textContent   = state.combo;
      stat.perfect.textContent = state.perfect;
      stat.miss.textContent    = state.miss;
      stat.time.textContent    = state.timeLeft.toFixed(1);
    }

    function updateGroove() {
      const w = Math.min(100, state.combo * 2);
      grooveFill.style.width = w + '%';

      if (state.combo >= 12)      grooveStatus.textContent = 'GREAT!';
      else if (state.combo >= 6)  grooveStatus.textContent = 'ON BEAT';
      else                        grooveStatus.textContent = 'WARM UP';
    }

    function updateTrackProgress(progress) {
      const p = Math.min(1, Math.max(0, progress));
      trackFill.style.width = (p * 100).toFixed(1) + '%';
      if (p >= 0.99) trackName.textContent = 'Track — ENDING';
      else           trackName.textContent = 'Track 1 — Basic Beat';
    }

    function spawnTarget(beatIndex) {
      const hostRect = targetLayer.getBoundingClientRect();
      if (!hostRect.width || !hostRect.height) return;

      const x = (0.3 + Math.random() * 0.4) * hostRect.width;
      const y = (0.3 + Math.random() * 0.4) * hostRect.height;

      const el = document.createElement('div');
      el.className = 'rb-target';
      el.textContent = '🥊';
      el.style.left = x + 'px';
      el.style.top  = y + 'px';

      // เวลา beat ที่ควรจะตี (ms) นับจากเริ่มเกม
      const beatTimeMs = beatIndex * beatInterval;

      const target = {
        el,
        beatTimeMs,
        hit: false,
      };

      el.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        if (!state.running || target.hit) return;
        target.hit = true;
        handleHit(target);
      }, { passive: false });

      targetLayer.appendChild(el);

      // auto miss ถ้าเลยหน้าต่างเวลาไปแล้ว
      const missWindow = (difficulty === 'easy' ? 240
                        : difficulty === 'hard' ? 140
                        : 180);
      setTimeout(() => {
        if (!state.running || target.hit) return;
        target.hit = true;
        handleMiss(target);
      }, missWindow);
    }

    function handleHit(target) {
      const nowDelta = performance.now() - state.startTime; // ms จากเริ่มเกม
      const offsetMs = nowDelta - target.beatTimeMs;
      const abs      = Math.abs(offsetMs);

      let grade, delta;
      if (abs <= 60) {
        grade = 'PERFECT';
        delta = 300;
        state.perfect++;
      } else if (abs <= 120) {
        grade = 'GOOD';
        delta = 150;
      } else {
        grade = 'BAD';
        delta = 50;
      }

      state.score += delta;
      state.combo++;
      state.totalHits++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.offsets.push(offsetMs);

      // visual เล็กน้อย: ยุบ/หาย
      target.el.style.transform += ' scale(0.8)';
      target.el.style.opacity = '0';
      setTimeout(() => {
        if (target.el && target.el.parentNode) target.el.parentNode.removeChild(target.el);
      }, 120);

      if (sfxHit) {
        try { sfxHit.currentTime = 0; sfxHit.play(); } catch {}
      }

      updateGroove();
      updateHUD();
    }

    function handleMiss(target) {
      state.miss++;
      state.combo = 0;

      if (target.el && target.el.parentNode) {
        target.el.parentNode.removeChild(target.el);
      }

      updateGroove();
      updateHUD();
    }

    function loopTime() {
      if (!state.running) return;
      const now = performance.now();
      const elapsed = now - state.startTime;
      const leftMs  = Math.max(0, durationMs - elapsed);
      state.timeLeft = leftMs / 1000;

      updateHUD();
      updateTrackProgress(elapsed / durationMs);

      if (leftMs <= 0) {
        finish('timeout');
        return;
      }
      state.rafId = requestAnimationFrame(loopTime);
    }

    function startBeatLoop() {
      // เคลียร์เผื่อเหลือจากรอบก่อน
      if (state.beatTimer) clearInterval(state.beatTimer);

      state.beatIndex = 0;
      state.beatTimer = setInterval(() => {
        if (!state.running) return;

        const now = performance.now();
        const elapsed = now - state.startTime;
        if (elapsed >= durationMs) {
          clearInterval(state.beatTimer);
          return;
        }

        spawnTarget(state.beatIndex);
        if (sfxBeat) {
          try { sfxBeat.currentTime = 0; sfxBeat.play(); } catch {}
        }
        state.beatIndex++;
      }, beatInterval);
    }

    function start() {
      // reset state
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

      updateHUD();

      state.running = true;
      state.startTime = performance.now();

      state.rafId = requestAnimationFrame(loopTime);
      startBeatLoop();
    }

    function finish(reason) {
      if (!state.running) return;
      state.running = false;

      if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
      if (state.beatTimer) {
        clearInterval(state.beatTimer);
        state.beatTimer = null;
      }

      let avgOffset = 0;
      if (state.offsets.length > 0) {
        avgOffset = state.offsets.reduce((a,b)=>a+b,0) / state.offsets.length;
      }

      const totalEvents = Math.max(1, state.beatIndex); // กันหารศูนย์
      const acc = state.totalHits / totalEvents;

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

    return { start, stopEarly };
  }

  // ---------- startGame + binding ----------

  function startGame(config) {
    lastConfig = config;
    currentGame = createGame(config);
    show('play');
    currentGame.start();
  }

  // ปุ่มเมนู
  const btnStartResearch = views.menu.querySelector('[data-action="start-research"]');
  const btnStartNormal   = views.menu.querySelector('[data-action="start-normal"]');

  btnStartResearch?.addEventListener('click', ()=>{
    show('research');
  });

  btnStartNormal?.addEventListener('click', ()=>{
    const diff = $('#difficulty').value || 'normal';
    startGame({ mode:'normal', difficulty: diff });
  });

  // ฟอร์มวิจัย
  $$('#view-research-form [data-action="back-to-menu"]').forEach(btn=>{
    btn.addEventListener('click', ()=>show('menu'));
  });

  const btnResearchBegin = $('#view-research-form [data-action="research-begin-play"]');
  btnResearchBegin?.addEventListener('click', ()=>{
    const diff = $('#difficulty').value || 'normal';
    startGame({ mode:'research', difficulty: diff });
  });

  // ปุ่มในหน้าเล่น
  $('#view-play [data-action="stop-early"]')?.addEventListener('click', ()=>{
    if (currentGame) currentGame.stopEarly();
  });

  // ปุ่มในหน้า result
  $('#view-result [data-action="back-to-menu"]')?.addEventListener('click', ()=>{
    show('menu');
  });

  $('#view-result [data-action="play-again"]')?.addEventListener('click', ()=>{
    if (lastConfig) startGame(lastConfig);
    else show('menu');
  });

  $('#view-result [data-action="download-csv"]')?.addEventListener('click', ()=>{
    alert('TODO: CSV Export (จะใช้โครงเดียวกับ Shadow Breaker)');
  });

  // เริ่มที่เมนู
  show('menu');
}