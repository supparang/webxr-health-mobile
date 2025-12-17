// path: herohealth/hydration-vr/hydration.safe.js
'use strict';

// --- Game State ---
let state = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  waterPct: 50,
  feverVal: 0,
  feverActive: false,
  isPlaying: false,
  timeLeft: 0
};

// --- Configuration ---
const CFG = {
  decayRate: 0.8,     // ความเร็วที่น้ำลดลง (ยิ่งเยอะยิ่งยาก)
  feverThreshold: 100,// แต้ม Fever ที่ต้องสะสม
  spawnInterval: 1000 // ความถี่ไอเทมเกิด (ms)
};

let timerInterval = null;
let gameLoopInterval = null;

// Helper: ส่ง Event ไปหา HTML UI
function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

// อัปเดตค่าต่างๆ ไปที่ UI
function updateUI() {
  emit('hha:score', {
    score: state.score,
    combo: state.combo,
    waterPct: Math.floor(state.waterPct),
    feverActive: state.feverActive,
    feverVal: state.feverVal
  });
}

// ฟังก์ชันสร้างไอเทมหยดน้ำ
function spawnItem() {
  if (!state.isPlaying) return;

  const playfield = document.getElementById('hvr-playfield');
  if (!playfield) return;

  // 1. สร้าง Element ใหม่
  const el = document.createElement('a-entity');
  
  // 2. คำนวณตำแหน่งสุ่มรอบตัวผู้เล่น (Spherical Coordinates)
  const theta = (Math.random() * 140 - 70) * (Math.PI / 180); // มุมกว้างซ้ายขวา
  const phi = (Math.random() * 50 - 15) * (Math.PI / 180);    // มุมสูงต่ำ
  const radius = 3.5; // ระยะห่าง

  const x = radius * Math.cos(phi) * Math.sin(theta);
  const y = radius * Math.sin(phi);
  const z = -radius * Math.cos(phi) * Math.cos(theta);

  // 3. ตั้งค่าหน้าตาไอเทม
  el.setAttribute('position', { x, y, z });
  
  // ใช้ Geometry Sphere ธรรมดา (ประหยัดกว่า Model 3D)
  el.setAttribute('geometry', 'primitive: sphere; radius: 0.35');
  el.setAttribute('material', 'color: #38bdf8; opacity: 0.9; shader: flat; transparent: true');
  
  // **สำคัญ**: ต้องใส่ class 'clickable' เพื่อให้ Raycaster มองเห็น
  el.setAttribute('class', 'clickable'); 

  // Animation: เด้งดึ๋งๆ
  el.setAttribute('animation', `property: scale; from: 0 0 0; to: 1 1 1; dur: 400; easing: easeOutElastic`);
  el.setAttribute('animation__float', `property: position; to: ${x} ${y + 0.2} ${z}; dir: alternate; dur: 1500; loop: true; easing: easeInOutSine`);

  // 4. Logic เมื่อยิงโดน (Click Event)
  const onHit = () => {
    if (!state.isPlaying) return;
    
    // คำนวณคะแนน
    const basePoints = state.feverActive ? 200 : 100;
    const comboBonus = state.combo * 10;
    state.score += basePoints + comboBonus;
    
    // คอมโบ
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    
    // เติมน้ำ
    state.waterPct = Math.min(100, state.waterPct + 6);
    
    // Fever Gauge Logic
    if (!state.feverActive) {
      state.feverVal += 15; // เติม Fever
      if (state.feverVal >= CFG.feverThreshold) {
        activateFever();
      }
    }

    updateUI();
    
    // เอฟเฟกต์ตอนแตก (Visual Feedback) - หดตัวลงแล้วค่อยลบ
    el.removeAttribute('class'); // เอา class ออกทันทีกันกดย้ำ
    el.setAttribute('material', 'color: #fff'); // แวบสีขาว
    el.setAttribute('animation__die', `property: scale; to: 2 2 2; dur: 150; easing: easeOutQuad`);
    el.setAttribute('animation__fade', `property: material.opacity; to: 0; dur: 150; easing: easeOutQuad`);
    
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 150);
  };

  // รองรับทั้งคลิกเมาส์และ Touch (ผ่าน Raycaster)
  el.addEventListener('click', onHit);

  // 5. Logic เมื่อปล่อยทิ้งไว้ (หายไปเอง)
  setTimeout(() => {
    if (el.parentNode) {
      // Animation หดหาย
      el.setAttribute('animation__miss', `property: scale; to: 0 0 0; dur: 300; easing: easeInBack`);
      setTimeout(() => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
            // ถ้าโหมดยังไม่ Fever แล้วปล่อยหลุด = คอมโบหลุด
            if (state.isPlaying && !state.feverActive) {
                if(state.combo > 0) emit('hha:coach', { text: "Combo Lost!" });
                state.combo = 0;
                updateUI();
            }
          }
      }, 300);
    }
  }, 2500 + Math.random() * 1000); // อยู่นาน 2.5 - 3.5 วินาที

  playfield.appendChild(el);
}

// โหมดพิเศษ Fever
function activateFever() {
  state.feverActive = true;
  emit('hha:coach', { text: "🔥 FEVER MODE !!! 🔥" });
  updateUI();
  
  // เร่งความเร็วการเกิดไอเทมชั่วคราว (Optional)
  clearInterval(gameLoopInterval);
  gameLoopInterval = setInterval(spawnItem, 400); // เกิดเร็วมาก

  setTimeout(() => {
    state.feverActive = false;
    state.feverVal = 0;
    emit('hha:coach', { text: "Fever Ended" });
    
    // กลับสู่ความเร็วปกติ
    clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(spawnItem, CFG.spawnInterval);
    updateUI();
  }, 6000); // นาน 6 วินาที
}

// จบเกม
function endGame(reason) {
  state.isPlaying = false;
  clearInterval(timerInterval);
  clearInterval(gameLoopInterval);

  // ล้างฉาก
  const playfield = document.getElementById('hvr-playfield');
  if (playfield) playfield.innerHTML = '';

  // ส่งข้อมูลสรุป
  emit('hha:end', {
    score: state.score,
    combo: state.maxCombo,
    waterPct: Math.floor(state.waterPct),
    reason: reason
  });
}

// === MAIN BOOT FUNCTION ===
export async function boot(options = {}) {
  // Reset
  state = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    waterPct: 50,
    feverVal: 0,
    feverActive: false,
    isPlaying: true,
    timeLeft: options.duration || 60
  };

  updateUI();
  emit('quest:update', { goalHeading: 'Collect Water Orbs', miniHeading: 'Normal Mode' });
  emit('hha:coach', { text: "Tap blue orbs to hydrate!" });

  // Start Loops
  if (gameLoopInterval) clearInterval(gameLoopInterval);
  if (timerInterval) clearInterval(timerInterval);

  gameLoopInterval = setInterval(spawnItem, CFG.spawnInterval);

  timerInterval = setInterval(() => {
    if (!state.isPlaying) return;
    state.timeLeft--;
    
    // น้ำลดลงเรื่อยๆ
    if (state.waterPct > 0 && !state.feverActive) {
        state.waterPct -= CFG.decayRate;
    }

    // เช็คจบเกม
    if (state.timeLeft <= 0) {
      endGame('TIME_UP');
    } else if (state.waterPct <= 0) {
      endGame('DEHYDRATED');
    }
    
    updateUI();
  }, 1000);
}
