// === js/jump-duck-engine.js — Jump Duck Rush engine (research-ready v1.1 PATCH) ===
'use strict';

export function initJumpDuck(opts){
  const field         = opts.field;
  const obstaclesHost = opts.obstaclesHost;
  const avatar        = opts.avatar;
  const hud           = opts.hud || {};
  const feedbackEl    = opts.feedbackEl || null;

  const $fieldHitClass = { hit:'jd-hit', miss:'jd-miss' };

  // ===== CONFIG =====
  const DIFF_CONFIG = {
    easy:   { spawnIntervalMs: 1200, obstacleSpeedPx: 260, hpMiss: 5,  feverGainPerCorrect: 10 },
    normal: { spawnIntervalMs:  900, obstacleSpeedPx: 320, hpMiss: 8,  feverGainPerCorrect: 12 },
    hard:   { spawnIntervalMs:  700, obstacleSpeedPx: 400, hpMiss: 12, feverGainPerCorrect: 14 }
  };

  const FEVER = { threshold: 100, decayPerSec: 10, durationSec: 5 };

  // ===== STATE =====
  let mode        = 'training'; // ✅ training/test/research
  let diffKey     = 'normal';
  let durationSec = 60;

  let running     = false;
  let rafId       = null;

  let startPerf   = 0;
  let lastPerf    = 0;
  let elapsedSec  = 0;

  let hp          = 100;
  let score       = 0;
  let combo       = 0;
  let maxCombo    = 0;
  let missCount   = 0;

  let feverGauge  = 0;
  let feverActive = false;
  let feverRemain = 0;

  let spawnTimerMs = 0;
  let obstacles    = []; // {id,type,requiredAction,xPx,isJudged,hit,createdAtPerf,centerPerf,el}
  let nextObstacleId = 1;

  // research metadata
  let participantMeta = { participant_id:'', group:'', note:'' };
  let sessionId = '';

  // deterministic rng
  let seed = 0;
  let rng  = null;

  // counters for correct metrics
  let obstaclesSpawned = 0;
  let obstaclesJudged  = 0;
  let hitCount         = 0;

  // RT list (ms)
  const rtMsList = [];

  // loggers
  const eventRows   = [];
  const sessionRows = [];

  function resetLogger(){
    eventRows.length   = 0;
    sessionRows.length = 0;
  }

  function makeSessionId(){
    const t = new Date();
    const pad = (n)=>String(n).padStart(2,'0');
    return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
  }

  function readQueryNum(key, fallback){
    try{
      const v = new URL(location.href).searchParams.get(key);
      if (v == null || v === '') return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    }catch{
      return fallback;
    }
  }

  function makeRNG(seed0){
    // LCG deterministic
    let x = (Number(seed0) || Date.now()) >>> 0;
    return function(){
      x = (1664525 * x + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  // ====== EVENT LOGGING ======
  function logEvent(row){ eventRows.push(row); }
  function logSession(row){ sessionRows.push(row); }

  function toCsv(rows){
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const esc = (v)=>{
      if (v == null) return '';
      const s = String(v);
      if (s.includes('"') || s.includes(',') || s.includes('\n')){
        return '"' + s.replace(/"/g,'""') + '"';
      }
      return s;
    };
    const lines = [cols.join(',')];
    for (const r of rows){
      lines.push(cols.map(c=>esc(r[c])).join(','));
    }
    return lines.join('\n');
  }

  // ====== CORE ======

  function start(config){
    const cfg = config || {};

    // ✅ mode/diff แยกความหมายให้ชัด
    mode        = cfg.mode || 'training';         // training | test | research
    diffKey     = cfg.diff || 'normal';           // easy | normal | hard
    durationSec = Number(cfg.durationSec || 60);  // seconds
    participantMeta = cfg.meta || {participant_id:'', group:'', note:''};

    // ✅ deterministic seed: priority = cfg.seed -> ?seed= -> Date.now()
    seed = Number.isFinite(Number(cfg.seed)) ? Number(cfg.seed) : readQueryNum('seed', Date.now());
    rng  = makeRNG(seed);

    // prevent double start
    if (running) stop('restart');

    running       = true;
    startPerf     = performance.now();
    lastPerf      = startPerf;
    elapsedSec    = 0;

    hp            = 100;
    score         = 0;
    combo         = 0;
    maxCombo      = 0;
    missCount     = 0;

    feverGauge    = 0;
    feverActive   = false;
    feverRemain   = 0;

    spawnTimerMs  = 0;
    obstacles     = [];
    nextObstacleId= 1;

    obstaclesSpawned = 0;
    obstaclesJudged  = 0;
    hitCount         = 0;
    rtMsList.length  = 0;

    sessionId = makeSessionId();
    resetLogger();

    clearObstaclesDom();
    updateHud(0);

    showFeedback(mode === 'research'
      ? 'โหมดวิจัย: ตั้งใจหลบให้เต็มที่นะ!'
      : 'หลบสิ่งกีดขวางด้วย Jump / Duck ให้ทันเวลาค่ะ ✨');

    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function stop(reason){
    if (!running) return;
    running = false;
    if (rafId != null){ cancelAnimationFrame(rafId); rafId = null; }
    finalizeSession(reason || 'manual-stop');
  }

  function loop(now){
    if (!running) return;

    const dtMs  = (now - lastPerf);
    const dtSec = dtMs / 1000;
    lastPerf    = now;
    elapsedSec  = (now - startPerf) / 1000;

    // time end
    if (elapsedSec >= durationSec){
      elapsedSec = durationSec;
      updateHud(dtSec);
      stop('time-up');
      return;
    }

    const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;

    // spawn obstacles (✅ keep residual timer)
    spawnTimerMs += dtMs;

    // training อาจจะเร่งท้ายเกม (optional)
    let spawnInterval = diffCfg.spawnIntervalMs;
    if (mode === 'training'){
      const prog = Math.min(1, elapsedSec / durationSec);
      spawnInterval = diffCfg.spawnIntervalMs * Math.max(0.65, (1 - 0.25*prog));
    }

    while (spawnTimerMs >= spawnInterval){
      spawnTimerMs -= spawnInterval;
      spawnObstacle(now);
    }

    // move obstacles
    let speed = diffCfg.obstacleSpeedPx;
    if (mode === 'training'){
      const prog = Math.min(1, elapsedSec / durationSec);
      speed *= (1 + 0.20*prog);
    }
    updateObstacles(dtSec, speed, now);

    // update FEVER
    updateFever(dtSec);

    updateHud(dtSec);
    rafId = requestAnimationFrame(loop);
  }

  function spawnObstacle(nowPerf){
    const id = nextObstacleId++;

    // ✅ deterministic low/high
    const type = (rng ? rng() : Math.random()) < 0.5 ? 'low' : 'high';
    const requiredAction = type === 'low' ? 'jump' : 'duck';

    const el = document.createElement('div');
    el.className = 'jd-obstacle ' + (type === 'low' ? 'jd-obstacle--low' : 'jd-obstacle--high');
    el.dataset.id = String(id);
    el.textContent = (type === 'low' ? '⬆' : '⬇');

    obstaclesHost.appendChild(el);

    obstacles.push({
      id,
      type,
      requiredAction,
      xPx: field.clientWidth + 80,
      el,
      isJudged: false,
      hit: false,
      createdAtPerf: nowPerf,
      centerPerf: null
    });

    obstaclesSpawned++;
  }

  function clearObstaclesDom(){
    obstaclesHost.innerHTML = '';
  }

  function updateObstacles(dtSec, speedPxPerSec, nowPerf){
    const hitLineX = field.clientWidth * 0.20; // ใกล้ avatar

    for (const ob of obstacles){
      ob.xPx -= speedPxPerSec * dtSec;

      if (ob.el){
        ob.el.style.transform = `translate3d(${ob.xPx}px,0,0)`;
      }

      // mark center time once
      if (!ob.centerPerf && ob.xPx <= hitLineX){
        ob.centerPerf = nowPerf;
      }

      // ถ้าผ่านเส้นชนไปแล้วและยังไม่ถูก judge → miss (late)
      if (!ob.isJudged && ob.xPx < hitLineX - 40){
        applyMiss(ob, 'late-no-action', '', elapsedSec, nowPerf);
      }
    }

    obstacles = obstacles.filter(ob => {
      if (ob.xPx < -120){
        if (ob.el && ob.el.parentNode){
          ob.el.parentNode.removeChild(ob.el);
        }
        return false;
      }
      return true;
    });
  }

  function handleAction(action){
    if (!running) return;

    const nowPerf  = performance.now();
    const songTime = elapsedSec;

    const hitLineX = field.clientWidth * 0.20;

    // หา obstacle ที่ใกล้เส้นชนที่สุดและยังไม่ถูก judge
    let candidate = null;
    let minDist = Infinity;

    for (const ob of obstacles){
      if (ob.isJudged) continue;
      const d = Math.abs(ob.xPx - hitLineX);
      if (d < minDist){
        minDist = d;
        candidate = ob;
      }
    }

    // window ในหน่วย px ที่ถือว่าอยู่ในเขตชน
    const windowPx = 40;

    if (!candidate || minDist > windowPx){
      fakeMissTap(action, songTime, nowPerf);
      return;
    }

    if (candidate.requiredAction === action){
      applyHit(candidate, action, songTime, nowPerf);
    }else{
      applyMiss(candidate, 'wrong-action', action, songTime, nowPerf);
    }
  }

  function applyHit(ob, action, songTime, perf){
    ob.isJudged = true;
    ob.hit = true;

    obstaclesJudged++;
    hitCount++;

    combo++;
    if (combo > maxCombo) maxCombo = combo;

    const baseScore  = 100;
    const feverBonus = (feverActive ? 1.5 : 1);
    const gain       = Math.round(baseScore * feverBonus);
    score += gain;

    // RT (ms): use centerPerf when available
    const tRef = ob.centerPerf || perf;
    const rtMs = Math.max(0, perf - tRef);
    rtMsList.push(rtMs);

    const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
    feverGauge = Math.min(100, feverGauge + diffCfg.feverGainPerCorrect);

    if (feverGauge >= FEVER.threshold && !feverActive){
      feverActive = true;
      feverRemain = FEVER.durationSec;
      playFeverSfx();
      showFeedback('🔥 FEVER! เก็บคะแนนให้รัว ๆ เลย!');
    }else{
      showFeedback(action === 'jump' ? 'ดีมาก! กระโดดหลบสวยเลย ✨' : 'เยี่ยม! ก้มหลบได้ทันเวลา 🙌');
    }

    flashField('hit');

    logEvent({
      session_id: sessionId,
      participant_id: participantMeta.participant_id || '',
      group:          participantMeta.group || '',
      note:           participantMeta.note || '',
      mode,
      diff: diffKey,
      seed,
      created_at_iso: new Date().toISOString(),

      event_type: 'hit',
      song_time_s: songTime.toFixed(3),
      obstacle_id: ob.id,
      obstacle_type: ob.type,
      required_action: ob.requiredAction,
      action,
      rt_ms: Math.round(rtMs),
      hit: 1,
      miss_reason: '',
      combo_after: combo,
      score_delta: gain,
      score_total: score,
      hp_after: hp,
      fever_after: feverGauge,
      fever_active: feverActive ? 1 : 0
    });

    updateHud(0);
  }

  function applyMiss(ob, reason, action, songTime, perf){
    if (ob && !ob.isJudged){
      ob.isJudged = true;
      ob.hit = false;
      obstaclesJudged++;
    }

    combo = 0;
    missCount++;

    const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
    hp = Math.max(0, hp - diffCfg.hpMiss);

    flashField('miss');

    if (hp <= 0){
      running = false;
      showFeedback('จบเกม: HP หมดแล้ว ลองใหม่อีกครั้งได้เลยนะ 💪');
      if (rafId != null){ cancelAnimationFrame(rafId); rafId = null; }
      finalizeSession('hp-zero');
      return;
    }else{
      showFeedback('พลาด! ลองจับจังหวะใหม่อีกทีนะ');
    }

    logEvent({
      session_id: sessionId,
      participant_id: participantMeta.participant_id || '',
      group:          participantMeta.group || '',
      note:           participantMeta.note || '',
      mode,
      diff: diffKey,
      seed,
      created_at_iso: new Date().toISOString(),

      event_type: 'miss',
      song_time_s: songTime != null ? songTime.toFixed(3) : '',
      obstacle_id: ob ? ob.id : '',
      obstacle_type: ob ? ob.type : '',
      required_action: ob ? ob.requiredAction : '',
      action: action || '',
      rt_ms: '',
      hit: 0,
      miss_reason: reason || '',
      combo_after: combo,
      score_delta: 0,
      score_total: score,
      hp_after: hp,
      fever_after: feverGauge,
      fever_active: feverActive ? 1 : 0
    });

    updateHud(0);
  }

  function fakeMissTap(action, songTime, perf){
    combo = 0;
    missCount++;

    const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
    hp = Math.max(0, hp - diffCfg.hpMiss * 0.7);

    showFeedback('แตะคลาดจังหวะนิดหน่อย ลองใหม่อีกทีนะ 🎧');
    flashField('miss');

    logEvent({
      session_id: sessionId,
      participant_id: participantMeta.participant_id || '',
      group:          participantMeta.group || '',
      note:           participantMeta.note || '',
      mode,
      diff: diffKey,
      seed,
      created_at_iso: new Date().toISOString(),

      event_type: 'miss-tap',
      song_time_s: songTime != null ? songTime.toFixed(3) : '',
      obstacle_id: '',
      obstacle_type: '',
      required_action: '',
      action: action || '',
      rt_ms: '',
      hit: 0,
      miss_reason: 'tap-out-of-window',
      combo_after: combo,
      score_delta: 0,
      score_total: score,
      hp_after: hp,
      fever_after: feverGauge,
      fever_active: feverActive ? 1 : 0
    });

    if (hp <= 0){
      running = false;
      if (rafId != null){ cancelAnimationFrame(rafId); rafId = null; }
      finalizeSession('hp-zero');
    }else{
      updateHud(0);
    }
  }

  function updateFever(dtSec){
    if (feverActive){
      feverRemain -= dtSec;
      if (feverRemain <= 0){
        feverActive = false;
        feverRemain = 0;
        showFeedback('FEVER จบแล้ว ลองสะสมเกจใหม่อีกรอบ!');
      }
    }else{
      feverGauge = Math.max(0, feverGauge - FEVER.decayPerSec * dtSec);
    }
  }

  function updateHud(dtSec){
    if (hud.score) hud.score.textContent = String(score);
    if (hud.combo) hud.combo.textContent = String(combo);
    if (hud.miss)  hud.miss.textContent  = String(missCount);
    if (hud.hp)    hud.hp.textContent    = String(hp);
    if (hud.time)  hud.time.textContent  = elapsedSec.toFixed(1);

    const prog = Math.min(1, elapsedSec / durationSec);
    if (hud.progFill) hud.progFill.style.transform = `scaleX(${prog.toFixed(3)})`;
    if (hud.progText) hud.progText.textContent = Math.round(prog * 100) + '%';

    const feverRatio = Math.min(1, feverGauge / 100);
    if (hud.feverFill) hud.feverFill.style.transform = `scaleX(${feverRatio.toFixed(3)})`;
    if (hud.feverStatus){
      if (feverActive){
        hud.feverStatus.textContent = 'FEVER!';
        hud.feverStatus.classList.add('on');
      }else{
        hud.feverStatus.textContent = 'Ready';
        hud.feverStatus.classList.remove('on');
      }
    }
  }

  function flashField(kind){
    if (!field) return;
    const cls = $fieldHitClass[kind];
    if (!cls) return;
    field.classList.add(cls);
    setTimeout(()=>field.classList.remove(cls), 260);
  }

  function showFeedback(msg){
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
  }

  function playFeverSfx(){
    const el = document.getElementById('jd-sfx-fever');
    if (!el) return;
    try{ el.currentTime = 0; el.play().catch(()=>{}); }catch{}
  }

  function finalizeSession(endReason){
    // ✅ accuracy = hits / judged obstacles (exclude miss-tap)
    const judged = obstaclesJudged || 0;
    const hits   = hitCount || 0;
    const accPct = judged ? (hits / judged) * 100 : 0;

    // RT mean (ms)
    const rtMean = rtMsList.length ? (rtMsList.reduce((a,b)=>a+b,0) / rtMsList.length) : 0;

    const row = {
      session_id: sessionId,
      participant_id: participantMeta.participant_id || '',
      group:          participantMeta.group || '',
      note:           participantMeta.note || '',
      mode,
      diff: diffKey,
      seed,
      duration_sec: elapsedSec.toFixed(2),
      duration_planned_sec: durationSec,
      obstacles_spawned: obstaclesSpawned,
      obstacles_judged: judged,
      hits_total: hits,
      miss_total: missCount,
      acc_pct: accPct.toFixed(2),
      rt_mean_ms: rtMean ? rtMean.toFixed(1) : '',
      score_final: score,
      max_combo: maxCombo,
      hp_end: hp,
      end_reason: endReason,
      created_at_iso: new Date().toISOString()
    };
    logSession(row);

    fillResult(endReason, accPct, rtMean);
  }

  function fillResult(endReason, accPct, rtMean){
    const setText = (id,v)=>{
      const el = document.getElementById(id);
      if (el) el.textContent = String(v);
    };

    setText('jd-res-mode', mode === 'research' ? 'Research' : (mode === 'test' ? 'Test' : 'Training'));
    setText('jd-res-diff', diffKey === 'easy' ? 'Easy' : diffKey === 'hard' ? 'Hard' : 'Normal');
    setText('jd-res-endreason', endReason);
    setText('jd-res-score', score);
    setText('jd-res-maxcombo', maxCombo);

    const jumpOk = eventRows.filter(r => r.event_type === 'hit' && r.required_action === 'jump').length;
    const duckOk = eventRows.filter(r => r.event_type === 'hit' && r.required_action === 'duck').length;

    setText('jd-res-jump-ok', jumpOk);
    setText('jd-res-duck-ok', duckOk);
    setText('jd-res-miss', missCount);
    setText('jd-res-acc', Number(accPct).toFixed(1) + ' %');
    setText('jd-res-rtmean', rtMean ? Number(rtMean).toFixed(0) + ' ms' : '-');
    setText('jd-res-duration', elapsedSec.toFixed(1) + ' s');

    setText('jd-res-participant', participantMeta.participant_id || '-');
    setText('jd-res-group',       participantMeta.group || '-');
    setText('jd-res-note',        participantMeta.note || '-');
    setText('jd-res-seed',        seed);

    const resView  = document.getElementById('jd-view-result') || document.getElementById('jd-view-result');
    const playView = document.getElementById('jd-view-play')   || document.getElementById('jd-view-play');
    if (resView && playView){
      playView.classList.add('jd-hidden');
      resView.classList.remove('jd-hidden');
    }
  }

  // === public API ===
  return {
    start,
    stop,
    handleAction,
    getEventsCsv(){  return toCsv(eventRows); },
    getSessionCsv(){ return toCsv(sessionRows); },

    // convenience summaries (useful for research)
    getSummary(){
      const judged = obstaclesJudged || 0;
      const hits   = hitCount || 0;
      const accPct = judged ? (hits / judged) * 100 : 0;
      const rtMean = rtMsList.length ? (rtMsList.reduce((a,b)=>a+b,0) / rtMsList.length) : 0;

      return {
        session_id: sessionId,
        participant_id: participantMeta.participant_id || '',
        group: participantMeta.group || '',
        note: participantMeta.note || '',
        mode,
        diff: diffKey,
        seed,
        duration_planned_s: durationSec,
        duration_actual_s: +elapsedSec.toFixed(2),
        obstacles_spawned: obstaclesSpawned,
        obstacles_judged: judged,
        hits_total: hits,
        miss_total: missCount,
        acc_pct: +accPct.toFixed(2),
        rt_mean_ms: rtMean ? +rtMean.toFixed(1) : 0,
        score_final: score,
        max_combo: maxCombo,
        hp_end: hp
      };
    }
  };
}