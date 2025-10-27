// === Hero Health Academy — core/quests.js (Mini Quests: pick 3 of 5 per run) ===
export const Quests = (() => {
  // 5 เควสพื้นฐาน (รองรับทุกโหมด)
  const BASE = [
    // 1) คอมโบต่อเนื่อง
    { id:'combo_master', icon:'🔥', labelTH:'คอมโบต่อเนื่อง', labelEN:'Combo Master',
      makeNeed:(diff)=> diff==='Hard'?20: diff==='Easy'?10:15,
      init: (ctx)=>{ ctx.bestCombo=0; },
      onEvent: (ctx, type, payload)=>{
        if (type==='hit' && (payload.result==='good' || payload.result==='perfect')){
          ctx.bestCombo = Math.max(ctx.bestCombo, payload.combo||0);
          ctx.prog = Math.min(ctx.need, ctx.bestCombo);
        }
      }
    },
    // 2) เก็บ Perfect ให้ครบ
    { id:'perfect_collector', icon:'🌟', labelTH:'เก็บเพอร์เฟกต์', labelEN:'Perfect Collector',
      makeNeed:()=>10,
      onEvent:(ctx, type, payload)=>{
        if (type==='hit' && payload.result==='perfect'){
          ctx.prog = Math.min(ctx.need, (ctx.prog||0)+1);
        }
      }
    },
    // 3) ทำคะแนนทันเวลา
    { id:'speed_finisher', icon:'⏱️', labelTH:'ทำคะแนนทันเวลา', labelEN:'Speed Finisher',
      makeNeed:(diff)=> diff==='Hard'?350: diff==='Easy'?250:300,
      onEvent:(ctx, type, payload)=>{
        if (type==='tick'){ // payload: {timeLeft, score}
          if ((payload.score|0) >= ctx.need) ctx.prog = ctx.need;
        }
      }
    },
    // 4) โฟกัสเป้าหมาย/หมวด
    { id:'target_focus', icon:'🎯', labelTH:'โฟกัสหมวดเป้าหมาย', labelEN:'Target Focus',
      makeNeed:(diff)=> diff==='Hard'?10: diff==='Easy'?6:8,
      onEvent:(ctx, type, payload)=>{
        // สำหรับ groups: meta.good && meta.groupId === current target
        if (type==='hit' && payload.meta?.good){
          ctx.prog = Math.min(ctx.need, (ctx.prog||0)+1);
        }
      }
    },
    // 5) หลีกเลี่ยงพลาด
    { id:'avoid_mistakes', icon:'🛡️', labelTH:'หลีกเลี่ยงการพลาด', labelEN:'Avoid Mistakes',
      makeNeed:()=>3, // max miss allowed
      init:(ctx)=>{ ctx.miss=0; ctx.prog=0; },
      onEvent:(ctx, type, payload)=>{
        if (type==='hit' && payload.result==='bad'){
          ctx.miss++;
          // ความคืบหน้าเป็น "เหลือโควตาความผิดพลาด" หรือจะนับแบบกลับก็ได้
          // ที่นี่จะถือว่าเควสสำเร็จเมื่อจบรอบและ miss <= need (ไป finalize ตอน endRun)
        }
        if (type==='run_end'){ // payload: {miss}
          if ((payload.miss||0) <= ctx.need) ctx.prog = ctx.need;
        }
      }
    },
  ];

  // สถานะรอบปัจจุบัน
  let RUN = null;

  function t(th,en,lang){ return lang==='EN'?en:th; }

  function pick3(list){
    const a = [...list];
    for (let i=a.length-1;i>0;i--){
      const j=(Math.random()*(i+1))|0;
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a.slice(0,3);
  }

  function beginRun(mode, diff, lang='TH'){
    const selected = pick3(BASE).map(q=>{
      const need = q.makeNeed ? q.makeNeed(diff) : (q.need||1);
      const ctx = { id:q.id, icon:q.icon, label: t(q.labelTH, q.labelEN, lang), need, prog:0 };
      if (q.init) q.init(ctx);
      return { def:q, ctx };
    });
    RUN = { mode, diff, lang, list:selected, startedAt: performance.now?performance.now():Date.now() };
    return RUN.list.map(x=>x.ctx);
  }

  function event(type, payload){
    if (!RUN) return;
    for (const q of RUN.list){
      try { q.def.onEvent?.(q.ctx, type, payload||{}); } catch {}
    }
  }

  function endRun(summary){
    if (!RUN) return;
    // ส่งสัญญาณ run_end ให้เควสที่ต้องสรุป (เช่น avoid_mistakes)
    for (const q of RUN.list){
      try { q.def.onEvent?.(q.ctx, 'run_end', summary||{}); } catch {}
    }
    const out = RUN.list.map(x=>x.ctx);
    RUN = null;
    return out;
  }

  function getActive(){ return RUN ? RUN.list.map(x=>x.ctx) : []; }

  return { beginRun, event, endRun, getActive };
})();
