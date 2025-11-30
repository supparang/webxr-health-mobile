// === /herohealth/vr/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Game Engine + Session & Event Stats (Research-ready)

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
window.score         = 0;
window.combo         = 0;
window.misses        = 0;
window.FEVER_ACTIVE  = false;
window.running       = false;

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

// ---------- ตัวแปรสำหรับวิจัย (Session Stats & Event) ----------
let sessionStats      = null;
let sessionStartMs    = 0;
let comboMaxInternal  = 0;
let inputsBound       = false;

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

function nowMs() {
  if (window.performance && performance.now) return performance.now();
  return Date.now();
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

    device:        detectDeviceType(),
    userAgent:     navigator.userAgent || '',
    startTimeIso:  now.toISOString(),
    endTimeIso:    null,
    durationSecPlanned: meta.durationSec || 60,
    durationSecPlayed:  0,

    // gameplay summary
    scoreFinal: 0,
    comboMax:   0,
    misses:     0,
    grade:      '',

    // counters
    goodHits:    0,
    junkHits:    0,
    starHits:    0,
    diamondHits: 0,
    shieldHits:  0,
    fireHits:    0,

    feverActivations:   0,
    feverTimeTotalSec:  0,   // นับเป็นวินาทีจากเกม tick

    // optional quest summary (เพิ่มได้ภายหลัง)
    mainGoalId:    '',
    mainGoalLabel: '',

    _sent: false          // flag กันส่งซ้ำ
  };
}

function calcGrade(score, diff, comboMax) {
  const base = score | 0;
  const combo = comboMax | 0;
  let sSSS = 2400;
  let sSS  = 2000;
  let sS   = 1600;
  let sA   = 1200;
  let sB   = 800;

  if (diff === 'easy') {
    sSSS -= 400;
    sSS  -= 300;
    sS   -= 200;
    sA   -= 150;
    sB   -= 100;
  } else if (diff === 'hard') {
    sSSS += 300;
    sSS  += 250;
    sS   += 200;
    sA   += 150;
    sB   += 100;
  }

  if (base >= sSSS && combo >= 20) return 'SSS';
  if (base >= sSS)                 return 'SS';
  if (base >= sS)                  return 'S';
  if (base >= sA)                  return 'A';
  if (base >= sB)                  return 'B';
  return 'C';
}

function finishSession() {
  if (!sessionStats || sessionStats._sent) return;

  const nowMsAbs  = Date.now();
  const now       = new Date(nowMsAbs);
  const durSec    = Math.max(0, Math.round((nowMsAbs - sessionStartMs) / 1000));

  sessionStats.endTimeIso        = now.toISOString();
  sessionStats.durationSecPlayed = durSec;
  sessionStats.scoreFinal        = window.score | 0;
  sessionStats.comboMax          = Math.max(sessionStats.comboMax || 0, comboMaxInternal | 0);
  sessionStats.misses            = window.misses | 0;

  const grade = calcGrade(sessionStats.scoreFinal, sessionStats.difficulty, sessionStats.comboMax);
  sessionStats.grade = grade;

  sessionStats._sent = true;

  try {
    window.dispatchEvent(new CustomEvent('hha:session', { detail: sessionStats }));
    window.dispatchEvent(new CustomEvent('hha:end',     { detail: sessionStats }));
    window.dispatchEvent(new CustomEvent('hha:grade',   { detail: { grade } }));
  } catch (e) {
    console.warn('hha:session dispatch error', e);
  }
}

// ---------- helper event ----------
function emitEvent(evObj) {
  try {
    window.dispatchEvent(new CustomEvent('hha:event', { detail: evObj }));
  } catch (e) {
    // เงียบไว้
  }
}

// ---------- Global helpers ให้ Quest.js ใช้ ----------
window.emit = function(name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); }
  catch (e) { /* เงียบไป */ }
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

function laneFromX(x) {
  if (x <= -1.2) return 'L';
  if (x >=  1.2) return 'R';
  return 'M';
}

function spawnTarget() {
  if (!window.running) return;
  const cfg = gameConfig;
  const isGood   = Math.random() < 0.65;
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

  const scale = cfg.size * 0.7; // โตขึ้นหน่อยให้เล็งง่าย
  const el = emojiImage(char, scale);
  el.dataset.type    = type;
  el.dataset.char    = char;
  el.dataset.palette = palette;
  el.setAttribute('data-hha-tgt', '1');

  const x = (Math.random() - 0.5) * 4;
  const y = 1.0 + Math.random() * 1.0;
  const z = -2.5 - Math.random() * 1.0;
  el.setAttribute('position', `${x} ${y} ${z}`);

  // เก็บ lane + spawnTime สำหรับวิจัย RT
  el.dataset.lane    = laneFromX(x);
  el.dataset.spawnAt = String(nowMs());

  targetRoot.appendChild(el);

  // หมดอายุ (good หลุด = miss, junk หลุด = โบนัสเล็กน้อย)
  setTimeout(() => {
    if (el && el.parentNode) {
      const char = el.dataset.char;
      const lane = el.dataset.lane || '';
      if (el.dataset.type === 'good') {
        // ของดีหลุด → miss
        window.misses++;
        if (sessionStats) sessionStats.misses = window.misses;
        window.combo = 0;
        window.emit('hha:miss', { reason: 'timeout' });

        emitEvent({
          sessionId:   (sessionStats && sessionStats.sessionId) || '',
          type:        'timeout',
          emoji:       char || '',
          lane,
          rtMs:        cfg.life,
          totalScore:  window.score | 0,
          combo:       window.combo | 0,
          isGood:      true,
          itemType:    BONUS.includes(char) ? 'bonus' : 'good'
        });
      } else {
        // หลบของขยะ → เพิ่ม FEVER เบา ๆ
        gainFever(4);
      }
      el.remove();
    }
  }, cfg.life);

  spawnTimer = setTimeout(spawnTarget, cfg.rate);
}

