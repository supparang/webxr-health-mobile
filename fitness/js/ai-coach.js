// === /fitness/js/ai-coach.js — AI Coach (Explainable micro-tips, rate-limited) (A-43) ===
'use strict';

export class AICoach {
  constructor(opts = {}) {
    this.enabled = opts.enabled !== false;
    this.rng = opts.rng || Math.random;

    this.cooldownMs = opts.cooldownMs ?? 2600; // rate-limit tip popup
    this.minGapMs = opts.minGapMs ?? 1200;     // กัน “ทับ” feedback สำคัญ
    this.lastTipAt = -1e9;

    this.comboMilestones = new Set([5, 10, 15, 20, 30]);

    // rolling stats (short window)
    this.windowMs = 8000;
    this.events = []; // {t,type,targetType,rt,grade}

    // counters
    this.decoyHits = 0;
    this.bombHits = 0;
    this.normalHits = 0;
    this.timeoutsNormal = 0;
    this.timeoutsBossFace = 0;

    this.lastDecisionAt = 0;
  }

  reset() {
    this.events.length = 0;
    this.decoyHits = 0;
    this.bombHits = 0;
    this.normalHits = 0;
    this.timeoutsNormal = 0;
    this.timeoutsBossFace = 0;
    this.lastTipAt = -1e9;
    this.lastDecisionAt = 0;
  }

  // เก็บเหตุการณ์เพื่อวิเคราะห์ “ช่วงสั้น” (explainable)
  onEvent(now, ev) {
    if (!this.enabled) return;
    if (!ev) return;

    const e = {
      t: now,
      type: ev.event_type || ev.type || '',
      targetType: ev.target_type || ev.targetType || '',
      isBossFace: !!(ev.is_boss_face ?? ev.isBossFace),
      grade: ev.grade || '',
      rt: (ev.rt_ms ?? ev.rtMs),
      comboAfter: ev.combo_after ?? ev.comboAfter ?? 0,
      playerHp: typeof ev.player_hp === 'number' ? ev.player_hp : (ev.playerHp),
      bossHp: typeof ev.boss_hp === 'number' ? ev.boss_hp : (ev.bossHp),
    };

    this.events.push(e);
    this._trim(now);

    if (e.type === 'hit') {
      if (e.targetType === 'decoy') this.decoyHits++;
      else if (e.targetType === 'bomb') this.bombHits++;
      else if (e.isBossFace) {/* ignore */}
      else if (e.targetType === 'normal') this.normalHits++;
    } else if (e.type === 'timeout') {
      if (e.isBossFace) this.timeoutsBossFace++;
      else if (e.targetType === 'normal') this.timeoutsNormal++;
    }
  }

  // ตัด event เก่า
  _trim(now) {
    const t0 = now - this.windowMs;
    while (this.events.length && this.events[0].t < t0) this.events.shift();
  }

