// === /herohealth/vr/game-engine-goodjunk-vr.js ===
// Good vs Junk — VR Engine (PC / Mobile / VR Headset)
// - spawn emoji targets ใน A-Frame
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
  easy:   { spawn: 950, life: 2400, size: 0.52 },
  normal: { spawn: 780, life: 2100, size: 0.46 },
  hard:   { spawn: 640, life: 1800, size: 0.40 }
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

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

  // global stats (ใช้ร่วมกับ HUD และ logger)
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
      kind,          // 'good' | 'junk' | 'power'
      judgment,      // 'hit' | 'shielded' | 'expired' ฯลฯ
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

  function judgeKind(ch) {
    if (GOOD.includes(ch)) return 'good';
    if (JUNK.includes(ch)) return 'junk';
    if (BONUS.includes(ch)) return 'power';
    return 'other';
  }

  function createTargetEntity(emoji, cfg) {
    const el = document.createElement('a-entity');
    // emoji ด้วย text component (ให้ A-Frame โหลด text geometry เอง)
    el.setAttribute('text', `value:${emoji}; align:center; color:#ffffff; width:2.2`);
    el.setAttribute('scale', `${cfg.size} ${cfg.size} ${cfg.size}`);
    el.setAttribute('data-hha-tgt', '1');
    el.dataset.emoji = emoji;

    // random ตำแหน่งใน cone ด้านหน้า
    const x = (Math.random() - 0.5) * 2.4;  // -1.2 ถึง 1.2
    const y = 1.0 + Math.random() * 1.0;    // 1.0 - 2.0
    const z = -2.2 - Math.random() * 1.2;   // -2.2 ถึง -3.4

    const lane = laneFromX(x);
    el.setAttribute('position', `${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
    el.dataset.lane = lane;
    el.dataset.spawnAt = String(performance.now());

    // mark ประเภท
    el.dataset.kind = judgeKind(emoji);

    return el;
  }

  function spawnOne() {
    if (!state.running || !state.targetRoot) return;

    const cfg = state.cfg;

    // random power-up 10%
    let emoji;
    if (Math.random() < 0.10) {
      emoji = BONUS[(Math.random() * BONUS.length) | 0];
    } else {
      const isGood = Math.random() < 0.65;
      if (isGood) {
        emoji = GOOD[(Math.random() * GOOD.length) | 0];
      } else {
        emoji = JUNK[(Math.random() * JUNK.length) | 0];
      }
    }

    const el = createTargetEntity(emoji, cfg);
    state.targetRoot.appendChild(el);

    const life = cfg.life;
    const spawnTime = Number(el.dataset.spawnAt || performance.now());
    const lane = el.dataset.lane || 'C';
    const kind = el.dataset.kind || judgeKind(emoji);

    // timeout: หมดอายุ (ถือเป็น expired event)
    setTimeout(() => {
      if (!state.running) return;
      if (!el.parentNode) return; // โดนยิงไปแล้ว
      try {
        el.parentNode.removeChild(el);
      } catch {}

      // log expired event
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

  function handleHit(targetEl) {
    if (!state.running || !targetEl || !targetEl.parentNode) return;

    const emoji = targetEl.dataset.emoji || '?';
    const kind  = targetEl.dataset.kind || judgeKind(emoji);
    const lane  = targetEl.dataset.lane || 'C';
    const spawnAt = Number(targetEl.dataset.spawnAt || performance.now());
    const rtMs = Math.max(0, Math.round(performance.now() - spawnAt));

    let scoreDelta = 0;
    let judgment   = 'hit';

    // ลบออกจาก scene ก่อน
    try {
      targetEl.parentNode.removeChild(targetEl);
    } catch {}

    // ----- Scoring -----
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
      // ยิงโดนของขยะ = miss
      scoreDelta = -12;
      window.score = Math.max(0, (window.score | 0) + scoreDelta);
      window.combo = 0;
      window.misses = (window.misses | 0) + 1;
      judgment = 'hit-junk';
      emit('hha:miss', {});  // ให้ HUD อัปเดตด้วย
    }

    // แจ้ง HUD
    emit('hha:score', {
      score: window.score | 0,
      combo: window.combo | 0,
      delta: scoreDelta
    });

    // log event
    logHitEvent({
      emoji,
      kind,
      judgment,
      rtMs,
      scoreDelta,
      lane
    });
  }

  function attachInput(sceneEl) {
    if (state.clickHandler || state.canvasHandler) return;

    // สำหรับ VR cursor / mobile tap → ใช้ event click ของ A-Frame
    state.clickHandler = function (e) {
      const t = e.target;
      if (t && t.dataset && t.dataset.hhaTgt) {
        handleHit(t);
      }
    };
    sceneEl.addEventListener('click', state.clickHandler);

    // สำหรับ desktop mouse กดบน canvas → ใช้ raycaster ของ cursor
    const canvas = sceneEl.canvas;
    if (!canvas) return;

    state.canvasHandler = function () {
      if (!state.running) return;
      const cursor = document.getElementById('cursor');
      if (!cursor) return;
      const rc = cursor.components && cursor.components.raycaster;
      if (!rc || !rc.intersectedEls || !rc.intersectedEls.length) return;
      const target = rc.intersectedEls[0];
      if (target && target.dataset && target.dataset.hhaTgt) {
        handleHit(target);
      }
    };

    canvas.addEventListener('mousedown', state.canvasHandler);
    canvas.addEventListener('touchstart', state.canvasHandler, { passive: true });
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
      try {
        state.targetRoot.parentNode.removeChild(state.targetRoot);
      } catch {}
    }
    state.targetRoot = null;
  }

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

      // container เป้า
      clearTargets();
      const root = document.createElement('a-entity');
      root.id = 'gjvrTargetRoot';
      scene.appendChild(root);
      state.targetRoot = root;

      // timer สำหรับวัดเวลาเล่น
      clearInterval(state.tickTimer);
      state.tickTimer = setInterval(() => {
        if (!state.running) return;
        const sec = Math.floor((performance.now() - state.startPerf) / 1000);
        state.playedSec = sec;
      }, 1000);

      // spawn เป้าเรื่อย ๆ
      scheduleNextSpawn();

      // attach input
      attachInput(scene);

      // log session
      logSession();

      // initial HUD score
      emit('hha:score', { score: 0, combo: 0, delta: 0 });
    },

    stop() {
      if (!state.running) {
        // ถ้าถูกเรียกซ้ำ ให้ยัง log end ได้ครั้งเดียว
        return;
      }
      state.running = false;

      clearTimeout(state.spawnTimer);
      clearInterval(state.tickTimer);
      state.spawnTimer = null;
      state.tickTimer = null;

      detachInput();
      clearTargets();

      // log summary → hha:end (Cloud logger จะดักไปเขียน Google Sheet)
      logEnd();
    }
  };
})();

export { GameEngineVR };
export default GameEngineVR;
