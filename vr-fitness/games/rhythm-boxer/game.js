/* ===== RHYTHM SPEED+TIMER PATCH (drop-in) =====
   - เริ่มช้า → เร็วขึ้นตามเวลา + คอมโบ (easing)
   - สแปว์นโน้ตเริ่มห่าง → ถี่ขึ้นอัตโนมัติ
   - เวลานับถอยหลังเดินจริง + จบเกมเมื่อหมดเวลา
   ใช้ร่วมกับตัวแปร/ฟังก์ชันเดิม: running, combo, endGame(), spawnNote(), moveAllNotes(dt), hit detection, etc.
*/

// ---------- Config ----------
const GAME_DURATION_SEC = 90;        // ระยะเวลาเล่นทั้งเพลง (แก้ได้)
const SPEED = {
  base: 0.35,                        // ความเร็วเริ่มต้น (ช้า)
  max:  1.25,                        // ความเร็วสูงสุด (จะไต่ไปเรื่อย ๆ)
  rampSec: 75,                       // ใช้เวลา ~กี่วินาทีถึงโซนเร็ว
  rampCombo: 120,                    // คอมโบมีผลเร่งด้วย (ถึง ~120 จะช่วยให้เร็วขึ้น)
};

const SPAWN = {
  baseInterval: 1050,                // ช่วงเวลาสแปว์นเริ่มต้น (โน้ตห่าง)
  minInterval:  420,                 // ถี่สุดที่อนุญาต
  easeInAfterSec: 50,                // เริ่มเร่งความถี่ราววินาทีที่ 50
};

// ---------- State ----------
let startTime = 0;
let lastFrame = 0;
let elapsedSec = 0;
let nextSpawnAt = 0;                 // timestamp (ms) สำหรับสแปว์นถัดไป
let currentSpeed = SPEED.base;       // ความเร็วตกของโน้ต (หน่วยตามซีน)
let timeLeft = GAME_DURATION_SEC;

// อ้างอิง DOM (ถ้าชื่อ id ต่าง ให้แก้ตรงนี้)
const timeEl  = document.getElementById('time');   // <span id="time">…</span>
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');

// ---------- Ease helpers ----------
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function easeInOut(t){ // 0..1 → 0..1
  return t<.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
}

// ---------- Speed / Spawn compute ----------
function computeSpeedFactor(){
  // factor จากเวลา
  const tf = clamp(elapsedSec / SPEED.rampSec, 0, 1);
  // factor จากคอมโบ (เร่งขึ้นเล็กน้อย)
  const cf = clamp((combo || 0) / SPEED.rampCombo, 0, 1);
  // รวมและทำ easing
  return easeInOut(clamp(tf + cf*0.6, 0, 1));
}

function updateSpeedAndSpawnPlan(nowMs){
  // ความเร็วตกของโน้ต (เริ่มช้า → เร็วขึ้น)
  const f = computeSpeedFactor();
  currentSpeed = SPEED.base + (SPEED.max - SPEED.base) * f;

  // คำนวณ interval สแปว์น (เริ่มห่าง → ถี่ขึ้น)
  let interval = SPAWN.baseInterval;
  if (elapsedSec >= SPAWN.easeInAfterSec) {
    const p = clamp((elapsedSec - SPAWN.easeInAfterSec) / (SPEED.rampSec - SPAWN.easeInAfterSec + 1e-6), 0, 1);
    interval = SPAWN.baseInterval - (SPAWN.baseInterval - SPAWN.minInterval) * easeInOut(p);
  }
  // ตั้งการสแปว์นครั้งถัดไปถ้าถึงเวลา
  if (nowMs >= nextSpawnAt) {
    // เริ่มเกมช่วงแรกให้ห่างจริง ๆ: 10 วินาทีแรกสแปว์นช้ากว่าปกติอีกหน่อย
    const earlyMul = elapsedSec < 10 ? 1.25 : 1.0;
    nextSpawnAt = nowMs + interval * earlyMul;
    spawnNote(); // <-- ใช้ตัวสร้างโน้ตเดิมของเกม
  }
}

// ---------- เวลา / HUD ----------
function updateHUD(){
  if (scoreEl) scoreEl.textContent = (window.score|0);
  if (comboEl) comboEl.textContent = (window.combo|0);
  if (timeEl)  timeEl.textContent  = timeLeft|0;
}

function updateTimer(){
  const remain = Math.max(0, GAME_DURATION_SEC - Math.floor(elapsedSec));
  if (remain !== timeLeft){
    timeLeft = remain;
    if (timeEl) timeEl.textContent = timeLeft;
  }
  if (timeLeft <= 0){
    endGame?.();  // เรียกฟังก์ชันจบเกมเดิม
    running = false;
  }
}

