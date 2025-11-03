// === Hero Health Academy — core/mission-system.js (v2.4 single-active mini-quest) ===
export class MissionSystem {
  constructor(){
    // ----- Default pools (จาก v2.3 ของคุณ) -----
    this.pool = {
      goodjunk: [
        { key:'collect_goods',   target:[20,30,40],   icon:'🍎' },
        { key:'count_perfect',   target:[6,10,14],    icon:'🌟' },
        { key:'count_golden',    target:[2,3,4],      icon:'🟡' },
        { key:'reach_combo',     target:[12,18,24],   icon:'🔥' },
        { key:'no_miss',         target:[0],          icon:'❌' },
        { key:'score_reach',     target:[150,220,300],icon:'🏁' }
      ],
      groups: [
        { key:'target_hits',     target:[12,18,24],   icon:'🎯' },
        { key:'count_perfect',   target:[6,9,12],     icon:'🌟' },
        { key:'reach_combo',     target:[14,18,22],   icon:'🔥' },
        { key:'no_wrong_group',  target:[0],          icon:'🚫' },
        { key:'score_reach',     target:[160,240,320],icon:'🏁' }
      ],
      hydration: [
        { key:'hold_ok_sec',     target:[15,20,30],   icon:'💧' },
        { key:'no_overflow',     target:[0],          icon:'🛑' },
        { key:'count_perfect',   target:[4,6,8],      icon:'🌟' },
        { key:'reach_combo',     target:[12,16,20],   icon:'🔥' },
        { key:'score_reach',     target:[150,220,300],icon:'🏁' }
      ],
      plate: [
        { key:'perfect_plates',  target:[1,2,3],      icon:'🍽️' },
        { key:'no_over_quota',   target:[0],          icon:'🚫' },
        { key:'count_perfect',   target:[4,6,8],      icon:'🌟' },
        { key:'reach_combo',     target:[10,14,18],   icon:'🔥' },
        { key:'score_reach',     target:[180,260,340],icon:'🏁' }
      ]
    };
    this._icons = {
      collect_goods:'🍎', no_miss:'❌', score_reach:'🏁',
      target_hits:'🎯',   no_wrong_group:'🚫',
      hold_ok_sec:'💧',   no_overflow:'🛑',
      perfect_plates:'🍽️', no_over_quota:'🚫',
      // new
      count_perfect:'🌟', count_golden:'🟡', reach_combo:'🔥'
    };
    this._lastCoachAt = 0;
    this._coachGapMs  = 650;
  }

  /* ============ Utils ============ */
  _rand(arr){ return arr[(Math.random()*arr.length)|0]; }
  _clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
  _num(n, d=0){ const v = Number(n); return Number.isFinite(v) ? v : d; }

