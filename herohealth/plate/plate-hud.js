// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder (HHA Standard)
// ✅ Listens: hha:score, quest:update, hha:coach, hha:judge, hha:end
// ✅ Updates DOM safely (missing elements won't crash)
// ✅ Grade styling + accuracy display
// ✅ Start overlay preview sync (diff/time/run)
// ✅ Optional view mode class (pc/mobile/vr/cvr)
// ✅ Prevent duplicate binding

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // -------------------- utils --------------------
  function qs(id){ return doc.getElementById(id); }
  function setText(id, v){
    const el = qs(id);
    if (el) el.textContent = String(v ?? '');
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function fmtPct(x){
    const n = Number(x)||0;
    return `${Math.round(n)}%`;
  }
  function safeNum(x, def=0){
    const n = Number(x);
    return Number.isFinite(n) ? n : def;
  }
  function byIdMaybe(id){ return qs(id) || null; }

  // -------------------- prevent double bind --------------------
  if (root.__HHA_PLATE_HUD_BOUND__) return;
  root.__HHA_PLATE_HUD_BOUND__ = true;

  // -------------------- elements --------------------
  const el = {
    // top hud
    uiScore: byIdMaybe('uiScore'),
    uiCombo: byIdMaybe('uiCombo'),
    uiComboMax: byIdMaybe('uiComboMax'),
    uiMiss: byIdMaybe('uiMiss'),
    uiPlateHave: byIdMaybe('uiPlateHave'),
    uiTime: byIdMaybe('uiTime'),
    uiGrade: byIdMaybe('uiGrade'),
    uiAcc: byIdMaybe('uiAcc'),
    uiFeverFill: byIdMaybe('uiFeverFill'),
    uiShieldN: byIdMaybe('uiShieldN'),

    uiG1: byIdMaybe('uiG1'),
    uiG2: byIdMaybe('uiG2'),
    uiG3: byIdMaybe('uiG3'),
    uiG4: byIdMaybe('uiG4'),
    uiG5: byIdMaybe('uiG5'),

    // quest
    uiGoalTitle: byIdMaybe('uiGoalTitle'),
    uiGoalCount: byIdMaybe('uiGoalCount'),
    uiGoalFill: byIdMaybe('uiGoalFill'),
    uiMiniTitle: byIdMaybe('uiMiniTitle'),
    uiMiniCount: byIdMaybe('uiMiniCount'),
    uiMiniTime: byIdMaybe('uiMiniTime'),
    uiMiniFill: byIdMaybe('uiMiniFill'),
    uiHint: byIdMaybe('uiHint'),

    // coach
    coachMsg: byIdMaybe('coachMsg'),
    coachImg: byIdMaybe('coachImg'),

    // result
    rMode: byIdMaybe('rMode'),
    rGrade: byIdMaybe('rGrade'),
    rScore: byIdMaybe('rScore'),
    rMaxCombo: byIdMaybe('rMaxCombo'),
    rMiss: byIdMaybe('rMiss'),
    rPerfect: byIdMaybe('rPerfect'),
    rGoals: byIdMaybe('rGoals'),
    rMinis: byIdMaybe('rMinis'),
    rG1: byIdMaybe('rG1'),
    rG2: byIdMaybe('rG2'),
    rG3: byIdMaybe('rG3'),
    rG4: byIdMaybe('rG4'),
    rG5: byIdMaybe('rG5'),
    rGTotal: byIdMaybe('rGTotal'),

    // preview
    uiDiffPreview: byIdMaybe('uiDiffPreview'),
    uiTimePreview: byIdMaybe('uiTimePreview'),
    uiRunPreview: byIdMaybe('uiRunPreview'),
  };

  // -------------------- grade styling --------------------
  function gradeClass(g){
    const s = String(g||'').toUpperCase();
    if (s === 'SSS' || s === 'SS') return 'hha-grade-ss';
    if (s === 'S') return 'hha-grade-s';
    if (s === 'A') return 'hha-grade-a';
    if (s === 'B') return 'hha-grade-b';
    return 'hha-grade-c';
  }

  function ensureGradeCss(){
    const id = 'plate-grade-css';
    if (doc.getElementById(id)) return;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = `
      /* Grade chip glow (affects #hudTop .gradeChip) */
      #hudTop .gradeChip{ transition: box-shadow .12s ease, border-color .12s ease; }
      body.hha-grade-ss #hudTop .gradeChip{
        border-color: rgba(250,204,21,.34);
        box-shadow: 0 0 0 6px rgba(250,204,21,.10), 0 16px 46px rgba(0,0,0,.28);
      }
      body.hha-grade-s #hudTop .gradeChip{
        border-color: rgba(34,211,238,.30);
        box-shadow: 0 0 0 6px rgba(34,211,238,.10), 0 16px 46px rgba(0,0,0,.28);
      }
      body.hha-grade-a #hudTop .gradeChip{
        border-color: rgba(34,197,94,.30);
        box-shadow: 0 0 0 6px rgba(34,197,94,.10), 0 16px 46px rgba(0,0,0,.28);
      }
      body.hha-grade-b #hudTop .gradeChip{
        border-color: rgba(245,158,11,.32);
        box-shadow: 0 0 0 6px rgba(245,158,11,.10), 0 16px 46px rgba(0,0,0,.28);
      }
      body.hha-grade-c #hudTop .gradeChip{
        border-color: rgba(239,68,68,.30);
        box-shadow: 0 0 0 6px rgba(239,68,68,.10), 0 16px 46px rgba(0,0,0,.28);
      }
    `;
    doc.head.appendChild(st);
  }
  ensureGradeCss();

  function applyGrade(g){
    const b = doc.body;
    b.classList.remove('hha-grade-ss','hha-grade-s','hha-grade-a','hha-grade-b','hha-grade-c');
    b.classList.add(gradeClass(g));
  }

  // -------------------- view mode class --------------------
  function setBodyView(view){
    const b = doc.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    if (view) b.classList.add(`view-${view}`);
  }
  function guessView(){
    try{
      const u = new URL(location.href);
      const v = (u.searchParams.get('view') || '').toLowerCase();
      if (v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;

      // simple heuristic
      const W = root.innerWidth || 360;
      const isMobile = W <= 820;
      return isMobile ? 'mobile' : 'pc';
    }catch(_){
      return 'pc';
    }
  }
  setBodyView(guessView());

  // -------------------- preview sync --------------------
  function syncPreviewFromQuery(){
    try{
      const u = new URL(location.href);
      const diff = (u.searchParams.get('diff') || 'normal');
      const time = (u.searchParams.get('time') || '90');
      const run  = (u.searchParams.get('run') || u.searchParams.get('runMode') || 'play');
      if (el.uiDiffPreview) el.uiDiffPreview.textContent = String(diff);
      if (el.uiTimePreview) el.uiTimePreview.textContent = String(time);
      if (el.uiRunPreview)  el.uiRunPreview.textContent  = String(run);
    }catch(_){}
  }
  syncPreviewFromQuery();

  // -------------------- event handlers --------------------
  function onScore(detail){
    if (!detail || String(detail.game||'') !== 'plate') return;

    // Update HUD
    if (el.uiScore) el.uiScore.textContent = String(detail.score ?? 0);
    if (el.uiCombo) el.uiCombo.textContent = String(detail.combo ?? 0);
    if (el.uiComboMax) el.uiComboMax.textContent = String(detail.comboMax ?? 0);
    if (el.uiMiss) el.uiMiss.textContent = String(detail.miss ?? 0);
    if (el.uiPlateHave) el.uiPlateHave.textContent = String(detail.plateHave ?? 0);
    if (el.uiTime) el.uiTime.textContent = String(Math.ceil(safeNum(detail.timeLeftSec, 0)));

    const acc = safeNum(detail.accuracyGoodPct, 0);
    if (el.uiAcc) el.uiAcc.textContent = fmtPct(acc);
    if (el.uiGrade) el.uiGrade.textContent = String(detail.grade ?? 'C');
    applyGrade(detail.grade);

    const fever = clamp(detail.fever, 0, 100);
    if (el.uiFeverFill) el.uiFeverFill.style.width = `${fever}%`;

    if (el.uiShieldN) el.uiShieldN.textContent = String(detail.shield ?? 0);

    // group counts
    const g = Array.isArray(detail.gCount) ? detail.gCount : null;
    if (g){
      if (el.uiG1) el.uiG1.textContent = String(g[0] ?? 0);
      if (el.uiG2) el.uiG2.textContent = String(g[1] ?? 0);
      if (el.uiG3) el.uiG3.textContent = String(g[2] ?? 0);
      if (el.uiG4) el.uiG4.textContent = String(g[3] ?? 0);
      if (el.uiG5) el.uiG5.textContent = String(g[4] ?? 0);
    }
  }

  function onQuestUpdate(detail){
    if (!detail || String(detail.game||'') !== 'plate') return;

    const goal = detail.goal || null;
    if (goal){
      if (el.uiGoalTitle) el.uiGoalTitle.textContent = String(goal.title ?? '—');
      if (el.uiGoalCount) el.uiGoalCount.textContent = `${goal.cur ?? 0}/${goal.target ?? 0}`;
      if (el.uiGoalFill){
        const cur = safeNum(goal.cur,0), tar = Math.max(1, safeNum(goal.target,1));
        el.uiGoalFill.style.width = `${clamp((cur/tar)*100,0,100)}%`;
      }
    } else {
      if (el.uiGoalTitle) el.uiGoalTitle.textContent = '—';
      if (el.uiGoalCount) el.uiGoalCount.textContent = '0/0';
      if (el.uiGoalFill) el.uiGoalFill.style.width = '0%';
    }

    const mini = detail.mini || null;
    if (mini){
      if (el.uiMiniTitle) el.uiMiniTitle.textContent = String(mini.title ?? '—');

      // miniCount can be passed separately; keep safe
      // If not provided, keep existing UI
      // (plate.safe.js already sets uiMiniCount)
      if (typeof mini.timeLeft !== 'undefined' && el.uiMiniTime){
        const tl = mini.timeLeft;
        el.uiMiniTime.textContent = (tl==null) ? '--' : `${Math.ceil(Math.max(0, tl))}s`;
      }

      if (el.uiMiniFill){
        const tar = Math.max(1, safeNum(mini.target, 1));
        // if mini has timeLeft => progress = elapsed
        if (typeof mini.timeLeft !== 'undefined'){
          const tl = Math.max(0, safeNum(mini.timeLeft, 0));
          const pct = clamp(((tar - tl)/tar)*100, 0, 100);
          el.uiMiniFill.style.width = `${pct}%`;
        } else {
          const cur = safeNum(mini.cur,0);
          const pct = clamp((cur/tar)*100, 0, 100);
          el.uiMiniFill.style.width = `${pct}%`;
        }
      }
    } else {
      if (el.uiMiniTitle) el.uiMiniTitle.textContent = '—';
      if (el.uiMiniTime) el.uiMiniTime.textContent = '--';
      if (el.uiMiniFill) el.uiMiniFill.style.width = '0%';
    }
  }

  function onCoach(detail){
    if (!detail || String(detail.game||'') !== 'plate') return;
    if (el.coachMsg) el.coachMsg.textContent = String(detail.msg ?? '');

    const mood = String(detail.mood || 'neutral').toLowerCase();
    if (el.coachImg){
      const map = {
        happy: './img/coach-happy.png',
        neutral: './img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      el.coachImg.src = map[mood] || map.neutral;
    }
  }

  // Optional: judge hook (not required UI here, but nice for debug)
  function onJudge(detail){
    if (!detail || String(detail.game||'') !== 'plate') return;
    // You can wire a toast later. For now no-op.
  }

  function onEnd(detail){
    if (!detail || String(detail.game||'') !== 'plate') return;
    const s = detail.summary || null;
    if (!s) return;

    // Result fields
    if (el.rMode) el.rMode.textContent = String(s.runMode ?? 'play');
    if (el.rGrade) el.rGrade.textContent = String(s.grade ?? 'C');
    if (el.rScore) el.rScore.textContent = String(s.scoreFinal ?? 0);
    if (el.rMaxCombo) el.rMaxCombo.textContent = String(s.comboMax ?? 0);
    if (el.rMiss) el.rMiss.textContent = String(s.misses ?? 0);
    if (el.rPerfect) el.rPerfect.textContent = `${Math.round(s.fastHitRatePct ?? 0)}%`;
    if (el.rGoals) el.rGoals.textContent = `${s.goalsCleared ?? 0}/${s.goalsTotal ?? 0}`;
    if (el.rMinis) el.rMinis.textContent = `${s.miniCleared ?? 0}/${s.miniTotal ?? 0}`;

    const counts = (s.plate && Array.isArray(s.plate.counts)) ? s.plate.counts : [0,0,0,0,0];
    if (el.rG1) el.rG1.textContent = String(counts[0] ?? 0);
    if (el.rG2) el.rG2.textContent = String(counts[1] ?? 0);
    if (el.rG3) el.rG3.textContent = String(counts[2] ?? 0);
    if (el.rG4) el.rG4.textContent = String(counts[3] ?? 0);
    if (el.rG5) el.rG5.textContent = String(counts[4] ?? 0);

    if (el.rGTotal){
      const total = safeNum(s.plate?.total, counts.reduce((a,b)=>a+(Number(b)||0),0));
      el.rGTotal.textContent = String(total);
    }

    // also apply grade glow for end screen
    applyGrade(s.grade);
  }

  // -------------------- attach listeners --------------------
  root.addEventListener('hha:score', (ev)=>onScore(ev.detail), { passive:true });
  root.addEventListener('quest:update', (ev)=>onQuestUpdate(ev.detail), { passive:true });
  root.addEventListener('hha:coach', (ev)=>onCoach(ev.detail), { passive:true });
  root.addEventListener('hha:judge', (ev)=>onJudge(ev.detail), { passive:true });
  root.addEventListener('hha:end', (ev)=>onEnd(ev.detail), { passive:true });

  // If user changes orientation/size, the game’s safe-spawn relies on HUD rects;
  // this binder just keeps view class reasonable.
  root.addEventListener('resize', ()=>{
    // keep existing view if explicitly set in query; else re-guess
    try{
      const u = new URL(location.href);
      const v = (u.searchParams.get('view') || '').toLowerCase();
      if (v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return;
    }catch(_){}
    setBodyView(guessView());
  }, { passive:true });

})(typeof window !== 'undefined' ? window : globalThis);