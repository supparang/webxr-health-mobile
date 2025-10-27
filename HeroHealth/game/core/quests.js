// === Hero Health Academy — core/quests.js (Mini Quests: global + Hydration-specific) ===
export const Quests = (() => {
  // สำหรับโหมดทั่วไป
  const BASE = [
    { id:'combo_master', icon:'🔥', labelTH:'คอมโบต่อเนื่อง', labelEN:'Combo Master',
      makeNeed:(diff)=> diff==='Hard'?20: diff==='Easy'?10:15,
      init:(ctx)=>{ ctx.bestCombo=0; },
      onEvent:(ctx,type,p)=>{
        if (type==='hit' && (p.result==='good' || p.result==='perfect')){
          ctx.bestCombo = Math.max(ctx.bestCombo, p.combo||0);
          ctx.prog = Math.min(ctx.need, ctx.bestCombo);
        }
      }
    },
    { id:'perfect_collector', icon:'🌟', labelTH:'เก็บเพอร์เฟกต์', labelEN:'Perfect Collector',
      makeNeed:()=>10,
      onEvent:(ctx,type,p)=>{
        if (type==='hit' && p.result==='perfect'){
          ctx.prog = Math.min(ctx.need, (ctx.prog||0)+1);
        }
      }
    },
    { id:'speed_finisher', icon:'⏱️', labelTH:'ทำคะแนนทันเวลา', labelEN:'Speed Finisher',
      makeNeed:(diff)=> diff==='Hard'?350: diff==='Easy'?250:300,
      onEvent:(ctx,type,p)=>{
        if (type==='tick'){ if ((p.score|0) >= ctx.need) ctx.prog = ctx.need; }
      }
    },
    { id:'target_focus', icon:'🎯', labelTH:'โฟกัสเป้าหมาย', labelEN:'Target Focus',
      makeNeed:(diff)=> diff==='Hard'?10: diff==='Easy'?6:8,
      onEvent:(ctx,type,p)=>{
        if (type==='hit' && p.meta?.good){ ctx.prog = Math.min(ctx.need, (ctx.prog||0)+1); }
      }
    },
    { id:'avoid_mistakes', icon:'🛡️', labelTH:'เลี่ยงการพลาด', labelEN:'Avoid Mistakes',
      makeNeed:()=>3, init:(ctx)=>{ ctx.miss=0; ctx.prog=0; },
      onEvent:(ctx,type,p)=>{
        if (type==='hit' && p.result==='bad'){ ctx.miss++; }
        if (type==='run_end'){ if ((p.miss||0) <= ctx.need) ctx.prog = ctx.need; }
      }
    },
  ];

  // ชุดสำหรับ Hydration (เลือกมา 3 ต่อเกมเมื่อเล่นโหมดนี้)
  const HYD = [
    { id:'zone_keeper', icon:'💠', labelTH:'อยู่ในโซนพอดี', labelEN:'Stay in Ideal Zone',
      makeNeed:(diff)=> diff==='Hard'?28: diff==='Easy'?16:22, // วินาทีรวม
      init:(ctx)=>{ ctx.inZoneSec=0; },
      onEvent:(ctx,type,p)=>{
        // hydration.js -> event 'hydro_tick' { level, zone }
        if (type==='hydro_tick' && p.zone==='OK'){
          ctx.inZoneSec++; ctx.prog = Math.min(ctx.need, ctx.inZoneSec);
        }
      }
    },
    { id:'quick_recovery', icon:'📈', labelTH:'กู้จากต่ำสู่พอดี', labelEN:'Recover from Low',
      makeNeed:(diff)=> diff==='Hard'?3: diff==='Easy'?1:2,
      init:(ctx)=>{ ctx.count=0; },
      onEvent:(ctx,type,p)=>{
        // hydration.js -> event 'hydro_cross' { from, to }
        if (type==='hydro_cross' && p.from==='LOW' && p.to==='OK'){
          ctx.count++; ctx.prog = Math.min(ctx.need, ctx.count);
        }
      }
    },
    { id:'no_overflow', icon:'🚫', labelTH:'ห้ามเกินน้ำ', labelEN:'Avoid Overhydration',
      makeNeed:()=>2, // ยอมเกินได้ไม่เกิน 2 ครั้ง
      init:(ctx)=>{ ctx.high=0; ctx.prog=0; },
      onEvent:(ctx,type,p)=>{
        if (type==='hydro_cross' && p.to==='HIGH'){ ctx.high++; }
        if (type==='run_end'){ if (ctx.high <= ctx.need) ctx.prog = ctx.need; }
      }
    },
    { id:'smart_sips', icon:'🧠', labelTH:'จิบอย่างชาญฉลาด', labelEN:'Smart Sips',
      makeNeed:(diff)=> diff==='Hard'?12: diff==='Easy'?6:9, // คลิกรวมที่เข้ากติกา
      init:(ctx)=>{ ctx.count=0; },
      onEvent:(ctx,type,p)=>{
        // นับเฉพาะคลิกที่ "เหมาะสม" กับโซนก่อนหน้า: LOW->water, HIGH->sweet, OK->water
        if (type==='hydro_click'){
          const good =
            (p.zoneBefore==='LOW'  && p.kind==='water') ||
            (p.zoneBefore==='HIGH' && p.kind==='sweet') ||
            (p.zoneBefore==='OK'   && p.kind==='water');
          if (good){ ctx.count++; ctx.prog = Math.min(ctx.need, ctx.count); }
        }
      }
    },
    { id:'treat_time', icon:'🍬', labelTH:'หวานช่วยบาลานซ์', labelEN:'Treats to Balance',
      makeNeed:(diff)=> diff==='Hard'?8: diff==='Easy'?4:6, // กี่ครั้งที่ HIGH แล้วกด sweet
      init:(ctx)=>{ ctx.count=0; },
      onEvent:(ctx,type,p)=>{
        if (type==='hydro_click' && p.zoneBefore==='HIGH' && p.kind==='sweet'){
          ctx.count++; ctx.prog = Math.min(ctx.need, ctx.count);
        }
      }
    },
  ];

  // ภายใน
  let RUN = null;
  function t(th,en,lang){ return lang==='EN'?en:th; }

  function shufflePick3(list){
    const a=[...list];
    for (let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; }
    return a.slice(0,3);
  }

  function beginRun(mode, diff, lang='TH'){
    const pool = (mode==='hydration') ? HYD : BASE;
    const selected = shufflePick3(pool).map(q=>{
      const need = q.makeNeed ? q.makeNeed(diff) : (q.need||1);
      const ctx = { id:q.id, icon:q.icon, label: t(q.labelTH, q.labelEN, lang), need, prog:0 };
      if (q.init) q.init(ctx);
      return { def:q, ctx };
    });
    RUN = { mode, diff, lang, list:selected };
    // ทำให้ hydration.js เรียกได้: window.HHA_QUESTS.event(...)
    if (!window.HHA_QUESTS){
      window.HHA_QUESTS = { event:(type,payload)=>event(type,payload) };
    }
    return RUN.list.map(x=>x.ctx);
  }

  function event(type, payload){
    if (!RUN) return;
    for (const q of RUN.list){
      try { q.def.onEvent?.(q.ctx, type, payload||{}); } catch {}
    }
  }

  function endRun(summary){
    if (!RUN) return [];
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
