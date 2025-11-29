// --- 7. GameEngine.js (สมองใหม่ - ตัวเชื่อมต่อ Good vs Junk VR) ---
(function(exports, imports) {
  'use strict';

  // --- Import Modules ---
  const { setFever, setFeverActive, setShield, ensureFeverBar } = imports;
  const { Difficulty } = imports;
  const { emojiImage } = imports;
  const { burstAt, floatScore, setShardMode } = imports;
  const { Quest } = imports;

  // --- Game Variables (ที่ `Quest.js` ต้องการ) ---
  window.score = 0;
  window.combo = 0;
  window.misses = 0;
  window.FEVER_ACTIVE = false;
  window.running = false;
  let shield = 0;
  let fever = 0;
  
  let gameTimer = null;
  let spawnTimer = null;
  let sceneEl = null;
  let targetRoot = null;
  let gameConfig = null;
  let difficulty = new Difficulty();

  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD_EMOJI='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD_EMOJI,FIRE];
  
  // --- Global Functions (ที่ `Quest.js` ต้องการ) ---
  window.emit = function(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, {detail})); } catch(e) {}
  }
  
  window.feverStart = function() {
    if (window.FEVER_ACTIVE) return;
    fever = 100;
    setFever(fever);
    window.FEVER_ACTIVE = true;
    setFeverActive(true);
    Quest.onFever();
    window.emit('hha:fever', {state: 'start'});
  }
  
  window.popupText = function(text, pos, color = '#fff') {
    // สร้างตำแหน่งกลางๆ หน้าผู้เล่น
    const worldPos = { x: 0, y: (pos && pos.y) || 1.4, z: -1.5 };
    floatScore(sceneEl, worldPos, text, color);
  }

  // --- Game Logic ---
  function mult() { return window.FEVER_ACTIVE ? 2 : 1; }

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
      window.emit('hha:fever', {state: 'end'});
    }
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
      type = 'good'; // Powerups ถือเป็น good
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
    
    const scale = cfg.size * 0.6; // 0.6 คือ scale พื้นฐาน
    const el = emojiImage(char, scale);
    el.dataset.type = type;
    el.dataset.char = char;
    el.dataset.palette = palette;
    el.setAttribute('data-hha-tgt', '1'); // ให้ raycaster ยิงโดน

    // สุ่มตำแหน่งใน 3D (ด้านหน้าผู้เล่น)
    const x = (Math.random() - 0.5) * 4;      // -2 ถึง +2
    const y = 1.0 + Math.random() * 1.0;      // 1.0 ถึง 2.0
    const z = -2.5 - Math.random() * 1.0;     // -2.5 ถึง -3.5
    el.setAttribute('position', `${x} ${y} ${z}`);
    
    targetRoot.appendChild(el);
    
    // ตั้งเวลาทำลายตัวเอง
    setTimeout(() => {
      if (el && el.parentNode) {
        if (type === 'good') {
          // พลาดของดี
          window.misses++;
          window.combo = 0;
          window.emit('hha:miss', {});
        } else {
          // หลบของขยะ (ดีแล้ว)
          gainFever(4);
        }
        el.remove();
      }
    }, cfg.life);

    // วางแผน spawn ครั้งถัดไป
    spawnTimer = setTimeout(spawnTarget, cfg.rate);
  }
  
  function onHitTarget(targetEl) {
    if (!targetEl || !targetEl.parentNode) return;
    
    const type = targetEl.dataset.type;
    const char = targetEl.dataset.char;
    const palette = targetEl.dataset.palette;
    const pos = targetEl.object3D.getWorldPosition(new THREE.Vector3());

    let scoreDelta = 0;
    
    if (type === 'good') {
      // --- ตีโดนของดี / Powerup ---
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
      Quest.onGood(); // บอกระบบ Quest
      burstAt(sceneEl, pos, { mode: palette });
      floatScore(sceneEl, pos, `+${scoreDelta}`, '#22c55e');

    } else {
      // --- ตีโดนของขยะ ---
      if (shield > 0) {
        shield--;
        setShield(shield);
        burstAt(sceneEl, pos, { mode: 'hydration' });
        floatScore(sceneEl, pos, 'SHIELDED!', '#60a5fa');
      } else {
        scoreDelta = -15;
        window.score = Math.max(0, window.score + scoreDelta);
        window.combo = 0;
        decayFever(18);
        Quest.onBad(); // บอกระบบ Quest
        window.emit('hha:miss', {});
        burstAt(sceneEl, pos, { mode: palette });
        floatScore(sceneEl, pos, `${scoreDelta}`, '#ef4444');
      }
    }
    
    window.emit('hha:score', { score: window.score, combo: window.combo, delta: scoreDelta });
    
    // ทำลาย target
    targetEl.remove();
  }

  function gameTick() {
    if (!window.running) return;
    // ลด Fever ทุกวินาที
    decayFever(window.combo <= 0 ? 6 : 2);
  }

  // 🔫 ฟังก์ชันกลางสำหรับยิง (ใช้ cursor + raycaster)
  function handleShoot() {
    if (!window.running) return;
    const cursor = document.getElementById('cursor');
    if (!cursor) return;
    const ray = cursor.components && cursor.components.raycaster;
    if (!ray) return;
    const target = ray.intersectedEls && ray.intersectedEls[0];
    if (target && target.dataset && target.dataset.hhaTgt) {
      onHitTarget(target);
    }
  }

  // --- Public Controller ---
  exports.GameEngine = {
    start(level) {
      sceneEl = document.querySelector('a-scene');
      if (!sceneEl) {
        console.error("A-Frame scene not found!");
        return;
      }

      // ล้างของเก่า
      if (targetRoot) targetRoot.remove();
      targetRoot = document.createElement('a-entity');
      targetRoot.id = 'targetRoot';
      sceneEl.appendChild(targetRoot);
      
      // ตั้งค่า UI
      ensureFeverBar();
      setShardMode('goodjunk');
      
      // รีเซ็ตค่า
      window.score = 0;
      window.combo = 0;
      window.misses = 0;
      shield = 0;
      fever = 0;
      window.FEVER_ACTIVE = false;
      window.running = true;

      setFever(0);
      setShield(0);
      setFeverActive(false);

      // ตั้งค่าความยาก
      difficulty.set(level);
      gameConfig = difficulty.get(); // { size, rate, life }
      
      // เริ่มระบบเกม
      if (gameTimer) clearInterval(gameTimer);
      if (spawnTimer) clearTimeout(spawnTimer);
      gameTimer = setInterval(gameTick, 1000);
      spawnTimer = setTimeout(spawnTarget, 1000); // เริ่ม spawn แรก
      
      Quest.start(); // เริ่มระบบภารกิจ
      
      // 1) รองรับ VR trigger / gaze (A-Frame click)
      sceneEl.addEventListener('click', (e) => {
        if (e.target && e.target.dataset && e.target.dataset.hhaTgt) {
          onHitTarget(e.target);
        }
      });
      
      // 2) รองรับ mouse + touch (PC / Mobile จิ้มจอ)
      if (sceneEl.canvas) {
        sceneEl.canvas.addEventListener('mousedown', (e) => {
          e.preventDefault();
          handleShoot();
        });

        sceneEl.canvas.addEventListener('touchstart', (e) => {
          e.preventDefault();
          handleShoot();
        }, { passive: false });
      }
      
      // ส่งสัญญาณเริ่มเกม
      window.emit('hha:score', {score: 0, combo: 0});
    },
    
    stop() {
      if (!window.running) return;
      window.running = false;
      
      if (gameTimer) clearInterval(gameTimer);
      if (spawnTimer) clearTimeout(spawnTimer);
      gameTimer = null;
      spawnTimer = null;
      
      Quest.stop();
      
      // ล้าง UI และ targets
      if (targetRoot) targetRoot.remove();
      targetRoot = null;
      
      document.querySelectorAll('[data-hha-ui]').forEach(el => el.remove());
      
      // ส่งสัญญาณจบเกม
      window.emit('hha:end', { score: window.score });
    }
  };

})(GAME_MODULES, GAME_MODULES);
