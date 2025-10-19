// ./game/core/missions.js  (หรือแทน class MissionSystem ใน main.js ได้ทันที)
export class MissionSystem {
  constructor(storageKey = 'hha_mission_v1', badgeKey = 'hha_badges_v1') {
    this.SK = storageKey;
    this.BK = badgeKey;
    this.goal = null;         // { id, mode, titleTH, titleEN, bonus, check(ctx) }
    this.today = this._todayKey(); // YYYY-MM-DD (Asia/Bangkok)
    this.state = this._load() || { day: this.today, done:false, streak:0, totalCompleted:0, history:[] };
    if (this.state.day !== this.today) {
      // day rollover
      this.state.day = this.today;
      this.state.done = false;
      this._save();
    }
    this.badges = this._loadBadges() || []; // [{id, ts}]
    this.lastEval = null; // { ok, bonus, awardedBadges:[], goal }
  }

  // ====== PUBLIC API ======
  roll(mode) {
    // สุ่ม mission วันนี้จาก pool โดย “คงที่ต่อวัน” (seeded by date)
    const rng = this._rng(this._seedFromDay(this.today, mode));
    const pool = this._pool()[mode] || this._pool().generic;
    const pick = pool[Math.floor(rng() * pool.length)];
    // ยึด mission วันนี้ให้คงเดิมจนกว่าจะข้ามวัน
    const persisted = this.state.history?.find(h => h.day === this.today);
    if (persisted?.goalId) {
      const prev = [...pool, ...this._pool().generic].find(m => m.id === persisted.goalId) || pick;
      this.goal = { ...prev, mode };
    } else {
      this.goal = { ...pick, mode };
    }
    return this.goal;
  }

  evaluate(ctx) {
    // ctx มาจาก main.js: {...state.ctx, combo: systems.score.combo, bestCombo: systems.score.bestCombo, ...}
    if (!this.goal) return 0;
    const ok = !!this.goal.check(ctx);
    let bonus = ok ? (this.goal.bonus ?? 30) : 0;

    // บันทึก daily streak / history เฉพาะถ้าสำเร็จและยังไม่กดไปแล้ววันนี้
    if (ok && !this.state.done) {
      this.state.done = true;
      // streak: ต่อเมื่อเมื่อวานสำเร็จด้วย
      const yesterdayKey = this._offsetDay(-1);
      const didYesterday = this.state.history?.some(h => h.day === yesterdayKey && h.ok);
      this.state.streak = (didYesterday ? (this.state.streak||0) : 0) + 1;
      this.state.totalCompleted = (this.state.totalCompleted||0) + 1;
      this.state.history = this._appendHistory({
        day: this.today, goalId: this.goal.id, mode: this.goal.mode, ok: true, bonus
      }, this.state.history);
      this._save();
    } else if (!ok) {
      // บันทึกผลไม่สำเร็จ (ไม่กระทบ streak)
      this.state.history = this._appendHistory({
        day: this.today, goalId: this.goal.id, mode: this.goal.mode, ok: false, bonus: 0
      }, this.state.history);
      this._save();
    }

    // ====== SYSTEM MISSIONS + BADGES ======
    const awarded = [];
    // 1) Streak badges
    awarded.push(...this._tryBadge('streak_3',  () => this.state.streak >= 3));
    awarded.push(...this._tryBadge('streak_7',  () => this.state.streak >= 7));
    awarded.push(...this._tryBadge('streak_14', () => this.state.streak >= 14));
    // 2) Lifetime completed badges
    awarded.push(...this._tryBadge('mission_10',  () => this.state.totalCompleted >= 10));
    awarded.push(...this._tryBadge('mission_30',  () => this.state.totalCompleted >= 30));
    // 3) Skill badges (อิงสถิติรอบเกมนี้)
    awarded.push(...this._tryBadge('combo_10',   () => (ctx.bestCombo||0) >= 10));
    awarded.push(...this._tryBadge('trap_avoid', () => (ctx.trapsHit||0) === 0));
    awarded.push(...this._tryBadge('clean_plate',() => (ctx.overfillCount||0) === 0 && (ctx.plateFills||0) > 0));

    // (ตัวเลือก) ให้โบนัสเล็ก ๆ จาก badge ใหม่ (ถ้าอยากได้)
    // bonus += awarded.length * 5;

    this._saveBadges();

    this.lastEval = { ok, bonus, awardedBadges: awarded, goal: this.goal };
    return bonus;
  }

  // สำหรับ UI สรุปผล/หน้าช่วยเหลือ
  getSummary(lang = 'TH') {
    const L = (lang === 'EN') ? this._L_EN() : this._L_TH();
    const g = this.goal;
    const title = g ? (lang === 'EN' ? (g.titleEN || g.titleTH) : (g.titleTH || g.titleEN)) : '-';
    return {
      today: this.today,
      goalTitle: title,
      goalBonus: g?.bonus ?? 30,
      done: !!this.state.done,
      streak: this.state.streak || 0,
      totalCompleted: this.state.totalCompleted || 0,
      badges: [...this.badges],
      last: this.lastEval,
      labels: L,
    };
  }

