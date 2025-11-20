// === Shadow Breaker — engine.js (VR Fitness Production) ===
'use strict';

// ---------- Helpers ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const FEVER_DURATION_MS = 4000;
const MAX_LIVE_TARGETS  = 6;

function clamp(v, min, max){
  return v < min ? min : (v > max ? max : v);
}

// ---------- Boss & Diff Config ----------
const BOSSES = [
  {
    id: 1,
    name: 'Bubble Glove',
    title: 'บอสมือใหม่สายฟอง',
    desc:  'บอสอุ่นเครื่อง เป้าใหญ่ เด้งช้า เหมาะสำหรับวอร์มอัพ 🔰',
    emoji: '🐣',
    hint:  'เริ่มร้อนเครื่อง ชกให้ชินก่อน! 💥',
    themeClass: 'theme-boss-1'
  },
  {
    id: 2,
    name: 'Neon Shadow',
    title: 'เงานีออนสายสปีด',
    desc:  'เป้าเริ่มเล็กลง เคลื่อนที่ไว ต้องโฟกัสดี ๆ ⚡',
    emoji: '👾',
    hint:  'เป้าเร็วขึ้นแล้ว อย่าชกพลาด! ⚡',
    themeClass: 'theme-boss-2'
  },
  {
    id: 3,
    name: 'Cyber Titan',
    title: 'ไททันไซเบอร์สุดโหด',
    desc:  'บอสถึกขึ้น เป้าหลอกเยอะ เน้นอ่านเกมและจังหวะ 🔥',
    emoji: '🤖',
    hint:  'เข้าโหมดจริงจังแล้วนะ สายตาต้องไว! 🔥',
    themeClass: 'theme-boss-3'
  },
  {
    id: 4,
    name: 'Final Eclipse',
    title: 'สุริยุปราคาท้ายเกม',
    desc:  'ดาเมจแรง เป้าเร็ว ใช้ FEVER ให้คุ้มแล้วกดจบให้ไว 🌑',
    emoji: '🌑',
    hint:  'บอสสุดท้าย! ตีไม่ยั้ง FEVER ให้สุด! 🌟',
    themeClass: 'theme-boss-4'
  }
];

const DIFF = {
  easy: {
    label: 'ง่าย',
    durationMs: 60000,
    spawnBaseMs: 900,
    targetLifeMs: 1100,
    bossHP: [45, 60, 70, 80],
    dmgPerHit: 4,
    scoreHit: 10,
    scoreDecoy: -18,
    hpLossOnMiss: 4,
    hpLossOnDecoy: 7,
    targetScale: 1.20,
    decoyRate: 0.20,
    feverGainOnHit: 11,
    feverLossOnDecoy: 30
  },
  normal: {
    label: 'ปกติ',
    durationMs: 70000,
    spawnBaseMs: 780,
    targetLifeMs: 950,
    bossHP: [60, 80, 95, 110],
    dmgPerHit: 6,
    scoreHit: 12,
    scoreDecoy: -22,
    hpLossOnMiss: 5,
    hpLossOnDecoy: 9,
    targetScale: 1.0,
    decoyRate: 0.26,
    feverGainOnHit: 12,
    feverLossOnDecoy: 30
  },
  hard: {
    label: 'ยาก',
    durationMs: 80000,
    spawnBaseMs: 650,
    targetLifeMs: 820,
    bossHP: [75, 95, 110, 130],
    dmgPerHit: 7,
    scoreHit: 14,
    scoreDecoy: -25,
    hpLossOnMiss: 6,
    hpLossOnDecoy: 11,
    targetScale: 0.85,
    decoyRate: 0.30,
    feverGainOnHit: 13,
    feverLossOnDecoy: 30
  }
};

