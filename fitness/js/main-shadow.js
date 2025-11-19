// === fitness/js/main-shadow.js (2025-11-19 full) ===
'use strict';

import { GameEngine }   from './engine.js';
import { DomRenderer }  from './dom-renderer.js';
import { createCSVLogger } from './logger-csv.js';
import { pickConfig }   from './config.js';
import { recordSession } from './stats-store.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---------- view helper ---------- */

function showView(sel){
  ['#view-menu','#view-research-form','#view-play','#view-result']
    .forEach(id=>{
      const el=$(id);
      if(el) el.classList.add('hidden');
    });
  const v=$(sel);
  if(v) v.classList.remove('hidden');
}

/* ---------- global state ---------- */

let currentMode    = 'normal';   // 'normal' | 'research'
let currentDiffKey = 'normal';   // 'easy' | 'normal' | 'hard'

let engine   = null;
let renderer = null;
let logger   = null;

let lastState       = null;
let lastSessionMeta = null;

let coachTimer  = null;
let lastCoachAt = 0;

/* ---------- boss definitions ---------- */

const BOSSES = [
  { name:'Bubble Glove',  emoji:'🫧', theme:'theme-boss-0' },
  { name:'Thunder Mitt',  emoji:'⚡', theme:'theme-boss-1' },
  { name:'Shadow Fist',   emoji:'🌑', theme:'theme-boss-2' },
  { name:'Nova Gauntlet', emoji:'💎', theme:'theme-boss-3', final:true }
];

function getBossInfo(idx){
  return BOSSES[idx] || BOSSES[BOSSES.length-1];
}

/* ---------- coach lines ---------- */

const COACH_LINES = {
  kids:{
    welcome:    'พร้อมลุย Shadow Breaker แล้ว! ชกเป้าให้ทันนะ 🥊',
    feverReady: 'เกจใกล้เต็มแล้ว เตรียมเข้าโหมด FEVER! ✨',
    feverOn:    'FEVER แล้ว! ชกให้รัว แต่ยังต้องเล็งดี ๆ นะ 💥',
    hpLow:      'HP เหลือน้อยแล้ว หายใจลึก ๆ ตั้งสติแล้วค่อยชก ✨',
    bossNext:   'บอสตัวต่อไปมาแล้ว! ยากขึ้นอีกนิด แต่สู้ไหวแน่ 😈',
    missSoft:   'พลาดไปนิด ไม่เป็นไร รอบหน้าเอาใหม่! 👍'
  },
  research:{
    welcome:    'โหมดวิจัย: โฟกัสจังหวะหมัดกับการหายใจให้สม่ำเสมอครับ 🧪',
    feverReady: 'ค่า FEVER ใกล้เต็มแล้ว ลองรักษาจังหวะให้ต่อเนื่องครับ ✨',
    feverOn:    'เข้าสู่ช่วง FEVER: สังเกตว่ารู้สึกเร็วขึ้นแต่ยังควบคุมได้หรือไม่ 💡',
    hpLow:      'HP ลดลงมาก แนะนำผ่อนแรงเล็กน้อยแต่รักษาความแม่นยำครับ 💚',
    bossNext:   'เริ่มบอสตัวใหม่แล้ว ลองเปรียบเทียบความล้ากับตัวก่อนดูครับ 📊',
    missSoft:   'มี miss เพิ่มขึ้นเล็กน้อย ลองโฟกัสการมองเป้าและการซิงค์มือ–สายตาครับ 👀'
  }
};

const COACH_COOLDOWN_MS = 4500;

function getCoachPersona(){
  return currentMode === 'research' ? 'research' : 'kids';
}

/* ---------- DOM refs ---------- */

// HUD
const elScore   = $('#stat-score');
const elCombo   = $('#stat-combo');
const elMiss    = $('#stat-miss');
const elTime    = $('#stat-time');
const elMode    = $('#stat-mode');
const elDiff    = $('#stat-diff');
const elPerfect = $('#stat-perfect');
const elHP      = $('#stat-hp');

// FEVER
const elFeverWrap   = $('.fever-wrap');
const elFeverFill   = $('#fever-fill');
const elFeverStatus = $('#fever-status');

// Boss HUD
const elBossName = $('#boss-name');
const elBossFill = $('#boss-fill');
const elBossBar  = document.querySelector('.boss-bar');

// Boss portrait
const elBossPortrait      = $('#boss-portrait');
const elBossPortraitEmoji = $('#boss-portrait-emoji');
const elBossPortraitName  = $('#boss-portrait-name');
const elBossPortraitHint  = $('#boss-portrait-hint');

