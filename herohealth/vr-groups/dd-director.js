/* === /herohealth/vr-groups/dd-director.js ===
DD Director (lightweight)
✅ Consumes groups:ai_feature (risk + stats)
✅ Emits groups:dd_suggest {spawnMul, sizeMul, wrongDelta, junkDelta, lifeMul, why}
✅ Applies only when enabled by ai-hooks (gating is there)
*/
(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  let ON = false;
  let last = null;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function suggest(f){
    // f: {r, missRate, accBad, comboN, leftLow, storm, miniUrg}
    const r = clamp(f.r, 0, 1);
    const missRate = clamp(f.missRate, 0, 1);
    const accBad   = clamp(f.accBad, 0, 1);
    const comboN   = clamp(f.comboN, 0, 1);
    const leftLow  = clamp(f.leftLow, 0, 1);
    const storm    = !!f.storm;
    const miniUrg  = !!f.miniUrg;

    // เป้าหมาย: “ยุติธรรม” ไม่ให้ยากเกินเมื่อกำลังพลาดถี่
    // spawnMul <1 = spawn ถี่ขึ้น, >1 = ช้าลง
    let spawnMul = 1.0;
    let sizeMul  = 1.0;
    let lifeMul  = 1.0;
    let wrongDelta = 0.0;
    let junkDelta  = 0.0;
    let why = 'steady';

    if (r >= 0.78){
      spawnMul = 1.10;      // ช้าลงเล็กน้อย
      sizeMul  = 1.06;      // เป้าใหญ่ขึ้น
      lifeMul  = 1.08;      // อยู่นานขึ้น
      wrongDelta = -0.02;   // ลดหลอก
      junkDelta  = -0.02;   // ลดขยะ
      why = 'protect';
    } else if (r >= 0.55){
      spawnMul = 1.03;
      sizeMul  = 1.03;
      lifeMul  = 1.03;
      wrongDelta = -0.01;
      junkDelta  = -0.01;
      why = 'assist';
    } else {
      // เล่นดี: เพิ่มความท้าทายเบา ๆ
      if (comboN >= 0.7 && accBad <= 0.2 && missRate <= 0.15){
        spawnMul = 0.94;
        sizeMul  = 0.98;
        lifeMul  = 0.96;
        wrongDelta = +0.01;
        junkDelta  = +0.01;
        why = 'challenge';
      }
    }

    // ช่วง miniUrg: อย่าเร่งถี่เกิน
    if (miniUrg){
      spawnMul = Math.max(spawnMul, 1.02);
      why = (why==='challenge') ? 'mini_guard' : why;
    }

    // storm: อย่าซ้ำเติม
    if (storm){
      spawnMul = Math.max(spawnMul, 1.05);
      sizeMul  = Math.max(sizeMul, 1.02);
      why = (why==='challenge') ? 'storm_guard' : why;
    }

    return {
      spawnMul: Math.round(spawnMul*100)/100,
      sizeMul: Math.round(sizeMul*100)/100,
      lifeMul: Math.round(lifeMul*100)/100,
      wrongDelta: Math.round(wrongDelta*100)/100,
      junkDelta: Math.round(junkDelta*100)/100,
      why
    };
  }

  function emitDD(d){
    last = d;
    try{ root.dispatchEvent(new CustomEvent('groups:dd_suggest', { detail:d })); }catch(_){}
  }

  function onFeature(ev){
    if (!ON) return;
    const f = ev.detail || {};
    emitDD(suggest(f));
  }

  root.addEventListener('groups:ai_feature', onFeature, {passive:true});

  NS.DDDirector = {
    start: ()=>{ ON=true; },
    stop: ()=>{ ON=false; },
    getLast: ()=>last
  };
})(typeof window!=='undefined'?window:globalThis);