// === js/jump-duck-engine.js — Jump Duck Rush engine (research-ready v1) ===
'use strict';

export function initJumpDuck(opts){
  const field        = opts.field;
  const obstaclesHost= opts.obstaclesHost;
  const avatar       = opts.avatar;
  const hud          = opts.hud || {};
  const feedbackEl   = opts.feedbackEl || null;

  const $fieldHitClass = {
    hit:  'jd-hit',
    miss: 'jd-miss'
  };

  // ===== CONFIG =====
  const DIFF_CONFIG = {
    easy: {
      spawnIntervalMs: 1200,
      obstacleSpeedPx: 260,   // px/sec
      hpMiss: 5,
      feverGainPerCorrect: 10
    },
    normal: {
      spawnIntervalMs: 900,
      obstacleSpeedPx: 320,
      hpMiss: 8,
      feverGainPerCorrect: 12
    },
    hard: {
      spawnIntervalMs: 700,
      obstacleSpeedPx: 400,
      hpMiss: 12,
      feverGainPerCorrect: 14
    }
  };

  const FEVER = {
    threshold: 100,
    decayPerSec: 10,
    durationSec: 5
  };

  // ===== STATE =====
  let mode        = 'normal';
  let diffKey     = 'normal';
  let durationSec = 60;

  let running = false;
  let startPerf = 0;
  let lastPerf  = 0;
  let elapsedSec= 0;
  let hp        = 100;
  let score     = 0;
  let combo     = 0;
  let missCount = 0;
  let feverGauge= 0;
  let feverActive = false;
  let feverRemain = 0;

  let spawnTimer = 0;
  let obstacles = []; // {id,type,requiredAction,xPx,isJudged,hit} type: 'low'/'high'
  let nextObstacleId = 1;

  // research metadata
  let participantMeta = { participant_id:'',group:'',note:'' };
  let sessionId = '';

  // loggers
  const eventRows = [];
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

  // ====== EVENT LOGGING ======
  function logEvent(row){
    eventRows.push(row);
  }

  function logSession(row){
    sessionRows.push(row);
  }

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
    mode        = cfg.mode || 'normal';
    diffKey     = cfg.diff || 'normal';
    durationSec = cfg.durationSec || 60;
    participantMeta = cfg.meta || {participant_id:'',group:'',note:''};

    running = true;
    startPerf = performance.now();
    lastPerf  = startPerf;
    elapsedSec= 0;
    hp        = 100;
    score     = 0;
    combo     = 0;
    missCount = 0;
    feverGauge= 0;
    feverActive= false;
    feverRemain= 0;
    spawnTimer= 0;
    obstacles = [];
    nextObstacleId = 1;
    sessionId = makeSessionId();
    resetLogger();

    clearObstaclesDom();
    updateHud(0);

    showFeedback(mode === 'research'
      ? 'โหมดวิจัย: ตั้งใจหลบให้เต็มที่นะ!'
      : 'หลบสิ่งกีดขวางด้วย Jump / Duck ให้ทันเวลาค่ะ ✨');

    requestAnimationFrame(loop);
  }

  function stop(reason){
    if (!running) return;
    running = false;
    finalizeSession(reason || 'manual-stop');
  }

  function loop(now){
    if (!running) return;
    const dtSec = (now - lastPerf) / 1000;
    lastPerf = now;
    elapsedSec = (now - startPerf) / 1000;

    // time end
    if (elapsedSec >= durationSec){
      running = false;
      elapsedSec = durationSec;
      updateHud(dtSec);
      finalizeSession('time-up');
      return;
    }

    const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;

    // spawn obstacles
    spawnTimer += dtSec * 1000;
    if (spawnTimer >= diffCfg.spawnIntervalMs){
      spawnTimer = 0;
      spawnObstacle();
    }

    // move obstacles
    updateObstacles(dtSec, diffCfg.obstacleSpeedPx);

    // update FEVER
    updateFever(dtSec);

    updateHud(dtSec);
    requestAnimationFrame(loop);
  }

  function spawnObstacle(){
    const id = nextObstacleId++;
    // สุ่ม low / high
    const type = (Math.random() < 0.5 ? 'low' : 'high');
    const requiredAction = type === 'low' ? 'jump' : 'duck';

    const el = document.createElement('div');
    el.className = 'jd-obstacle ' + (type === 'low' ? 'jd-obstacle--low' : 'jd-obstacle--high');
    el.dataset.id = String(id);
    el.textContent = (type === 'low' ? '⬜' : '⬛');

    obstaclesHost.appendChild(el);

    obstacles.push({
      id,
      type,
      requiredAction,
      xPx: field.clientWidth + 80,
      el,
      isJudged: false,
      hit: false
    });
  }

  function clearObstaclesDom(){
    obstaclesHost.innerHTML = '';
  }

  function updateObstacles(dtSec, speedPxPerSec){
    const hitLineX = field.clientWidth * 0.20; // ใกล้ avatar

    for (const ob of obstacles){
      ob.xPx -= speedPxPerSec * dtSec;
      if (ob.el){
        ob.el.style.transform = `translate3d(${ob.xPx}px,0,0)`;
      }

      // ถ้าผ่านเส้นชนไปแล้วและยังไม่ถูก judge → miss
      if (!ob.isJudged && ob.xPx < hitLineX - 40){
        applyMiss(ob, 'late-no-action');
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
    const nowPerf = performance.now();
    const songTime = elapsedSec;

    // หา obstacle ที่ใกล้เส้นชนที่สุดด้านหน้า avatar
    const hitLineX = field.clientWidth * 0.20;
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

    // ถ้าไม่มี candidate → นับเป็น miss แบบ tap วืด
    if (!candidate){
      fakeMissTap(action, songTime, nowPerf);
      return;
    }

    // window ในหน่วย px ที่ถือว่าอยู่ในเขตชน
    const windowPx = 40;

    if (minDist > windowPx){
      fakeMissTap(action, songTime, nowPerf);
      return;
    }

    // ตัดสินว่าถูก/ผิด
    if (candidate.requiredAction === action){
      applyHit(candidate, action, songTime, nowPerf);
    }else{
      applyMiss(candidate, 'wrong-action', action, songTime, nowPerf);
    }
  }

  function applyHit(ob, action, songTime, perf){
    ob.isJudged = true;
    ob.hit = true;
    combo++;
    const baseScore = 100;
    const feverBonus = (feverActive ? 1.5 : 1);
    const gain = Math.round(baseScore * feverBonus);
    score += gain;

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
      created_at_iso: new Date().toISOString(),

      event_type: 'hit',
      song_time_s: songTime.toFixed(3),
      obstacle_type: ob.type,
      required_action: ob.requiredAction,
      action,
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
    ob.isJudged = true;
    ob.hit = false;
    combo = 0;
    missCount++;
    const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
    hp = Math.max(0, hp - diffCfg.hpMiss);

    if (hp <= 0){
      running = false;
      flashField('miss');
      showFeedback('จบเกม: HP หมดแล้ว ลองใหม่อีกครั้งได้เลยนะ 💪');
      finalizeSession('hp-zero');
    }else{
      showFeedback('พลาด! ลองจับจังหวะใหม่อีกทีนะ');
      flashField('miss');
    }

    const row = {
      session_id: sessionId,
      participant_id: participantMeta.participant_id || '',
      group:          participantMeta.group || '',
      note:           participantMeta.note || '',
      mode,
      diff: diffKey,
      created_at_iso: new Date().toISOString(),

      event_type: 'miss',
      song_time_s: songTime != null ? songTime.toFixed(3) : '',
      obstacle_type: ob.type,
      required_action: ob.requiredAction,
      action: action || '',
      hit: 0,
      miss_reason: reason || '',
      combo_after: combo,
      score_delta: 0,
      score_total: score,
      hp_after: hp,
      fever_after: feverGauge,
      fever_active: feverActive ? 1 : 0
    };
    logEvent(row);

    updateHud(0);
  }

  function fakeMissTap(action, songTime, perf){
    combo = 0;
    missCount++;
    const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
    hp = Math.max(0, hp - diffCfg.hpMiss * 0.7);

    showFeedback('แตะผิดจังหวะนิดหน่อย ลองใหม่อีกทีนะ 🎧');
    flashField('miss');

    logEvent({
      session_id: sessionId,
      participant_id: participantMeta.participant_id || '',
      group:          participantMeta.group || '',
      note:           participantMeta.note || '',
      mode,
      diff: diffKey,
      created_at_iso: new Date().toISOString(),

      event_type: 'miss-tap',
      song_time_s: songTime != null ? songTime.toFixed(3) : '',
      obstacle_type: '',
      required_action: '',
      action: action || '',
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
      // decay gauge
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
    if (hud.progFill){
      hud.progFill.style.transform = `scaleX(${prog.toFixed(3)})`;
    }
    if (hud.progText){
      hud.progText.textContent = Math.round(prog * 100) + '%';
    }

    const feverRatio = Math.min(1, feverGauge / 100);
    if (hud.feverFill){
      hud.feverFill.style.transform = `scaleX(${feverRatio.toFixed(3)})`;
    }
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
    try{
      el.currentTime = 0;
      el.play().catch(()=>{});
    }catch{}
  }

  function finalizeSession(endReason){
    const totalEvents = eventRows.length;
    const totalHit    = eventRows.filter(r=>r.hit === 1).length;
    const acc = totalEvents > 0 ? (totalHit / totalEvents) * 100 : 0;

    const row = {
      session_id: sessionId,
      participant_id: participantMeta.participant_id || '',
      group:          participantMeta.group || '',
      note:           participantMeta.note || '',
      mode,
      diff: diffKey,
      duration_sec: elapsedSec.toFixed(2),
      duration_planned_sec: durationSec,
      score_final: score,
      miss_total: missCount,
      acc_pct: acc.toFixed(2),
      hp_end: hp,
      end_reason: endReason,
      created_at_iso: new Date().toISOString()
    };
    logSession(row);

    // อัปเดตหน้าสรุป
    fillResult(endReason, acc);
  }

  function fillResult(endReason, acc){
    const setText = (id,v)=>{
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };

    setText('jd-res-mode', mode === 'research' ? 'Research' : 'Normal');
    setText('jd-res-diff',
      diffKey === 'easy' ? 'Easy' :
      diffKey === 'hard' ? 'Hard' : 'Normal'
    );
    setText('jd-res-endreason', endReason);
    setText('jd-res-score', score);
    setText('jd-res-maxcombo', combo); // combo สุดท้าย (ถ้าอยากได้ max จริงต้อง track แยกในอนาคต)
    const jumpOk = eventRows.filter(r => r.event_type === 'hit' && r.required_action === 'jump').length;
    const duckOk = eventRows.filter(r => r.event_type === 'hit' && r.required_action === 'duck').length;
    const miss   = missCount;

    setText('jd-res-jump-ok', jumpOk);
    setText('jd-res-duck-ok', duckOk);
    setText('jd-res-miss', miss);
    setText('jd-res-acc', acc.toFixed(1) + ' %');
    setText('jd-res-duration', elapsedSec.toFixed(1) + ' s');

    setText('jd-res-participant', participantMeta.participant_id || '-');
    setText('jd-res-group',       participantMeta.group || '-');
    setText('jd-res-note',        participantMeta.note || '-');

    const resView = document.getElementById('jd-view-result');
    const playView= document.getElementById('jd-view-play');
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
    getEventsCsv(){
      return toCsv(eventRows);
    },
    getSessionCsv(){
      return toCsv(sessionRows);
    }
  };
}
