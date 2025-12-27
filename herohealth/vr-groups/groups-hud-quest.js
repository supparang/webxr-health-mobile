/* === /herohealth/vr-groups/groups-hud-quest.js ===
Food Groups VR — HUD binder for quest/power/score/rank/time/group
✅ รับ quest:update แล้วอัปเดต: goal/mini title + val + bar + mini timer
✅ รับ hha:score/hha:rank/hha:time/groups:group_change/groups:power
*/
(function(root){
  'use strict';
  const DOC = root.document; if(!DOC) return;

  const $ = (id)=> DOC.getElementById(id);

  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail || {};
    if ($('hud-score')) $('hud-score').textContent = (d.score|0);
    if ($('hud-combo')) $('hud-combo').textContent = (d.combo|0);
    if ($('hud-miss'))  $('hud-miss').textContent  = (d.misses|0);
    if ($('hud-comboMax')) $('hud-comboMax').textContent = (d.comboMax|0);
  }, { passive:true });

  root.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail || {};
    if (d.grade && $('hud-rank')) $('hud-rank').textContent = d.grade;
    if (typeof d.accuracy === 'number' && $('hud-acc')) $('hud-acc').textContent = (d.accuracy|0) + '%';
  }, { passive:true });

  root.addEventListener('hha:time', (ev)=>{
    const d = ev.detail || {};
    if ($('hud-time')) $('hud-time').textContent = (d.left|0);
  }, { passive:true });

  root.addEventListener('groups:group_change', (ev)=>{
    const d = ev.detail || {};
    if ($('hud-group')) $('hud-group').textContent = d.label || 'หมู่ ?';
  }, { passive:true });

  root.addEventListener('groups:power', (ev)=>{
    const d = ev.detail || {};
    const th = Math.max(1, d.threshold|0);
    const ch = Math.max(0, d.charge|0);
    const p = Math.min(100, (ch/th)*100);

    if ($('hud-powerFill')) $('hud-powerFill').style.width = p.toFixed(1) + '%';
    if ($('fg-powerText')) $('fg-powerText').textContent = `${ch}/${th}`;
  }, { passive:true });

  root.addEventListener('quest:update', (ev)=>{
    const q = ev.detail || {};
    // goal
    if ($('hud-goal-title')) $('hud-goal-title').textContent = q.goalTitle || q.line1 || '—';
    if ($('hud-goal-val')) $('hud-goal-val').textContent = q.goalProgressText || '0/0';
    if ($('hud-goal-bar')) $('hud-goal-bar').style.width = (q.goalProgressPct ?? 0) + '%';

    // mini
    if ($('hud-mini-title')) $('hud-mini-title').textContent = q.miniTitle || q.line2 || '—';
    if ($('hud-mini-val')) $('hud-mini-val').textContent = q.miniProgressText || '0/0';
    if ($('hud-mini-bar')) $('hud-mini-bar').style.width = (q.miniProgressPct ?? 0) + '%';

    // timer
    const tEl = $('hud-mini-timer');
    if (tEl){
      tEl.textContent = q.miniTimerText || '';
      tEl.classList.toggle('urgent', !!q.miniUrgent);
    }
  }, { passive:true });
})(window);
