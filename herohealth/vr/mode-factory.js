// ----- random position แบบ responsive (กันเป้าไปทับ HUD + ล่างจอ) -----
function randomScreenPos() {
  const w = window.innerWidth  || 1280;
  const h = window.innerHeight || 720;

  // ความสูง HUD ด้านบน (Water balance)
  const hud = document.querySelector('.hha-water');
  let hudH = 120; // fallback กรณีหา element ไม่เจอ
  if (hud) {
    const rect = hud.getBoundingClientRect();
    hudH = rect.height + 16; // +padding เล็กน้อย
  }

  // พื้นที่ปลอดภัยด้านล่าง (ปุ่ม, แถบมือถือ ฯลฯ)
  const bottomSafe = 140;

  // play area จริง (แต่เดี๋ยวจะบีบให้เป็น “โซนกลางจอ” อีกที)
  const topRaw    = hudH;
  const bottomRaw = h - bottomSafe;

  // ถ้าจอเตี้ยมากกันไว้ไม่ให้ top > bottom
  const top    = Math.min(topRaw, h * 0.55);
  const bottom = Math.max(bottomRaw, h * 0.45);

  // ขอบซ้าย/ขวา (เหลือ margin 10%)
  const left  = w * 0.10;
  const right = w * 0.90;

  // 🔹 บีบแนวตั้งให้เป็น “โซนกลางจอ” ประมาณ 40–50% กลาง ๆ
  const midY  = (top + bottom) / 2;
  const spanY = Math.min((bottom - top), h * 0.45); // ไม่สูงเกินครึ่งจอ
  const yMin  = midY - spanY / 2;
  const yMax  = midY + spanY / 2;

  const x = left + Math.random() * (right - left);
  const y = yMin + Math.random() * (yMax - yMin);

  return { x, y };
}