// ---------- Main Loop ----------
function mainLoop(ts){
  if (!running) return;
  if (!lastFrame){ lastFrame = ts; }
  const dt = (ts - lastFrame) / 1000;
  lastFrame = ts;

  // อัปเดตเวลาผ่านไป
  elapsedSec = (ts - startTime) / 1000;

  // อัปเดต speed+แผนสแปว์น
  updateSpeedAndSpawnPlan(ts);

  // ขยับโน้ตทั้งหมดด้วยความเร็วใหม่ (ต้องให้ moveAllNotes อ่าน currentSpeed)
  moveAllNotes(dt, currentSpeed);

  // อัปเดตเวลา/คะแนนบน HUD
  updateTimer();
  updateHUD();

  requestAnimationFrame(mainLoop);
}

// ---------- Hooks เข้ากับระบบเดิม ----------
window.RB = window.RB || {};
// เริ่มเกม / เริ่มเพลง
window.RB.start = function(){
  // reset state เดิมของเกมคุณให้เรียบร้อยก่อน (เช่น ล้างโน้ต/คะแนน/คอมโบ ฯลฯ)
  // ... resetGameState() ...
  running   = true;
  startTime = performance.now();
  lastFrame = 0;
  elapsedSec= 0;
  timeLeft  = GAME_DURATION_SEC;
  nextSpawnAt = startTime + 600; // หน่วงเล็กน้อยก่อนสแปว์นแรก
  updateHUD();
  requestAnimationFrame(mainLoop);
};

// หยุด/พักเกม (ถ้าเกมคุณมีปุ่ม Pause/Resume)
window.RB.pause = function(){
  running = false;
};
window.RB.resume = function(){
  if (timeLeft <= 0) return; // หมดเวลาแล้วไม่ resume
  if (!running){
    running = true;
    // ทำให้ lastFrame ทันสมัย เพื่อไม่ให้ dt กระโดด
    lastFrame = performance.now();
    requestAnimationFrame(mainLoop);
  }
};

// ---------- ตัวอย่าง moveAllNotes(dt, speed) แบบปลอดภัย ----------
// ถ้าโค้ดเดิมของคุณมีอยู่แล้ว ให้แก้ให้รับ speed และคูณ dt
function moveAllNotes(dt, fallSpeed){
  // สมมติเราจัดเก็บรายการโน้ตใน window.notes = [{el, y, lane, hit}, ...]
  const arr = window.notes || [];
  const HIT_Y = 0.0;           // y ของเส้น HIT LINE
  const MISS_BELOW = -0.4;     // ต่ำกว่านี้ถือว่าพลาด

  for (let i=0;i<arr.length;i++){
    const n = arr[i];
    if (!n || !n.el) continue;
    // ตกลงตามความเร็ว (เริ่มจะช้า → เร็วขึ้น)
    n.y -= fallSpeed * dt;

    // อัปเดตตำแหน่งจริง
    n.el.setAttribute('position', `${n.x} ${n.y.toFixed(3)} ${n.z}`);

    // เช็ค miss
    if (!n.hit && n.y < MISS_BELOW){
      n.hit = true;
      // เรียกระบบ MISS เดิมของเกม
      onMiss?.(n);
      // ลบ object ออกจากฉาก
      try{ n.el.parentNode && n.el.parentNode.removeChild(n.el); }catch{}
    }
  }
}

// ---------- ตัวอย่าง spawnNote() เริ่มห่าง ๆ ----------
// ถ้าโค้ดเดิมของคุณมีอยู่แล้วใช้ต่อได้เลย
// ให้แน่ใจว่าโน้ตเกิดด้วย y เริ่มสูงพอ (เช่น 2.0) แล้วปล่อยตกลงมาที่ HIT_Y=0
function spawnNote(){
  // ตัวอย่างแบบง่าย: สุ่มเลน 0..3
  const lane = Math.floor(Math.random()*4);
  const xPos = (-1.2 + lane*0.8);  // ตำแหน่ง x ตามเลน
  const note = document.createElement('a-cylinder');
  note.setAttribute('radius','0.14');
  note.setAttribute('height','0.08');
  note.setAttribute('color', pickNoteColor());
  note.classList.add('rb-note','clickable');
  note.setAttribute('position', `${xPos} 2.0 -2.2`);
  document.getElementById('arena').appendChild(note);

  const n = { el:note, x:xPos, y:2.0, z:-2.2, lane, hit:false };
  window.notes = window.notes || [];
  window.notes.push(n);
}

// สีโน้ตหลายสี สุ่มสวย ๆ
function pickNoteColor(){
  const palette = ['#00d0ff','#a3ff3b','#ffd166','#ff6b6b','#a899ff','#00ffa3'];
  return palette[Math.floor(Math.random()*palette.length)];
}

/* ===== END PATCH ===== */
