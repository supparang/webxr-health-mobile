// === /herohealth/vr/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Game Engine + Session + Quest + Event Logger (Research-ready)

import {
  ensureFeverBar,
  setFever,
  setFeverActive,
  setShield
} from './ui-fever.js';

import { Difficulty } from './difficulty.js';
import { emojiImage } from './emoji-image.js';
import { burstAt, floatScore, setShardMode } from './aframe-particles.js';

// ---------- Global ที่ส่วนอื่นใช้ ----------
window.score        = 0;
window.combo        = 0;
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

// ---------- Session Stats ----------
let sessionStats      = null;
let sessionStartMs    = 0;
let comboMaxInternal  = 0;
let inputsBound       = false;
let tickSec           = 0;

// สำหรับคำนวณ RT / lane
let targetSeq = 0;
const activeTargets = new Map(); // id -> {spawnMs, emoji, type, lane}

// ---------- Quest State ----------
let questState = null;

// ---------- Utilities ----------
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

function emitEvent(kind, payload = {}) {
  try {
    window.dispatchEvent(new CustomEvent('hha:event', {
      detail: { kind, ...payload }
    }));
  } catch (e) {
    console.warn('emitEvent error', e);
  }
}

function beginSession(meta) {
  const now = new Date();
  sessionStartMs = now.getTime();
  tickSec = 0;

  sessionStats = {
    sessionId: makeSessionId(),
    game: 'Good vs Junk',
    mode: 'goodjunk-vr',
    difficulty: meta.difficulty || 'normal',

    // metadata
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

    // summary
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

    _sent: false
  };

  emitEvent('session_start', {
    sessionId: sessionStats.sessionId,
    difficulty: sessionStats.difficulty,
    device: sessionStats.device
  });

  window.dispatchEvent(new CustomEvent('hha:session', { detail: sessionStats }));
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
  sessionStats._sent             = true;

  emitEvent('session_end', {
    sessionId: sessionStats.sessionId,
    score: sessionStats.scoreFinal,
    comboMax: sessionStats.comboMax,
    misses: sessionStats.misses,
    durationSec: sessionStats.durationSecPlayed
  });

  try {
    window.dispatchEvent(new CustomEvent('hha:session', { detail: sessionStats }));
    window.dispatchEvent(new CustomEvent('hha:end',     { detail: sessionStats }));
  } catch (e) {
    console.warn('hha:end dispatch error', e);
  }
}

// ---------- Quest Preset ----------
const QUEST_PRESETS = {
  easy: {
    goal: {
      id: 'g_score_e',
      label: 'ทำคะแนนให้ได้ 1,200 คะแนนขึ้นไป',
      metric: 'score',
      target: 1200
    },
    mini: {
      id: 'm_good_e',
      label: 'ยิงของดีให้โดนอย่างน้อย 20 ชิ้น',
      metric: 'goodHits',
      target: 20
    }
  },
  normal: {
    goal: {
      id: 'g_score_n',
      label: 'ทำคะแนนให้ได้ 1,600 คะแนนขึ้นไป',
      metric: 'score',
      target: 1600
    },
    mini: {
      id: 'm_good_n',
      label: 'ยิงของดีให้โดนอย่างน้อย 25 ชิ้น',
      metric: 'goodHits',
      target: 25
    }
  },
  hard: {
    goal: {
      id: 'g_score_h',
      label: 'ทำคะแนนให้ได้ 2,000 คะแนนขึ้นไป',
      metric: 'score',
      target: 2000
    },
    mini: {
      id: 'm_good_h',
      label: 'ยิงของดีให้โดนอย่างน้อย 30 ชิ้น',
      metric: 'goodHits',
      target: 30
    }
  }
};

function setupQuest(diff) {
  const preset = QUEST_PRESETS[diff] || QUEST_PRESETS.normal;
  questState = {
    goal: { ...preset.goal, progress: 0, done: false },
    mini: { ...preset.mini, progress: 0, done: false }
  };
  pushQuest('เริ่มเกม');
}

