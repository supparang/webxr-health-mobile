// === vr/mission.js (2025-11-06, robust mission deck) ===
export class MissionDeck {
  constructor(opts = {}) {
    // พูลภารกิจ (ตรวจผ่านฟังก์ชัน check(stats))
    this.pool = (opts.pool && Array.isArray(opts.pool)) ? opts.pool : [
      { id:'good10',    level:'easy',   label:'เก็บของดี 10 ชิ้น',       check:s=>s.goodCount>=10,    prog:s=>Math.min(10, s.goodCount), target:10 },
      { id:'avoid5',    level:'easy',   label:'หลีกของขยะ 5 ครั้ง',       check:s=>s.junkMiss>=5,      prog:s=>Math.min(5,  s.junkMiss),  target:5  },
      { id:'combo10',   level:'normal', label:'ทำคอมโบ 10',              check:s=>s.comboMax>=10,     prog:s=>Math.min(10, s.comboMax),  target:10 },
      { id:'good20',    level:'normal', label:'เก็บของดี 20 ชิ้น',       check:s=>s.goodCount>=20,    prog:s=>Math.min(20, s.goodCount), target:20 },
      { id:'nostreak10',level:'normal', label:'ไม่พลาด 10 วิ',            check:s=>s.noMissTime>=10,   prog:s=>Math.min(10, s.noMissTime),target:10 },
      { id:'fever2',    level:'hard',   label:'เข้า Fever 2 ครั้ง',       check:s=>s.feverCount>=2,    prog:s=>Math.min(2,  s.feverCount),target:2  },
      { id:'combo20',   level:'hard',   label:'คอมโบ 20 ต่อเนื่อง',      check:s=>s.comboMax>=20,     prog:s=>Math.min(20, s.comboMax),  target:20 },
      { id:'score500',  level:'hard',   label:'ทำคะแนน 500+',             check:s=>s.score>=500,       prog:s=>Math.min(500,s.score),     target:500},
      { id:'star3',     level:'normal', label:'เก็บดาว ⭐ 3 ดวง',          check:s=>s.star>=3,          prog:s=>Math.min(3,  s.star),      target:3  },
      { id:'diamond1',  level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',        check:s=>s.diamond>=1,       prog:s=>Math.min(1,  s.diamond),   target:1  },
    ];

    this.reset();
  }

  // --- วงจรชีวิต ---
  reset() {
    this.currentIndex = 0;
    this.deck = [];
    this.stats = {
      goodCount: 0,
      junkMiss:  0,
      comboMax:  0,
      noMissTime:0,   // วินาทีต่อเนื่องที่ไม่พลาด (อัปเดตใน second())
      feverCount:0,
      score:    0,
      star:     0,
      diamond:  0,
    };
    this._paused = false;
  }

  draw3() {
    this.reset();
    const pickBy = lvl => {
      const cands = this.pool.filter(q => q.level === lvl);
      if (cands.length === 0) return this.pool[Math.floor(Math.random()*this.pool.length)];
      return cands[Math.floor(Math.random()*cands.length)];
    };
    // กันซ้ำ id
    const chosen = new Map();
    for (const lvl of ['easy','normal','hard']) {
      let q = pickBy(lvl);
      let safety = 50;
      while (chosen.has(q.id) && safety-- > 0) q = pickBy(lvl);
      chosen.set(q.id, q);
    }
    this.deck = Array.from(chosen.values());
    return this.deck;
  }

  pause(){ this._paused = true; }
  resume(){ this._paused = false; }

  // เรียกทุก 1 วินาทีจากเกมหลัก
  second() {
    if (this._paused) return;
    // เพิ่ม noMissTime ทีละ 1 วินาที / ถ้าเพิ่งพลาดจะถูกรีเซ็ตใน onJunk()
    this.stats.noMissTime = Math.min(9999, this.stats.noMissTime + 1);
    this._autoAdvance();
  }

  // --- เหตุการณ์จากเกม (เรียกใช้ง่ายและชัดเจน) ---
  onGood() {
    this.stats.goodCount++;
    this._autoAdvance();
  }
  onJunk() {
    // ถือว่า "พลาด" → นับหลบ/พลาด 1 ครั้ง และรีเซ็ตตัวจับเวลาไม่พลาด
    this.stats.junkMiss++;
    this.stats.noMissTime = 0;
    this._autoAdvance();
  }
  onFeverStart() {
    this.stats.feverCount++;
    this._autoAdvance();
  }
  onStar()   { this.stats.star++;    this._autoAdvance(); }
  onDiamond(){ this.stats.diamond++; this._autoAdvance(); }
  updateScore(score) {
    if (Number.isFinite(score)) this.stats.score = Math.max(this.stats.score, score);
    this._autoAdvance();
  }
  updateCombo(combo) {
    if (Number.isFinite(combo)) this.stats.comboMax = Math.max(this.stats.comboMax, combo);
    this._autoAdvance();
  }

  // --- Backward-compat: รองรับโค้ดเดิมที่เรียก tick(ev) ---
  tick(ev = {}) {
    if (ev.good) this.onGood();
    if (ev.junk) this.onJunk();
    if (ev.feverStart || ev.feverActive===true) this.onFeverStart();
    if (ev.star) this.onStar();
    if (ev.diamond) this.onDiamond();
    if (Number.isFinite(ev.score)) this.updateScore(ev.score);
    if (Number.isFinite(ev.combo)) this.updateCombo(ev.combo);
    // หมายเหตุ: noMissTime ควรถูกอัปเดตที่ second() ตามจริง
    return this._autoAdvance();
  }

  // --- ตรวจความคืบหน้า / ขยับใบต่อไป ---
  _autoAdvance() {
    const cur = this.deck[this.currentIndex];
    if (!cur) return false;
    if (cur.check(this.stats)) {
      this.currentIndex = Math.min(this.deck.length - 1, this.currentIndex + 1);
      return true;
    }
    return false;
  }

  // --- API สำหรับ HUD ---
  getCurrent() {
    return this.deck[this.currentIndex] || null;
  }

  getProgress() {
    return this.deck.map((q, i) => ({
      id: q.id,
      label: q.label,
      level: q.level,
      done: q.check(this.stats),
      prog: (typeof q.prog === 'function') ? q.prog(this.stats) : undefined,
      target: q.target ?? undefined,
      current: i === this.currentIndex
    }));
  }

  isCleared() {
    // เคลียร์ = ผ่านครบทั้ง 3 ใบ (index อยู่ที่ใบสุดท้ายแล้วและผ่านมันแล้ว)
    if (this.deck.length === 0) return false;
    const last = this.deck[this.deck.length - 1];
    return this.currentIndex === this.deck.length - 1 && last.check(this.stats);
  }

  summary() {
    return {
      deck: this.deck.map(q => ({ id:q.id, label:q.label, level:q.level })),
      stats: { ...this.stats },
      cleared: this.isCleared(),
      currentIndex: this.currentIndex,
      progress: this.getProgress()
    };
  }

  // --- persistence ---
  serialize() {
    return {
      deck: this.deck.map(q => ({ id:q.id, level:q.level, label:q.label })), // ไม่ serialize ฟังก์ชัน
      stats: { ...this.stats },
      currentIndex: this.currentIndex
    };
  }

  load(state = {}) {
    try {
      // deck: รีแมปกลับมาจาก pool ด้วย id (เพื่อให้ได้ check/prog เดิม)
      if (Array.isArray(state.deck)) {
        this.deck = state.deck.map(d => this.pool.find(p => p.id === d.id) || d).slice(0,3);
      }
      if (state.stats && typeof state.stats === 'object') this.stats = { ...this.stats, ...state.stats };
      if (Number.isFinite(state.currentIndex)) this.currentIndex = Math.max(0, Math.min(this.deck.length-1, state.currentIndex));
    } catch { /* ignore */ }
  }
}
