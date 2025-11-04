// === Hero Health Academy — core/mission-system.js (v4: 10 mini-quests, event-driven, single-active) ===
'use strict';

export class MissionSystem {
  constructor(){
    // 10 เควสต์มาตรฐาน (จะสุ่มมาใช้ 3 อัน/รอบ)
    this.poolDefs = [
      { key:'collect_goods', icon:'🥗', need:[12,16,20],  label:(n)=>`เก็บของดี ${n} ชิ้น` },
      { key:'count_perfect', icon:'🌟', need:[6,8,10],    label:(n)=>`Perfect ${n} ครั้ง` },
      { key:'count_golden',  icon:'🟡', need:[2,3,4],     label:(n)=>`แตะทอง ${n} ครั้ง` },
      { key:'reach_combo',   icon:'🔥', need:[20,30,40],  label:(n)=>`คอมโบ ${n}+` },
      { key:'score_reach',   icon:'🏁', need:[250,350,450],label:(n)=>`ทำคะแนนถึง ${n}` },
      { key:'target_hits',   icon:'🎯', need:[18,24,30],  label:(n)=>`ตีให้โดน ${n} ครั้ง` },
      { key:'no_miss',       icon:'❌', need:[1,1,1],     label:()=>`ห้ามพลาด (จนกว่าจะผ่าน)` },
      { key:'quick_start',   icon:'⚡', need:[5,6,7],     label:(n)=>`เปิดเกมแรกๆ เก็บของดีให้ได้ ${n}` },
      { key:'streak_keep',   icon:'🧊', need:[8,10,12],   label:(n)=>`รักษาคอมโบ ≥ ${n} เป็นเวลา` },
      { key:'timed_survive', icon:'⏱️', need:[10,15,20],  label:(n)=>`อยู่รอด ${n} วิ (โดยไม่พลาด)` },
    ];
    this.active = [];     // รายการ 3 มิชชั่นของรอบนี้
    this.index  = 0;      // ชี้ไปมิชชั่นปัจจุบัน (เดินทีละอัน)
    this.runCtx = null;   // ค่าคงสภาพรอบนี้ (diff / seconds)
    this.stats  = { miss:0, hits:0, goods:0, perfect:0, golden:0, combo:0, score:0, elapsed:0 };
  }

  // เลือกระดับ need ตาม diff
  _tier(diff){
    if (diff==='Easy') return 0;
    if (diff==='Hard') return 2;
    return 1; // Normal
  }

  // อธิบายข้อความ
  describe(m, lang='TH'){
    const def = this.poolDefs.find(d=>d.key===m.key);
    if (!def) return m.key;
    const n = m.target|0;
    return def.label ? def.label(n) : m.key;
  }

  // สตาร์ทรอบใหม่: สุ่ม 3 เควสต์ (ไม่ซ้ำ) ตาม diff
  start(modeKey, {seconds=45, count=3, lang='TH', singleActive=true, diff='Normal'} = {}){
    const tier = this._tier(diff);
    // สุ่ม 3 อันจาก 10
    const pool = [...this.poolDefs];
    const pick3 = [];
    for(let i=0;i<count && pool.length;i++){
      const idx = (Math.random()*pool.length)|0;
      const d = pool.splice(idx,1)[0];
      pick3.push({
        key: d.key,
        icon: d.icon,
        target: Array.isArray(d.need)? d.need[tier] : (d.need|0)||1,
        progress: 0,
        done: false,
        fail: false,
        label: d.label ? d.label(Array.isArray(d.need)? d.need[tier] : (d.need|0)||1) : d.key,
        _t: 0,           // ใช้กับ timed / quick / streak
        _lock: false,    // ใช้กับ no_miss
      });
    }

    this.active = pick3;
    this.index  = 0;
    this.runCtx = { seconds, singleActive, lang, diff };
    this.stats  = { miss:0, hits:0, goods:0, perfect:0, golden:0, combo:0, score:0, elapsed:0 };
    return { missions: this.active };
  }

  attachToState(run, stateRef){
    stateRef.missions = this.active;
    stateRef.ctx = this.runCtx;
  }

  reset(stateRef){
    this.active = [];
    this.index = 0;
    this.runCtx = null;
    this.stats  = { miss:0, hits:0, goods:0, perfect:0, golden:0, combo:0, score:0, elapsed:0 };
    if (stateRef){ stateRef.missions=[]; stateRef.ctx={}; }
  }

  // อัปเดต UI ชิป (เรียกบ่อยได้ ปลอดภัย)
  _chips(){
    return this.active.map((m,i)=>({
      key: m.key,
      label: m.label,
      need: m.target|0,
      progress: Math.min(m.target|0, m.progress|0),
      done: !!m.done,
      fail: !!m.fail,
      active: (i===this.index && !m.done && !m.fail),
      icon: m.icon,
      iconSize: 16
    }));
  }

  // พบมิชชั่นปัจจุบัน (แบบ single-active)
  _cur(){ return (this.active[this.index] || null); }

  // เดินไปมิชชั่นถัดไปเมื่อผ่าน
  _advance(){
    while(this.index < this.active.length && (this.active[this.index].done || this.active[this.index].fail)){
      this.index++;
    }
  }