function questProgress(metric) {
  if (!sessionStats) return 0;
  switch (metric) {
    case 'score':     return window.score | 0;
    case 'goodHits':  return sessionStats.goodHits | 0;
    case 'comboMax':  return comboMaxInternal | 0;
    case 'time':      return tickSec | 0;
    case 'feverTime': return sessionStats.feverTimeTotalSec | 0;
    default:          return 0;
  }
}

function updateQuestState() {
  if (!questState) return;

  ['goal','mini'].forEach(k => {
    const q = questState[k];
    if (!q) return;
    const p = questProgress(q.metric);
    q.progress = p;
    if (!q.done && p >= q.target) {
      q.done = true;
      emitEvent('quest_done', { id: q.id, kind: k, label: q.label });
    }
  });
}

function pushQuest(hint) {
  if (!questState) return;
  updateQuestState();

  const detail = {
    goal: questState.goal,
    mini: questState.mini,
    hint: hint || ''
  };

  try {
    window.dispatchEvent(new CustomEvent('quest:update', { detail }));
    window.dispatchEvent(new CustomEvent('hha:quest',     { detail }));
  } catch (e) {
    console.warn('quest:update error', e);
  }
}

// ---------- Fever / Score helper ----------
function mult() {
  return window.FEVER_ACTIVE ? 2 : 1;
}

function gainFever(n) {
  if (window.FEVER_ACTIVE) return;
  fever = Math.max(0, Math.min(100, fever + n));
  setFever(fever);
  if (fever >= 100) {
    feverStart();
  }
}

function decayFever(base) {
  const d = window.FEVER_ACTIVE ? 10 : base;
  fever = Math.max(0, fever - d);
  setFever(fever);
  if (window.FEVER_ACTIVE && fever <= 0) {
    window.FEVER_ACTIVE = false;
    setFeverActive(false);
    emitEvent('fever', { state: 'end' });
  }
}

// ---------- Global helpers ----------
function feverStart() {
  if (window.FEVER_ACTIVE) return;
  fever = 100;
  setFever(fever);
  window.FEVER_ACTIVE = true;
  setFeverActive(true);
  if (sessionStats) {
    sessionStats.feverActivations += 1;
  }
  emitEvent('fever', { state: 'start' });
}

window.feverStart = feverStart;

window.popupText = function(text, pos, color = '#fff') {
  const worldPos = { x: 0, y: (pos && pos.y) || 1.4, z: -1.5 };
  floatScore(sceneEl, worldPos, text, color);
};

// ---------- Spawn / Hit ----------
function classifyLane(x) {
  if (x < -1.0) return 'L';
  if (x >  1.0) return 'R';
  return 'C';
}

function spawnTarget() {
  if (!window.running) return;
  const cfg = gameConfig;
  const isGood = Math.random() < 0.65;
  const usePower = Math.random() < 0.08;

  let char;
  let type;
  let palette;

  if (usePower) {
    char = BONUS[(Math.random() * BONUS.length) | 0];
    type = 'good';
    palette = 'groups';
  } else if (isGood) {
    char = GOOD[(Math.random() * GOOD.length) | 0];
    type = 'good';
    palette = 'goodjunk';
  } else {
    char = JUNK[(Math.random() * JUNK.length) | 0];
    type = 'bad';
    palette = 'plate';
  }

  const scale = cfg.size * 0.6;
  const el = emojiImage(char, scale);
  el.dataset.type = type;
  el.dataset.char = char;
  el.dataset.palette = palette;
  el.dataset.hhaTgt = '1';
  el.setAttribute('data-hha-tgt', '1');

  const x = (Math.random() - 0.5) * 4;
  const y = 1.0 + Math.random() * 1.0;
  const z = -2.5 - Math.random() * 1.0;
  el.setAttribute('position', `${x} ${y} ${z}`);

  // id สำหรับ RT / lane
  const id = (++targetSeq).toString();
  el.dataset.hhaId = id;
  const nowMs = Date.now();
  const lane = classifyLane(x);
  activeTargets.set(id, {
    spawnMs: nowMs,
    emoji: char,
    type,
    lane,
    palette
  });

  emitEvent('spawn', {
    targetId: id,
    emoji: char,
    type,
    lane,
    relMs: nowMs - sessionStartMs
  });

  targetRoot.appendChild(el);

  // หมดอายุ
  setTimeout(() => {
    if (!el || !el.parentNode) return;
    const info = activeTargets.get(id);
    activeTargets.delete(id);

    if (type === 'good') {
      // ปล่อยของดีหลุด → miss
      window.misses++;
      if (sessionStats) sessionStats.misses = window.misses;
      window.combo = 0;
      emitEvent('timeout_good', {
        targetId: id,
        emoji: char,
        lane: info ? info.lane : null
      });
      window.dispatchEvent(new CustomEvent('hha:miss', {}));
    } else {
      // หลบของขยะได้ → bonus เล็กน้อย
      gainFever(4);
      emitEvent('timeout_junk', {
        targetId: id,
        emoji: char,
        lane: info ? info.lane : null
      });
    }
    el.remove();
    updateQuestState();
    pushQuest('');
  }, cfg.life);

  spawnTimer = setTimeout(spawnTarget, cfg.rate);
}

