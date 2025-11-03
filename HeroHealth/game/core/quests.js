// === core/quests.js (Fixed active-one-at-a-time mode) ===
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
    { key:'score_600', icon:'🏆', label:'ทำคะแนน 600', needByDiff:{Easy:450,Normal:600,Hard:800},
      onTick:(s,ctx)=> (ctx.score>=ctx.need)? (ctx.need-ctx.progress):0 },
    { key:'gold_5',    icon:'⭐', label:'เก็บ GOLD 5 ชิ้น', needByDiff:{Easy:4,Normal:5,Hard:6},
      onHit:(e)=> e.kind==='gold'?1:0 },
    { key:'streak_10', icon:'🔗', label:'Streak 10', needByDiff:{Easy:8,Normal:10,Hard:12},
      onTick:(_s,ctx)=> ctx.combo>=ctx.need? (ctx.need-ctx.progress):0 },
  ];

  let HUD=null, COACH=null, active=[], focusIdx=0, diff='Normal', secTotal=45;

  const diffNeed = (def)=> def.needByDiff?.[diff] ?? def.needByDiff?.Normal ?? 1;

  function pick3(){
    const k = [...QUEST_DEFS];
    for(let i=k.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [k[i],k[j]]=[k[j],k[i]]; }
    return k.slice(0,3).map(d=>({
      key:d.key, icon:d.icon, label:d.label, need:diffNeed(d),
      progress:0, done:false, fail:false, _def:d, active:false
    }));
  }

  function refreshHUD(){
    const list = active.map((q,i)=>({
      key:q.key, label:q.label, icon:q.icon,
      need:q.need, progress:q.progress, done:q.done, fail:q.fail, active:i===focusIdx
    }));
    HUD?.setQuestChips(list);
  }

  function ensureFocus(){
    // move to next unfinished quest
    while(focusIdx<active.length && (active[focusIdx].done||active[focusIdx].fail))
      focusIdx++;
    if(focusIdx>=active.length) focusIdx = active.length-1;
    refreshHUD();
  }

  function addProgress(q,inc){
    if(q.done||q.fail) return;
    q.progress += inc;
    if(q.progress>=q.need){
      q.progress=q.need; q.done=true;
      COACH?.say('เควสต์สำเร็จ!');
      // switch to next quest
      focusIdx++;
      if(focusIdx<active.length){
        COACH?.say('ต่อไป ภารกิจถัดไป!');
      } else {
        COACH?.say('เควสต์ทั้งหมดเสร็จสิ้น!');
      }
      ensureFocus();
    }
    refreshHUD();
  }

  return {
    bindToMain({hud,coach}){ HUD=hud; COACH=coach; return {refresh:refreshHUD}; },
    beginRun(modeKey,difficulty,lang,seconds){
      diff=String(difficulty||'Normal'); secTotal=seconds|0;
      active=pick3(); focusIdx=0;
      active[0].active=true;
      COACH?.say('ภารกิจเริ่ม! ทำอันแรกให้สำเร็จ!');
      refreshHUD();
      this._ctx={ combo:0, comboMax:0, score:0, fever:false };
    },
    endRun({_score}={}) {
      const done = active.filter(q=>q.done).map(q=>q.key);
      const lines = active.map((q)=>`${q.done?'✅':'❌'} ${q.label} — ${q.progress}/${q.need}`);
      return { done, lines, totalDone: done.length };
    },
    event(type,payload={}){
      const ctx=this._ctx||{};
      const q = active[focusIdx]; if(!q||q.done) return;
      const def=q._def;
      if(type==='hit' && def.onHit){
        const inc=def.onHit({kind:payload.kind},ctx)|0;
        if(inc>0) addProgress(q,inc);
      } else if(type==='fever' && def.onFever){
        const inc=def.onFever(payload.on,ctx)|0;
        if(inc>0) addProgress(q,inc);
      } else if(type==='junk'){ ctx.combo=0; }
    },
    tick({score,dt,fever}){
      const ctx=this._ctx; if(!ctx) return;
      ctx.score=score|0; ctx.dt=dt|0;
      const q=active[focusIdx]; if(!q||q.done) return;
      const def=q._def;
      if(def.onTick){
        const inc=def.onTick(score,{combo:ctx.combo,comboMax:ctx.comboMax,score:ctx.score,need:q.need,progress:q.progress,fever})|0;
        if(inc>0) addProgress(q,inc);
      }
    }
  };
})();