  // เรียกทุกวินาที/ทุกเฟรมเพื่ออัปเดต HUD, โชว์ banner, และ validate เงื่อนไขตามเวลา
  tick(stateRef, scoreCtx, _unused, {hud, coach, lang}={}){
    // อัปเดต elapsed
    this.stats.elapsed = (this.stats.elapsed|0) + 1;

    // เงื่อนไขตามเวลา
    const cur = this._cur();
    if (cur){
      // timed_survive: เพิ่มเติมถ้าไม่มี miss
      if (cur.key==='timed_survive' && !cur.fail){
        cur._t = (cur._t|0) + 1;
        cur.progress = cur._t;
        if (cur.progress >= (cur.target|0)){ cur.done=true; coach?.onPerfect?.(); hud?.showMiniQuestComplete?.('ครบเวลา!'); }
      }

      // streak_keep: ถ้าคอมโบ ≥ เกณฑ์ เพิ่มวินาที; ถ้าตก ต่ำกว่าเกณฑ์ รีเซ็ตนับ
      if (cur.key==='streak_keep'){
        const needCombo = cur.target|0;
        if ((this.stats.combo|0) >= needCombo){
          cur._t = (cur._t|0) + 1;
          cur.progress = cur._t;
          if (cur.progress >= needCombo){ cur.done = true; hud?.showMiniQuestComplete?.('รักษาคอมโบสำเร็จ!'); }
        } else {
          cur._t = 0;
          cur.progress = 0;
        }
      }

      // quick_start: จำกัดเฉพาะ 10 วินาทีแรกของเกม
      if (cur.key==='quick_start'){
        if ((this.stats.elapsed|0) > 10 && !cur.done && !cur.fail){
          // หมดเวลาช่วงต้นเกมแล้วแต่ยังไม่ถึงเป้า → fail เควสต์นี้
          cur.fail = true;
        }
      }

      // no_miss: ถ้าเคย miss แล้ว ถือว่า fail
      if (cur.key==='no_miss'){
        if (this.stats.miss>0 && !cur.done){ cur.fail = true; }
        // ให้ผ่านได้ถ้าผ่านเควสต์ต่อเนื่อง: เราตีความ “จนกว่าจะผ่าน” คือ ต้องเก็บ good ติดต่อกันถึงจำนวนเป้าโดยไม่ miss
        // การนับจะทำใน onEvent('good'|'perfect') ด้านล่าง (cur._t ใช้ชั่วคราวเก็บ streak)
      }

      // score_reach: อัปเดตจากคะแนนล่าสุด
      if (cur.key==='score_reach'){
        cur.progress = Math.min(cur.target|0, this.stats.score|0);
        if ((this.stats.score|0) >= (cur.target|0)){ cur.done=true; }
      }
    }

    // HUD chips
    const chips = this._chips();
    hud?.setQuestChips?.(chips);

    // กรณีพึ่งผ่าน → โชว์ banner มิชชั่นถัดไป
    if (cur && cur.done){
      this._advance();
      const next = this._cur();
      if (next){ hud?.showMiniQuest?.(next.label); }
    }
    return chips;
  }

  // ดักอีเวนต์จากเกม
  onEvent(type, payload, stateRef){
    // อัปเดตสถิติรวม
    if (type==='hit'){ this.stats.hits++; }
    if (type==='good'){ this.stats.goods++; }
    if (type==='perfect'){ this.stats.perfect++; }
    if (type==='golden'){ this.stats.golden++; }
    if (type==='miss'){ this.stats.miss++; }
    if (type==='combo'){ this.stats.combo = Math.max(this.stats.combo|0, payload?.combo|0); } // เก็บค่าสูงสุดไว้ใช้กับเงื่อนไข
    if (type==='score'){ this.stats.score = payload?.score|0; }

    const cur = this._cur();
    if (!cur) return;

    // อัปเดตความคืบหน้าตามชนิดเควสต์
    switch(cur.key){
      case 'collect_goods':
        if (type==='good' || type==='perfect'){ cur.progress = Math.min(cur.target|0, (cur.progress|0)+1); }
        break;

      case 'count_perfect':
        if (type==='perfect'){ cur.progress = Math.min(cur.target|0, (cur.progress|0)+1); }
        break;

      case 'count_golden':
        if (type==='golden'){ cur.progress = Math.min(cur.target|0, (cur.progress|0)+1); }
        break;

      case 'reach_combo':
        if (type==='combo'){
          if ((payload?.combo|0) >= (cur.target|0)){ cur.progress = cur.target; cur.done = true; }
          else { cur.progress = Math.max(cur.progress|0, payload?.combo|0); }
        }
        break;

      case 'score_reach':
        if (type==='score'){
          cur.progress = Math.min(cur.target|0, payload?.score|0);
          if ((payload?.score|0) >= (cur.target|0)){ cur.done = true; }
        }
        break;

      case 'target_hits':
        if (type==='hit'){ cur.progress = Math.min(cur.target|0, (cur.progress|0)+1); }
        break;

      case 'no_miss':
        if (type==='miss'){ cur.fail = true; cur._t = 0; cur.progress = 0; }
        if (type==='good' || type==='perfect'){
          cur._t = (cur._t|0) + 1;
          cur.progress = Math.min(cur.target|0, cur._t|0);
          if (cur.progress >= (cur.target|0)){ cur.done = true; }
        }
        break;

      case 'quick_start':
        if (type==='good' || type==='perfect'){
          if ((this.stats.elapsed|0) <= 10){
            cur.progress = Math.min(cur.target|0, (cur.progress|0)+1);
            if (cur.progress >= (cur.target|0)){ cur.done = true; }
          }
        }
        break;

      case 'streak_keep':
        // นับใน tick() ด้วยการเช็ค combo ต่อเนื่องอยู่แล้ว
        break;

      case 'timed_survive':
        if (type==='miss'){ cur.fail = true; }
        break;
    }

    if (cur.progress >= (cur.target|0) && !cur.done && !cur.fail){
      cur.done = true;
    }

    // ถ้าเควสต์ปัจจุบันจบ/พัง → เดินต่อ
    if (cur.done || cur.fail){ this._advance(); }
  }
}