  // ====== INTERNALS ======
  _pool() {
    // โจทย์ต่อวัน (Daily) — ใส่แบบอ่านง่ายและอิง ctx ตอนจบเกม
    const daily = {
      goodjunk: [
        { id:'gj_score_200', bonus:40, titleTH:'ทำคะแนน 200+ ในโหมด ดี vs ขยะ', titleEN:'Score 200+ in Good vs Junk',
          check: ctx => (ctx.score||0) >= 200 },
        { id:'gj_combo_8', bonus:35, titleTH:'ทำคอมโบอย่างน้อย x8', titleEN:'Reach combo x8',
          check: ctx => (ctx.bestCombo||0) >= 8 },
        { id:'gj_trap_low', bonus:35, titleTH:'โดนกับดักไม่เกิน 1 ครั้ง', titleEN:'Hit traps ≤ 1',
          check: ctx => (ctx.trapsHit||0) <= 1 },
      ],
      groups: [
        { id:'gp_target_12', bonus:40, titleTH:'เก็บให้ตรงหมวด ≥ 12 ครั้ง', titleEN:'12+ correct target hits',
          check: ctx => (ctx.targetHitsTotal||0) >= 12 },
        { id:'gp_wrong_le2', bonus:35, titleTH:'ผิดหมวดไม่เกิน 2 ครั้ง', titleEN:'Wrong group ≤ 2',
          check: ctx => (ctx.groupWrong||0) <= 2 },
        { id:'gp_combo_10', bonus:35, titleTH:'ทำคอมโบอย่างน้อย x10', titleEN:'Reach combo x10',
          check: ctx => (ctx.bestCombo||0) >= 10 },
      ],
      hydration: [
        { id:'hy_ok_time', bonus:40, titleTH:'รักษา Hydration โซนปกติรวม ≥ 20 วินาที', titleEN:'Stay in OK zone ≥ 20s',
          check: ctx => (ctx._okTicks||0) >= 20 },
        { id:'hy_low_penalty_0', bonus:35, titleTH:'ไม่โดนหักเวลาเพราะ Low เลย', titleEN:'No time penalty from Low',
          check: ctx => (ctx.lowSweetPunish||0) === 0 },
        { id:'hy_sweets_le1', bonus:35, titleTH:'เครื่องดื่มหวานพลาด ≤ 1', titleEN:'Sugary drinks missed ≤ 1',
          check: ctx => (ctx.sweetMiss||0) <= 1 },
      ],
      plate: [
        { id:'pl_perfect_2', bonus:45, titleTH:'ทำ Perfect Plate อย่างน้อย 2 จาน', titleEN:'≥ 2 Perfect Plates',
          check: ctx => (ctx.perfectPlates||0) >= 2 },
        { id:'pl_overfill_0', bonus:40, titleTH:'ไม่ overfill เลย', titleEN:'No overfill',
          check: ctx => (ctx.overfillCount||0) === 0 },
        { id:'pl_fills_14', bonus:35, titleTH:'เติมชิ้นรวม ≥ 14', titleEN:'Fill total items ≥ 14',
          check: ctx => (ctx.plateFills||0) >= 14 },
      ],
      // fallback
      generic: [
        { id:'ge_score_180', bonus:30, titleTH:'ทำคะแนนรวม ≥ 180', titleEN:'Score ≥ 180',
          check: ctx => (ctx.score||0) >= 180 },
        { id:'ge_combo_10', bonus:30, titleTH:'ทำคอมโบอย่างน้อย x10', titleEN:'Reach combo x10',
          check: ctx => (ctx.bestCombo||0) >= 10 },
      ],
    };
    return daily;
  }

  _tryBadge(id, cond) {
    if (this.badges.some(b => b.id === id)) return [];
    if (!cond()) return [];
    this.badges.push({ id, ts: Date.now() });
    return [id];
  }

  _appendHistory(entry, arr=[]) {
    const withoutToday = arr.filter(h => h.day !== entry.day);
    return [...withoutToday, entry].slice(-120); // กันโตเกินไป
  }

  _L_TH() {
    return {
      mission: 'ภารกิจวันนี้',
      completed: 'สำเร็จแล้ว',
      streak: 'สตรีค',
      badges: 'ตรา',
      bonus: 'โบนัส',
    };
  }
  _L_EN() {
    return {
      mission: 'Today’s Mission',
      completed: 'Completed',
      streak: 'Streak',
      badges: 'Badges',
      bonus: 'Bonus',
    };
  }

  // ====== STORAGE ======
  _load() {
    try { return JSON.parse(localStorage.getItem(this.SK)||'null'); } catch { return null; }
  }
  _save() {
    try { localStorage.setItem(this.SK, JSON.stringify(this.state)); } catch {}
  }
  _loadBadges() {
    try { return JSON.parse(localStorage.getItem(this.BK)||'null'); } catch { return null; }
  }
  _saveBadges() {
    try { localStorage.setItem(this.BK, JSON.stringify(this.badges.slice(-200))); } catch {}
  }

  // ====== DATE/SEED HELPERS ======
  _todayKey() { return this._ymd(new Date()); }
  _offsetDay(delta) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + delta); // ละไว้เรื่อง TZ ลึก ๆ ใช้ key ของ _ymd() ด้านล่าง
    return this._ymd(d);
  }
  _ymd(d) {
    // ทำ key ตามโซนเวลาเอเชีย/กรุงเทพ (ถ้า browser รองรับ)
    try {
      const s = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Bangkok', year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
      // en-CA => YYYY-MM-DD
      return s;
    } catch {
      const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), da = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${da}`;
    }
  }
  _seedFromDay(day, mode='') {
    // simple hash
    const s = `${day}|${mode}`;
    let h = 2166136261 >>> 0;
    for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  _rng(seed) {
    // mulberry32
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ t>>>15, 1 | t);
      r ^= r + Math.imul(r ^ r>>>7, 61 | r);
      return ((r ^ r>>>14) >>> 0) / 4294967296;
    };
  }
}
