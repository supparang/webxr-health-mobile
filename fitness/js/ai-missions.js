// === /fitness/js/ai-missions.js ===
// AI Missions (mini-quests) — fun + motivation
// ✅ deterministic if rng provided
'use strict';

export class AIMissions {
  constructor(rng, opts = {}) {
    this.rng = rng || null;
    this.cfg = Object.assign({
      maxActive: 2,
      rotateEveryMs: 14000,
      rewardScore: 220,
    }, opts);

    this.active = [];
    this.completed = 0;
    this.lastRotateAt = 0;
  }

  _now(){ return performance.now(); }
  _r(){ return this.rng ? this.rng.next() : Math.random(); }
  _pick(arr){
    if (!arr.length) return null;
    const i = Math.floor(this._r() * arr.length);
    return arr[Math.max(0, Math.min(arr.length-1, i))];
  }

  reset(){
    this.active = [];
    this.completed = 0;
    this.lastRotateAt = this._now();
  }

  // called periodically
  tick(ctx){
    const now = this._now();
    if (!this.lastRotateAt) this.lastRotateAt = now;

    // expire old missions
    for (const m of this.active) {
      if (m.until && now >= m.until && !m.done) m.expired = true;
    }
    this.active = this.active.filter(m => !m.expired);

    if (now - this.lastRotateAt >= this.cfg.rotateEveryMs) {
      this.lastRotateAt = now;
      // rotate: keep 1, add 1
      if (this.active.length > 0) this.active = this.active.slice(0,1);
      this._ensureMissions(ctx);
    } else {
      this._ensureMissions(ctx);
    }
  }

  _ensureMissions(ctx){
    while (this.active.length < this.cfg.maxActive) {
      const m = this._newMission(ctx);
      if (!m) break;
      this.active.push(m);
    }
  }

  _newMission(ctx){
    const phase = ctx?.bossPhase || 1;
    const pool = [];

    pool.push({
      id: 'combo3',
      title: 'คอมโบให้ได้ 3!',
      desc: 'ตี/แตะเป้าต่อเนื่อง 3 ครั้งโดยไม่พลาด',
      ttlMs: 12000,
      test: (ev, s) => (s.combo >= 3),
    });

    pool.push({
      id: 'perfect2',
      title: 'Perfect x2',
      desc: 'ทำ PERFECT 2 ครั้งในเวลาจำกัด',
      ttlMs: 14000,
      init: ()=>({ p:0 }),
      onEvent: (ev, mem)=>{
        if (ev.type==='hit' && ev.grade==='perfect') mem.p++;
      },
      test: (ev, s, mem)=> (mem.p >= 2),
    });

    pool.push({
      id: 'noBomb8s',
      title: 'หลบระเบิด 8 วิ',
      desc: 'ห้ามกด 💣 ภายใน 8 วินาที',
      ttlMs: 8000,
      test: (ev)=> !(ev.type==='hit' && ev.target_type==='bomb'),
      strict: true
    });

    if (phase >= 2) {
      pool.push({
        id: 'shieldGet',
        title: 'หาโล่ให้ได้!',
        desc: 'เก็บ 🛡️ 1 ครั้ง',
        ttlMs: 14000,
        test: (ev)=> (ev.type==='hit' && ev.grade==='shield'),
      });
    }

    if (phase >= 3) {
      pool.push({
        id: 'weakNow',
        title: 'WEAK POINT!',
        desc: 'กดหน้า Boss (bossface) ให้โดน 1 ครั้ง',
        ttlMs: 9000,
        test: (ev)=> (ev.type==='hit' && ev.is_boss_face===true),
      });
    }

    // avoid duplicates
    const used = new Set(this.active.map(m=>m.id));
    const candidates = pool.filter(m=>!used.has(m.id));
    const chosen = this._pick(candidates);
    if (!chosen) return null;

    const now = this._now();
    const mem = chosen.init ? chosen.init() : {};
    return Object.assign({}, chosen, {
      until: now + (chosen.ttlMs || 12000),
      done: false,
      expired: false,
      mem
    });
  }

  // feed events: {type:'hit'|'timeout', grade, target_type, is_boss_face}
  onEvent(ev, state){
    let reward = 0;
    for (const m of this.active) {
      if (m.done || m.expired) continue;

      if (m.onEvent) m.onEvent(ev, m.mem);

      if (m.strict && m.test) {
        // strict mission fails if condition violated
        const ok = m.test(ev, state, m.mem);
        if (!ok) m.expired = true;
        continue;
      }

      if (m.test && m.test(ev, state, m.mem)) {
        m.done = true;
        this.completed++;
        reward += this.cfg.rewardScore;
      }
    }
    // remove done
    this.active = this.active.filter(m=>!m.done && !m.expired);
    return reward;
  }

  uiText(){
    if (!this.active.length) return { title:'MISSION', lines:['กำลังโหลดภารกิจ…'] };
    const lines = this.active.map(m => `• ${m.title} — ${m.desc}`);
    return { title:'MISSIONS', lines };
  }
}