// Coach
const elCoachBubble = $('#coach-bubble');
const elCoachAvatar = $('#coach-avatar');
const elCoachRole   = $('#coach-role');
const elCoachText   = $('#coach-text');

// Play area (for theme / shake)
const elPlayArea = document.querySelector('.play-area');

// Result
const elResMode        = $('#res-mode');
const elResDiff        = $('#res-diff');
const elResScore       = $('#res-score');
const elResMaxCombo    = $('#res-maxcombo');
const elResMiss        = $('#res-miss');
const elResParticipant = $('#res-participant');
const elResEndReason   = $('#res-endreason');
const elResAccuracy    = $('#res-accuracy');
const elResTotalHits   = $('#res-totalhits');
const elResRTNormal    = $('#res-rt-normal');
const elResRTDecoy     = $('#res-rt-decoy');

/* ---------- coach system ---------- */

function setCoachMessage(key){
  if (!elCoachBubble || !elCoachText || !elCoachAvatar || !elCoachRole) return;

  const now = performance.now();
  if (now - lastCoachAt < COACH_COOLDOWN_MS) return;
  lastCoachAt = now;

  const persona = getCoachPersona();
  const lines   = COACH_LINES[persona];
  const text    = lines[key];
  if (!text) return;

  elCoachText.textContent = text;
  if (persona === 'research'){
    elCoachAvatar.textContent = '🧑‍🔬';
    elCoachRole.textContent   = 'Research Coach';
  }else{
    elCoachAvatar.textContent = '🥊';
    elCoachRole.textContent   = 'โค้ชพลังหมัด';
  }

  elCoachBubble.classList.add('visible');
  if (coachTimer) clearTimeout(coachTimer);
  coachTimer = setTimeout(()=>elCoachBubble.classList.remove('visible'),3800);
}

function updateCoach(state){
  const prev = lastState;
  if (!prev){
    setCoachMessage('welcome');
    return;
  }

  // FEVER ready
  if ((state.feverCharge >= 90) && (prev.feverCharge < 90)){
    setCoachMessage('feverReady');
    return;
  }
  // FEVER active toggle
  if (!prev.feverActive && state.feverActive){
    setCoachMessage('feverOn');
    return;
  }
  // HP low
  if ((state.playerHP <= 30) && (prev.playerHP > 30)){
    setCoachMessage('hpLow');
    return;
  }
  // next boss
  if (state.bossIndex > prev.bossIndex){
    setCoachMessage('bossNext');
    return;
  }
  // miss increased
  if (state.missCount > prev.missCount){
    setCoachMessage('missSoft');
  }
}

/* ---------- HUD helpers ---------- */

function updateStaticHUD(){
  if (elMode) elMode.textContent = (currentMode === 'research') ? 'Research' : 'Normal';
  if (elDiff) elDiff.textContent = currentDiffKey;
}

function updateFeverHUD(state){
  if (!elFeverFill || !elFeverStatus) return;
  const charge = Math.max(0, Math.min(100, state.feverCharge || 0));
  elFeverFill.style.width = charge + '%';

  if (state.feverActive){
    elFeverStatus.textContent = 'FEVER!!';
    elFeverStatus.classList.add('active');
  }else if (charge >= 90){
    elFeverStatus.textContent = 'READY';
    elFeverStatus.classList.remove('active');
  }else{
    elFeverStatus.textContent = 'FEVER';
    elFeverStatus.classList.remove('active');
  }
}

function applyBossTheme(idx){
  if (!elPlayArea) return;
  elPlayArea.classList.remove('theme-boss-0','theme-boss-1','theme-boss-2','theme-boss-3');
  const info = getBossInfo(idx);
  elPlayArea.classList.add(info.theme);
}

