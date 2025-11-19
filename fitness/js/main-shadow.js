// === Shadow Breaker — main-shadow.js (Production-ready pattern) ===
'use strict';

// ---------- Helper ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

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

// ---------- Config ----------

// บอส 4 ตัว + ธีมพื้นหลัง
const BOSSES = [
  {
    id: 1,
    name: 'Bubble Glove',
    emoji: '🐣',
    hint: 'เริ่มร้อนเครื่อง ชกให้ชินก่อน! 💥',
    themeClass: 'theme-boss-1'
  },
  {
    id: 2,
    name: 'Neon Shadow',
    emoji: '👾',
    hint: 'เป้าเร็วขึ้นแล้ว อย่าชกพลาด! ⚡',
    themeClass: 'theme-boss-2'
  },
  {
    id: 3,
    name: 'Cyber Titan',
    emoji: '🤖',
    hint: 'เข้าโหมดจริงจังแล้วนะ สายตาต้องไว! 🔥',
    themeClass: 'theme-boss-3'
  },
  {
    id: 4,
    name: 'Final Eclipse',
    emoji: '🌑',
    hint: 'บอสสุดท้าย! ตีไม่ยั้ง FEVER ให้สุด! 🌟',
    themeClass: 'theme-boss-4'
  }
];

// ระดับความยาก
const DIFF = {
  easy: {
    label: 'ง่าย',
    durationMs: 60000,
    spawnBaseMs: 900,
    targetLifeMs: 1100,
    bossHP: [60, 80, 100, 120],
    dmgPerHit: 3,
    scoreHit: 10,
    scoreDecoy: -15,
    hpLossOnMiss: 4,
    hpLossOnDecoy: 6,
    targetScale: 1.15,
    decoyRate: 0.22,
    feverGainOnHit: 10,
    feverLossOnDecoy: 20
  },
  normal: {
    label: 'ปกติ',
    durationMs: 70000,
    spawnBaseMs: 780,
    targetLifeMs: 950,
    bossHP: [80, 100, 120, 140],
    dmgPerHit: 4,
    scoreHit: 12,
    scoreDecoy: -18,
    hpLossOnMiss: 5,
    hpLossOnDecoy: 8,
    targetScale: 1.0,
    decoyRate: 0.26,
    feverGainOnHit: 12,
    feverLossOnDecoy: 22
  },
  hard: {
    label: 'ยาก',
    durationMs: 80000,
    spawnBaseMs: 650,
    targetLifeMs: 820,
    bossHP: [90, 120, 140, 160],
    dmgPerHit: 5,
    scoreHit: 14,
    scoreDecoy: -22,
    hpLossOnMiss: 6,
    hpLossOnDecoy: 10,
    targetScale: 0.85,
    decoyRate: 0.30,
    feverGainOnHit: 14,
    feverLossOnDecoy: 25
  }
};

// ---------- Global game state ----------

const game = {
  mode: 'normal',       // 'normal' | 'research'
  diffKey: 'normal',

  // research meta
  participantId: '',
  participantGroup: '',
  participantNote: '',

  // runtime state
  running: false,
  startTime: 0,
  durationMs: 60000,
  rafTimer: 0,
  spawnTimer: 0,

  // boss
  bossIndex: 0,
  bossHPMax: 100,
  bossHP: 100,

  // player
  playerHP: 100,

  // FEVER
  feverGauge: 0,       // 0–100
  feverActive: false,
  feverTimeout: 0,

  // stats
  score: 0,
  combo: 0,
  maxCombo: 0,
  hits: 0,
  perfectHits: 0,
  misses: 0,
  decoyHits: 0,
  normalRTs: [],
  decoyRTs: [],

  // target mgmt
  nextTargetId: 1,
  liveTargets: new Map(),   // id → { el, kind, spawnTime, lifeTimer }

  // csv log
  csvRows: [],
  csvUrl: '',

  // cached DOM
  els: {}
};

// ---------- DOM cache ----------

