// === Hero Health Academy — core/mission-system.js (v2.0 single-active + autoadvance) ===
'use strict';

const QUEST_POOL = [
  // key, label(labelTH), target(by diff tiers), type(optional)
  { key:'collect_goods', icon:'🍎',
    labelTH:'เก็บของดีให้ครบ', tiers:{ Easy:20, Normal:26, Hard:32 } },
  { key:'count_perfect', icon:'🌟',
    labelTH:'Perfect ให้ครบ', tiers:{ Easy:6, Normal:10, Hard:14 } },
  { key:'count_golden', icon:'🟡',
    labelTH:'เก็บไอเท็มทองให้ครบ', tiers:{ Easy:2, Normal:3, Hard:4 } },
  { key:'reach_combo', icon:'🔥',
    labelTH:'ทำคอมโบให้ถึง x', tiers:{ Easy:10, Normal:14, Hard:18 } },
  { key:'no_miss', icon:'❌',
    labelTH:'ห้ามพลาดเกิน 0 ครั้ง', tiers:{ Easy:0, Normal:0, Hard:0 }, type:'limit' },
  { key:'score_reach', icon:'🏁',
    labelTH:'ทำคะแนนให้ถึง', tiers:{ Easy:400, Normal:700, Hard:900 } },
  { key:'target_hits', icon:'🎯',
    labelTH:'ตีเป้าให้ครบ', tiers:{ Easy:18, Normal:24, Hard:30 } },
  { key:'streak_keep', icon:'🧊',
    labelTH:'รักษาคอมโบ ≥8 ต่อเนื่อง (วินาที)', tiers:{ Easy:5, Normal:8, Hard:10 }, type:'duration' },
  { key:'timed_survive', icon:'⏱️',
    labelTH:'อยู่รอด 10 วิ โดยไม่พลาด', tiers:{ Easy:8, Normal:10, Hard:12 }, type:'survive' },
  { key:'quick_start', icon:'⚡',
    labelTH:'เปิดเกม 10 วิแรก ทำคะแนนให้ถึง', tiers:{ Easy:150, Normal:250, Hard:300 } },
];

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

export class MissionSystem {
  constructor(){
    this.state = null;
    this.diff = 'Normal';
  }

  start(modeKey, {seconds=45, count=3, lang='TH', singleActive=true, diff='Normal'}={}){
    // สร้างกองภารกิจ (สุ่มไม่ซ้ำ) ตาม diff
    this.diff = diff || 'Normal';
    const pool = [...QUEST_POOL];
    const chosen = [];
    while (chosen.length < clamp(count,1,3) && pool.length){
      const q = pool.splice((Math.random()*pool.length)|0, 1)[0];
      chosen.push(this._makeQuest(q));
    }
    // ทำให้ active แค่ตัวแรก
    chosen.forEach((q,i)=>{ q.active = (i===0); });
    this.state = { modeKey, seconds, list: chosen, lang, singleActive: !!singleActive, startedAt: performance.now() };
    return this.state;
  }

  attachToState(run, stateRef){
    stateRef.missions = run.list;
    stateRef.ctx = { diff:this.diff, startedAt: run.startedAt };
  }

  reset(stateRef){
    if (!this.state) return;
    this.state.list.forEach(q=>{ q.progress=0; q.done=false; q.fail=false; q.active=false; q._t=0; });
    // เริ่มใหม่ที่ตัวแรก
    this.state.list[0].active = true;
    stateRef.missions = this.state.list;
  }

  stop(){ /* no-op for now */ }

  // เรียกทุกครั้งที่มี event / ทุกวินาที (จาก main.js)
  tick(stateRef, metrics={}, _unused, ui){
    const list = (this.state?.list)||[];
    // อัปเดตแค่ตัวที่ active
    const act = list.find(q=>q.active && !q.done && !q.fail);
    if (act){
      this._updateQuest(act, metrics);
      // เสร็จ/ล้มเหลว → เด้งป้าย + ไปต่อ
      if (act.done){ ui?.hud?.showMiniQuestComplete?.('สำเร็จ!'); this.ensureAdvance(ui); }
      else if (act.fail){ ui?.hud?.toast?.('ภารกิจล้มเหลว'); this.ensureAdvance(ui); }
    }
    // ส่งไป HUD เฉพาะตัว active เพื่อ “โชว์ทีละ 1”
    const chips = act ? [this._chipOf(act)] : [];
    ui?.hud?.setQuestChips?.(chips);
    return chips;
  }

  // เรียกจาก BUS
  onEvent(evt, payload, stateRef){
    const list = (this.state?.list)||[];
    const act = list.find(q=>q.active && !q.done && !q.fail);
    if (!act) return;

    if (evt==='hit' || evt==='good' || evt==='perfect'){
      if (act.key==='target_hits') act.progress++;
      if (evt==='perfect' && act.key==='count_perfect') act.progress++;
      if (evt==='good'   && act.key==='collect_goods') act.progress++;
    }
    if (evt==='golden' && act.key==='count_golden') act.progress++;
    if (evt==='miss'){
      if (act.key==='no_miss') act.fail = true;
      if (act.key==='streak_keep') act._t = 0; // แตกสตรีค
    }
    if (evt==='combo' && typeof payload?.combo==='number'){
      if (act.key==='reach_combo' && payload.combo>=act.target) act.done=true;
      if (act.key==='streak_keep'){
        if (payload.combo>=8) act._t += 1; else act._t = 0;
        if (act._t >= act.target) act.done = true;
      }
    }
    if (evt==='score' && typeof payload?.score==='number'){
      if (act.key==='score_reach' && payload.score>=act.target) act.done=true;
      if (act.key==='quick_start'){
        const since = (performance.now() - (this.state?.startedAt||0))/1000;
        if (since <= 10 && payload.score>=act.target) act.done=true;
        if (since > 10 && !act.done) act.fail=true;
      }
    }
  }

