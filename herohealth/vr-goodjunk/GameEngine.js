// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Game Engine + Session/Event logging (research-ready)

import {
  ensureFeverBar,
  setFever,
  setFeverActive,
  setShield
} from './ui-fever.js';

import { Difficulty } from './difficulty.js';
import { emojiImage } from './emoji-image.js';
import { burstAt, floatScore, setShardMode } from './aframe-particles.js';
import { Quest } from './quest-serial.js';

// ---------- Global ที่ Quest.js ต้องใช้ ----------
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

// ---------- ตัวแปรสำหรับวิจัย ----------
let sessionStats      = null;
let sessionStartMs    = 0;
let perfStart         = 0;
let comboMaxInternal  = 0;
let inputsBound       = false;

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

function makeTargetId() {
  return 't_' + Math.random().toString(36).slice(2, 10);
}

function emitEvent(detail) {
  try {
    window.dispatchEvent(new CustomEvent('hha:event', { detail }));
  } catch (_) {}
}

// ---------- Session summary ----------
function beginSession(meta) {
  const now = new Date();
  sessionStartMs = now.getTime();
  perfStart = performance.now();

  sessionStats = {
    sessionId:   makeSessionId(),
    game:        'Good vs Junk',
    mode:        'goodjunk-vr',
    difficulty:  meta.difficulty || 'normal',

    // experiment meta (อ่านจาก URL)
    playerId:   meta.playerId   || '',
    group:      meta.group      || '',
    prePost:    meta.prePost    || '',
    className:  meta.className  || '',
    school:     meta.school     || '',

    device:       detectDeviceType(),
    userAgent:    navigator.userAgent || '',
    startTimeIso: now.toISOString(),
    endTimeIso:   null,
    durationSecPlanned: meta.durationSec || 60,
    durationSecPlayed:  0,

    scoreFinal: 0,
    comboMax:   0,
    misses:     0,

    goodHits:    0,
    junkHits:    0,
    starHits:    0,
    diamondHits: 0,
    shieldHits:  0,
    fireHits:    0,

    feverActivations:  0,
    feverTimeTotalSec: 0,

    _sent: false
  };
}

function finishSession() {
  if (!sessionStats || sessionStats._sent) return;

  const nowMs = Date.now();
  const now   = new Date(nowMs);
  const dur   = Math.max(0, Math.round((nowMs - sessionStartMs) / 1000));

  sessionStats.endTimeIso        = now.toISOString();
  sessionStats.durationSecPlayed = dur;
  sessionStats.scoreFinal        = window.score | 0;
  sessionStats.comboMax          = Math.max(sessionStats.comboMax || 0, comboMaxInternal | 0);
  sessionStats.misses            = window.misses | 0;
  sessionStats._sent             = true;

  try {
    window.dispatchEvent(new CustomEvent('hha:session', { detail: sessionStats }));
    window.dispatchEvent(new CustomEvent('hha:end',     { detail: sessionStats }));
  } catch (e) {
    console.warn('hha:session dispatch error', e);
  }
}

// ---------- Global helpers ให้ Quest.js ใช้ ----------
window.emit = function(name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); }
  catch (e) {}
};