  _ensureCtx(state){
    state.ctx = state.ctx || {};
    // legacy counters
    state.ctx.goodHits        = this._num(state.ctx.goodHits, 0);
    state.ctx.miss            = this._num(state.ctx.miss, 0);
    state.ctx.targetHitsTotal = this._num(state.ctx.targetHitsTotal, 0);
    state.ctx.wrongGroup      = this._num(state.ctx.wrongGroup, 0);
    state.ctx.hydOkSec        = this._num(state.ctx.hydOkSec, 0);
    state.ctx.overflow        = this._num(state.ctx.overflow, 0);
    state.ctx.perfectPlates   = this._num(state.ctx.perfectPlates, 0);
    state.ctx.overfillCount   = this._num(state.ctx.overfillCount, 0);
    // new counters
    state.ctx.perfectCount    = this._num(state.ctx.perfectCount, 0);
    state.ctx.goldenCount     = this._num(state.ctx.goldenCount, 0);
    state.ctx.maxCombo        = this._num(state.ctx.maxCombo, 0);
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

  /* ============ Public API ============ */

  setPool(mode, list){
    if (!mode || !Array.isArray(list)) return;
    this.pool[mode] = list.slice();
  }

  /**
   * start(mode, opts?)
   * opts: { difficulty?, lang?, seconds?:number, count?:1|2|3, singleActive?:boolean }
   * - ถ้าไม่ส่ง opts ⇒ legacy mode (ภารกิจเดียว)
   */
  start(mode, opts = undefined){
    const legacy = (opts === undefined);
    const o = opts || {};
    const seconds = Math.max(10, (o.seconds|0) || 45);
    const count   = this._clamp((o.count|0) || (legacy?1:3), 1, 3);
    const lang    = String(o.lang || 'TH').toUpperCase();
    const single  = (o.singleActive !== false); // เริ่มต้น: เปิด single-active

    const missions = this._pickSet(mode, count).map(m => ({ ...m, remainSec: seconds }));
    return legacy
      ? { ...missions[0] }
      : { list: missions, seconds, lang, singleActive: !!single, activeIndex: 0 };
  }

  /** roll ชุดใหม่ (ไม่รีเซ็ต ctx) */
  roll(mode, opts = {}) {
    const secs = Math.max(10, (opts.seconds|0) || 45);
    const cnt  = this._clamp((opts.count|0)||3, 1, 3);
    const single  = (opts.singleActive !== false);
    const list = this._pickSet(mode, cnt).map(m=>({ ...m, remainSec: secs }));
    return { list, seconds: secs, lang: String(opts.lang||'TH').toUpperCase(), singleActive: !!single, activeIndex: 0 };
  }

  /** แนบโครงสร้างภารกิจเข้ากับ state */
  attachToState(run, state){
    state.missions = (run?.list || []).map(m=>({ ...m, remainSec: Math.max(0, m.remainSec|0) }));
    state.lang = run?.lang || state.lang || 'TH';
    state.singleActive = (run?.singleActive !== false);
    state.activeIndex = this._num(run?.activeIndex, 0);
    this._ensureCtx(state);
    return state;
  }

  /** รีเซ็ตเฉพาะค่าความคืบหน้า */
  reset(state){
    if (!state) return;
    state.ctx = {};
    this._ensureCtx(state);
    if (Array.isArray(state.missions)){
      state.missions.forEach(m=>{ m.progress = 0; m.done = false; m.success = false; });
    }
    if (state.mission){ // legacy
      state.mission.progress = 0; state.mission.done=false; state.mission.success=false;
    }
    state.activeIndex = 0;
  }

  /** stop: ปิดภารกิจทั้งหมด */
  stop(state){
    if (!state) return;
    if (Array.isArray(state.missions)){
      state.missions.forEach(m=>{ m.remainSec = 0; m.done = true; m.success = false; });
    }
    if (state.mission){ state.mission.remainSec = 0; state.mission.done = true; state.mission.success=false; }
  }

  /** อธิบายภารกิจ (TH/EN) */
  describe(m, lang='TH'){
    const TH = {
      collect_goods:t=>`เก็บของดีให้ครบ ${t} ชิ้น`,
      count_perfect:t=>`Perfect ให้ครบ ${t}`,
      count_golden: t=>`Golden ให้ครบ ${t}`,
      reach_combo:  t=>`ทำคอมโบให้ถึง x${t}`,
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
      count_perfect:t=>`Get ${t} Perfects`,
      count_golden: t=>`Hit ${t} Golden`,
      reach_combo:  t=>`Reach combo x${t}`,
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

  /**
   * onEvent(ev, meta, state)
   * รองรับ: good/miss/perfect/golden/combo/target_hit/wrong_group/plate_perfect/over_quota/overflow/hydration_zone
   */
  onEvent(ev, meta={}, state){
    this._ensureCtx(state);
    const c = (n)=> (Number.isFinite(n)? n|0 : 1);

    switch(ev){
      case 'good':           state.ctx.goodHits        += c(meta.count); break;
      case 'miss':           state.ctx.miss            += c(meta.count); break;
      case 'perfect':        state.ctx.perfectCount    += c(meta.count); break;
      case 'golden':         state.ctx.goldenCount     += c(meta.count); break;
      case 'combo':          state.ctx.maxCombo        = Math.max(state.ctx.maxCombo|0, this._num(meta.value,0)); break;
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
   * - เรียกทุก ~1s จาก main
   * - cb({success,key,index}) เมื่อภารกิจจบ/ล้มเหลว
   * - hooks: { hud?, coach?, lang? }
   * - **single-active**: จะแสดงเฉพาะภารกิจที่ยังไม่เสร็จตัวแรกเท่านั้น
   * - คืน array chips (ยาว 0 หรือ 1)
   */
  tick(state, score, cb, hooks = {}){
    const hud   = hooks.hud;
    const coach = hooks.coach;
    const lang  = (hooks.lang || state?.lang || 'TH').toUpperCase();
    const nowMs = performance?.now?.() || Date.now();

    // Legacy single
    if (state?.mission && !state.missions) {
      if (state.mission.done) {
        const chip = this._chipOf(state.mission, lang);
        hud?.setQuestChips?.([chip]);
        return [chip];
      }
      state.mission.remainSec = Math.max(0, (state.mission.remainSec|0) - 1);
      const { ok, fail, progress } = this._evaluateOne(state, score, state.mission);
      if (Number.isFinite(progress)) state.mission.progress = progress;

      if (ok || fail){
        state.mission.done = true; state.mission.success = !!ok;
        cb?.({ success: !!ok, key: state.mission.key, index: 0 });
        coach && (ok ? coach.onQuestDone?.() : coach.onQuestFail?.());
        hud?.showMiniQuestComplete?.(this.describe(state.mission, lang));
        setTimeout(()=> hud?.showMiniQuest?.(''), 600);
      } else {
        const chip = this._chipOf(state.mission, lang);
        hud?.setQuestChips?.([chip]);
        hud?.showMiniQuest?.(chip.label);
      }
      return [ this._chipOf(state.mission, lang) ];
    }

    if (!Array.isArray(state?.missions) || !state.missions.length) return [];

    // หา active ตัวแรกที่ยังไม่ done
    if (!Number.isFinite(state.activeIndex)) state.activeIndex = 0;
    let idx = state.activeIndex;
    for (; idx < state.missions.length && state.missions[idx].done; idx++);
    if (idx >= state.missions.length){
      // ทุกภารกิจจบแล้ว
      hud?.setQuestChips?.([]);
      hud?.showMiniQuest?.('');
      return [];
    }
    state.activeIndex = idx;
    const m = state.missions[idx];

    // นับเวลาของภารกิจเดียว (ลดความซ้ำซ้อน)
    m.remainSec = Math.max(0, (m.remainSec|0) - 1);
    const before = m.progress|0;
    const { ok, fail, progress } = this._evaluateOne(state, score, m);
    if (Number.isFinite(progress)) m.progress = progress;

    if (ok || fail){
      m.done = true; m.success = !!ok;
      cb?.({ success: !!ok, key: m.key, index: idx });
      coach && (ok ? coach.onQuestDone?.() : coach.onQuestFail?.());
      hud?.showMiniQuestComplete?.(this.describe(m, lang));

      // ไปตัวถัดไป (ถ้ามี) และประกาศ
      let next = idx+1;
      for (; next < state.missions.length && state.missions[next].done; next++);
      if (next < state.missions.length){
        state.activeIndex = next;
        const nm = state.missions[next];
        const chipN = this._chipOf(nm, lang);
        hud?.setQuestChips?.([chipN]);
        setTimeout(()=> hud?.showMiniQuest?.(chipN.label), 650);
        return [chipN];
      } else {
        // ไม่มีภารกิจเหลือ
        hud?.setQuestChips?.([]);
        setTimeout(()=> hud?.showMiniQuest?.(''), 650);
        return [];
      }
    } else {
      // ระหว่างทำ — อัปเดตเฉพาะ active
      if ((m.progress|0)!==before){
        if (!coach || (nowMs - this._lastCoachAt) >= this._coachGapMs){
          coach?.onQuestProgress?.(this.describe(m, lang), m.progress|0, m.target|0);
          this._lastCoachAt = nowMs;
        }
      }
      const chip = this._chipOf(m, lang);
      hud?.setQuestChips?.([chip]);       // << แสดงทีละอัน
      hud?.showMiniQuest?.(chip.label);   // << แถบ mini quest ด้านบน
      return [chip];
    }
  }

  toLegacy(state){
    if (state?.mission) return state.mission;
    if (!Array.isArray(state?.missions) || !state.missions.length) return null;
    return { ...state.missions[0] };
  }

  /* ============ Internals ============ */
  _evaluateOne(state, score, m){
    let ok=false, fail=false, progress = this._num(m.progress, 0);
    const sc = this._num(score?.score, 0);

    switch(m.key){
      case 'collect_goods':
        progress = this._num(state.ctx.goodHits, 0);
        ok = progress >= (m.target|0);
        break;
      case 'count_perfect':
        progress = this._num(state.ctx.perfectCount, 0);
        ok = progress >= (m.target|0);
        break;
      case 'count_golden':
        progress = this._num(state.ctx.goldenCount, 0);
        ok = progress >= (m.target|0);
        break;
      case 'reach_combo':
        progress = this._num(state.ctx.maxCombo, 0);
        ok = progress >= (m.target|0);
        break;
      case 'no_miss': {
        const missed = this._num(state.ctx.miss, 0) > 0;
        if (m.remainSec <= 0) { ok = !missed; fail = missed; }
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
        if (m.remainSec <= 0) { ok = !wrong; fail = wrong; }
        break;
      }
      case 'hold_ok_sec':
        progress = this._num(state.ctx.hydOkSec, 0);
        ok = progress >= (m.target|0);
        break;
      case 'no_overflow': {
        const of = this._num(state.ctx.overflow, 0) > 0;
        if (m.remainSec <= 0) { ok = !of; fail = of; }
        break;
      }
      case 'perfect_plates':
        progress = this._num(state.ctx.perfectPlates, 0);
        ok = progress >= (m.target|0);
        break;
      case 'no_over_quota': {
        const over = this._num(state.ctx.overfillCount, 0) > 0;
        if (m.remainSec <= 0) { ok = !over; fail = over; }
        break;
      }
      default: {
        // mission ไม่รู้จัก: หมดเวลา => fail
        progress = this._num(progress,0);
        if (m.remainSec <= 0) { ok = false; fail = true; }
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

try { window.__HHA_MISSION_VER__ = 'v2.4-single-active'; } catch {}
