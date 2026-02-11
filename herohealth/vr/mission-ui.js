// === /herohealth/vr/mission-ui.js ===
// Universal Mission UI (Planner-aware) — v20260210a
(function(){
  'use strict';
  const WIN = window, DOC = document;
  if(!DOC) return;

  const RP = WIN.HHA_RP;
  const combo = RP?.ctx?.combo || [];
  const fromPlanner = !!RP?.ctx?.fromPlanner;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }
  function normSet(arr){ return new Set((arr||[]).map(String)); }

  // mission spec from combo
  function missionFromCombo(combo){
    const s = normSet(combo);
    if(s.has('balance')) return { id:'balance_focus', title:'⚖️ ทรงตัวให้ครบ 2 รอบ', need:2, metric:'hold_ok' };
    if(s.has('jump') || s.has('duck')) return { id:'jumpduck_focus', title:'🦘 ทำ Jump/Duck ให้ครบ 6 ครั้ง', need:6, metric:'move_ok' };
    if(s.has('punch_rhythm')) return { id:'rhythm_focus', title:'🎵 ตีตามจังหวะให้ได้ streak 5', need:5, metric:'streak' };
    return { id:'shadow_focus', title:'🥊 ตีเป้าให้แม่น 10 ครั้ง', need:10, metric:'hit_ok' };
  }

  const M = missionFromCombo(combo);

  // UI
  const wrap = DOC.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.left = '10px';
  wrap.style.top = 'calc(52px + env(safe-area-inset-top, 0px))';
  wrap.style.zIndex = '9999';
  wrap.style.maxWidth = 'min(92vw, 420px)';
  wrap.style.pointerEvents = 'none';
  wrap.style.border = '1px solid rgba(148,163,184,.18)';
  wrap.style.background = 'rgba(2,6,23,.58)';
  wrap.style.borderRadius = '16px';
  wrap.style.padding = '10px 12px';
  wrap.style.color = '#e5e7eb';
  wrap.style.font = '900 12px/1.25 system-ui, -apple-system, Segoe UI, Roboto, Arial';
  wrap.style.boxShadow = '0 10px 28px rgba(0,0,0,.28)';

  const title = DOC.createElement('div');
  title.textContent = `🎯 Mission: ${M.title}`;

  const bar = DOC.createElement('div');
  bar.style.height = '8px';
  bar.style.borderRadius = '999px';
  bar.style.marginTop = '8px';
  bar.style.background = 'rgba(148,163,184,.18)';
  bar.style.overflow = 'hidden';

  const fill = DOC.createElement('div');
  fill.style.height = '100%';
  fill.style.width = '0%';
  fill.style.background = 'rgba(34,197,94,.65)';
  fill.style.borderRadius = '999px';

  const hint = DOC.createElement('div');
  hint.style.marginTop = '6px';
  hint.style.color = 'rgba(148,163,184,1)';
  hint.style.fontWeight = '900';
  hint.textContent = fromPlanner ? 'มาจาก Planner: ทำภารกิจนี้เพื่อโบนัส!' : 'ทำภารกิจนี้เพื่อโบนัส!';

  bar.appendChild(fill);
  wrap.appendChild(title);
  wrap.appendChild(bar);
  wrap.appendChild(hint);
  DOC.body.appendChild(wrap);

  // state
  let prog = 0;
  let done = false;
  let bestStreak = 0;

  function setProg(v){
    prog = clamp(v, 0, M.need);
    const p = clamp((prog / M.need) * 100, 0, 100);
    fill.style.width = p.toFixed(1) + '%';
    hint.textContent = done ? '✅ สำเร็จ! รับโบนัสแล้ว' : `ความคืบหน้า: ${prog}/${M.need}`;
  }

  function fireDone(){
    if(done) return;
    done = true;
    setProg(M.need);
    try{
      if(RP?.ev){
        RP.ev('mission_done', { missionId: M.id, bonus: RP.IS_RESEARCH ? 0 : 15 });
      }
    }catch(e){}
    // auto-hide after success
    setTimeout(()=>{ try{ wrap.remove(); }catch(e){} }, 4500);
  }

  // Public hooks that games can call:
  // - HHA_MISSION.noteHitOk()
  // - HHA_MISSION.noteMoveOk()
  // - HHA_MISSION.noteHoldOk()
  // - HHA_MISSION.noteStreak(n)
  const API = {
    id: M.id,
    need: M.need,
    metric: M.metric,
    noteHitOk(){
      if(done || M.metric !== 'hit_ok') return;
      setProg(prog + 1);
      RP?.ev?.('mission_progress', { missionId:M.id, prog, need:M.need });
      if(prog >= M.need) fireDone();
    },
    noteMoveOk(){
      if(done || M.metric !== 'move_ok') return;
      setProg(prog + 1);
      RP?.ev?.('mission_progress', { missionId:M.id, prog, need:M.need });
      if(prog >= M.need) fireDone();
    },
    noteHoldOk(){
      if(done || M.metric !== 'hold_ok') return;
      setProg(prog + 1);
      RP?.ev?.('mission_progress', { missionId:M.id, prog, need:M.need });
      if(prog >= M.need) fireDone();
    },
    noteStreak(n){
      if(done || M.metric !== 'streak') return;
      const nn = Math.max(bestStreak, Number(n)||0);
      bestStreak = nn;
      setProg(bestStreak);
      RP?.ev?.('mission_progress', { missionId:M.id, prog:bestStreak, need:M.need });
      if(bestStreak >= M.need) fireDone();
    }
  };

  WIN.HHA_MISSION = API;

  // log init
  try{
    RP?.ev?.('mission_init', { missionId:M.id, title:M.title, need:M.need, metric:M.metric, fromPlanner });
  }catch(e){}
})();