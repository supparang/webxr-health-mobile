// Adventure Tuning — Day3–5 Ready
window.ADVENTURE_CFG = {
  // ========== ระยะเวลาด่าน/สปีด/หน้าตัดสิน ==========
  duration: 120,          // วินาที/ด่าน
  baseSpeed: 2.0,         // สปีดฐาน (จะเร่งตามเวลา+คอมโบ+fever)
  hitWindowZ: 0.34,       // หน้าต่างตัดสิน (ยิ่งน้อยยิ่งยาก)

  // ========== Tutorial & UX ==========
  tutorialSecs: 10,       // ช่วงสอนอัตโนมัติ (วินาทีแรก)
  showLegend: true,       // แสดงคำอธิบายมุมซ้ายบนตลอด
  showEventBanners: true, // ป้ายอีเวนต์ (Star Rush/Parade/Finale)
  laneColors: ['#0ea5e9','#334155','#22c55e'], // สีพื้นเลน (ซ้าย/กลาง/ขวา)

  // ========== Fever / คะแนน ==========
  feverCombo: 10,         // คอมโบที่ต้องการเพื่อเข้า Fever
  feverSecs: 6,           // ระยะเวลา Fever (วินาที)
  // *คะแนนคูณใน Fever จัดการใน game.js (x1.5)*

  // ========== สุ่มเกิดของวัตถุ ==========
  // สัดส่วนรวมควรใกล้ 1.0 (เกิน/ขาดเล็กน้อยได้)
  spawnBias: {
    orb: 0.55,     // เขียว เก็บ +20
    star: 0.12,    // ทอง เก็บ +80
    shield: 0.08,  // เกราะ บล็อกความเสียหาย 1 ครั้ง (สะสมได้ 2)
    magnet: 0.06,  // ดูดของเก็บ 5 วิ
    time: 0.05,    // +เวลา 2 วิ (ไม่เกิน duration เริ่มต้น)
    obstacle: 0.14 // สิ่งกีดขวาง (แดง)
  },

  // ========== อีเวนต์พิเศษระหว่างด่าน ==========
  miniEvents: [
    // at: เวลาเริ่ม (วินาที), type: 'star_rush'|'obstacle_parade', secs: ระยะเวลา
    { at: 55, type: 'star_rush',       secs: 10 },
    { at: 90, type: 'obstacle_parade', secs: 8  }
  ],
  microBossAt: 100, // เวลาเริ่ม Finale (กำแพง/แพทเทิร์นไล่เร็ว)

  // ========== พรีเซ็ตความยาก (ถ้าต้องการสลับ) ==========
  // NOTE: เกมใช้งานค่า base ด้านบนเป็นหลัก ถ้าจะโอเวอร์ไรด์ ให้ใช้ PRESET ตามชื่อ
  PRESET: {
    easy:   { duration: 100, baseSpeed: 1.8, hitWindowZ: 0.40, feverCombo: 8  },
    normal: { duration: 120, baseSpeed: 2.0, hitWindowZ: 0.34, feverCombo: 10 },
    hard:   { duration: 130, baseSpeed: 2.3, hitWindowZ: 0.30, feverCombo: 12 }
  },

  // ========== อื่น ๆ ==========
  allowURLPreset: true // true = อนุญาตให้อ่าน ?preset=easy|normal|hard มาโอเวอร์ไรด์ค่า
};
