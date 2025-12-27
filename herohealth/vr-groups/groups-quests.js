/* === /herohealth/vr-groups/groups-quests.js ===
Food Groups VR — Quest/Coach (simple, classic)
✅ รับ groups:quest_state จาก Engine แล้วกระจายเป็น quest:update + hha:coach (กลาง)
*/
(function(root){
  'use strict';
  const DOC = root.document; if(!DOC) return;

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(e){}
  }

  function showCoach(face, text, sub){
    // direct DOM (optional)
    const b = DOC.getElementById('coach-bubble');
    const f = DOC.getElementById('coach-face');
    const t = DOC.getElementById('coach-text');
    const s = DOC.getElementById('coach-sub');
    if (f) f.textContent = String(face||'🥦');
    if (t) t.textContent = String(text||'');
    if (s) s.textContent = String(sub||'');
    if (b){
      b.classList.add('show');
      clearTimeout(showCoach._to);
      showCoach._to = setTimeout(()=> b.classList.remove('show'), 2400);
    }
    emit('hha:coach', { face, text, sub });
  }

  // From engine
  root.addEventListener('groups:quest_state', (ev)=>{
    const q = (ev && ev.detail) ? ev.detail : {};
    // translate to quest:update (HUD binder)
    emit('quest:update', q);

    // coach moments
    if (q.ping === 'goal_clear') showCoach('🤩','GOAL ผ่านแล้ว!','ไปต่อเป้าถัดไป — ระวังของหมู่อื่นนะ');
    if (q.ping === 'mini_start') showCoach('⚡','MINI เริ่ม!','รีบทำให้ทันเวลา + ห้ามพลาด');
    if (q.ping === 'mini_clear') showCoach('🥳','MINI CLEAR!','สวยมาก! เก่งจริง');
    if (q.ping === 'wrong_hit') showCoach('😵','โดนของหมู่อื่น!','โหดขึ้นแล้วนะ… ตั้งสติ');
    if (q.ping === 'boss_spawn') showCoach('👹','BOSS มาแล้ว!','ยิงรัว ๆ ให้ล้ม');
  }, { passive:true });
})(window);
