// ----- random position แบบ responsive (แก้ใหม่กันเป้าไปทับ HUD) -----
function randomScreenPos() {
  const w = window.innerWidth  || 1280;
  const h = window.innerHeight || 720;

  // ความสูง HUD ด้านบน (Water balance)
  const hud = document.querySelector('.hha-water');
  let hudH = 120; // fallback
  if (hud) {
    hudH = hud.getBoundingClientRect().height + 20;
  }

  // ความสูงพื้นที่ล่าง (ปุ่มมือถือ / ขอบจอ)
  const bottomSafe = 140;

  // play area จริง
  const top    = hudH;
  const bottom = h - bottomSafe;

  // ขอบซ้าย/ขวา
  const left   = w * 0.10;
  const right  = w * 0.90;

  const x = left + Math.random() * (right - left);
  const y = top  + Math.random() * (bottom - top);

  return { x, y };
}