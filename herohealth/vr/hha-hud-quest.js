// === /herohealth/vr/hha-hud-quest.js ===
// Quest HUD Binder (IIFE) — listens quest:update and updates GOAL/MINI panel safely
// Works with GroupsVR (and other games if they emit quest:update in same schema)

(function(root){
  'use strict';

  const doc = root.document;
  if (!doc) return;

  if (root.GAME_MODULES && root.GAME_MODULES.HudQuest) return;

  function $(id){ return doc.getElementById(id); }
  function setTxt(el, t){ if(el) el.textContent = String(t==null?'':t); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function pct(prog, target){
    const p = Number(prog)||0;
    const t = Number(target)||0;
    if (t<=0) return 0;
    return clamp((p/t)*100, 0, 100);
  }

  function safeShow(el, on){
    if (!el) return;
    el.style.display = on ? '' : 'none';
  }

  function onQuestUpdate(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    const ok = !!d.questOk;

    const warn = $('qWarn');
    safeShow(warn, !ok);

    // Goal
    const g = d.goal || null;
    const gLabel = $('qGoalLabel');
    const gProg  = $('qGoalProg');
    const gBar   = $('qGoalBar');
    const gMeta  = $('qGoalMeta');

    if (!ok || !g){
      setTxt(gLabel, '—');
      setTxt(gProg, '0%');
      if (gBar) gBar.style.width = '0%';
    } else {
      const p = pct(g.prog, g.target);
      setTxt(gLabel, g.label || '—');
      setTxt(gProg, Math.round(p) + '%');
      if (gBar) gBar.style.width = p.toFixed(1) + '%';
    }

    // totals (for meta 0/0)
    const goalsAll = Array.isArray(d.goalsAll) ? d.goalsAll : [];
    const goalDone = goalsAll.filter(x=>x && x.done).length;
    const goalTot  = goalsAll.length || 0;
    setTxt(gMeta, goalDone + '/' + goalTot);

    // Mini
    const m = d.mini || null;
    const mLabel = $('qMiniLabel');
    const mProg  = $('qMiniProg');
    const mBar   = $('qMiniBar');
    const mMeta  = $('qMiniMeta');

    if (!ok || !m){
      setTxt(mLabel, '—');
      setTxt(mProg, '0%');
      if (mBar) mBar.style.width = '0%';
    } else {
      let p = pct(m.prog, m.target);

      // if has timer window, append time left
      if (typeof m.tLeft === 'number' && typeof m.windowSec === 'number' && m.windowSec>0){
        const sec = Math.max(0, Math.round(m.tLeft));
        setTxt(mLabel, (m.label||'—') + ' • เหลือ ' + sec + ' วิ');
      } else {
        setTxt(mLabel, m.label || '—');
      }

      setTxt(mProg, Math.round(p) + '%');
      if (mBar) mBar.style.width = p.toFixed(1) + '%';
    }

    const minisAll = Array.isArray(d.minisAll) ? d.minisAll : [];
    const miniDone = minisAll.filter(x=>x && x.done).length;
    const miniTot  = minisAll.length || 0;
    setTxt(mMeta, miniDone + '/' + miniTot);
  }

  root.addEventListener('quest:update', onQuestUpdate);

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.HudQuest = { onQuestUpdate };

})(window);
