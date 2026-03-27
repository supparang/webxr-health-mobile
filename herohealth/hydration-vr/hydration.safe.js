'use strict';

(function(){
  const qs = new URLSearchParams(location.search);

  function q(name, fallback=''){
    const v = qs.get(name);
    return v == null || v === '' ? fallback : v;
  }

  function clamp(v,a,b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function nowMs(){
    return (performance && performance.now) ? performance.now() : Date.now();
  }

  function sanitizePid(v){
    return String(v || '')
      .trim()
      .replace(/[.#$[\]/]/g, '-')
      .replace(/\s+/g, '-')
      .slice(0,36);
  }

  function defaultHub(){
    return q('hub', new URL('../hub.html', location.href).href);
  }

  function defaultTimeForDiff(diff){
    if(diff === 'easy') return 60;
    if(diff === 'hard') return 90;
    return 80;
  }

  function diffLabel(v){
    return v === 'easy' ? 'Easy' : v === 'hard' ? 'Hard' : 'Normal';
  }

  function viewLabel(v){
    if(v === 'pc') return 'PC';
    if(v === 'cvr') return 'Cardboard / cVR';
    return 'Mobile';
  }

  function xmur3(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }

  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  const RUN  = String(q('run','play')).toLowerCase();
  const DIFF = String(q('diff','normal')).toLowerCase();
  const VIEW = String(q('view','mobile')).toLowerCase();
  const HUB  = defaultHub();
  const PID  = sanitizePid(q('pid','p-anon')) || 'p-anon';
  const NICK = String(q('nick', q('nickName','Rocky'))).trim().slice(0,24) || 'Rocky';
  const SEED = String(q('seed', String(Date.now())));
  const TIME = clamp(q('time', String(defaultTimeForDiff(DIFF))), 30, 180);
  const COOLDOWN = String(q('cooldown','1')) === '1';
  const SESSION_ID = String(q('sessionId', `hydr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`));

  const RNG_SEED = xmur3(`${SEED}|${PID}|${DIFF}|${TIME}|${VIEW}`);
  const rand = sfc32(RNG_SEED(), RNG_SEED(), RNG_SEED(), RNG_SEED());

  const CFG = {
    easy:   { spawnMs: 860, speedMin: 70,  speedMax: 130, goodRate: .68, badRate:.18, shieldRate:.14, targetBase:76, mission:14, bossNeedWater:50 },
    normal: { spawnMs: 650, speedMin: 110, speedMax: 190, goodRate: .62, badRate:.24, shieldRate:.14, targetBase:68, mission:18, bossNeedWater:55 },
    hard:   { spawnMs: 500, speedMin: 150, speedMax: 250, goodRate: .56, badRate:.29, shieldRate:.15, targetBase:60, mission:22, bossNeedWater:58 }
  }[DIFF] || {
    spawnMs: 650, speedMin:110, speedMax:190, goodRate:.62, badRate:.24, shieldRate:.14, targetBase:68, mission:18, bossNeedWater:55
  };

  const GOOD_POOL = [
    { emoji:'💧', label:'น้ำดี', score:10, water:4 },
    { emoji:'🫧', label:'ฟองน้ำ', score:12, water:5 },
    { emoji:'🥛', label:'นมจืด', score:14, water:4 }
  ];

  const BAD_POOL = [
    { emoji:'🥤', label:'น้ำหวาน', score:-10, water:-8, heart:-1 },
    { emoji:'🍟', label:'ของทอด', score:-8,  water:-6, heart:-1 },
    { emoji:'🍩', label:'ขนมหวาน', score:-9,  water:-7, heart:-1 }
  ];

  const SHIELD_ITEM = { emoji:'🛡️', label:'โล่', score:6, water:2, shield:1 };

  const EL = {
    stage: document.getElementById('stage'),
    objectLayer: document.getElementById('objectLayer'),
    effectLayer: document.getElementById('effectLayer'),
    bossLayer: document.getElementById('bossLayer'),

    playerName: document.getElementById('playerName'),
    coachBubble: document.getElementById('coachBubble'),
    scoreVal: document.getElementById('scoreVal'),
    comboVal: document.getElementById('comboVal'),
    waterVal: document.getElementById('waterVal'),
    heartsVal: document.getElementById('heartsVal'),
    shieldVal: document.getElementById('shieldVal'),
    timeVal: document.getElementById('timeVal'),
    bestComboVal: document.getElementById('bestComboVal'),
    metaDiff: document.getElementById('metaDiff'),
    metaView: document.getElementById('metaView'),
    metaTime: document.getElementById('metaTime'),
    runVal: document.getElementById('runVal'),

    missionFill: document.getElementById('missionFill'),
    missionBadge: document.getElementById('missionBadge'),

    stormBanner: document.getElementById('stormBanner'),
    bossBanner: document.getElementById('bossBanner'),

    countdown: document.getElementById('countdown'),
    countNum: document.getElementById('countNum'),
    countBubble: document.getElementById('countBubble'),

    summaryOverlay: document.getElementById('summaryOverlay'),
    summaryRibbon: document.getElementById('summaryRibbon'),
    summaryStars: document.getElementById('summaryStars'),
    summaryScore: document.getElementById('summaryScore'),
    summaryCoins: document.getElementById('summaryCoins'),
    summaryWater: document.getElementById('summaryWater'),
    summaryBestCombo: document.getElementById('summaryBestCombo'),
    summaryMsg: document.getElementById('summaryMsg'),

    replayBtn: document.getElementById('replayBtn'),
    backHubBtn: document.getElementById('backHubBtn'),

    helpBtn: document.getElementById('helpBtn'),
    closeHelpBtn: document.getElementById('closeHelpBtn'),
    helpBackdrop: document.getElementById('helpBackdrop')
  };

  const state = {
    score:0,
    water:40,
    hearts:8,
    shield:0,
    combo:0,
    bestCombo:0,
    goodCaught:0,
    badHit:0,
    missedGood:0,
    collectedShield:0,
    storm:false,
    boss:false,
    bossHits:0,
    started:false,
    ended:false,
    lastMs:0,
    timeLeft:TIME,
    spawnTimer:0,
    bossTimer:0,
    missionNeed:CFG.mission,
    objects:[],
    stageW:0,
    stageH:0,
    eventLog:[]
  };

  function postToWrapper(msg){
    try{
      if(window.parent && window.parent !== window){
        window.parent.postMessage(msg, location.origin);
      }
    }catch{}
  }

  function logEvent(type, extra){
    state.eventLog.push({
      ts: Date.now(),
      t: Math.round((TIME - state.timeLeft) * 1000) / 1000,
      type,
      ...extra
    });
  }

  function setCoach(text){
    EL.coachBubble.textContent = text;
    postToWrapper({ type:'hha:setStatus', text });
  }

  function updateMeta(){
    EL.playerName.textContent = NICK;
    EL.metaDiff.textContent = `🎯 ${diffLabel(DIFF)}`;
    EL.metaView.textContent = `📱 ${viewLabel(VIEW)}`;
    EL.metaTime.textContent = `⏱ ${TIME} วินาที`;
    EL.runVal.textContent = RUN.charAt(0).toUpperCase() + RUN.slice(1);

    if(VIEW === 'cvr'){
      document.body.classList.add('cvr-mode');
    }else{
      document.body.classList.remove('cvr-mode');
    }
  }

  function updateHud(){
    EL.scoreVal.textContent = String(Math.max(0, Math.round(state.score)));
    EL.comboVal.textContent = String(state.combo);
    EL.waterVal.textContent = `${clamp(state.water,0,100)}%`;
    EL.heartsVal.textContent = String(Math.max(0, state.hearts));
    EL.shieldVal.textContent = String(state.shield);
    EL.timeVal.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    EL.bestComboVal.textContent = String(state.bestCombo);

    const pct = clamp((state.goodCaught / Math.max(1, state.missionNeed)) * 100, 0, 100);
    EL.missionFill.style.width = `${pct}%`;
    EL.missionBadge.textContent = `${state.goodCaught} / ${state.missionNeed}`;
  }

  function stageRect(){
    return EL.stage.getBoundingClientRect();
  }

  function refreshStageSize(){
    const r = stageRect();
    state.stageW = r.width;
    state.stageH = r.height;
  }

  function randFloat(min,max){
    return min + (max-min) * rand();
  }

  function randInt(min,max){
    return Math.floor(randFloat(min, max+1));
  }

  function chooseByWeight(){
    const roll = rand();
    if(roll < CFG.goodRate) return 'good';
    if(roll < CFG.goodRate + CFG.badRate) return 'bad';
    return 'shield';
  }

  function makeTarget(kind){
    refreshStageSize();

    const base = CFG.targetBase + (VIEW === 'cvr' ? 14 : 0) + (VIEW === 'mobile' ? 6 : 0);
    const size = kind === 'boss'
      ? clamp(base + 34, 88, 132)
      : clamp(base + randInt(-6, 8), 52, 94);

    const safePad = 14;
    const x = randFloat(safePad, Math.max(safePad, state.stageW - size - safePad));
    const y = -size - randFloat(0, 30);

    let data;
    if(kind === 'good'){
      data = GOOD_POOL[randInt(0, GOOD_POOL.length-1)];
    }else if(kind === 'bad'){
      data = BAD_POOL[randInt(0, BAD_POOL.length-1)];
    }else if(kind === 'shield'){
      data = SHIELD_ITEM;
    }else{
      data = { emoji:'💧', label:'Boss', score:30, water:8 };
    }

    const el = document.createElement('button');
    el.type = 'button';
    el.className = `target ${kind}`;
    el.setAttribute('aria-label', data.label);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = kind === 'boss' ? '28px' : '999px';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = data.emoji;
    emoji.style.fontSize = `${kind === 'boss' ? Math.round(size * .46) : Math.round(size * .42)}px`;

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = data.label;

    el.appendChild(emoji);
    el.appendChild(label);
    EL.objectLayer.appendChild(el);

    const obj = {
      id: `o_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      kind,
      el,
      x,
      y,
      size,
      data,
      speed: kind === 'boss'
        ? randFloat(55, 85)
        : randFloat(CFG.speedMin, CFG.speedMax) * (state.storm ? 1.18 : 1),
      drift: randFloat(-18, 18),
      alive:true
    };

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      if(!obj.alive || state.ended || !state.started) return;
      hitTarget(obj);
    });

    state.objects.push(obj);
    logEvent('spawn', { id: obj.id, kind: obj.kind, x: Math.round(obj.x), y: Math.round(obj.y), size: obj.size });
    return obj;
  }

  function removeTarget(obj){
    obj.alive = false;
    if(obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
  }

  function splash(text, x, y, type){
    const el = document.createElement('div');
    el.className = `splash ${type}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    EL.effectLayer.appendChild(el);
    setTimeout(()=>{
      if(el.parentNode) el.parentNode.removeChild(el);
    }, 700);
  }

  function centerOf(obj){
    return {
      x: obj.x + obj.size/2,
      y: obj.y + obj.size/2
    };
  }

  function showBanner(el, ms){
    el.classList.add('show');
    setTimeout(()=> el.classList.remove('show'), ms || 1500);
  }

  function hitTarget(obj){
    const c = centerOf(obj);

    if(obj.kind === 'good'){
      state.score += obj.data.score + (state.combo >= 5 ? 2 : 0);
      state.water = clamp(state.water + obj.data.water, 0, 100);
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.goodCaught += 1;
      splash(`+${obj.data.score}`, c.x, c.y, 'good');

      if(state.combo === 3){
        setCoach('เยี่ยมเลย! คอมโบเริ่มมาแล้ว');
      }else if(state.combo === 7){
        setCoach('สุดยอด! เก็บน้ำดีต่อเนื่องได้เก่งมาก');
      }
    }
    else if(obj.kind === 'bad'){
      if(state.shield > 0){
        state.shield -= 1;
        splash('BLOCK!', c.x, c.y, 'shield');
        setCoach('โล่ช่วยป้องกันไว้แล้ว!');
      }else{
        state.score = Math.max(0, state.score + obj.data.score);
        state.water = clamp(state.water + obj.data.water, 0, 100);
        state.hearts = Math.max(0, state.hearts + obj.data.heart);
        state.badHit += 1;
        state.combo = 0;
        splash('โอ๊ะ!', c.x, c.y, 'bad');
        setCoach('ระวังของไม่ดีด้วยนะ!');
      }
    }
    else if(obj.kind === 'shield'){
      state.score += obj.data.score;
      state.water = clamp(state.water + obj.data.water, 0, 100);
      state.shield += 1;
      state.collectedShield += 1;
      splash('+Shield', c.x, c.y, 'shield');
      setCoach('ดีมาก! ตอนนี้มีโล่ไว้กันอันตรายแล้ว');
    }
    else if(obj.kind === 'boss'){
      state.score += obj.data.score;
      state.water = clamp(state.water + obj.data.water, 0, 100);
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.bossHits += 1;
      splash(`Boss +${obj.data.score}`, c.x, c.y, 'boss');
      setCoach('สุดยอด! โจมตีบอสได้แล้ว');
    }

    logEvent('hit', {
      id: obj.id,
      kind: obj.kind,
      score: state.score,
      water: state.water,
      hearts: state.hearts,
      shield: state.shield,
      combo: state.combo
    });

    removeTarget(obj);
    updateHud();
  }

  function missTarget(obj){
    if(obj.kind === 'good'){
      state.missedGood += 1;
      state.combo = 0;
      if(state.water > 5){
        state.water = clamp(state.water - 1, 0, 100);
      }
    }
    else if(obj.kind === 'boss'){
      state.combo = 0;
    }

    logEvent('miss', {
      id: obj.id,
      kind: obj.kind,
      score: state.score,
      water: state.water,
      hearts: state.hearts,
      shield: state.shield,
      combo: state.combo
    });

    removeTarget(obj);
  }

  function updateObjects(dt){
    for(let i=state.objects.length-1;i>=0;i--){
      const obj = state.objects[i];
      if(!obj.alive){
        state.objects.splice(i,1);
        continue;
      }

      obj.y += obj.speed * dt;
      obj.x += obj.drift * dt;

      if(obj.x < 4) obj.x = 4;
      if(obj.x > state.stageW - obj.size - 4) obj.x = state.stageW - obj.size - 4;

      obj.el.style.left = `${obj.x}px`;
      obj.el.style.top = `${obj.y}px`;

      if(obj.y > state.stageH + obj.size + 10){
        missTarget(obj);
        state.objects.splice(i,1);
      }
    }
  }

  function spawnTick(dt){
    state.spawnTimer += dt * 1000;
    let spawnGap = CFG.spawnMs;
    if(state.storm) spawnGap *= 0.82;
    if(state.boss)  spawnGap *= 0.76;

    while(state.spawnTimer >= spawnGap){
      state.spawnTimer -= spawnGap;
      makeTarget(chooseByWeight());
    }

    if(state.boss){
      state.bossTimer += dt * 1000;
      if(state.bossTimer >= 2200){
        state.bossTimer = 0;
        makeTarget('boss');
      }
    }
  }

  function maybePhaseChange(){
    const stormAt = TIME * 0.62;
    const bossAt  = TIME * 0.38;

    if(!state.storm && state.timeLeft <= stormAt){
      state.storm = true;
      showBanner(EL.stormBanner, 1600);
      setCoach('Storm Phase! ของจะมาเร็วขึ้นแล้วนะ');
      logEvent('phase', { phase:'storm' });
    }

    if(!state.boss && state.timeLeft <= bossAt && state.water >= CFG.bossNeedWater){
      state.boss = true;
      showBanner(EL.bossBanner, 1800);
      setCoach('Boss Phase! รีบเก็บแต้มช่วงท้ายเลย');
      logEvent('phase', { phase:'boss' });
    }
  }

  function gradeSummary(){
    let stars = 1;
    const perf = (
      (state.score >= 150 ? 1 : 0) +
      (state.water >= 60 ? 1 : 0) +
      (state.hearts >= 5 ? 1 : 0)
    );
    stars = Math.max(1, perf);

    let title = 'Good Job!';
    let msg = 'Well done! ดื่มน้ำให้พอดีและเลือกสิ่งที่ดีต่อร่างกายนะ';

    if(stars === 3){
      title = 'Great Job!';
      msg = 'ยอดเยี่ยมมาก! เก็บน้ำดีได้ดีมาก หลบของไม่ดีเก่ง และรักษาพลังได้ดี';
    }else if(stars === 2){
      title = 'Nice Try!';
      msg = 'ทำได้ดีเลย! รอบหน้าลองเก็บน้ำดีต่อเนื่องมากขึ้น แล้วหลบของไม่ดีให้แม่นขึ้นอีกนิด';
    }else{
      title = 'Keep Going!';
      msg = 'เริ่มต้นได้ดีแล้ว ลองโฟกัสแตะน้ำดีและเก็บโล่ให้มากขึ้นในรอบต่อไป';
    }

    return { stars, title, msg };
  }

  function saveSummary(payload){
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
      const arr = JSON.parse(localStorage.getItem('HHA_SUMMARY_HISTORY') || '[]');
      arr.unshift(payload);
      localStorage.setItem('HHA_SUMMARY_HISTORY', JSON.stringify(arr.slice(0,20)));
    }catch{}
  }

  function buildCooldownOrHubUrl(){
    if(!COOLDOWN) return HUB;

    const cd = new URL('../cooldown-gate.html', location.href);
    cd.searchParams.set('game', 'hydration');
    cd.searchParams.set('zone', q('zone', 'nutrition'));
    cd.searchParams.set('cat', q('cat', q('zone', 'nutrition')));
    cd.searchParams.set('hub', HUB);
    cd.searchParams.set('pid', PID);
    cd.searchParams.set('nick', NICK);
    cd.searchParams.set('nextAfterCooldown', HUB);
    cd.searchParams.set('seed', SEED);
    cd.searchParams.set('diff', DIFF);
    cd.searchParams.set('view', VIEW);
    cd.searchParams.set('time', String(TIME));
    cd.searchParams.set('sessionId', SESSION_ID);
    return cd.href;
  }

  function endGame(reason){
    if(state.ended) return;
    state.ended = true;
    state.started = false;

    for(const obj of state.objects.slice()){
      removeTarget(obj);
    }
    state.objects.length = 0;

    const judged = gradeSummary();
    const coins = Math.max(10, Math.round(state.score / 4));

    const summary = {
      game:'hydration',
      pid:PID,
      nick:NICK,
      diff:DIFF,
      view:VIEW,
      time:TIME,
      sessionId:SESSION_ID,
      seed:SEED,
      score:Math.max(0, Math.round(state.score)),
      water:clamp(state.water,0,100),
      hearts:Math.max(0, state.hearts),
      comboBest:state.bestCombo,
      goodCaught:state.goodCaught,
      badHit:state.badHit,
      missedGood:state.missedGood,
      shield:state.collectedShield,
      bossHits:state.bossHits,
      stars:judged.stars,
      reason,
      run:RUN,
      ts:new Date().toISOString()
    };

    saveSummary(summary);
    logEvent('end', { reason, ...summary });

    EL.summaryRibbon.textContent = judged.title;
    EL.summaryStars.textContent = '⭐'.repeat(judged.stars) + '☆'.repeat(3 - judged.stars);
    EL.summaryScore.textContent = String(summary.score);
    EL.summaryCoins.textContent = String(coins);
    EL.summaryWater.textContent = `${summary.water}%`;
    EL.summaryBestCombo.textContent = String(summary.comboBest);
    EL.summaryMsg.textContent = judged.msg;
    EL.summaryOverlay.classList.add('open');
    EL.summaryOverlay.setAttribute('aria-hidden', 'false');

    setCoach(judged.msg);
    postToWrapper({ type:'hha:setStatus', text: `${judged.title} Score ${summary.score}` });
  }

  function gameLoop(t){
    if(!state.started || state.ended) return;

    if(!state.lastMs) state.lastMs = t;
    const dt = Math.min(0.035, Math.max(0.001, (t - state.lastMs) / 1000));
    state.lastMs = t;

    state.timeLeft = Math.max(0, state.timeLeft - dt);

    maybePhaseChange();
    spawnTick(dt);
    updateObjects(dt);
    updateHud();

    if(state.hearts <= 0){
      endGame('no-hearts');
      return;
    }

    if(state.timeLeft <= 0){
      endGame('time-up');
      return;
    }

    requestAnimationFrame(gameLoop);
  }

  function startGame(){
    state.started = true;
    state.ended = false;
    state.lastMs = 0;
    setCoach('เริ่มเลย! แตะน้ำดีให้ไว แล้วหลบของไม่ดีนะ');
    logEvent('start', { sessionId: SESSION_ID });
    requestAnimationFrame(gameLoop);
  }

  function countdownStart(){
    let n = 3;
    const bubbleText =
      DIFF === 'hard'
        ? 'รอบนี้ไวขึ้นนะ! เตรียมแตะน้ำดีให้ทัน'
        : DIFF === 'easy'
          ? 'เริ่มแบบสบาย ๆ ค่อย ๆ เก็บน้ำดีไปด้วยกัน'
          : 'พร้อมไหม! เริ่มเก็บน้ำดีและหลบของไม่ดีกันเลย';

    EL.countBubble.textContent = bubbleText;
    EL.countNum.textContent = String(n);
    EL.countdown.classList.remove('hide');

    const timer = setInterval(()=>{
      n -= 1;
      if(n > 0){
        EL.countNum.textContent = String(n);
      }else if(n === 0){
        EL.countNum.textContent = 'Go!';
      }else{
        clearInterval(timer);
        EL.countdown.classList.add('hide');
        startGame();
      }
    }, 700);
  }

  function replay(){
    postToWrapper({ type:'hha:reload' });
    const url = new URL(location.href);
    url.searchParams.set('seed', String(Date.now()));
    url.searchParams.set('sessionId', `hydr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`);
    location.href = url.href;
  }

  function backHub(){
    postToWrapper({ type:'hha:goHub' });
    location.href = buildCooldownOrHubUrl();
  }

  function openHelp(){
    EL.helpBackdrop.classList.add('open');
    EL.helpBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeHelp(){
    EL.helpBackdrop.classList.remove('open');
    EL.helpBackdrop.setAttribute('aria-hidden', 'true');
  }

  function initFloatingDeco(){
    for(let i=0;i<8;i++){
      const b = document.createElement('div');
      const s = randInt(12, 34);
      b.style.position = 'absolute';
      b.style.left = `${randFloat(2, 92)}%`;
      b.style.top = `${randFloat(12, 72)}%`;
      b.style.width = `${s}px`;
      b.style.height = `${s}px`;
      b.style.borderRadius = '999px';
      b.style.background = 'rgba(255,255,255,.26)';
      b.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.42)';
      b.style.zIndex = '1';
      EL.bossLayer.appendChild(b);
    }
  }

  function init(){
    updateMeta();
    refreshStageSize();
    initFloatingDeco();
    updateHud();

    if(DIFF === 'easy'){
      setCoach('เริ่มแบบง่าย ๆ ก่อนนะ ค่อย ๆ เก็บน้ำดีไปด้วยกัน');
    }else if(DIFF === 'hard'){
      setCoach('รอบนี้ท้าทายขึ้นนะ! ต้องไวและแม่นกว่าเดิม');
    }else{
      setCoach('แตะน้ำดีให้ไว แล้วหลบของไม่ดีนะ!');
    }

    window.addEventListener('resize', refreshStageSize);
    EL.helpBtn.addEventListener('click', openHelp);
    EL.closeHelpBtn.addEventListener('click', closeHelp);
    EL.helpBackdrop.addEventListener('click', (e)=>{
      if(e.target === EL.helpBackdrop) closeHelp();
    });
    EL.replayBtn.addEventListener('click', replay);
    EL.backHubBtn.addEventListener('click', backHub);

    postToWrapper({ type:'hha:ready' });
    countdownStart();
  }

  init();
})();