// === Hero Health Academy — core/mission-system.js (v2 hardened; dt-aware + helpers) ===
export class MissionSystem {
  constructor(opts = {}) {
    this.pool = {
      goodjunk: [
        { key:'collect_goods',   target:[20,30,40],   icon:'🍎' },
        { key:'no_miss',         target:[0],          icon:'❌' },
        { key:'score_reach',     target:[150,220,300],icon:'🏁' }
      ],
      groups: [
        { key:'target_hits',     target:[12,18,24],   icon:'🎯' },
        { key:'no_wrong_group',  target:[0],          icon:'🚫' },
        { key:'score_reach',     target:[160,240,320],icon:'🏁' }
      ],
      hydration: [
        { key:'hold_ok_sec',     target:[15,20,30],   icon:'💧' },
        { key:'no_overflow',     target:[0],          icon:'🛑' },
        { key:'score_reach',     target:[150,220,300],icon:'🏁' }
      ],
      plate: [
        { key:'perfect_plates',  target:[1,2,3],      icon:'🍽️' },
        { key:'no_over_quota',   target:[0],          icon:'🚫' },
        { key:'score_reach',     target:[180,260,340],icon:'🏁' }
      ]
    };
    this._icons = {
      collect_goods:'🍎', no_miss:'❌', score_reach:'🏁',
      target_hits:'🎯',   no_wrong_group:'🚫',
      hold_ok_sec:'💧',   no_overflow:'🛑',
      perfect_plates:'🍽️', no_over_quota:'🚫'
    };
    this._lastCoachAt = 0;
    this._coachGapMs  = Math.max(300, opts.coachGapMs || 650);
  }

  /* ================= Utilities ================= */
  _rand(arr){ return arr[(Math.random()*arr.length)|0]; }
  _clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
  _num(n, d=0){ const v = Number(n); return Number.isFinite(v) ? v : d; }

  _ensureCtx(state){
    state.ctx = state.ctx || {};
    state.ctx.goodHits        = this._num(state.ctx.goodHits, 0);
    state.ctx.miss            = this._num(state.ctx.miss, 0);
    state.ctx.targetHitsTotal = this._num(state.ctx.targetHitsTotal, 0);
    state.ctx.wrongGroup      = this._num(state.ctx.wrongGroup, 0);
    state.ctx.hydOkSec        = this._num(state.ctx.hydOkSec, 0);
    state.ctx.overflow        = this._num(state.ctx.overflow, 0);
    state.ctx.perfectPlates   = this._num(state.ctx.perfectPlates, 0);
    state.ctx.overfillCount   = this._num(state.ctx.overfillCount, 0);
  }

  _pickSet(mode, count){
    const cand = this.pool[mode] || [{key:'score_reach', target:[200,260,320], icon:'🏁'}];
    const shuffled = cand.slice().sort(()=>Math.random()-0.5);
    const out = [];
    for (const m of shuffled){
      if (out.find(x=>x.key===m.key)) continue;
      const tgt = this._clamp(this._num(this._rand(m.target), 0), 0, 99999);
      out.push({ key:m.key, target:tgt, progress:0, done:false, success:false, remainSec:0, icon:(m.icon || this._icons[m.key] || '⭐') });
      if (out.length >= count) break;
    }
    return out;
  }

  /* ================= Public API ================= */

  /** ปรับช่วงแจ้งเตือน coach เมื่อ progress ขยับ */
  setCoachGap(ms = 650){ this._coachGapMs = Math.max(300, ms|0); }

  /** แพตช์พูลภารกิจบางโหมด (เช่นเพิ่ม mission ใหม่/เปลี่ยนเป้า) */
  setPool(patch = {}){ Object.keys(patch||{}).forEach(k=>{ if (Array.isArray(patch[k])) this.pool[k] = patch[k]; }); }

  /**
   * start(mode, opts?)
   * opts: { difficulty?:'Easy'|'Normal'|'Hard', lang?:'TH'|'EN', seconds?:number, count?:1|2|3 }
   * - ถ้าไม่ส่ง opts: legacy → คืนภารกิจเดียว (แบบเดิม)
   */
  start(mode, opts = undefined){
    const legacy  = (opts === undefined);
    const o       = opts || {};
    const seconds = Math.max(10, (o.seconds|0) || 45);
    const count   = this._clamp((o.count|0) || (legacy?1:3), 1, 3);
    const lang    = String(o.lang || 'TH').toUpperCase();

    const missions = this._pickSet(mode, count).map(m => ({ ...m, remainSec: seconds }));
    return legacy ? { ...missions[0] } : { list: missions, seconds, lang };
  }

  /** randomize a new mission set (ไม่รีเซ็ต ctx) */
  roll(mode, opts = {}) {
    const secs = Math.max(10, (opts.seconds|0) || 45);
    const cnt  = this._clamp((opts.count|0)||3, 1, 3);
    const list = this._pickSet(mode, cnt).map(m=>({ ...m, remainSec: secs }));
    return { list, seconds: secs, lang: String(opts.lang||'TH').toUpperCase() };
  }

