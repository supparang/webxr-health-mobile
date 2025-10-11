// Adventure Tuning (ปรับได้ทันที)
window.ADVENTURE_CFG = {
  duration: 120,        // วินาทีต่อด่าน
  baseSpeed: 2.0,       // ความเร็วเริ่ม
  hitWindowZ: 0.34,     // ระยะเวลาถึงวงฟ้า (ยิ่งน้อยยิ่งยาก)
  feverCombo: 10,
  feverSecs: 6,
  // อัตราสุ่มเกิด
  spawnBias: { orb:0.55, star:0.12, shield:0.08, magnet:0.06, time:0.05, obstacle:0.14 },
  // ช่วงเหตุการณ์พิเศษ
  miniEvents: [
    {at:55, type:'star_rush', secs:10},
    {at:90, type:'obstacle_parade', secs:8}
  ],
  microBossAt: 100,
  // สีกำกับเลนเพื่อไม่งง
  laneColors: ['#0ea5e9','#334155','#22c55e']
};
