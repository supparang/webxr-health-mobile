// === /herohealth/vr-goodjunk/difficulty.js ===
// Difficulty model สำหรับ Good vs Junk VR
// กำหนดขนาดเป้า (size), ความถี่การเกิดเป้า (rate ms), อายุเป้า (life ms)
//  - easy   : เป้าใหญ่, อยู่บนจอนาน, spawn ไม่ถี่มาก → เด็ก ป.5 เล่นสบาย
//  - normal : ค่ากลาง ใช้เป็นค่ามาตรฐานสำหรับวิจัย
//  - hard   : เป้าเล็กลง, spawn ถี่, อายุสั้น → ใช้ทดสอบสมาธิ/RT สูงขึ้น
//
// ใช้คู่กับ GameEngine.js:
//   import { Difficulty } from './difficulty.js';
//   const diffModel = new Difficulty();
//   diffModel.set('easy' | 'normal' | 'hard');
//   const cfg = diffModel.get(); // { size, rate, life }

export class Difficulty {
  constructor () {
    this.level = 'normal';

    // size = คูณขนาดเป้า (วงกลม + emoji)
    // rate = ช่วงห่างระหว่างการ spawn เป้า (ms) ยิ่งน้อยยิ่งถี่
    // life = อายุของเป้าแต่ละอัน (ms) ยิ่งน้อยยิ่งหายเร็ว
    this.table = {
      easy: {
        size: 1.2,   // เดิม ~0.9 → ขยายให้เด็ก ป.5 คลิกง่ายมาก
        rate: 950,   // ช้ากว่า normal นิดหน่อย
        life: 2600   // เป้าอยู่บนจอนานที่สุด
      },
      normal: {
        size: 1.05,  // ใหญ่กว่าปกติเล็กน้อย ให้รู้สึก "ดีต่อผู้ใช้"
        rate: 820,   // ค่ากลาง ใช้เป็น baseline สำหรับงานวิจัย
        life: 2300
      },
      hard: {
        size: 0.95,  // ยังใหญ่กว่าเดิมนิดหนึ่ง แต่คงความท้าทาย
        rate: 680,   // spawn ถี่ขึ้น
        life: 2100   // อยู่สั้นลง ต้องโฟกัสดีขึ้น
      }
    };
  }

  /**
   * ตั้งระดับความยาก ("easy" | "normal" | "hard")
   */
  set (level) {
    const lv = String(level || 'normal').toLowerCase();
    if (lv === 'easy' || lv === 'hard') {
      this.level = lv;
    } else {
      this.level = 'normal';
    }
  }

  /**
   * คืนค่าคอนฟิกปัจจุบัน { size, rate, life }
   */
  get () {
    return this.table[this.level] || this.table.normal;
  }

  /**
   * (ไม่บังคับใช้) helper ไว้ debug หรือ log ลง research
   * คืน object ที่มี level + config
   */
  describe () {
    const cfg = this.get();
    return {
      level: this.level,
      size: cfg.size,
      rate: cfg.rate,
      life: cfg.life
    };
  }
}

export default Difficulty;