// ---------- Global game state ----------
const game = {
  mode: 'normal',     // 'normal' | 'research'
  diffKey: 'normal',

  participantId: '',
  participantGroup: '',
  participantNote: '',

  running: false,
  startTime: 0,
  durationMs: 60000,
  rafTimer: 0,
  spawnTimer: 0,

  bossIndex: 0,
  bossHPMax: 100,
  bossHP: 100,

  playerHP: 100,

  feverGauge: 0,
  feverActive: false,
  feverTimeout: 0,

  score: 0,
  combo: 0,
  maxCombo: 0,
  hits: 0,
  perfectHits: 0,
  misses: 0,
  decoyHits: 0,
  normalRTs: [],
  decoyRTs: [],

  nextTargetId: 1,
  liveTargets: new Map(),

  csvRows: [],
  csvUrl: '',

  rounds: 0,   // ใช้นับจำนวนรอบเพื่อสรุปใน hub

  els: {}
};

// ---------- View switch ----------
function showView(name){
  const views = {
    menu: $('#view-menu'),
    research: $('#view-research-form'),
    play: $('#view-play'),
    result: $('#view-result')
  };
  Object.values(views).forEach(v => v && v.classList.add('hidden'));
  if(views[name]) views[name].classList.remove('hidden');
}

// ---------- DOM cache ----------
function cacheDom(){
  game.els = {
    difficulty: $('#difficulty'),

    statMode: $('#stat-mode'),
    statDiff: $('#stat-diff'),
    statScore: $('#stat-score'),
    statHP: $('#stat-hp'),
    statCombo: $('#stat-combo'),
    statPerfect: $('#stat-perfect'),
    statMiss: $('#stat-miss'),
    statTime: $('#stat-time'),

    targetLayer: $('#target-layer'),
    playArea: document.querySelector('.play-area'),

    feverFill: $('#fever-fill'),
    feverStatus: $('#fever-status'),

    bossName: $('#boss-name'),
    bossFill: $('#boss-fill'),
    bossPortrait: $('#boss-portrait'),
    bossPortraitEmoji: $('#boss-portrait-emoji'),
    bossPortraitName: $('#boss-portrait-name'),
    bossPortraitHint: $('#boss-portrait-hint'),

    coachBubble: $('#coach-bubble'),
    coachRole: $('#coach-role'),
    coachText: $('#coach-text'),
    coachAvatar: $('#coach-avatar'),

    researchId: $('#research-id'),
    researchGroup: $('#research-group'),
    researchNote: $('#research-note'),

    resMode: $('#res-mode'),
    resDiff: $('#res-diff'),
    resEndreason: $('#res-endreason'),
    resScore: $('#res-score'),
    resMaxcombo: $('#res-maxcombo'),
    resMiss: $('#res-miss'),
    resAccuracy: $('#res-accuracy'),
    resTotalhits: $('#res-totalhits'),
    resRTNormal: $('#res-rt-normal'),
    resRTDecoy: $('#res-rt-decoy'),
    resParticipant: $('#res-participant')
  };
}

// ---------- HUD / Coach ----------
function updateHUD(){
  const e = game.els;
  if(!e.statScore) return;
  e.statScore.textContent   = game.score.toString();
  e.statCombo.textContent   = game.combo.toString();
  e.statPerfect.textContent = game.perfectHits.toString();
  e.statMiss.textContent    = game.misses.toString();
  e.statHP.textContent      = game.playerHP.toString();
}

function updateBossHUD(){
  if (game.bossIndex < 0 || game.bossIndex >= BOSSES.length) {
    game.bossIndex = 0;
  }
  const boss = BOSSES[game.bossIndex];
  const ratio = clamp(game.bossHP / game.bossHPMax, 0, 1);

  if (game.els.bossFill) {
    game.els.bossFill.style.width = (ratio * 100).toFixed(1) + '%';
  }
  if (game.els.bossName) {
    game.els.bossName.textContent =
      `${boss.name} (${game.bossIndex + 1}/${BOSSES.length})`;
  }
  if (game.els.bossPortraitEmoji) game.els.bossPortraitEmoji.textContent = boss.emoji;
  if (game.els.bossPortraitName)  game.els.bossPortraitName.textContent  = boss.name;
  if (game.els.bossPortraitHint)  game.els.bossPortraitHint.textContent  = boss.hint;

  const introEmoji = document.getElementById('boss-intro-emoji');
  const introName  = document.getElementById('boss-intro-name');
  const introTitle = document.getElementById('boss-intro-title');
  const introDesc  = document.getElementById('boss-intro-desc');
  if (introEmoji) introEmoji.textContent = boss.emoji;
  if (introName)  introName.textContent  = boss.name;
  if (introTitle) introTitle.textContent = boss.title || '';
  if (introDesc)  introDesc.textContent  = boss.desc  || '';

  document.body.classList.remove(
    'theme-boss-1','theme-boss-2','theme-boss-3','theme-boss-4','boss-lowhp','boss-final'
  );
  document.body.classList.add(boss.themeClass);
  if (boss.id === 4) {
    document.body.classList.add('boss-final');
  }
  if (ratio <= 0.25) {
    document.body.classList.add('boss-lowhp');
  }
}

