// === Hero Health Academy — core/mission-system.js (v4: 10-quest pool, non-repeating, sequential) ===
export class MissionSystem {
  constructor(){
    // พูล 10 เควสต์ (ครอบคลุม event ที่ BUS ส่ง: good, perfect, golden, miss, wrong_group, combo, score, hit)
    this.QUEST_POOL = [
      { key:'collect_goods', icon:'🍎', label:(n)=>`เก็บของดีให้ครบ ${n} ชิ้น`,       needBy:(ctx)=> Math.round(0.65 * ctx.seconds) },
      { key:'count_perfect', icon:'🌟', label:(n)=>`Perfect ให้ครบ ${n}`,              needBy:(ctx)=> Math.max(6, Math.round(ctx.seconds/6)) },
      { key:'count_golden',  icon:'🟡', label:(n)=>`Golden ให้ครบ ${n}`,               needBy:(ctx)=> Math.max(3, Math.round(ctx.seconds/15)) },
      { key:'reach_combo',   icon:'🔥', label:(n)=>`ทำคอมโบให้ถึง x${n}`,             needBy:(ctx)=> (ctx.diff==='Hard'?20:(ctx.diff==='Easy'?10:14)) },
      { key:'score_reach',   icon:'🏁', label:(n)=>`ทำคะแนนให้ถึง ${n}`,              needBy:(ctx)=> (ctx.diff==='Hard'?900:(ctx.diff==='Easy'?400:650)) },
      { key:'target_hits',   icon:'🎯', label:(n)=>`ตีโดนให้ครบ ${n} ครั้ง`,          needBy:(ctx)=> Math.round(0.9 * ctx.seconds) },
      { key:'no_miss',       icon:'❌', label:(_)=>`ห้ามพลาดเกิน 0 ครั้ง`,            needBy:(_)=> 0 }, // เงื่อนไขผ่านคือ miss==0 ตลอดเควสต์
      { key:'avoid_junk',    icon:'🚫', label:(n)=>`อย่าตี Junk เกิน ${n} ครั้ง`,      needBy:(ctx)=> (ctx.diff==='Easy'?2:(ctx.diff==='Hard'?0:1)) },
      { key:'streak_perfect',icon:'⚡', label:(n)=>`Perfect ติดกันให้ได้ ${n} ครั้ง`,  needBy:(ctx)=> (ctx.diff==='Hard'?6:(ctx.diff==='Easy'?3:4)) },
      { key:'fever_fill',    icon:'🔥', label:(n)=>`เติม FEVER รวมให้ถึง ${n}%`,       needBy:(ctx)=> 100 } // สะสมจาก golden/fever add
    ];
  }

  // สุ่มโดยไม่ซ้ำ, ติดธง active ทีละ 1
  start(mode, { seconds=45, count=3, lang='TH', singleActive=true, diff='Normal' }={}){
    const ctx = { mode, seconds, lang, diff };
    const pool = this._shuffle(this.QUEST_POOL.slice(0));
    const chosen = pool.slice(0, Math.max(1, Math.min(count, pool.length))).map((q,i)=>{
      const need = Math.max(0, Number(q.needBy(ctx))|0);
      return {
        key: q.key, icon:q.icon, label: (typeof q.label==='function'?q.label(need):q.label) || q.key,
        need, progress:0, done:false, fail:false, active: (i===0)
      };
    });
    return { ctx, list: chosen, i:0, streakPerfect:0, missCount:0, junkCount:0, feverGain:0 };
  }

  attachToState(run, stateRef){
    stateRef.missions = run.list;
    stateRef.ctx = run.ctx;
    stateRef._run = run;
  }

  reset(stateRef){
    if(stateRef?._run){
      const { ctx } = stateRef._run;
      const re = this.start(ctx.mode, { seconds:ctx.seconds, count:stateRef.missions.length, lang:ctx.lang, diff:ctx.diff });
      this.attachToState(re, stateRef);
    }
  }

  stop(_stateRef){ /* no-op now */ }

