'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  // -----------------------------
  // Utils
  // -----------------------------
  const now = ()=> performance.now();
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, Number(v)));
  const rnd = ()=> Math.random();
  function firstNum(){
    for (let i=0;i<arguments.length;i++){
      const v = Number(arguments[i]);
      if (Number.isFinite(v)) return v;
    }
    return 0;
  }
  function qs(name, fallback=''){
    try{
      const u = new URL(location.href);
      return u.searchParams.get(name) ?? fallback;
    }catch(e){ return fallback; }
  }
  function escapeHtml(s){
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function emit(_eventName, payload){
    try{
      WIN.dispatchEvent(new CustomEvent(_eventName, { detail: payload }));
    }catch(e){}
    // console debug only
    if (STATE.debugEvents) console.log('[bath:event]', payload);
  }
  function tagEvent(type, data){
    emit('hha:event', { game:'bath', type, t: now(), ...(data||{}) });
  }

  // -----------------------------
  // Config / Phases
  // -----------------------------
  const CFG = {
    lockPx: 42,
    meterUp: 1,
    meterDown: 1,
    soapNeed: 10,
    hiddenNeed: 5,
    fakeFoam: 0.18,
    diff: qs('diff', 'normal'),
    totalTimeSec: Number(qs('time', 0)) || 0
  };

  const PHASES = [
    { id:'SOAP',  ms: 22000 },
    { id:'SCRUB', ms: 22000 },
    { id:'RINSE', ms: 18000 }
  ];

  // -----------------------------
  // UI refs
  // -----------------------------
  const UI = {
    app: DOC.getElementById('app'),
    hud: DOC.getElementById('hud'),
    phasePill: DOC.getElementById('phasePill'),
    timePill: DOC.getElementById('timePill'),
    cleanPill: DOC.getElementById('cleanPill'),
    comboPill: DOC.getElementById('comboPill'),
    missPill: DOC.getElementById('missPill'),
    meterPill: DOC.getElementById('meterPill'),
    questPill: DOC.getElementById('questPill'),
    progressPill: DOC.getElementById('progressPill'),
    coachText: DOC.getElementById('coachText'),

    gameWrap: DOC.getElementById('gameWrap'),
    gameStage: DOC.getElementById('gameStage'),
    targetLayer: DOC.getElementById('targetLayer'),
    scanLayer: DOC.getElementById('scanLayer'),
    fxLayer: DOC.getElementById('fxLayer'),

    btnStart: DOC.getElementById('btnStart'),
    btnPause: DOC.getElementById('btnPause'),
    btnResume: DOC.getElementById('btnResume'),
    btnReset: DOC.getElementById('btnReset'),
    btnBackHub: DOC.getElementById('btnBackHub'),

    endOverlay: DOC.getElementById('endOverlay'),
    endRank: DOC.getElementById('endRank'),
    endTitle: DOC.getElementById('endTitle'),
    endSummary: DOC.getElementById('endSummary'),
    endDetail: DOC.getElementById('endDetail'),
    btnReplay: DOC.getElementById('btnReplay'),
    btnEndBackHub: DOC.getElementById('btnEndBackHub')
  };

  // -----------------------------
  // Zones and positions (normalized)
  // -----------------------------
  const ZONE_POS = {
    head:{x:.50,y:.14}, neck:{x:.50,y:.24},
    armL:{x:.28,y:.34}, armR:{x:.72,y:.34},
    chest:{x:.50,y:.36}, back:{x:.50,y:.48},
    handL:{x:.22,y:.48}, handR:{x:.78,y:.48},
    legL:{x:.40,y:.68}, legR:{x:.60,y:.68},
    footL:{x:.40,y:.86}, footR:{x:.60,y:.86}
  };
  const ZONE_KEYS = Object.keys(ZONE_POS);

  // -----------------------------
  // State
  // -----------------------------
  const STATE = {
    ended:false,
    paused:false,
    raf:0,
    startedAt:0,
    phaseIdx:0,
    phaseStartedAt:0,
    _lastTickAt:0,
    nextSpawnAt:0,
    active:new Map(),
    seqId:1,

    hits:0,
    miss:0,
    combo:0,
    cleanScore:0,
    meter:0,
    meterPeak:0,

    soapNeed: CFG.soapNeed,
    soapHits:0,
    fakeFoamRate: CFG.fakeFoam,
    perfectStreak:0,
    feverUntil:0,
    feverActivations:0,

    sudd:null,
    suddDone:0,
    suddFail:0,

    soapBoss:false,
    soapBossUntil:0,
    soapBossHitsGold:0,
    soapBossHitsFake:0,

    hiddenNeed: CFG.hiddenNeed,
    hiddenDone:0,
    hiddenPlan:[],
    scrubScan:false,
    scrubScanUntil:0,
    scrubScanTargets:[],
    scrubScanFirstBonus:false,

    routeLastZone:null,
    routeChain:0,
    routeBest:0,
    routeBonusHits:0,

    rinseFinish:false,
    rinseFinishUntil:0,
    rinseFinishSeq:[],
    rinseFinishDone:false,

    questText:'',
    questDone:false,
    coachMsg:'',
    coachUntil:0,
    _coachTimer:0,

    zonePos:null,
    zoneKeys:[...ZONE_KEYS],

    debugTiming:true,
    debugEvents:false,
    _timingDebug:null,
  };

  // -----------------------------
  // Query / hub wiring
  // -----------------------------
  (function initHubLink(){
    try{
      const hub = qs('hub', '');
      if (hub) {
        UI.btnBackHub.href = hub;
        UI.btnEndBackHub.addEventListener('click', ()=> location.href = hub);
      } else {
        UI.btnBackHub.href = '#';
        UI.btnEndBackHub.addEventListener('click', ()=> history.length > 1 ? history.back() : void 0);
      }
    }catch(e){}
  })();

  // -----------------------------
  // Zone DOM positions from labels
  // -----------------------------
  function refreshZoneScreenPos(){
    const stageRect = UI.gameStage.getBoundingClientRect();
    const map = {};
    DOC.querySelectorAll('.zone[data-zone]').forEach(el=>{
      const k = el.getAttribute('data-zone');
      const r = el.getBoundingClientRect();
      map[k] = {
        x: (r.left + r.width/2) - stageRect.left,
        y: (r.top + r.height/2) - stageRect.top
      };
    });
    STATE.zonePos = map;
  }

  function zoneDistanceNorm(a, b){
    if (!a || !b) return 1;
    if (STATE.zonePos && STATE.zonePos[a] && STATE.zonePos[b]) {
      const p1 = STATE.zonePos[a], p2 = STATE.zonePos[b];
      const dx = (p1.x||0) - (p2.x||0);
      const dy = (p1.y||0) - (p2.y||0);
      const d = Math.sqrt(dx*dx + dy*dy);
      return clamp(d / 260, 0, 1.5);
    }
    if (a === b) return 0.1;
    return 0.85;
  }
  function routeBand(d){
    if (d <= 0.38) return 'tight';
    if (d <= 0.65) return 'good';
    return 'far';
  }

  // -----------------------------
  // Basic helpers
  // -----------------------------
  function setPill(el, txt){
    if (el) el.textContent = String(txt || '');
  }

  function coach(msg, ms){
    STATE.coachMsg = String(msg || '');
    STATE.coachUntil = now() + (Number(ms) > 0 ? Number(ms) : 700);

    if (STATE._coachTimer) {
      try { clearTimeout(STATE._coachTimer); } catch(e){}
    }

    const dur = Math.max(250, Number(ms) || 700);
    STATE._coachTimer = setTimeout(()=>{
      if (now() >= (STATE.coachUntil || 0)) {
        STATE.coachMsg = '';
        updateHUD();
      }
    }, dur + 20);

    updateHUD();
  }

  function addMeter(delta, reason){
    const upMul = (typeof CFG.meterUp === 'number') ? CFG.meterUp : 1;
    const dnMul = (typeof CFG.meterDown === 'number') ? CFG.meterDown : 1;

    let d = Number(delta || 0);
    if (d > 0) d *= upMul;
    else if (d < 0) d *= dnMul;

    STATE.meter = clamp((STATE.meter || 0) + d, 0, 100);
    STATE.meterPeak = Math.max(STATE.meterPeak || 0, STATE.meter || 0);

    emit('hha:event', {
      game:'bath', type:'meter_change', delta:d, reason:String(reason||''), meter:STATE.meter, t:now()
    });
  }

  // -----------------------------
  // FEVER / CHOICE / BOSS helpers
  // -----------------------------
  function isFeverOn(){
    return !!STATE.feverUntil && now() <= STATE.feverUntil;
  }

  function triggerSoapFever(){
    const t = now();
    const dur = 3500;
    STATE.feverUntil = t + dur;
    STATE.feverActivations = (STATE.feverActivations || 0) + 1;
    emit('hha:event', { game:'bath', type:'soap_fever_start', until: STATE.feverUntil, t });
    coach('🫧 Bubble FEVER! เก็บฟองจริงให้ไว!', 900);
  }

  function suddActive(){
    return !!(STATE.sudd && !STATE.sudd.resolved && now() <= (STATE.sudd.until || 0));
  }
  function suddText(){
    const c = STATE.sudd;
    if (!c || c.resolved) return '';
    if (c.kind === 'safe2') return `เก็บฟองจริง 2 อันติด [${c.progress||0}/2]`;
    if (c.kind === 'nofake') return `อย่าโดนฟองปลอมจนหมดเวลา`;
    if (c.kind === 'perfect1') return `ทำ PERFECT กับฟองจริง 1 ครั้ง`;
    return 'โจทย์พิเศษ';
  }
  function startSuddenChoice(){
    const t = now();
    const kinds = ['safe2', 'nofake', 'perfect1'];
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    STATE.sudd = { kind, start:t, until:t+2800, progress:0, failed:false, resolved:false };
    emit('hha:event', { game:'bath', type:'sudd_start', kind, t, until:STATE.sudd.until });
    tagEvent('analyze_sudden_choice_start', { kind });
    coach(`⚡ CHOICE: ${suddText()}`, 950);
  }
  function resolveSuddenChoice(success, reason){
    const c = STATE.sudd;
    if (!c || c.resolved) return;
    c.resolved = true;
    c.result = !!success;
    c.reason = String(reason||'');

    if (success) {
      STATE.suddDone = (STATE.suddDone || 0) + 1;
      STATE.combo = (STATE.combo || 0) + 1;
      addMeter(-2.2, 'sudd_success');
      coach('✅ CHOICE ผ่าน!', 700);
    } else {
      STATE.suddFail = (STATE.suddFail || 0) + 1;
      addMeter(2.0, 'sudd_fail');
      coach('❌ CHOICE พลาด!', 700);
    }

    emit('hha:event', { game:'bath', type:'sudd_end', kind:c.kind, success:!!success, reason:c.reason, progress:c.progress||0, t:now() });
    tagEvent('evaluate_sudden_choice_result', { kind:c.kind, success:!!success, reason:c.reason, progress:c.progress||0 });
  }

  function startSoapBoss(){
    const t = now();
    if (STATE.soapBoss && t <= (STATE.soapBossUntil || 0)) return;
    STATE.soapBoss = true;
    STATE.soapBossUntil = t + 4500;
    STATE.soapBossHitsGold = 0;
    STATE.soapBossHitsFake = 0;
    emit('hha:event', { game:'bath', type:'soap_boss_start', t, until:STATE.soapBossUntil });
    coach('👑 SOAP BOSS! เก็บ ★ และหลบ 🧲', 1000);

    if (STATE.sudd && !STATE.sudd.resolved) resolveSuddenChoice(false, 'interrupted_by_boss');
  }

  // -----------------------------
  // Scan / Rinse Finish helpers
  // -----------------------------
  function clearScanMarkers(){
    UI.scanLayer.innerHTML = '';
    DOC.querySelectorAll('.scan-marker').forEach(el => el.remove());
  }

  function showScanMarkers(zoneKeys){
    clearScanMarkers();
    const rect = UI.gameStage.getBoundingClientRect();
    for (const k of zoneKeys || []){
      const p = STATE.zonePos?.[k];
      if (!p) continue;
      const m = DOC.createElement('div');
      m.className = 'scan-marker';
      m.style.left = `${Math.round(p.x)}px`;
      m.style.top = `${Math.round(p.y)}px`;
      UI.scanLayer.appendChild(m);
    }
  }

  function startScrubScan(){
    const t = now();
    let pool = [];
    if (Array.isArray(STATE.hiddenPlan) && STATE.hiddenPlan.length) pool = [...new Set(STATE.hiddenPlan)];
    else pool = [...STATE.zoneKeys];

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const n = Math.min(pool.length, (rnd() < 0.5 ? 2 : 3));
    STATE.scrubScanTargets = pool.slice(0, n);
    STATE.scrubScan = true;
    STATE.scrubScanUntil = t + 2000;
    STATE.scrubScanFirstBonus = false;

    emit('hha:event', { game:'bath', type:'scrub_scan_start', targets:STATE.scrubScanTargets.slice(), t, until:STATE.scrubScanUntil });
    coach('🔎 SCAN! จำจุดอับก่อนเริ่มขัด', 900);
    showScanMarkers(STATE.scrubScanTargets);
  }

  function rinseFinishActive(){
    return !!STATE.rinseFinish && now() <= (STATE.rinseFinishUntil || 0);
  }

  function startRinseFinish(){
    const t = now();
    if (STATE.rinseFinish || STATE.rinseFinishDone) return;
    STATE.rinseFinish = true;
    STATE.rinseFinishUntil = t + 4000;
    STATE.rinseFinishSeq = [];
    STATE.rinseFinishDone = false;
    emit('hha:event', { game:'bath', type:'rinse_finish_start', t, until:STATE.rinseFinishUntil });
    coach('✨ CLEAN FINISH! สลับ R / D ให้ถูกจังหวะ', 1000);
  }

  function pushRinseFinishStep(kind){
    if (!rinseFinishActive()) return;
    if (!(kind === 'residue' || kind === 'dry')) return;

    const token = (kind === 'residue') ? 'R' : 'D';
    STATE.rinseFinishSeq = STATE.rinseFinishSeq || [];
    if (STATE.rinseFinishSeq.length < 6) STATE.rinseFinishSeq.push(token);
    else { STATE.rinseFinishSeq.shift(); STATE.rinseFinishSeq.push(token); }

    const seq = STATE.rinseFinishSeq;
    if (seq.length >= 3) {
      const a = seq[seq.length - 3], b = seq[seq.length - 2], c = seq[seq.length - 1];
      const okAlt = (a !== b) && (b !== c) && (a === c);
      if (okAlt) {
        STATE.rinseFinishDone = true;
        STATE.rinseFinish = false;
        STATE.rinseFinishUntil = 0;
        STATE.combo = (STATE.combo || 0) + 2;
        addMeter(-3.0, 'rinse_finish_done');
        emit('hha:event', { game:'bath', type:'rinse_finish_success', seq:seq.slice(), t:now() });
        tagEvent('create_rinse_finish_pattern', { seq:seq.slice() });
        coach('✨ CLEAN FINISH สำเร็จ!', 900);
      }
    }
  }

  function resolveRinseFinishTimeout(){
    if (!STATE.rinseFinish) return;
    if (now() <= (STATE.rinseFinishUntil || 0)) return;
    STATE.rinseFinish = false;
    STATE.rinseFinishUntil = 0;
    if (!STATE.rinseFinishDone) {
      addMeter(1.6, 'rinse_finish_timeout');
      emit('hha:event', { game:'bath', type:'rinse_finish_timeout', seq:(STATE.rinseFinishSeq||[]).slice(), t:now() });
      coach('หมดเวลา FINISH! ลองสลับ R/D ให้เร็วขึ้น', 800);
    }
  }

  // -----------------------------
  // Target creation / rendering
  // -----------------------------
  function createTarget(kind, zoneKey, ttlMs, hitsToClear=1){
    const stageRect = UI.gameStage.getBoundingClientRect();
    const zp = STATE.zonePos?.[zoneKey] || { x: stageRect.width*0.5, y: stageRect.height*0.5 };

    const jitter = kind === 'hidden' ? 8 : 14;
    const x = clamp(zp.x + (rnd()*2-1)*jitter, 20, stageRect.width - 20);
    const y = clamp(zp.y + (rnd()*2-1)*jitter, 20, stageRect.height - 20);

    const id = STATE.seqId++;
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = `target ${kind}`;
    el.dataset.id = String(id);
    el.dataset.kind = kind;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.innerHTML = `<span class="label">${labelForKind(kind)}</span><span class="life"><i></i></span>`;

    const hitR = 22;

    const obj = {
      id, kind, zoneKey,
      x, y, sx:x, sy:y, cx:x, cy:y, hitCx:x, hitCy:y, hitR,
      radius: hitR,
      el,
      spawnAt: now(),
      ttlMs,
      hits:0,
      hitsToClear,
      dead:false
    };

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      handleShootAt(ev.clientX, ev.clientY);
    });

    UI.targetLayer.appendChild(el);
    STATE.active.set(id, obj);
    return obj;
  }

  function labelForKind(kind){
    switch(kind){
      case 'foam': return 'SOAP';
      case 'fakefoam': return 'FAKE';
      case 'goldfoam': return '★';
      case 'magnetfake': return '🧲';
      case 'dirt': return 'DIRT';
      case 'hidden': return 'H';
      case 'oil': return 'OIL';
      case 'residue': return 'R';
      case 'dry': return 'D';
      default: return 'HIT';
    }
  }

  function removeTargetVisual(obj){
    try { obj?.el?.remove(); } catch(e){}
  }
  function removeTarget(obj){
    removeTargetVisual(obj);
  }
  function clearAllTargetsForPhaseTransition(){
    STATE.active.forEach(obj=> removeTargetVisual(obj));
    STATE.active.clear();
  }

  function updateAnimations(_dt, t){
    STATE.active.forEach(obj=>{
      if (!obj || obj.dead || !obj.el) return;
      const age = t - (obj.spawnAt || t);
      const ttl = Math.max(1, obj.ttlMs || 1);
      const leftRatio = clamp(1 - age/ttl, 0, 1);

      const life = obj.el.querySelector('.life > i');
      if (life) life.style.transform = `scaleX(${leftRatio})`;

      // subtle bob
      const bob = Math.sin((age/140) + (obj.id % 7)) * 1.8;
      obj.el.style.transform = `translate(-50%, -50%) translateY(${bob.toFixed(1)}px)`;
    });
  }
  function renderTargets(){ /* DOM already updates inline */ }

  function pickHitTarget(clientX, clientY){
    const stageRect = UI.gameStage.getBoundingClientRect();
    const x = clientX - stageRect.left;
    const y = clientY - stageRect.top;

    let best = null;
    let bestD2 = Infinity;
    STATE.active.forEach((t)=>{
      if (!t || t.dead) return;
      const dx = x - (t.sx ?? t.x);
      const dy = y - (t.sy ?? t.y);
      const d2 = dx*dx + dy*dy;
      const lockPx = CFG.lockPx;
      if (d2 <= lockPx*lockPx && d2 < bestD2) {
        best = t;
        bestD2 = d2;
      }
    });

    if (best) {
      best.lastHitX = x;
      best.lastHitY = y;
    }
    return best;
  }

  // -----------------------------
  // Timing
  // -----------------------------
  function hitTiming(obj, hitX, hitY){
    if (!obj) return 'ok';

    const t = now();

    const born = Number(obj.spawnAt || obj.createdAt || (t - 1));
    const ttl  = Math.max(1, Number(obj.ttlMs || 1000));
    const age  = clamp(t - born, 0, ttl);
    const lifeRatio = clamp(age / ttl, 0, 1);

    let timeScore = 0.6;
    if (lifeRatio >= 0.18 && lifeRatio <= 0.62) timeScore = 1.0;
    else if (lifeRatio > 0.62 && lifeRatio <= 0.88) timeScore = 0.45;
    else if (lifeRatio < 0.18) timeScore = 0.55;
    else timeScore = 0.15;

    const tx = firstNum(obj.hitCx, obj.cx, obj.sx, obj.x);
    const ty = firstNum(obj.hitCy, obj.cy, obj.sy, obj.y);

    const hx = firstNum(hitX, obj.lastHitX, tx);
    const hy = firstNum(hitY, obj.lastHitY, ty);

    const r = Math.max(8, firstNum(obj.hitR, obj.radius, obj.r, 24));
    const dx = (Number(hx) - Number(tx));
    const dy = (Number(hy) - Number(ty));
    const dist = Math.sqrt(dx*dx + dy*dy);

    const dNorm = clamp(dist / r, 0, 3);

    let aimScore = 0.6;
    if (dNorm <= 0.38) aimScore = 1.0;
    else if (dNorm <= 0.72) aimScore = 0.7;
    else if (dNorm <= 1.0) aimScore = 0.42;
    else aimScore = 0.15;

    const phaseId = PHASES?.[STATE.phaseIdx]?.id || '';
    const kind = String(obj.kind || '');

    let mod = 0;
    if (phaseId === 'SOAP' && isFeverOn()) mod -= 0.03;
    if (phaseId === 'SOAP' && STATE.soapBoss) mod -= 0.04;
    if (kind === 'goldfoam') mod -= 0.03;

    const inFinish = (phaseId === 'RINSE' && rinseFinishActive());
    if (inFinish && (kind === 'residue' || kind === 'dry')) {
      timeScore = Math.min(1, timeScore + 0.05);
    }

    let finalScore = (timeScore * 0.58) + (aimScore * 0.42) + mod;
    if (finalScore < 0.5 && timeScore >= 0.95 && aimScore >= 0.4) finalScore = 0.52;

    let result = 'ok';
    if (finalScore >= 0.84) result = 'perfect';
    else if (finalScore < 0.48 || lifeRatio > 0.90) result = 'late';
    else result = 'ok';

    if (STATE.debugTiming) {
      STATE._timingDebug = {
        kind, phaseId,
        lifeRatio:+lifeRatio.toFixed(3),
        dNorm:+dNorm.toFixed(3),
        timeScore:+timeScore.toFixed(3),
        aimScore:+aimScore.toFixed(3),
        finalScore:+finalScore.toFixed(3),
        result
      };
    }
    return result;
  }

  // -----------------------------
  // Award logic
  // -----------------------------
  function awardByKind(kind, zoneKey){
    const phaseId = PHASES[STATE.phaseIdx]?.id || '';
    const inFever = isFeverOn();

    // base stats
    STATE.hits = (STATE.hits || 0) + 1;

    switch (kind) {
      case 'foam': {
        STATE.soapHits = (STATE.soapHits || 0) + 1;
        STATE.cleanScore = clamp((STATE.cleanScore || 0) + (inFever ? 3 : 2), 0, 100);
        addMeter(inFever ? -2.2 : -1.4, 'foam_hit');
        break;
      }
      case 'goldfoam': {
        STATE.soapHits = (STATE.soapHits || 0) + 1;
        STATE.cleanScore = clamp((STATE.cleanScore || 0) + 4, 0, 100);
        addMeter(-2.4, 'goldfoam_hit');
        if (STATE.soapBoss) STATE.soapBossHitsGold = (STATE.soapBossHitsGold || 0) + 1;
        break;
      }
      case 'fakefoam': {
        STATE.combo = 0;
        STATE.cleanScore = clamp((STATE.cleanScore || 0) - 1, 0, 100);
        addMeter(3.0, 'fakefoam_hit');
        STATE.miss = (STATE.miss || 0) + 1;
        if (STATE.sudd && !STATE.sudd.resolved) resolveSuddenChoice(false, 'touched_fake');
        break;
      }
      case 'magnetfake': {
        STATE.combo = 0;
        addMeter(4.2, 'magnetfake_hit');
        STATE.miss = (STATE.miss || 0) + 1;
        if (STATE.soapBoss) STATE.soapBossHitsFake = (STATE.soapBossHitsFake || 0) + 1;
        if (STATE.sudd && !STATE.sudd.resolved) resolveSuddenChoice(false, 'touched_fake');
        break;
      }
      case 'dirt': {
        STATE.cleanScore = clamp((STATE.cleanScore || 0) + 1.6, 0, 100);
        addMeter(-0.8, 'dirt_hit');
        break;
      }
      case 'hidden': {
        STATE.hiddenDone = (STATE.hiddenDone || 0) + 1;
        STATE.cleanScore = clamp((STATE.cleanScore || 0) + 3.2, 0, 100);
        addMeter(-1.2, 'hidden_hit');

        // route logic
        if (zoneKey) {
          if (STATE.routeLastZone) {
            const d = zoneDistanceNorm(STATE.routeLastZone, zoneKey);
            const band = routeBand(d);
            if (band === 'tight' || band === 'good') {
              STATE.routeChain = (STATE.routeChain || 0) + 1;
              STATE.routeBest = Math.max(STATE.routeBest || 0, STATE.routeChain);
              if (STATE.routeChain >= 2) {
                STATE.routeBonusHits = (STATE.routeBonusHits || 0) + 1;
                addMeter(-0.6, 'route_bonus');
              }
            } else {
              STATE.routeChain = 1;
            }
          } else {
            STATE.routeChain = 1;
          }
          STATE.routeLastZone = zoneKey;
        }

        // scrub scan first bonus
        if (phaseId === 'SCRUB' && !STATE.scrubScanFirstBonus && Array.isArray(STATE.scrubScanTargets) && STATE.scrubScanTargets.includes(zoneKey)) {
          STATE.scrubScanFirstBonus = true;
          addMeter(-2.0, 'scan_follow_bonus');
          STATE.combo = (STATE.combo || 0) + 1;
          coach('🧠 ตาม SCAN ได้เป๊ะ! โบนัส', 800);
          tagEvent('create_scan_follow_bonus', { zoneKey });
        }

        break;
      }
      case 'oil': {
        STATE.cleanScore = clamp((STATE.cleanScore || 0) + 1.8, 0, 100);
        addMeter(-0.9, 'oil_hit');
        if (zoneKey) {
          if (STATE.routeLastZone && routeBand(zoneDistanceNorm(STATE.routeLastZone, zoneKey)) !== 'far') {
            STATE.routeChain = (STATE.routeChain || 0) + 1;
            STATE.routeBest = Math.max(STATE.routeBest || 0, STATE.routeChain);
          } else {
            STATE.routeChain = 1;
          }
          STATE.routeLastZone = zoneKey;
        }
        break;
      }
      case 'residue': {
        STATE.cleanScore = clamp((STATE.cleanScore || 0) + 1.5, 0, 100);
        addMeter(-0.7, 'residue_hit');
        pushRinseFinishStep('residue');
        break;
      }
      case 'dry': {
        if (zoneKey === 'risk') {
          addMeter(-1.0, 'dry_risk_fix');
        } else {
          STATE.cleanScore = clamp((STATE.cleanScore || 0) + 1.0, 0, 100);
          addMeter(-0.5, 'dry_hit');
        }
        pushRinseFinishStep('dry');
        break;
      }
      default: {
        STATE.cleanScore = clamp((STATE.cleanScore || 0) + 1, 0, 100);
        addMeter(-0.3, 'generic_hit');
        break;
      }
    }

    // phase quest complete hints
    if (phaseId === 'SOAP' && (STATE.soapHits || 0) >= (STATE.soapNeed || 0)) {
      STATE.questDone = true;
    }
    if (phaseId === 'SCRUB' && (STATE.hiddenDone || 0) >= (STATE.hiddenNeed || 0)) {
      STATE.questDone = true;
    }
  }

  // -----------------------------
  // FX Burst
  // -----------------------------
  function fxBurst(kind, x, y){
    const host = UI.fxLayer || UI.app || DOC.body;
    const t = now();

    const ring = DOC.createElement('div');
    ring.className = 'fx-hit-ring';
    const pop = DOC.createElement('div');
    pop.className = 'fx-hit-pop';
    const txt = DOC.createElement('div');
    txt.className = 'fx-score-pop';

    let label = '+';
    let extraClass = '';

    switch (String(kind || '')) {
      case 'foam': label = '+SOAP'; extraClass = 'is-foam'; break;
      case 'fakefoam': label = 'FAKE!'; extraClass = 'is-fake'; break;
      case 'goldfoam': label = '★ GOLD'; extraClass = 'is-gold'; break;
      case 'magnetfake': label = '🧲 TRAP'; extraClass = 'is-trap'; break;
      case 'hidden': label = 'HIDDEN!'; extraClass = 'is-hidden'; break;
      case 'oil': label = '+SCRUB'; extraClass = 'is-oil'; break;
      case 'dirt': label = '+CLEAN'; extraClass = 'is-dirt'; break;
      case 'residue': label = 'R'; extraClass = 'is-rinse'; break;
      case 'dry': label = 'D'; extraClass = 'is-dry'; break;
      default: label = 'HIT'; extraClass = 'is-generic'; break;
    }

    txt.textContent = label;
    txt.classList.add(extraClass);

    [ring, pop, txt].forEach(el=>{
      el.style.position = 'absolute';
      el.style.left = `${Math.round(x)}px`;
      el.style.top  = `${Math.round(y)}px`;
      el.style.pointerEvents = 'none';
      el.style.zIndex = '9999';
    });

    const driftX = (rnd() * 20 - 10);
    const driftY = -(18 + rnd() * 14);
    txt.style.setProperty('--dx', `${driftX.toFixed(1)}px`);
    txt.style.setProperty('--dy', `${driftY.toFixed(1)}px`);

    const timing = STATE._timingDebug?.result || '';
    if (timing) txt.classList.add(`timing-${timing}`);

    host.appendChild(ring);
    host.appendChild(pop);
    host.appendChild(txt);

    if (kind === 'goldfoam' || kind === 'hidden') {
      for (let i = 0; i < 4; i++) {
        const p = DOC.createElement('div');
        p.className = `fx-spark ${kind === 'goldfoam' ? 'is-gold' : 'is-hidden'}`;
        p.style.position = 'absolute';
        p.style.left = `${Math.round(x)}px`;
        p.style.top  = `${Math.round(y)}px`;
        p.style.pointerEvents = 'none';
        p.style.zIndex = '9998';

        const ang = (Math.PI * 2 * i) / 4 + rnd() * 0.45;
        const dist = 10 + rnd() * 16;
        p.style.setProperty('--sx', `${Math.cos(ang) * dist}px`);
        p.style.setProperty('--sy', `${Math.sin(ang) * dist}px`);
        host.appendChild(p);
        setTimeout(()=> p.remove(), 420);
      }
    }

    setTimeout(()=> { try{ ring.remove(); }catch(e){} }, 380);
    setTimeout(()=> { try{ pop.remove(); }catch(e){} }, 300);
    setTimeout(()=> { try{ txt.remove(); }catch(e){} }, 650);

    if (kind === 'goldfoam') {
      DOC.body.classList.add('fx-gold-hit');
      setTimeout(()=> DOC.body.classList.remove('fx-gold-hit'), 150);
    } else if (kind === 'fakefoam' || kind === 'magnetfake') {
      DOC.body.classList.add('fx-bad-hit');
      setTimeout(()=> DOC.body.classList.remove('fx-bad-hit'), 140);
    }

    emit('hha:event', { game:'bath', type:'fx_burst', kind:String(kind||''), x:Math.round(x), y:Math.round(y), t });
  }

  // -----------------------------
  // Spawn logic
  // -----------------------------
  function randomZone(exclude){
    const pool = STATE.zoneKeys.filter(z => z !== exclude);
    return pool[Math.floor(rnd() * pool.length)] || STATE.zoneKeys[0];
  }

  function pickHiddenPlan(){
    const pool = [...STATE.zoneKeys].filter(z => !['head','chest'].includes(z));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    STATE.hiddenPlan = pool.slice(0, STATE.hiddenNeed + 2);
  }

  function spawnForPhase(phase){
    const t = now();
    if (t < (STATE.nextSpawnAt || 0)) return;

    const pid = phase.id || '';
    let gap = 700;

    if (pid === 'SOAP') {
      gap = STATE.soapBoss ? 280 : (isFeverOn() ? 360 : 520);
      if (STATE.active.size > (STATE.soapBoss ? 8 : 6)) return;

      if (STATE.soapBoss) {
        const kind = rnd() < 0.62 ? 'goldfoam' : 'magnetfake';
        createTarget(kind, randomZone(), 900);
      } else {
        if (suddActive() && STATE.sudd.kind === 'safe2') {
          // bias real foam for achievable challenge
          createTarget(rnd() < 0.72 ? 'foam' : 'fakefoam', randomZone(), 1200);
        } else if (suddActive() && STATE.sudd.kind === 'nofake') {
          createTarget(rnd() < 0.18 ? 'fakefoam' : 'foam', randomZone(), 1200);
        } else if (suddActive() && STATE.sudd.kind === 'perfect1') {
          createTarget(rnd() < 0.78 ? 'foam' : 'fakefoam', randomZone(), 1050);
        } else {
          const pFake = STATE.fakeFoamRate;
          const pGold = isFeverOn() ? 0.12 : 0.05;
          const r = rnd();
          const kind = (r < pGold) ? 'goldfoam' : (r < pGold + pFake ? 'fakefoam' : 'foam');
          createTarget(kind, randomZone(), isFeverOn() ? 950 : 1250);
        }
      }
    }

    else if (pid === 'SCRUB') {
      gap = 560;
      if (STATE.active.size > 6) return;

      // hidden focus until quest done; add dirt/oil for route pressure
      if ((STATE.hiddenDone || 0) < (STATE.hiddenNeed || 0) && rnd() < 0.55) {
        const z = STATE.hiddenPlan[(STATE.hiddenDone + Math.floor(rnd()*2)) % STATE.hiddenPlan.length] || randomZone();
        createTarget('hidden', z, 1300);
      } else {
        const r = rnd();
        if (r < 0.45) createTarget('oil', randomZone(), 1400);
        else if (r < 0.85) createTarget('dirt', randomZone(), 1350);
        else createTarget('hidden', randomZone(), 1200);
      }
    }

    else if (pid === 'RINSE') {
      gap = 460;
      if (STATE.active.size > 7) return;

      const inFinish = rinseFinishActive();
      if (inFinish) {
        // encourage alternating pattern
        const last = (STATE.rinseFinishSeq || []).slice(-1)[0];
        const nextKind = (last === 'R') ? 'dry' : (last === 'D') ? 'residue' : (rnd()<0.5?'residue':'dry');
        createTarget(nextKind, rnd()<0.18 ? 'risk' : randomZone(), 1000);
      } else {
        const r = rnd();
        if (r < 0.45) createTarget('residue', randomZone(), 1300);
        else if (r < 0.80) createTarget('dry', rnd()<0.15 ? 'risk' : randomZone(), 1350);
        else createTarget('dirt', randomZone(), 1200);
      }
    }

    STATE.nextSpawnAt = t + gap;
  }

  // -----------------------------
  // Expire logic
  // -----------------------------
  function expireTargets(t){
    const nowT = (typeof t === 'number' && Number.isFinite(t)) ? t : now();
    if (!STATE.active) return;

    const toRemove = [];

    STATE.active.forEach((obj, key)=>{
      if (!obj || obj.dead) return;

      const born = Number(obj.spawnAt || obj.createdAt || 0);
      const ttl  = Number(obj.ttlMs || 0);
      if (!ttl) return;

      const age = nowT - born;
      if (age < ttl) return;

      obj.dead = true;
      obj.expiredAt = nowT;
      toRemove.push({ obj, key });

      const phaseId = PHASES[STATE.phaseIdx]?.id || '';

      emit('hha:event', { game:'bath', type:'target_expire', kind:obj.kind, zoneKey:obj.zoneKey||null, phase:phaseId, t:nowT });

      const resetCombo = ()=> { STATE.combo = 0; };
      const incMiss = (reason)=>{
        STATE.miss = (STATE.miss || 0) + 1;
        tagEvent('miss_target_expire', { reason, kind:obj.kind, zoneKey:obj.zoneKey||null, phase:phaseId });
      };

      switch (obj.kind) {
        case 'foam':
          resetCombo(); addMeter(1.0, 'miss_foam'); incMiss('foam_expire'); break;
        case 'fakefoam':
          break;
        case 'goldfoam':
          resetCombo(); addMeter(2.2, 'miss_goldfoam'); incMiss('goldfoam_expire');
          if (STATE.soapBoss) coach('★ หลุดแล้ว! รีบหาเป้าทองตัวต่อไป', 700);
          break;
        case 'magnetfake':
          break;
        case 'dirt':
          resetCombo(); addMeter(0.8, 'miss_dirt'); incMiss('dirt_expire'); break;
        case 'hidden':
          resetCombo(); addMeter(1.8, 'miss_hidden'); incMiss('hidden_expire');
          if (phaseId === 'SCRUB') {
            STATE.routeChain = 0; STATE.routeLastZone = null;
            emit('hha:event', { game:'bath', type:'route_break', cause:'hidden_expire', zoneKey:obj.zoneKey||null, t:nowT });
          }
          coach('จุดอับหายไปแล้ว! ลองเก็บจุดใกล้ ๆ ต่อเนื่อง', 700);
          break;
        case 'oil':
          resetCombo(); addMeter(1.2, 'miss_oil'); incMiss('oil_expire');
          if (phaseId === 'SCRUB') { STATE.routeChain = 0; STATE.routeLastZone = null; }
          break;
        case 'residue':
          resetCombo(); addMeter(1.2, 'miss_residue'); incMiss('residue_expire');
          if (phaseId === 'RINSE' && rinseFinishActive()) coach('✨ FINISH หลุดจังหวะ! ลองสลับ R/D ให้ไวขึ้น', 700);
          break;
        case 'dry':
          if (obj.zoneKey === 'risk') {
            resetCombo(); addMeter(6, 'miss_dry_risk');
            coach('พลาดจุดแห้งเสี่ยง! ครั้งหน้ารีบเก็บก่อนนะ', 800);
          } else {
            resetCombo(); addMeter(1.0, 'miss_dry'); incMiss('dry_expire');
          }
          break;
        default:
          resetCombo(); addMeter(1.0, 'miss_generic'); incMiss('generic_expire'); break;
      }
    });

    for (const it of toRemove) {
      const { obj, key } = it;
      try { STATE.active.delete(key); } catch(e){}
      removeTarget(obj);
    }
  }

  // -----------------------------
  // Hit handling
  // -----------------------------
  function handleShootAt(clientX, clientY){
    if (STATE.ended || STATE.paused) return false;

    const stageRect = UI.gameStage.getBoundingClientRect();
    const localX = clientX - stageRect.left;
    const localY = clientY - stageRect.top;

    let obj = pickHitTarget(clientX, clientY);

    if (!obj) {
      STATE.combo = 0;
      addMeter(0.6, 'shoot_miss');
      emit('hha:event', { game:'bath', type:'shoot_miss', x:Math.round(localX), y:Math.round(localY), t:now() });
      updateHUD();
      return false;
    }

    obj.hits = (obj.hits || 0) + 1;
    const need = Math.max(1, obj.hitsToClear || 1);
    const cleared = obj.hits >= need;

    emit('hha:event', { game:'bath', type:'shoot_hit', kind:obj.kind, zoneKey:obj.zoneKey||null, x:Math.round(localX), y:Math.round(localY), t:now() });

    if (!cleared) {
      updateHUD();
      return true;
    }

    obj.dead = true;
    obj.clearedAt = now();

    STATE.active.delete(obj.id);
    removeTarget(obj);

    awardByKind(obj.kind, obj.zoneKey);

    const timing = hitTiming(obj, localX, localY);

    if (timing === 'perfect') {
      STATE.combo = (STATE.combo || 0) + 1;
      addMeter(-1.2, 'perfect');
      tagEvent('apply_timing_perfect', { kind:obj.kind, zoneKey:obj.zoneKey||null });
    } else if (timing === 'late') {
      addMeter(0.8, 'late');
      tagEvent('apply_timing_late', { kind:obj.kind, zoneKey:obj.zoneKey||null });
    }

    if ((PHASES[STATE.phaseIdx]?.id) === 'RINSE' && rinseFinishActive()) {
      if ((obj.kind === 'residue' || obj.kind === 'dry') && timing === 'perfect') {
        addMeter(-0.8, 'rinse_finish_perfect');
      }
    }

    const inSoap = (PHASES[STATE.phaseIdx]?.id) === 'SOAP';
    if (inSoap) {
      if ((obj.kind === 'foam' || obj.kind === 'goldfoam') && timing === 'perfect') {
        STATE.perfectStreak = (STATE.perfectStreak || 0) + 1;
        if (STATE.perfectStreak >= 3 && !isFeverOn()) {
          triggerSoapFever();
          STATE.perfectStreak = 0;
        }
      } else {
        STATE.perfectStreak = 0;
      }

      if (timing === 'perfect' && (obj.kind === 'foam' || obj.kind === 'goldfoam')) {
        coach(`✨ PERFECT ${Math.min(3, (STATE.perfectStreak||0))}/3`);
      } else if (timing === 'late') {
        coach('⏱️ ช้าไปนิด (ล่า PERFECT x3)');
      }
    }

    if (inSoap && suddActive() && STATE.sudd) {
      const c = STATE.sudd;
      if (c.kind === 'safe2') {
        if (obj.kind === 'foam' || obj.kind === 'goldfoam') {
          c.progress = (c.progress || 0) + 1;
          if (c.progress >= 2) { c.failed = false; resolveSuddenChoice(true, 'safe2_done'); }
        } else if (obj.kind === 'fakefoam' || obj.kind === 'magnetfake') {
          c.failed = true; resolveSuddenChoice(false, 'touched_fake');
        }
      } else if (c.kind === 'nofake') {
        if (obj.kind === 'fakefoam' || obj.kind === 'magnetfake') {
          c.fakeTouched = (c.fakeTouched || 0) + 1;
          c.failed = true; resolveSuddenChoice(false, 'touched_fake');
        }
      } else if (c.kind === 'perfect1') {
        if ((obj.kind === 'foam' || obj.kind === 'goldfoam') && timing === 'perfect') {
          c.progress = 1; c.failed = false; resolveSuddenChoice(true, 'perfect1_done');
        }
      }
    }

    emit('hha:event', { game:'bath', type:'timing', timing, kind:obj.kind, zoneKey:obj.zoneKey||null, t:now() });

    fxBurst(obj.kind, localX, localY);

    updateHUD();
    return true;
  }

  // -----------------------------
  // HUD
  // -----------------------------
  function updateHUD(){
    const phaseObj = PHASES[STATE.phaseIdx] || null;
    const phase = phaseObj ? (phaseObj.id || phaseObj.type || '—') : '—';

    let timeLeftSec = 0;
    if (phaseObj && STATE.phaseStartedAt) {
      const phaseDur = phaseObj.ms || phaseObj.durationMs || (typeof phaseObj.duration === 'number' ? phaseObj.duration * 1000 : 10000);
      const elapsed = now() - STATE.phaseStartedAt;
      const leftMs = Math.max(0, phaseDur - elapsed);
      timeLeftSec = Math.ceil(leftMs / 1000);
    }

    let phaseTxt = `PHASE: ${phase}`;
    if (phase === 'SOAP' && isFeverOn()) phaseTxt += ' 🫧FEVER';
    if (phase === 'SOAP' && STATE.soapBoss && now() <= (STATE.soapBossUntil || 0)) phaseTxt += ' 👑BOSS';
    if (phase === 'SCRUB' && STATE.scrubScan && now() <= (STATE.scrubScanUntil || 0)) phaseTxt += ' 🔎SCAN';
    if (phase === 'SCRUB' && (STATE.routeChain || 0) >= 2) phaseTxt += ` 🗺️R${STATE.routeChain}`;
    if (phase === 'RINSE' && rinseFinishActive()) phaseTxt += ' ✨FINISH';

    const cleanPct = Math.round(clamp(Number(STATE.cleanScore || 0), 0, 100));
    const combo = Number(STATE.combo || 0);
    const miss = Number(STATE.miss || 0);
    const meter = Math.round(clamp(Number(STATE.meter || 0), 0, 100));

    setPill(UI.phasePill, phaseTxt);
    setPill(UI.timePill, `TIME: ${timeLeftSec}`);
    setPill(UI.cleanPill, `CLEAN: ${cleanPct}%`);
    setPill(UI.comboPill, `COMBO: ${combo}`);
    setPill(UI.missPill, `MISS: ${miss}`);
    setPill(UI.meterPill, `SWEAT: ${meter}%`);

    const soapBossActive = (phase === 'SOAP' && !!STATE.soapBoss && now() <= (STATE.soapBossUntil || 0));
    const scrubScanActive = (phase === 'SCRUB' && !!STATE.scrubScan && now() <= (STATE.scrubScanUntil || 0));
    const rinseFinishTxt = rinseFinishActive() ? `FINISH: ${(STATE.rinseFinishSeq || []).join('-') || 'เริ่มสลับ R/D'}` : null;

    let questTxt = '';
    if (soapBossActive) questTxt = `BOSS: เก็บ ★ หลีกเลี่ยง 🧲`;
    else if (suddActive()) questTxt = `CHOICE: ${suddText()}`;
    else if (scrubScanActive) questTxt = `SCAN: จำจุดอับที่ไฮไลต์`;
    else if (rinseFinishTxt) questTxt = rinseFinishTxt;
    else {
      const qText = String(STATE.questText || '');
      questTxt = `QUEST: ${qText}${STATE.questDone ? ' ✅' : ''}`;
    }

    if (phase === 'SCRUB' && !scrubScanActive && (STATE.routeChain || 0) >= 2 && !soapBossActive && !suddActive()) {
      questTxt += ` • ROUTE x${STATE.routeChain}`;
    }
    setPill(UI.questPill, questTxt);

    let pTxt = '';
    if (phase === 'SOAP') pTxt = `SOAP: ${(STATE.soapHits || 0)}/${(STATE.soapNeed || 8)}`;
    else if (phase === 'SCRUB') pTxt = `HIDDEN: ${(STATE.hiddenDone || 0)}/${(STATE.hiddenNeed || 4)}`;
    else if (phase === 'RINSE') pTxt = `RINSE: ${(STATE.rinseFinishDone ? 'Finish ✅' : 'Clear residues')}`;
    setPill(UI.progressPill, pTxt);

    UI.coachText.textContent = String(STATE.coachMsg || '');
    UI.coachText.style.opacity = STATE.coachMsg ? '1' : '0';

    DOC.body.classList.toggle('soap-fever', phase === 'SOAP' && isFeverOn());
    DOC.body.classList.toggle('rinse-finish', phase === 'RINSE' && rinseFinishActive());
    DOC.body.classList.toggle('phase-soap', phase === 'SOAP');
    DOC.body.classList.toggle('phase-scrub', phase === 'SCRUB');
    DOC.body.classList.toggle('phase-rinse', phase === 'RINSE');
    DOC.body.classList.toggle('bath-boss', phase === 'SOAP' && STATE.soapBoss && now() <= (STATE.soapBossUntil || 0));

    UI.missPill.classList.toggle('is-warn', miss >= 3 && miss < 6);
    UI.missPill.classList.toggle('is-bad',  miss >= 6);
    UI.cleanPill.classList.toggle('is-good', cleanPct >= 70);
    UI.meterPill.classList.toggle('is-warn', meter >= 60 && meter < 85);
    UI.meterPill.classList.toggle('is-bad',  meter >= 85);

    updateDebugPanel();
  }

  // -----------------------------
  // Tick / loop
  // -----------------------------
  function tick(ts){
    const t = (typeof ts === 'number' && Number.isFinite(ts)) ? ts : now();

    if (STATE.ended) return;
    if (!STATE.startedAt) STATE.startedAt = t;
    if (!STATE.phaseStartedAt) STATE.phaseStartedAt = t;

    const prev = STATE._lastTickAt || t;
    let dt = t - prev;
    if (!Number.isFinite(dt) || dt < 0) dt = 16;
    dt = Math.min(dt, 50);
    STATE._lastTickAt = t;

    if (STATE.paused) {
      updateHUD();
      STATE.raf = requestAnimationFrame(tick);
      return;
    }

    const phase = PHASES[STATE.phaseIdx];
    if (!phase) { endGame(); return; }

    const phaseDur = phase.ms || phase.durationMs || (typeof phase.duration === 'number' ? phase.duration * 1000 : 10000);
    const elapsed = t - (STATE.phaseStartedAt || t);
    const timeLeft = Math.max(0, phaseDur - elapsed);

    expireTargets(t);

    if (STATE.scrubScan && t > (STATE.scrubScanUntil || 0)) {
      STATE.scrubScan = false;
      clearScanMarkers();
      emit('hha:event', { game:'bath', type:'scrub_scan_end', t });
      coach('ไปเลย! เริ่มจากจุดที่จำไว้', 700);
    }

    if (phase.id === 'SOAP' && !STATE.soapBoss && timeLeft <= 5000) startSoapBoss();

    if (phase.id === 'SOAP') {
      if (!phase._nextSuddAt) phase._nextSuddAt = t + 3500 + rnd()*2500;

      if (!suddActive() && STATE.sudd?.resolved) {
        phase._nextSuddAt = Math.max(phase._nextSuddAt || 0, t + 2200 + rnd()*1800);
      }

      if (!suddActive() && !(STATE.soapBoss && t <= (STATE.soapBossUntil || 0)) && t >= (phase._nextSuddAt || 0)) {
        startSuddenChoice();
        phase._nextSuddAt = t + 4500 + rnd()*3000;
      }

      if (STATE.sudd && !STATE.sudd.resolved && t > (STATE.sudd.until || 0)) {
        const c = STATE.sudd;
        if (c.kind === 'nofake') resolveSuddenChoice(true, 'timeout_clean');
        else resolveSuddenChoice(false, 'timeout');
      }
    }

    if (STATE.soapBoss && t > (STATE.soapBossUntil || 0)) {
      STATE.soapBoss = false;
      const gold = STATE.soapBossHitsGold || 0;
      const fake = STATE.soapBossHitsFake || 0;

      if (gold >= 3 && gold > fake) {
        STATE.combo = (STATE.combo || 0) + 2;
        addMeter(-5, 'soap_boss_clear');
        coach('👑 SOAP BOSS CLEAR! พร้อมลุย SCRUB', 900);
      } else {
        addMeter(2, 'soap_boss_weak');
        coach('จบ SOAP BOSS — ไปแก้มือใน SCRUB ได้!', 800);
      }

      emit('hha:event', { game:'bath', type:'soap_boss_end', gold, fake, t });
    }

    if (phase.id === 'RINSE' && !STATE.rinseFinish && !STATE.rinseFinishDone && timeLeft <= 4000) {
      startRinseFinish();
    }
    if (phase.id === 'RINSE') resolveRinseFinishTimeout();

    spawnForPhase(phase);

    updateAnimations(dt, t);
    renderTargets();

    if (typeof STATE.meter === 'number') STATE.meterPeak = Math.max(STATE.meterPeak || 0, STATE.meter);

    updateHUD();

    if (timeLeft <= 0) {
      if (phase.id === 'SCRUB') {
        const rb = STATE.routeBest || 0;
        if (rb >= 5) {
          STATE.combo = (STATE.combo || 0) + 2;
          addMeter(-4, 'route_mastery');
          coach(`🧠 Route Mastery! (best x${rb})`, 900);
          tagEvent('create_route_mastery', { best: rb });
        } else if (rb >= 3) {
          addMeter(-2, 'route_good_end');
          coach(`👍 Route ดีมาก (best x${rb})`, 800);
        }
      }

      clearScanMarkers();
      STATE.scrubScan = false;
      STATE.scrubScanUntil = 0;
      clearAllTargetsForPhaseTransition();

      const nextIdx = (STATE.phaseIdx || 0) + 1;
      if (nextIdx >= PHASES.length) {
        endGame();
        return;
      } else {
        startPhase(nextIdx);
        updateHUD();
        STATE.raf = requestAnimationFrame(tick);
        return;
      }
    }

    STATE.raf = requestAnimationFrame(tick);
  }

  // -----------------------------
  // Start / reset / phase setup
  // -----------------------------
  function resetGame(){
    STATE.ended = false;
    STATE.paused = false;
    STATE.phaseIdx = 0;
    STATE.startedAt = 0;
    STATE.phaseStartedAt = 0;
    STATE._lastTickAt = 0;
    STATE.nextSpawnAt = 0;
    STATE.seqId = 1;

    STATE.hits = 0;
    STATE.miss = 0;
    STATE.combo = 0;
    STATE.cleanScore = 0;
    STATE.meter = 0;
    STATE.meterPeak = 0;

    STATE.soapHits = 0;
    STATE.soapNeed = CFG.soapNeed;
    STATE.fakeFoamRate = CFG.fakeFoam;
    STATE.perfectStreak = 0;
    STATE.feverUntil = 0;
    STATE.feverActivations = 0;

    STATE.sudd = null;
    STATE.suddDone = 0;
    STATE.suddFail = 0;

    STATE.soapBoss = false;
    STATE.soapBossUntil = 0;
    STATE.soapBossHitsGold = 0;
    STATE.soapBossHitsFake = 0;

    STATE.hiddenDone = 0;
    STATE.hiddenNeed = CFG.hiddenNeed;
    STATE.hiddenPlan = [];
    STATE.scrubScan = false;
    STATE.scrubScanUntil = 0;
    STATE.scrubScanTargets = [];
    STATE.scrubScanFirstBonus = false;

    STATE.routeLastZone = null;
    STATE.routeChain = 0;
    STATE.routeBest = 0;
    STATE.routeBonusHits = 0;

    STATE.rinseFinish = false;
    STATE.rinseFinishUntil = 0;
    STATE.rinseFinishSeq = [];
    STATE.rinseFinishDone = false;

    STATE.questText = '';
    STATE.questDone = false;
    STATE.coachMsg = '';
    STATE._timingDebug = null;

    if (STATE.active && typeof STATE.active.clear === 'function') STATE.active.clear();
    else STATE.active = new Map();

    UI.targetLayer.innerHTML = '';
    UI.fxLayer.innerHTML = '';
    clearScanMarkers();
    clearAllTargetsForPhaseTransition();

    if (UI.endOverlay) {
      UI.endOverlay.hidden = true;
      UI.endOverlay.classList.remove('show');
    }

    if (STATE.raf) {
      try { cancelAnimationFrame(STATE.raf); } catch(e){}
      STATE.raf = 0;
    }

    ensureDebugPanel();
    updateDebugPanel();
  }

  function startPhase(idx){
    STATE.phaseIdx = idx;
    const phase = PHASES[idx];
    if (!phase) return;

    STATE.phaseStartedAt = now();
    STATE.nextSpawnAt = 0;
    STATE.questDone = false;

    STATE.sudd = null;
    STATE.soapBoss = false;
    STATE.soapBossUntil = 0;
    STATE.soapBossHitsGold = 0;
    STATE.soapBossHitsFake = 0;

    STATE.scrubScan = false;
    STATE.scrubScanUntil = 0;
    STATE.scrubScanTargets = [];
    STATE.scrubScanFirstBonus = false;

    STATE.rinseFinish = false;
    STATE.rinseFinishUntil = 0;
    STATE.rinseFinishSeq = [];
    if ((phase.id || '') === 'RINSE') STATE.rinseFinishDone = false;

    STATE.routeLastZone = null;
    STATE.routeChain = 0;

    clearScanMarkers();
    clearAllTargetsForPhaseTransition();

    const pid = phase.id || phase.type || '';
    if (pid === 'SOAP') {
      STATE.questText = `เก็บฟองจริงให้ครบ ${(STATE.soapNeed || 8)} อัน`;
      STATE.questDone = false;
      phase._nextSuddAt = 0;
    }
    else if (pid === 'SCRUB') {
      pickHiddenPlan();
      STATE.hiddenDone = 0;
      STATE.questText = `เปิดจุดอับให้ครบ ${(STATE.hiddenNeed || 4)} จุด`;
      startScrubScan();
    }
    else if (pid === 'RINSE') {
      STATE.questText = 'ล้างคราบและเก็บจุดแห้งให้สมดุล';
      STATE.rinseFinishDone = false;
    } else {
      STATE.questText = '';
    }

    emit('hha:event', { game:'bath', type:'phase_start', phase: pid, idx, t: now() });
    updateHUD();
  }

  function startGame(){
    resetGame();
    refreshZoneScreenPos();
    STATE.startedAt = now();
    startPhase(0);
    coach('เริ่ม SOAP: เก็บฟองจริง เลี่ยงฟองปลอม', 950);
    STATE.raf = requestAnimationFrame(tick);
  }

  // -----------------------------
  // End game
  // -----------------------------
  function endGame(){
    if (STATE.ended) return;
    STATE.ended = true;

    try { if (STATE.raf) cancelAnimationFrame(STATE.raf); } catch(e){}
    clearScanMarkers();
    STATE.scrubScan = false; STATE.scrubScanUntil = 0;
    STATE.soapBoss = false;
    STATE.rinseFinish = false;

    const clean = Math.round(clamp(Number(STATE.cleanScore || 0), 0, 100));
    const hits = Number(STATE.hits || 0);
    const miss = Number(STATE.miss || 0);
    const meterPeak = Math.round(clamp(Number(STATE.meterPeak || STATE.meter || 0), 0, 100));
    const hiddenDone  = Number(STATE.hiddenDone || 0);
    const hiddenTotal = Number(STATE.hiddenNeed || 0);

    const feverTxt    = ` • FEVER ${STATE.feverActivations || 0}`;
    const choiceTxt   = ` • CHOICE ${STATE.suddDone || 0}/${(STATE.suddDone || 0) + (STATE.suddFail || 0)}`;
    const soapBossTxt = ` • SOAPBOSS ★${STATE.soapBossHitsGold || 0}/🧲${STATE.soapBossHitsFake || 0}`;
    const scanTxt     = ` • SCAN ${STATE.scrubScanFirstBonus ? 'FOLLOW✅' : '—'}`;
    const routeTxt    = ` • ROUTE best x${STATE.routeBest || 0} / bonus ${STATE.routeBonusHits || 0}`;
    const finishTxt   = ` • FINISH ${STATE.rinseFinishDone ? 'CLEAN✅' : '—'}`;

    let rank = 'C';
    if (clean >= 90 && miss <= 3) rank = 'S';
    else if (clean >= 80 && miss <= 5) rank = 'A';
    else if (clean >= 70 && miss <= 7) rank = 'B';
    else if (clean >= 55) rank = 'C';
    else rank = 'D';

    STATE.rank = rank;

    const summaryText =
      `CLEAN ${clean}% • HIT ${hits} • MISS ${miss} • Hidden ${hiddenDone}/${hiddenTotal} • SWEAT PEAK ${meterPeak}%` +
      `${feverTxt}${choiceTxt}${soapBossTxt}${scanTxt}${routeTxt}${finishTxt}`;

    UI.endRank.textContent = rank;
    UI.endTitle.textContent =
      rank === 'S' ? 'สุดยอดมาก!' :
      rank === 'A' ? 'เยี่ยมมาก!' :
      rank === 'B' ? 'ดีมาก!' :
      rank === 'C' ? 'ผ่านแล้ว ลองอีกครั้งได้!' : 'ลองใหม่อีกนิดนะ!';
    UI.endSummary.textContent = summaryText;

    UI.endDetail.textContent = [
      `Soap hits: ${STATE.soapHits || 0}/${STATE.soapNeed || 8}`,
      `Hidden cleaned: ${hiddenDone}/${hiddenTotal}`,
      `FEVER activations: ${STATE.feverActivations || 0}`,
      `Choice success/fail: ${STATE.suddDone || 0}/${STATE.suddFail || 0}`,
      `SOAP Boss (★/🧲): ${STATE.soapBossHitsGold || 0}/${STATE.soapBossHitsFake || 0}`,
      `Route best chain: x${STATE.routeBest || 0}`,
      `Rinse Finish: ${STATE.rinseFinishDone ? 'Success' : 'No'}`
    ].join('\n');

    UI.endOverlay.hidden = false;
    UI.endOverlay.classList.add('show');

    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        game:'bath',
        ts: Date.now(),
        rank, clean, hits, miss, meterPeak,
        hiddenDone, hiddenTotal,
        fever: STATE.feverActivations || 0,
        choicePass: STATE.suddDone || 0,
        choiceFail: STATE.suddFail || 0,
        soapBossGold: STATE.soapBossHitsGold || 0,
        soapBossFake: STATE.soapBossHitsFake || 0,
        routeBest: STATE.routeBest || 0,
        routeBonusHits: STATE.routeBonusHits || 0,
        rinseFinish: !!STATE.rinseFinishDone,
        summaryText
      }));
    } catch(e){}

    tagEvent('session_skill_summary', {
      clean, hits, miss, meterPeak, rank,
      hiddenDone, hiddenTotal,
      fever: STATE.feverActivations || 0,
      choicePass: STATE.suddDone || 0,
      choiceFail: STATE.suddFail || 0,
      soapBossGold: STATE.soapBossHitsGold || 0,
      soapBossFake: STATE.soapBossHitsFake || 0,
      routeBest: STATE.routeBest || 0,
      routeBonusHits: STATE.routeBonusHits || 0,
      rinseFinish: !!STATE.rinseFinishDone
    });

    emit('hha:event', {
      game:'bath',
      type:'session_end',
      t:now(),
      result:{
        rank, clean, hits, miss, meterPeak,
        hiddenDone, hiddenTotal,
        fever: STATE.feverActivations || 0,
        choicePass: STATE.suddDone || 0,
        choiceFail: STATE.suddFail || 0,
        soapBossGold: STATE.soapBossHitsGold || 0,
        soapBossFake: STATE.soapBossHitsFake || 0,
        routeBest: STATE.routeBest || 0,
        routeBonusHits: STATE.routeBonusHits || 0,
        rinseFinish: !!STATE.rinseFinishDone
      }
    });

    try { (UI.btnReplay || UI.btnEndBackHub)?.focus?.(); } catch(e){}
  }

  // -----------------------------
  // Debug overlay
  // -----------------------------
  function debugEnabled(){
    return qs('debug', '0') === '1';
  }

  function ensureDebugPanel(){
    if (!debugEnabled()) return null;
    let el = DOC.getElementById('debugPanel');
    if (el) return el;

    el = DOC.createElement('section');
    el.id = 'debugPanel';
    el.innerHTML = `
      <div class="dbg-head">
        <div class="dbg-title">Bath Debug</div>
        <div class="dbg-actions">
          <button type="button" data-act="copy">Copy</button>
          <button type="button" data-act="hide">Hide</button>
        </div>
      </div>
      <div class="dbg-body" id="debugPanelBody"></div>
    `;

    el.addEventListener('click', async (ev)=>{
      const btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');

      if (act === 'hide') {
        el.classList.toggle('hidden');
        btn.textContent = el.classList.contains('hidden') ? 'Show' : 'Hide';
        return;
      }

      if (act === 'copy') {
        try {
          const snap = getDebugSnapshot();
          await navigator.clipboard.writeText(JSON.stringify(snap, null, 2));
          btn.textContent = 'Copied!';
          setTimeout(()=>{ btn.textContent = 'Copy'; }, 700);
        } catch(e) {
          btn.textContent = 'Copy ❌';
          setTimeout(()=>{ btn.textContent = 'Copy'; }, 700);
        }
      }
    });

    DOC.body.appendChild(el);
    return el;
  }

  function getDebugSnapshot(){
    const phaseObj = PHASES?.[STATE.phaseIdx] || null;
    const phaseId = phaseObj?.id || phaseObj?.type || '—';

    let timeLeftMs = 0;
    if (phaseObj && STATE.phaseStartedAt) {
      const phaseDur = phaseObj.ms || phaseObj.durationMs || (typeof phaseObj.duration === 'number' ? phaseObj.duration * 1000 : 10000);
      timeLeftMs = Math.max(0, phaseDur - (now() - STATE.phaseStartedAt));
    }

    return {
      phase: phaseId,
      phaseIdx: STATE.phaseIdx || 0,
      timeLeftMs: Math.round(timeLeftMs),
      score: {
        clean: Math.round(STATE.cleanScore || 0),
        hits: STATE.hits || 0,
        miss: STATE.miss || 0,
        combo: STATE.combo || 0,
        meter: Math.round(STATE.meter || 0),
        meterPeak: Math.round(STATE.meterPeak || 0)
      },
      active: {
        count: STATE.active?.size || 0,
        nextSpawnInMs: Math.max(0, Math.round((STATE.nextSpawnAt || 0) - now()))
      },
      soap: {
        soapHits: STATE.soapHits || 0,
        soapNeed: STATE.soapNeed || 0,
        fakeFoamRate: +Number(STATE.fakeFoamRate || 0).toFixed(3),
        perfectStreak: STATE.perfectStreak || 0,
        feverOn: !!(STATE.feverUntil && now() <= STATE.feverUntil),
        feverLeftMs: Math.max(0, Math.round((STATE.feverUntil || 0) - now())),
        sudd: STATE.sudd ? {
          kind: STATE.sudd.kind,
          progress: STATE.sudd.progress || 0,
          untilInMs: Math.max(0, Math.round((STATE.sudd.until || 0) - now())),
          resolved: !!STATE.sudd.resolved,
          failed: !!STATE.sudd.failed
        } : null,
        bossOn: !!(STATE.soapBoss && now() <= STATE.soapBossUntil),
        bossLeftMs: Math.max(0, Math.round((STATE.soapBossUntil || 0) - now())),
        bossGold: STATE.soapBossHitsGold || 0,
        bossFake: STATE.soapBossHitsFake || 0
      },
      scrub: {
        hiddenDone: STATE.hiddenDone || 0,
        hiddenNeed: STATE.hiddenNeed || 0,
        hiddenPlan: Array.isArray(STATE.hiddenPlan) ? STATE.hiddenPlan.slice(0,8) : [],
        scanOn: !!(STATE.scrubScan && now() <= STATE.scrubScanUntil),
        scanLeftMs: Math.max(0, Math.round((STATE.scrubScanUntil || 0) - now())),
        scanTargets: Array.isArray(STATE.scrubScanTargets) ? STATE.scrubScanTargets.slice() : [],
        scanFirstBonus: !!STATE.scrubScanFirstBonus,
        routeLastZone: STATE.routeLastZone || null,
        routeChain: STATE.routeChain || 0,
        routeBest: STATE.routeBest || 0,
        routeBonusHits: STATE.routeBonusHits || 0
      },
      rinse: {
        finishOn: !!(STATE.rinseFinish && now() <= STATE.rinseFinishUntil),
        finishLeftMs: Math.max(0, Math.round((STATE.rinseFinishUntil || 0) - now())),
        finishSeq: Array.isArray(STATE.rinseFinishSeq) ? STATE.rinseFinishSeq.slice() : [],
        finishDone: !!STATE.rinseFinishDone
      },
      timing: STATE._timingDebug || null
    };
  }

  function updateDebugPanel(){
    if (!debugEnabled()) return;
    const panel = ensureDebugPanel();
    if (!panel || panel.classList.contains('hidden')) return;

    const body = DOC.getElementById('debugPanelBody');
    if (!body) return;
    const d = getDebugSnapshot();

    const vClass = (val, kind)=>{
      const s = String(val);
      if (kind === 'bool') return val ? `<span class="ok">${s}</span>` : `<span class="bad">${s}</span>`;
      return s;
    };

    body.innerHTML = `
      <div class="dbg-row"><div class="dbg-k">phase</div><div class="dbg-v">${d.phase} (#${d.phaseIdx}) • ${d.timeLeftMs}ms</div></div>
      <div class="dbg-row"><div class="dbg-k">score</div><div class="dbg-v">clean=${d.score.clean} hit=${d.score.hits} miss=${d.score.miss} combo=${d.score.combo} meter=${d.score.meter}/${d.score.meterPeak}</div></div>
      <div class="dbg-row"><div class="dbg-k">active</div><div class="dbg-v">count=${d.active.count} nextSpawnIn=${d.active.nextSpawnInMs}ms</div></div>

      <div class="dbg-row"><div class="dbg-k">fever</div><div class="dbg-v">${vClass(d.soap.feverOn,'bool')} • left=${d.soap.feverLeftMs}ms • streak=${d.soap.perfectStreak}</div></div>
      <div class="dbg-row"><div class="dbg-k">choice</div><div class="dbg-v">${
        d.soap.sudd ? `kind=${d.soap.sudd.kind} p=${d.soap.sudd.progress} left=${d.soap.sudd.untilInMs}ms resolved=${d.soap.sudd.resolved} failed=${d.soap.sudd.failed}` : '<span class="warn">none</span>'
      }</div></div>
      <div class="dbg-row"><div class="dbg-k">soap boss</div><div class="dbg-v">${vClass(d.soap.bossOn,'bool')} • left=${d.soap.bossLeftMs}ms • ★=${d.soap.bossGold} 🧲=${d.soap.bossFake}</div></div>

      <div class="dbg-row"><div class="dbg-k">scrub</div><div class="dbg-v">hidden=${d.scrub.hiddenDone}/${d.scrub.hiddenNeed} • scan=${d.scrub.scanOn}(${d.scrub.scanLeftMs}ms) • bonus=${d.scrub.scanFirstBonus}</div></div>
      <div class="dbg-row"><div class="dbg-k">scan targets</div><div class="dbg-v">${d.scrub.scanTargets.length ? d.scrub.scanTargets.join(', ') : '<span class="warn">[]</span>'}</div></div>
      <div class="dbg-row"><div class="dbg-k">route</div><div class="dbg-v">last=${d.scrub.routeLastZone || '-'} • chain=${d.scrub.routeChain} • best=${d.scrub.routeBest} • bonus=${d.scrub.routeBonusHits}</div></div>

      <div class="dbg-row"><div class="dbg-k">rinse finish</div><div class="dbg-v">${vClass(d.rinse.finishOn,'bool')} • left=${d.rinse.finishLeftMs}ms • done=${d.rinse.finishDone} • seq=${d.rinse.finishSeq.join('-') || '-'}</div></div>

      <div class="dbg-row"><div class="dbg-k">timing</div><div class="dbg-v">${
        d.timing ? `${d.timing.result} • life=${d.timing.lifeRatio} • dNorm=${d.timing.dNorm} • final=${d.timing.finalScore}` : '<span class="warn">none</span>'
      }</div></div>

      <div class="dbg-row">
        <div class="dbg-k">timing json</div>
        <div class="dbg-v"><div class="dbg-json">${d.timing ? escapeHtml(JSON.stringify(d.timing, null, 2)) : '-'}</div></div>
      </div>
    `;
  }

  // -----------------------------
  // Input (tap on stage = fallback miss/hit)
  // -----------------------------
  UI.gameStage.addEventListener('pointerdown', (ev)=>{
    // target buttons handle their own pointerdown; stage handles empty area
    if (ev.target.closest('.target')) return;
    handleShootAt(ev.clientX, ev.clientY);
  });

  // -----------------------------
  // Buttons
  // -----------------------------
  UI.btnStart.addEventListener('click', ()=>{
    startGame();
    UI.btnStart.hidden = true;
  });

  UI.btnPause.addEventListener('click', ()=>{
    if (STATE.ended) return;
    STATE.paused = true;
    UI.btnPause.hidden = true;
    UI.btnResume.hidden = false;
    coach('⏸️ Paused', 500);
  });

  UI.btnResume.addEventListener('click', ()=>{
    if (STATE.ended) return;
    STATE.paused = false;
    UI.btnPause.hidden = false;
    UI.btnResume.hidden = true;
    coach('▶️ Resume', 500);
  });

  UI.btnReset.addEventListener('click', ()=>{
    resetGame();
    refreshZoneScreenPos();
    UI.btnStart.hidden = false;
    UI.btnPause.hidden = false;
    UI.btnResume.hidden = true;
    updateHUD();
  });

  UI.btnReplay.addEventListener('click', ()=>{
    UI.btnPause.hidden = false;
    UI.btnResume.hidden = true;
    UI.btnStart.hidden = true;
    startGame();
  });

  UI.btnBackHub.addEventListener('click', (ev)=>{
    if (UI.btnBackHub.getAttribute('href') === '#') {
      ev.preventDefault();
      if (history.length > 1) history.back();
    }
  });

  // -----------------------------
  // Init
  // -----------------------------
  function init(){
    refreshZoneScreenPos();
    resetGame();
    updateHUD();
    ensureDebugPanel();

    WIN.addEventListener('resize', ()=>{
      refreshZoneScreenPos();
      // re-anchor active targets roughly to their zone to avoid drift after rotate
      STATE.active.forEach(obj=>{
        const p = STATE.zonePos?.[obj.zoneKey];
        if (!p || !obj.el) return;
        obj.x = obj.sx = obj.cx = obj.hitCx = p.x;
        obj.y = obj.sy = obj.cy = obj.hitCy = p.y;
        obj.el.style.left = `${Math.round(p.x)}px`;
        obj.el.style.top  = `${Math.round(p.y)}px`;
      });
      clearScanMarkers();
      if (STATE.scrubScan && Array.isArray(STATE.scrubScanTargets) && STATE.scrubScanTargets.length) {
        showScanMarkers(STATE.scrubScanTargets);
      }
      updateHUD();
    });

    coach('กด “เริ่มเกม” เพื่อเริ่ม Bath Quest', 1200);
  }

  init();

})();