function updateFeverHUD(){
  const ratio = clamp(game.feverGauge / 100, 0, 1);
  if(game.els.feverFill){
    game.els.feverFill.style.width = (ratio * 100).toFixed(1) + '%';
  }
  const wrap = game.els.feverFill && game.els.feverFill.closest('.fever-wrap');
  if(wrap){
    if(game.feverActive) wrap.classList.add('fever-active');
    else wrap.classList.remove('fever-active');
  }
  if(game.els.feverStatus){
    game.els.feverStatus.textContent = game.feverActive ? 'FEVER ON!' : 'FEVER';
  }
}

function setCoach(text, emoji){
  if(game.els.coachText)   game.els.coachText.textContent = text;
  if(game.els.coachAvatar) game.els.coachAvatar.textContent = emoji || '🥊';
}

function playSfx(id){
  const el = document.getElementById(id);
  if(!el || !el.play) return;
  try{
    el.currentTime = 0;
    el.play();
  }catch(e){}
}

function screenShake(){
  const pa = game.els.playArea;
  if(!pa) return;
  pa.classList.remove('screen-shake');
  void pa.offsetWidth;
  pa.classList.add('screen-shake');
}

// ---------- FX (Hit & Score) ----------
function spawnHitEffectAtScreen(x, y, type, scoreText){
  const burst = document.createElement('div');
  burst.className = 'hit-fx';
  burst.style.left = x + 'px';
  burst.style.top  = y + 'px';
  document.body.appendChild(burst);
  setTimeout(() => {
    if(burst && burst.parentNode) burst.parentNode.removeChild(burst);
  }, 320);

  if(scoreText){
    const lab = document.createElement('div');
    lab.className = 'score-fx';
    if(type === 'perfect') lab.classList.add('score-fx-perfect');
    else if(type === 'good') lab.classList.add('score-fx-good');
    else if(type === 'bad') lab.classList.add('score-fx-bad');
    else if(type === 'miss') lab.classList.add('score-fx-miss');

    lab.textContent = scoreText;
    lab.style.left = x + 'px';
    lab.style.top  = y + 'px';
    document.body.appendChild(lab);
    setTimeout(() => {
      if(lab && lab.parentNode) lab.parentNode.removeChild(lab);
    }, 700);
  }
}

function spawnHitEffectAtElement(el, type, scoreText){
  if(!el) return;
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;
  spawnHitEffectAtScreen(cx, cy, type, scoreText);
}

// ---------- Boss intro overlay ----------
function showBossIntro(next, opts){
  opts = opts || {};
  const autoMs = opts.autoMs || 2000;
  const labelText = opts.label || 'BOSS APPEARS';

  const intro = $('#boss-intro');
  if(!intro){
    next && next();
    return;
  }

  const boss = BOSSES[game.bossIndex];
  const emoji = $('#boss-intro-emoji');
  const name  = $('#boss-intro-name');
  const title = $('#boss-intro-title');
  const desc  = $('#boss-intro-desc');
  const label = intro.querySelector('.boss-intro-label');

  if(emoji) emoji.textContent = boss.emoji;
  if(name)  name.textContent  = boss.name;
  if(title) title.textContent = boss.title || '';
  if(desc)  desc.textContent  = boss.desc  || '';
  if(label) label.textContent = labelText;

  intro.classList.remove('hidden');
  requestAnimationFrame(() => intro.classList.add('boss-intro-show'));

  let closed = false;
  function closeIntro(){
    if(closed) return;
    closed = true;
    intro.classList.remove('boss-intro-show');
    setTimeout(() => intro.classList.add('hidden'), 250);
    next && next();
  }

  intro.addEventListener('click', closeIntro, { once: true });
  setTimeout(closeIntro, autoMs);
}

