// === Hero Health Academy — core/mission-system.js (3 quests + HUD/Coach + legacy-safe) ===
export class MissionSystem {
  constructor(){
    // ----- Mission Pools -----
    this.pool = {
      goodjunk: [
        { key:'collect_goods',   target:[20,30,40], icon:'🍎' },
        { key:'no_miss',         target:[0],        icon:'❌' },
        { key:'score_reach',     target:[150,220,300], icon:'🏁' }
      ],
      groups: [
        { key:'target_hits',     target:[12,18,24], icon:'🎯' },
        { key:'no_wrong_group',  target:[0],        icon:'🚫' },
        { key:'score_reach',     target:[160,240,320], icon:'🏁' }
      ],
      hydration: [
        { key:'hold_ok_sec',     target:[15,20,30], icon:'💧' },
        { key:'no_overflow',     target:[0],        icon:'🛑' },
        { key:'score_reach',     target:[150,220,300], icon:'🏁' }
      ],
      plate: [
        { key:'perfect_plates',  target:[1,2,3],    icon:'🍽️' },
        { key:'no_over_quota',   target:[0],        icon:'🚫' },
        { key:'score_reach',     target:[180,260,340], icon:'🏁' }
      ]
    };
    // ไอคอน fallback
    this._icons = {
      collect_goods:'🍎', no_miss:'❌', score_reach:'🏁',
      target_hits:'🎯', no_wrong_group:'🚫',
      hold_ok_sec:'💧', no_overflow:'🛑',
      perfect_plates:'🍽️', no_over_quota:'🚫'
    };
  }

  /* ================= Utilities ================= */
  _rand(arr){ return arr[(Math.random()*arr.length)|0]; }
  _clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
  _sec(){ return Math.floor(Date.now()/1000); }

  _ensureCtx(state){
    state.ctx = state.ctx || {};
    // ตัวนับรวมที่ทุกโหมดใช้
    state.ctx.goodHits       = state.ctx.goodHits       || 0;
    state.ctx.miss           = state.ctx.miss           || 0;
    state.ctx.targetHitsTotal= state.ctx.targetHitsTotal|| 0;
    state.ctx.wrongGroup     = state.ctx.wrongGroup     || 0;
    state.ctx.hydOkSec       = state.ctx.hydOkSec       || 0;
    state.ctx.overflow       = state.ctx.overflow       || 0;
    state.ctx.perfectPlates  = state.ctx.perfectPlates  || 0;
    state.ctx.overfillCount  = state.ctx.overfillCount  || 0;
  }

  _pickSet(mode, count){
    const cand = this.pool[mode] || [{key:'score_reach', target:[200,260,320], icon:'🏁'}];
    // เลือกไม่ซ้ำ key
    const shuffled = cand.slice().sort(()=>Math.random()-0.5);
    const out = [];
    for (const m of shuffled){
      if (out.find(x=>x.key===m.key)) continue;
      const tgt = this._rand(m.target);
      out.push({ key:m.key, target:tgt, progress:0, done:false, success:false, remainSec:0, icon:(m.icon || this._icons[m.key] || '⭐') });
      if (out.length >= count) break;
    }
    return out;
  }

  /* ================= Public API ================= */

  /**
   * start(mode, opts?)
   * opts: { difficulty?:'Easy'|'Normal'|'Hard', lang?:'TH'|'EN', seconds?:number, count?:1|2|3 }
   * - ถ้าไม่ส่ง opts: ย้อนหลัง → คืนภารกิจเดียว (เหมือนเวอร์ชันเดิม)
   */
  start(mode, opts = undefined){
    const legacy = (opts === undefined);
    const o = opts || {};
    const seconds = Number.isFinite(o.seconds) ? Math.max(10, o.seconds|0) : 45;
    const count = this._clamp((o.count|0)|| (legacy?1:3), 1, 3);
    const lang = (o.lang || 'TH').toUpperCase();

    const missions = this._pickSet(mode, count).map(m => ({ ...m, remainSec: seconds }));
    return legacy
      ? { ...missions[0] } // ภารกิจเดียวแบบเก่า
      : { list: missions, seconds, lang }; // ชุดภารกิจ
  }