function onHitTarget(targetEl) {
  if (!targetEl || !targetEl.parentNode) return;

  const type = targetEl.dataset.type;
  const char = targetEl.dataset.char;
  const palette = targetEl.dataset.palette;
  const id = targetEl.dataset.hhaId || null;
  const pos = targetEl.object3D.getWorldPosition(new THREE.Vector3());

  const info = id ? activeTargets.get(id) : null;
  const nowMs = Date.now();
  const rtMs = info ? (nowMs - info.spawnMs) : null;
  const lane = info ? info.lane : classifyLane(pos.x);

  if (id) activeTargets.delete(id);

  let scoreDelta = 0;

  if (type === 'good') {
    if (sessionStats) {
      sessionStats.goodHits += 1;
      if (char === STAR) sessionStats.starHits += 1;
      else if (char === DIA) sessionStats.diamondHits += 1;
      else if (char === SHIELD_EMOJI) sessionStats.shieldHits += 1;
      else if (char === FIRE) sessionStats.fireHits += 1;
    }

    if (char === STAR) {
      scoreDelta = 40 * mult();
      gainFever(10);
    } else if (char === DIA) {
      scoreDelta = 80 * mult();
      gainFever(30);
    } else if (char === SHIELD_EMOJI) {
      scoreDelta = 20;
      shield = Math.min(3, shield + 1);
      setShield(shield);
    } else if (char === FIRE) {
      scoreDelta = 25;
      feverStart();
    } else {
      scoreDelta = (20 + window.combo * 2) * mult();
      gainFever(8 + window.combo * 0.6);
    }

    window.score += scoreDelta;
    window.combo++;
    comboMaxInternal = Math.max(comboMaxInternal, window.combo);
    if (sessionStats) {
      sessionStats.comboMax = Math.max(sessionStats.comboMax || 0, comboMaxInternal);
    }

    burstAt(sceneEl, pos, { mode: palette });
    floatScore(sceneEl, pos, `+${scoreDelta}`, '#22c55e');

    emitEvent('hit_good', {
      targetId: id,
      emoji: char,
      lane,
      rtMs,
      scoreDelta,
      scoreAfter: window.score,
      combo: window.combo,
      misses: window.misses,
      fever: window.FEVER_ACTIVE ? 1 : 0
    });

  } else {
    if (sessionStats) {
      sessionStats.junkHits += 1;
    }

    if (shield > 0) {
      shield--;
      setShield(shield);
      burstAt(sceneEl, pos, { mode: 'hydration' });
      floatScore(sceneEl, pos, 'SHIELDED!', '#60a5fa');

      emitEvent('hit_junk_shield', {
        targetId: id,
        emoji: char,
        lane,
        rtMs,
        scoreAfter: window.score,
        combo: window.combo,
        misses: window.misses
      });
    } else {
      scoreDelta = -15;
      window.score = Math.max(0, window.score + scoreDelta);
      window.combo = 0;
      window.misses++;
      if (sessionStats) sessionStats.misses = window.misses;

      decayFever(18);
      window.dispatchEvent(new CustomEvent('hha:miss', {}));
      burstAt(sceneEl, pos, { mode: palette });
      floatScore(sceneEl, pos, `${scoreDelta}`, '#ef4444');

      emitEvent('hit_junk', {
        targetId: id,
        emoji: char,
        lane,
        rtMs,
        scoreDelta,
        scoreAfter: window.score,
        combo: window.combo,
        misses: window.misses,
        fever: window.FEVER_ACTIVE ? 1 : 0
      });
    }
  }

  window.dispatchEvent(new CustomEvent('hha:score', {
    detail: { score: window.score, combo: window.combo, delta: scoreDelta }
  }));

  targetEl.remove();
  updateQuestState();
  pushQuest('');
}

