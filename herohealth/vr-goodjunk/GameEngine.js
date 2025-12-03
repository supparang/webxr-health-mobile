// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Game Engine + Session & Event Stats (Research-ready, fixed spawn)

'use strict';

import {
  ensureFeverBar,
  setFever,
  setFeverActive,
  setShield
} from './ui-fever.js';

import { Difficulty } from './difficulty.js';
import { emojiImage } from './emoji-image.js';
import { burstAt, floatScore, setShardMode } from './aframe-particles.js';

// ใช้ Quest ตัวเก่า (quest-serial) สำหรับสรุป session
import { Quest } from './quest-serial.js';

// ใช้ director ใหม่สำหรับอ่าน GOODJUNK_GOALS + GOODJUNK_MINIS
import { makeQuestDirector } from './quest-director-goodjunk.js';

// ---------- Global ที่ส่วนอื่นใช้ ----------
window.score        = 0;
window.combo        = 0;
window.comboMax     = 0;
window.misses       = 0;
window.FEVER_ACTIVE = false;
window.running      = false;

// ---------- ตัวแปรภายใน Engine ----------
let shield      = 0;
let fever       = 0;
let gameTimer   = null;
let spawnTimer  = null;
let sceneEl     = null;
let targetRoot  = null;
let gameConfig  = null;
let difficulty  = new Difficulty();

const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
const STAR = '⭐', DIA = '💎', SHIELD_EMOJI = '🛡️', FIRE = '🔥';
const BONUS = [STAR, DIA, SHIELD_EMOJI, FIRE];

// ค่า fallback กันกรณี difficulty ตารางเพี้ยน → ไม่ spawn
const DEFAULT_CFG = {
  size: 1.35,   // scale ของ emoji
  rate: 900,    // ระยะห่างการ spawn (ms)
  life: 2600    // อายุของเป้า (ms)
};

// ---------- ตัวแปรสำหรับวิจัย (Session Stats + Event) ----------
let sessionStats      = null;
let sessionStartMs    = 0;
let comboMaxInternal  = 0;
let inputsBound       = false;
let currentSessionId  = null;

// ★ ใหม่: Quest Director + state ที่ใช้คำนวณ goal / mini
let questDir   = null;
let questState = {
  score:    0,
  goodHits: 0, // นับเฉพาะ “อาหารดีจริง ๆ” ไม่รวม power-ups
  miss:     0,
  comboMax: 0,
  timeLeft: 60
};

// helper: ตรวจชนิดอุปกรณ์แบบง่าย ๆ
function detectDeviceType() {
  const ua = (navigator.userAgent || '').toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/.test(ua);
  const isVR = !!(navigator.xr || ua.includes('oculus') || ua.includes('quest'));
  if (isVR) return 'vr-headset';
  if (isMobile) return 'mobile';
  return 'desktop';
}

function makeSessionId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `gjvr_${t}_${r}`;
}

// lane แบบง่าย: L / C / R จากแกน X
function laneFromX(x) {
  if (x < -1.2) return 'L';
  if (x >  1.2) return 'R';
  return 'C';
}

// ยิง event สำหรับ logger
function emitEvent(ev) {
  try {
    window.dispatchEvent(new CustomEvent('hha:event', { detail: ev }));
  } catch (_) {}
}

function beginSession(meta) {
  const now = new Date();
  sessionStartMs = now.getTime();

  sessionStats = {
    sessionId: makeSessionId(),
    game: 'Good vs Junk',
    mode: 'goodjunk-vr',
    difficulty: meta.difficulty || 'normal',

    // metadata จาก URL / experiment
    playerId:  meta.playerId  || '',
    group:     meta.group     || '',
    prePost:   meta.prePost   || '',
    className: meta.className || '',
    school:    meta.school    || '',

    device:       detectDeviceType(),
    userAgent:    navigator.userAgent || '',
    startTimeIso: now.toISOString(),
    endTimeIso:   null,
    durationSecPlanned: meta.durationSec || 60,
    durationSecPlayed:  0,

    // gameplay summary
    scoreFinal: 0,
    comboMax:   0,
    misses:     0,

    // counters
    goodHits:    0,
    junkHits:    0,
    starHits:    0,
    diamondHits: 0,
    shieldHits:  0,
    fireHits:    0,

    feverActivations:   0,
    feverTimeTotalSec:  0,

    // quest summary (จะเติมตอนจบจาก questDir)
    mainGoalDone: false,
    miniCleared:  0,
    miniTotal:    0,
    goalsCleared: 0,
    goalsTotal:   0,

    _sent: false
  };

  currentSessionId = sessionStats.sessionId;
}