function onHitTarget(targetEl) {
  if (!targetEl || !targetEl.parentNode) return;

  const type    = targetEl.dataset.type;
  const char    = targetEl.dataset.char;
  const palette = targetEl.dataset.palette;
  const pos     = targetEl.object3D.getWorldPosition(new THREE.Vector3());

  const spawnAt = Number(targetEl.dataset.spawnAt || '0');
  const tNow    = nowMs();
  const rtMs    = spawnAt ? Math.max(0, Math.round(tNow - spawnAt)) : '';

  let scoreDelta = 0;

  if (type === 'good') {
    // ---------- Good / Power-ups ----------
    if (sessionStats) {
      sessionStats.goodHits += 1;
      if (char === STAR)             sessionStats.starHits    += 1;
      else if (char === DIA)         sessionStats.diamondHits += 1;
      else if (char === SHIELD_EMOJI)sessionStats.shieldHits  += 1;
      else if (char === FIRE)        sessionStats.fireHits    += 1;
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

  } else {
    // ---------- Bad (ของขยะ) ----------
    if (sessionStats) {
      sessionStats.junkHits += 1;
    }

    if (shield > 0) {
      shield--;
      setShield(shield);
      burstAt(sceneEl, pos, { mode: 'hydration' });
      floatScore(sceneEl, pos, 'SHIELDED!', '#60a5fa');
    } else {
      scoreDelta = -15;
      window.score = Math.max(0, window.score + scoreDelta);
      window.combo = 0;
      window.misses++;
      if (sessionStats) sessionStats.misses = window.misses;

      decayFever(18);
      Quest.onBad();
      window.emit('hha:miss', { reason: 'hit-junk' });
      burstAt(sceneEl, pos, { mode: palette });
      floatScore(sceneEl, pos, `${scoreDelta}`, '#ef4444');
    }
  }

  window.emit('hha:score', {
    score: window.score,
    combo: window.combo,
    delta: scoreDelta
  });

  // event log ราย hit
  emitEvent({
    sessionId:  (sessionStats && sessionStats.sessionId) || '',
    type:       type === 'good'
                  ? (BONUS.includes(char) ? 'hit-bonus' : 'hit-good')
                  : 'hit-junk',
    emoji:      char || '',
    lane:       targetEl.dataset.lane || '',
    rtMs,
    totalScore: window.score | 0,
    combo:      window.combo | 0,
    isGood:     type === 'good',
    itemType:   type === 'good'
                  ? (BONUS.includes(char) ? 'bonus' : 'good')
                  : 'junk'
  });

  targetEl.remove();
}

function gameTick() {
  if (!window.running) return;

  // ใช้ tick นี้เก็บเวลา FEVER
  if (sessionStats && window.FEVER_ACTIVE) {
    sessionStats.feverTimeTotalSec += 1;
  }

  decayFever(window.combo <= 0 ? 6 : 2);
}

// ---------- Public Controller ----------
export const GameEngineVR = {
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

    // ------------ สร้าง sessionStats -------------
    const url = new URL(window.location.href);
    const p = url.searchParams;
    const meta = {
      difficulty: (level || 'normal'),
      durationSec: 60,                  // ตอนนี้เราใช้ 60s fixed จาก launcher
      playerId:   p.get('pid')   || p.get('player') || '',
      group:      p.get('group') || '',
      prePost:    p.get('prePost') || p.get('phase') || '',
      className:  p.get('class')   || p.get('room')  || '',
      school:     p.get('school')  || ''
    };
    beginSession(meta);

    // ตั้งค่าความยาก
    difficulty.set(level);
    gameConfig = difficulty.get(); // { size, rate, life }

    if (gameTimer)  clearInterval(gameTimer);
    if (spawnTimer) clearTimeout(spawnTimer);
    gameTimer = setInterval(gameTick, 1000);
    spawnTimer = setTimeout(spawnTarget, 1000);

    Quest.start(); // เริ่มระบบ Mini Quest / Serial Quest

    // ---------- Input Binding (PC / Mobile / VR) ----------
    if (!inputsBound) {
      inputsBound = true;

      // รองรับ click จาก VR trigger / gaze cursor (entity event)
      sceneEl.addEventListener('click', (e) => {
        if (e.target && e.target.dataset && e.target.dataset.hhaTgt) {
          onHitTarget(e.target);
        }
      });

      // รองรับเมาส์บน PC ผ่าน canvas + raycaster ของ cursor
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
      // ถ้าหยุดไปแล้ว แต่ยังไม่ส่ง session ก็ส่งอีกรอบได้
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
      try { targetRoot.remove(); } catch (e) {}
      targetRoot = null;
    }

    // ส่งสรุป session + hha:end + hha:grade
    finishSession();
  }
};

export default GameEngineVR;
