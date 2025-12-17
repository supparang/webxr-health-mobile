// === herohealth/hydration-vr/hydration.safe.js ===
'use strict';

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

// Config
const CFG = {
  decayRate: 0.5, // น้ำลดลงวินาทีละเท่าไหร่
  feverThreshold: 100,
  spawnInterval: 1200 // มิลลิวินาที
};

let timerInterval = null;
let gameLoopInterval = null;

// Helper: ส่ง Event ไปหา HTML UI
function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function updateUI() {
  emit('hha:score', {
    score: state.score,
    combo: state.combo,
    waterPct: Math.floor(state.waterPct),
    feverActive: state.feverActive,
    feverVal: state.feverVal
  });
}

function spawnItem() {
  if (!state.isPlaying) return;

  const playfield = document.getElementById('hvr-playfield');
  if (!playfield) return;

  // สร้าง Element
  const el = document.createElement('a-entity');
  
  // สุ่มตำแหน่ง (Spherical coords -> Cartesian)
  const theta = (Math.random() * 120 - 60) * (Math.PI / 180); // ซ้าย-ขวา
  const phi = (Math.random() * 40 - 10) * (Math.PI / 180);    // บน-ล่าง
  const radius = 4;

  const x = radius * Math.cos(phi) * Math.sin(theta);
  const y = radius * Math.sin(phi);
  const z = -radius * Math.cos(phi) * Math.cos(theta);

  // ตั้งค่า Attribute
  el.setAttribute('position', { x, y, z });
  
  // สร้างกราฟิกหยดน้ำ (ใช้ Geometry ง่ายๆ เพื่อประสิทธิภาพ)
  el.setAttribute('geometry', 'primitive: sphere; radius: 0.3');
  el.setAttribute('material', 'color: #38bdf8; opacity: 0.9; shader: flat');
  el.setAttribute('class', 'clickable'); // สำคัญ: ต้องมี class นี้ถึงจะยิงโดน

  // Animation: ลอยไปมานิดหน่อย
  el.setAttribute('animation', `property: position; to: ${x} ${y + 0.2} ${z}; dir: alternate; dur: 1000; loop: true`);

  // Event: เมื่อถูกยิง (Click / Fuse)
  const onHit = () => {
    if (!state.isPlaying) return;
    
    // Logic คะแนน
    const points = state.feverActive ? 200 : 100;
    state.score += points + (state.combo * 10);
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    
    // น้ำเพิ่ม
    state.waterPct = Math.min(100, state.waterPct + 5);
    
    // Fever Gauge
    if (!state.feverActive) {
      state.feverVal += 10;
      if (state.feverVal >= CFG.feverThreshold) {
        activateFever();
      }
    }

    // Effect เสียง/ภาพ (ถ้ามี)
    // ...

    updateUI();
    
    // ลบออกจากฉาก
    if (el.parentNode) el.parentNode.removeChild(el);
  };

  el.addEventListener('click', onHit);
  // el.addEventListener('mousedown', onHit); // เผื่อไว้

  // Auto Destroy (ถ้าไม่ยิงภายใน 3 วิ)
  setTimeout(() => {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
      // Combo ขาด!
      if (state.isPlaying && !state.feverActive) {
        state.combo = 0;
        emit('hha:coach', { text: "Missed! Focus!" });
        updateUI();
      }
    }
  }, 3000);

  playfield.appendChild(el);
}

function activateFever() {
  state.feverActive = true;
  emit('hha:coach', { text: "FEVER MODE ACTIVATED!" });
  
  setTimeout(() => {
    state.feverActive = false;
    state.feverVal = 0;
    emit('hha:coach', { text: "Fever ended. Keep going!" });
  }, 5000); // Fever 5 วินาที
}

function endGame(reason) {
  state.isPlaying = false;
  clearInterval(timerInterval);
  clearInterval(gameLoopInterval);

  // Clear Items
  const playfield = document.getElementById('hvr-playfield');
  if (playfield) playfield.innerHTML = '';

  // Send Final Stats
  emit('hha:end', {
    score: state.score,
    combo: state.maxCombo, // ส่ง Max Combo
    waterPct: Math.floor(state.waterPct),
    reason: reason
  });
}

// === MAIN BOOT FUNCTION ===
export async function boot(options = {}) {
  // Reset State
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
  emit('quest:update', { goalHeading: 'Collect Water Droplets', miniHeading: 'Normal Mode' });
  emit('hha:coach', { text: "Look around & Tap to collect!" });

  // Game Loop: Spawn Items
  gameLoopInterval = setInterval(spawnItem, CFG.spawnInterval);

  // Timer Loop: Time & Decay
  timerInterval = setInterval(() => {
    if (!state.isPlaying) return;

    state.timeLeft--;
    
    // น้ำลดลงเรื่อยๆ
    if (state.waterPct > 0) {
        state.waterPct -= CFG.decayRate;
    }

    // Game Over Conditions
    if (state.timeLeft <= 0) {
      endGame('TIME_UP');
    } else if (state.waterPct <= 0) {
      endGame('DEHYDRATED');
    }
    
    updateUI();
  }, 1000);
}
