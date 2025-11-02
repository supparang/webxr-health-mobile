// === core/quests.js — 10 Mini Quests (random 3, focus ทีละอัน) + HUD chips + summary ===
'use strict';

export const Quests = (function(){
  const state = {
    hud:null, coach:null, lang:'TH',
    selected:[], activeIdx:0,
    hitsGold:0, penalties:0, misses:0,
    feverOn:false, feverSec:0,
    timeSec:0, // run time
  };

  // 10 เควสต์
  const ALL = [
    { key:'tap_good_20',   icon:'✅', label:'แตะของดี 20 ครั้ง',       need:20, onHit:(e,q)=>{ if(e.result==='good'||e.result==='perfect'||e.result==='gold'){ q.progress++; } } },
    { key:'perfect_5',     icon:'💎', label:'Perfect 5 ครั้ง',          need:5,  onHit:(e,q)=>{ if(e.result==='perfect'){ q.progress++; } } },
    { key:'gold_3',        icon:'⭐', label:'เก็บ Gold 3 อัน',          need:3,  onHit:(e,q,s)=>{ if(e.meta?.gold || e.result==='gold'){ q.progress++; s.hitsGold++; s.hud?.setStars?.(s.hitsGold); } } },
    { key:'combo_10',      icon:'🔥', label:'คอมโบถึง 10',              need:1,  onHit:(e,q)=>{ if((e.comboNow|0)>=10){ q.progress=1; } } },
    { key:'combo_20',      icon:'⚡', label:'คอมโบถึง 20',              need:1,  onHit:(e,q)=>{ if((e.comboNow|0)>=20){ q.progress=1; } } },
    { key:'fever_on',      icon:'💥', label:'เข้า FEVER 1 ครั้ง',        need:1,  onFever:(on,q)=>{ if(on){ q.progress=1; } } },
    { key:'fever_5s',      icon:'⏳', label:'รักษา FEVER 5 วินาที',      need:5,  onTick:(_,q,s){ if(s.feverOn){ q.progress=Math.min(q.need, q.progress+1); } } },
    { key:'time_20s',      icon:'🕑', label:'เล่นครบ 20 วินาที',        need:20, onTick:(_,q,s){ q.progress=Math.min(q.need, s.timeSec); } },
    { key:'score_1500',    icon:'🏅', label:'คะแนนถึง 1500',            need:1,  onHit:(e,q)=>{ if((e.pointsRun||0)>=1500){ q.progress=1; } } },
    // เลี่ยง junk 12 วินาที: โฟกัสช่วงเวลาที่ active (โดน penalty รีเซ็ต)
    { key:'avoid_junk_12s',icon:'🛡️', label:'เลี่ยง Junk 12 วินาที',   need:12, onTick:(_,q,s){ if(s._nojunkTimer==null) s._nojunkTimer=0; q.progress=Math.min(q.need, Math.floor(s._nojunkTimer)); } , onPenalty:(_,q,s){ s._nojunkTimer=0; } , onHit:(_,q,s){ s._nojunkTimer=(s._nojunkTimer||0); }, onMiss:(_,q,s){ /* miss good ไม่เกี่ยวกับ junk; ไม่รีเซ็ต */ } }
  ];

  function pick3(){ // สุ่ม 3 อันไม่ซ้ำ
    const src=[...ALL]; const out=[];
    for(let i=0;i<3;i++){ const idx=(Math.random()*src.length)|0; out.push(struct(src.splice(idx,1)[0])); }
    return out;
  }
  function struct(q){ return { key:q.key, icon:q.icon, label:q.label, need:q.need, progress:0, done:false, fail:false, _ref:q }; }

  function refresh(){
    // โฟกัสเฉพาะอันที่ active
    const view = state.selected.map((q,i)=>({ key:q.key, icon:q.icon, label:q.label, need:q.need, progress:q.progress, done:q.done, fail:q.fail, active:i===state.activeIdx }));
    state.hud?.setQuestChips?.(view);
    state.hud?.setStars?.(state.hitsGold|0);
  }

  function nextIfDone(){
    const q = state.selected[state.activeIdx];
    if(q && !q.done && q.progress>=q.need){ q.done=true; state.coach?.say?.('เควสต์สำเร็จ!'); state.activeIdx++; refresh(); }
  }

  return {
    bindToMain({hud,coach}){ state.hud=hud; state.coach=coach; return { refresh }; },
    beginRun(mode,diff,lang,matchTime){
      state.lang=(lang||'TH').toUpperCase();
      state.selected = pick3();
      state.activeIdx = 0;
      state.hitsGold=0; state.penalties=0; state.misses=0; state.feverOn=false; state.feverSec=0; state.timeSec=0; state._nojunkTimer=0;
      refresh();
    },
    event(type,payload){
      const i = state.activeIdx;
      const cur = state.selected[i];
      if(!cur) return;

      // เก็บคะแนนรวมเพื่อพิจารณา quest คะแนน
      if(payload && type==='hit'){ payload.pointsRun = (payload.pointsRun||0); }

      switch(type){
        case 'hit':{
          const q=cur._ref;
          // ทุกเหตุการณ์จะไหลเข้าเฉพาะเควสต์ที่กำลัง active เท่านั้น
          q.onHit && q.onHit(payload, cur, state);
          // อัปเดตตัวแปรช่วย
          if(payload?.meta?.gold || payload?.result==='gold'){ state.hitsGold++; }
          refresh(); nextIfDone();
          break;
        }
        case 'miss':{
          state.misses++;
          const q=cur._ref; q.onMiss && q.onMiss(payload, cur, state);
          refresh(); nextIfDone();
          break;
        }
        case 'penalty':{
          state.penalties++;
          const q=cur._ref; q.onPenalty && q.onPenalty(payload, cur, state);
          refresh(); nextIfDone();
          break;
        }
        case 'fever':{
          state.feverOn = !!payload?.on;
          const q=cur._ref; q.onFever && q.onFever(state.feverOn, cur, state);
          refresh(); nextIfDone();
          break;
        }
        case 'power':{
          // ไม่ทำอะไรเป็นพิเศษ ที่นี่
          break;
        }
      }
    },
    tick({dt=1, fever}){
      state.timeSec += dt;
      if(fever!=null) state.feverOn = !!fever;
      if(state.feverOn) state.feverSec += dt;
      // no-junk timer (เฉพาะเวลาที่ quest นี้ active เท่านั้น)
      const cur = state.selected[state.activeIdx];
      if(cur && cur.key==='avoid_junk_12s'){ state._nojunkTimer = (state._nojunkTimer||0) + dt; }

      // ส่งให้ quest ที่กำลัง active เท่านั้น
      if(cur && cur._ref && cur._ref.onTick){ cur._ref.onTick({dt}, cur, state); }
      refresh(); nextIfDone();
    },
    endRun({score}){
      // สรุป
      const totalDone = state.selected.filter(q=>q.done).length;
      const starsByScore = score>=2500?3 : score>=1800?2 : score>=1200?1 : 0;
      const stars = Math.min(5, starsByScore + totalDone); // รวมดาวจากเควสต์
      const out = {
        totalDone, stars
