// === core/quests.js (10 mini-quests; pick 3 per run; focus sequential; full summary) ===
'use strict';

export const Quests = (()=>{

  const QUEST_DEFS = [
    { key:'good_15',   icon:'🥗', label:'แตะของดี 15 ชิ้น', needByDiff:{Easy:12,Normal:15,Hard:18},
      onHit:(e)=> (e.kind==='good'||e.kind==='perfect')?1:0 },
    { key:'perfect_8', icon:'💥', label:'Perfect 8 ครั้ง', needByDiff:{Easy:6,Normal:8,Hard:10},
      onHit:(e)=> (e.kind==='perfect')?1:0 },
    { key:'combo_20',  icon:'🔥', label:'ทำคอมโบ 20', needByDiff:{Easy:16,Normal:20,Hard:24},
      onTick:(_s,ctx)=> ctx.comboMax>=ctx.need? (ctx.need-ctx.progress):0 },
    { key:'fever_on',  icon:'⚡', label:'เข้า FEVER 1 ครั้ง', needByDiff:{Easy:1,Normal:1,Hard:1},
      onFever:(on)=> on?1:0 },
    { key:'fever_10s', icon:'⏱️', label:'สะสม FEVER 10 วิ', needByDiff:{Easy:8,Normal:10,Hard:12},
      onTick:(s,ctx)=> ctx.fever?ctx.dt:0, isTime:true },
    { key:'gold_5',    icon:'⭐', label:'เก็บ GOLD 5 ชิ้น', needByDiff:{Easy:4,Normal:5,Hard:6},
      onHit:(e)=> e.kind==='gold'?1:0 },
    { key:'avoid_junk',icon:'🚫', label:'หลีกเลี่ยง JUNK 20 วิ', needByDiff:{Easy:15,Normal:20,Hard:25},
      onTick:(s,ctx)=> ctx.noJunkSeconds ? Math.min(ctx.dt, ctx.noJunkSeconds) : 0, isTime:true },
    { key:'streak_10', icon:'🔗', label:'Streak 10', needByDiff:{Easy:8,Normal:10,Hard:12},
      onTick:(_s,ctx)=> ctx.combo>=ctx.need? (ctx.need-ctx.progress):0 },
    { key:'score_600', icon:'🏆', label:'ทำคะแนน 600', needByDiff:{Easy:450,Normal:600,Hard:800},
      onTick:(s,ctx)=> (ctx.score>=ctx.need)? (ctx.need-ctx.progress):0 },
    { key:'good_chain',icon:'➕', label:'แตะของดีติดกัน 12', needByDiff:{Easy:10,Normal:12,Hard:14},
      onHit:(e,ctx)=> (e.kind==='good'||e.kind==='perfect') ? 1 : (ctx.breakChain=1,0), chain:true }
  ];

  // runtime
  let HUD=null, COACH=null, active=[], focusIdx=0, diff='Normal', secTotal=45;

  function diffNeed(def){ return def.needByDiff?.[diff] ?? def.needByDiff?.Normal ?? 1; }
  function pick3(defs){
    const k = [...defs];
    for(let i=k.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [k[i],k[j]]=[k[j],k[i]]; }
    return k.slice(0,3).map(d=>({
      key:d.key, icon:d.icon, label:d.label, need:diffNeed(d), progress:0, done:false, fail:false,
      _def:d, active:false
    }));
  }

  function refreshHUD(){
    const list = active.map((q,i)=>({key:q.key,label:q.label,icon:q.icon,need:q.need,progress:q.progress,done:q.done,fail:q.fail,active:i===focusIdx}));
    HUD?.setQuestChips(list);
  }
  function ensureFocus(){
    // ข้ามเควสต์ที่เสร็จ/ล้มเหลวไปยังอันถัดไป
    while(focusIdx<active.length && (active[focusIdx].done||active[focusIdx].fail)) focusIdx++;
    if(focusIdx>=active.length) focusIdx = active.length-1;
    refreshHUD();
  }
  function addProgress(q, inc){
    if(q.done||q.fail) return;
    q.progress += inc;
    if(!q._def.isTime && q.progress>q.need) q.progress=q.need;
    if(q.progress>=q.need){ q.progress=q.need; q.done=true; COACH?.say('เควสต์สำเร็จ!'); }
    refreshHUD();
    if(q.done) ensureFocus();
  }

  // public-ish
  return {
    bindToMain({hud,coach}){ HUD=hud; COACH=coach; return { refresh:refreshHUD }; },
    beginRun(modeKey, difficulty, lang, seconds){
      diff = String(difficulty||'Normal'); secTotal=seconds|0;
      active = pick3(QUEST_DEFS); focusIdx=0;
      refreshHUD();
      COACH?.say('ภารกิจ 3 อย่าง เริ่มจากอันแรก!');
      // สถานะที่ต้องสะสมต่อเนื่อง
      this._ctx = { combo:0, comboMax:0, noJunkSeconds:0, lastWasJunk:false, fever:false, dt:0, score:0 };
    },
    // 收尾/สรุป
    endRun({_score}={}){
      const done = active.filter(q=>q.done).map(q=>q.key);
      const fail = active.filter(q=>!q.done).map(q=>q.key);
      const lines = active.map(q=>{
        const mark = q.done ? '✅' : '❌';
        return `${mark} ${q.label} — ${q.progress}/${q.need}`;
      });
      return { done, fail, lines, totalDone: done.length };
    },
    // events from main:
    event(type, payload={}){
      const ctx = this._ctx || (this._ctx={});
      if(type==='hit'){
        const kind = payload.kind||'good';
        ctx.score = (ctx.score|0) + (payload.points|0);
        // chain: รีเซ็ตเมื่อ junk
        if(kind==='good'||kind==='perfect'){ ctx.combo=(ctx.combo|0)+1; } else { ctx.combo=0; }
        if(ctx.combo>ctx.comboMax) ctx.comboMax=ctx.combo;

        // gold/⭐ นับถูกต้อง
        for(const q of active){
          if(q.done||q.fail) continue;
          const def=q._def;
          if(def.onHit){
            let inc = def.onHit({kind}, ctx) | 0;
            if(inc>0 && active.indexOf(q)===focusIdx) addProgress(q, inc);
          }
        }
        // หลีกเลี่ยง junk: เมื่อมี hit ของดีให้ต่อยอดเวลาปลอด junk
        ctx.lastWasJunk=false;
      }
      else if(type==='miss'){
        // miss: เฉพาะ good timeout — ตัด combo และเควสต์ chain อาจล้มเหลว (ถ้าต้องการเข้ม)
        const ctx2=this._ctx; ctx2.combo=0;
      }
      else if(type==='junk'){
        // คลิก junk ไม่ใช่ miss — แต่ตัด combo และรีเซ็ตตัวจับเวลา avoid_junk
        const ctx2=this._ctx; ctx2.combo=0; ctx2.lastWasJunk=true; ctx2.noJunkSeconds=0;
      }
      else if(type==='fever'){
        this._ctx.fever = !!payload.on;
      }
      refreshHUD();
    },
    tick({score,dt,fever}){
      const ctx=this._ctx; if(!ctx) return;
      ctx.dt = dt|0;
      ctx.score = score|0;
      // นับเวลาหลีกเลี่ยง junk: ถ้าไม่ได้คลิก junk ล่าสุด ให้สะสม
      if(!ctx.lastWasJunk) ctx.noJunkSeconds = (ctx.noJunkSeconds|0) + (dt|0);

      for(const q of active){
        if(q.done||q.fail) continue;
        const def=q._def;
        // สำหรับ quest แบบเวลาหรือจากสถานะ
        if(def.onTick){
          const inc = def.onTick(score, { dt:(dt|0), fever:!!fever, combo:ctx.combo|0, comboMax:ctx.comboMax|0, score:ctx.score|0, need:q.need, progress:q.progress, noJunkSeconds:ctx.noJunkSeconds|0 });
          if(inc>0 && active.indexOf(q)===focusIdx) addProgress(q, inc);
        }
      }

      refreshHUD();
    }
  };
})();