function finishSession() {
  if (!sessionStats || sessionStats._sent) return;

  const nowMs = Date.now();
  const now = new Date(nowMs);
  const durSec = Math.max(0, Math.round((nowMs - sessionStartMs) / 1000));

  sessionStats.endTimeIso        = now.toISOString();
  sessionStats.durationSecPlayed = durSec;
  sessionStats.scoreFinal        = window.score | 0;
  sessionStats.comboMax          = Math.max(sessionStats.comboMax || 0, comboMaxInternal | 0);
  sessionStats.misses            = window.misses | 0;

  // ✅ ใช้ Quest Director สรุป goal / mini
  if (questDir && typeof questDir.summary === 'function') {
    const qs = questDir.summary();
    if (qs) {
      sessionStats.goalsCleared = qs.goalsCleared | 0;
      sessionStats.goalsTotal   = qs.goalsTotal   | 0;
      sessionStats.miniCleared  = qs.miniCleared  | 0;
      sessionStats.miniTotal    = qs.miniTotal    | 0;

      // mainGoalDone = ทำ goal ครบชุด
      sessionStats.mainGoalDone =
        (sessionStats.goalsTotal > 0 && sessionStats.goalsCleared >= sessionStats.goalsTotal);
    }
  }

  sessionStats._sent = true;

  try {
    window.dispatchEvent(new CustomEvent('hha:session', { detail: sessionStats }));
    window.dispatchEvent(new CustomEvent('hha:end',     { detail: sessionStats }));
  } catch (e) {
    console.warn('hha:session dispatch error', e);
  }
}

// ---------- Global helpers ----------
window.emit = function(name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); }
  catch (_) {}
};

window.feverStart = function() {
  if (window.FEVER_ACTIVE) return;
  fever = 100;
  setFever(fever);
  window.FEVER_ACTIVE = true;
  setFeverActive(true);

  if (sessionStats) {
    sessionStats.feverActivations += 1;
  }

  window.emit('hha:fever', { state: 'start' });
};

window.popupText = function(text, pos, color = '#fff') {
  const worldPos = { x: 0, y: (pos && pos.y) || 1.4, z: -1.5 };
  floatScore(sceneEl, worldPos, text, color);
};

// ---------- Game Logic ----------
function mult() {
  return window.FEVER_ACTIVE ? 2 : 1;
}

function gainFever(n) {
  if (window.FEVER_ACTIVE) return;
  fever = Math.max(0, Math.min(100, fever + n));
  setFever(fever);
  if (fever >= 100) {
    window.feverStart();
  }
}

function decayFever(base) {
  const d = window.FEVER_ACTIVE ? 10 : base;
  fever = Math.max(0, fever - d);
  setFever(fever);
  if (window.FEVER_ACTIVE && fever <= 0) {
    window.FEVER_ACTIVE = false;
    setFeverActive(false);
    window.emit('hha:fever', { state: 'end' });
  }
}

// คืน config ที่ใช้แน่ ๆ (มี fallback)
function getCfg() {
  const cfg = gameConfig || {};
  const size = (typeof cfg.size === 'number' && isFinite(cfg.size)) ? cfg.size : DEFAULT_CFG.size;
  const rate = (typeof cfg.rate === 'number' && isFinite(cfg.rate) && cfg.rate > 50) ? cfg.rate : DEFAULT_CFG.rate;
  const life = (typeof cfg.life === 'number' && isFinite(cfg.life) && cfg.life > 200) ? cfg.life : DEFAULT_CFG.life;
  return { size, rate, life };
}

