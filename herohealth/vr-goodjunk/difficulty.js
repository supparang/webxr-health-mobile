// === /herohealth/vr-goodjunk/difficulty.js ===
// ปรับให้ Good vs Junk VR เป้าใหญ่ขึ้น คลิกง่ายขึ้น

export class Difficulty {
  constructor () {
    this.level = 'normal';

    // size = ขนาดเป้า (ยิ่งมากยิ่งใหญ่)
    // rate = ความถี่การเกิดเป้า (ms)
    // life = อายุของเป้า (ms)
    this.table = {
      easy: {
        size: 1.2,   // เดิม ~0.9 → ขยายให้เด็ก ป.5 คลิกง่ายมาก
        rate: 950,
        life: 2600
      },
      normal: {
        size: 1.05,  // ใหญ่กว่าปกติเล็กน้อย
        rate: 820,
        life: 2300
      },
      hard: {
        size: 0.95,  // ยังใหญ่กว่าเดิมนิดหนึ่ง แต่คงความท้าทาย
        rate: 680,
        life: 2100
      }
    };
  }

  set (level) {
    const lv = String(level || 'normal').toLowerCase();
    if (lv === 'easy' || lv === 'hard') this.level = lv;
    else this.level = 'normal';
  }

  get () {
    return this.table[this.level] || this.table.normal;
  }
}

export default Difficulty;