// ---------- Game Tick ----------
function gameTick() {
  if (!window.running) return;
  tickSec++;

  if (sessionStats && window.FEVER_ACTIVE) {
    sessionStats.feverTimeTotalSec += 1;
  }

  decayFever(window.combo <= 0 ? 6 : 2);
  updateQuestState();
  pushQuest('');
}

// ---------- Public Controller ----------
export const GameEngine = {
  start(level) {
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('A-Frame scene not found');
      return;
    }

    // ล้าง target root เดิม
    if (targetRoot) targetRoot.remove();
    targetRoot = document.createElement('a-entity');
    targetRoot.id = 'targetRoot';
    sceneEl.appendChild(targetRoot);

    // UI / FX
    ensureFeverBar();
    setShardMode('goodjunk');

    // reset state
    window.score = 0;
    window.combo = 0;
    window.misses = 0;
    comboMaxInternal = 0;
    shield = 0;
    fever = 0;
    window.FEVER_ACTIVE = false;
    window.running = true;
    setFever(0);
    setShield(0);
    setFeverActive(false);
    activeTargets.clear();
    tickSec = 0;

    const url = new URL(window.location.href);
    const p = url.searchParams;
    const meta = {
      difficulty: (level || 'normal'),
      durationSec: 60,
      playerId:  p.get('pid')   || p.get('player') || '',
      group:     p.get('group') || '',
      prePost:   p.get('prePost') || p.get('phase') || '',
      className: p.get('class') || p.get('room')  || '',
      school:    p.get('school') || ''
    };
    beginSession(meta);

    difficulty.set(level);
    gameConfig = difficulty.get(); // { size, rate, life }

    if (gameTimer)  clearInterval(gameTimer);
    if (spawnTimer) clearTimeout(spawnTimer);
    gameTimer  = setInterval(gameTick, 1000);
    spawnTimer = setTimeout(spawnTarget, 1000);

    setupQuest(meta.difficulty || 'normal');
    pushQuest('เริ่มภารกิจหลัก และ Mini Quest');

    // ---------- Input Binding ----------
    if (!inputsBound) {
      inputsBound = true;

      // รองรับการคลิกจาก cursor / controller
      sceneEl.addEventListener('click', (e) => {
        if (e.target && e.target.dataset && e.target.dataset.hhaTgt) {
          onHitTarget(e.target);
        }
      });

      // รองรับเมาส์บน PC (คลิก canvas ผ่าน cursor)
      sceneEl.addEventListener('loaded', () => {
        const canvas = sceneEl.canvas;
        if (!canvas) return;
        canvas.addEventListener('mousedown', () => {
          if (!window.running) return;
          const cursor = document.getElementById('cursor');
          if (!cursor) return;
          const ray = cursor.components && cursor.components.raycaster;
          if (!ray) return;
          const hit = ray.intersectedEls && ray.intersectedEls[0];
          if (hit && hit.dataset && hit.dataset.hhaTgt) {
            onHitTarget(hit);
          }
        });
      });
    }

    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: { score: 0, combo: 0, delta: 0 }
    }));
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