function spawnTarget() {
  if (!window.running) return;

  const cfg = getCfg();

  const isGood   = Math.random() < 0.65;
  const usePower = Math.random() < 0.08;

  let char;
  let type;
  let palette;
  let itemType = 'good';

  if (usePower) {
    char = BONUS[(Math.random() * BONUS.length) | 0];
    type = 'good';
    palette = 'groups';
    itemType = 'bonus';
  } else if (isGood) {
    char = GOOD[(Math.random() * GOOD.length) | 0];
    type = 'good';
    palette = 'goodjunk';
    itemType = 'good';
  } else {
    char = JUNK[(Math.random() * JUNK.length) | 0];
    type = 'bad';
    palette = 'plate';
    itemType = 'junk';
  }

  const scale = cfg.size * 0.6;
  const el = emojiImage(char, scale || DEFAULT_CFG.size);
  el.dataset.type     = type;
  el.dataset.char     = char;
  el.dataset.palette  = palette;
  el.dataset.itemType = itemType;
  el.setAttribute('data-hha-tgt', '1'); // ให้ raycaster จับได้

  const x = (Math.random() - 0.5) * 4;
  const y = 1.0 + Math.random() * 1.0;
  const z = -2.5 - Math.random() * 1.0;
  const lane = laneFromX(x);

  el.setAttribute('position', `${x} ${y} ${z}`);
  el.dataset.lane    = lane;
  el.dataset.spawnAt = String(performance.now());

  if (targetRoot) {
    targetRoot.appendChild(el);
  }

  // หมดอายุเป้า
  setTimeout(() => {
    if (el && el.parentNode) {
      const spawnAt = Number(el.dataset.spawnAt || '0');
      const rtMs = spawnAt ? Math.round(performance.now() - spawnAt) : '';
      const lane2 = el.dataset.lane || '';
      const ch    = el.dataset.char || char;
      const itemType2 = el.dataset.itemType || itemType;

      if (type === 'good') {
        // ปล่อยของดีหลุด → miss
        window.misses++;
        if (sessionStats) sessionStats.misses = window.misses;
        window.combo = 0;
        window.emit('hha:miss', {});

        // อัปเดต quest state
        questState.miss     = window.misses;
        questState.comboMax = window.comboMax;
        if (questDir) questDir.update(questState);

        emitEvent({
          sessionId: currentSessionId || (sessionStats && sessionStats.sessionId) || '',
          type: 'timeout-good',
          emoji: ch,
          lane: lane2,
          rtMs,
          totalScore: window.score | 0,
          combo: window.combo | 0,
          isGood: true,
          itemType: itemType2
        });
      } else {
        // หลบของขยะ → ถือว่าหลีกเลี่ยง junk ได้
        gainFever(4);
        emitEvent({
          sessionId: currentSessionId || (sessionStats && sessionStats.sessionId) || '',
          type: 'avoid-junk',
          emoji: ch,
          lane: lane2,
          rtMs,
          totalScore: window.score | 0,
          combo: window.combo | 0,
          isGood: false,
          itemType: itemType2
        });
      }
      el.remove();
    }
  }, cfg.life);

  spawnTimer = setTimeout(spawnTarget, cfg.rate);
}

