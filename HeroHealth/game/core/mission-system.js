// === Hero Health Academy — core/mission-system.js (v2.5: difficulty-aware targets + iconSize) ===
export class MissionSystem {
  constructor(){
    this.pool = {
      goodjunk: [
        { key:'collect_goods',   target:[20,30,40],   icon:'🍎' },
        { key:'count_perfect',   target:[6,10,14],    icon:'🌟' },
        { key:'count_golden',    target:[2,3,4],      icon:'🟡' },
        { key:'reach_combo',     target:[8,14,20],    icon:'🔥' },   // ปรับไล่ตามยาก
        { key:'no_miss',         target:[0],          icon:'❌' },
        { key:'score_reach',     target:[120,200,280],icon:'🏁' }
      ],
      groups: [
        { key:'target_hits',     target:[10,16,22],   icon:'🎯' },
        { key:'count_perfect',   target:[5,8,12],     icon:'🌟' },
        { key:'reach_combo',     target:[10,16,22],   icon:'🔥' },
        { key:'no_wrong_group',  target:[0],          icon:'🚫' },
        { key:'score_reach',     target:[140,220,300],icon:'🏁' }
      ],
      hydration: [
        { key:'hold_ok_sec',     target:[12,18,26],   icon:'💧' },
        { key:'no_overflow',     target:[0],          icon:'🛑' },
        { key:'count_perfect',   target:[3,5,7],      icon:'🌟' },
        { key:'reach_combo',     target:[8,12,16],    icon:'🔥' },
        { key:'score_reach',     target:[120,200,280],icon:'🏁' }
      ],
      plate: [
        { key:'perfect_plates',  target:[1,2,3],      icon:'🍽️' },
        { key:'no_over_quota',   target:[0],          icon:'🚫' },
        { key:'count_perfect',   target:[3,5,7],      icon:'🌟' },
        { key:'reach_combo',     target:[8,12,16],    icon:'🔥' },
        { key:'score_reach',     target:[160,240,320],icon:'🏁' }
      ]
    };
    this._icons = {
      collect_goods:'🍎', no_miss:'❌', score_reach:'🏁',
      target_hits:'🎯',   no_wrong_group:'🚫',
      hold_ok_sec:'💧',   no_overflow:'🛑',
      perfect_plates:'🍽️', no_over_quota:'🚫',
      count_perfect:'🌟', count_golden:'🟡', reach_combo:'🔥'
    };
    this._lastCoachAt = 0;
    this._coachGapMs  = 650;
  }