  /** แนบโครงชุดเควสต์เข้า state */
  attachToState(run, state){
    state.missions = (run?.list || []).map(m=>({ ...m, remainSec: Math.max(0, m.remainSec|0) }));
    state.lang = run?.lang || state.lang || 'TH';
    // ตัวนับสำหรับ tickDt
    state.__ms_acc = 0;
    this._ensureCtx(state);
    return state;
  }

  /** reset counters/mission status (เก็บโครงสร้างภารกิจไว้) */
  reset(state){
    if (!state) return;
    state.ctx = {};
    this._ensureCtx(state);
    if (Array.isArray(state.missions)){
      state.missions.forEach(m=>{ m.progress = 0; m.done = false; m.success = false; });
    }
    if (state.mission){ state.mission.progress = 0; state.mission.done=false; state.mission.success=false; }
    state.__ms_acc = 0;
  }

  /** stop: ตีสถานะว่า “ยุติ” */
  stop(state){
    if (!state) return;
    if (Array.isArray(state.missions)){
      state.missions.forEach(m=>{ m.remainSec = 0; m.done = true; m.success = false; });
    }
    if (state.mission){ state.mission.remainSec = 0; state.mission.done = true; state.mission.success=false; }
  }

  /** export snapshot ของภารกิจ (ใช้กับ pause/resume) */
  snapshot(state){
    return {
      lang: state?.lang || 'TH',
      missions: (state?.missions||[]).map(m=>({ key:m.key, target:m.target, progress:m.progress, remainSec:m.remainSec, done:m.done, success:m.success, icon:m.icon })),
      ctx: { ...(state?.ctx||{}) }
    };
  }

  /** restore snapshot กลับเข้า state */
  restore(state, snap = {}){
    if (!state || !snap) return state;
    state.lang = snap.lang || state.lang || 'TH';
    if (Array.isArray(snap.missions)){
      state.missions = snap.missions.map(m=>({ ...m }));
    }
    state.ctx = { ...(snap.ctx||{}) };
    this._ensureCtx(state);
    state.__ms_acc = 0;
    return state;
  }