function onHitTarget(targetEl) {
  if (!targetEl || !targetEl.parentNode) return;

  const type      = targetEl.dataset.type;
  const char      = targetEl.dataset.char;
  const palette   = targetEl.dataset.palette;
  const itemTypeOrig = targetEl.dataset.itemType || 'good';

  let pos;
  try {
    if (targetEl.object3D && targetEl.object3D.getWorldPosition && window.THREE) {
      pos = targetEl.object3D.getWorldPosition(new THREE.Vector3());
    } else {
      pos = { x: 0, y: 1.5, z: -2.0 };
    }
  } catch (_) {
    pos = { x: 0, y: 1.5, z: -2.0 };
  }

  const spawnAt = Number(targetEl.dataset.spawnAt || '0');
  const rtMs = spawnAt ? Math.round(performance.now() - spawnAt) : '';
  const lane = targetEl.dataset.lane || '';

  let scoreDelta = 0;
  let itemType = itemTypeOrig;

  if (type === 'good') {
    // ---------- Good / Power-ups ----------
    if (sessionStats) {
      sessionStats.goodHits += 1;
      if (char === STAR)              sessionStats.starHits    += 1;
      else if (char === DIA)          sessionStats.diamondHits += 1;
      else if (char === SHIELD_EMOJI) sessionStats.shieldHits  += 1;
      else if (char === FIRE)         sessionStats.fireHits    += 1;
    }

    if (char === STAR) {
      scoreDelta = 40 * mult();
      gainFever(10);
      itemType = 'bonus';
    } else if (char === DIA) {
      scoreDelta = 80 * mult();
      gainFever(30);
      itemType = 'bonus';
    } else if (char === SHIELD_EMOJI) {
      scoreDelta = 20;
      shield = Math.min(3, shield + 1);
      setShield(shield);
      itemType = 'bonus';
    } else if (char === FIRE) {
      scoreDelta = 25;
      window.feverStart();
      itemType = 'bonus';
    } else {
      scoreDelta = (20 + window.combo * 2) * mult();
      gainFever(8 + window.combo * 0.6);
      itemType = 'good';
    }

    window.score += scoreDelta;
    window.combo++;
    comboMaxInternal = Math.max(comboMaxInternal, window.combo);
    window.comboMax = comboMaxInternal;

    if (sessionStats) {
      sessionStats.comboMax = Math.max(sessionStats.comboMax || 0, comboMaxInternal);
    }

    burstAt(sceneEl, pos, { mode: palette });
    floatScore(sceneEl, pos, `+${scoreDelta}`, '#22c55e');

  } else {
    // ---------- Bad (ของขยะ) ----------
    if (sessionStats) {
      sessionStats.junkHits += 1;
    }
    itemType = 'junk';

    if (shield > 0) {
      shield--;
      setShield(shield);
      burstAt(sceneEl, pos, { mode: 'hydration' });
      floatScore(sceneEl, pos, 'SHIELDED!', '#60a5fa');

      emitEvent({
        sessionId: currentSessionId || (sessionStats && sessionStats.sessionId) || '',
        type: 'hit-junk-shield',
        emoji: char,
        lane,
        rtMs,
        totalScore: window.score | 0,
        combo: window.combo | 0,
        isGood: false,
        itemType
      });

      targetEl.remove();
      return;
    }

    scoreDelta = -15;
    window.score = Math.max(0, window.score + scoreDelta);
    window.combo = 0;
    window.misses++;
    if (sessionStats) sessionStats.misses = window.misses;

    decayFever(18);
    window.emit('hha:miss', {});
    burstAt(sceneEl, pos, { mode: palette });
    floatScore(sceneEl, pos, `${scoreDelta}`, '#ef4444');
  }

  // อัปเดต quest state หลังจาก hit
  questState.score    = window.score;
  questState.miss     = window.misses;
  questState.comboMax = window.comboMax;
  // goodHits นับเฉพาะอาหารดีจริง ๆ ไม่รวม power-ups
  if (type === 'good' && itemType === 'good') {
    questState.goodHits = (questState.goodHits || 0) + 1;
  }
  if (questDir) questDir.update(questState);

  // ส่ง event ให้ logger (hit)
  emitEvent({
    sessionId: currentSessionId || (sessionStats && sessionStats.sessionId) || '',
    type: (type === 'good' ? 'hit' : 'hit-junk'),
    emoji: char,
    lane,
    rtMs,
    totalScore: window.score | 0,
    combo: window.combo | 0,
    isGood: (type === 'good'),
    itemType
  });

  window.emit('hha:score', {
    score: window.score,
    combo: window.combo,
    delta: scoreDelta,
    misses: window.misses
  });

  targetEl.remove();
}

function gameTick() {
  if (!window.running) return;

  if (sessionStats && window.FEVER_ACTIVE) {
    sessionStats.feverTimeTotalSec += 1;
  }

  decayFever(window.combo <= 0 ? 6 : 2);
}