window.feverStart = function() {
  if (window.FEVER_ACTIVE) return;
  fever = 100;
  setFever(fever);
  window.FEVER_ACTIVE = true;
  setFeverActive(true);

  if (sessionStats) sessionStats.feverActivations += 1;

  Quest.onFever();
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

// lane จากตำแหน่ง X ในโลก
function laneFromX(x) {
  if (x < -1.1) return 'L';
  if (x >  1.1) return 'R';
  return 'C';
}

function spawnTarget() {
  if (!window.running) return;
  const cfg = gameConfig;
  if (!cfg) return;

  const isGood   = Math.random() < 0.65;
  const usePower = Math.random() < 0.08;

  let char, type, palette;
  if (usePower) {
    char    = BONUS[(Math.random() * BONUS.length) | 0];
    type    = 'good';
    palette = 'groups';
  } else if (isGood) {
    char    = GOOD[(Math.random() * GOOD.length) | 0];
    type    = 'good';
    palette = 'goodjunk';
  } else {
    char    = JUNK[(Math.random() * JUNK.length) | 0];
    type    = 'bad';
    palette = 'plate';
  }

  const scale = cfg.size * 0.6;
  const el    = emojiImage(char, scale);

  const x = (Math.random() - 0.5) * 4;         // -2..2
  const y = 1.0 + Math.random() * 1.0;         // 1..2
  const z = -2.5 - Math.random() * 1.0;        // -2.5..-3.5
  const lane = laneFromX(x);
  const born = performance.now();

  el.setAttribute('position', `${x} ${y} ${z}`);
  el.setAttribute('data-hha-tgt', '1');
  el.dataset.type  = type;
  el.dataset.char  = char;
  el.dataset.lane  = lane;
  el.dataset.spawn = String(born);
  el.dataset.id    = makeTargetId();
  el.dataset.palette = palette;

  targetRoot.appendChild(el);

  // ถ้าเป้าหมดอายุแล้วยังไม่โดน
  const life = cfg.life;
  setTimeout(() => {
    if (!el || !el.parentNode) return;
    const nowPerf = performance.now();
    const bornMs  = Number(el.dataset.spawn || 0);
    const ageMs   = bornMs ? Math.round(nowPerf - bornMs) : life;

    const baseEvent = {
      sessionId: sessionStats ? sessionStats.sessionId : '',
      tsIso: new Date().toISOString(),
      tRelMs: perfStart ? Math.round(nowPerf - perfStart) : null,
      targetId: el.dataset.id || '',
      emoji: el.dataset.char || '',
      lane: el.dataset.lane || 'C',
      rtMs: null,
      ageMs,
      difficulty: sessionStats ? sessionStats.difficulty : '',
      device: sessionStats ? sessionStats.device : detectDeviceType(),
      scoreAfter: window.score | 0,
      comboAfter: window.combo | 0,
      missesAfter: window.misses | 0
    };

    if (type === 'good') {
      // ปล่อยของดีหลุด → miss
      window.misses++;
      if (sessionStats) sessionStats.misses = window.misses;
      window.combo = 0;
      window.emit('hha:miss', {});

      emitEvent({
        ...baseEvent,
        event: 'timeout',
        kind:  'miss-good'
      });
    } else {
      // หลบของขยะได้
      gainFever(4);
      emitEvent({
        ...baseEvent,
        event: 'timeout',
        kind:  'skip-junk'
      });
    }
    el.remove();
  }, life);

  spawnTimer = setTimeout(spawnTarget, cfg.rate);
}

function onHitTarget(targetEl) {
  if (!targetEl || !targetEl.parentNode) return;

  const type    = targetEl.dataset.type;
  const char    = targetEl.dataset.char;
  const palette = targetEl.dataset.palette;
  const lane    = targetEl.dataset.lane || 'C';
  const id      = targetEl.dataset.id   || '';
  const pos     = targetEl.object3D.getWorldPosition(new THREE.Vector3());

  const nowPerf = performance.now();
  const bornMs  = Number(targetEl.dataset.spawn || 0);
  const rtMs    = bornMs ? Math.max(0, Math.round(nowPerf - bornMs)) : null;

  let scoreDelta = 0;

  if (type === 'good') {
    // ---------- good / power-up ----------
    if (sessionStats) {
      sessionStats.goodHits += 1;
      if (char === STAR)        sessionStats.starHits    += 1;
      else if (char === DIA)    sessionStats.diamondHits += 1;
      else if (char === SHIELD_EMOJI) sessionStats.shieldHits += 1;
      else if (char === FIRE)   sessionStats.fireHits    += 1;
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
      window.feverStart();
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

    Quest.onGood();
    burstAt(sceneEl, pos, { mode: palette });
    floatScore(sceneEl, pos, `+${scoreDelta}`, '#22c55e');

    emitEvent({
      sessionId: sessionStats ? sessionStats.sessionId : '',
      tsIso: new Date().toISOString(),
      tRelMs: perfStart ? Math.round(nowPerf - perfStart) : null,
      event: 'hit',
      kind:  'good',
      targetId: id,
      emoji: char,
      lane,
      rtMs,
      difficulty: sessionStats ? sessionStats.difficulty : '',
      device: sessionStats ? sessionStats.device : detectDeviceType(),
      scoreDelta,
      scoreAfter: window.score | 0,
      comboAfter: window.combo | 0,
      missesAfter: window.misses | 0
    });

  } else {
    // ---------- bad (junk) ----------
    if (sessionStats) sessionStats.junkHits += 1;

    if (shield > 0) {
      shield--;
      setShield(shield);
      burstAt(sceneEl, pos, { mode: 'hydration' });
      floatScore(sceneEl, pos, 'SHIELDED!', '#60a5fa');

      emitEvent({
        sessionId: sessionStats ? sessionStats.sessionId : '',
        tsIso: new Date().toISOString(),
        tRelMs: perfStart ? Math.round(nowPerf - perfStart) : null,
        event: 'hit',
        kind:  'junk-shield',
        targetId: id,
        emoji: char,
        lane,
        rtMs,
        difficulty: sessionStats ? sessionStats.difficulty : '',
        device: sessionStats ? sessionStats.device : detectDeviceType(),
        scoreDelta: 0,
        scoreAfter: window.score | 0,
        comboAfter: window.combo | 0,
        missesAfter: window.misses | 0
      });

    } else {
      scoreDelta = -15;
      window.score = Math.max(0, window.score + scoreDelta);
      window.combo = 0;
      window.misses++;
      if (sessionStats) sessionStats.misses = window.misses;

      decayFever(18);
      Quest.onBad();
      window.emit('hha:miss', {});
      burstAt(sceneEl, pos, { mode: palette });
      floatScore(sceneEl, pos, `${scoreDelta}`, '#ef4444');

      emitEvent({
        sessionId: sessionStats ? sessionStats.sessionId : '',
        tsIso: new Date().toISOString(),
        tRelMs: perfStart ? Math.round(nowPerf - perfStart) : null,
        event: 'hit',
        kind:  'junk-penalty',
        targetId: id,
        emoji: char,
        lane,
        rtMs,
        difficulty: sessionStats ? sessionStats.difficulty : '',
        device: sessionStats ? sessionStats.device : detectDeviceType(),
        scoreDelta,
        scoreAfter: window.score | 0,
        comboAfter: window.combo | 0,
        missesAfter: window.misses | 0
      });
    }
  }

  window.emit('hha:score', {
    score: window.score,
    combo: window.combo,
    delta: scoreDelta
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

    // ล้าง target เดิม
    if (targetRoot) targetRoot.remove();
    targetRoot = document.createElement('a-entity');
    targetRoot.id = 'targetRoot';
    sceneEl.appendChild(targetRoot);

    // UI / FX
    ensureFeverBar();
    setShardMode('goodjunk');

    // reset state
    window.score   = 0;
    window.combo   = 0;
    window.misses  = 0;
    comboMaxInternal = 0;
    shield         = 0;
    fever          = 0;
    window.FEVER_ACTIVE = false;
    window.running      = true;
    setFever(0);
    setShield(0);
    setFeverActive(false);

    // metadata จาก URL
    const url = new URL(window.location.href);
    const p   = url.searchParams;
    const meta = {
      difficulty: (level || 'normal'),
      durationSec: 60,
      playerId:   p.get('pid')   || p.get('player') || '',
      group:      p.get('group') || '',
      prePost:    p.get('prePost') || p.get('phase') || '',
      className:  p.get('class') || p.get('room') || '',
      school:     p.get('school') || ''
    };
    beginSession(meta);

    // difficulty
    difficulty.set(level);
    gameConfig = difficulty.get();

    if (gameTimer)  clearInterval(gameTimer);
    if (spawnTimer) clearTimeout(spawnTimer);
    gameTimer  = setInterval(gameTick, 1000);
    spawnTimer = setTimeout(spawnTarget, 1000);

    Quest.start();

    // ---------- Input (PC / Mobile / VR) ----------
    if (!inputsBound) {
      inputsBound = true;

      // click จาก VR trigger / gaze cursor
      sceneEl.addEventListener('click', (e) => {
        if (e.target && e.target.dataset && e.target.dataset.hhaTgt) {
          onHitTarget(e.target);
        }
      });

      // เมาส์บน PC
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

    window.emit('hha:score', { score: 0, combo: 0, delta: 0 });
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

    Quest.stop();

    if (targetRoot) {
      try { targetRoot.remove(); } catch {}
      targetRoot = null;
    }

    finishSession();
  }
};

export default GameEngine;
