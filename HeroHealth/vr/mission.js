// === /HeroHealth/vr/mission.js (2025-11-14 GREEN-TICK READY) ===
export class MissionDeck {
  constructor(opts = {}) {
    const { pool, goalPool, miniPool } = opts;
    this.goalPool = Array.isArray(goalPool) ? goalPool : [];
    this.miniPool = Array.isArray(miniPool) ? miniPool : (Array.isArray(pool) ? pool : []);

    // เลือกชุดที่กำลัง “เล่นอยู่”
    this.goals = [];   // เลือกมา N เป้าใหญ่
    this.mini  = [];   // เลือกมา 3 mini ปัจจุบัน

    // นับสถิติกลางของเกม (ให้ check/prog อ่านค่า)
    this.stats = {
      score: 0,
      combo: 0,
      comboMax: 0,
      goodCount: 0,    // เก็บของดีสำเร็จกี่ครั้ง
      junkMiss: 0,     // โดนของเสีย/พลาด
      tick: 0,         // วินาทีที่ผ่านไป (รวมทั้งด่าน)
      // สำหรับโหมดที่มีโซนน้ำ / สี ฯลฯ
      zone: '',
      greenTick: 0     // นับวินาทีที่ “เคยอยู่ GREEN” แบบสะสม (ไม่ลดกลับ)
    };

    // นับจำนวน mini ที่ “ถูกเสนอ” ไปแล้วทั้งหมด (รวมทุก wave)
    this.miniPresented = 0;
  }

  // ---------- helpers ----------
  _pickN(arr, n) {
    const src = [...arr];
    const out = [];
    for (let i = 0; i < n && src.length; i++) {
      const k = (Math.random() * src.length) | 0;
      out.push(src.splice(k, 1)[0]);
    }
    return out;
  }

  // ---------- goal ops ----------
  drawGoals(n = 5) {
    this.goals = this._pickN(this.goalPool, n);
    return this.goals;
  }

  // ---------- mini ops ----------
  draw3() {
    this.mini = this._pickN(this.miniPool, 3);
    this.miniPresented += this.mini.length;
    return this.mini;
  }

  // ---------- progress snapshots ----------
  getProgress(type) {
    const list = type === 'goals' ? this.goals
               : type === 'mini'  ? this.mini
               : [];
    return list.map(q => ({
      id: q.id,
      label: q.label,
      target: Number.isFinite(q.target) ? q.target : 0,
      // ฟังก์ชัน prog/check ต้องรับ this.stats
      prog:  typeof q.prog  === 'function' ? (q.prog(this.stats)  | 0) : 0,
      done: !!(typeof q.check === 'function' && q.check(this.stats))
    }));
  }

  getCurrent(type) {
    const prog = this.getProgress(type);
    return prog.find(x => !x.done) || prog[0] || null;
  }

  isCleared(type) {
    const prog = this.getProgress(type);
    return prog.length > 0 && prog.every(x => x.done);
  }

  // ---------- stat updates from mode ----------
  updateScore(n) {
    this.stats.score = n | 0;
  }
  updateCombo(n) {
    this.stats.combo = n | 0;
    if (this.stats.combo > this.stats.comboMax) this.stats.comboMax = this.stats.combo;
  }
  onGood() {
    this.stats.goodCount += 1;
  }
  onJunk() {
    this.stats.junkMiss += 1;
    this.stats.combo = 0; // ส่วนใหญ่โหมดอยากให้พลาดแล้วคอมโบหลุด
  }
  second() {
    this.stats.tick += 1;
  }
}

export default { MissionDeck };