  /* ---------- utils ---------- */
  _rand(arr){ return arr[(Math.random()*arr.length)|0]; }
  _clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
  _num(n,d=0){ const v=Number(n); return Number.isFinite(v)?v:d; }
  _diffIndex(d){ const s=String(d||'Normal').toLowerCase(); return (s==='easy')?0:(s==='hard')?2:1; }
  _iconSizeByDiff(d){ const i=this._diffIndex(d); return [18,16,14][i]; } // Easy/Normal/Hard

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
    state.ctx.perfectCount    = this._num(state.ctx.perfectCount, 0);
    state.ctx.goldenCount     = this._num(state.ctx.goldenCount, 0);
    state.ctx.maxCombo        = this._num(state.ctx.maxCombo, 0);
  }

  _pickSet(mode, count, difficulty){
    const cand = this.pool[mode] || [{key:'score_reach', target:[120,200,280], icon:'🏁'}];
    const idx  = this._diffIndex(difficulty);
    const size = this._iconSizeByDiff(difficulty);

    const shuffled = cand.slice().sort(()=>Math.random()-0.5);
    const out = [];
    for (const m of shuffled){
      if (out.find(x=>x.key===m.key)) continue;
      const tgtArr = Array.isArray(m.target)? m.target : [m.target];
      const tgt = this._clamp(this._num(tgtArr[Math.min(idx, tgtArr.length-1)],0), 0, 99999);
      out.push({
        key:m.key, target:tgt, progress:0, done:false, success:false,
        remainSec:0, icon:(m.icon || this._icons[m.key] || '⭐'),
        iconSize:size, // << ขนาดไอคอนตามความยาก
      });
      if (out.length >= count) break;
    }
    return out;
  }

  /* ---------- public API ---------- */
  setPool(mode,list){ if(mode && Array.isArray(list)) this.pool[mode]=list.slice(); }

  /**
   * start(mode, opts?)
   * opts: { difficulty?: 'Easy'|'Normal'|'Hard', lang?, seconds?: number, count?: 1|2|3, singleActive?: boolean }
   */
  start(mode, opts=undefined){
    const legacy = (opts===undefined);
    const o = opts || {};
    const seconds = Math.max(10, (o.seconds|0)||45);
    const count   = this._clamp((o.count|0)||(legacy?1:3), 1, 3);
    const lang    = String(o.lang||'TH').toUpperCase();
    const single  = (o.singleActive !== false);
    const diff    = o.difficulty || 'Normal';

    const missions = this._pickSet(mode, count, diff).map(m=>({ ...m, remainSec: seconds }));
    return legacy
      ? { ...missions[0] }
      : { list: missions, seconds, lang, singleActive: !!single, activeIndex: 0, difficulty: diff };
  }

  roll(mode, opts={}){
    const secs = Math.max(10, (opts.seconds|0)||45);
    const cnt  = this._clamp((opts.count|0)||3, 1, 3);
    const single = (opts.singleActive !== false);
    const diff = opts.difficulty || 'Normal';
    const list = this._pickSet(mode, cnt, diff).map(m=>({ ...m, remainSec: secs }));
    return { list, seconds: secs, lang: String(opts.lang||'TH').toUpperCase(), singleActive: !!single, activeIndex: 0, difficulty: diff };
  }

  attachToState(run, state){
    state.missions = (run?.list||[]).map(m=>({ ...m, remainSec: Math.max(0,m.remainSec|0) }));
    state.lang = run?.lang || state.lang || 'TH';
    state.singleActive = (run?.singleActive !== false);
    state.activeIndex = this._num(run?.activeIndex, 0);
    state.difficulty = run?.difficulty || state.difficulty || 'Normal';
    this._ensureCtx(state);
    return state;
  }

  reset(state){
    if(!state) return;
    state.ctx = {}; this._ensureCtx(state);
    if(Array.isArray(state.missions)){
      state.missions.forEach(m=>{ m.progress=0; m.done=false; m.success=false; });
    }
    if(state.mission){ state.mission.progress=0; state.mission.done=false; state.mission.success=false; }
    state.activeIndex = 0;
  }

  stop(state){
    if(!state) return;
    if(Array.isArray(state.missions)){ state.missions.forEach(m=>{ m.remainSec=0; m.done=true; m.success=false; }); }
    if(state.mission){ state.mission.remainSec=0; state.mission.done=true; state.mission.success=false; }
  }

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
    const fn = L[m?.key] || (x=>`${m?.key||'mission'} ${x}`);
    return fn(this._num(m?.target,0));
  }

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
      case 'hydration_zone': if(meta.z==='ok') state.ctx.hydOkSec += 1; break;
    }
  }

  tick(state, score, cb, hooks={}){
    const hud=hooks.hud, coach=hooks.coach;
    const lang=(hooks.lang||state?.lang||'TH').toUpperCase();
    const nowMs = performance?.now?.() || Date.now();

    // single-active (แสดงภารกิจแรกที่ยังไม่เสร็จ)
    if(!Array.isArray(state?.missions)||!state.missions.length){ hud?.setQuestChips?.([]); return []; }
    if(!Number.isFinite(state.activeIndex)) state.activeIndex = 0;

    // หา active
    let idx = state.activeIndex;
    for(; idx<state.missions.length && state.missions[idx].done; idx++);
    if(idx>=state.missions.length){ hud?.setQuestChips?.([]); hud?.showMiniQuest?.(''); return []; }
    state.activeIndex = idx;
    const m = state.missions[idx];

    // เดินเวลา + วัดผล
    m.remainSec = Math.max(0, (m.remainSec|0) - 1);
    const before = m.progress|0;
    const { ok, fail, progress } = this._evaluateOne(state, score, m);
    if(Number.isFinite(progress)) m.progress = progress;

    if(ok || fail){
      m.done=true; m.success=!!ok;
      cb?.({ success: !!ok, key:m.key, index: idx });
      coach && (ok ? coach.onQuestDone?.() : coach.onQuestFail?.());
      hud?.showMiniQuestComplete?.(this.describe(m, lang));

      // next
      let next=idx+1; for(; next<state.missions.length && state.missions[next].done; next++);
      if(next<state.missions.length){
        state.activeIndex=next;
        const chipN=this._chipOf(state.missions[next], lang, true);
        hud?.setQuestChips?.([chipN]);
        setTimeout(()=> hud?.showMiniQuest?.(chipN.label), 600);
        return [chipN];
      }
      hud?.setQuestChips?.([]); setTimeout(()=>hud?.showMiniQuest?.(''),600);
      return [];
    }

    // progress ระหว่างทำ
    if((m.progress|0)!==before){
      if(!coach || (nowMs - this._lastCoachAt) >= this._coachGapMs){
        coach?.onQuestProgress?.(this.describe(m, lang), m.progress|0, m.target|0);
        this._lastCoachAt = nowMs;
      }
    }
    const chip=this._chipOf(m, lang, true);
    hud?.setQuestChips?.([chip]);
    hud?.showMiniQuest?.(chip.label);
    return [chip];
  }

  _evaluateOne(state, score, m){
    let ok=false, fail=false, progress=this._num(m.progress,0);
    const sc=this._num(score?.score,0);
    switch(m.key){
      case 'collect_goods': progress=this._num(state.ctx.goodHits,0); ok=progress>=(m.target|0); break;
      case 'count_perfect': progress=this._num(state.ctx.perfectCount,0); ok=progress>=(m.target|0); break;
      case 'count_golden':  progress=this._num(state.ctx.goldenCount,0);  ok=progress>=(m.target|0); break;
      case 'reach_combo':   progress=this._num(state.ctx.maxCombo,0);     ok=progress>=(m.target|0); break;
      case 'no_miss': { const missed=this._num(state.ctx.miss,0)>0; if(m.remainSec<=0){ ok=!missed; fail=missed; } break; }
      case 'score_reach':   progress=this._clamp(sc,0,m.target|0); ok=sc>=(m.target|0); break;
      case 'target_hits':   progress=this._num(state.ctx.targetHitsTotal,0); ok=progress>=(m.target|0); break;
      case 'no_wrong_group':{ const wrong=this._num(state.ctx.wrongGroup,0)>0; if(m.remainSec<=0){ ok=!wrong; fail=wrong; } break; }
      case 'hold_ok_sec':   progress=this._num(state.ctx.hydOkSec,0); ok=progress>=(m.target|0); break;
      case 'no_overflow':   { const of=this._num(state.ctx.overflow,0)>0; if(m.remainSec<=0){ ok=!of; fail=of; } break; }
      case 'perfect_plates':progress=this._num(state.ctx.perfectPlates,0); ok=progress>=(m.target|0); break;
      case 'no_over_quota': { const over=this._num(state.ctx.overfillCount,0)>0; if(m.remainSec<=0){ ok=!over; fail=over; } break; }
      default: if(m.remainSec<=0){ ok=false; fail=true; }
    }
    if(!ok && !fail && (m.remainSec|0)<=0) fail=true;
    progress = this._clamp(progress|0, 0, this._num(m.target,0));
    return { ok, fail, progress };
  }

  _chipOf(m, lang='TH', active=false){
    const label = this.describe(m, lang);
    return {
      key:m.key,
      icon:m.icon || this._icons[m.key] || '⭐',
      need:this._num(m.target,0),
      progress:this._clamp(this._num(m.progress,0), 0, this._num(m.target,0)),
      remain:this._clamp(this._num(m.remainSec,0), 0, 9999),
      done:!!m.done,
      fail:!!m.done && !m.success,
      label,
      active: !!active,
      iconSize: this._num(m.iconSize, 16),
    };
  }
}

try{ window.__HHA_MISSION_VER__='v2.5-difficulty-iconsize'; }catch{}