// ---------- Game lifecycle ----------
function resetGameState(){
  const cfg = DIFF[game.diffKey] || DIFF.normal;

  game.durationMs = cfg.durationMs;
  game.running = false;
  cancelAnimationFrame(game.rafTimer);
  clearTimeout(game.spawnTimer);
  clearTimeout(game.feverTimeout);

  game.bossIndex = 0;
  game.bossHPMax = cfg.bossHP[0];
  game.bossHP = game.bossHPMax;
  game.playerHP = 100;

  game.score = 0;
  game.combo = 0;
  game.maxCombo = 0;
  game.hits = 0;
  game.perfectHits = 0;
  game.misses = 0;
  game.decoyHits = 0;
  game.normalRTs = [];
  game.decoyRTs = [];

  game.feverGauge = 0;
  game.feverActive = false;

  game.nextTargetId = 1;
  game.liveTargets.forEach(obj => {
    clearTimeout(obj.lifeTimer);
    if(obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
  });
  game.liveTargets.clear();

  game.csvRows = [];
  if(game.csvUrl){
    URL.revokeObjectURL(game.csvUrl);
    game.csvUrl = '';
  }

  if(game.els.statMode)
    game.els.statMode.textContent = (game.mode === 'research') ? 'วิจัย' : 'ปกติ';
  if(game.els.statDiff){
    const cfgLabel = DIFF[game.diffKey] ? DIFF[game.diffKey].label : 'ปกติ';
    game.els.statDiff.textContent = cfgLabel;
  }
  if(game.els.statTime){
    game.els.statTime.textContent = (game.durationMs / 1000).toFixed(1);
  }

  document.body.classList.remove('fever-mode','boss-lowhp','boss-final',
    'theme-boss-1','theme-boss-2','theme-boss-3','theme-boss-4');

  updateBossHUD();
  updateFeverHUD();
  updateHUD();
  setCoach('พร้อมลุย Shadow Breaker แล้ว! ชกเป้าให้ทันนะ 🥊', '🥊');
}

function startGame(){
  resetGameState();
  showView('play');
  game.running = true;
  game.startTime = performance.now();
  game.rounds++;

  function beginCountdown(){
    setCoach('3... 2... 1... ชก! 💥', '⏱');
    let countdown = 3;
    const countdownTimer = setInterval(() => {
      countdown--;
      if(countdown <= 0){
        clearInterval(countdownTimer);
        if(!game.running) return;
        setCoach('ชกเป้าหลัก เลี่ยงเป้าหลอก! ✨', '🥊');
        scheduleNextSpawn();
      } else {
        setCoach(countdown + '...', '⏱');
      }
    }, 500);

    scheduleTimerTick();
  }

  showBossIntro(beginCountdown, {
    autoMs: 2000,
    label: 'BOSS APPEARS'
  });
}

function endGame(reason){
  if(!game.running) return;
  game.running = false;

  cancelAnimationFrame(game.rafTimer);
  clearTimeout(game.spawnTimer);
  clearTimeout(game.feverTimeout);

  game.liveTargets.forEach(obj => {
    clearTimeout(obj.lifeTimer);
    if(obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
  });
  game.liveTargets.clear();

  let reasonText = '';
  switch(reason){
    case 'timeup':        reasonText = 'หมดเวลา'; break;
    case 'hpzero':        reasonText = 'พลังผู้เล่นหมด'; break;
    case 'bossdefeated':  reasonText = 'ปราบบอสครบทุกตัว'; break;
    case 'stopped':       reasonText = 'หยุดก่อนเวลา'; break;
    case 'hidden':        reasonText = 'แท็บ/หน้าจอถูกซ่อน'; break;
    default:              reasonText = 'จบเกม'; break;
  }

  const totalShots = game.hits + game.misses + game.decoyHits;
  const accuracy = totalShots > 0 ? (game.hits / totalShots * 100) : 0;

  const avg = (arr) => {
    if(!arr.length) return null;
    return arr.reduce((a,b)=>a+b,0) / arr.length;
  };
  const avgNormal = avg(game.normalRTs);
  const avgDecoy  = avg(game.decoyRTs);

  if(game.els.resMode)
    game.els.resMode.textContent = (game.mode === 'research') ? 'วิจัย' : 'ปกติ';
  if(game.els.resDiff)
    game.els.resDiff.textContent = DIFF[game.diffKey] ? DIFF[game.diffKey].label : '-';
  if(game.els.resEndreason)
    game.els.resEndreason.textContent = reasonText;

  if(game.els.resScore)     game.els.resScore.textContent     = game.score.toString();
  if(game.els.resMaxcombo)  game.els.resMaxcombo.textContent  = game.maxCombo.toString();
  if(game.els.resMiss)      game.els.resMiss.textContent      = game.misses.toString();
  if(game.els.resTotalhits) game.els.resTotalhits.textContent = game.hits.toString();
  if(game.els.resAccuracy)
    game.els.resAccuracy.textContent = totalShots ? `${accuracy.toFixed(1)}%` : '-';
  if(game.els.resRTNormal)
    game.els.resRTNormal.textContent = avgNormal != null ? `${avgNormal.toFixed(0)} ms` : '-';
  if(game.els.resRTDecoy)
    game.els.resRTDecoy.textContent  = avgDecoy  != null ? `${avgDecoy.toFixed(0)} ms` : '-';
  if(game.els.resParticipant)
    game.els.resParticipant.textContent =
      game.mode === 'research' ? (game.participantId || '-') : '-';

  if(game.mode === 'research'){
    buildCSV(reasonText, accuracy, avgNormal, avgDecoy);
  }

  saveSummaryRecord(accuracy);

  document.body.classList.remove('fever-mode');
  setCoach('ดีมาก! ดูสรุปผลด้านล่าง แล้วเลือกเล่นอีกครั้งหรือกลับ Hub ได้เลย ✨', '✅');
  showView('result');
}

// ---------- Timer ----------
function scheduleTimerTick(){
  const tick = () => {
    if(!game.running) return;
    const now = performance.now();
    const t = now - game.startTime;
    const left = Math.max(0, game.durationMs - t);
    if(game.els.statTime){
      game.els.statTime.textContent = (left / 1000).toFixed(1);
    }
    if(left <= 0){
      endGame('timeup');
      return;
    }
    game.rafTimer = requestAnimationFrame(tick);
  };
  game.rafTimer = requestAnimationFrame(tick);
}

// ---------- Spawn / Hit ----------
function scheduleNextSpawn(){
  if(!game.running) return;
  const cfg = DIFF[game.diffKey] || DIFF.normal;

  const hpRatio = clamp(game.bossHP / game.bossHPMax, 0, 1);
  let factor = 1;
  if(hpRatio <= 0.25) factor = 0.6;
  else if(hpRatio <= 0.5) factor = 0.8;
  if(game.feverActive) factor *= 0.8;

  const interval = Math.max(250, cfg.spawnBaseMs * factor);

  game.spawnTimer = setTimeout(() => {
    spawnTarget();
    scheduleNextSpawn();
  }, interval);
}

function spawnTarget(){
  if(!game.running) return;
  if(game.liveTargets.size >= MAX_LIVE_TARGETS) return;

  const layer = game.els.targetLayer;
  if(!layer) return;

  const cfg = DIFF[game.diffKey] || DIFF.normal;

  const id = game.nextTargetId++;
  const el = document.createElement('div');
  el.className = 'target';

  const r = Math.random();
  let kind = 'normal';
  if(r < cfg.decoyRate){
    kind = 'decoy';
    el.classList.add('target-decoy');
  } else if(r > 0.9){
    kind = 'gold';
    el.classList.add('target-gold');
  }

  let emoji = '🎯';
  if(kind === 'decoy'){
    emoji = '💣';
  } else if(kind === 'gold'){
    emoji = '⭐';
  } else {
    const boss = BOSSES[game.bossIndex];
    const hpRatio = clamp(game.bossHP / game.bossHPMax, 0, 1);
    let pool = ['🥊','💥','⚡','🔥'];
    if(hpRatio <= 0.3){
      pool.push(boss.emoji, boss.emoji);
    }
    emoji = pool[Math.floor(Math.random() * pool.length)];
  }
  el.textContent = emoji;

  const scale = cfg.targetScale;
  el.style.transform = `translate(-50%, -50%) scale(${scale})`;

  const rect = layer.getBoundingClientRect();
  const pad = 10;
  const x = pad + Math.random() * (rect.width  - pad*2);
  const y = pad + Math.random() * (rect.height - pad*2);
  el.style.left = (x / rect.width * 100).toFixed(2) + '%';
  el.style.top  = (y / rect.height * 100).toFixed(2) + '%';

  const now = performance.now();
  const lifeTimer = setTimeout(() => {
    if(game.liveTargets.has(id)){
      const obj = game.liveTargets.get(id);
      game.liveTargets.delete(id);

      if(obj.kind === 'normal' || obj.kind === 'gold'){
        spawnHitEffectAtElement(obj.el, 'miss', 'MISS');

        game.misses++;
        game.combo = 0;
        const cfg2 = DIFF[game.diffKey] || DIFF.normal;
        game.playerHP = clamp(game.playerHP - cfg2.hpLossOnMiss, 0, 100);
        setCoach('พลาดเป้าไป 1 ครั้ง ระวัง miss บ่อยนะ 😅', '⚠️');
        if(game.playerHP <= 0){
          updateHUD();
          updateBossHUD();
          if(obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
          endGame('hpzero');
          return;
        }
        updateHUD();
      }

      if(obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
    }
  }, cfg.targetLifeMs);

  const targetObj = { id, el, kind, spawnTime: now, lifeTimer };
  el.dataset.id = String(id);
  el.dataset.kind = kind;

  if(kind === 'normal'){
    const boss = BOSSES[game.bossIndex];
    const hpRatio = clamp(game.bossHP / game.bossHPMax, 0, 1);
    if(hpRatio <= 0.3 && emoji === boss.emoji){
      el.classList.add('target-boss-face');
    }
  }

  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    handleHit(id);
  });

  layer.appendChild(el);
  game.liveTargets.set(id, targetObj);
}

function handleHit(id){
  if(!game.running) return;
  const obj = game.liveTargets.get(id);
  if(!obj) return;

  const now = performance.now();
  clearTimeout(obj.lifeTimer);
  game.liveTargets.delete(id);

  const cfg = DIFF[game.diffKey] || DIFF.normal;
  const lifeMs = cfg.targetLifeMs;
  const dt = now - obj.spawnTime;
  const isPerfect = dt <= lifeMs * 0.4;

  let scoreDelta = 0;

  if(obj.kind === 'decoy'){
    game.decoyHits++;
    game.combo = 0;
    game.playerHP = clamp(game.playerHP - cfg.hpLossOnDecoy, 0, 100);
    scoreDelta = cfg.scoreDecoy;
    game.feverGauge = clamp(game.feverGauge - cfg.feverLossOnDecoy, 0, 100);
    game.decoyRTs.push(dt);

    spawnHitEffectAtElement(obj.el, 'bad', String(scoreDelta));

    setCoach('อันนั้นเป้าหลอก! เล็ง emoji หลักเท่านั้นนะ 💣', '💣');
  } else {
    game.hits++;
    game.combo++;
    if(game.combo > game.maxCombo) game.maxCombo = game.combo;
    if(isPerfect) game.perfectHits++;

    const feverMult = game.feverActive ? 2 : 1;
    scoreDelta = cfg.scoreHit * feverMult;
    game.feverGauge = clamp(game.feverGauge + cfg.feverGainOnHit, 0, 120);
    game.normalRTs.push(dt);

    const dmg = cfg.dmgPerHit * feverMult;
    game.bossHP = clamp(game.bossHP - dmg, 0, game.bossHPMax);

    let typeLabel, labelText;
    if(isPerfect){
      typeLabel = 'perfect';
      labelText = 'PERFECT +' + scoreDelta;
    }else{
      typeLabel = 'good';
      labelText = '+' + scoreDelta;
    }
    spawnHitEffectAtElement(obj.el, typeLabel, labelText);

    playSfx('sfx-hit');
    screenShake();

    if(game.bossHP <= 0){
      handleBossDefeated();
    }else{
      setCoach('ดีมาก! คอมโบต่อเนื่องแบบนี้แหละ 💥', '🔥');
    }

    if(!game.feverActive && game.feverGauge >= 100){
      activateFever();
    }
  }

  game.score += scoreDelta;
  updateHUD();
  updateBossHUD();
  updateFeverHUD();

  if(game.mode === 'research'){
    game.csvRows.push({
      t: ((now - game.startTime)/1000).toFixed(3),
      kind: obj.kind,
      isDecoy: obj.kind === 'decoy' ? 1 : 0,
      isFever: game.feverActive ? 1 : 0,
      rtMs: Math.round(dt),
      perfect: isPerfect ? 1 : 0,
      combo: game.combo,
      scoreAfter: game.score,
      bossIndex: game.bossIndex + 1
    });
  }

  if(obj.el && obj.el.parentNode){
    obj.el.parentNode.removeChild(obj.el);
  }

  if(game.playerHP <= 0){
    endGame('hpzero');
  }
}

// ---------- Boss phase ----------
function handleBossDefeated(){
  const cfg = DIFF[game.diffKey] || DIFF.normal;

  clearTimeout(game.spawnTimer);
  game.liveTargets.forEach(obj => {
    clearTimeout(obj.lifeTimer);
    if(obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
  });
  game.liveTargets.clear();

  if (game.bossIndex < BOSSES.length - 1) {
    game.bossIndex++;

    if (cfg.bossHP && cfg.bossHP.length > game.bossIndex) {
      game.bossHPMax = cfg.bossHP[game.bossIndex];
    } else {
      game.bossHPMax = cfg.bossHP[cfg.bossHP.length - 1];
    }
    game.bossHP = game.bossHPMax;

    updateBossHUD();
    playSfx('sfx-boss');

    showBossIntro(() => {
      setCoach(`ลุยบอสตัวที่ ${game.bossIndex + 1} กันต่อ! 💥`, '⭐');
      if (game.running) {
        scheduleNextSpawn();
      }
    }, {
      autoMs: 1200,
      label: 'NEXT BOSS'
    });
  } else {
    playSfx('sfx-boss');
    endGame('bossdefeated');
  }
}

// ---------- FEVER ----------
function activateFever(){
  game.feverActive = true;
  game.feverGauge = 100;
  updateFeverHUD();
  setCoach('FEVER TIME! ชกให้รัว คะแนน x2 🔥', '🔥');

  document.body.classList.add('fever-mode');
  playSfx('sfx-fever');

  clearTimeout(game.feverTimeout);
  game.feverTimeout = setTimeout(() => {
    game.feverActive = false;
    game.feverGauge = clamp(game.feverGauge, 0, 100);
    updateFeverHUD();
    document.body.classList.remove('fever-mode');
    setCoach('FEVER จบแล้ว กลับมาชกจังหวะเนียน ๆ ต่อ ✨', '🥊');
  }, FEVER_DURATION_MS);
}

// ---------- CSV ----------
function buildCSV(reasonText, accuracy, avgNormal, avgDecoy){
  const cfg = DIFF[game.diffKey] || DIFF.normal;
  const lines = [];
  const now = new Date();

  lines.push('Shadow Breaker VR Fitness — Research Log');
  lines.push('Date,' + now.toISOString());
  lines.push('Mode,' + game.mode);
  lines.push('Difficulty,' + cfg.label);
  lines.push('ParticipantID,' + (game.participantId || ''));
  lines.push('Group,' + (game.participantGroup || ''));
  lines.push('Note,' + (game.participantNote || ''));
  lines.push('EndReason,' + reasonText);
  lines.push('Score,' + game.score);
  lines.push('MaxCombo,' + game.maxCombo);
  lines.push('Hits,' + game.hits);
  lines.push('Miss,' + game.misses);
  lines.push('DecoyHits,' + game.decoyHits);
  lines.push('Accuracy,' + accuracy.toFixed(2));
  lines.push('AvgRTNormal(ms),' + (avgNormal != null ? avgNormal.toFixed(2) : ''));
  lines.push('AvgRTDecoy(ms),' + (avgDecoy != null ? avgDecoy.toFixed(2) : ''));
  lines.push('');
  lines.push('t(sec),kind,isDecoy,isFever,rtMs,perfect,combo,scoreAfter,bossIndex');

  game.csvRows.forEach(r => {
    lines.push([
      r.t,
      r.kind,
      r.isDecoy,
      r.isFever,
      r.rtMs,
      r.perfect,
      r.combo,
      r.scoreAfter,
      r.bossIndex
    ].join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  if(game.csvUrl) URL.revokeObjectURL(game.csvUrl);
  game.csvUrl = URL.createObjectURL(blob);
}

// ---------- Summary for Hub ----------
function saveSummaryRecord(accuracy){
  try{
    const record = {
      mode: game.mode,
      diff: game.diffKey,
      score: game.score,
      maxCombo: game.maxCombo,
      miss: game.misses,
      hits: game.hits,
      acc: accuracy,
      rounds: game.rounds,
      updatedAt: new Date().toLocaleString('th-TH')
    };
    localStorage.setItem('vrfit_shadow_breaker', JSON.stringify(record));
  }catch(e){}
}

// ---------- UI actions ----------
function handleActionClick(e){
  const action = e.currentTarget.getAttribute('data-action');
  if(!action) return;

  switch(action){
    case 'start-research':
      game.mode = 'research';
      showView('research');
      break;

    case 'start-normal':
      game.mode = 'normal';
      game.diffKey = ($('#difficulty').value || 'normal');
      startGame();
      break;

    case 'research-begin-play':
      game.mode = 'research';
      game.diffKey = ($('#difficulty').value || 'normal');
      if(game.els.researchId)    game.participantId    = game.els.researchId.value.trim();
      if(game.els.researchGroup) game.participantGroup = game.els.researchGroup.value.trim();
      if(game.els.researchNote)  game.participantNote  = game.els.researchNote.value.trim();
      startGame();
      break;

    case 'back-to-menu':
      game.running = false;
      showView('menu');
      break;

    case 'stop-early':
      if(game.running) endGame('stopped');
      break;

    case 'play-again':
      startGame();
      break;

    case 'download-csv':
      if(game.mode !== 'research'){
        alert('ปุ่ม CSV ใช้ได้เฉพาะโหมดวิจัย');
        return;
      }
      if(!game.csvUrl){
        alert('ยังไม่มีข้อมูล CSV สำหรับรอบนี้');
        return;
      }
      (function(){
        const a = document.createElement('a');
        a.href = game.csvUrl;
        const id = game.participantId || 'no-id';
        a.download = 'shadow-breaker_' +
          id + '_' +
          new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') +
          '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      })();
      break;
  }
}

// ---------- Init ----------
export function initShadowBreaker(){
  cacheDom();
  showView('menu');

  $$('.btn-row [data-action], [data-action]').forEach(btn => {
    btn.addEventListener('click', handleActionClick);
  });

  document.addEventListener('visibilitychange', () => {
    if(document.hidden && game.running){
      endGame('hidden');
    }
  });

  resetGameState();
}