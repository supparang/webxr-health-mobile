import { createBrushAudio } from './brush.audio.js?v=20260315a';
import {
  createZoneMastery,
  zoneDirectionText,
  humanZoneInstruction,
  starsText,
  calcZoneStars,
  zoneCoachFeedback,
  zoneSummaryChecks,
  zoneSummaryLine,
  zoneRealLifeTip,
  overallRealLifeTip
} from './brush.coach.js?v=20260315a';

(function(){
  'use strict';

  const byId = (id)=>document.getElementById(id);

  const zoneLayer = byId('zoneLayer');
  const fxLayer = byId('fxLayer');
  const zoneList = byId('zoneList');
  const arenaCore = byId('arenaCore');
  const brushCursor = byId('brushCursor');
  const cleanFill = byId('cleanFill');
  const bossBanner = byId('bossBanner');
  const summaryOverlay = byId('summaryOverlay');
  const laserLine = byId('laserLine');
  const shockRing = byId('shockRing');
  const bossHpWrap = byId('bossHpWrap');
  const bossHpFill = byId('bossHpFill');
  const bossHpText = byId('bossHpText');
  const phaseToast = byId('phaseToast');
  const comboBadge = byId('comboBadge');
  const screenFlash = byId('screenFlash');
  const demoHand = byId('demoHand');
  const demoHint = byId('demoHint');
  const trailLayer = byId('trailLayer');
  const coachToast = byId('coachToast');
  const learnOverlay = byId('learnOverlay');
  const mouthWrap = byId('mouthWrap');

  const qs = (k, d='')=>{
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch{ return d; }
  };

  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const num = (v,d)=> {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const nowISO = ()=> new Date().toISOString();

  function setText(id, value){
    const el = byId(id);
    if(el) el.textContent = value;
  }

  function setHtml(id, value){
    const el = byId(id);
    if(el) el.innerHTML = value;
  }

  function emitHha(type, detail){
    try{
      window.dispatchEvent(new CustomEvent(type, { detail }));
    }catch{}
  }

  const CFG = {
    gameId: qs('gameId','brush'),
    run: qs('run','play'),
    diff: qs('diff','normal'),
    view: qs('view','pc'),
    pid: qs('pid',''),
    seed: qs('seed', String(Date.now())),
    studyId: qs('studyId',''),
    time: clamp(num(qs('time','90'), 90), 45, 180),
    cleanTarget: 85,
    bossHP: 120,
    uvCdMs: 6000,
    polishCdMs: 7000,
    bossPhases: [
      { phase:1, hp: 55,  label:'คราบหนา' },
      { phase:2, hp: 80,  label:'หินปูน' },
      { phase:3, hp: 120, label:'บอสหินปูนใหญ่' }
    ]
  };

  const DIFF = {
    easy:   { stroke: 10, bossStroke: 14, missPenalty: 1, comboWindow: 1200, dirtTick: .00 },
    normal: { stroke:  8, bossStroke: 11, missPenalty: 2, comboWindow: 1000, dirtTick: .15 },
    hard:   { stroke:  7, bossStroke:  9, missPenalty: 3, comboWindow: 850,  dirtTick: .28 }
  }[CFG.diff] || {
    stroke: 8, bossStroke: 11, missPenalty: 2, comboWindow: 1000, dirtTick: .15
  };

  const MODES = {
    learn: {
      label: 'Learn',
      time: 9999,
      boss: false,
      uv: true,
      polish: true,
      missPenalty: 0,
      cleanTarget: 75
    },
    practice: {
      label: 'Practice',
      time: CFG.time,
      boss: true,
      uv: true,
      polish: true,
      missPenalty: DIFF.missPenalty,
      cleanTarget: CFG.cleanTarget
    },
    challenge: {
      label: 'Challenge',
      time: Math.max(45, Math.min(CFG.time, 75)),
      boss: true,
      uv: false,
      polish: false,
      missPenalty: DIFF.missPenalty + 1,
      cleanTarget: 90
    }
  };

  const ZONES = [
    { id:'upper_outer', label:'ฟันบนด้านนอก', x:18, y:20, w:64, h:14, dirtType:'normal', dir:'vertical' },
    { id:'upper_inner', label:'ฟันบนด้านใน', x:24, y:36, w:52, h:11, dirtType:'germ', dir:'vertical' },
    { id:'upper_chew',  label:'ฟันบนด้านบดเคี้ยว', x:30, y:49, w:40, h:8,  dirtType:'heavy',  dir:'horizontal' },
    { id:'lower_outer', label:'ฟันล่างด้านนอก', x:18, y:66, w:64, h:14, dirtType:'normal', dir:'vertical' },
    { id:'lower_inner', label:'ฟันล่างด้านใน', x:24, y:54, w:52, h:11, dirtType:'germ', dir:'vertical' },
    { id:'lower_chew',  label:'ฟันล่างด้านบดเคี้ยว', x:30, y:44, w:40, h:8,  dirtType:'heavy',  dir:'horizontal' }
  ];

  const audio = createBrushAudio({
    audioEnabled: qs('audio','1') !== '0',
    voiceEnabled: qs('voice','1') !== '0',
    speakRate: 1.02,
    speakPitch: 1.08,
    speakVolume: 0.9
  });

  const S = {
    startedAt: performance.now(),
    mode: (qs('mode','learn') || 'learn').toLowerCase(),
    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    hits: 0,
    bossHits: 0,
    totalActions: 0,
    clean: 0,
    timeLeft: CFG.time,
    activeZoneIdx: 0,
    phase: 'learn',
    bossHP: CFG.bossHP,
    bossMaxHP: CFG.bossHP,
    finished: false,
    bossStarted: false,
    bossCompleted: false,
    bossPattern: 'none',
    bossPhase: 0,
    lastTapAt: 0,
    uvUntil: 0,
    uvCdUntil: 0,
    polishCdUntil: 0,
    bossMode: 'idle',
    bossModeUntil: 0,
    bossNextPatternAt: 0,
    laserY: 50,
    shockGoodAt: 0,
    decoyZoneIdx: -1,
    isBrushing: false,
    brushLastX: 0,
    brushLastY: 0,
    brushLastT: 0,
    brushPathCombo: 0,
    lastBrushDx: 0,
    lastBrushDy: 0,
    learnOverlayShown: false,
    zoneMastery: createZoneMastery(),
    coachMsg: '',
    coachUntil: 0,
    coachHistory: [],
    quest: {
      perfectShock: 0,
      decoyAvoid: 0,
      laserSurvive: 0,
      donePerfectShock: false,
      doneDecoyAvoid: false,
      doneLaserSurvive: false
    },
    metrics: {
      laserPunish: 0,
      shockPerfect: 0,
      decoyPunish: 0
    },
    zoneState: ZONES.map(z => ({
      id: z.id,
      label: z.label,
      dirt: 30 + Math.round(Math.random()*25),
      clean: 0,
      completed: false,
      el: null,
      dirtEl: null
    }))
  };

  const LS_BRUSH_DRAFT = 'HHA_BRUSH_DRAFT';

  function currentModeCfg(){
    return MODES[S.mode] || MODES.learn;
  }

  function eventPayload(type, extra){
    return Object.assign({
      type,
      ts: nowISO(),
      gameId: CFG.gameId,
      pid: CFG.pid,
      run: CFG.run,
      diff: CFG.diff,
      time: CFG.time,
      seed: CFG.seed,
      studyId: CFG.studyId,
      href: location.href
    }, extra || {});
  }

  function setAudioPill(){
    setText('pillAudio', audio.getState().audioEnabled ? 'on' : 'off');
  }

  function setMode(mode){
    S.mode = MODES[mode] ? mode : 'learn';
    const u = new URL(location.href);
    u.searchParams.set('mode', S.mode);
    if(S.mode === 'learn') u.searchParams.set('showLearn', '1');
    else u.searchParams.delete('showLearn');
    location.href = u.toString();
  }

  function refreshModeButtons(){
    const learn = byId('btnModeLearn');
    const practice = byId('btnModePractice');
    const challenge = byId('btnModeChallenge');

    [learn, practice, challenge].forEach(el => el && el.classList.remove('modeActive'));
    if(S.mode === 'learn' && learn) learn.classList.add('modeActive');
    if(S.mode === 'practice' && practice) practice.classList.add('modeActive');
    if(S.mode === 'challenge' && challenge) challenge.classList.add('modeActive');

    setText('pillMode', currentModeCfg().label);
  }

  function setTopPills(){
    setText('pillGameId', CFG.gameId);
    setText('pillRun', CFG.run || 'play');
    setText('pillDiff', CFG.diff || 'normal');
    setText('pillView', CFG.view || 'pc');
    setText('statPid', CFG.pid || '—');
    setText('statSeed', CFG.seed || '—');
    setText('statStudy', CFG.studyId || '—');
  }

  function movementDirection(dx, dy){
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if(ax < 2 && ay < 2) return 'none';
    if(ax > ay * 1.15) return 'horizontal';
    if(ay > ax * 1.15) return 'vertical';
    return 'diagonal';
  }

  function directionScore(idx, dx, dy){
    const want = ZONES[idx]?.dir || 'vertical';
    const got = movementDirection(dx, dy);
    if(got === 'none') return 1;
    if(got === want) return 1.3;
    if(got === 'diagonal') return 0.95;
    return 0.72;
  }

  function zoneRectRelative(el){
    if(!el || !arenaCore) return null;
    const r = el.getBoundingClientRect();
    const base = arenaCore.getBoundingClientRect();
    return {
      left: r.left - base.left,
      top: r.top - base.top,
      width: r.width,
      height: r.height
    };
  }

  function stopDemoTutorial(){
    if(demoHand) demoHand.classList.remove('on');
    if(demoHint) demoHint.classList.remove('on');
    if(startDemoTutorial._raf){
      cancelAnimationFrame(startDemoTutorial._raf);
      startDemoTutorial._raf = 0;
    }
  }

  function startDemoTutorial(){
    const active = S.zoneState[S.activeZoneIdx];
    if(!active?.el || !demoHand || !demoHint || S.bossStarted || S.finished) return;

    const rr = zoneRectRelative(active.el);
    if(!rr) return;

    demoHand.classList.add('on');
    demoHint.classList.add('on');
    audio.playCue('demo-start');

    const t0 = performance.now();

    const loop = (ts)=>{
      if(S.finished || S.bossStarted){
        stopDemoTutorial();
        return;
      }

      const z = zoneRectRelative(active.el);
      if(!z){
        stopDemoTutorial();
        return;
      }

      const t = (ts - t0) / 1000;
      const swing = (Math.sin(t * Math.PI * 1.6) + 1) / 2;
      const bob = Math.sin(t * Math.PI * 3.2) * 4;

      const x = z.left + z.width * (0.18 + swing * 0.64);
      const y = z.top + z.height * 0.55 + bob;

      demoHand.style.left = x + 'px';
      demoHand.style.top = y + 'px';

      if(t >= 2.6){
        stopDemoTutorial();
        return;
      }

      startDemoTutorial._raf = requestAnimationFrame(loop);
    };

    startDemoTutorial._raf = requestAnimationFrame(loop);
  }

  function setNowDoText(text){
    const el = byId('nowDoText');
    const box = byId('nowDoBox');
    if(el) el.textContent = text;
    if(box){
      box.classList.remove('active');
      void box.offsetWidth;
      box.classList.add('active');
    }
  }

  function setCoachText(text, tone='mid'){
    const el = byId('coachText');
    const box = byId('coachBox');
    if(el){
      el.textContent = text;
      el.classList.remove('good','mid','warn');
      el.classList.add(tone);
    }
    if(box){
      box.classList.remove('active');
      void box.offsetWidth;
      box.classList.add('active');
    }
    S.coachMsg = text;
    S.coachUntil = performance.now() + 2400;
  }

  function showCoachToast(text){
    if(!coachToast) return;
    coachToast.textContent = text;
    coachToast.style.display = 'block';
    coachToast.classList.remove('on');
    void coachToast.offsetWidth;
    coachToast.classList.add('on');
    setTimeout(()=>{
      if(coachToast) coachToast.style.display = 'none';
    }, 900);
  }

  function zoneCleanPct(zs){
    return clamp(Math.round(zs.clean), 0, 100);
  }

  function totalCleanPct(){
    const sum = S.zoneState.reduce((a,z)=> a + zoneCleanPct(z), 0);
    return Math.round(sum / S.zoneState.length);
  }

  function pointInZone(idx, x, y){
    const zs = S.zoneState[idx];
    if(!zs?.el || !arenaCore) return false;

    const zr = zs.el.getBoundingClientRect();
    const ar = arenaCore.getBoundingClientRect();
    const px = ar.left + x;
    const py = ar.top + y;

    return px >= zr.left && px <= zr.right && py >= zr.top && py <= zr.bottom;
  }

  function flashScreen(kind){
    if(!screenFlash) return;
    if(kind === 'good') screenFlash.style.background = 'rgba(34,197,94,.12)';
    else if(kind === 'bad') screenFlash.style.background = 'rgba(239,68,68,.13)';
    else if(kind === 'boss') screenFlash.style.background = 'rgba(245,158,11,.12)';
    else screenFlash.style.background = 'rgba(255,255,255,.08)';
    screenFlash.style.opacity = '1';
    setTimeout(()=> { if(screenFlash) screenFlash.style.opacity = '0'; }, 90);
  }

  function showComboBadge(){
    if(!comboBadge) return;
    if(S.combo < 3){
      comboBadge.classList.remove('on');
      return;
    }
    comboBadge.textContent = `COMBO x${S.combo}`;
    comboBadge.classList.add('on');
    clearTimeout(showComboBadge._t);
    showComboBadge._t = setTimeout(()=> comboBadge.classList.remove('on'), 520);
  }

  function showPhaseToast(text){
    if(!phaseToast) return;
    phaseToast.textContent = text;
    phaseToast.classList.remove('on');
    void phaseToast.offsetWidth;
    phaseToast.classList.add('on');
  }

  function pulseZone(idx, good){
    const zs = S.zoneState[idx];
    if(!zs?.el) return;
    zs.el.classList.remove('goodHit','badHit');
    void zs.el.offsetWidth;
    zs.el.classList.add(good ? 'goodHit' : 'badHit');
    setTimeout(()=> zs.el?.classList.remove('goodHit','badHit'), 180);
  }

  function spawnPop(x, y, text){
    if(!fxLayer) return;
    const el = document.createElement('div');
    el.className = 'pop';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    fxLayer.appendChild(el);
    setTimeout(()=> el.remove(), 720);
  }

  function spawnSparkle(x, y){
    if(!fxLayer) return;
    for(let i=0;i<5;i++){
      const s = document.createElement('div');
      s.className = 'spark';
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.setProperty('--dx', ((Math.random()*80)-40).toFixed(0) + 'px');
      s.style.setProperty('--dy', ((Math.random()*-70)-8).toFixed(0) + 'px');
      fxLayer.appendChild(s);
      setTimeout(()=> s.remove(), 760);
    }
  }

  function spawnTrail(x, y, rot){
    if(!trailLayer) return;
    const el = document.createElement('div');
    el.className = 'brushTrail';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.setProperty('--rot', `${rot || 0}deg`);
    trailLayer.appendChild(el);
    setTimeout(()=> el.remove(), 340);
  }

  function spawnFoam(x, y){
    if(!trailLayer) return;
    const el = document.createElement('div');
    el.className = 'foam';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    trailLayer.appendChild(el);
    setTimeout(()=> el.remove(), 460);
  }

  function updateBrushCursor(ev){
    if(!arenaCore || !brushCursor) return;
    const r = arenaCore.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    brushCursor.style.left = x + 'px';
    brushCursor.style.top = y + 'px';
    brushCursor.style.opacity = '1';
  }

  function updateDirBadge(idx, dx, dy){
    const el = byId('dirBadge');
    if(!el) return;
    el.classList.remove('dirGood','dirWarn');

    const txt = zoneDirectionText(idx);
    const icon = ZONES[idx]?.dir === 'horizontal' ? '↔' : '↕';
    const sc = directionScore(idx, dx, dy);

    if(sc >= 1.25){
      el.classList.add('dirGood');
      el.textContent = `${icon} ${txt} ✓`;
    } else if(sc < 0.9){
      el.classList.add('dirWarn');
      el.textContent = `${icon} ${txt} !`;
    } else {
      el.textContent = `${icon} ${txt}`;
    }
  }

  function addScore(base, x, y, label){
    S.score += base;
    S.hits++;
    S.totalActions++;

    const now = performance.now();
    if(now - S.lastTapAt <= DIFF.comboWindow) S.combo++;
    else S.combo = 1;

    S.lastTapAt = now;
    S.maxCombo = Math.max(S.maxCombo, S.combo);

    const mult = 1 + Math.min(1.2, S.combo * 0.03);
    S.score += Math.round(base * (mult - 1));

    spawnPop(x, y, label || (`+${Math.round(base)}`));
    spawnSparkle(x, y);
    flashScreen('good');
    showComboBadge();
  }

  function addMiss(x, y, reason){
    S.miss++;
    S.totalActions++;
    S.combo = 0;
    S.score = Math.max(0, S.score - currentModeCfg().missPenalty);
    spawnPop(x, y, reason || 'MISS');
    flashScreen('bad');
  }

  function resetBrushCombo(){
    S.brushPathCombo = 0;
  }

  function addBrushDragProgress(idx, dist, x, y){
    const zs = S.zoneState[idx];
    if(!zs) return;

    const safeDist = Math.max(0, dist);
    if(safeDist < 4) return;

    const continuous = performance.now() - S.brushLastT <= 120;
    if(continuous) S.brushPathCombo = Math.min(140, S.brushPathCombo + safeDist);
    else S.brushPathCombo = safeDist;

    const pathBoost =
      S.brushPathCombo >= 120 ? 1.55 :
      S.brushPathCombo >= 80  ? 1.35 :
      S.brushPathCombo >= 40  ? 1.18 : 1;

    const dirBoost = directionScore(idx, S.lastBrushDx, S.lastBrushDy);
    const cleanGain = safeDist * 0.055 * pathBoost * dirBoost;

    zs.clean = clamp(zs.clean + cleanGain, 0, 100);
    zs.dirt  = clamp(zs.dirt  - cleanGain * (dirBoost >= 1.25 ? 1.2 : dirBoost < 0.9 ? 0.72 : 0.95), 0, 100);

    const microScore = Math.max(0, Math.round(safeDist * 0.12 * pathBoost * dirBoost));
    S.score += microScore;

    const ms = S.zoneMastery[idx];
    if(dirBoost >= 1.25){
      if(ms) ms.correctDirHits++;
      if(Math.random() < 0.04){
        setCoachText(`ดีมาก กำลัง${zoneDirectionText(idx)}ได้ถูกต้อง`, 'good');
        audio.playCue('dir-good');
      }
    } else if(dirBoost < 0.9){
      if(ms) ms.wrongDirHits++;
      if(Math.random() < 0.03){
        setCoachText(`ลอง${zoneDirectionText(idx)}เบา ๆ นะ จะสะอาดเร็วขึ้น`, 'warn');
        audio.playCue('dir-warn');
      }
    }

    if(Math.random() < 0.18) spawnFoam(x, y);
  }

  function renderDirtForZone(idx){
    const zs = S.zoneState[idx];
    const meta = ZONES[idx];
    if(!zs.dirtEl) return;

    zs.dirtEl.innerHTML = '';
    const count = clamp(Math.ceil(zs.dirt / 12), 0, 8);

    for(let i=0;i<count;i++){
      const blob = document.createElement('div');
      let klass = meta.dirtType;
      if(S.bossStarted && idx === S.activeZoneIdx && !S.bossCompleted) klass = 'boss';
      blob.className = `dirtBlob ${klass}`;

      const horizontal = ZONES[idx]?.dir === 'horizontal';
      if(klass === 'boss'){
        const size = 16 + Math.random()*28;
        blob.style.width = size + 'px';
        blob.style.height = size + 'px';
      } else if(horizontal){
        blob.style.width = (18 + Math.random()*34) + 'px';
        blob.style.height = (6 + Math.random()*6) + 'px';
      } else {
        blob.style.width = (6 + Math.random()*6) + 'px';
        blob.style.height = (18 + Math.random()*34) + 'px';
      }

      blob.style.left = (10 + Math.random()*72) + '%';
      blob.style.top = (16 + Math.random()*56) + '%';
      blob.style.animationDelay = (Math.random()*0.6).toFixed(2) + 's';
      zs.dirtEl.appendChild(blob);
    }
  }

  function buildZones(){
    if(!zoneLayer || !zoneList) return;
    zoneLayer.innerHTML = '';
    zoneList.innerHTML = '';

    S.zoneState.forEach((zs, idx)=>{
      const meta = ZONES[idx];

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'zone';

      if (CFG.view === 'mobile' || CFG.view === 'cvr' || window.innerWidth <= 760) {
        el.classList.add('tapBoost');
      }

      el.style.left = meta.x + '%';
      el.style.top = meta.y + '%';
      el.style.width = meta.w + '%';
      el.style.height = meta.h + '%';
      el.dataset.zoneId = zs.id;

      const label = document.createElement('div');
      label.className = 'zoneLabel';
      label.textContent = zs.label;
      el.appendChild(label);

      const dir = document.createElement('div');
      dir.className = 'zoneDir';
      dir.textContent = meta.dir === 'horizontal' ? '↔' : '↕';
      el.appendChild(dir);

      const dirt = document.createElement('div');
      dirt.className = 'dirt';
      el.appendChild(dirt);

      zs.el = el;
      zs.dirtEl = dirt;

      renderDirtForZone(idx);

      el.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault();
        onBrushZone(idx, ev);
      });

      zoneLayer.appendChild(el);

      const item = document.createElement('div');
      item.className = 'zoneItem';
      item.id = 'zoneItem_' + zs.id;
      item.innerHTML = `
        <div class="zoneRow">
          <div class="zoneName">${zs.label}</div>
          <div class="zonePct" id="zonePct_${zs.id}">0%</div>
        </div>
        <div class="miniBar"><div class="miniFill" id="zoneFill_${zs.id}"></div></div>
        <div class="zoneRow" style="margin-top:4px;">
          <div class="zonePct" id="zoneStars_${zs.id}">☆☆☆</div>
          <div class="zonePct" id="zoneNote_${zs.id}">ยังไม่จบ</div>
        </div>
      `;
      zoneList.appendChild(item);
    });

    refreshZoneUI();
  }

  function bossPhaseCfg(phase){
    return CFG.bossPhases.find(p => p.phase === phase) || CFG.bossPhases[CFG.bossPhases.length - 1];
  }

  function setBossBanner(text){
    if(!bossBanner) return;
    bossBanner.textContent = text;
    bossBanner.classList.add('on');
  }

  function scheduleNextBossPattern(delayMs){
    S.bossNextPatternAt = performance.now() + (delayMs || (1200 + Math.random()*1000));
  }

  function clearDecoy(){
    if(S.decoyZoneIdx >= 0 && S.zoneState[S.decoyZoneIdx]?.el){
      S.zoneState[S.decoyZoneIdx].el.classList.remove('decoy');
    }
    S.decoyZoneIdx = -1;
  }

  function setBossPhase(phase){
    S.bossPhase = phase;
    const cfg = bossPhaseCfg(phase);
    S.bossHP = cfg.hp;
    S.bossMaxHP = cfg.hp;
    setBossBanner(`🦠 Phase ${phase}: ${cfg.label}`);
    showPhaseToast(`PHASE ${phase}`);
    flashScreen('boss');
    emitHha('hha:event', eventPayload('boss_phase_start', {
      bossPhase: phase,
      bossHP: S.bossHP,
      bossLabel: cfg.label
    }));
  }

  function maybeAdvanceBossPhase(x, y){
    if(S.bossHP > 0) return false;
    if(S.bossPhase < 3){
      S.bossPhase++;
      setBossPhase(S.bossPhase);
      spawnPop(x, y, `PHASE ${S.bossPhase}`);
      setCoachText(`ยอดเยี่ยม! ผ่านบอสเฟส ${S.bossPhase - 1} แล้ว`, 'good');
      showCoachToast(`ผ่านเฟส ${S.bossPhase - 1}`);
      audio.playCue('boss-phase', `ผ่านเฟส ${S.bossPhase}`);
      scheduleNextBossPattern(900);
      return true;
    }
    S.bossCompleted = true;
    S.phase = 'polish';
    if(bossBanner) bossBanner.classList.remove('on');
    clearDecoy();
    if(laserLine) laserLine.classList.remove('on');
    if(shockRing) shockRing.classList.remove('on');
    spawnPop(x, y, 'ชนะบอส!');
    setCoachText('สุดยอด! กำจัดบอสหินปูนได้แล้ว', 'good');
    showCoachToast('ชนะบอสแล้ว!');
    audio.playCue('boss-win');
    emitHha('hha:event', eventPayload('boss_complete', { bossPhase: S.bossPhase }));
    return true;
  }

  function bossPhasePatternPool(){
    if(S.bossPhase <= 1) return ['shock'];
    if(S.bossPhase === 2) return ['shock','laser'];
    return ['shock','laser','decoy'];
  }

  function pickBossPattern(){
    const pool = bossPhasePatternPool();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function bossEnterLaser(){
    S.bossPattern = 'laser';
    S.bossMode = 'laserWarn';
    S.bossModeUntil = performance.now() + 1000;
    S.laserY = 28 + Math.random()*44;
    if(laserLine){
      laserLine.style.top = S.laserY + '%';
      laserLine.classList.add('on');
    }
    setBossBanner('🚫 LASER! หยุดแปรงชั่วคราว');
    setCoachText('เลเซอร์กำลังมา หยุดก่อนนะ', 'warn');
    audio.playCue('boss-laser');
    emitHha('hha:event', eventPayload('boss_laser_warn', { y:S.laserY }));
  }

  function bossLaserLive(){
    S.bossMode = 'laserLive';
    S.bossModeUntil = performance.now() + 1100;
    if(laserLine) laserLine.classList.add('on');
    setBossBanner('🚫 LASER ACTIVE — แตะจะโดนหักคะแนน');
    emitHha('hha:event', eventPayload('boss_laser_live', { y:S.laserY }));
  }

  function bossExitLaser(){
    if(laserLine) laserLine.classList.remove('on');
    S.quest.laserSurvive++;
    if(S.quest.laserSurvive >= 2) S.quest.doneLaserSurvive = true;
    S.bossMode = 'idle';
    S.bossPattern = 'none';
    scheduleNextBossPattern(900);
  }

  function bossEnterShock(){
    S.bossPattern = 'shock';
    S.bossMode = 'shockWait';
    S.shockGoodAt = performance.now() + 700;
    S.bossModeUntil = S.shockGoodAt + 260;
    if(shockRing){
      shockRing.classList.remove('on');
      void shockRing.offsetWidth;
      shockRing.classList.add('on');
    }
    setBossBanner('⚡ SHOCK! แตะให้ตรงจังหวะวงแหวน');
    setCoachText('รอจังหวะแล้วแตะตามวงแหวน', 'mid');
    audio.playCue('boss-shock');
    emitHha('hha:event', eventPayload('boss_shock_start', {}));
  }

  function bossExitShock(){
    if(shockRing) shockRing.classList.remove('on');
    S.bossMode = 'idle';
    S.bossPattern = 'none';
    scheduleNextBossPattern(950);
  }

  function bossEnterDecoy(){
    clearDecoy();
    S.bossPattern = 'decoy';
    S.bossMode = 'decoy';
    S.bossModeUntil = performance.now() + 1800;

    const candidates = S.zoneState
      .map((z,i)=> ({ z, i }))
      .filter(v => v.i !== S.activeZoneIdx);

    if(candidates.length){
      const pick = candidates[(Math.random()*candidates.length)|0];
      S.decoyZoneIdx = pick.i;
      pick.z.el?.classList.add('decoy');
    }

    setBossBanner('🪞 DECOY! แตะเฉพาะโซนจริงที่เรืองแสง');
    setCoachText('มีโซนหลอกแล้ว แตะเฉพาะโซนจริงนะ', 'warn');
    audio.playCue('boss-decoy');
    emitHha('hha:event', eventPayload('boss_decoy_start', { decoyZoneIdx:S.decoyZoneIdx }));
  }

  function bossExitDecoy(){
    clearDecoy();
    S.quest.decoyAvoid++;
    if(S.quest.decoyAvoid >= 2) S.quest.doneDecoyAvoid = true;
    S.bossMode = 'idle';
    S.bossPattern = 'none';
    scheduleNextBossPattern(900);
  }

  function runBossPatternController(){
    if(!S.bossStarted || S.bossCompleted || S.finished) return;
    const now = performance.now();

    if(S.bossMode === 'idle' && now >= S.bossNextPatternAt){
      const p = pickBossPattern();
      if(p === 'laser') bossEnterLaser();
      else if(p === 'shock') bossEnterShock();
      else bossEnterDecoy();
      return;
    }

    if(S.bossMode === 'laserWarn' && now >= S.bossModeUntil) return bossLaserLive();
    if(S.bossMode === 'laserLive' && now >= S.bossModeUntil) return bossExitLaser();
    if(S.bossMode === 'shockWait' && now >= S.bossModeUntil) return bossExitShock();
    if(S.bossMode === 'decoy' && now >= S.bossModeUntil) return bossExitDecoy();
  }

  function punishLaser(x, y){
    S.score = Math.max(0, S.score - 18);
    S.combo = 0;
    S.miss++;
    S.totalActions++;
    S.metrics.laserPunish++;
    S.quest.laserSurvive = 0;
    pulseZone(S.activeZoneIdx, false);
    flashScreen('bad');
    spawnPop(x, y, 'LASER!');
    audio.playCue('laser-hit');
    emitHha('hha:event', eventPayload('boss_laser_punish', {}));
  }

  function rewardShockPerfect(x, y){
    S.score += 36;
    S.combo += 2;
    S.maxCombo = Math.max(S.maxCombo, S.combo);
    S.bossHP = clamp(S.bossHP - 18, 0, CFG.bossHP);
    S.bossHits++;
    S.metrics.shockPerfect++;
    S.quest.perfectShock++;
    if(S.quest.perfectShock >= 3) S.quest.donePerfectShock = true;
    spawnPop(x, y, 'SHOCK PERFECT');
    spawnSparkle(x, y);
    audio.playCue('shock-perfect');
    bossExitShock();
    refreshZoneUI();
  }

  function punishDecoy(x, y){
    S.score = Math.max(0, S.score - 14);
    S.combo = 0;
    S.miss++;
    S.totalActions++;
    S.metrics.decoyPunish++;
    S.quest.decoyAvoid = 0;
    pulseZone(S.activeZoneIdx, false);
    flashScreen('bad');
    spawnPop(x, y, 'DECOY');
    audio.playCue('decoy-hit');
    const dz = S.zoneState[S.decoyZoneIdx];
    dz?.el?.classList.add('fakeTap');
    setTimeout(()=> dz?.el?.classList.remove('fakeTap'), 260);
    emitHha('hha:event', eventPayload('boss_decoy_punish', { decoyZoneIdx:S.decoyZoneIdx }));
  }

  function maybeAdvanceZone(){
    const active = S.zoneState[S.activeZoneIdx];
    if(!active || !active.completed) return;
    const nextIdx = S.zoneState.findIndex(z => !z.completed);
    if(nextIdx >= 0) S.activeZoneIdx = nextIdx;
  }

  function maybeStartBoss(){
    if(!currentModeCfg().boss) return;
    if(S.bossStarted) return;
    const allReady = S.zoneState.every(z => zoneCleanPct(z) >= currentModeCfg().cleanTarget);
    if(!allReady) return;

    S.bossStarted = true;
    S.phase = 'boss';
    S.activeZoneIdx = 0;
    S.bossPhase = 1;
    setBossPhase(1);

    S.zoneState.forEach((z, i)=>{
      z.completed = zoneCleanPct(z) >= currentModeCfg().cleanTarget;
      if(i === S.activeZoneIdx){
        z.dirt = 100;
        renderDirtForZone(i);
      }
    });

    setBossBanner('🦠 บอสหินปูนปรากฏแล้ว!');
    scheduleNextBossPattern(1000);
    emitHha('hha:event', eventPayload('boss_start', { bossHP: S.bossHP }));
  }

  function startBossNow(){
    S.zoneState.forEach(z=>{
      z.clean = Math.max(z.clean, currentModeCfg().cleanTarget);
      z.completed = true;
    });
    maybeStartBoss();
    scheduleNextBossPattern(600);
    refreshZoneUI();
  }

  function useUV(){
    if(!currentModeCfg().uv) return;
    const now = performance.now();
    if(now < S.uvCdUntil || S.finished) return;
    S.uvUntil = now + 3200;
    S.uvCdUntil = now + CFG.uvCdMs;
    if(arenaCore) spawnPop(arenaCore.clientWidth * .5, 60, 'UV ON');
    refreshZoneUI();
  }

  function usePolish(){
    if(!currentModeCfg().polish) return;
    const now = performance.now();
    if(now < S.polishCdUntil || S.finished) return;
    S.polishCdUntil = now + CFG.polishCdMs;

    S.zoneState.forEach((z, idx)=>{
      z.clean = clamp(z.clean + 6, 0, 100);
      z.dirt = clamp(z.dirt - 7, 0, 100);
      if(zoneCleanPct(z) >= currentModeCfg().cleanTarget) z.completed = true;
      renderDirtForZone(idx);
    });

    S.score += 30;
    if(arenaCore) spawnPop(arenaCore.clientWidth * .5, 86, 'POLISH!');
    maybeStartBoss();
    refreshZoneUI();
  }

  function emitStart(){
    emitHha('hha:start', eventPayload('start', {
      gameId: CFG.gameId,
      pid: CFG.pid,
      run: CFG.run,
      diff: CFG.diff,
      view: CFG.view,
      seed: CFG.seed,
      studyId: CFG.studyId
    }));
  }

  function emitProgress(){
    emitHha('hha:time', eventPayload('progress', {
      gameId: CFG.gameId,
      score: Math.round(S.score),
      combo: S.combo,
      miss: S.miss,
      clean: S.clean,
      bossHP: S.bossStarted ? Math.max(0, Math.ceil(S.bossHP)) : null,
      phase: S.phase,
      bossPhase: S.bossPhase,
      timeLeft: Math.ceil(S.timeLeft)
    }));
  }

  function updateLearnOverlayText(){
    const el = byId('learnOverlayNow');
    const active = S.zoneState[S.activeZoneIdx];
    if(!el || !active) return;
    el.textContent = `${humanZoneInstruction(active.label)} ในกรอบสีฟ้า`;
  }

  function openLearnOverlay(){
    if(!learnOverlay) return;
    updateLearnOverlayText();
    learnOverlay.style.display = 'grid';
    S.learnOverlayShown = true;
    audio.playCue('learn-open');
  }

  function closeLearnOverlay(){
    if(!learnOverlay) return;
    learnOverlay.style.display = 'none';
  }

  function refreshZoneUI(){
    S.clean = totalCleanPct();

    if(cleanFill) cleanFill.style.width = S.clean + '%';
    setText('statClean', S.clean + '%');
    setText('statScore', String(Math.round(S.score)));
    setText('statCombo', String(S.combo));
    setText('statMiss', String(S.miss));
    setText('statTime', S.mode === 'learn' ? '∞' : String(Math.ceil(S.timeLeft)));
    setText(
      'statBoss',
      S.bossStarted && !S.bossCompleted
        ? `${Math.max(0, Math.ceil(S.bossHP))}/${Math.max(0, Math.ceil(S.bossMaxHP))}`
        : '—'
    );

    if(bossHpWrap && bossHpFill && bossHpText){
      if(S.bossStarted && !S.bossCompleted){
        bossHpWrap.style.display = 'grid';
        const pct = S.bossMaxHP > 0 ? clamp((S.bossHP / S.bossMaxHP) * 100, 0, 100) : 0;
        bossHpFill.style.width = pct + '%';
        bossHpText.textContent = `${Math.max(0, Math.ceil(S.bossHP))}/${Math.max(0, Math.ceil(S.bossMaxHP))}`;
      } else {
        bossHpWrap.style.display = 'none';
      }
    }

    const phaseText = S.phase === 'boss'
      ? `บอส P${S.bossPhase || 1}`
      : (S.phase === 'polish' ? 'เก็บรายละเอียด' : 'เรียนรู้');
    setText('pillPhase', phaseText);

    const active = S.zoneState[S.activeZoneIdx];
    setText('pillZone', active ? active.label : '—');

    S.zoneState.forEach((zs, idx)=>{
      const activeNow = idx === S.activeZoneIdx;

      if(zs.el){
        zs.el.classList.toggle('active', activeNow && !S.finished);
        zs.el.classList.toggle('completed', zs.completed);
        zs.el.style.zIndex = activeNow ? '3' : '1';
      }

      const item = byId('zoneItem_' + zs.id);
      if(item){
        item.classList.toggle('active', activeNow && !S.finished);
        item.classList.toggle('completed', zs.completed);
      }

      const pct = zoneCleanPct(zs);
      const fill = byId('zoneFill_' + zs.id);
      const pctEl = byId('zonePct_' + zs.id);
      if(fill) fill.style.width = pct + '%';
      if(pctEl) pctEl.textContent = pct + '%';

      const starsEl = byId('zoneStars_' + zs.id);
      const noteEl = byId('zoneNote_' + zs.id);
      const ms = S.zoneMastery[idx];

      if(ms && starsEl){
        calcZoneStars(S.zoneState, S.zoneMastery, idx, currentModeCfg().cleanTarget);
        starsEl.textContent = starsText(ms.totalStar);
        starsEl.classList.toggle('starGood', ms.totalStar >= 2);
      }

      if(ms && noteEl){
        noteEl.classList.remove('noteGood','noteMid','noteWarn');
        if(zs.completed){
          noteEl.textContent =
            ms.totalStar >= 3 ? 'ยอดเยี่ยม' :
            ms.totalStar === 2 ? 'ดีมาก' :
            ms.totalStar === 1 ? 'ผ่านแล้ว' : 'ลองอีกนิด';

          if(ms.totalStar >= 3) noteEl.classList.add('noteGood');
          else if(ms.totalStar === 2) noteEl.classList.add('noteMid');
          else noteEl.classList.add('noteWarn');
        } else {
          noteEl.textContent = (idx === S.activeZoneIdx) ? 'กำลังเล่น' : 'ยังไม่จบ';
        }
      }
    });

    if(!S.bossStarted){
      const zLabel = active ? active.label : '—';
      const target = currentModeCfg().cleanTarget;

      if(S.mode === 'learn'){
        setHtml(
          'instruction',
          `ลองถู <b>${zLabel}</b>
           <span class="sub" id="instructionSub">ถูในกรอบสีฟ้าไปเรื่อย ๆ แบบไม่ต้องรีบ</span>`
        );
        setText('questText', `ฝึกทีละโซนให้คุ้นมือ • เป้าหมายโซนละ ${target}%`);
      }
      else if(S.mode === 'practice'){
        setHtml(
          'instruction',
          `ตอนนี้ให้ถู <b>${zLabel}</b>
           <span class="sub" id="instructionSub">ถูในกรอบสีฟ้าบนรูปฟันตรงกลาง</span>`
        );
        setText('questText', `ทำความสะอาดทีละโซนให้เกิน ${target}% แล้วจะเจอบอสหินปูน`);
      }
      else{
        setHtml(
          'instruction',
          `รีบถู <b>${zLabel}</b>
           <span class="sub" id="instructionSub">ถูให้เร็ว แม่น และถูกทิศ</span>`
        );
        setText('questText', `โหมดท้าทาย: แต่ละโซนต้องเกิน ${target}% แล้วไปสู้บอส`);
      }
    } else if (!S.bossCompleted){
      let sub = 'แตะเร็วอย่างแม่นยำเพื่อลด HP บอส';
      if(S.bossMode === 'laserWarn') sub = 'เตือนเลเซอร์: เตรียมหยุดแปรง';
      else if(S.bossMode === 'laserLive') sub = 'เลเซอร์ทำงาน: ห้ามแตะ';
      else if(S.bossMode === 'shockWait') sub = 'Shockwave: แตะให้ตรงจังหวะวงแหวน';
      else if(S.bossMode === 'decoy') sub = 'Decoy: แตะเฉพาะโซนจริงที่เรืองแสง';

      setHtml(
        'instruction',
        `บอสหินปูนกำลังเกาะที่ ${active ? active.label : '—'}
         <span class="sub" id="instructionSub">${sub}</span>`
      );

      setHtml(
        'questText',
        `ลด HP บอสให้เหลือ 0 • ตอนนี้ HP ${Math.max(0, Math.ceil(S.bossHP))}<br>
         Shock Perfect: <b>${S.quest.perfectShock}/3</b> ${S.quest.donePerfectShock ? '✅' : ''} •
         Survive Laser: <b>${S.quest.laserSurvive}/2</b> ${S.quest.doneLaserSurvive ? '✅' : ''} •
         Avoid Decoy: <b>${S.quest.decoyAvoid}/2</b> ${S.quest.doneDecoyAvoid ? '✅' : ''}`
      );
    } else {
      setHtml(
        'instruction',
        `ฟันสะอาดแล้ว! เก็บรายละเอียดหรือจบเกมได้
         <span class="sub" id="instructionSub">กด Finish เพื่อดูคะแนนหรือเล่นต่อเก็บคะแนนเพิ่ม</span>`
      );

      setHtml(
        'questText',
        `บอสถูกกำจัดแล้ว • คุณสามารถแปรงเก็บคะแนนต่อหรือจบเกมได้<br>
         Quest: Shock ${S.quest.donePerfectShock ? '✅' : '⬜'} •
         Laser ${S.quest.doneLaserSurvive ? '✅' : '⬜'} •
         Decoy ${S.quest.doneDecoyAvoid ? '✅' : '⬜'}`
      );
    }

    const dirBadge = byId('dirBadge');
    if(dirBadge){
      const icon = ZONES[S.activeZoneIdx]?.dir === 'horizontal' ? '↔' : '↕';
      dirBadge.classList.remove('dirGood','dirWarn');
      dirBadge.textContent = `${icon} ${zoneDirectionText(S.activeZoneIdx)}`;
    }

    const hintBadge = byId('hintBadge');
    if(hintBadge){
      if(!S.bossStarted){
        if(S.mode === 'learn'){
          hintBadge.textContent = `👆 ลอง${zoneDirectionText(S.activeZoneIdx)}ช้า ๆ`;
          setNowDoText(`${humanZoneInstruction(active ? active.label : 'โซนนี้')} แบบไม่ต้องรีบ`);
        } else if(S.mode === 'practice'){
          hintBadge.textContent = `👆 ${zoneDirectionText(S.activeZoneIdx)}ในกรอบสีฟ้า`;
          setNowDoText(`${humanZoneInstruction(active ? active.label : 'โซนนี้')} โดย${zoneDirectionText(S.activeZoneIdx)}`);
        } else {
          hintBadge.textContent = `⚡ ${zoneDirectionText(S.activeZoneIdx)}ให้เร็วและแม่น`;
          setNowDoText(`${humanZoneInstruction(active ? active.label : 'โซนนี้')} ให้เร็วและถูกทิศ`);
        }
      }
      else if (!S.bossCompleted){
        if(S.bossMode === 'laserWarn'){
          hintBadge.textContent = '🚫 เตรียมหยุดแปรง';
          setNowDoText('หยุดก่อน เลเซอร์กำลังมา');
        }
        else if(S.bossMode === 'laserLive'){
          hintBadge.textContent = '🚫 ห้ามแตะตอนเลเซอร์ทำงาน';
          setNowDoText('ห้ามแตะตอนนี้');
        }
        else if(S.bossMode === 'shockWait'){
          hintBadge.textContent = '⚡ แตะให้ตรงจังหวะวงแหวน';
          setNowDoText('แตะตามวงแหวน');
        }
        else if(S.bossMode === 'decoy'){
          hintBadge.textContent = '🪞 อย่าแตะโซนปลอม';
          setNowDoText('อย่าแตะโซนหลอก');
        }
        else{
          hintBadge.textContent = `🦠 โจมตีบอสที่ ${active ? active.label : '—'}`;
          setNowDoText(`สู้บอสที่ ${active ? active.label : 'โซนปัจจุบัน'}`);
        }
      } else {
        hintBadge.textContent = '✨ เก็บคะแนนเพิ่มหรือกด Finish';
        setNowDoText('กด Finish เพื่อดูสรุปผล หรือเล่นต่อเก็บคะแนน');
      }
    }

    const uvReady = performance.now() >= S.uvCdUntil;
    const polishReady = performance.now() >= S.polishCdUntil;
    const btnUV = byId('btnUV');
    const btnPolish = byId('btnPolish');
    if(btnUV){
      btnUV.classList.toggle('disabled', !uvReady || !currentModeCfg().uv);
    }
    if(btnPolish){
      btnPolish.classList.toggle('disabled', !polishReady || !currentModeCfg().polish);
    }

    const btnStartBoss = byId('btnStartBoss');
    if(btnStartBoss){
      btnStartBoss.classList.toggle('disabled', !currentModeCfg().boss);
    }
  }

  function onBrushZone(idx, ev){
    if(S.finished || !arenaCore) return;
    stopDemoTutorial();

    const rect = arenaCore.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    const zs = S.zoneState[idx];
    const isActive = idx === S.activeZoneIdx;
    const now = performance.now();

    if(S.phase === 'boss' && !S.bossCompleted){
      if(S.bossMode === 'laserLive'){
        punishLaser(x, y);
        refreshZoneUI();
        return;
      }

      if(S.bossMode === 'shockWait'){
        const goodWindow = Math.abs(now - S.shockGoodAt) <= 140;
        if(isActive && goodWindow){
          rewardShockPerfect(x, y);
          renderDirtForZone(idx);
          if(S.bossHP <= 0) maybeAdvanceBossPhase(x, y);
          refreshZoneUI();
          emitProgress();
          return;
        } else {
          addMiss(x, y, goodWindow ? 'ผิดโซน' : 'พลาดจังหวะ');
          pulseZone(idx, false);
          const mShock = S.zoneMastery[idx];
          if(mShock) mShock.localMiss++;
          setCoachText('ลองแตะตามจังหวะอีกครั้ง', 'warn');
          refreshZoneUI();
          return;
        }
      }

      if(S.bossMode === 'decoy' && idx === S.decoyZoneIdx){
        punishDecoy(x, y);
        refreshZoneUI();
        return;
      }
    }

    if(!isActive){
      addMiss(x, y, 'ผิดโซน');
      pulseZone(idx, false);
      const activeMastery = S.zoneMastery[S.activeZoneIdx];
      if(activeMastery) activeMastery.localMiss++;
      setNowDoText(`ยังไม่ใช่โซนนี้ • ให้ถู ${humanZoneInstruction(S.zoneState[S.activeZoneIdx]?.label || 'โซนที่กำหนด')}`);
      setCoachText('ยังไม่ใช่โซนนี้นะ ลองดูกรอบสีฟ้า', 'warn');
      audio.playCue('wrong-zone');
      refreshZoneUI();
      return;
    }

    if(S.phase !== 'boss'){
      const boost = performance.now() < S.uvUntil ? 1.15 : 1;
      const delta = (DIFF.stroke * 0.45) * boost;
      zs.clean = clamp(zs.clean + delta, 0, 100);
      zs.dirt = clamp(zs.dirt - delta * 0.85, 0, 100);

      addScore(4 * boost, x, y, boost > 1 ? 'CLEAN+' : 'CLEAN');
      pulseZone(idx, true);

      if(zoneCleanPct(zs) >= currentModeCfg().cleanTarget && !zs.completed){
        zs.completed = true;
        const star = calcZoneStars(S.zoneState, S.zoneMastery, idx, currentModeCfg().cleanTarget);
        spawnPop(x, y, `ครบโซน! ${starsText(star)}`);

        const coach = zoneCoachFeedback({
          zoneState: S.zoneState,
          zoneMastery: S.zoneMastery,
          idx,
          mode: S.mode,
          targetClean: currentModeCfg().cleanTarget
        });
        const tip = zoneRealLifeTip(idx);
        setCoachText(`${coach.text} • ${tip}`, coach.tone);
        showCoachToast(star >= 3 ? 'เก่งมาก! 3 ดาว' : `ได้ ${star} ดาว`);
        audio.playCue(star >= 3 ? 'zone-perfect' : 'zone-clear');
        S.coachHistory.push({
          ts: nowISO(),
          zoneId: zs.id,
          zoneLabel: zs.label,
          star,
          text: `${coach.text} • ${tip}`,
          tone: coach.tone
        });
      }

      renderDirtForZone(idx);
      maybeAdvanceZone();
      maybeStartBoss();
      refreshZoneUI();
      emitProgress();
      return;
    }

    if(S.phase === 'boss' && !S.bossCompleted){
      const boost = performance.now() < S.uvUntil ? 1.1 : 1;
      const dmg = (DIFF.bossStroke * 0.5) * boost;
      S.bossHP = clamp(S.bossHP - dmg, 0, CFG.bossHP);
      zs.clean = clamp(zs.clean + 1.4 * boost, 0, 100);
      zs.dirt = clamp(zs.dirt - 2.4 * boost, 0, 100);

      S.bossHits++;
      addScore(7 * boost, x, y, boost > 1 ? 'BOSS!' : 'HIT');
      pulseZone(idx, true);
      flashScreen('boss');

      renderDirtForZone(idx);
      if(S.bossHP <= 0) maybeAdvanceBossPhase(x, y);

      refreshZoneUI();
      emitProgress();
    }
  }

  function saveDraft(){
    if(S.finished) return;
    const draft = {
      gameId: CFG.gameId,
      pid: CFG.pid,
      run: CFG.run,
      diff: CFG.diff,
      view: CFG.view,
      seed: CFG.seed,
      studyId: CFG.studyId,
      timeLeft: S.timeLeft,
      score: S.score,
      combo: S.combo,
      maxCombo: S.maxCombo,
      miss: S.miss,
      hits: S.hits,
      bossHits: S.bossHits,
      totalActions: S.totalActions,
      clean: S.clean,
      activeZoneIdx: S.activeZoneIdx,
      phase: S.phase,
      bossStarted: S.bossStarted,
      bossCompleted: S.bossCompleted,
      bossPhase: S.bossPhase,
      bossHP: S.bossHP,
      bossMaxHP: S.bossMaxHP,
      mode: S.mode,
      zoneState: S.zoneState.map(z => ({
        id:z.id, label:z.label, dirt:z.dirt, clean:z.clean, completed:z.completed
      })),
      zoneMastery: JSON.parse(JSON.stringify(S.zoneMastery)),
      quest: JSON.parse(JSON.stringify(S.quest)),
      metrics: JSON.parse(JSON.stringify(S.metrics)),
      savedAt: nowISO(),
      href: location.href
    };
    try{ localStorage.setItem(LS_BRUSH_DRAFT, JSON.stringify(draft)); }catch{}
  }

  function clearDraft(){
    try{ localStorage.removeItem(LS_BRUSH_DRAFT); }catch{}
  }

  function tryRestoreDraft(){
    let draft = null;
    try{ draft = JSON.parse(localStorage.getItem(LS_BRUSH_DRAFT) || 'null'); }
    catch{ draft = null; }

    if(!draft) return;
    if((draft.gameId||'') !== CFG.gameId) return;
    if((draft.pid||'') !== (CFG.pid||'')) return;
    if((draft.run||'') !== (CFG.run||'')) return;

    const ageMs = Date.now() - Date.parse(draft.savedAt || 0);
    if(!Number.isFinite(ageMs) || ageMs > 1000 * 60 * 20) return;

    const ok = confirm('พบเกม Brush ที่ค้างไว้ ต้องการเล่นต่อหรือไม่?');
    if(!ok){
      clearDraft();
      return;
    }

    S.timeLeft = num(draft.timeLeft, S.timeLeft);
    S.score = num(draft.score, S.score);
    S.combo = num(draft.combo, S.combo);
    S.maxCombo = num(draft.maxCombo, S.maxCombo);
    S.miss = num(draft.miss, S.miss);
    S.hits = num(draft.hits, S.hits);
    S.bossHits = num(draft.bossHits, S.bossHits);
    S.totalActions = num(draft.totalActions, S.totalActions);
    S.clean = num(draft.clean, S.clean);
    S.activeZoneIdx = num(draft.activeZoneIdx, S.activeZoneIdx);
    S.phase = draft.phase || S.phase;
    S.bossStarted = !!draft.bossStarted;
    S.bossCompleted = !!draft.bossCompleted;
    S.bossPhase = num(draft.bossPhase, S.bossPhase);
    S.bossHP = num(draft.bossHP, S.bossHP);
    S.bossMaxHP = num(draft.bossMaxHP, S.bossMaxHP);
    S.mode = draft.mode || S.mode;

    if(Array.isArray(draft.zoneState) && draft.zoneState.length === S.zoneState.length){
      draft.zoneState.forEach((z, i)=>{
        S.zoneState[i].dirt = num(z.dirt, S.zoneState[i].dirt);
        S.zoneState[i].clean = num(z.clean, S.zoneState[i].clean);
        S.zoneState[i].completed = !!z.completed;
      });
    }

    if(Array.isArray(draft.zoneMastery) && draft.zoneMastery.length === S.zoneMastery.length){
      draft.zoneMastery.forEach((m, i)=>{
        Object.assign(S.zoneMastery[i], m);
      });
    }

    if(draft.quest) S.quest = Object.assign(S.quest, draft.quest);
    if(draft.metrics) S.metrics = Object.assign(S.metrics, draft.metrics);

    S.zoneState.forEach((_, idx)=> renderDirtForZone(idx));
    if(arenaCore) spawnPop(arenaCore.clientWidth * 0.5, 64, 'RESTORED');
    showPhaseToast('CONTINUE');

    emitHha('hha:event', eventPayload('brush_restore', {
      timeLeft: S.timeLeft,
      bossPhase: S.bossPhase,
      score: Math.round(S.score)
    }));
  }

  function summaryQuestDone(kind){
    if(kind === 'shock') return !!S.quest.donePerfectShock;
    if(kind === 'laser') return !!S.quest.doneLaserSurvive;
    if(kind === 'decoy') return !!S.quest.doneDecoyAvoid;
    return false;
  }

  function rankFrom(score, clean, bossDone){
    const qDone = [
      S.quest.donePerfectShock,
      S.quest.doneLaserSurvive,
      S.quest.doneDecoyAvoid
    ].filter(Boolean).length;

    if(score >= 1050 && clean >= 94 && bossDone && qDone >= 3) return 'S';
    if(score >= 820 && clean >= 88 && bossDone && qDone >= 2) return 'A';
    if(score >= 620 && clean >= 80) return 'B';
    if(score >= 420 && clean >= 70) return 'C';
    return 'D';
  }

  function finishGame(endReason){
    if(S.finished) return;
    S.finished = true;
    clearDraft();
    clearDecoy();
    if(laserLine) laserLine.classList.remove('on');
    if(shockRing) shockRing.classList.remove('on');
    if(bossBanner) bossBanner.classList.remove('on');
    stopDemoTutorial();

    const acc = S.totalActions > 0 ? (S.hits / S.totalActions) * 100 : 0;
    const clean = totalCleanPct();
    const rank = rankFrom(S.score, clean, S.bossCompleted);
    const targetClean = currentModeCfg().cleanTarget;

    const summary = {
      gameId: CFG.gameId,
      gameTitle: 'Brush VR',
      gameIcon: '🦷',
      zoneId: 'hygiene',
      pid: CFG.pid || '',
      run: CFG.run || '',
      diff: CFG.diff || '',
      time: String(CFG.time),
      seed: CFG.seed || '',
      studyId: CFG.studyId || '',
      mode: S.mode,
      overallTip: overallRealLifeTip(S.zoneState, S.zoneMastery, targetClean),
      endReason: endReason || (S.bossCompleted ? 'complete' : 'timeup'),
      scoreFinal: Math.round(S.score),
      accuracyPct: Math.round(acc * 10) / 10,
      miss: S.miss,
      timePlayedSec: Math.round(CFG.time - S.timeLeft),
      cleanPct: clean,
      bossCompleted: S.bossCompleted,
      bossPhase: S.bossPhase,
      bossHits: S.bossHits,
      maxCombo: S.maxCombo,
      questPerfectShock: S.quest.perfectShock,
      questLaserSurvive: S.quest.laserSurvive,
      questDecoyAvoid: S.quest.decoyAvoid,
      questDonePerfectShock: S.quest.donePerfectShock,
      questDoneLaserSurvive: S.quest.doneLaserSurvive,
      questDoneDecoyAvoid: S.quest.doneDecoyAvoid,
      laserPunish: S.metrics.laserPunish,
      shockPerfectCount: S.metrics.shockPerfect,
      decoyPunish: S.metrics.decoyPunish,
      zoneSummary: S.zoneMastery.map((m, i)=>{
        const checks = zoneSummaryChecks(S.zoneState, S.zoneMastery, i, targetClean);
        return {
          id: m.id,
          label: m.label,
          stars: checks?.stars || 0,
          clean: !!checks?.clean,
          direction: !!checks?.direction,
          control: !!checks?.control,
          cleanPct: checks?.cleanPct || 0,
          dirRate: checks?.dirRate || 0,
          localMiss: checks?.localMiss || 0,
          line: zoneSummaryLine(S.zoneState, S.zoneMastery, i, targetClean),
          tip: zoneRealLifeTip(i)
        };
      }),
      coachHistory: S.coachHistory.slice(-12),
      savedAt: nowISO(),
      href: location.href
    };

    try{ window.HHA_BACKHUB?.setSummary?.(summary); }catch{}

    emitHha('hha:end', eventPayload('end', summary));
    emitHha('hha:event', eventPayload('brush_summary', {
      scoreFinal: summary.scoreFinal,
      accuracyPct: summary.accuracyPct,
      cleanPct: summary.cleanPct,
      bossCompleted: summary.bossCompleted,
      bossPhase: summary.bossPhase,
      maxCombo: summary.maxCombo,
      miss: summary.miss,
      laserPunish: summary.laserPunish,
      shockPerfectCount: summary.shockPerfectCount,
      decoyPunish: summary.decoyPunish,
      questDonePerfectShock: summary.questDonePerfectShock,
      questDoneLaserSurvive: summary.questDoneLaserSurvive,
      questDoneDecoyAvoid: summary.questDoneDecoyAvoid
    }));

    const qDone = [
      summaryQuestDone('shock'),
      summaryQuestDone('laser'),
      summaryQuestDone('decoy')
    ].filter(Boolean).length;

    setText('summaryRank', rank);
    setText('sumScore', String(summary.scoreFinal));
    setText('sumAcc', summary.accuracyPct + '%');
    setText('sumClean', summary.cleanPct + '%');
    setText('sumBoss', S.mode === 'learn' ? 'ไม่มีบอส' : (summary.bossCompleted ? 'ชนะแล้ว' : 'ยังไม่ชนะ'));
    setText('sumCombo', String(summary.maxCombo || 0));
    setText('sumQuest', `${qDone}/3 ผ่าน`);
    setText('summarySub', `${summary.gameTitle} • mode=${summary.mode} • end=${summary.endReason}`);

    const totalStars = summary.zoneSummary.reduce((a,z)=> a + z.stars, 0);
    setText(
      'resultHeroTitle',
      S.mode === 'learn'
        ? 'ฝึกแปรงฟันเสร็จแล้ว!'
        : (S.bossCompleted ? 'คุณกำจัดบอสหินปูนได้แล้ว!' : 'สรุปการแปรงฟันรอบนี้')
    );
    setText('resultHeroSub', `ฟันสะอาด ${summary.cleanPct}% • ความแม่น ${summary.accuracyPct}% • ดาวรวม ${totalStars}/18`);
    setText('resultHeroRank', rank);

    const rankEl = byId('resultHeroRank');
    if(rankEl){
      rankEl.style.color =
        rank === 'S' ? '#22c55e' :
        rank === 'A' ? '#22d3ee' :
        rank === 'B' ? '#f59e0b' :
        rank === 'C' ? '#fb7185' : '#94a3b8';
    }

    const qShock = byId('sumQShock');
    const qLaser = byId('sumQLaser');
    const qDecoy = byId('sumQDecoy');
    [qShock, qLaser, qDecoy].forEach(el => el && el.classList.remove('ok'));

    if(qShock){
      qShock.textContent = `Shock ${summary.questDonePerfectShock ? '✅' : '⬜'}`;
      qShock.classList.toggle('ok', !!summary.questDonePerfectShock);
    }
    if(qLaser){
      qLaser.textContent = `Laser ${summary.questDoneLaserSurvive ? '✅' : '⬜'}`;
      qLaser.classList.toggle('ok', !!summary.questDoneLaserSurvive);
    }
    if(qDecoy){
      qDecoy.textContent = `Decoy ${summary.questDoneDecoyAvoid ? '✅' : '⬜'}`;
      qDecoy.classList.toggle('ok', !!summary.questDoneDecoyAvoid);
    }

    const summaryCoachWrap = byId('summaryCoachWrap');
    if(summaryCoachWrap){
      const lastCoach = S.coachHistory.slice(-3);
      summaryCoachWrap.innerHTML = lastCoach.length
        ? `
          <div style="font-size:13px; font-weight:950;">Coach Notes</div>
          ${lastCoach.map(c => `
            <div style="border:1px solid rgba(148,163,184,.16); background:rgba(2,6,23,.24); border-radius:14px; padding:10px 12px; color:var(--muted); font-size:12px; line-height:1.5;">
              ${c.text}
            </div>
          `).join('')}
        `
        : '';
    }

    const summaryZoneWrap = byId('summaryZoneWrap');
    if(summaryZoneWrap){
      summaryZoneWrap.innerHTML = `
        <div style="font-size:13px; font-weight:950;">สรุปรายโซน</div>
        ${summary.zoneSummary.map(z => `
          <div style="border:1px solid rgba(148,163,184,.16); background:rgba(2,6,23,.24); border-radius:14px; padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; gap:8px; align-items:center; flex-wrap:wrap;">
              <div style="font-size:13px; font-weight:950;">${z.label}</div>
              <div style="font-size:13px; font-weight:950; color:${z.stars >= 2 ? '#fbbf24' : '#94a3b8'};">
                ${starsText(z.stars)}
              </div>
            </div>

            <div style="margin-top:6px; color:var(--muted); font-size:12px; line-height:1.5;">
              ${z.line}
            </div>
            <div style="margin-top:6px; color:rgba(229,231,235,.92); font-size:12px; line-height:1.5; font-weight:900;">
              💡 ${z.tip}
            </div>

            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
              <span class="summaryQuestBadge ${z.clean ? 'ok' : ''}">สะอาด ${z.clean ? '✅' : '⬜'} (${z.cleanPct}%)</span>
              <span class="summaryQuestBadge ${z.direction ? 'ok' : ''}">ทิศทาง ${z.direction ? '✅' : '⬜'} (${z.dirRate}%)</span>
              <span class="summaryQuestBadge ${z.control ? 'ok' : ''}">คุมดี ${z.control ? '✅' : '⬜'} (พลาด ${z.localMiss})</span>
            </div>
          </div>
        `).join('')}

        <div style="border:1px dashed rgba(148,163,184,.18); background:rgba(2,6,23,.18); border-radius:14px; padding:10px 12px; color:var(--muted); font-size:12px; line-height:1.55;">
          ข้อสังเกต: โซนที่ได้ดาวน้อยมักต้องฝึกเรื่องความทั่วถึงของการถู ทิศทางการถู หรือการลดการกดพลาด
        </div>
      `;
    }

    const summaryTipWrap = byId('summaryTipWrap');
    if(summaryTipWrap){
      summaryTipWrap.innerHTML = `
        <div style="font-size:13px; font-weight:950;">นำไปใช้ตอนแปรงจริง</div>
        <div style="border:1px solid rgba(34,197,94,.18); background:rgba(34,197,94,.10); border-radius:14px; padding:10px 12px; color:var(--text); font-size:13px; line-height:1.55; font-weight:900;">
          ${summary.overallTip}
        </div>
        <div style="color:var(--muted); font-size:12px; line-height:1.5;">
          ลองทำช้า ๆ เบา ๆ และให้ทั่วทุกซี่ตอนแปรงฟันจริง
        </div>
      `;
    }

    if(S.mode === 'learn'){
      audio.playCue('summary-learn');
    } else if(S.bossCompleted){
      audio.playCue('summary-win');
    } else {
      audio.playCue('summary-open');
    }

    if(summaryOverlay) summaryOverlay.style.display = 'grid';
  }

  function restartGame(){
    emitHha('hha:event', eventPayload('brush_restart', {
      score: Math.round(S.score),
      timeLeft: Math.ceil(S.timeLeft)
    }));
    clearDraft();
    stopDemoTutorial();
    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    location.href = u.toString();
  }

  function bindButtons(){
    byId('btnUV')?.addEventListener('click', ()=>{
      if(byId('btnUV')?.classList.contains('disabled')) return;
      useUV();
    });

    byId('btnPolish')?.addEventListener('click', ()=>{
      if(byId('btnPolish')?.classList.contains('disabled')) return;
      usePolish();
    });

    byId('btnRestart')?.addEventListener('click', restartGame);

    byId('btnStartBoss')?.addEventListener('click', ()=>{
      if(!currentModeCfg().boss) return;
      startBossNow();
    });

    byId('btnFinish')?.addEventListener('click', ()=> finishGame(S.bossCompleted ? 'complete' : 'quit'));
    byId('btnCloseSummary')?.addEventListener('click', ()=> { if(summaryOverlay) summaryOverlay.style.display = 'none'; });
    byId('btnSummaryRestart')?.addEventListener('click', restartGame);

    byId('btnBackHub')?.addEventListener('click', ()=>{
      try{ window.HHA_BACKHUB?.goHub?.(); }
      catch{
        const hub = qs('hub','');
        if(hub) location.href = hub;
      }
    });

    byId('btnDockRestart')?.addEventListener('click', restartGame);
    byId('btnDockSummary')?.addEventListener('click', ()=> finishGame(S.bossCompleted ? 'complete' : 'quit'));
    byId('btnDockHub')?.addEventListener('click', ()=>{
      try{ window.HHA_BACKHUB?.goHub?.(); }
      catch{
        const hub = qs('hub','');
        if(hub) location.href = hub;
      }
    });

    byId('btnModeLearn')?.addEventListener('click', ()=> setMode('learn'));
    byId('btnModePractice')?.addEventListener('click', ()=> setMode('practice'));
    byId('btnModeChallenge')?.addEventListener('click', ()=> setMode('challenge'));

    byId('btnLearnWatch')?.addEventListener('click', ()=>{
      closeLearnOverlay();
      setCoachText('ดูนิ้วตัวอย่างก่อน แล้วค่อยลองถูตามนะ', 'mid');
      audio.playCue('learn-watch');
      stopDemoTutorial();
      setTimeout(()=> startDemoTutorial(), 120);
    });

    byId('btnLearnSkip')?.addEventListener('click', ()=>{
      closeLearnOverlay();
    });

    byId('btnLearnStart')?.addEventListener('click', ()=>{
      closeLearnOverlay();
      setNowDoText('เริ่มจากถูโซนที่มีกรอบสีฟ้า');
      audio.playCue('learn-start');
    });

    byId('btnShowLearnHelp')?.addEventListener('click', ()=>{
      if(S.mode === 'learn'){
        openLearnOverlay();
      } else {
        setCoachText('ดูกรอบสีฟ้าและลองถูตามทิศที่บอกนะ', 'mid');
        stopDemoTutorial();
        setTimeout(()=> startDemoTutorial(), 120);
      }
    });

    byId('btnToggleAudio')?.addEventListener('click', ()=>{
      const on = audio.toggleAudio();
      setAudioPill();

      const u = new URL(location.href);
      u.searchParams.set('audio', on ? '1' : '0');
      history.replaceState({}, '', u.toString());

      if(!on){
        setCoachText('ปิดเสียงแล้ว', 'mid');
      } else {
        audio.ensureAudio();
        audio.playCue('audio-on');
        setCoachText('เปิดเสียงแล้ว', 'good');
      }
    });
  }

  function tick(){
    if(S.finished) return;

    if(S.mode === 'learn' && learnOverlay && learnOverlay.style.display === 'grid'){
      refreshZoneUI();
      return;
    }

    S.timeLeft = Math.max(0, S.timeLeft - 0.1);

    if(!S.bossStarted){
      S.zoneState.forEach((z, idx)=>{
        if(idx !== S.activeZoneIdx){
          z.dirt = clamp(z.dirt + DIFF.dirtTick * 0.2, 0, 100);
        }
      });
    } else if (!S.bossCompleted){
      const active = S.zoneState[S.activeZoneIdx];
      if(active){
        active.dirt = clamp(active.dirt + .45, 0, 100);
        renderDirtForZone(S.activeZoneIdx);
      }
    }

    runBossPatternController();
    refreshZoneUI();

    if(Math.round(S.timeLeft) % 5 === 0) emitProgress();
    if(Math.floor(S.timeLeft * 10) % 20 === 0) saveDraft();

    if(S.mode !== 'learn' && S.timeLeft <= 0){
      finishGame(S.bossCompleted ? 'complete' : 'timeup');
    }
  }

  function boot(){
    document.documentElement.classList.toggle('view-cvr', CFG.view === 'cvr');
    document.body.classList.toggle('view-cvr', CFG.view === 'cvr');

    const modeCfg = currentModeCfg();
    if(S.mode === 'learn'){
      S.timeLeft = modeCfg.time;
    } else if(!Number.isFinite(S.timeLeft) || S.timeLeft <= 0){
      S.timeLeft = modeCfg.time;
    }

    setTopPills();
    setAudioPill();
    audio.ensureAudio();
    refreshModeButtons();

    buildZones();
    tryRestoreDraft();
    bindButtons();
    refreshZoneUI();
    emitStart();

    if(S.mode === 'learn'){
      setNowDoText('เริ่มจากดูกรอบสีฟ้าก่อน');
      const shouldShowLearn = qs('showLearn','1') !== '0';
      if(shouldShowLearn){
        openLearnOverlay();
      } else {
        setTimeout(()=> startDemoTutorial(), 700);
      }
    } else {
      setNowDoText('เริ่มจากถูโซนที่มีกรอบสีฟ้า');
      setTimeout(()=> startDemoTutorial(), 700);
    }

    if(arenaCore){
      arenaCore.addEventListener('pointermove', (ev)=>{
        updateBrushCursor(ev);
        if(!S.isBrushing || S.finished) return;

        const r = arenaCore.getBoundingClientRect();
        const x = ev.clientX - r.left;
        const y = ev.clientY - r.top;
        const dx = x - S.brushLastX;
        const dy = y - S.brushLastY;
        const dist = Math.hypot(dx, dy);

        S.lastBrushDx = dx;
        S.lastBrushDy = dy;

        if(dist >= 8){
          const rot = Math.atan2(dy || 0.001, dx || 0.001) * 180 / Math.PI;
          spawnTrail(x, y, rot);

          const activeIdx = S.activeZoneIdx;
          const insideActive = pointInZone(activeIdx, x, y);

          if(insideActive && !S.bossStarted){
            addBrushDragProgress(activeIdx, dist, x, y);
            renderDirtForZone(activeIdx);

            const zs = S.zoneState[activeIdx];
            if(zoneCleanPct(zs) >= currentModeCfg().cleanTarget && !zs.completed){
              zs.completed = true;
              const star = calcZoneStars(S.zoneState, S.zoneMastery, activeIdx, currentModeCfg().cleanTarget);
              spawnPop(x, y, `ครบโซน! ${starsText(star)}`);

              const coach = zoneCoachFeedback({
                zoneState: S.zoneState,
                zoneMastery: S.zoneMastery,
                idx: activeIdx,
                mode: S.mode,
                targetClean: currentModeCfg().cleanTarget
              });
              const tip = zoneRealLifeTip(activeIdx);
              setCoachText(`${coach.text} • ${tip}`, coach.tone);
              showCoachToast(star >= 3 ? 'เก่งมาก! 3 ดาว' : `ได้ ${star} ดาว`);
              audio.playCue(star >= 3 ? 'zone-perfect' : 'zone-clear');
              S.coachHistory.push({
                ts: nowISO(),
                zoneId: zs.id,
                zoneLabel: zs.label,
                star,
                text: `${coach.text} • ${tip}`,
                tone: coach.tone
              });
            }

            maybeAdvanceZone();
            maybeStartBoss();
          } else if(insideActive && S.phase === 'boss' && !S.bossCompleted){
            if(S.bossMode === 'laserLive'){
              punishLaser(x, y);
              resetBrushCombo();
            } else if(S.bossMode !== 'shockWait' && S.bossMode !== 'decoy'){
              const dirBoost = directionScore(activeIdx, dx, dy);
              const dmg = dist * 0.08 * dirBoost;
              S.bossHP = clamp(S.bossHP - dmg, 0, CFG.bossHP);
              S.score += Math.max(0, Math.round(dist * 0.16 * dirBoost));
              if(Math.random() < 0.22) spawnFoam(x, y);
              renderDirtForZone(activeIdx);
              if(S.bossHP <= 0) maybeAdvanceBossPhase(x, y);
            }
          } else {
            resetBrushCombo();
          }

          updateDirBadge(S.activeZoneIdx, dx, dy);

          S.brushLastX = x;
          S.brushLastY = y;
          S.brushLastT = performance.now();
          refreshZoneUI();
        }
      });

      arenaCore.addEventListener('pointerdown', (ev)=>{
        stopDemoTutorial();
        updateBrushCursor(ev);
        audio.ensureAudio();
        if(S.finished) return;

        const r = arenaCore.getBoundingClientRect();
        S.isBrushing = true;
        resetBrushCombo();
        S.brushLastX = ev.clientX - r.left;
        S.brushLastY = ev.clientY - r.top;
        S.brushLastT = performance.now();
        spawnTrail(S.brushLastX, S.brushLastY, 0);
      });

      const endBrush = ()=>{
        S.isBrushing = false;
        resetBrushCombo();
        if(brushCursor) brushCursor.style.opacity = '0';
        const dirBadge = byId('dirBadge');
        if(dirBadge){
          dirBadge.classList.remove('dirGood','dirWarn');
          const activeIdx = S.activeZoneIdx;
          const icon = ZONES[activeIdx]?.dir === 'horizontal' ? '↔' : '↕';
          dirBadge.textContent = `${icon} ${zoneDirectionText(activeIdx)}`;
        }
      };

      arenaCore.addEventListener('pointerup', endBrush);
      arenaCore.addEventListener('pointercancel', endBrush);
      arenaCore.addEventListener('pointerleave', endBrush);
    }

    setInterval(tick, 100);

    window.addEventListener('hha:before-exit', ()=>{
      if(!S.finished){
        try{
          window.HHA_BACKHUB?.setSummary?.({
            gameId: CFG.gameId,
            gameTitle: 'Brush VR',
            gameIcon: '🦷',
            zoneId: 'hygiene',
            pid: CFG.pid || '',
            run: CFG.run || '',
            diff: CFG.diff || '',
            time: String(CFG.time),
            seed: CFG.seed || '',
            studyId: CFG.studyId || '',
            endReason: 'quit',
            mode: S.mode,
            scoreFinal: Math.round(S.score),
            accuracyPct: S.totalActions > 0 ? Math.round((S.hits / S.totalActions) * 1000) / 10 : 0,
            miss: S.miss,
            timePlayedSec: Math.round((S.mode === 'learn' ? 0 : CFG.time - S.timeLeft)),
            cleanPct: totalCleanPct(),
            bossCompleted: S.bossCompleted,
            bossPhase: S.bossPhase,
            maxCombo: S.maxCombo,
            savedAt: nowISO(),
            href: location.href
          });
        }catch{}
      }
    });

    console.log('mouthWrap=', mouthWrap?.getBoundingClientRect());
  }

  boot();
})();