// === /herohealth/plate/plate-hud.js ===
// Plate HUD Binder — SAFE (works even if some ids missing)
// Listens: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;
  if(root.__PLATE_HUD_BOUND__) return;
  root.__PLATE_HUD_BOUND__ = true;

  const $ = (id)=>DOC.getElementById(id);

  function setText(id, v){
    const el = $(id);
    if(el) el.textContent = String(v);
  }

  function setWidth(id, pct){
    const el = $(id);
    if(el) el.style.width = `${Math.max(0, Math.min(100, Number(pct)||0))}%`;
  }

  function fmtPct(x){
    x = Number(x)||0;
    return `${Math.round(x)}%`;
  }

  function onScore(e){
    const d = (e && e.detail) || {};
    if(d.game && d.game !== 'plate') return;

    if(d.score != null) setText('uiScore', d.score);
    if(d.combo != null) setText('uiCombo', d.combo);
    if(d.comboMax != null) setText('uiComboMax', d.comboMax);
    if(d.miss != null) setText('uiMiss', d.miss);

    if(d.plateHave != null) setText('uiPlateHave', d.plateHave);

    if(Array.isArray(d.gCount)){
      setText('uiG1', d.gCount[0]||0);
      setText('uiG2', d.gCount[1]||0);
      setText('uiG3', d.gCount[2]||0);
      setText('uiG4', d.gCount[3]||0);
      setText('uiG5', d.gCount[4]||0);
    }

    if(d.fever != null) setWidth('uiFeverFill', d.fever);
    if(d.shield != null) setText('uiShieldN', d.shield);

    if(d.accuracyGoodPct != null) setText('uiAcc', fmtPct(d.accuracyGoodPct));
    if(d.grade != null) setText('uiGrade', d.grade);
  }

  function onTime(e){
    const d = (e && e.detail) || {};
    if(d.game && d.game !== 'plate') return;
    if(d.timeLeftSec != null) setText('uiTime', d.timeLeftSec);
  }

  function onQuest(e){
    const d = (e && e.detail) || {};
    if(d.game && d.game !== 'plate') return;

    if(d.goal){
      setText('uiGoalTitle', d.goal.title || '—');
      setText('uiGoalCount', `${d.goal.cur||0}/${d.goal.target||0}`);
      const pct = (d.goal.target>0) ? (d.goal.cur/d.goal.target*100) : 0;
      setWidth('uiGoalFill', pct);
    }

    if(d.mini){
      setText('uiMiniTitle', d.mini.title || '—');
      if(d.mini.timeLeft != null){
        setText('uiMiniTime', `${Math.ceil(d.mini.timeLeft)}s`);
        const pct = (d.mini.target>0) ? ((d.mini.target - d.mini.timeLeft)/d.mini.target*100) : 0;
        setWidth('uiMiniFill', pct);
      }
    }
  }

  function onCoach(e){
    const d = (e && e.detail) || {};
    if(d.game && d.game !== 'plate') return;
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
  }

  // judge: optional (ปล่อยไว้เผื่อ future)
  function onJudge(){}

  // end: optional (plate.safe.js แสดงผลเองอยู่แล้ว)
  function onEnd(){}

  root.addEventListener('hha:score', onScore);
  root.addEventListener('hha:time', onTime);
  root.addEventListener('quest:update', onQuest);
  root.addEventListener('hha:coach', onCoach);
  root.addEventListener('hha:judge', onJudge);
  root.addEventListener('hha:end', onEnd);
})(window);