function updateBossHUD(state){
  if (!elBossName || !elBossFill) return;

  const idx   = (state.bossIndex ?? 0);
  const total = state.bossCount ?? BOSSES.length;
  const hp    = state.bossHP ?? 0;
  const maxHP = state.bossMaxHP || 1;

  const bossInfo  = getBossInfo(idx);
  const bossLabel = `${bossInfo.name} (${idx+1}/${total})`;
  elBossName.textContent = bossLabel;

  const pct = Math.max(0, Math.min(100, (hp / maxHP) * 100));
  elBossFill.style.width = pct + '%';

  // portrait info
  if (elBossPortraitEmoji) elBossPortraitEmoji.textContent = bossInfo.emoji;
  if (elBossPortraitName)  elBossPortraitName.textContent  = bossInfo.name;

  // theme per boss
  applyBossTheme(idx);

  const ratio = hp / maxHP;

  // show portrait เมื่อ HP ต่ำกว่า 60%
  if (ratio > 0 && ratio <= 0.6){
    elBossPortrait?.classList.add('visible');
    if (elBossPortraitHint){
      if (ratio <= 0.25){
        elBossPortraitHint.textContent = 'HP ใกล้หมดแล้ว! ตีให้สุด! 💥';
      }else if (ratio <= 0.45){
        elBossPortraitHint.textContent = 'บอสเริ่มเสียจังหวะแล้ว รัวเป้าให้คอมโบต่อเนื่อง! 🔥';
      }else{
        elBossPortraitHint.textContent = 'เริ่มเห็นช่องว่างแล้ว ลองเล็งให้แม่นขึ้น ✨';
      }
    }
  }else{
    elBossPortrait?.classList.remove('visible');
  }

  // shake portrait + เร่ง spawn เมื่อ HP ใกล้ 0
  if (elBossPortrait){
    if (ratio > 0 && ratio <= 0.25){
      elBossPortrait.classList.add('shake');
    }else{
      elBossPortrait.classList.remove('shake');
    }
  }

  // dynamic spawn speed (phase 1 → 2 → 3)
  if (engine && engine.baseSpawnInterval){
    const base = engine.baseSpawnInterval;
    if (ratio <= 0.25){
      engine.cfg.spawnInterval = base * 0.55;   // phase 3: เร็วสุด
      elPlayArea?.classList.add('shake');
    }else if (ratio <= 0.55){
      engine.cfg.spawnInterval = base * 0.75;   // phase 2
      elPlayArea?.classList.remove('shake');
    }else{
      engine.cfg.spawnInterval = base;          // phase 1
      elPlayArea?.classList.remove('shake');
    }
  }
}

function updateHUD(state){
  if (elScore)   elScore.textContent   = state.score;
  if (elCombo)   elCombo.textContent   = state.combo;
  if (elMiss)    elMiss.textContent    = state.missCount;
  if (elPerfect) elPerfect.textContent = state.perfectHits ?? 0;
  if (elHP)      elHP.textContent      = state.playerHP ?? 0;

  const remainingSec = Math.max(0, (state.remainingMs || 0) / 1000);
  if (elTime) elTime.textContent = remainingSec.toFixed(1);

  updateFeverHUD(state);
  updateBossHUD(state);
  updateCoach(state);

  lastState = state;
}

/* ---------- result helpers ---------- */

function mapEndReason(code){
  switch(code){
    case 'timeout':      return 'เล่นครบเวลา / Timeout';
    case 'boss-cleared': return 'ชนะบอสครบทั้งหมด';
    case 'player-dead':  return 'HP ผู้เล่นหมด';
    case 'manual':       return 'หยุดเองจากปุ่ม';
    case 'back-to-menu': return 'ออกจากเกมกลับเมนู';
    default:             return code || '-';
  }
}
function formatMs(ms){
  if (!ms || ms <= 0) return '-';
  return ms.toFixed(0)+' ms';
}

/* ---------- start / stop game ---------- */

function makeDiffConfig(diffKey){
  // base จาก config.js
  const base = pickConfig(diffKey);
  // override ขนาดเป้า + interval ตามระดับ
  let sizePx, spawn;
  switch(diffKey){
    case 'easy':
      sizePx = 96;
      spawn  = base.spawnInterval || 900;
      break;
    case 'hard':
      sizePx = 64;
      spawn  = base.spawnInterval || 650;
      break;
    default: // normal
      sizePx = 78;
      spawn  = base.spawnInterval || 800;
  }
  return {
    ...base,
    name: base.name || diffKey,
    targetSizePx: sizePx,
    spawnInterval: spawn
  };
}