  // ถ้าภารกิจ active จบ/พัง → เปิดภารกิจถัดไป (ถ้ามี)
  ensureAdvance(ui){
    const list = (this.state?.list)||[];
    let idx = list.findIndex(q=>q.active);
    if (idx<0) return;
    const cur = list[idx];

    if (cur.done || cur.fail){
      // ปิดตัวปัจจุบัน
      cur.active = false;
      // หาอันต่อไปที่ยังไม่ done/fail
      const next = list.find(q=>!q.done && !q.fail && !q.active);
      if (next){
        next.active = true;
        ui?.hud?.showMiniQuest?.(this.describe(next));
        // push HUD chips เฉพาะตัว next
        ui?.hud?.setQuestChips?.([this._chipOf(next)]);
      }else{
        // ไม่มีต่อแล้ว → ล้างแถบ mini quest
        ui?.hud?.setQuestChips?.([]);
      }
    }else{
      // ยังไม่จบก็แค่รีเฟรชชิพเดียว
      ui?.hud?.setQuestChips?.([this._chipOf(cur)]);
    }
  }

  describe(q){
    if (!q) return '';
    // ภาษาไทย
    const name = {
      collect_goods:'เก็บของดีให้ครบ',
      count_perfect:'Perfect ให้ครบ',
      count_golden:'เก็บไอเท็มทองให้ครบ',
      reach_combo:'ทำคอมโบให้ถึง x',
      no_miss:'ห้ามพลาดเกิน 0 ครั้ง',
      score_reach:'ทำคะแนนให้ถึง',
      target_hits:'ตีเป้าให้ครบ',
      streak_keep:'รักษาคอมโบ ≥8 ต่อเนื่อง (วินาที)',
      timed_survive:'อยู่รอดโดยไม่พลาด',
      quick_start:'10 วิแรก ทำคะแนนให้ถึง',
    }[q.key] || 'ภารกิจ';

    if (q.key==='reach_combo')   return `${name} ${q.target}`;
    if (q.key==='score_reach')   return `${name} ${q.target}`;
    if (q.key==='streak_keep')   return `${name} ${q.target}`;
    if (q.key==='timed_survive') return `${name} ${q.target}`;
    if (q.key==='quick_start')   return `${name} ${q.target}`;
    return `${name} ${q.target} ชิ้น`;
  }

  _makeQuest(def){
    const t = def.tiers?.[this.diff] ?? def.tiers?.Normal ?? 10;
    return {
      key:def.key, icon:def.icon||'⭐',
      label:this._labelTH(def.key),
      target:t|0, progress:0, done:false, fail:false, active:false,
      type:def.type||'count',
      _t:0 // ตัวนับวินาที/สตรีค
    };
  }

  _labelTH(key){
    return ({
      collect_goods:'เก็บของดีให้ครบ',
      count_perfect:'Perfect ให้ครบ',
      count_golden:'เก็บไอเท็มทองให้ครบ',
      reach_combo:'ทำคอมโบให้ถึง x',
      no_miss:'ห้ามพลาดเกิน 0 ครั้ง',
      score_reach:'ทำคะแนนให้ถึง',
      target_hits:'ตีเป้าให้ครบ',
      streak_keep:'รักษาคอมโบ ≥8 ต่อเนื่อง (วินาที)',
      timed_survive:'อยู่รอดโดยไม่พลาด',
      quick_start:'10 วิแรก ทำคะแนนให้ถึง',
    }[key] || 'ภารกิจ');
  }

  _updateQuest(q, metrics){
    // อัปเดตแบบ passive ต่อวินาที
    if (q.key==='timed_survive'){
      // ใช้ miss เป็นตัวรีเซ็ตใน onEvent แล้ว ที่นี่บวกเวลา
      q._t += 1;
      if (q._t >= q.target) q.done = true;
    }
    // นับความคืบหน้าให้เคส count ที่อาจถูกอัปเดตจาก onEvent ไปแล้ว
    if (q.type==='count'){
      if (q.progress >= q.target) q.done = true;
    }
    if (q.type==='limit'){
      if (q.fail) { /* already fail */ }
    }
  }

  _chipOf(q){
    const need = q.target|0, got = clamp(q.progress|0, 0, need);
    const pct  = need>0 ? Math.round((got/need)*100) : (q.fail?0:100);
    return {
      key:q.key, label:q.label, icon:q.icon, need, progress:got,
      done:!!q.done, fail:!!q.fail, active:true, pct
    };
    // HUD จะสร้างแถบจากค่าพวกนี้
  }
}