// ---------- Public Controller ----------
export const GameEngine = {
  start(level) {
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('A-Frame scene not found');
      return;
    }

    if (targetRoot) targetRoot.remove();
    targetRoot = document.createElement('a-entity');
    targetRoot.id = 'targetRoot';
    sceneEl.appendChild(targetRoot);

    ensureFeverBar();
    setShardMode('goodjunk');

    window.score = 0;
    window.combo = 0;
    window.comboMax = 0;
    window.misses = 0;
    comboMaxInternal = 0;
    shield = 0;
    fever = 0;
    window.FEVER_ACTIVE = false;
    window.running = true;
    setFever(0);
    setShield(0);
    setFeverActive(false);

    const url = new URL(window.location.href);
    const p = url.searchParams;
    const meta = {
      difficulty: (level || 'normal'),
      durationSec: parseInt(p.get('time') || '60', 10) || 60,
      playerId:  p.get('pid')   || p.get('player') || '',
      group:     p.get('group') || '',
      prePost:   p.get('prePost') || p.get('phase') || '',
      className: p.get('class') || p.get('room')  || '',
      school:    p.get('school')|| ''
    };
    beginSession(meta);

    // ★ ตั้งค่า questState + สร้าง Quest Director
    questState = {
      score:    0,
      goodHits: 0,
      miss:     0,
      comboMax: 0,
      timeLeft: meta.durationSec || 60
    };

    questDir = makeQuestDirector({
      diff: meta.difficulty || 'normal',
      goalDefs: GOODJUNK_GOALS,
      miniDefs: GOODJUNK_MINIS,
      maxGoals: 2,
      maxMini:  3
    });
    questDir.start({ timeLeft: questState.timeLeft });

    // ดึง config ตามระดับ ถ้าเพี้ยนจะมี fallback
    try {
      difficulty.set(level);
      gameConfig = (typeof difficulty.get === 'function'
        ? difficulty.get()
        : null) || DEFAULT_CFG;
    } catch (e) {
      console.warn('Difficulty.get error, use default config', e);
      gameConfig = DEFAULT_CFG;
    }

    if (gameTimer)  clearInterval(gameTimer);
    if (spawnTimer) clearTimeout(spawnTimer);
    gameTimer = setInterval(gameTick, 1000);
    spawnTimer = setTimeout(spawnTarget, 1000);

    if (!inputsBound) {
      inputsBound = true;

      // ฟังก์ชันกลางสำหรับยิงจาก cursor (ใช้ได้ทั้ง PC / Mobile)
      function fireFromCursor() {
        if (!window.running) return;
        const cursor = document.getElementById('cursor');
        if (!cursor) return;
        const ray = cursor.components && cursor.components.raycaster;
        if (!ray) return;
        const hit = ray.intersectedEls && ray.intersectedEls[0];
        if (hit && hit.dataset && hit.dataset.hhaTgt) {
          onHitTarget(hit);
        }
      }

      // รองรับ click จาก VR trigger / gaze cursor + click ทั่ว ๆ ไป
      sceneEl.addEventListener('click', (e) => {
        if (!window.running) return;

        if (e.target && e.target.dataset && e.target.dataset.hhaTgt) {
          onHitTarget(e.target);
          return;
        }
        fireFromCursor();
      });

      // รองรับเมาส์บน PC + แตะจอบน Mobile
      sceneEl.addEventListener('loaded', () => {
        const canvas = sceneEl.canvas;
        if (!canvas) return;

        canvas.addEventListener('mousedown', () => {
          fireFromCursor();
        });

        canvas.addEventListener('touchstart', () => {
          fireFromCursor();
        }, { passive: true });
      });
    }

    window.emit('hha:score', { score: 0, combo: 0, delta: 0, misses: 0 });
  },

  stop() {
    if (!window.running) {
      finishSession();
      return;
    }

    window.running = false;

    if (gameTimer)  clearInterval(gameTimer);
    if (spawnTimer) clearTimeout(spawnTimer);
    gameTimer = null;
    spawnTimer = null;

    if (targetRoot) {
      try { targetRoot.remove(); } catch (_) {}
      targetRoot = null;
    }

    finishSession();
  }
};

export default GameEngine;

// ★ sync เวลา questState.timeLeft จาก hha:time (มาจาก goodjunk-vr.html)
window.addEventListener('hha:time', (e) => {
  const sec = (e.detail && typeof e.detail.sec === 'number')
    ? e.detail.sec
    : 0;
  questState.timeLeft = sec;
  if (questDir) questDir.update(questState);
});
