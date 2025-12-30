// === /herohealth/plate/plate-hud.js ===
// Plate HUD Binder — SAFE/OPTIONAL (doesn't fight plate.safe.js)
// ✅ ฟัง event กลาง: hha:score, quest:update, hha:coach, hha:judge, hha:end
// ✅ ถ้า element ไม่มี -> ข้าม
// ✅ ไม่แก้เกมลอจิก แค่ช่วย sync UI เผื่ออนาคต

(function (root){
  'use strict';
  const doc = root.document;
  if(!doc) return;

  const $ = (id)=>doc.getElementById(id);

  function setText(id, v){
    const el = $(id);
    if(el) el.textContent = String(v);
  }

  function safe(e){
    try{ return e && e.detail ? e.detail : null; }catch(_){ return null; }
  }

  // score sync
  root.addEventListener('hha:score', (ev)=>{
    const d = safe(ev);
    if(!d || d.game !== 'plate') return;
    // plate.safe.js ทำอยู่แล้ว แต่ sync เผื่อบางจุด
    if(d.timeLeftSec != null) setText('uiTime', Math.ceil(d.timeLeftSec));
    if(d.grade != null) setText('uiGrade', d.grade);
    if(d.accuracyGoodPct != null) setText('uiAcc', Math.round(d.accuracyGoodPct) + '%');
  }, { passive:true });

  // quest sync
  root.addEventListener('quest:update', (ev)=>{
    const d = safe(ev);
    if(!d || d.game !== 'plate') return;
    if(d.goal){
      setText('uiGoalTitle', d.goal.title || '—');
      setText('uiGoalCount', `${d.goal.cur||0}/${d.goal.target||0}`);
    }
    if(d.mini){
      setText('uiMiniTitle', d.mini.title || '—');
      if(d.mini.cur != null && d.mini.target != null){
        setText('uiMiniCount', `${d.mini.cur}/${d.mini.target}`);
      }
      if(d.mini.timeLeft != null){
        setText('uiMiniTime', Math.ceil(d.mini.timeLeft) + 's');
      }
    }
  }, { passive:true });

  // coach sync
  root.addEventListener('hha:coach', (ev)=>{
    const d = safe(ev);
    if(!d || d.game !== 'plate') return;
    if(d.msg) setText('coachMsg', d.msg);
    const img = $('coachImg');
    if(img && d.mood){
      const map = {
        happy: './img/coach-happy.png',
        neutral:'./img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      img.src = map[d.mood] || map.neutral;
    }
  }, { passive:true });

  // judge (optional toast-ish)
  root.addEventListener('hha:judge', (ev)=>{
    const d = safe(ev);
    if(!d || d.game !== 'plate') return;
    // ถ้าต้องการต่อยอดทำ toast ภายหลังค่อยทำ (ตอนนี้ไม่รบกวน UI)
  }, { passive:true });

  // end
  root.addEventListener('hha:end', (ev)=>{
    const d = safe(ev);
    if(!d || d.game !== 'plate') return;
    // nothing: plate.safe.js จัด summary overlay ให้แล้ว
  }, { passive:true });

})(window);