  // อัปเดตเป็นวินาที: ใช้ตรวจ score/เวลา และเรนเดอร์ HUD chips
  tick(stateRef, snapshot={score:0, combo:0}, _unused=null, hooks={}){
    if(!stateRef?._run) return;
    const run = stateRef._run;
    const cur = run.list[run.i];
    if(!cur) return;

    // เงื่อนไขสำเร็จ/ล้มเหลวแบบที่อ่านจาก snapshot
    switch(cur.key){
      case 'reach_combo':
        if ((snapshot.combo|0) >= cur.need) cur.done = true;
        break;
      case 'score_reach':
        if ((snapshot.score|0) >= cur.need) cur.done = true;
        break;
      case 'no_miss':
        // ผ่านเมื่อเกมจบจะเช็คอีกครั้ง (ที่นี่แค่ติดตาม)
        cur.progress = 0;
        cur.done = (run.missCount===0); // ชั่วคราวแสดงเป็นผ่าน/ไม่ผ่านไดนามิก
        break;
      case 'avoid_junk':
        cur.progress = run.junkCount;
        cur.done = (run.junkCount <= cur.need); // แบบไดนามิก
        break;
      case 'fever_fill':
        cur.progress = Math.min(cur.need, Math.round(run.feverGain));
        if (cur.progress >= cur.need) cur.done = true;
        break;
      default: break;
    }

    // เควสต์สำเร็จ → ไปเควสต์ถัดไป
    if (cur.done && !cur.fail){
      this._advance(stateRef, hooks);
    }

    // อัปเดตชิป HUD
    if (hooks?.hud?.setQuestChips){
      const chips = stateRef.missions.map((m, idx)=>({
        icon:m.icon, label:m.label, need:m.need, progress:m.progress|0, done:m.done, fail:m.fail,
        active: (idx===run.i)
      }));
      hooks.hud.setQuestChips(chips);
    }
  }

  // รับอีเวนต์จาก BUS
  onEvent(type, payload={}, stateRef){
    if(!stateRef?._run) return;
    const run = stateRef._run;
    const cur = run.list[run.i];
    if(!cur) return;

    switch(type){
      case 'good':
        if (cur.key==='collect_goods' || cur.key==='target_hits'){ cur.progress += (payload.count|0)||1; }
        run.streakPerfect = 0; // รีเฉพาะเมื่อ good (ไม่ใช่ perfect)
        break;

      case 'perfect':
        if (cur.key==='count_perfect' || cur.key==='target_hits'){ cur.progress += (payload.count|0)||1; }
        run.streakPerfect = (run.streakPerfect|0)+1;
        if (cur.key==='streak_perfect'){ cur.progress = Math.max(cur.progress|0, run.streakPerfect|0); }
        break;

      case 'golden':
        if (cur.key==='count_golden'){ cur.progress += 1; }
        run.feverGain += (payload.fever||20); // ประมาณการ 20 ต่อ golden ถ้าไม่ส่งมาก็ +20
        break;

      case 'combo':
        if (cur.key==='reach_combo'){
          cur.progress = Math.max(cur.progress|0, (payload.combo|0)||0);
        }
        break;

      case 'score':
        if (cur.key==='score_reach'){
          cur.progress = Math.max(cur.progress|0, (payload.score|0)||0);
        }
        break;

      case 'miss':
        run.missCount += (payload.count|0)||1;
        run.streakPerfect = 0;
        if (cur.key==='no_miss'){ cur.fail = true; } // พลาดแล้วไม่ผ่านเควสต์นี้
        break;

      case 'wrong_group':
        run.junkCount += (payload.count|0)||1;
        if (cur.key==='avoid_junk' && run.junkCount > cur.need){ cur.fail = true; }
        break;

      default: break;
    }

    // เช็คสำเร็จทันทีสำหรับบางเคส
    if (!cur.fail){
      if (cur.need>0 && (cur.progress|0) >= cur.need){
        cur.done = true;
      } else if (cur.key==='no_miss' || cur.key==='avoid_junk' || cur.key==='fever_fill'){
        // พวกไดนามิกจะถูกเช็คใน tick
      }
    }
  }

  // เรียกตอนเกมจบ เพื่อกำหนดสถานะสุดท้ายของเงื่อนไขระยะยาว
  finalize(stateRef){
    if(!stateRef?._run) return;
    const run = stateRef._run;
    for (const m of run.list){
      if (m.key==='no_miss'){ m.done = (run.missCount===0) && !m.fail; }
      if (m.key==='avoid_junk'){ m.done = (run.junkCount <= m.need) && !m.fail; }
      if (m.key==='fever_fill'){ m.done = (m.progress >= m.need) && !m.fail; }
    }
  }

  describe(m, lang='TH'){
    const rec = this.QUEST_POOL.find(q=>q.key===m.key);
    return (rec && typeof rec.label==='function') ? rec.label(m.target||m.need||0) : (m.label||m.key);
  }

  /* --------- helpers --------- */
  _advance(stateRef, hooks){
    const run = stateRef._run;
    const prevIdx = run.i;
    run.list[prevIdx].active = false;

    // ไปเควสต์ถัดไป (ไม่ซ้ำและสูงสุดตามที่เลือกไว้)
    if (prevIdx < run.list.length-1){
      run.i = prevIdx + 1;
      run.list[run.i].active = true;
      hooks?.hud?.showMiniQuest?.(run.list[run.i].label);
    } else {
      // ครบแล้ว — โชว์ complete แบบเบา ๆ
      hooks?.hud?.showMiniQuestComplete?.('Mini quests complete!');
    }
  }

  _shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }
}
