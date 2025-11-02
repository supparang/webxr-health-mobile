// === core/quests.js — 10 Mini Quests (สุ่ม 3, โฟกัสทีละอัน) + HUD chips + full summary ===
'use strict';

export const Quests = (function(){
  const st = {
    hud:null, coach:null, lang:'TH',
    selected:[], activeIdx:0,
    hitsGold:0, penalties:0, misses:0,
    feverOn:false, feverSec:0,
    timeSec:0,         // เวลาที่วิ่งไปจริง
    maxComboSeen:0,    // เผื่อใช้ต่อยอด
    _nojunkTimer:0     // ตัวจับเวลาเควสต์หลบ junk
  };

  // เควสต์ทั้งหมด (10 แบบ)
  const ALL = [
    { key:'tap_good_20',   icon:'✅', label:'แตะของดี 20 ครั้ง',    need:20,
      onHit:(e,q)=>{ if(e.result==='good'||e.result==='perfect'||e.result==='gold') q.progress++; } },

    { key:'perfect_5',     icon:'💎', label:'Perfect 5 ครั้ง',       need:5,
      onHit:(e,q)=>{ if(e.result==='perfect') q.progress++; } },

    { key:'gold_3',        icon:'⭐', label:'เก็บ Gold 3 อัน',       need:3,
      onHit:(e,q,s)=>{ if(e.meta?.gold || e.result==='gold'){ q.progress++; s.hitsGold++; s.hud?.setStars?.(s.hitsGold); } } },

    { key:'combo_10',      icon:'🔥', label:'คอมโบถึง 10',           need:1,
      onHit:(e,q)=>{ if((e.comboNow|0)>=10) q.progress=1; } },

    { key:'combo_20',      icon:'⚡', label:'คอมโบถึง 20',           need:1,
      onHit:(e,q)=>{ if((e.comboNow|0)>=20) q.progress=1; } },

    { key:'fever_on',      icon:'💥', label:'เข้า FEVER 1 ครั้ง',     need:1,
      onFever:(on,q)=>{ if(on) q.progress=1; } },

    { key:'fever_5s',      icon:'⏳', label:'รักษา FEVER 5 วินาที',   need:5,
      onTick:(_e,q,s)=>{ if(s.feverOn) q.progress=Math.min(q.need, q.progress+1); } },

    { key:'time_20s',      icon:'🕑', label:'เล่นครบ 20 วินาที',     need:20,
      onTick:(_e,q,s)=>{ q.progress=Math.min(q.need, Math.floor(s.timeSec)); } },

    { key:'score_1500',    icon:'🏅', label:'คะแนนถึง 1500',         need:1,
      onHit:(e,q)=>{ if((e.pointsRun||0)>=1500) q.progress=1; } },

    { key:'avoid_junk_12s',icon:'🛡️', label:'เลี่ยง Junk 12 วินาที', need:12,
      onTick:(_e,q,s)=>{ if(s._nojunkTimer==null) s._nojunkTimer=0; q.progress=Math.min(q.need, Math.floor(s._nojunkTimer)); },
      onPenalty:(_e,_q,s)=>{ s._nojunkTimer=0; } }
  ];

  // โครงสร้างภายในของเควสต์ที่เลือก
  function wrap(q){ return { key:q.key, icon:q.icon, label:q.label, need:q.need, progress:0, done:false, fail:false, _ref:q }; }

  // สุ่ม 3 เควสต์
  function pick3(){
    const bag=[...ALL], out=[];
    for(let i=0;i<3;i++){
      const ix=(Math.random()*bag.length)|0;
      out.push(wrap(bag.splice(ix,1)[0]));
    }
    return out;
  }

  function refresh(){
    const view = st.selected.map((q,i)=>({
      key:q.key, icon:q.icon, label:q.label, need:q.need,
      progress:q.progress, done:q.done, fail:q.fail, active:i===st.activeIdx
    }));
    st.hud?.setQuestChips?.(view);
    st.hud?.setStars?.(st.hitsGold|0);
  }

  function nextIfDone(){
    const cur = st.selected[st.activeIdx];
    if(cur && !cur.done && cur.progress>=cur.need){
      cur.done=true;
      st.coach?.say?.('เควสต์สำเร็จ!');
      st.activeIdx++;
      refresh();
    }
  }

  return {
    // main เรียกตอนเริ่ม
    bindToMain({hud,coach}){ st.hud=hud; st.coach=coach; return { refresh }; },

    beginRun(mode,diff,lang,_matchTime){
      st.lang=(lang||'TH').toUpperCase();
      st.selected = pick3();
      st.activeIdx=0;
      st.hitsGold=0; st.penalties=0; st.misses=0;
      st.feverOn=false; st.feverSec=0; st.timeSec=0; st._nojunkTimer=0;
      st.maxComboSeen=0;
      refresh();
    },

    // event ที่มาจาก main/mode
    event(type,payload={}){
      // เก็บค่าช่วย
      if(type==='hit'){
        if((payload.comboNow|0) > st.maxComboSeen) st.maxComboSeen = payload.comboNow|0;
        if(payload.meta?.gold) st.hitsGold++;
      }
      if(type==='miss') st.misses++;
      if(type==='penalty') st.penalties++;

      const cur = st.selected[st.activeIdx];
      if(!cur){ refresh(); return; }

      // ส่งเข้าเฉพาะเควสต์ที่ active เท่านั้น
      switch(type){
        case 'hit':     cur._ref.onHit     && cur._ref.onHit(payload, cur, st); break;
        case 'miss':    cur._ref.onMiss    && cur._ref.onMiss(payload, cur, st); break;
        case 'penalty': cur._ref.onPenalty && cur._ref.onPenalty(payload, cur, st); break;
        case 'fever':
          st.feverOn = !!payload.on;
          cur._ref.onFever && cur._ref.onFever(st.feverOn, cur, st);
          break;
        case 'power':
          // ไม่บังคับทำอะไรเป็นพิเศษ
          break;
      }
      refresh(); nextIfDone();
    },

    // tick รายวินาที
    tick({dt=1, fever}){
      st.timeSec += dt;
      if(fever!=null) st.feverOn=!!fever;
      if(st.feverOn) st.feverSec += dt;

      // no-junk timer นับเฉพาะตอน quest นี้ active
      const cur = st.selected[st.activeIdx];
      if(cur && cur.key==='avoid_junk_12s'){ st._nojunkTimer = (st._nojunkTimer||0) + dt; }

      // onTick เฉพาะอันที่ active
      if(cur && cur._ref?.onTick){ cur._ref.onTick({dt}, cur, st); }
      refresh(); nextIfDone();
    },

    // ส่งสรุปให้ main ไปแสดงใน Result
    endRun({score=0}){
      const totalDone = st.selected.filter(q=>q.done).length;
      const starsByScore = score>=2500?3 : score>=1800?2 : score>=1200?1 : 0;
      const stars = Math.min(5, starsByScore + totalDone);

      // แพ็กข้อมูลเต็มสำหรับ Result
      return {
        totalDone,
        stars,
        hitsGold: st.hitsGold|0,
        penalties: st.penalties|0,
        misses: st.misses|0,
        feverSec: Math.round(st.feverSec|0),
        timeSec: Math.round(st.timeSec|0),
        maxCombo: st.maxComboSeen|0,
        selected: st.selected.map(q=>({
          key:q.key, label:q.label, need:q.need, progress:q.progress, done:q.done, fail:q.fail
        }))
      };
    }
  };
})();
