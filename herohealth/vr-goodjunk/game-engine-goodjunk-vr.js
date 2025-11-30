// === /herohealth/vr/game-engine-goodjunk-vr.js ===
// Good vs Junk — VR Engine (PC / Mobile / VR Headset)
// - spawn emoji targets ใน A-Frame (ใช้ a-image + dataURL)
// - เก็บ score / combo / misses เป็น global (window.*)
// - ส่ง event สำหรับวิจัย: hha:session, hha:event (RT, emoji, lane), hha:end

const GOOD = ['🥦','🥕','🍎','🍌','🍇','🥗','🐟','🥜','🍚','🍞','🥛','🍓','🍊','🥬','🥝','🍍','🍐'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];
const STAR = '⭐';
const DIA  = '💎';
const SHIELD_EMOJI = '🛡️';
const FIRE = '🔥';
const BONUS = [STAR, DIA, SHIELD_EMOJI, FIRE];

const DIFF_CFG = {
  easy:   { spawn: 950, life: 2400, size: 0.75 },
  normal: { spawn: 780, life: 2100, size: 0.65 },
  hard:   { spawn: 640, life: 1800, size: 0.55 }
};

function laneFromX(x) {
  if (x < -0.7) return 'L';
  if (x >  0.7) return 'R';
  return 'C';
}

function detectDeviceType() {
  const ua = (navigator.userAgent || '').toLowerCase();
  const isMobile = /android|iphone|ipad|ipod/.test(ua);
  const isVR = /oculus|quest|vive|mixed reality|vr/i.test(navigator.userAgent || '');
  if (isVR) return 'vr-headset';
  if (isMobile) return 'mobile';
  return 'desktop';
}

// --- emoji → dataURL (ใช้ซ้ำได้) ---
const emojiCache = {};
function emojiSprite(emo, px = 256) {
  const key = emo + '@' + px;
  if (emojiCache[key]) return emojiCache[key];

  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, px, px);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = (px * 0.8) + 'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = px * 0.10;
  ctx.fillText(emo, px / 2, px / 2);

  const url = c.toDataURL('image/png');
  emojiCache[key] = url;
  return url;
}

function judgeKind(ch) {
  if (GOOD.includes(ch)) return 'good';
  if (JUNK.includes(ch)) return 'junk';
  if (BONUS.includes(ch)) return 'power';
  return 'other';
}