  // สร้าง tip แบบ explainable
  decideTip(now, snapshot) {
    if (!this.enabled) return null;
    if (now - this.lastTipAt < this.cooldownMs) return null;

    // กัน tip ไปทับ feedback หลักที่เพิ่งถูกตั้ง
    if (snapshot && snapshot.lastFeedbackAt != null) {
      if (now - snapshot.lastFeedbackAt < this.minGapMs) return null;
    }

    const w = this.events;
    const n = w.length;
    if (n < 4) return null;

    // สถิติช่วงสั้น
    const hits = w.filter(x => x.type === 'hit').length;
    const timeouts = w.filter(x => x.type === 'timeout').length;
    const avgRt = this._avgRt(w);
    const slowRt = (avgRt != null && avgRt > 520);
    const verySlowRt = (avgRt != null && avgRt > 650);

    const decoyHitRecent = w.filter(x => x.type === 'hit' && x.targetType === 'decoy').length;
    const bombHitRecent = w.filter(x => x.type === 'hit' && x.targetType === 'bomb').length;
    const missRecent = w.filter(x => x.type === 'timeout' && (x.targetType === 'normal' || x.isBossFace)).length;

    const hp = snapshot?.playerHp ?? null;
    const fever = snapshot?.fever ?? 0;
    const feverOn = !!snapshot?.feverOn;

    // 1) พลาดเยอะ → สายตา/โฟกัส
    if (missRecent >= 3 && (slowRt || verySlowRt)) {
      return this._tip(
        'โฟกัส “เป้าสีเขียว/ปกติ” ก่อน 🟢',
        `ช่วง 8 วิที่ผ่านมา พลาด ${missRecent} ครั้ง และ RT เฉลี่ย ~${Math.round(avgRt)}ms → ลอง “จ้องกลางจอ” แล้วแตะทันทีที่เป้าโผล่`
      );
    }

    // 2) โดน decoy บ่อย → อธิบายชัด
    if (decoyHitRecent >= 2) {
      return this._tip(
        'ระวัง “เป้าลวง” 🎭',
        `คุณโดนเป้าลวง ${decoyHitRecent} ครั้งในช่วงสั้น ๆ → ให้รอจังหวะชัด ๆ ก่อนแตะ (อย่าตะบี้ตะบัน)`
      );
    }

    // 3) โดน bomb บ่อย → สอนใช้ shield
    if (bombHitRecent >= 2) {
      return this._tip(
        'เห็น 💣 ให้ชะลอ 0.2 วิ',
        `โดนระเบิด ${bombHitRecent} ครั้ง → ถ้ามี 🛡️ ค่อยเสี่ยง ถ้าไม่มีให้ “ปล่อยผ่าน” เพื่อรักษา HP`
      );
    }

    // 4) HP ต่ำ → ค้นหา heal/shield
    if (hp != null && hp <= 0.35) {
      return this._tip(
        'HP ต่ำ! เล็งหา ❤️ / 🛡️',
        `ตอนนี้ HP เหลือน้อย → ตีเป้า ❤️ เพื่อฟื้น หรือ 🛡️ กัน 💣 จะอยู่ได้นานขึ้น`
      );
    }

    // 5) FEVER เกือบเต็ม → เร่งให้สนุก
    if (!feverOn && fever >= 0.72) {
      return this._tip(
        'อีกนิดเข้า FEVER! 🔥',
        `เกจใกล้เต็มแล้ว → รีบตี “เป้าปกติ” ติดต่อกันเพื่อเปิด FEVER และได้คูณคะแนน`
      );
    }

    // 6) เล่นดีต่อเนื่อง → “hype”
    if (hits >= 6 && timeouts === 0 && !verySlowRt) {
      const hype = this._pick([
        'จังหวะดีมาก! ไปต่อ! ⚡',
        'กำลังเข้ามือ! คุมเกมให้ได้! 😎',
        'โคตรนิ่ง! รักษาคอมโบไว้! 💎'
      ]);
      return this._tip(hype, `ช่วงสั้น ๆ นี้ hit ${hits} ครั้งแทบไม่พลาด → ลองเพิ่มความเร็วแตะให้คมขึ้นอีกนิด`);
    }

    return null;
  }

  // milestone: combo → hype แบบไม่ถี่
  decideComboHype(now, combo) {
    if (!this.enabled) return null;
    if (!this.comboMilestones.has(combo)) return null;
    if (now - this.lastTipAt < this.cooldownMs) return null;

    const line = this._pick([
      `คอมโบ ${combo}! สุดยอด! ✨`,
      `คอมโบ ${combo}! อย่าหลุดนะ! 🔥`,
      `คอมโบ ${combo}! ล็อกเป้าให้แน่น! 🎯`
    ]);
    return this._tip(line, `คุณทำคอมโบถึง ${combo} → จังหวะมือกับตาเข้าที่แล้ว รักษา rhythm ต่อเนื่อง`);
  }

  commitTip(now) {
    this.lastTipAt = now;
    this.lastDecisionAt = now;
  }

  _avgRt(list) {
    const rts = list
      .filter(x => x.type === 'hit' && typeof x.rt === 'number' && x.rt >= 0 && x.rt < 5000)
      .map(x => x.rt);
    if (!rts.length) return null;
    const sum = rts.reduce((a, b) => a + b, 0);
    return sum / rts.length;
  }

  _pick(arr) {
    const i = Math.floor(this.rng() * arr.length);
    return arr[Math.max(0, Math.min(arr.length - 1, i))];
  }

  _tip(title, why) {
    return { title, why };
  }
}