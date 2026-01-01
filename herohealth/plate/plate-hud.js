// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder (PRODUCTION)
// ✅ listens: hha:score, quest:update, hha:coach, hha:end
// ✅ updates: top stats, fever/shield, plate counts, goal/mini bars, result overlay
// ✅ safe: element missing -> skip
// ✅ prevents double-binding

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // prevent double bind
  if (root.__HHA_PLATE_HUD_BOUND__) return;
  root.__HHA_PLATE_HUD_BOUND__ = true;

  function qs(id){ return DOC.getElementById(id); }
  function setText(id, v){
    const el = qs(id);
    if (!el) return;
    el.textContent = String(v);
  }
  function setWidth(id, pct){
    const el = qs(id);
    if (!el) return;
    const x = Math.max(0, Math.min(100, Number(pct)||0));
    el.style.width = x + '%';
  }
  function fmtPct(x){
    x = Number(x)||0;
    return Math.round(x) + '%';
  }
  function safeNum(x, d=0){
    x = Number(x);
    return isFinite(x) ? x : d;
  }

  // cache ids (optional)
  const elFeverFill = qs('uiFeverFill');

  // -------------------- handlers --------------------
  function onScore(ev){
    const d = (ev && ev.detail) ? ev.detail : null;
    if(!d) return;
    if(String(d.game||'') !== 'plate') return;

    // basic stats
    setText('uiScore', safeNum(d.score, 0));
    setText('uiCombo', safeNum(d.combo, 0));
    setText('uiComboMax', safeNum(d.comboMax, 0));
    setText('uiMiss', safeNum(d.miss, 0));

    // plate
    setText('uiPlateHave', safeNum(d.plateHave, 0));

    // counts
    const gc = Array.isArray(d.gCount) ? d.gCount : [];
    setText('uiG1', safeNum(gc[0], 0));
    setText('uiG2', safeNum(gc[1], 0));
    setText('uiG3', safeNum(gc[2], 0));
    setText('uiG4', safeNum(gc[3], 0));
    setText('uiG5', safeNum(gc[4], 0));

    // grade/acc
    if (d.grade != null) setText('uiGrade', String(d.grade));
    if (d.accuracyGoodPct != null) setText('uiAcc', fmtPct(d.accuracyGoodPct));

    // time
    if (d.timeLeftSec != null) setText('uiTime', Math.max(0, Math.ceil(safeNum(d.timeLeftSec, 0))));

    // fever
    const fever = Math.max(0, Math.min(100, safeNum(d.fever, 0)));
    if (elFeverFill) elFeverFill.style.width = fever + '%';

    // shield
    setText('uiShieldN', Math.max(0, safeNum(d.shield, 0)));
  }

  function onQuest(ev){
    const d = (ev && ev.detail) ? ev.detail : null;
    if(!d) return;
    if(String(d.game||'') !== 'plate') return;

    const goal = d.goal || null;
    const mini = d.mini || null;

    // GOAL
    if(goal){
      setText('uiGoalTitle', goal.title || '—');
      const cur = safeNum(goal.cur, 0);
      const tar = Math.max(0, safeNum(goal.target, 0));
      setText('uiGoalCount', tar ? (cur + '/' + tar) : '0/0');
      setWidth('uiGoalFill', tar ? (cur / tar * 100) : 0);
    }else{
      setText('uiGoalTitle', '—');
      setText('uiGoalCount', '0/0');
      setWidth('uiGoalFill', 0);
    }

    // MINI
    if(mini){
      setText('uiMiniTitle', mini.title || '—');

      // miniCount: show "cleared/total" if provided or fallback "0/0"
      // (Plate safe.js sets uiMiniCount separately sometimes, but binder will keep stable)
      if (qs('uiMiniCount')){
        // If caller provides explicit cur/target for mini, show that,
        // otherwise keep whatever is currently shown.
        const cur = safeNum(mini.cur, null);
        const tar = safeNum(mini.target, null);
        if(cur != null && tar != null && tar > 0){
          setText('uiMiniCount', cur + '/' + tar);
        }
      }

      // mini time left
      if(mini.timeLeft == null){
        setText('uiMiniTime', '--');
      }else{
        const tl = Math.max(0, Math.ceil(safeNum(mini.timeLeft, 0)));
        setText('uiMiniTime', tl + 's');
      }

      // progress bar (for time-based mini, show elapsed)
      if(mini.target && mini.timeLeft != null){
        const tar = Math.max(1, safeNum(mini.target, 1));
        const tl  = Math.max(0, safeNum(mini.timeLeft, 0));
        const pct = (tar - tl) / tar * 100;
        setWidth('uiMiniFill', pct);
      }else{
        setWidth('uiMiniFill', 0);
      }
    }else{
      setText('uiMiniTitle', '—');
      setText('uiMiniTime', '--');
      setWidth('uiMiniFill', 0);
    }
  }

  function onCoach(ev){
    const d = (ev && ev.detail) ? ev.detail : null;
    if(!d) return;
    if(String(d.game||'') !== 'plate') return;

    const msg = d.msg || '';
    const mood = (d.mood || 'neutral').toLowerCase();

    const cm = qs('coachMsg');
    if (cm && msg) cm.textContent = String(msg);

    const img = qs('coachImg');
    if(img){
      const map = {
        happy: './img/coach-happy.png',
        neutral:'./img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      img.src = map[mood] || map.neutral;
    }
  }

  function onEnd(ev){
    const d = (ev && ev.detail) ? ev.detail : null;
    if(!d) return;
    if(String(d.game||'') !== 'plate') return;

    const s = d.summary || null;
    if(!s) return;

    // result overlay ids (plate-vr.html provides them)
    setText('rMode', s.runMode || 'play');
    setText('rGrade', s.grade || 'C');
    setText('rScore', safeNum(s.scoreFinal, 0));
    setText('rMaxCombo', safeNum(s.comboMax, 0));
    setText('rMiss', safeNum(s.misses, 0));
    setText('rPerfect', (s.fastHitRatePct != null) ? (Math.round(s.fastHitRatePct) + '%') : '0%');
    setText('rGoals', (safeNum(s.goalsCleared, 0)) + '/' + (safeNum(s.goalsTotal, 0)));
    setText('rMinis', (safeNum(s.miniCleared, 0)) + '/' + (safeNum(s.miniTotal, 0)));

    const plate = s.plate || {};
    const c = Array.isArray(plate.counts) ? plate.counts : [];
    setText('rG1', safeNum(c[0], 0));
    setText('rG2', safeNum(c[1], 0));
    setText('rG3', safeNum(c[2], 0));
    setText('rG4', safeNum(c[3], 0));
    setText('rG5', safeNum(c[4], 0));
    setText('rGTotal', safeNum(plate.total, 0));

    // show overlay if exists
    const bd = qs('resultBackdrop');
    if (bd) bd.style.display = 'grid';
  }

  // -------------------- attach listeners --------------------
  root.addEventListener('hha:score', onScore);
  root.addEventListener('quest:update', onQuest);
  root.addEventListener('hha:coach', onCoach);
  root.addEventListener('hha:end', onEnd);

  // also accept direct custom names if you ever emit them
  // (no-op if never used)
  root.addEventListener('plate:score', onScore);

})(typeof window !== 'undefined' ? window : globalThis);