const GameEngineVR = (() => {
  const state = {
    running: false,
    difficulty: 'normal',
    sessionId: null,
    startPerf: 0,
    playedSec: 0,

    scene: null,
    targetRoot: null,
    spawnTimer: null,
    tickTimer: null,

    clickHandler: null,
    canvasHandler: null,

    cfg: DIFF_CFG.normal
  };

  function resetGlobals() {
    window.score    = 0;
    window.combo    = 0;
    window.comboMax = 0;
    window.misses   = 0;
  }

  function emit(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (e) {
      console.warn('[GameEngineVR] emit error', name, e);
    }
  }

  function logSession() {
    const sessionId = 'GJVR-' + Date.now();
    state.sessionId = sessionId;
    emit('hha:session', {
      sessionId,
      mode: 'goodjunk-vr',
      difficulty: state.difficulty,
      device: detectDeviceType(),
      startedAt: new Date().toISOString()
    });
  }

  function logHitEvent(opts) {
    const {
      emoji,
      kind,
      judgment,
      rtMs,
      scoreDelta,
      lane
    } = opts;

    emit('hha:event', {
      sessionId: state.sessionId,
      mode: 'goodjunk-vr',
      difficulty: state.difficulty,
      emoji,
      kind,
      judgment,
      rtMs,
      scoreDelta,
      scoreAfter: window.score | 0,
      combo: window.combo | 0,
      misses: window.misses | 0,
      lane,
      tRelMs: performance.now() - state.startPerf
    });
  }

  function logEnd() {
    emit('hha:end', {
      sessionId: state.sessionId,
      mode: 'goodjunk-vr',
      difficulty: state.difficulty,
      score: window.score | 0,
      comboMax: window.comboMax | 0,
      misses: window.misses | 0,
      durationSec: state.playedSec || 60
    });
  }

  // ---------- สร้างเป้า ----------
  function createTargetEntity(emoji, cfg) {
    // ใช้ a-image + dataURL ทำเป็น sprite
    const el = document.createElement('a-image');
    el.setAttribute('src', emojiSprite(emoji, 256));
    el.setAttribute('transparent', 'true');
    el.setAttribute('alpha-test', '0.2');
    el.setAttribute('side', 'double');
    el.setAttribute('look-at', '#camera'); // หันเข้าหากล้องเสมอ

    // ขนาดขึ้นกับ diff
    const size = cfg.size;
    el.setAttribute('width',  size.toString());
    el.setAttribute('height', size.toString());

    el.setAttribute('data-hha-tgt', '1');   // ให้ raycaster เจอ
    el.dataset.emoji = emoji;

    // random ตำแหน่งในโดมด้านหน้า
    const x = (Math.random() - 0.5) * 2.4;  // -1.2 ถึง 1.2
    const y = 1.0 + Math.random() * 1.1;    // 1.0 - 2.1
    const z = -2.0 - Math.random() * 1.4;   // -2.0 ถึง -3.4

    const lane = laneFromX(x);
    el.setAttribute('position', `${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
    el.dataset.lane = lane;
    el.dataset.spawnAt = String(performance.now());
    el.dataset.kind = judgeKind(emoji);

    return el;
  }

  function spawnOne() {
    if (!state.running || !state.targetRoot) return;

    const cfg = state.cfg;

    let emoji;
    if (Math.random() < 0.10) {
      // power-up 10%
      emoji = BONUS[(Math.random() * BONUS.length) | 0];
    } else {
      const isGood = Math.random() < 0.65;
      emoji = isGood
        ? GOOD[(Math.random() * GOOD.length) | 0]
        : JUNK[(Math.random() * JUNK.length) | 0];
    }

    const el = createTargetEntity(emoji, cfg);
    state.targetRoot.appendChild(el);

    const life = cfg.life;
    const lane = el.dataset.lane || 'C';
    const kind = el.dataset.kind || judgeKind(emoji);

    // เป้าหมดอายุ
    setTimeout(() => {
      if (!state.running) return;
      if (!el.parentNode) return; // โดนยิงแล้ว

      try { el.parentNode.removeChild(el); } catch {}

      logHitEvent({
        emoji,
        kind,
        judgment: 'expired',
        rtMs: null,
        scoreDelta: 0,
        lane
      });
    }, life);
  }

  function scheduleNextSpawn() {
    if (!state.running) return;
    clearTimeout(state.spawnTimer);
    state.spawnTimer = setTimeout(() => {
      spawnOne();
      scheduleNextSpawn();
    }, state.cfg.spawn);
  }

  // ---------- การยิงเป้า ----------
  function handleHit(targetEl) {
    if (!state.running || !targetEl || !targetEl.parentNode) return;

    const emoji   = targetEl.dataset.emoji || '?';
    const kind    = targetEl.dataset.kind || judgeKind(emoji);
    const lane    = targetEl.dataset.lane || 'C';
    const spawnAt = Number(targetEl.dataset.spawnAt || performance.now());
    const rtMs    = Math.max(0, Math.round(performance.now() - spawnAt));

    let scoreDelta = 0;
    let judgment   = 'hit';

    try { targetEl.parentNode.removeChild(targetEl); } catch {}

    if (kind === 'power') {
      if (emoji === STAR) {
        scoreDelta = 40;
      } else if (emoji === DIA) {
        scoreDelta = 80;
      } else if (emoji === SHIELD_EMOJI) {
        scoreDelta = 20;
      } else if (emoji === FIRE) {
        scoreDelta = 25;
      }
      window.score = (window.score | 0) + scoreDelta;
      window.combo = (window.combo | 0) + 1;
      window.comboMax = Math.max(window.comboMax | 0, window.combo | 0);

    } else if (kind === 'good') {
      const base = 16;
      const combo = window.combo | 0;
      scoreDelta = base + combo * 2;
      window.score = (window.score | 0) + scoreDelta;
      window.combo = combo + 1;
      window.comboMax = Math.max(window.comboMax | 0, window.combo | 0);

    } else if (kind === 'junk') {
      scoreDelta = -12;
      window.score = Math.max(0, (window.score | 0) + scoreDelta);
      window.combo = 0;
      window.misses = (window.misses | 0) + 1;
      judgment = 'hit-junk';
      emit('hha:miss', {});
    }

    emit('hha:score', {
      score: window.score | 0,
      combo: window.combo | 0,
      delta: scoreDelta
    });

    logHitEvent({
      emoji,
      kind,
      judgment,
      rtMs,
      scoreDelta,
      lane
    });
  }

  // ---------- input: click / tap / VR cursor ----------
  function attachInput(sceneEl) {
    if (state.clickHandler || state.canvasHandler) return;

    state.clickHandler = function (e) {
      const t = e.target;
      if (t && t.dataset && t.dataset.hhaTgt) {
        handleHit(t);
      }
    };
    sceneEl.addEventListener('click', state.clickHandler);

    function canvasHandler() {
      if (!state.running) return;
      const cursor = document.getElementById('cursor');
      if (!cursor || !cursor.components || !cursor.components.raycaster) return;
      const rc = cursor.components.raycaster;
      if (!rc.intersectedEls || !rc.intersectedEls.length) return;
      const target = rc.intersectedEls[0];
      if (target && target.dataset && target.dataset.hhaTgt) {
        handleHit(target);
      }
    }

    const canvas = sceneEl.canvas;
    if (canvas) {
      state.canvasHandler = canvasHandler;
      canvas.addEventListener('mousedown', canvasHandler);
      canvas.addEventListener('touchstart', canvasHandler, { passive: true });
    }
  }

  function detachInput() {
    if (state.scene && state.clickHandler) {
      state.scene.removeEventListener('click', state.clickHandler);
    }
    if (state.scene && state.scene.canvas && state.canvasHandler) {
      state.scene.canvas.removeEventListener('mousedown', state.canvasHandler);
      state.scene.canvas.removeEventListener('touchstart', state.canvasHandler);
    }
    state.clickHandler = null;
    state.canvasHandler = null;
  }

  function clearTargets() {
    if (state.targetRoot && state.targetRoot.parentNode) {
      try { state.targetRoot.parentNode.removeChild(state.targetRoot); } catch {}
    }
    state.targetRoot = null;
  }

  // ---------- public API ----------
  return {
    start(diff = 'normal') {
      if (state.running) this.stop();

      const scene = document.querySelector('a-scene');
      if (!scene) {
        console.error('[GameEngineVR] A-Frame scene not found');
        return;
      }

      const level = String(diff || 'normal').toLowerCase();
      state.difficulty = (level === 'easy' || level === 'hard') ? level : 'normal';
      state.cfg = DIFF_CFG[state.difficulty] || DIFF_CFG.normal;

      state.scene = scene;
      state.running = true;
      state.startPerf = performance.now();
      state.playedSec = 0;

      resetGlobals();

      clearTargets();
      const root = document.createElement('a-entity');
      root.id = 'gjvrTargetRoot';
      scene.appendChild(root);
      state.targetRoot = root;

      clearInterval(state.tickTimer);
      state.tickTimer = setInterval(() => {
        if (!state.running) return;
        state.playedSec = Math.floor((performance.now() - state.startPerf) / 1000);
      }, 1000);

      scheduleNextSpawn();
      attachInput(scene);
      logSession();

      emit('hha:score', { score: 0, combo: 0, delta: 0 });
    },

    stop() {
      if (!state.running) {
        // แต่ถ้า overlay เรียก stop ซ้ำ ตอนจบเกม ก็ไม่ต้อง error
        return;
      }
      state.running = false;

      clearTimeout(state.spawnTimer);
      clearInterval(state.tickTimer);
      state.spawnTimer = null;
      state.tickTimer = null;

      detachInput();
      clearTargets();
      logEnd();
    }
  };
})();

export { GameEngineVR };
export default GameEngineVR;