  /** อธิบายภารกิจ (รองรับ TH/EN) */
  describe(m, lang='TH'){
    const TH = {
      collect_goods:t=>`เก็บของดีให้ครบ ${t} ชิ้น`,
      no_miss:     _=>`ห้ามพลาดสักครั้ง`,
      score_reach: t=>`ทำคะแนนให้ถึง ${t}`,
      target_hits: t=>`เก็บให้ตรงหมวด ${t} ครั้ง`,
      no_wrong_group:_=>`ห้ามเก็บผิดหมวด`,
      hold_ok_sec: t=>`อยู่โซนสมดุลน้ำ ${t}s`,
      no_overflow: _=>`ห้ามน้ำเกินโซน`,
      perfect_plates:t=>`ทำจานสมบูรณ์ ${t} จาน`,
      no_over_quota:_=>`ห้ามเกินโควตา`,
    };
    const EN = {
      collect_goods:t=>`Collect ${t} healthy items`,
      no_miss:     _=>`No misses allowed`,
      score_reach: t=>`Reach score ${t}`,
      target_hits: t=>`Hit target group ${t} times`,
      no_wrong_group:_=>`No wrong groups`,
      hold_ok_sec: t=>`Stay in OK zone for ${t}s`,
      no_overflow: _=>`No overflow`,
      perfect_plates:t=>`Complete ${t} full plates`,
      no_over_quota:_=>`No over-quota`,
    };
    const L = (String(lang).toUpperCase()==='EN') ? EN : TH;
    const fn = L[m.key] || ((x)=>`${m.key} ${x}`);
    return fn(m.target);
  }

  /**
   * onEvent(ev, meta, state)
   * เรียกจาก main/modes เมื่อเกิดเหตุการณ์ เช่น:
   *  - ev='good'|'perfect'|'bad'|'miss'
   *  - ev='target_hit' (ถูกหมวด/เป้าหมาย)  meta:{count?:1}
   *  - ev='wrong_group'                       meta:{count?:1}
   *  - ev='golden'                            meta:{count?:1}
   *  - ev='plate_perfect'                     meta:{count?:1}
   *  - ev='over_quota'                        meta:{count?:1}
   *  - ev='hydration_zone' meta:{z:'ok'|'low'|'high'}  (เรียกต่อเนื่องต่อวินาที/ทิก)
   *  - ev='overflow'                          meta:{count?:1}
   */
  onEvent(ev, meta={}, state){
    this._ensureCtx(state);
    const c = (n)=> (Number.isFinite(n)? n|0 : 1);

    switch(ev){
      case 'good':        state.ctx.goodHits += c(meta.count); break;
      case 'miss':        state.ctx.miss += c(meta.count); break;
      case 'target_hit':  state.ctx.targetHitsTotal += c(meta.count); break;
      case 'wrong_group': state.ctx.wrongGroup += c(meta.count); break;
      case 'plate_perfect': state.ctx.perfectPlates += c(meta.count); break;
      case 'over_quota':  state.ctx.overfillCount += c(meta.count); break;
      case 'overflow':    state.ctx.overflow += c(meta.count); break;
      case 'hydration_zone':
        // นับเฉพาะตอนอยู่โซน ok (ผู้เรียกควรเรียกทุกวินาทีอยู่แล้ว)
        if (meta.z === 'ok') state.ctx.hydOkSec += 1;
        break;
    }
  }

  /**
   * tick(state, score, cb, hooks?)
   * - เรียกทุก ~1s จาก main
   * - cb({success:true|false, key, index}) จะถูกเรียกเมื่อเควสต์จบ/ล้มเหลว
   * - hooks: { hud?, coach?, lang? }
   */
  tick(state, score, cb, hooks = {}){
    const hud = hooks.hud;
    const coach = hooks.coach;
    const lang = (hooks.lang || state.lang || 'TH').toUpperCase();

    // รองรับทั้งโหมด single mission (legacy) และ multi-missions (ใหม่)
    if (state.mission && !state.missions) {
      // legacy state: { mission: {...}, ctx:{...}, ... }
      if (state.mission.done) return;
      state.mission.remainSec = Math.max(0, (state.mission.remainSec|0) - 1);
      const { ok, fail } = this._evaluateOne(state, score, state.mission);
      if (ok || fail){
        state.mission.done = true; state.mission.success = !!ok;
        cb?.({ success: !!ok, key: state.mission.key, index: 0 });
        if (coach) (ok ? coach.onQuestDone() : coach.onQuestFail());
      } else if (hud){
        hud.setQuestChips([ this._chipOf(state.mission, lang) ]);
      }
      return;
    }

    // new style: state.missions = [ ... ]
    if (!Array.isArray(state.missions) || !state.missions.length) return;

    for (let i=0;i<state.missions.length;i++){
      const m = state.missions[i];
      if (m.done) continue;
      m.remainSec = Math.max(0, (m.remainSec|0) - 1);

      const before = m.progress|0;
      const { ok, fail, progress } = this._evaluateOne(state, score, m);
      if (Number.isFinite(progress)) m.progress = progress;

      if (ok || fail){
        m.done = true; m.success = !!ok;
        cb?.({ success: !!ok, key: m.key, index: i });
        if (coach) (ok ? coach.onQuestDone() : coach.onQuestFail());
      } else {
        // แจ้งโค้ชเป็นระยะเมื่อมีความคืบหน้า
        if (coach && (m.progress|0)!==before && m.progress%1===0){
          coach.onQuestProgress?.(this.describe(m, lang), m.progress|0, m.target|0);
        }
      }
    }

    // อัปเดต HUD chips
    if (hud){
      const chips = state.missions.map(m=> this._chipOf(m, lang));
      hud.setQuestChips(chips);
    }
  }