  /** อธิบายภารกิจ (TH/EN) */
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
    const fn = L[m?.key] || ((x)=>`${m?.key||'mission'} ${x}`);
    return fn(this._num(m?.target, 0));
  }

  /** onEvent(ev, meta, state) — เพิ่มตัวนับตามเหตุการณ์ในเกม */
  onEvent(ev, meta={}, state){
    this._ensureCtx(state);
    const c = (n)=> (Number.isFinite(n)? n|0 : 1);
    switch(ev){
      case 'good':           state.ctx.goodHits        += c(meta.count); break;
      case 'miss':           state.ctx.miss            += c(meta.count); break;
      case 'target_hit':     state.ctx.targetHitsTotal += c(meta.count); break;
      case 'wrong_group':    state.ctx.wrongGroup      += c(meta.count); break;
      case 'plate_perfect':  state.ctx.perfectPlates   += c(meta.count); break;
      case 'over_quota':     state.ctx.overfillCount   += c(meta.count); break;
      case 'overflow':       state.ctx.overflow        += c(meta.count); break;
      case 'hydration_zone':
        if (meta.z === 'ok') state.ctx.hydOkSec += 1;
        break;
    }
  }

  /**
   * tick(state, score, cb, hooks?)
   * - เรียกทุก ~1s จาก main (ถ้าอยากใช้ dt ให้เรียก tickDt แทน)
   * - cb({success:true|false, key, index}) เมื่อจบ/ล้มเหลว
   * - hooks: { hud?, coach?, lang? }
   * - คืน snapshot ของ mission chips (array)
   */
  tick(state, score, cb, hooks = {}) {
    // แปลงเป็น dt 1000ms เพื่อใช้ logic เดียวกับ tickDt
    return this.tickDt(state, score, 1000, cb, hooks);
  }

  /**
   * tickDt(state, score, dtMs, cb, hooks?)
   * - รองรับเกมลูปแบบ requestAnimationFrame ที่ส่ง dt เป็นมิลลิวินาที
   */
  tickDt(state, score, dtMs = 16, cb, hooks = {}) {
    const hud   = hooks.hud;
    const coach = hooks.coach;
    const lang  = (hooks.lang || state?.lang || 'TH').toUpperCase();
    const nowMs = performance?.now?.() || Date.now();

    // Legacy single
    if (state?.mission && !state.missions) {
      state.__ms_acc = (state.__ms_acc||0) + dtMs;
      while ((state.__ms_acc|0) >= 1000) {
        state.__ms_acc -= 1000;
        if (!state.mission.done) state.mission.remainSec = Math.max(0, (state.mission.remainSec|0) - 1);
      }
      if (!state.mission.done) {
        const { ok, fail, progress } = this._evaluateOne(state, score, state.mission);
        if (Number.isFinite(progress)) state.mission.progress = progress;
        if (ok || fail){
          state.mission.done = true; state.mission.success = !!ok;
          cb?.({ success: !!ok, key: state.mission.key, index: 0 });
          coach && (ok ? coach.onQuestDone() : coach.onQuestFail());
        }
      }
      const chips = [ this._chipOf(state.mission, lang) ];
      hud?.setQuestChips?.(chips);
      return chips;
    }

    // New multi
    if (!Array.isArray(state?.missions) || !state.missions.length) return [];

    state.__ms_acc = (state.__ms_acc||0) + dtMs;
    let progressed = false;

    // ลดเวลาทีละวินาทีเพื่อความเสถียร
    while ((state.__ms_acc|0) >= 1000) {
      state.__ms_acc -= 1000;
      for (const m of state.missions) if (!m.done) m.remainSec = Math.max(0, (m.remainSec|0) - 1);
    }

    for (let i=0;i<state.missions.length;i++){
      const m = state.missions[i];
      if (m.done) continue;

      const before = m.progress|0;
      const { ok, fail, progress } = this._evaluateOne(state, score, m);
      if (Number.isFinite(progress)) m.progress = progress;

      if (ok || fail){
        m.done = true; m.success = !!ok;
        cb?.({ success: !!ok, key: m.key, index: i });
        coach && (ok ? coach.onQuestDone() : coach.onQuestFail());
      } else if ((m.progress|0)!==before) {
        progressed = true;
        if (!coach || (nowMs - this._lastCoachAt) >= this._coachGapMs){
          coach?.onQuestProgress?.(this.describe(m, lang), m.progress|0, m.target|0);
          this._lastCoachAt = nowMs;
        }
      }
    }

    const chips = state.missions.map(m=> this._chipOf(m, lang));
    hud?.setQuestChips?.(chips);
    return chips;
  }

  /** แปลงกลับ legacy (เอาเฉพาะอันแรก) */
  toLegacy(state){
    if (state?.mission) return state.mission;
    if (!Array.isArray(state?.missions) || !state.missions.length) return null;
    return { ...state.missions[0] };
  }

  /* ================= Internals ================= */

  _evaluateOne(state, score, m){
    // คืน { ok, fail, progress? }
    let ok=false, fail=false, progress = this._num(m.progress, 0);
    const sc = this._num(score?.score, 0);

    switch(m.key){
      case 'collect_goods':
        progress = this._num(state.ctx.goodHits, 0);
        ok = progress >= (m.target|0);
        break;
      case 'no_miss': {
        const missed = this._num(state.ctx.miss, 0) > 0;
        if ((m.remainSec|0) <= 0) { ok = !missed; fail = missed; }
        break;
      }
      case 'score_reach':
        progress = this._clamp(sc, 0, m.target|0);
        ok = sc >= (m.target|0);
        break;
      case 'target_hits':
        progress = this._num(state.ctx.targetHitsTotal, 0);
        ok = progress >= (m.target|0);
        break;
      case 'no_wrong_group': {
        const wrong = this._num(state.ctx.wrongGroup, 0) > 0;
        if ((m.remainSec|0) <= 0) { ok = !wrong; fail = wrong; }
        break;
      }
      case 'hold_ok_sec':
        progress = this._num(state.ctx.hydOkSec, 0);
        ok = progress >= (m.target|0);
        break;
      case 'no_overflow': {
        const of = this._num(state.ctx.overflow, 0) > 0;
        if ((m.remainSec|0) <= 0) { ok = !of; fail = of; }
        break;
      }
      case 'perfect_plates':
        progress = this._num(state.ctx.perfectPlates, 0);
        ok = progress >= (m.target|0);
        break;
      case 'no_over_quota': {
        const over = this._num(state.ctx.overfillCount, 0) > 0;
        if ((m.remainSec|0) <= 0) { ok = !over; fail = over; }
        break;
      }
      default: {
        progress = 0;
        if ((m.remainSec|0) <= 0) { ok = false; fail = true; }
      }
    }

    if (!ok && !fail && (m.remainSec|0) <= 0){
      fail = true;
    }
    progress = this._clamp(progress|0, 0, this._num(m.target, 0));
    return { ok, fail, progress };
  }

  _chipOf(m, lang='TH'){
    const label = this.describe(m, lang);
    return {
      key: m.key,
      icon: m.icon || this._icons[m.key] || '⭐',
      need: this._num(m.target, 0),
      progress: this._clamp(this._num(m.progress,0), 0, this._num(m.target,0)),
      remain: this._clamp(this._num(m.remainSec,0), 0, 9999),
      done: !!m.done,
      fail: !!m.done && !m.success,
      label
    };
  }
}
