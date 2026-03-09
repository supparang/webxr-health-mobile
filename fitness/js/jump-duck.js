// === /fitness/js/jump-duck.js ===
// Jump-Duck — FULL PRODUCTION
// PATCH v20260307-JD-VISUALSET-AVATAR3STATE-FULL
'use strict';

(function(){
  const $  = (s)=>document.querySelector(s);

  const viewMenu   = $('#view-menu');
  const viewPlay   = $('#view-play');
  const viewResult = $('#view-result');

  const elMode     = $('#jd-mode');
  const elDiff     = $('#jd-diff');
  const elDuration = $('#jd-duration');
  const researchBlock = $('#jd-research-block');
  const elPidInput = $('#jd-participant-id');
  const elGroup    = $('#jd-group');
  const elNote     = $('#jd-note');

  const hudMode = $('#hud-mode');
  const hudDiff = $('#hud-diff');
  const hudTime = $('#hud-time');
  const hudPhase = $('#hud-phase');
  const hudScore = $('#hud-score');
  const hudCombo = $('#hud-combo');
  const hudStability = $('#hud-stability');
  const hudBoss = $('#hud-boss');

  const progFill = $('#hud-prog-fill');
  const progText = $('#hud-prog-text');
  const feverFill = $('#hud-fever-fill');
  const feverStatus = $('#hud-fever-status');

  const bossWrap = $('#boss-bar-wrap');
  const bossFill = $('#hud-boss-fill');
  const bossStatus = $('#hud-boss-status');

  const playArea = $('#jd-play-area');
  const obsLayer = $('#jd-obstacles');
  const avatar   = $('#jd-avatar');
  const judgeEl  = $('#jd-judge');
  const teleEl   = $('#jd-tele');

  const resMode = $('#res-mode');
  const resDiff = $('#res-diff');
  const resDuration = $('#res-duration');
  const resTotalObs = $('#res-total-obs');
  const resHits = $('#res-hits');
  const resMiss = $('#res-miss');
  const resJumpHit = $('#res-jump-hit');
  const resDuckHit = $('#res-duck-hit');
  const resJumpMiss = $('#res-jump-miss');
  const resDuckMiss = $('#res-duck-miss');
  const resAcc = $('#res-acc');
  const resRTMean = $('#res-rt-mean');
  const resStabilityMin = $('#res-stability-min');
  const resScore = $('#res-score');
  const resRank = $('#res-rank');

  const btnDlEvents   = $('#jd-btn-dl-events');
  const btnDlSessions = $('#jd-btn-dl-sessions');
  const btnSendLog    = $('#jd-btn-send-log');
  const logStatus     = $('#jd-log-status');

  const qs = (k,d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const qsBool = (k)=>{
    const v = String(qs(k,'')).toLowerCase();
    return (v==='1'||v==='true'||v==='yes'||v==='on');
  };

  const HHA_CTX = {
    run: qs('run','play'),
    diff: qs('diff','normal'),
    time: qs('time','60'),
    seed: qs('seed',''),
    studyId: qs('studyId',''),
    phase: qs('phase',''),
    conditionGroup: qs('conditionGroup',''),
    log: qs('log',''),
    view: qs('view',''),
    pid: qs('pid','anon'),
    api: qs('api',''),
    ai: qs('ai',''),
    debug: qs('debug',''),
    hub: qs('hub',''),
    mode: qs('mode','training'),
    duration: qs('duration', qs('time','60')),
    pro: qs('pro','')
  };

  const PATH_PENDING = 'JD_PENDING_LOGS_V1';

  let state = null;
  let rafId = 0;
  let lastTs = 0;
  let nextObstacleId = 1;
  let judgeTimer = 0;
  let teleTimer = 0;
  let lastAction = null;

  const DIFFS = {
    easy:   { speed: 33, spawnMs: 1300, hitWinMs: 260, stabDmg: 10, stabGain: 4, score: 12 },
    normal: { speed: 45, spawnMs: 1000, hitWinMs: 220, stabDmg: 13, stabGain: 3, score: 16 },
    hard:   { speed: 58, spawnMs:  820, hitWinMs: 190, stabDmg: 16, stabGain: 3, score: 20 }
  };

  const PRO = {
    spawnMul: .92,
    speedMul: 1.08,
    hitWinMul: .92,
    stabDmgMul: 1.05
  };

  const PHASE_THRESH = [0.33, 0.70];

  const FEVER = {
    threshold: 100,
    decayPerSec: 12,
    durationSec: 5.5,
    gainOnHit: { easy:18, normal:16, hard:14 }
  };

  const BOSS = {
    hpMax: 110,
    dmgOnHit: 6,
    dmgOnPerfect: 9,
    burstEveryMs: 5200,
    tempoShiftEveryMs: 4200,
    shieldPhaseAtHp: 60,
    shieldNeedStreak: 6,
    shieldBreakBonusDmg: 16,
    frenzyAtHp: 18,
    frenzyBurstEveryMs: 3200,
    frenzyLenBoost: 2,
    feintChance: 0.18,
    feintFlipAtX: 34,
    revealAtX: 30,
    proFeintMul: 1.35,
    proFrenzyMul: 0.82,
    ruleWindowMs: 3200,
    ruleRestMs: 2200
  };

  function showView(name){
    viewMenu.classList.add('hidden');
    viewPlay.classList.add('hidden');
    viewResult.classList.add('hidden');
    if(name==='menu') viewMenu.classList.remove('hidden');
    if(name==='play') viewPlay.classList.remove('hidden');
    if(name==='result') viewResult.classList.remove('hidden');
  }

  function showJudge(msg){
    judgeEl.textContent = msg;
    judgeEl.classList.add('show');
    clearTimeout(judgeTimer);
    judgeTimer = setTimeout(()=>judgeEl.classList.remove('show'), 520);
  }

  function telegraph(msg, ms=650){
    const box = teleEl.querySelector('.teleBox');
    if(box) box.textContent = msg;
    teleEl.classList.remove('hidden');
    teleEl.classList.add('on');
    clearTimeout(teleTimer);
    teleTimer = setTimeout(()=>{
      teleEl.classList.remove('on');
      setTimeout(()=>teleEl.classList.add('hidden'), 120);
    }, ms);
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function nowIso(){ return new Date().toISOString(); }

  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function strToSeed(s){
    const str = String(s||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function setHubLinks(){
    const hub = HHA_CTX.hub || '#';
    ['jd-back-hub-menu','jd-back-hub-play','jd-back-hub-result'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.href = hub;
    });
  }

  function updateResearchVisibility(){
    const mode = (elMode.value || 'training').toLowerCase();
    researchBlock.classList.toggle('hidden', mode !== 'research');
  }

  function buildParticipant(mode){
    if(mode !== 'research'){
      return {
        id: String(HHA_CTX.pid || 'anon').trim(),
        group: '',
        note: ''
      };
    }
    return {
      id: (elPidInput.value || HHA_CTX.pid || 'anon').trim(),
      group: (elGroup.value || '').trim(),
      note: (elNote.value || '').trim()
    };
  }

  function getPhase(progress){
    if(progress < PHASE_THRESH[0]) return 1;
    if(progress < PHASE_THRESH[1]) return 2;
    return 3;
  }

  function ruleLabel(rule){
    if(rule === 'perfect-only') return 'PERFECT';
    if(rule === 'no-repeat') return 'NO-REPEAT';
    if(rule === 'alternate') return 'ALTERNATE';
    if(rule === 'no-miss') return 'NO-MISS';
    return '—';
  }

  function setAvatarState(kind){
    if(!avatar) return;
    avatar.classList.remove('avatar-idle','avatar-jump','avatar-duck');
    if(kind === 'jump') avatar.classList.add('avatar-jump');
    else if(kind === 'duck') avatar.classList.add('avatar-duck');
    else avatar.classList.add('avatar-idle');
  }

  function pickBossVariant(){
    const r = state.rng();
    const variants = ['tempo','feint','shield','mirror','chaos'];
    return variants[Math.floor(r * variants.length)];
  }

  function pickBossRule(){
    const v = state.bossVariant || 'tempo';
    let pool = ['perfect-only','no-repeat','alternate','no-miss'];
    if(v === 'feint')  pool = ['no-repeat','perfect-only','alternate','no-miss'];
    if(v === 'tempo')  pool = ['alternate','perfect-only','no-repeat','no-miss'];
    if(v === 'shield') pool = ['no-miss','alternate','perfect-only','no-repeat'];
    if(v === 'mirror') pool = ['no-repeat','alternate','perfect-only','no-miss'];
    if(v === 'chaos')  pool = ['perfect-only','no-miss','alternate','no-repeat'];
    return pool[Math.floor(state.rng() * pool.length)];
  }

  function createObstacle(type, isBoss, allowFeint){
    const obs = document.createElement('div');
    const low = type === 'low';
    obs.className = 'obs ' + (low ? 'low' : 'high');
    obs.style.left = '100%';

    const inner = document.createElement('div');
    inner.className = 'obs-inner';

    const shape = document.createElement('div');
    shape.className = low ? 'obs-low-shape' : 'obs-high-shape';

    const label = document.createElement('div');
    label.className = 'obs-label';
    label.textContent = low ? 'JUMP' : 'DUCK';

    inner.appendChild(shape);
    inner.appendChild(label);
    obs.appendChild(inner);

    let feint = false;
    let flipAtX = null;
    let revealAtX = null;

    if(allowFeint){
      let feintP = BOSS.feintChance;
      if(state.bossVariant === 'feint') feintP *= 1.55;
      if(state.bossVariant === 'tempo') feintP *= 1.15;
      if(state.bossVariant === 'shield') feintP *= 0.90;
      if(state.pro) feintP *= BOSS.proFeintMul;

      if(state.rng() < feintP){
        feint = true;
        flipAtX = BOSS.feintFlipAtX + (state.rng()*2 - 1);
        revealAtX = BOSS.revealAtX + (state.rng()*2 - 1);
        obs.classList.add('feint');
      }
    }

    const item = {
      id: nextObstacleId++,
      x: 100,
      type,
      need: low ? 'jump' : 'duck',
      isBoss: !!isBoss,
      feint,
      flipped: false,
      flipAtX,
      revealAtX,
      resolved: false,
      el: obs
    };

    obsLayer.appendChild(obs);
    state.obstacles.push(item);
    state.obstaclesSpawned++;
  }

  function spawnObstacle(phase){
    if(!state) return;
    const last = state.obstacles[state.obstacles.length - 1];
    if(last && last.x > 72) return;

    const type = state.rng() < 0.5 ? 'low' : 'high';
    createObstacle(type, phase===3, phase===3);

    const pairP = (phase===3 ? 0.10 : 0.06) * (state.mode==='training' ? 1 : 0.65);
    if(state.rng() < pairP){
      setTimeout(()=>{
        if(state && state.running){
          createObstacle(state.rng() < 0.5 ? 'low' : 'high', phase===3, phase===3);
        }
      }, 150);
    }
  }

  function handleInput(type){
    if(!state || !state.running) return;
    lastAction = { type, time: performance.now() };

    if(type === 'jump') setAvatarState('jump');
    else setAvatarState('duck');

    setTimeout(()=>{
      if(state && state.running) setAvatarState('idle');
    }, 180);
  }

  function triggerBossBurst(){
    if(!state) return;
    state.bossBurstCount++;
    telegraph(state.bossFrenzyOn ? '💥 BURST+' : '⚡ BURST!', 600);
    showJudge(state.bossFrenzyOn ? '💥 FRENZY BURST!' : '⚡ BURST!');

    let patterns = ['mirror','abab','aab','random','stair','doubletap'];
    if(state.bossVariant === 'mirror') patterns = ['mirror','abab','doubletap','stair'];
    if(state.bossVariant === 'feint') patterns = ['random','aab','abab','stair'];
    if(state.bossVariant === 'tempo') patterns = ['abab','mirror','aab','doubletap'];
    if(state.bossVariant === 'shield') patterns = ['mirror','aab','stair','doubletap'];
    if(state.bossVariant === 'chaos') patterns = ['random','stair','abab','doubletap','aab'];

    const p = patterns[Math.floor(state.rng()*patterns.length)];
    const baseN = 5 + Math.floor(state.rng()*3);
    const n = state.bossFrenzyOn ? (baseN + BOSS.frenzyLenBoost) : baseN;
    const baseDelay = state.bossFrenzyOn ? 105 : 125;
    const flip = (x)=> x==='low' ? 'high' : 'low';

    const seq = [];
    if (p === 'mirror'){
      const start = state.rng()<0.5 ? 'low' : 'high';
      for(let i=0;i<n;i++) seq.push((i%2===0)?start:flip(start));
    } else if (p === 'abab'){
      const a = state.rng()<0.5 ? 'low' : 'high';
      const b = flip(a);
      for(let i=0;i<n;i++) seq.push(i%2===0?a:b);
    } else if (p === 'aab'){
      const a = state.rng()<0.5 ? 'low' : 'high';
      const b = flip(a);
      for(let i=0;i<n;i++) seq.push((i%3===2)?b:a);
    } else if (p === 'stair'){
      const start = state.rng()<0.5 ? 'low' : 'high';
      for(let i=0;i<n;i++){
        const block = Math.floor(i/2)%2;
        seq.push(block===0 ? start : flip(start));
      }
    } else if (p === 'doubletap'){
      const start = state.rng()<0.5 ? 'low' : 'high';
      for(let i=0;i<n;i++){
        const k = Math.floor(i/2);
        seq.push((k%2===0)?start:flip(start));
      }
    } else {
      for(let i=0;i<n;i++) seq.push(state.rng()<0.5 ? 'low' : 'high');
    }

    seq.forEach((type,i)=>{
      setTimeout(()=>{
        if(state && state.running) createObstacle(type, true, true);
      }, baseDelay*i);
    });
  }

  function updateBoss(ts){
    if(!state || !state.bossAlive) return;

    if(state.bossVariant === 'chaos' && !state.bossOverheatNeed && state.rng() < 0.005){
      state.bossOverheatNeed = 1;
      state.bossOverheatHits = 0;
      state.bossOverheatEndAt = ts + 2200;
      telegraph('🔥 OVERHEAT!', 550);
      showJudge('🔥 OVERHEAT! 2 วิ ห้ามพลาด!');
    }

    if(state.bossOverheatNeed && ts >= state.bossOverheatEndAt){
      state.bossOverheatNeed = 0;
      telegraph('✅ COOL', 400);
      showJudge('✅ ผ่าน OVERHEAT!');
    }

    if(!state.bossRuleActive && ts >= state.bossRuleNextAt){
      state.bossRule = pickBossRule();
      state.bossRuleActive = true;
      state.bossRuleEndAt = ts + BOSS.ruleWindowMs;
      state.bossLastNeed = null;
      telegraph('🎴 RULE: ' + ruleLabel(state.bossRule), 650);
      showJudge('🎴 RULE: ' + ruleLabel(state.bossRule));
    }

    if(state.bossRuleActive && ts >= state.bossRuleEndAt){
      state.bossRuleActive = false;
      state.bossRuleNextAt = ts + BOSS.ruleRestMs + (state.rng()*600);
      telegraph('✅ RULE CLEAR', 450);
      showJudge('✅ RULE CLEAR!');
    }

    if(state.bossHp <= BOSS.shieldPhaseAtHp && state.bossShieldNeedStreak === 0){
      state.bossShieldNeedStreak = BOSS.shieldNeedStreak;
      state.bossShieldStreak = 0;
      telegraph('🛡️ SHIELD', 700);
      showJudge(`🛡️ SHIELD! ถูกติดกัน ${BOSS.shieldNeedStreak} ครั้ง`);
    }

    if(!state.bossFrenzyOn && state.bossHp <= BOSS.frenzyAtHp){
      state.bossFrenzyOn = true;
      telegraph('💥 FINAL', 650);
      showJudge('💥 FINAL FRENZY!');
    }

    let tempoEvery = state.bossFrenzyOn ? (BOSS.tempoShiftEveryMs*0.80) : BOSS.tempoShiftEveryMs;
    if(state.bossVariant === 'tempo') tempoEvery *= 0.85;
    if(state.bossVariant === 'mirror') tempoEvery *= 0.92;

    if(ts >= state.bossNextTempoAt){
      state.bossNextTempoAt = ts + tempoEvery + (state.rng()*420 - 200);
      telegraph('⚡ TEMPO SHIFT', 550);
    }

    let burstEvery = state.bossFrenzyOn ? BOSS.frenzyBurstEveryMs : BOSS.burstEveryMs;
    if(state.bossVariant === 'mirror') burstEvery *= 0.92;
    if(state.bossVariant === 'chaos') burstEvery *= 0.88;
    if(state.pro) burstEvery *= BOSS.proFrenzyMul;
    burstEvery = Math.max(2400, burstEvery);

    if(ts >= state.bossNextBurstAt){
      state.bossNextBurstAt = ts + burstEvery + (state.rng()*520 - 240);
      triggerBossBurst();
    }

    bossWrap.classList.remove('hidden');
    hudBoss.textContent = `${Math.max(0, Math.round(state.bossHp))}%`;
    bossFill.style.width = `${Math.max(0, (state.bossHp / BOSS.hpMax) * 100)}%`;

    bossStatus.textContent =
      state.bossOverheatNeed ? 'OVERHEAT!' :
      (state.bossRuleActive ? ('RULE ' + ruleLabel(state.bossRule)) :
      (state.bossShieldNeedStreak > 0 ? `SHIELD ${state.bossShieldStreak}/${state.bossShieldNeedStreak}` :
      (state.bossFrenzyOn ? 'FRENZY!' : 'BOSS!')));

    if(state.bossHp <= 0){
      state.bossHp = 0;
      state.bossAlive = false;
      showJudge('🏆 BOSS DOWN!');
      endGame('boss-down');
    }
  }

  function startBoss(ts){
    state.bossAlive = true;
    state.bossHp = BOSS.hpMax;
    state.bossEnterAtMs = state.elapsedMs;
    state.bossNextBurstAt = ts + 1200;
    state.bossNextTempoAt = ts + 1400;
    state.bossShieldNeedStreak = 0;
    state.bossShieldStreak = 0;
    state.bossBurstCount = 0;
    state.bossFrenzyOn = false;
    state.bossVariant = pickBossVariant();
    state.bossOverheatNeed = 0;
    state.bossOverheatHits = 0;
    state.bossRule = '';
    state.bossRuleActive = false;
    state.bossRuleEndAt = 0;
    state.bossRuleNextAt = ts + 1600;
    state.bossLastNeed = null;
    telegraph('👾 BOSS: ' + state.bossVariant.toUpperCase(), 650);
    showJudge('👾 BOSS: ' + state.bossVariant.toUpperCase());
  }

  function judgeRuleOnHit(obs, perfect){
    if(!state.bossRuleActive) return false;

    const rule = state.bossRule;
    if(rule === 'perfect-only' && !perfect){
      state.combo = 0;
      state.miss++;
      const stabDmg = state.pro ? (state.cfg.stabDmg * PRO.stabDmgMul) : state.cfg.stabDmg;
      state.stability = Math.max(0, state.stability - Math.max(6, stabDmg*0.6));
      state.minStability = Math.min(state.minStability, state.stability);
      showJudge('RULE FAIL: NEED PERFECT!');
      return true;
    }

    if(rule === 'no-repeat' && state.bossLastNeed && state.bossLastNeed === obs.need){
      state.combo = 0;
      state.miss++;
      state.stability = Math.max(0, state.stability - 8);
      state.minStability = Math.min(state.minStability, state.stability);
      showJudge('RULE FAIL: NO-REPEAT!');
      return true;
    }

    if(rule === 'alternate' && state.bossLastNeed && state.bossLastNeed === obs.need){
      state.combo = 0;
      state.miss++;
      state.stability = Math.max(0, state.stability - 8);
      state.minStability = Math.min(state.minStability, state.stability);
      showJudge('RULE FAIL: ALTERNATE!');
      return true;
    }

    return false;
  }

  function updateObstacles(dtMs, ts, phase, progress){
    let speed = state.cfg.speed;
    if(phase===2) speed *= 1.12;
    if(phase===3) speed *= 1.26;
    if(state.mode==='training') speed *= (1 + 0.18*progress);
    if(state.pro) speed *= PRO.speedMul;
    if(phase===3 && state.bossAlive){
      speed *= (1 + 0.06*Math.sin((ts - state.startTs)/420));
    }

    const move = speed * (dtMs/1000);
    const keep = [];

    for(const obs of state.obstacles){
      obs.x -= move;

      if(obs.feint && !obs.resolved){
        if(!obs.flipped && obs.flipAtX != null && obs.x <= obs.flipAtX){
          obs.flipped = true;
          obs.type = obs.type === 'low' ? 'high' : 'low';
          obs.need = obs.need === 'jump' ? 'duck' : 'jump';
          obs.el.classList.toggle('low', obs.type==='low');
          obs.el.classList.toggle('high', obs.type==='high');

          const label = obs.el.querySelector('.obs-label');
          const shape = obs.el.querySelector('.obs-low-shape, .obs-high-shape');
          if(label) label.textContent = obs.type === 'low' ? 'JUMP' : 'DUCK';
          if(shape) shape.className = obs.type === 'low' ? 'obs-low-shape' : 'obs-high-shape';

          showJudge('👀 หลอก! อ่านใหม่!');
        }
      }

      obs.el.style.left = obs.x + '%';

      if(!obs.resolved && obs.x <= 28 && obs.x >= 18){
        if(lastAction){
          const hitWin = state.pro ? (state.cfg.hitWinMs * PRO.hitWinMul) : state.cfg.hitWinMs;
          const rt = Math.abs(lastAction.time - ts);
          const perfect = rt <= (hitWin * 0.55);

          if(lastAction.type === obs.need && rt <= hitWin){
            if(phase===3 && judgeRuleOnHit(obs, perfect)){
              obs.resolved = true;
              obs.el.remove();
              continue;
            }

            obs.resolved = true;

            state.hits++;
            state.combo++;
            state.maxCombo = Math.max(state.maxCombo, state.combo);
            state.needSeq.push(obs.need);

            let gain = state.cfg.score;
            gain *= (1 + Math.min(state.combo-1, 6)*0.15);
            gain *= (phase===3 ? 1.18 : (phase===2 ? 1.08 : 1));
            gain *= (state.feverActive ? 1.35 : 1);
            gain *= (perfect ? 1.15 : 1);
            gain = Math.round(gain);

            state.score += gain;
            state.stability = Math.min(100, state.stability + state.cfg.stabGain);
            state.minStability = Math.min(state.minStability, state.stability);
            state.hitRTs.push(rt);

            if(obs.need === 'jump') state.jumpHit++;
            else state.duckHit++;

            state.fever = Math.min(100, state.fever + (FEVER.gainOnHit[state.diffKey] || 16));
            if(!state.feverActive && state.fever >= FEVER.threshold){
              state.feverActive = true;
              state.feverRemain = FEVER.durationSec;
              showJudge('🔥 FEVER!');
            }

            if(phase===3 && state.bossAlive){
              let dmg = perfect ? BOSS.dmgOnPerfect : BOSS.dmgOnHit;
              dmg *= state.feverActive ? 1.2 : 1;
              state.bossHp = Math.max(0, state.bossHp - dmg);

              if(state.bossShieldNeedStreak > 0){
                state.bossShieldStreak++;
                if(state.bossShieldStreak >= state.bossShieldNeedStreak){
                  state.bossShieldNeedStreak = 0;
                  state.bossShieldStreak = 0;
                  state.bossHp = Math.max(0, state.bossHp - BOSS.shieldBreakBonusDmg);
                  showJudge('💥 SHIELD BREAK!');
                }
              }

              if(state.bossOverheatNeed) state.bossOverheatHits++;
              if(state.bossRuleActive) state.bossLastNeed = obs.need;
            }

            showJudge(perfect ? `PERFECT ${obs.need.toUpperCase()}!` : `${obs.need.toUpperCase()}!`);
            pushEvent('hit', {
              targetId: obs.id,
              itemType: obs.type,
              required_action: obs.need,
              action: lastAction.type,
              rtMs: Math.round(rt),
              judgment: perfect ? 'perfect' : 'good',
              totalScore: Math.round(state.score),
              combo: state.combo,
              feverState: state.feverActive ? 1 : 0,
              feverValue: +state.fever.toFixed(1),
              bossHp: +state.bossHp.toFixed(1),
              bossVariant: state.bossVariant,
              bossRule: state.bossRuleActive ? state.bossRule : '',
              overheat: state.bossOverheatNeed ? 1 : 0,
              feint: obs.feint ? 1 : 0,
              pro: state.pro ? 1 : 0
            });

            obs.el.remove();
            continue;
          }

          if(rt <= hitWin && lastAction.type !== obs.need){
            obs.resolved = true;
            state.miss++;
            state.combo = 0;
            state.needSeq.push(obs.need);

            if(obs.need === 'jump') state.jumpMiss++;
            else state.duckMiss++;

            const stabDmg = state.pro ? (state.cfg.stabDmg * PRO.stabDmgMul) : state.cfg.stabDmg;
            state.stability = Math.max(0, state.stability - stabDmg);
            state.minStability = Math.min(state.minStability, state.stability);

            if(phase===3 && state.bossShieldNeedStreak > 0){
              state.bossShieldStreak = 0;
            }
            if(phase===3 && state.bossRuleActive && state.bossRule === 'no-miss'){
              state.bossNextBurstAt = Math.min(state.bossNextBurstAt, ts + 900);
            }
            if(phase===3 && state.bossOverheatNeed){
              state.stability = Math.max(0, state.stability - 6);
              state.bossOverheatNeed = 0;
              showJudge('🔥 OVERHEAT FAIL!');
            } else {
              showJudge('MISS');
            }

            pushEvent('miss', {
              targetId: obs.id,
              itemType: obs.type,
              required_action: obs.need,
              action: lastAction.type,
              rtMs: Math.round(rt),
              judgment: 'miss',
              extra: 'wrong-action',
              totalScore: Math.round(state.score),
              combo: 0
            });

            obs.el.remove();
            if(state.stability <= 0){
              endGame('stability-zero');
              return;
            }
            continue;
          }
        }
      }

      if(!obs.resolved && obs.x <= 4){
        obs.resolved = true;
        state.miss++;
        state.combo = 0;
        state.needSeq.push(obs.need);

        if(obs.need === 'jump') state.jumpMiss++;
        else state.duckMiss++;

        const stabDmg = state.pro ? (state.cfg.stabDmg * PRO.stabDmgMul) : state.cfg.stabDmg;
        state.stability = Math.max(0, state.stability - stabDmg);
        state.minStability = Math.min(state.minStability, state.stability);

        if(phase===3 && state.bossShieldNeedStreak > 0){
          state.bossShieldStreak = 0;
        }
        if(phase===3 && state.bossRuleActive && state.bossRule === 'no-miss'){
          state.bossNextBurstAt = Math.min(state.bossNextBurstAt, ts + 900);
        }
        if(phase===3 && state.bossOverheatNeed){
          state.stability = Math.max(0, state.stability - 6);
          state.bossOverheatNeed = 0;
          showJudge('🔥 OVERHEAT FAIL!');
        } else {
          showJudge('MISS');
        }

        pushEvent('miss', {
          targetId: obs.id,
          itemType: obs.type,
          required_action: obs.need,
          action: lastAction ? lastAction.type : '',
          judgment: 'miss',
          extra: 'late-no-action',
          totalScore: Math.round(state.score),
          combo: 0
        });

        obs.el.remove();
        if(state.stability <= 0){
          endGame('stability-zero');
          return;
        }
        continue;
      }

      if(obs.x > -20) keep.push(obs);
      else obs.el.remove();
    }

    state.obstacles = keep;

    if(lastAction && ts - lastAction.time > 260){
      lastAction = null;
    }
  }

  function updateFever(dtSec){
    if(!state) return;
    if(state.feverActive){
      state.feverRemain -= dtSec;
      if(state.feverRemain <= 0){
        state.feverActive = false;
        state.feverRemain = 0;
        showJudge('FEVER END');
      }
    }else{
      state.fever = Math.max(0, state.fever - FEVER.decayPerSec * dtSec);
    }

    feverFill.style.width = `${Math.min(100, state.fever)}%`;
    feverStatus.textContent = state.feverActive ? 'FEVER!' : 'Ready';
  }

  function updateHUD(progress, phase){
    hudMode.textContent = state.mode + (state.pro ? ' PRO' : '');
    hudDiff.textContent = state.diffKey;
    hudTime.textContent = (state.remainingMs/1000).toFixed(1);
    hudPhase.textContent = String(phase);
    hudScore.textContent = String(Math.round(state.score));
    hudCombo.textContent = String(state.combo);
    hudStability.textContent = `${state.stability.toFixed(1)}%`;
    hudBoss.textContent = state.bossAlive ? `${Math.round(state.bossHp)}%` : '—';

    progFill.style.width = `${Math.round(progress*100)}%`;
    progText.textContent = `${Math.round(progress*100)}%`;
  }

  function gameLoop(ts){
    if(!state || !state.running) return;
    if(!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;

    state.elapsedMs = ts - state.startTs;
    state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

    const progress = Math.min(1, state.elapsedMs / state.durationMs);
    const phase = getPhase(progress);

    if(state.elapsedMs >= state.durationMs){
      endGame('timeup');
      return;
    }

    updateFever(dt/1000);

    if(phase===3){
      if(!state.bossAlive) startBoss(ts);
      updateBoss(ts);
    }

    while(ts >= state.nextSpawnAt){
      spawnObstacle(phase);
      let interval = state.cfg.spawnMs;

      if(state.mode==='training'){
        const factor = 1 - 0.30*progress;
        interval = interval * Math.max(0.58, factor);
        if(state.pro){
          interval *= PRO.spawnMul;
          interval = Math.max(480, interval);
        }
      }else{
        if(phase===3) interval *= 0.90;
        interval = Math.max(620, Math.min(1800, interval));
      }

      state.nextSpawnAt += interval;
    }

    updateObstacles(dt, ts, phase, progress);
    updateHUD(progress, phase);

    rafId = requestAnimationFrame(gameLoop);
  }

  function modeLabel(mode){
    if(mode==='training') return 'training';
    if(mode==='test') return 'test';
    if(mode==='research') return 'research';
    return mode || 'training';
  }

  function computeAccPct(){
    const total = state.obstaclesSpawned || 0;
    return total ? (state.hits / total) * 100 : 0;
  }

  function computeRTMean(){
    if(!state.hitRTs.length) return 0;
    return state.hitRTs.reduce((a,b)=>a+b,0) / state.hitRTs.length;
  }

  function computeRank(acc, stabMin){
    if(acc >= 90 && stabMin >= 85) return 'S';
    if(acc >= 80 && stabMin >= 75) return 'A';
    if(acc >= 65 && stabMin >= 60) return 'B';
    if(acc < 40 || stabMin < 40) return 'D';
    return 'C';
  }

  function pushEvent(type, extra){
    if(!state) return;
    state.events.push(Object.assign({
      timestampIso: nowIso(),
      projectTag: 'jumpduck',
      runMode: state.mode,
      studyId: HHA_CTX.studyId || '',
      phase: HHA_CTX.phase || '',
      conditionGroup: HHA_CTX.conditionGroup || '',
      sessionId: state.sessionId,
      eventType: type,
      gameMode: 'jumpduck',
      diff: state.diffKey,
      timeFromStartMs: Math.round(state.elapsedMs || 0),
      studentKey: HHA_CTX.pid || '',
      group: state.participant?.group || '',
      note: state.participant?.note || ''
    }, extra || {}));
  }

  function escCsv(v){
    if(v == null) return '';
    const s = String(v);
    if(s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }
  function toCsv(rows){
    if(!rows || !rows.length) return '';
    const cols = Object.keys(rows[0]);
    const out = [cols.join(',')];
    rows.forEach(r=> out.push(cols.map(c=>escCsv(r[c])).join(',')));
    return out.join('\n');
  }
  function downloadCsv(text, filename){
    if(!text) return;
    const blob = new Blob([text], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function setLogStatus(msg, ok){
    if(!logStatus) return;
    logStatus.textContent = msg;
    logStatus.style.color = ok ? '#22c55e' : '#f59e0b';
  }

  async function postBatch(kind, rows){
    const url = HHA_CTX.log || '';
    if(!url) return { ok:false, error:'no_log_url' };
    try{
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ kind, rows }),
        keepalive:true
      });
      return { ok: !!res.ok, status: res.status };
    }catch(e){
      return { ok:false, error:String(e?.message || e) };
    }
  }

  function queuePayload(payload){
    try{
      const arr = JSON.parse(localStorage.getItem(PATH_PENDING) || '[]');
      arr.push(payload);
      while(arr.length > 60) arr.shift();
      localStorage.setItem(PATH_PENDING, JSON.stringify(arr));
    }catch(_){}
  }

  function readQueue(){
    try{ return JSON.parse(localStorage.getItem(PATH_PENDING) || '[]'); }catch(_){ return []; }
  }

  async function flushQueue(){
    const q = readQueue();
    if(!q.length) return { ok:true, sent:0 };

    let sent = 0;
    const remain = [];
    for(const p of q){
      const r = await postBatch(p.kind, p.rows);
      if(r.ok) sent++;
      else remain.push(p);
    }

    try{
      if(remain.length) localStorage.setItem(PATH_PENDING, JSON.stringify(remain));
      else localStorage.removeItem(PATH_PENDING);
    }catch(_){}

    return { ok: remain.length===0, sent, remain: remain.length };
  }

  function saveLastSummary(summary){
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const histKey = 'HHA_SUMMARY_HISTORY';
      const old = JSON.parse(localStorage.getItem(histKey) || '[]');
      old.unshift(summary);
      while(old.length > 30) old.pop();
      localStorage.setItem(histKey, JSON.stringify(old));
    }catch(_){}
  }

  function localDayKey(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }

  async function endGame(reason='end'){
    if(!state || !state.running) return;
    state.running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
    setAvatarState('idle');

    const total = state.obstaclesSpawned || 0;
    const acc = computeAccPct();
    const rtMean = computeRTMean();
    const rank = computeRank(acc, state.minStability);

    const sessionRow = {
      timestampIso: nowIso(),
      projectTag: 'jumpduck',
      runMode: state.mode,
      studyId: HHA_CTX.studyId || '',
      phase: HHA_CTX.phase || '',
      conditionGroup: HHA_CTX.conditionGroup || '',
      sessionId: state.sessionId,
      gameMode: 'jumpduck',
      diff: state.diffKey,
      pro: state.pro ? 1 : 0,

      durationPlannedSec: state.durationMs/1000,
      durationPlayedSec: +(state.elapsedMs/1000).toFixed(2),

      scoreFinal: Math.round(state.score),
      comboMax: state.maxCombo,
      misses: state.miss,

      obstaclesTotal: total,
      hitsTotal: state.hits,
      accPct: +acc.toFixed(2),
      avgRtMs: rtMean ? +rtMean.toFixed(1) : 0,

      jumpHit: state.jumpHit,
      duckHit: state.duckHit,
      jumpMiss: state.jumpMiss,
      duckMiss: state.duckMiss,

      stabilityMinPct: +state.minStability.toFixed(1),

      bossVariant: state.bossVariant || '',
      bossRule: state.bossRule || '',
      bossHpEnd: +state.bossHp.toFixed(1),
      bossBurstCount: state.bossBurstCount || 0,
      bossOverheatHits: state.bossOverheatHits || 0,
      bossFrenzyOn: state.bossFrenzyOn ? 1 : 0,

      studentKey: HHA_CTX.pid || '',
      group: state.participant?.group || '',
      note: state.participant?.note || '',
      end_reason: reason
    };

    state.sessions.push(sessionRow);

    const summary = {
      timestampIso: nowIso(),
      projectTag: 'jumpduck',
      game: 'jumpduck',
      sessionId: state.sessionId,
      runMode: state.mode,
      diff: state.diffKey,
      pro: state.pro ? 1 : 0,
      studyId: HHA_CTX.studyId || '',
      phase: HHA_CTX.phase || '',
      conditionGroup: HHA_CTX.conditionGroup || '',
      studentKey: HHA_CTX.pid || '',
      durationPlannedSec: state.durationMs/1000,
      durationPlayedSec: +(state.elapsedMs/1000).toFixed(2),
      obstaclesTotal: total,
      hitsTotal: state.hits,
      missTotal: state.miss,
      accPct: +acc.toFixed(2),
      scoreFinal: Math.round(state.score),
      comboMax: state.maxCombo,
      stabilityMinPct: +state.minStability.toFixed(1),
      bossVariant: state.bossVariant || '',
      bossRule: state.bossRule || '',
      bossHpEnd: +state.bossHp.toFixed(1),
      end_reason: reason,
      __extraJson: JSON.stringify({ url: location.href, dayKey: localDayKey() })
    };

    saveLastSummary(summary);

    const autoSend = (state.mode === 'test' || state.mode === 'research' || qsBool('autosend'));
    if(autoSend && HHA_CTX.log){
      const p1 = { kind:'events', rows: state.events || [] };
      const p2 = { kind:'sessions', rows: state.sessions || [] };
      const r1 = await postBatch(p1.kind, p1.rows);
      const r2 = await postBatch(p2.kind, p2.rows);
      if(!(r1.ok && r2.ok)){
        queuePayload(p1);
        queuePayload(p2);
      }
    }

    resMode.textContent = modeLabel(state.mode) + (state.pro ? ' PRO' : '');
    resDiff.textContent = state.diffKey;
    resDuration.textContent = `${state.durationMs/1000}s`;
    resTotalObs.textContent = String(total);
    resHits.textContent = String(state.hits);
    resMiss.textContent = String(state.miss);
    resJumpHit.textContent = String(state.jumpHit);
    resDuckHit.textContent = String(state.duckHit);
    resJumpMiss.textContent = String(state.jumpMiss);
    resDuckMiss.textContent = String(state.duckMiss);
    resAcc.textContent = `${acc.toFixed(1)}%`;
    resRTMean.textContent = rtMean ? `${rtMean.toFixed(0)} ms` : '-';
    resStabilityMin.textContent = `${state.minStability.toFixed(1)}%`;
    resScore.textContent = String(Math.round(state.score));
    resRank.textContent = rank;

    showView('result');
  }

  function startGameBase(opts){
    nextObstacleId = 1;
    obsLayer.innerHTML = '';
    bossWrap.classList.add('hidden');
    bossFill.style.width = '100%';
    progFill.style.width = '0%';
    feverFill.style.width = '0%';
    feverStatus.textContent = 'Ready';
    bossStatus.textContent = '—';
    hudBoss.textContent = '—';
    setAvatarState('idle');
    lastAction = null;
    lastTs = 0;

    const mode = opts.mode || 'training';
    const diffKey = opts.diffKey || 'normal';
    const durationMs = opts.durationMs || 60000;
    const cfg = DIFFS[diffKey] || DIFFS.normal;
    const rng = mulberry32(strToSeed(HHA_CTX.seed || Date.now()));

    state = {
      running: true,
      sessionId: `JD-${Date.now()}`,
      mode,
      diffKey,
      cfg,
      durationMs,
      pro: (mode === 'training') && String(HHA_CTX.pro || '').toLowerCase() === '1',
      participant: buildParticipant(mode),
      rng,

      startTs: performance.now(),
      elapsedMs: 0,
      remainingMs: durationMs,
      nextSpawnAt: performance.now() + 700,

      obstacles: [],
      obstaclesSpawned: 0,

      hits: 0,
      miss: 0,
      jumpHit: 0,
      duckHit: 0,
      jumpMiss: 0,
      duckMiss: 0,

      score: 0,
      combo: 0,
      maxCombo: 0,
      stability: 100,
      minStability: 100,

      fever: 0,
      feverActive: false,
      feverRemain: 0,

      bossAlive: false,
      bossHp: BOSS.hpMax,
      bossVariant: '',
      bossRule: '',
      bossRuleActive: false,
      bossRuleEndAt: 0,
      bossRuleNextAt: 0,
      bossLastNeed: null,
      bossShieldNeedStreak: 0,
      bossShieldStreak: 0,
      bossBurstCount: 0,
      bossOverheatNeed: 0,
      bossOverheatEndAt: 0,
      bossOverheatHits: 0,
      bossFrenzyOn: false,
      bossNextBurstAt: 0,
      bossNextTempoAt: 0,
      bossEnterAtMs: 0,

      hitRTs: [],
      needSeq: [],
      events: [],
      sessions: []
    };

    hudMode.textContent = mode;
    hudDiff.textContent = diffKey;
    hudTime.textContent = (durationMs/1000).toFixed(1);
    hudPhase.textContent = '1';
    hudScore.textContent = '0';
    hudCombo.textContent = '0';
    hudStability.textContent = '100%';

    showView('play');
    showJudge(opts.isTutorial ? 'Tutorial: Low=JUMP / High=DUCK' : 'READY');
    rafId = requestAnimationFrame(gameLoop);
  }

  function startGameFromMenu(){
    startGameBase({
      mode: (elMode.value || HHA_CTX.mode || 'training').toLowerCase(),
      diffKey: (elDiff.value || HHA_CTX.diff || 'normal').toLowerCase(),
      durationMs: (parseInt(elDuration.value || HHA_CTX.duration || '60',10) || 60) * 1000
    });
  }

  function initBindings(){
    setHubLinks();

    if(HHA_CTX.mode) elMode.value = HHA_CTX.mode;
    if(HHA_CTX.diff) elDiff.value = HHA_CTX.diff;
    if(HHA_CTX.duration) elDuration.value = String(HHA_CTX.duration);
    if(elPidInput) elPidInput.value = HHA_CTX.pid || 'anon';

    elMode.addEventListener('change', updateResearchVisibility);
    updateResearchVisibility();

    document.querySelector('[data-action="start"]').addEventListener('click', startGameFromMenu);
    document.querySelector('[data-action="tutorial"]').addEventListener('click', ()=>{
      startGameBase({ mode:'training', diffKey:'easy', durationMs:15000, isTutorial:true });
    });

    document.querySelector('[data-action="jump"]').addEventListener('click', ()=>handleInput('jump'));
    document.querySelector('[data-action="duck"]').addEventListener('click', ()=>handleInput('duck'));
    document.querySelector('[data-action="stop-early"]').addEventListener('click', ()=>endGame('stop-early'));
    document.querySelector('[data-action="play-again"]').addEventListener('click', startGameFromMenu);
    document.querySelector('[data-action="back-menu"]').addEventListener('click', ()=>showView('menu'));

    playArea.addEventListener('pointerdown', (ev)=>{
      if(!state || !state.running) return;
      const rect = playArea.getBoundingClientRect();
      const mid = rect.top + rect.height/2;
      if(ev.clientY < mid) handleInput('jump');
      else handleInput('duck');
    }, { passive:true });

    window.addEventListener('keydown', (ev)=>{
      if(!state || !state.running) return;
      const k = (ev.key || '').toLowerCase();
      if(k === 'arrowup' || k === 'w') handleInput('jump');
      if(k === 'arrowdown' || k === 's') handleInput('duck');
    });

    window.addEventListener('hha:shoot', (ev)=>{
      if(!state || !state.running) return;
      const d = ev?.detail || {};
      const rect = playArea.getBoundingClientRect();
      const y = Number.isFinite(d.y) ? d.y : (rect.top + rect.height/2);
      const mid = rect.top + rect.height/2;
      if(y < mid) handleInput('jump');
      else handleInput('duck');
    });

    if(btnDlEvents){
      btnDlEvents.addEventListener('click', ()=>{
        if(!state) return;
        downloadCsv(toCsv(state.events || []), `jd-events-${state.sessionId}.csv`);
      });
    }

    if(btnDlSessions){
      btnDlSessions.addEventListener('click', ()=>{
        if(!state) return;
        downloadCsv(toCsv(state.sessions || []), `jd-sessions-${state.sessionId}.csv`);
      });
    }

    if(btnSendLog){
      btnSendLog.addEventListener('click', async ()=>{
        if(!state){
          setLogStatus('No state', false);
          return;
        }
        if(!HHA_CTX.log){
          setLogStatus('No ?log= URL', false);
          return;
        }
        setLogStatus('Sending...', true);
        const q = await flushQueue();
        const r1 = await postBatch('events', state.events || []);
        const r2 = await postBatch('sessions', state.sessions || []);
        if(r1.ok && r2.ok){
          setLogStatus(`Sent ✅ (queued sent ${q.sent||0})`, true);
        }else{
          queuePayload({ kind:'events', rows: state.events || [] });
          queuePayload({ kind:'sessions', rows: state.sessions || [] });
          setLogStatus('Send failed → queued ⚠️', false);
        }
      });
    }

    if(HHA_CTX.log){
      flushQueue().then(r=>{
        if(r && r.sent) setLogStatus(`Queued sent ✅ (${r.sent})`, true);
      }).catch(()=>{});
    }
  }

  window.JD_EXPORT = {
    getState(){ return state ? JSON.parse(JSON.stringify(state)) : null; },
    getEvents(){ return state ? JSON.parse(JSON.stringify(state.events || [])) : []; },
    getSessions(){ return state ? JSON.parse(JSON.stringify(state.sessions || [])) : []; }
  };

  initBindings();
  showView('menu');
})();