  /** สร้างโครง state แบบใหม่จากผลลัพธ์ start() */
  attachToState(run, state){
    // run: { list, seconds, lang }
    state.missions = (run?.list || []).map(m=>({ ...m }));
    state.lang = run?.lang || state.lang || 'TH';
    this._ensureCtx(state);
    return state;
  }

  /** แปลงกลับให้ระบบเก่าใช้ (เอาเฉพาะภารกิจแรก) */
  toLegacy(state){
    if (state?.mission) return state.mission;
    if (!Array.isArray(state?.missions) || !state.missions.length) return null;
    return { ...state.missions[0] };
  }

  /* ================= Internals ================= */

  _evaluateOne(state, score, m){
    // คืน { ok, fail, progress? }
    let ok=false, fail=false, progress = m.progress|0;

    switch(m.key){
      case 'collect_goods':
        progress = state.ctx.goodHits|0;
        ok = progress >= (m.target|0);
        break;
      case 'no_miss':
        fail = (state.ctx.miss|0) > 0 || (m.remainSec|0) <= 0; // หมดเวลาโดยไม่ fail = ผ่าน (ตั้ง ok ด้านล่าง)
        ok = !fail && (m.remainSec|0) > 0 ? false : ((state.ctx.miss|0)===0); // หมดเวลาและไม่พลาดเลย = ผ่าน
        break;
      case 'score_reach':
        progress = this._clamp(score?.score|0, 0, m.target|0);
        ok = (score?.score|0) >= (m.target|0);
        break;
      case 'target_hits':
        progress = state.ctx.targetHitsTotal|0;
        ok = progress >= (m.target|0);
        break;
      case 'no_wrong_group':
        fail = (state.ctx.wrongGroup|0) > 0 || (m.remainSec|0) <= 0;
        ok = !fail && (m.remainSec|0) > 0 ? false : ((state.ctx.wrongGroup|0)===0);
        break;
      case 'hold_ok_sec':
        progress = state.ctx.hydOkSec|0;
        ok = progress >= (m.target|0);
        break;
      case 'no_overflow':
        fail = (state.ctx.overflow|0) > 0 || (m.remainSec|0) <= 0;
        ok = !fail && (m.remainSec|0) > 0 ? false : ((state.ctx.overflow|0)===0);
        break;
      case 'perfect_plates':
        progress = state.ctx.perfectPlates|0;
        ok = progress >= (m.target|0);
        break;
      case 'no_over_quota':
        fail = (state.ctx.overfillCount|0) > 0 || (m.remainSec|0) <= 0;
        ok = !fail && (m.remainSec|0) > 0 ? false : ((state.ctx.overfillCount|0)===0);
        break;
    }
    // ถ้าหมดเวลาและยังไม่ ok/fail — ปิดเควสต์แบบไม่ผ่าน (ยกเว้นชนิด no_* ที่ตีความด้านบนแล้ว)
    if (!ok && !fail && (m.remainSec|0) <= 0){
      fail = true;
    }
    return { ok, fail, progress };
  }

  _chipOf(m, lang='TH'){
    const label = this.describe(m, lang);
    return {
      key: m.key,
      icon: m.icon || this._icons[m.key] || '⭐',
      need: m.target|0,
      progress: this._clamp(m.progress|0, 0, m.target|0),
      remain: m.remainSec|0,
      done: !!m.done,
      fail: !!m.done && !m.success,
      label
    };
  }
}
