// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Pop Targets + Multi-Quest + Fever + Shield + Coach + FX
// 2025-12-07 — เป้าเล็กตามระดับ, กระจายตามจอแบบ responsive, เป้าอยู่นานขึ้น,
// Perfect/Good/Late/Miss เด้งตรงเป้า, ยกเป้าขึ้นด้านบน, รองรับ particles.js

'use strict';

export const GameEngine = (function () {
  // ---------- Fever UI (shared across modes) ----------
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar() {},
      setFever() {},
      setFeverActive() {},
      setShield() {}
    };

  // ---------- Particles DOM FX (shared) ----------
  const Particles =
    (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
    window.Particles || {
      burstAt () {},
      scorePop () {}
    };

  // ---------- emoji ชุดอาหาร ----------
  const GOOD = [
    '🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
    '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'
  ];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  // special targets
  const STAR_EMOJI    = '⭐';
  const DIAMOND_EMOJI = '💎';
  const SHIELD_EMOJI  = '🛡️';

  // ---------- ค่าพื้นฐาน (จะถูก override ตาม diff) ----------
  let GOOD_RATE       = 0.65;
  let SPAWN_INTERVAL  = 900;
  let TARGET_LIFETIME = 900;
  let MAX_ACTIVE      = 4;
  let SIZE_FACTOR     = 0.8; // baseline (จะเปลี่ยนใน applyDifficulty)

  // type weights (จะปรับตาม diff)
  let TYPE_WEIGHTS = {
    good:    70,
    junk:    20,
    star:     4,
    diamond:  3,
    shield:   3
  };

  // Fever
  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 18;
  const FEVER_MISS_LOSS = 30;
  const FEVER_DURATION  = 5000;   // ms

  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let goodHit = 0;
  let junkHit = 0;
  let shieldCount = 0;

  // Fever state
  let fever = 0;
  let feverActive = false;
  let feverTimer = null;

  // ---------- Quest pool ----------
  // goal 10 แบบ / mini quest 15 แบบ → สุ่มมา 2 + 3 ในแต่ละเกม
  const GOAL_TEMPLATES = [
    { id: 'g1',  label: 'เก็บอาหารดีให้ครบ 10 ชิ้น', target: 10 },
    { id: 'g2',  label: 'เก็บอาหารดีให้ครบ 12 ชิ้น', target: 12 },
    { id: 'g3',  label: 'เก็บอาหารดีให้ครบ 14 ชิ้น', target: 14 },
    { id: 'g4',  label: 'เก็บอาหารดีให้ครบ 16 ชิ้น', target: 16 },
    { id: 'g5',  label: 'เก็บอาหารดีให้ครบ 18 ชิ้น', target: 18 },
    { id: 'g6',  label: 'เก็บอาหารดีให้ครบ 20 ชิ้น', target: 20 },
    { id: 'g7',  label: 'เก็บอาหารดีให้ครบ 22 ชิ้น', target: 22 },
    { id: 'g8',  label: 'เก็บอาหารดีให้ครบ 24 ชิ้น', target: 24 },
    { id: 'g9',  label: 'เก็บอาหารดีให้ครบ 26 ชิ้น', target: 26 },
    { id: 'g10', label: 'เก็บอาหารดีให้ครบ 28 ชิ้น', target: 28 }
  ];

  const MINI_TEMPLATES = [
    { id:'m1',  label:'ทำคอมโบให้ถึง x3 อย่างน้อย 1 ครั้ง',  threshold:3 },
    { id:'m2',  label:'ทำคอมโบให้ถึง x4 อย่างน้อย 1 ครั้ง',  threshold:4 },
    { id:'m3',  label:'ทำคอมโบให้ถึง x5 อย่างน้อย 1 ครั้ง',  threshold:5 },
    { id:'m4',  label:'ทำคอมโบให้ถึง x6 อย่างน้อย 1 ครั้ง',  threshold:6 },
    { id:'m5',  label:'ทำคอมโบให้ถึง x7 อย่างน้อย 1 ครั้ง',  threshold:7 },
    { id:'m6',  label:'ทำคอมโบให้ถึง x8 อย่างน้อย 1 ครั้ง',  threshold:8 },
    { id:'m7',  label:'ทำคอมโบให้ถึง x9 อย่างน้อย 1 ครั้ง',  threshold:9 },
    { id:'m8',  label:'ทำคอมโบให้ถึง x10 อย่างน้อย 1 ครั้ง', threshold:10 },
    { id:'m9',  label:'ทำคอมโบยาว ๆ ไม่ให้หลุดจนถึง x5',      threshold:5 },
    { id:'m10', label:'ทำคอมโบยาว ๆ ไม่ให้หลุดจนถึง x7',      threshold:7 },
    { id:'m11', label:'ทำคอมโบยาว ๆ ไม่ให้หลุดจนถึง x9',      threshold:9 },
    { id:'m12', label:'เป็นสายโปร! ทำคอมโบ x6 ขึ้นไป',        threshold:6 },
    { id:'m13', label:'เป็นสายโปร! ทำคอมโบ x8 ขึ้นไป',        threshold:8 },
    { id:'m14', label:'เป็นสายโปร! ทำคอมโบ x10 ขึ้นไป',       threshold:10 },
    { id:'m15', label:'รักษาคอมโบสูงสุดให้ได้อย่างน้อย x4',   threshold:4 }
  ];

  let activeGoals = []; // สุ่มมา 2 จาก 10
  let activeMinis = []; // สุ่มมา 3 จาก 15
  let miniComboNeed = 5; // ใช้สำหรับข้อความโค้ชบางจังหวะ

  // ---------- Emoji → texture cache ----------
  const emojiTexCache = new Map();

  function getEmojiTexture(ch) {
    if (emojiTexCache.has(ch)) return emojiTexCache.get(ch);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 256, 256);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font =
      '200px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
    ctx.fillText(ch, 128, 140);

    const url = canvas.toDataURL('image/png');
    emojiTexCache.set(ch, url);
    return url;
  }

  // ---------- helpers ----------
  function emit(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function coach(text) {
    if (!text) return;
    emit('hha:coach', { text });
  }

  function emitScore() {
    emit('hha:score', { score, combo, misses });
  }

  function emitMiss() {
    emit('hha:miss', { misses });
  }

  function clamp(v, min, max){
    return v < min ? min : (v > max ? max : v);
  }

  function randInt(min, max){
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  function pickSome(list, count) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr.slice(0, Math.min(count, arr.length));
  }

  // world → screen สำหรับ FX
  function worldToScreen(objLike) {
    try {
      const THREE = window.THREE || (window.AFRAME && window.AFRAME.THREE);
      if (!THREE || !sceneEl || !sceneEl.camera || !objLike.object3D) {
        return {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        };
      }
      const vec = new THREE.Vector3();
      vec.setFromMatrixPosition(objLike.object3D.matrixWorld);
      vec.project(sceneEl.camera);
      const x = (vec.x + 1) / 2 * window.innerWidth;
      const y = (1 - vec.y) / 2 * window.innerHeight;
      return { x, y };
    } catch (err) {
      return {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      };
    }
  }

  // judgment ตามอายุเป้า
  function getJudgment(el) {
    const born = Number(el.dataset.born || '0');
    if (!born || !TARGET_LIFETIME) return 'good';

    const age = performance.now() - born;
    const t = TARGET_LIFETIME;

    if (age < t * 0.45) return 'perfect';
    if (age < t * 0.90) return 'good';
    return 'late';
  }

  function showHitFx(el, kind, judgment, scoreDelta) {
    const pos = worldToScreen(el);
    const x = pos.x;
    const y = pos.y;

    if (Particles && typeof Particles.burstAt === 'function') {
      const opts = {};
      if (kind === 'good')    opts.good = true;
      if (kind === 'junk')    opts.bad = true;
      if (kind === 'star')    opts.star = true;
      if (kind === 'diamond') opts.diamond = true;
      if (kind === 'shield')  opts.shield = true;
      Particles.burstAt(x, y, opts);
    }

    if (Particles && typeof Particles.scorePop === 'function') {
      if (typeof scoreDelta === 'number' && scoreDelta !== 0) {
        const txt = (scoreDelta > 0 ? '+' : '') + scoreDelta;
        Particles.scorePop(x, y, txt, {
          good: kind === 'good' || kind === 'star' || kind === 'diamond' || kind === 'shield',
          bad:  kind === 'junk'
        });
      }
      if (judgment) {
        let label = '';
        if (judgment === 'perfect') label = 'Perfect';
        else if (judgment === 'good') label = 'Good';
        else if (judgment === 'late') label = 'Late';
        else if (judgment === 'miss') label = 'Miss';
        if (label) {
          Particles.scorePop(x, y, label, { small: true });
        }
      }
    }
  }

  function showMissFx(el) {
    const pos = worldToScreen(el);
    const x = pos.x;
    const y = pos.y;

    if (Particles && typeof Particles.burstAt === 'function') {
      Particles.burstAt(x, y, { bad: true });
    }
    if (Particles && typeof Particles.scorePop === 'function') {
      Particles.scorePop(x, y, 'Miss', { bad: true });
    }
  }

  // ---------- Fever ----------
  function setFever(value, stateHint) {
    fever = clamp(value, 0, FEVER_MAX);

    if (FeverUI && typeof FeverUI.setFever === 'function') {
      FeverUI.setFever(fever);
    }

    emit('hha:fever', {
      state: stateHint || (feverActive ? 'active' : 'charge'),
      value: fever,
      max: FEVER_MAX
    });
  }

  function startFever() {
    if (feverActive) return;
    feverActive = true;
    fever = FEVER_MAX;

    if (FeverUI && FeverUI.setFeverActive) FeverUI.setFeverActive(true);
    if (FeverUI && FeverUI.setFever)       FeverUI.setFever(fever);

    emit('hha:fever', { state:'start', value: fever, max: FEVER_MAX });

    if (feverTimer) clearTimeout(feverTimer);
    feverTimer = setTimeout(() => {
      endFever();
    }, FEVER_DURATION);
  }

  function endFever() {
    if (!feverActive) return;
    feverActive = false;
    fever = 0;

    if (FeverUI && FeverUI.setFeverActive) FeverUI.setFeverActive(false);
    if (FeverUI && FeverUI.setFever)       FeverUI.setFever(fever);

    emit('hha:fever', { state:'end', value: fever, max: FEVER_MAX });
  }

  // ---------- Quest ----------
  function setupQuestsForRun() {
    activeGoals = pickSome(GOAL_TEMPLATES, 2).map(g => ({
      id: g.id,
      label: g.label,
      target: g.target,
      prog: 0,
      done: false
    }));
    activeMinis = pickSome(MINI_TEMPLATES, 3).map(m => ({
      id: m.id,
      label: m.label,
      threshold: m.threshold,
      target: m.threshold,
      prog: 0,
      done: false
    }));
    miniComboNeed = activeMinis[0] ? activeMinis[0].threshold : 5;
  }

  function pushQuest(hint) {
    const goalsUi = activeGoals.map(g => ({
      label: g.label,
      prog: Math.min(g.prog, g.target),
      target: g.target,
      done: g.done
    }));
    const minisUi = activeMinis.map(m => ({
      label: m.label,
      prog: Math.min(m.prog, m.target),
      target: m.target,
      done: m.done
    }));

    const primaryGoal = goalsUi[0] || null;
    const primaryMini = minisUi[0] || null;

    const goalsCleared = goalsUi.filter(g => g.done).length;
    const minisCleared = minisUi.filter(m => m.done).length;

    const statusText =
      `Goals ${goalsCleared}/${goalsUi.length} (สุ่มจาก 10) • ` +
      `Mini ${minisCleared}/${minisUi.length} (สุ่มจาก 15)`;

    emit('quest:update', {
      goal: primaryGoal,
      mini: primaryMini,
      goalsAll: goalsUi,
      minisAll: minisUi,
      hint: hint || statusText,
      status: statusText
    });
  }

  function updateGoalsFromGoodHit() {
    if (!activeGoals.length) {
      pushQuest('');
      return;
    }
    let allDone = true;
    activeGoals.forEach(g => {
      g.prog = goodHit;
      if (!g.done && g.prog >= g.target) {
        g.done = true;
      }
      if (!g.done) allDone = false;
    });
    if (allDone) {
      coach('ภารกิจหลักทั้งหมดสำเร็จแล้ว! เยี่ยมมาก 🎉');
    }
    pushQuest('');
  }

  function updateMinisFromCombo() {
    if (!activeMinis.length) {
      pushQuest('');
      return;
    }
    let allDone = true;
    activeMinis.forEach(m => {
      m.prog = Math.min(comboMax, m.target);
      if (!m.done && comboMax >= m.threshold) {
        m.done = true;
      }
      if (!m.done) allDone = false;
    });
    if (allDone) {
      coach('Mini quest ทั้งหมดสำเร็จแล้ว ✨');
    }
    pushQuest('');
  }

  function emitEnd() {
    const goalsCleared = activeGoals.filter(g => g.done).length;
    const minisCleared = activeMinis.filter(m => m.done).length;

    emit('hha:end', {
      mode: 'Good vs Junk (VR)',
      score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal: activeGoals.length,
      miniCleared: minisCleared,
      miniTotal: activeMinis.length
    });
  }

  // ---------- ลบเป้า ----------
  function removeTarget(el) {
    activeTargets = activeTargets.filter(t => t !== el);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  // ---------- ตำแหน่ง spawn แบบ responsive (ยกเป้าขึ้นด้านบน) ----------
  function pickSpawnPosition() {
    const z = -3.0;

    const aspect = window.innerWidth / window.innerHeight;
    const halfX = 1.2 * Math.max(1, aspect);
    const minX = -halfX;
    const maxX = halfX;

    // ★ ยกช่วง y ขึ้นไปด้านบน (เดิม 2.2–3.0 → ดันอีก)
    const minY = 2.6;
    const maxY = 3.4;

    let x = 0, y = 0;

    for (let i = 0; i < 10; i++) {
      x = minX + Math.random() * (maxX - minX);
      y = minY + Math.random() * (maxY - minY);

      const THREE = window.THREE || (window.AFRAME && window.AFRAME.THREE);
      if (sceneEl && sceneEl.camera && THREE) {
        const dummyObj = new THREE.Object3D();
        dummyObj.position.set(x, y, z);
        const screen = worldToScreen({ object3D: dummyObj });
        const sx = screen.x;
        const sy = screen.y;

        const marginX   = 72;
        const topHUD    = 80;
        const bottomHUD = 260; // เผื่อ coach + fever ล่างเยอะหน่อย

        if (
          sx > marginX &&
          sx < window.innerWidth - marginX &&
          sy > topHUD &&
          sy < window.innerHeight - bottomHUD
        ) {
          return { x, y, z };
        }
      } else {
        return { x, y, z };
      }
    }

    return {
      x: clamp(x, -halfX, halfX),
      y: clamp(y, minY, maxY),
      z
    };
  }

  // ---------- สร้างเป้า (emoji pop) ----------
  function createTargetEntity(emoji, kind) {
    if (!sceneEl) return null;

    const root = document.createElement('a-entity');

    const pos = pickSpawnPosition();
    root.setAttribute('position', pos);
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.classList.add('gj-target');
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;
    root.dataset.born = String(performance.now());

    let color = '#22c55e';
    if (kind === 'junk')   color = '#f97316';
    if (kind === 'star')   color = '#fde047';
    if (kind === 'diamond')color = '#38bdf8';
    if (kind === 'shield') color = '#60a5fa';

    const baseRadius =
      kind === 'good' ? 0.45 :
      kind === 'junk' ? 0.42 : 0.40;

    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', baseRadius * SIZE_FACTOR);
    circle.setAttribute('material', {
      color,
      opacity: 0.30,
      metalness: 0,
      roughness: 1
    });

    const baseSize = 0.8 * SIZE_FACTOR;
    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', baseSize);
    sprite.setAttribute('height', baseSize);
    sprite.setAttribute('position', { x: 0, y: 0, z: 0.01 });
    sprite.setAttribute('material', {
      src: getEmojiTexture(emoji),
      transparent: true,
      alphaTest: 0.01
    });

    circle.setAttribute('data-hha-tgt', '1');
    sprite.setAttribute('data-hha-tgt', '1');

    const hitHandler = () => onHit(root);
    circle.addEventListener('click', hitHandler);
    sprite.addEventListener('click', hitHandler);

    root.appendChild(circle);
    root.appendChild(sprite);
    sceneEl.appendChild(root);

    setTimeout(() => {
      if (!running) return;
      if (!root.parentNode) return;
      onExpire(root);
    }, TARGET_LIFETIME);

    return root;
  }

  // ---------- ยิงโดน ----------
  function onHit(el) {
    if (!running || !el) return;
    if (!el.parentNode) return;

    const kind = el.dataset.kind || 'junk';
    const judgmentRaw = getJudgment(el);
    const judgment = (kind === 'junk') ? 'miss' : judgmentRaw;

    const scoreBefore = score;

    if (kind === 'shield') {
      shieldCount += 1;
      if (FeverUI && FeverUI.setShield) FeverUI.setShield(shieldCount);
      coach('ได้เกราะป้องกัน 1 ชิ้น! ถ้าเผลอแตะของขยะจะไม่เสียแต้มทันที 🛡️');
      showHitFx(el, kind, null, 0);
      emitScore();
      removeTarget(el);
      return;
    }

    if (kind === 'star') {
      const mult = feverActive ? 2 : 1;
      score += 80 * mult;
      coach('ดวงดาวโบนัส! ได้แต้มพิเศษเพิ่มขึ้น ⭐');
      showHitFx(el, kind, judgment, score - scoreBefore);
      emitScore();
      removeTarget(el);
      return;
    }

    if (kind === 'diamond') {
      const mult = feverActive ? 2 : 1;
      score += 60 * mult;
      setFever(fever + 30, 'charge');
      coach('ได้เพชรพลังงาน! Fever ขึ้นไวขึ้น 💎');
      showHitFx(el, kind, judgment, score - scoreBefore);
      emitScore();
      removeTarget(el);
      return;
    }

    if (kind === 'good') {
      goodHit++;

      combo++;
      comboMax = Math.max(comboMax, combo);

      const base = 10 + combo * 2;
      const mult = feverActive ? 2 : 1;
      score += base * mult;

      const nextFever = fever + FEVER_HIT_GAIN;
      if (!feverActive && nextFever >= FEVER_MAX) {
        startFever();
      } else {
        setFever(nextFever, 'charge');
      }

      if (combo === 1)
        coach('เปิดคอมโบแล้ว! เลือกผัก ผลไม้ นมต่อเลย 🥦🍎🥛');
      else if (combo === miniComboNeed)
        coach(`คอมโบ x${miniComboNeed} แล้ว เยี่ยมมาก! 🔥`);
      else if (combo === 10)
        coach('สุดยอด! โปรโหมดแล้ว x10 เลย! 💪');

      updateGoalsFromGoodHit();
      updateMinisFromCombo();
    } else {
      if (shieldCount > 0) {
        shieldCount -= 1;
        if (FeverUI && FeverUI.setShield) FeverUI.setShield(shieldCount);
        coach('โชคดีมีเกราะกันไว้ ของขยะไม่ทำร้ายคะแนนรอบนี้ 🛡️');
        showHitFx(el, kind, 'miss', 0);
        emitScore();
        removeTarget(el);
        return;
      }

      junkHit++;
      score = Math.max(0, score - 8);
      combo = 0;
      misses++;
      coach('โดนของขยะแล้ว ระวังพวก 🍔🍩 อีกนะ');

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFever(nextFever, 'charge');
      }

      emitMiss();
      updateGoalsFromGoodHit();
      pushQuest('');
    }

    showHitFx(el, kind, judgment, score - scoreBefore);
    emitScore();

    removeTarget(el);
  }

  // ---------- เป้าหายเพราะหมดเวลา ----------
  function onExpire(el) {
    if (!running || !el) return;
    if (!el.parentNode) return;

    const kind = el.dataset.kind || 'junk';

    if (kind === 'good') {
      showMissFx(el);
      removeTarget(el);

      misses++;
      combo = 0;
      coach('พลาดของดีไปนะ ลองเล็งให้ตรงเป้มากขึ้น 😊');

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFever(nextFever, 'charge');
      }

      emitMiss();
      emitScore();
      updateGoalsFromGoodHit();
      pushQuest('');
    } else {
      removeTarget(el);
    }
  }

  // ---------- สุ่ม spawn ----------
  function pickType() {
    const w = TYPE_WEIGHTS;
    const sum =
      (w.good   || 0) +
      (w.junk   || 0) +
      (w.star   || 0) +
      (w.diamond|| 0) +
      (w.shield || 0);

    let r = Math.random() * sum;

    if ((r -= w.good) <= 0)    return 'good';
    if ((r -= w.junk) <= 0)    return 'junk';
    if ((r -= w.star) <= 0)    return 'star';
    if ((r -= w.diamond) <= 0) return 'diamond';
    return 'shield';
  }

  function tickSpawn() {
    if (!running) return;
    if (activeTargets.length >= MAX_ACTIVE) return;

    const type = pickType();

    let emoji, kind;
    if (type === 'good') {
      emoji = GOOD[Math.floor(Math.random() * GOOD.length)];
      kind  = 'good';
    } else if (type === 'junk') {
      emoji = JUNK[Math.floor(Math.random() * JUNK.length)];
      kind  = 'junk';
    } else if (type === 'star') {
      emoji = STAR_EMOJI;
      kind  = 'star';
    } else if (type === 'diamond') {
      emoji = DIAMOND_EMOJI;
      kind  = 'diamond';
    } else {
      emoji = SHIELD_EMOJI;
      kind  = 'shield';
    }

    const el = createTargetEntity(emoji, kind);
    if (el) activeTargets.push(el);
  }

  // ---------- ตั้งค่า difficulty ----------
  function applyDifficulty(diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();

    if (d === 'easy') {
      SPAWN_INTERVAL  = 1200;
      TARGET_LIFETIME = 1700;
      MAX_ACTIVE      = 3;
      GOOD_RATE       = 0.72;
      SIZE_FACTOR     = 0.80;

      TYPE_WEIGHTS = {
        good:    75,
        junk:    15,
        star:     4,
        diamond:  3,
        shield:   3
      };
    } else if (d === 'hard') {
      SPAWN_INTERVAL  = 800;
      TARGET_LIFETIME = 1200;
      MAX_ACTIVE      = 5;
      GOOD_RATE       = 0.6;
      SIZE_FACTOR     = 0.50;

      TYPE_WEIGHTS = {
        good:    65,
        junk:    22,
        star:     5,
        diamond:  4,
        shield:   4
      };
    } else {
      SPAWN_INTERVAL  = 1000;
      TARGET_LIFETIME = 1450;
      MAX_ACTIVE      = 4;
      GOOD_RATE       = 0.66;
      SIZE_FACTOR     = 0.65;

      TYPE_WEIGHTS = {
        good:    70,
        junk:    18,
        star:     4,
        diamond:  4,
        shield:   4
      };
    }
  }

  // ---------- start / stop ----------
  function _startCore(diffKey) {
    running = true;
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    goodHit = 0;
    junkHit = 0;
    shieldCount = 0;

    applyDifficulty(diffKey);
    setupQuestsForRun();

    if (FeverUI && FeverUI.ensureFeverBar) FeverUI.ensureFeverBar();
    if (FeverUI && FeverUI.setFever)      FeverUI.setFever(0);
    if (FeverUI && FeverUI.setShield)     FeverUI.setShield(shieldCount);
    if (FeverUI && FeverUI.setFeverActive)FeverUI.setFeverActive(false);

    fever = 0;
    feverActive = false;
    if (feverTimer) clearTimeout(feverTimer);
    setFever(0, 'charge');

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    emitScore();
    coach('แตะเฉพาะอาหารดี เช่น ผัก ผลไม้ นม เลี่ยงของขยะนะ 🥦🍎🥛');
    pushQuest('เริ่มเกม');

    tickSpawn();
    spawnTimer = setInterval(tickSpawn, SPAWN_INTERVAL);
  }

  function start(diffKey) {
    if (running) return;
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[GoodJunkVR] ไม่พบ <a-scene>');
      return;
    }
    if (sceneEl.hasLoaded) {
      _startCore(diffKey);
    } else {
      sceneEl.addEventListener('loaded', function () {
        _startCore(diffKey);
      }, { once: true });
    }
  }

  function stop() {
    if (!running) return;
    running = false;

    clearInterval(spawnTimer);
    if (feverTimer) clearTimeout(feverTimer);
    endFever();

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    coach('จบเกมแล้ว! ดูสรุปคะแนนด้านบนได้เลย 🎉');
    emitEnd();
  }

  return { start, stop };
})();
