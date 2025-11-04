// === Hero Health Academy — core/mission-system.js (robust, single-active, numeric-true) ===
'use strict';

export class MissionSystem {
  constructor(){
    this.catalog = {
      collect_goods:  (t)=>({ key:'collect_goods',  target:t??30, progress:0 }),
      count_perfect:  (t)=>({ key:'count_perfect',  target:t??10, progress:0 }),
      count_golden:   (t)=>({ key:'count_golden',   target:t??3,  progress:0 }),
      reach_combo:    (t)=>({ key:'reach_combo',    target:t??14, progress:0, mode:'max' }),
      score_reach:    (t)=>({ key:'score_reach',    target:t??300,progress:0, mode:'max' }),
    };
  }

  start(modeKey, {seconds=45, count=3, singleActive=true, lang='TH'}={}){
    // เลือกเควสต์ให้เหมาะกับโหมด (เรียงลำดับ)
    const base = [
      this.catalog.collect_goods(30),
      this.catalog.count_perfect(10),
      this.catalog.count_golden(3),
      this.catalog.reach_combo(14),
      this.catalog.score_reach(500),
    ];

    const missions = base.slice(0, Math.max(1, count)).map((m,i)=>({
      ...m, success:false, done:false, active:(i===0), fail:false
    }));

    return { modeKey, seconds, lang, singleActive, missions };
  }

  attachToState(run, stateRef){
    stateRef.missions = run.missions;
    stateRef.ctx = { singleActive: !!run.singleActive };
  }

  // แสดงชื่อเควสต์
  describe(m, lang='TH'){
    const need = m.target|0;
    const dictTH = {
      collect_goods: 'เก็บของดีให้ครบ',
      count_perfect: 'Perfect ให้ครบ',
      count_golden:  'Golden ให้ครบ',
      reach_combo:   'ทำคอมโบให้ถึง',
      score_reach:   'ทำคะแนนให้ถึง',
    };
    const dictEN = {
      collect_goods: 'Collect goods',
      count_perfect: 'Perfect hits',
      count_golden:  'Golden hits',
      reach_combo:   'Reach combo',
      score_reach:   'Reach score',
    };
    const label = (lang==='TH'?dictTH:dictEN)[m.key] || m.key;
    return `${label} ${need}`;
  }

  // อัปเดต HUD ชิป
  _render(hud, missions){
    const list = missions.map((m, idx)=>({
      key:m.key,
      label:this.describe(m),
      need:m.target|0,
      progress:m.progress|0,
      done:(m.progress|0) >= (m.target|0),
      fail:!!m.fail,
      active: (m.active===true),
      icon: ({collect_goods:'🍎',count_perfect:'🌟',count_golden:'🟡',reach_combo:'🔥',score_reach:'🏁'})[m.key] || '⭐',
      iconSize: 16 + (m.active?2:0),
    }));
    hud?.setQuestChips?.(list);
  }

  // เปิดเควสต์ถัดไปอัตโนมัติ (single active)
  _advanceIfNeeded(stateRef, hud){
    const ms = stateRef.missions||[];
    const single = !!stateRef.ctx?.singleActive;
    if (!single) return;

    let idx = ms.findIndex(m=>m.active);
    if (idx<0) idx = 0;

    // ถ้าอันปัจจุบันผ่าน → deactivate แล้วเปิดอันถัดไป
    const m = ms[idx];
    if (m && (m.progress|0) >= (m.target|0)){
      m.active=false; m.success=true; m.done=true;
      const nxt = ms[idx+1];
      if (nxt){ nxt.active=true; hud?.showMiniQuest?.(this.describe(nxt)); }
      else { hud?.showMiniQuestComplete?.('เควสต์ครบแล้ว!'); }
    }
  }

  tick(stateRef, gameStats={}, now=null, helpers={}){
    const { hud } = helpers;
    this._advanceIfNeeded(stateRef, hud);
    this._render(hud, stateRef.missions||[]);
    return (stateRef.missions||[]);
  }

  stop(stateRef){ /* no-op */ }
  reset(stateRef){
    (stateRef.missions||[]).forEach((m,i)=>{
      m.progress=0; m.success=false; m.done=false; m.fail=false; m.active=(i===0);
    });
  }

  // ====== อีเวนต์จากเกมหลัก ======
  onEvent(ev, payload={}, stateRef){
    const ms = stateRef.missions||[];
    if (!ms.length) return;

    // อัปเดต “เฉพาะอันที่ active” ถ้า singleActive = true
    const singles = !!stateRef.ctx?.singleActive;
    const targets = singles ? ms.filter(m=>m.active) : ms;

    for (const m of targets){
      if (m.key==='collect_goods' && (ev==='collect_goods')){
        m.progress = (m.progress|0) + (payload.count|0);
      }
      else if (m.key==='count_perfect' && (ev==='count_perfect')){
        m.progress = (m.progress|0) + (payload.count|0);
      }
      else if (m.key==='count_golden' && (ev==='count_golden')){
        // หมด golden ก็ไม่ตัน: ถือว่า perfect/collect_goods ช่วยจบเควสต์อื่นได้
        m.progress = (m.progress|0) + (payload.count|0);
      }
      else if (m.key==='reach_combo' && (ev==='reach_combo')){
        // ใช้ค่าสูงสุดที่ทำได้ ไม่ต้องนับทุกครั้ง
        const v = payload.value|0;
        if (v > (m.progress|0)) m.progress = v;
      }
      else if (m.key==='score_reach' && (ev==='score_reach')){
        const v = payload.value|0;
        if (v > (m.progress|0)) m.progress = v;
      }

      // ปิดท้าย: ตัดสินผ่านทันทีถ้าถึงเป้า
      if ((m.progress|0) >= (m.target|0)) { m.success=true; m.done=true; }
    }
  }
}