function startGameSession(){
  const diffConfig = makeDiffConfig(currentDiffKey);

  const participantId = currentMode === 'research'
    ? ($('#research-id')?.value || '').trim()
    : `NORMAL-${Date.now()}`;

  const groupName = currentMode === 'research'
    ? ($('#research-group')?.value || '').trim()
    : '';

  const phaseNote = currentMode === 'research'
    ? ($('#research-note')?.value || '').trim()
    : '';

  lastSessionMeta = {
    gameId:     'shadow-breaker',
    playerId:   participantId || 'anon',
    mode:       currentMode,
    difficulty: currentDiffKey,
    group:      groupName,
    phase:      phaseNote,
    filePrefix: 'vrfitness_shadowbreaker'
  };

  logger = createCSVLogger(lastSessionMeta);

  const host = $('#target-layer');
  renderer = new DomRenderer(null, host, { sizePx: diffConfig.targetSizePx });

  const hooks = {
    onUpdate(state){
      updateHUD(state);
    },
    onEnd(state){
      onGameEnd(state);
    }
  };

  engine = new GameEngine({
    config:   diffConfig,
    hooks,
    renderer,
    logger,
    mode: currentMode
  });

  // ให้ renderer รู้จัก engine + เก็บ baseSpawnInterval ไว้เร่งตอน boss ใกล้ตาย
  renderer.setEngine?.(engine);
  engine.baseSpawnInterval = diffConfig.spawnInterval;

  lastState   = null;
  lastCoachAt = 0;
  elCoachBubble?.classList.remove('visible');

  // initial boss theme
  applyBossTheme(0);

  showView('#view-play');
  updateStaticHUD();
  engine.start();
}

/* ---------- on game end ---------- */

function onGameEnd(state){
  const analytics = state.analytics || {};

  if (elResMode)        elResMode.textContent        = (currentMode === 'research') ? 'โหมดวิจัย' : 'โหมดเล่นปกติ';
  if (elResDiff)        elResDiff.textContent        = currentDiffKey;
  if (elResScore)       elResScore.textContent       = state.score;
  if (elResMaxCombo)    elResMaxCombo.textContent    = state.maxCombo;
  if (elResMiss)        elResMiss.textContent        = state.missCount;
  if (elResParticipant) elResParticipant.textContent = lastSessionMeta?.playerId || '-';
  if (elResEndReason)   elResEndReason.textContent   = mapEndReason(state.endedBy);

  const acc = analytics.accuracy != null ? analytics.accuracy : 0;
  if (elResAccuracy)  elResAccuracy.textContent  = (acc * 100).toFixed(1) + ' %';
  if (elResTotalHits) elResTotalHits.textContent = analytics.totalHits ?? 0;
  if (elResRTNormal)  elResRTNormal.textContent  = formatMs(analytics.avgReactionNormal || 0);
  if (elResRTDecoy)   elResRTDecoy.textContent   = formatMs(analytics.avgReactionDecoy || 0);

  elCoachBubble?.classList.remove('visible');
  elPlayArea?.classList.remove('shake');

  // save summary to dashboard
  recordSession('shadow-breaker',{
    mode: currentMode,
    difficulty: currentDiffKey,
    score: state.score,
    maxCombo: state.maxCombo,
    missCount: state.missCount,
    totalHits: analytics.totalHits ?? 0,
    accuracy: acc,
    avgReactionMs: analytics.avgReactionNormal || 0
  });

  showView('#view-result');
}

/* ---------- init / wiring ---------- */

function init(){
  // start buttons
  $('[data-action="start-research"]')?.addEventListener('click',()=>{
    currentMode    = 'research';
    currentDiffKey = $('#difficulty')?.value || 'normal';
    showView('#view-research-form');
  });

  $('[data-action="start-normal"]')?.addEventListener('click',()=>{
    currentMode    = 'normal';
    currentDiffKey = $('#difficulty')?.value || 'normal';
    startGameSession();
  });

  // back to menu
  $$('[data-action="back-to-menu"]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (engine) engine.stop('back-to-menu');
      showView('#view-menu');
    });
  });

  // start from research form
  $('[data-action="research-begin-play"]')?.addEventListener('click',()=>{
    currentDiffKey = $('#difficulty')?.value || 'normal';
    startGameSession();
  });

  // stop early
  $('[data-action="stop-early"]')?.addEventListener('click',()=>{
    if (engine) engine.stop('manual');
  });

  // download CSV (จริง ๆ จะดาวน์โหลดตอน finish อยู่แล้ว)
  $('[data-action="download-csv"]')?.addEventListener('click',()=>{
    alert('ไฟล์ CSV จะถูกดาวน์โหลดอัตโนมัติเมื่อจบเกมในโหมดวิจัยแล้วค่ะ');
  });

  // play again
  $('[data-action="play-again"]')?.addEventListener('click',()=>{
    if (!lastSessionMeta){
      showView('#view-menu');
      return;
    }
    currentMode    = lastSessionMeta.mode || 'normal';
    currentDiffKey = lastSessionMeta.difficulty || 'normal';

    if (currentMode === 'research'){
      showView('#view-research-form');
    }else{
      startGameSession();
    }
  });

  showView('#view-menu');
}

window.addEventListener('DOMContentLoaded',init);
