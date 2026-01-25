// === /herohealth/vr-groups/groups-quests.js ===
// Quests Helper — PRODUCTION (Safe / Non-breaking)
// ✅ ไม่ไปยุ่ง engine logic (เพราะ groups.safe.js ทำ quest อยู่แล้ว)
// ✅ ทำหน้าที่เป็น "ตัวช่วย" เก็บสถานะ goal/mini ล่าสุด + ส่ง event เสริมให้ UI/อนาคต
// ✅ Safe: มีหรือไม่มีก็ไม่ทำให้เกมพัง

(function(){
  'use strict';
  const WIN = window;
  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});

  const STATE = {
    lastQuest: null,
    lastGroupKey: '',
    lastGoalPct: 0,
    lastMiniPct: 0
  };

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  WIN.addEventListener('quest:update', (ev)=>{
    const d = ev.detail || {};
    STATE.lastQuest = d;

    const gk = String(d.groupKey || '');
    if (gk && gk !== STATE.lastGroupKey){
      STATE.lastGroupKey = gk;
      emit('groups:quest_info', { kind:'group_change', groupKey:gk, groupName:String(d.groupName||'') });
    }

    const gp = Number(d.goalPct ?? 0) || 0;
    const mp = Number(d.miniPct ?? 0) || 0;

    // milestones (optional)
    if (gp >= 100 && STATE.lastGoalPct < 100){
      emit('groups:quest_info', { kind:'goal_clear', goalIndex:d.goalIndex, goalsTotal:d.goalsTotal });
    }
    if (mp >= 100 && STATE.lastMiniPct < 100){
      emit('groups:quest_info', { kind:'mini_clear' });
    }

    STATE.lastGoalPct = gp;
    STATE.lastMiniPct = mp;

  }, {passive:true});

  NS.Quests = {
    getLast(){ return STATE.lastQuest; }
  };

})();