function cacheDom(){
  game.els = {
    difficulty: $('#difficulty'),

    // play HUD
    statMode: $('#stat-mode'),
    statDiff: $('#stat-diff'),
    statScore: $('#stat-score'),
    statHP: $('#stat-hp'),
    statCombo: $('#stat-combo'),
    statPerfect: $('#stat-perfect'),
    statMiss: $('#stat-miss'),
    statTime: $('#stat-time'),

    targetLayer: $('#target-layer'),
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

    // research input
    researchId: $('#research-id'),
    researchGroup: $('#research-group'),
    researchNote: $('#research-note'),

    // result
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

// ---------- Utilities ----------

function clamp(v,min,max){ return v < min ? min : v > max ? max : v; }

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
  const boss = BOSSES[game.bossIndex];
  const ratio = clamp(game.bossHP / game.bossHPMax, 0, 1);
  if(game.els.bossFill){
    game.els.bossFill.style.width = (ratio * 100).toFixed(1) + '%';
  }
  if(game.els.bossName){
    game.els.bossName.textContent = `${boss.name} (${game.bossIndex+1}/${BOSSES.length})`;
  }
  if(game.els.bossPortraitEmoji) game.els.bossPortraitEmoji.textContent = boss.emoji;
  if(game.els.bossPortraitName)  game.els.bossPortraitName.textContent  = boss.name;
  if(game.els.bossPortraitHint)  game.els.bossPortraitHint.textContent  = boss.hint;

  // เปลี่ยนธีมพื้นหลังของ body ตามบอส
  document.body.classList.remove(
    'theme-boss-1','theme-boss-2','theme-boss-3','theme-boss-4','boss-lowhp','boss-final'
  );
  document.body.classList.add(boss.themeClass);
  if(boss.id === 4){
    // บอสสุดท้าย ใส่ animation พิเศษเล็กน้อย
    document.body.classList.add('boss-final');
  }

  // ใกล้ตาย: portrait สั่น + background เน้น
  if(ratio <= 0.25){
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
    if(game.feverActive){
      wrap.classList.add('fever-active');
    } else {
      wrap.classList.remove('fever-active');
    }
  }
  if(game.els.feverStatus){
    game.els.feverStatus.textContent = game.feverActive ? 'FEVER ON!' : 'FEVER';
  }
}

function setCoach(text, emoji){
  if(game.els.coachText)   game.els.coachText.textContent = text;
  if(game.els.coachAvatar) game.els.coachAvatar.textContent = emoji || '🥊';
}

// ---------- Game control core ----------

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
  // ลบเป้าทั้งหมด
  game.liveTargets.forEach(obj => {
    clearTimeout(obj.lifeTimer);
    if(obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
  });
  game.liveTargets.clear();

  // csv log
  game.csvRows = [];
  if(game.csvUrl){
    URL.revokeObjectURL(game.csvUrl);
    game.csvUrl = '';
  }

  // HUD
  if(game.els.statMode) game.els.statMode.textContent = (game.mode === 'research') ? 'วิจัย' : 'ปกติ';
  if(game.els.statDiff){
    const cfgLabel = DIFF[game.diffKey] ? DIFF[game.diffKey].label : 'ปกติ';
    game.els.statDiff.textContent = cfgLabel;
  }

  if(game.els.statTime){
    game.els.statTime.textContent = (game.durationMs / 1000).toFixed(1);
  }

  updateBossHUD();
  updateFeverHUD();
  updateHUD();
  setCoach('พร้อมลุย Shadow Breaker แล้ว! ชกเป้าให้ทันนะ 🥊', '🥊');
}

function startGame(){
  const cfg = DIFF[game.diffKey] || DIFF.normal;
  resetGameState();

  showView('play');
  game.running = true;
  game.startTime = performance.now();

  // นับถอยหลังก่อนเริ่ม spawn
  setCoach('3... 2... 1... ชก! 💥', '⏱');
  let countdown = 3;
  const countdownTimer = setInterval(() => {
    countdown--;
    if(countdown <= 0){
      clearInterval(countdownTimer);
      if(!game.running) return;
      setCoach('ชกเป้าหลัก เลี่ยงเป้าหลอก! ✨', '🥊');
      scheduleNextSpawn();
    }else{
      setCoach(`${countdown}...`, '⏱');
    }
  }, 500);

  scheduleTimerTick();
}

function endGame(reason){
  if(!game.running) return;
  game.running = false;

  cancelAnimationFrame(game.rafTimer);
  clearTimeout(game.spawnTimer);
  clearTimeout(game.feverTimeout);

  // เคลียร์เป้า
  game.liveTargets.forEach(obj => {
    clearTimeout(obj.lifeTimer);
    if(obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
  });
  game.liveTargets.clear();

  // ปรับ reason ให้เป็นภาษาไทยอ่านง่าย
  let reasonText = '';
  switch(reason){
    case 'timeup':   reasonText = 'หมดเวลา'; break;
    case 'hpzero':   reasonText = 'พลังผู้เล่นหมด'; break;
    case 'bossdefeated': reasonText = 'ปราบบอสครบทุกตัว'; break;
    case 'stopped':  reasonText = 'หยุดก่อนเวลา'; break;
    case 'hidden':   reasonText = 'แท็บ/หน้าจอถูกซ่อน'; break;
    default:         reasonText = 'จบเกม'; break;
  }

  // สรุปผล
  const totalShots = game.hits + game.misses + game.decoyHits;
  const accuracy = totalShots > 0 ? (game.hits / totalShots * 100) : 0;

  const avg = (arr) => {
    if(!arr.length) return null;
    const s = arr.reduce((a,b) => a+b, 0);
    return s / arr.length;
  };

  const avgNormal = avg(game.normalRTs);
  const avgDecoy  = avg(game.decoyRTs);

  // fill result view
  if(game.els.resMode)      game.els.resMode.textContent = (game.mode === 'research') ? 'วิจัย' : 'ปกติ';
  if(game.els.resDiff)      game.els.resDiff.textContent = DIFF[game.diffKey] ? DIFF[game.diffKey].label : '-';
  if(game.els.resEndreason) game.els.resEndreason.textContent = reasonText;

  if(game.els.resScore)     game.els.resScore.textContent = game.score.toString();
  if(game.els.resMaxcombo)  game.els.resMaxcombo.textContent = game.maxCombo.toString();
  if(game.els.resMiss)      game.els.resMiss.textContent = game.misses.toString();
  if(game.els.resTotalhits) game.els.resTotalhits.textContent = game.hits.toString();
  if(game.els.resAccuracy)  game.els.resAccuracy.textContent =
    totalShots ? `${accuracy.toFixed(1)}%` : '-';

  if(game.els.resRTNormal)
    game.els.resRTNormal.textContent = avgNormal != null ? `${avgNormal.toFixed(0)} ms` : '-';
  if(game.els.resRTDecoy)
    game.els.resRTDecoy.textContent  = avgDecoy  != null ? `${avgDecoy.toFixed(0)} ms` : '-';

  if(game.els.resParticipant)
    game.els.resParticipant.textContent = game.mode === 'research' ? (game.participantId || '-') : '-';

  // สร้าง CSV (เฉพาะโหมดวิจัย)
  if(game.mode === 'research'){
    buildCSV(reasonText, accuracy, avgNormal, avgDecoy);
  }

  setCoach('ดีมาก! ลองดูสรุปผลด้านล่าง แล้วเลือกเล่นอีกครั้งหรือกลับเมนูได้เลย ✨', '✅');
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

// ---------- Spawn & Target logic ----------

function scheduleNextSpawn(){
  if(!game.running) return;
  const cfg = DIFF[game.diffKey] || DIFF.normal;

  // ปรับตาม HP บอส (ใกล้ตาย spawn เร็วขึ้น)
  const hpRatio = clamp(game.bossHP / game.bossHPMax, 0, 1);
  let factor = 1;
  if(hpRatio <= 0.25) factor = 0.6;      // ใกล้ตาย
  else if(hpRatio <= 0.5) factor = 0.8;  // HP กลางๆ

  // ถ้า FEVER เปิดอยู่ ก็เร็วขึ้นอีกนิด
  if(game.feverActive) factor *= 0.8;

  const interval = Math.max(250, cfg.spawnBaseMs * factor);

  game.spawnTimer = setTimeout(() => {
    spawnTarget();
    scheduleNextSpawn();
  }, interval);
}

function spawnTarget(){
  if(!game.running) return;
  const layer = game.els.targetLayer;
  if(!layer) return;

  const cfg = DIFF[game.diffKey] || DIFF.normal;

  const id = game.nextTargetId++;
  const el = document.createElement('div');
  el.className = 'target';

  // ชนิดเป้า: หลัก / หลอก / golden FEVER
  const r = Math.random();
  let kind = 'normal';
  if(r < cfg.decoyRate){
    kind = 'decoy';
    el.classList.add('target-decoy');
  } else if(r > 0.9){
    kind = 'gold';
    el.classList.add('target-gold');
  }

  // emoji
  let emoji = '🎯';
  if(kind === 'decoy') emoji = '💣';
  else if(kind === 'gold') emoji = '⭐';
  else {
    // เป้าหลัก เปลี่ยนตาม boss
    const boss = BOSSES[game.bossIndex];
    // ใช้ emoji บอส หรือหมัด
    emoji = ['🥊','💥','⚡','🔥'][Math.floor(Math.random()*4)] || boss.emoji;
  }
  el.textContent = emoji;

  // scale ตามระดับความยาก
  const scale = cfg.targetScale;
  el.style.transform = `translate(-50%, -50%) scale(${scale})`;

  // สุ่มตำแหน่ง
  const rect = layer.getBoundingClientRect();
  const pad = 10;
  const x = pad + Math.random() * (rect.width  - pad*2);
  const y = pad + Math.random() * (rect.height - pad*2);
  el.style.left = (x / rect.width * 100).toFixed(2) + '%';
  el.style.top  = (y / rect.height * 100).toFixed(2) + '%';

  const now = performance.now();

  const lifeTimer = setTimeout(() => {
    // ถ้ายังไม่โดนคลิก
    if(game.liveTargets.has(id)){
      const obj = game.liveTargets.get(id);
      game.liveTargets.delete(id);
      if(obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);

      if(obj.kind === 'normal' || obj.kind === 'gold'){
        game.misses++;
        game.combo = 0;
        const cfg = DIFF[game.diffKey] || DIFF.normal;
        game.playerHP = clamp(game.playerHP - cfg.hpLossOnMiss, 0, 100);
        setCoach('พลาดเป้าไป 1 ครั้ง ระวัง miss บ่อยนะ 😅', '⚠️');
        if(game.playerHP <= 0){
          updateHUD();
          updateBossHUD();
          endGame('hpzero');
          return;
        }
        updateHUD();
      }
    }
  }, cfg.targetLifeMs);

  const targetObj = { id, el, kind, spawnTime: now, lifeTimer };

  el.dataset.id = String(id);
  el.dataset.kind = kind;

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
  if(obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
  game.liveTargets.delete(id);

  const cfg = DIFF[game.diffKey] || DIFF.normal;
  const lifeMs = cfg.targetLifeMs;
  const dt = now - obj.spawnTime;
  const isPerfect = dt <= lifeMs * 0.4;

  let scoreDelta = 0;

  if(obj.kind === 'decoy'){
    // โดนเป้าหลอก
    game.decoyHits++;
    game.combo = 0;
    game.playerHP = clamp(game.playerHP - cfg.hpLossOnDecoy, 0, 100);
    scoreDelta = cfg.scoreDecoy;
    game.feverGauge = clamp(game.feverGauge - cfg.feverLossOnDecoy, 0, 100);
    game.decoyRTs.push(dt);
    setCoach('อันนั้นเป้าหลอก! เล็ง emoji หลักเท่านั้นนะ 💣', '💣');
  } else {
    // เป้าจริง
    game.hits++;
    game.combo++;
    if(game.combo > game.maxCombo) game.maxCombo = game.combo;
    if(isPerfect) game.perfectHits++;

    // FEVER logic
    const feverMult = game.feverActive ? 2 : 1;
    scoreDelta = cfg.scoreHit * feverMult;
    game.feverGauge = clamp(game.feverGauge + cfg.feverGainOnHit, 0, 120); // ให้ทะลุได้นิดหน่อย

    game.normalRTs.push(dt);

    // ดาเมจบอส
    const dmg = cfg.dmgPerHit * feverMult;
    game.bossHP = clamp(game.bossHP - dmg, 0, game.bossHPMax);

    if(game.bossHP <= 0){
      advanceBoss();
    }else{
      setCoach('ดีมาก! คอมโบต่อเนื่องแบบนี้แหละ 💥', '🔥');
    }

    // เปิด FEVER ถ้าเกจเต็ม
    if(!game.feverActive && game.feverGauge >= 100){
      activateFever();
    }
  }

  game.score += scoreDelta;
  updateHUD();
  updateBossHUD();
  updateFeverHUD();

  // log hit
  if(game.mode === 'research'){
    game.csvRows.push({
      t: ((now - game.startTime)/1000).toFixed(3),
      kind: obj.kind,
      isDecoy: obj.kind === 'decoy' ? 1 : 0,
      isFever: game.feverActive ? 1 : 0,
      rtMs: Math.round(dt),
      perfect: isPerfect ? 1 : 0,
      combo: game.combo,
      scoreAfter: game.score
    });
  }

  if(game.playerHP <= 0){
    endGame('hpzero');
  }
}

// ---------- Boss phase control ----------

function advanceBoss(){
  // บอสตัวปัจจุบัน HP หมด
  if(game.bossIndex < BOSSES.length - 1){
    game.bossIndex++;
    const cfg = DIFF[game.diffKey] || DIFF.normal;
    game.bossHPMax = cfg.bossHP[game.bossIndex] || cfg.bossHP[cfg.bossHP.length-1];
    game.bossHP = game.bossHPMax;

    setCoach(`เยี่ยม! ผ่านบอสตัวที่ ${game.bossIndex} แล้ว ไปต่อ! 🚀`, '⭐');
    updateBossHUD();
  } else {
    // ปราบครบทุกตัว
    endGame('bossdefeated');
  }
}

// ---------- FEVER ----------

function activateFever(){
  game.feverActive = true;
  game.feverGauge = 100;
  updateFeverHUD();
  setCoach('FEVER TIME! ชกให้รัว คะแนน x2 🔥', '🔥');

  clearTimeout(game.feverTimeout);
  game.feverTimeout = setTimeout(() => {
    game.feverActive = false;
    game.feverGauge = clamp(game.feverGauge, 0, 100);
    updateFeverHUD();
    setCoach('FEVER จบแล้ว กลับมาชกจังหวะเนียน ๆ ต่อ ✨', '🥊');
  }, 7000);
}

// ---------- CSV builder (research mode) ----------

function buildCSV(reasonText, accuracy, avgNormal, avgDecoy){
  const cfg = DIFF[game.diffKey] || DIFF.normal;
  const lines = [];
  const now = new Date();

  lines.push('Shadow Breaker VR Fitness — Research Log');
  lines.push(`Date,${now.toISOString()}`);
  lines.push(`Mode,${game.mode}`);
  lines.push(`Difficulty,${cfg.label}`);
  lines.push(`ParticipantID,${game.participantId || ''}`);
  lines.push(`Group,${game.participantGroup || ''}`);
  lines.push(`Note,${game.participantNote || ''}`);
  lines.push(`EndReason,${reasonText}`);
  lines.push(`Score,${game.score}`);
  lines.push(`MaxCombo,${game.maxCombo}`);
  lines.push(`Hits,${game.hits}`);
  lines.push(`Miss,${game.misses}`);
  lines.push(`DecoyHits,${game.decoyHits}`);
  lines.push(`Accuracy,${accuracy.toFixed(2)}`);
  lines.push(`AvgRTNormal(ms),${avgNormal != null ? avgNormal.toFixed(2) : ''}`);
  lines.push(`AvgRTDecoy(ms),${avgDecoy != null ? avgDecoy.toFixed(2) : ''}`);
  lines.push('');
  lines.push('t(sec),kind,isDecoy,isFever,rtMs,perfect,combo,scoreAfter');

  game.csvRows.forEach(r => {
    lines.push([
      r.t,
      r.kind,
      r.isDecoy,
      r.isFever,
      r.rtMs,
      r.perfect,
      r.combo,
      r.scoreAfter
    ].join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  if(game.csvUrl) URL.revokeObjectURL(game.csvUrl);
  game.csvUrl = URL.createObjectURL(blob);
}

// ---------- Event binding ----------

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
      // โหมดเล่นปกติ ข้ามฟอร์มวิจัย
      startGame();
      break;

    case 'research-begin-play':
      game.mode = 'research';
      game.diffKey = ($('#difficulty').value || 'normal');
      if(game.els.researchId){
        game.participantId = game.els.researchId.value.trim();
      }
      if(game.els.researchGroup){
        game.participantGroup = game.els.researchGroup.value.trim();
      }
      if(game.els.researchNote){
        game.participantNote = game.els.researchNote.value.trim();
      }
      startGame();
      break;

    case 'back-to-menu':
      game.running = false;
      showView('menu');
      break;

    case 'stop-early':
      if(game.running){
        endGame('stopped');
      }
      break;

    case 'play-again':
      // ใช้ mode/diff เดิม
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
      {
        const a = document.createElement('a');
        a.href = game.csvUrl;
        const id = game.participantId || 'no-id';
        a.download = `shadow-breaker_${id}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      break;
  }
}

function init(){
  cacheDom();
  showView('menu');

  // bind actions
  $$('.btn-row [data-action], [data-action]').forEach(btn => {
    btn.addEventListener('click', handleActionClick);
  });

  // กัน error เวลาแท็บถูกซ่อน
  document.addEventListener('visibilitychange', () => {
    if(document.hidden && game.running){
      endGame('hidden');
    }
  });

  resetGameState();
}

window.addEventListener('DOMContentLoaded', init);
