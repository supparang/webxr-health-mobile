// === /herohealth/vr-groups/ai-dl-director.js ===
// AI Director + Coach (uses groups:risk from dl-infer.js or ml-online.js)
// ✅ Enable: run=play AND ai=1
// ✅ Smooth risk (EMA) + rate-limit adjustments
// ✅ Calls: GroupsVR.GameEngine.setAIDirector(...)
// ✅ Emits: hha:coach micro-tips (explainable)

(function(){
  'use strict';
  const WIN = window;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const nowMs=()=> (performance && performance.now) ? performance.now() : Date.now();

  function runMode(){
    const r = String(qs('run','play')||'play').toLowerCase();
    if (r==='research'||r==='practice') return r;
    return 'play';
  }
  function enabled(){
    if (runMode()!=='play') return false;
    const on = String(qs('ai','0')||'0').toLowerCase();
    return (on==='1'||on==='true');
  }
  function emitCoach(text,mood){
    try{ WIN.dispatchEvent(new CustomEvent('hha:coach',{detail:{text, mood:mood||'neutral'}})); }catch(_){}
  }

  let ema=0.25;
  let lastAdj=0;
  let lastTip=0;

  function applyDirector(level, reason){
    const E = WIN.GroupsVR && WIN.GroupsVR.GameEngine;
    if (!E || !E.setAIDirector) return;

    // แนว “ยุติธรรม”: เสี่ยงสูง -> ช้าลงนิด + ลด junk/wrong เล็กน้อย
    // เสี่ยงต่ำ -> คืนความท้าทายเบา ๆ
    let intervalMul=1.0, wrongAdd=0.0, junkAdd=0.0;

    if (level===3){
      intervalMul=1.16; wrongAdd=-0.035; junkAdd=-0.020;
    }else if (level===2){
      intervalMul=1.10; wrongAdd=-0.020; junkAdd=-0.010;
    }else if (level===1){
      intervalMul=1.04; wrongAdd=-0.010; junkAdd=-0.005;
    }else{
      intervalMul=0.98; wrongAdd=+0.005; junkAdd=+0.004;
    }

    E.setAIDirector({ enabled:true, intervalMul, wrongAdd, junkAdd });
  }

  function tip(level){
    const t=nowMs();
    if (t-lastTip<2300) return;
    lastTip=t;
    if (level===3) emitCoach('AI: เสี่ยงหลุด! ช้าลงนิด เล็งให้ตรงหมู่ก่อนยิง 👀', 'sad');
    else if (level===2) emitCoach('AI: ระวัง! เน้น “ถูกหมู่” ก่อนความเร็ว 🔥', 'fever');
    else if (level===1) emitCoach('AI: ดีอยู่! รักษาคอมโบไว้ แล้วค่อยเร่ง ✨', 'neutral');
  }

  WIN.addEventListener('groups:risk', (ev)=>{
    if (!enabled()) return;
    const d = ev.detail||{};
    const r = Math.max(0, Math.min(1, Number(d.risk||0)));
    // EMA smoothing
    ema = ema*0.72 + r*0.28;

    const level = (ema>=0.82)?3 : (ema>=0.62)?2 : (ema>=0.42)?1 : 0;

    const t=nowMs();
    if (t-lastAdj>1200){
      lastAdj=t;
      applyDirector(level, d.reason||'risk');
    }
    tip(level);
  }, {passive:true});

})();