// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder (PRODUCTION)
// ✅ Listen: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ Adds: toast judge overlay (non-blocking) + fever-high class auto
// ✅ Safe: if element missing -> skip

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // ---------- utils ----------
  const qs = (id) => DOC.getElementById(id);
  const setText = (id, v) => {
    const el = qs(id);
    if (el) el.textContent = String(v);
  };
  const clamp = (v, a, b) => {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  };

  // ---------- element refs (optional) ----------
  const el = {
    uiScore: qs('uiScore'),
    uiCombo: qs('uiCombo'),
    uiComboMax: qs('uiComboMax'),
    uiMiss: qs('uiMiss'),
    uiPlateHave: qs('uiPlateHave'),
    uiG1: qs('uiG1'), uiG2: qs('uiG2'), uiG3: qs('uiG3'), uiG4: qs('uiG4'), uiG5: qs('uiG5'),
    uiAcc: qs('uiAcc'),
    uiGrade: qs('uiGrade'),
    uiTime: qs('uiTime'),
    uiFeverFill: qs('uiFeverFill'),
    uiShieldN: qs('uiShieldN'),

    uiGoalTitle: qs('uiGoalTitle'),
    uiGoalCount: qs('uiGoalCount'),
    uiGoalFill: qs('uiGoalFill'),

    uiMiniTitle: qs('uiMiniTitle'),
    uiMiniCount: qs('uiMiniCount'),
    uiMiniTime: qs('uiMiniTime'),
    uiMiniFill: qs('uiMiniFill'),
    uiHint: qs('uiHint'),

    coachMsg: qs('coachMsg'),
    coachImg: qs('coachImg'),
    coachName: (function(){
      const p = qs('coachPanel');
      if(!p) return null;
      return p.querySelector('.coachName');
    })(),

    resultBackdrop: qs('resultBackdrop'),

    // result ids (optional)
    rMode: qs('rMode'),
    rGrade: qs('rGrade'),
    rScore: qs('rScore'),
    rMaxCombo: qs('rMaxCombo'),
    rMiss: qs('rMiss'),
    rPerfect: qs('rPerfect'),
    rGoals: qs('rGoals'),
    rMinis: qs('rMinis'),
    rG1: qs('rG1'), rG2: qs('rG2'), rG3: qs('rG3'), rG4: qs('rG4'), rG5: qs('rG5'),
    rGTotal: qs('rGTotal'),
  };

  // ---------- judge toast (overlay) ----------
  function ensureToast(){
    let host = DOC.querySelector('.plate-judge-toast');
    if (host) return host;
    host = DOC.createElement('div');
    host.className = 'plate-judge-toast';
    host.style.cssText = `
      position:fixed;
      left:50%;
      top:calc(12px + env(safe-area-inset-top,0px));
      transform:translateX(-50%);
      z-index:85;
      pointer-events:none;
      display:flex;
      flex-direction:column;
      gap:8px;
      align-items:center;
      width:min(560px, calc(100vw - 24px));
    `;
    DOC.body.appendChild(host);

    const st = DOC.createElement('style');
    st.textContent = `
      .plate-judge-toast .toast{
        width:100%;
        border-radius:18px;
        padding:10px 12px;
        border:1px solid rgba(148,163,184,.16);
        background: rgba(2,6,23,.72);
        backdrop-filter: blur(10px);
        box-shadow: 0 18px 60px rgba(0,0,0,.35);
        font: 1000 13px/1.3 system-ui,-apple-system,"Noto Sans Thai",Segoe UI,Roboto,sans-serif;
        color: rgba(229,231,235,.96);
        opacity:0;
        transform: translateY(-6px);
        animation: plateToastIn .16s ease-out forwards;
      }
      .plate-judge-toast .toast.good{
        border-color: rgba(34,197,94,.22);
        background: rgba(34,197,94,.10);
      }
      .plate-judge-toast .toast.warn{
        border-color: rgba(250,204,21,.22);
        background: rgba(250,204,21,.10);
      }
      .plate-judge-toast .toast.bad{
        border-color: rgba(239,68,68,.22);
        background: rgba(239,68,68,.10);
      }
      @keyframes plateToastIn{
        to{ opacity:1; transform: translateY(0px); }
      }
      @keyframes plateToastOut{
        to{ opacity:0; transform: translateY(-8px); }
      }
    `;
    DOC.head.appendChild(st);
    return host;
  }

  function showToast(text, kind){
    if(!text) return;
    const host = ensureToast();
    const t = DOC.createElement('div');
    t.className = `toast ${kind||''}`.trim();
    t.textContent = String(text);
    host.appendChild(t);

    const life = (kind === 'bad') ? 1100 : (kind === 'warn' ? 950 : 850);
    root.setTimeout(()=>{
      try{
        t.style.animation = 'plateToastOut .18s ease-in forwards';
        root.setTimeout(()=>{ try{ t.remove(); }catch(_){ } }, 220);
      }catch(_){}
    }, life);
  }

  // ---------- fever-high helper ----------
  function syncFeverClass(fever){
    const v = Number(fever)||0;
    if (v >= 80) DOC.body.classList.add('fever-high');
    else DOC.body.classList.remove('fever-high');
  }

  // ---------- Quest UI ----------
  function syncGoal(goal){
    if(!goal){
      if(el.uiGoalTitle) el.uiGoalTitle.textContent = '—';
      if(el.uiGoalCount) el.uiGoalCount.textContent = '0/0';
      if(el.uiGoalFill)  el.uiGoalFill.style.width = '0%';
      return;
    }
    if(el.uiGoalTitle) el.uiGoalTitle.textContent = String(goal.title || '—');
    if(el.uiGoalCount) el.uiGoalCount.textContent = `${Number(goal.cur)||0}/${Number(goal.target)||0}`;
    if(el.uiGoalFill){
      const t = Number(goal.target)||0;
      const c = Number(goal.cur)||0;
      const pct = t>0 ? (c/t*100) : 0;
      el.uiGoalFill.style.width = `${clamp(pct,0,100)}%`;
    }
  }

  function syncMini(mini, meta){
    // meta can contain miniCleared/minisTotal, if caller wants to render count.
    if(!mini || (!mini.title && !mini.target && !mini.timeLeft)){
      if(el.uiMiniTitle) el.uiMiniTitle.textContent = '—';
      if(el.uiMiniTime)  el.uiMiniTime.textContent  = '--';
      if(el.uiMiniFill)  el.uiMiniFill.style.width  = '0%';
      if(el.uiHint)      el.uiHint.textContent      = 'ทริค: เก็บให้ครบ 5 หมู่ไว ๆ แล้วคุมความแม่นยำ!';
      if(el.uiMiniCount && meta){
        el.uiMiniCount.textContent = `${meta.miniCleared||0}/${meta.miniTotal||0}`;
      }
      return;
    }

    if(el.uiMiniTitle) el.uiMiniTitle.textContent = String(mini.title || '—');

    // timeLeft display (sec)
    if(el.uiMiniTime){
      if(mini.timeLeft == null) el.uiMiniTime.textContent = '--';
      else el.uiMiniTime.textContent = `${Math.max(0, Math.ceil(Number(mini.timeLeft)||0))}s`;
    }

    // fill (progress by elapsed)
    if(el.uiMiniFill){
      const T = Number(mini.target)||0;
      const tl = (mini.timeLeft==null) ? null : Number(mini.timeLeft)||0;
      let pct = 0;
      if(T>0 && tl!=null){
        pct = ((T - Math.max(0, tl)) / T) * 100;
      }
      el.uiMiniFill.style.width = `${clamp(pct,0,100)}%`;
    }

    if(el.uiHint){
      // keep hint short + punchy
      el.uiHint.textContent = (mini.forbidJunk)
        ? 'ทริค: เร่งเก็บหมู่ที่ยังขาด! ห้ามโดนขยะเด็ดขาด!'
        : 'ทริค: คุมจังหวะ + คอมโบ + ความแม่นยำ!';
    }

    if(el.uiMiniCount && meta){
      el.uiMiniCount.textContent = `${meta.miniCleared||0}/${meta.miniTotal||0}`;
    }
  }

  // ---------- Coach ----------
  function syncCoach(msg, mood){
    if(el.coachMsg && msg) el.coachMsg.textContent = String(msg);

    // Optional: if you ever want per-game coach name
    // if(el.coachName) el.coachName.textContent = 'Hero Coach';

    // Mood image mapping (matches /herohealth/img names in your memory)
    if(el.coachImg){
      const m = String(mood || 'neutral').toLowerCase();
      const map = {
        happy: './img/coach-happy.png',
        neutral: './img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      el.coachImg.src = map[m] || map.neutral;
    }
  }

  // ---------- Score packet ----------
  function onScore(detail){
    if(!detail) return;

    // update simple HUD
    if(el.uiScore) el.uiScore.textContent = String(detail.score ?? 0);
    if(el.uiCombo) el.uiCombo.textContent = String(detail.combo ?? 0);
    if(el.uiComboMax) el.uiComboMax.textContent = String(detail.comboMax ?? 0);
    if(el.uiMiss) el.uiMiss.textContent = String(detail.miss ?? 0);
    if(el.uiPlateHave) el.uiPlateHave.textContent = String(detail.plateHave ?? 0);

    if(Array.isArray(detail.gCount)){
      if(el.uiG1) el.uiG1.textContent = String(detail.gCount[0] ?? 0);
      if(el.uiG2) el.uiG2.textContent = String(detail.gCount[1] ?? 0);
      if(el.uiG3) el.uiG3.textContent = String(detail.gCount[2] ?? 0);
      if(el.uiG4) el.uiG4.textContent = String(detail.gCount[3] ?? 0);
      if(el.uiG5) el.uiG5.textContent = String(detail.gCount[4] ?? 0);
    }

    // accuracy & grade
    if(el.uiAcc){
      const a = Number(detail.accuracyGoodPct)||0;
      el.uiAcc.textContent = `${Math.round(a)}%`;
    }
    if(el.uiGrade) el.uiGrade.textContent = String(detail.grade || 'C');

    // fever bar + class
    if(el.uiFeverFill){
      el.uiFeverFill.style.width = `${clamp(detail.fever||0,0,100)}%`;
    }
    syncFeverClass(detail.fever||0);

    // shield
    if(el.uiShieldN) el.uiShieldN.textContent = String(detail.shield ?? 0);
  }

  function onTime(detail){
    if(!detail) return;
    if(el.uiTime) el.uiTime.textContent = String(detail.timeLeftSec ?? detail.timeLeft ?? detail.time ?? '');
  }

  // quest:update packet is already shaped by plate.safe.js
  function onQuestUpdate(detail){
    if(!detail) return;

    // goal
    syncGoal(detail.goal || null);

    // mini
    // If you want count, we can't know total here; plate.safe.js sets uiMiniCount anyway.
    syncMini(detail.mini || null, null);
  }

  function onJudge(detail){
    if(!detail) return;
    showToast(detail.text || detail.msg || '', detail.kind || 'good');
  }

  function onEnd(detail){
    if(!detail || !detail.summary) return;
    const s = detail.summary;

    // Freeze fever class based on final
    syncFeverClass(s.fever || 0);

    // If result overlay exists, populate (plate.safe.js already does this, but safe to reinforce)
    if(el.rMode) el.rMode.textContent = String(s.runMode || s.mode || '');
    if(el.rGrade) el.rGrade.textContent = String(s.grade || '');
    if(el.rScore) el.rScore.textContent = String(s.scoreFinal ?? 0);
    if(el.rMaxCombo) el.rMaxCombo.textContent = String(s.comboMax ?? 0);
    if(el.rMiss) el.rMiss.textContent = String(s.misses ?? 0);
    if(el.rPerfect) el.rPerfect.textContent = `${Math.round(Number(s.fastHitRatePct)||0)}%`;
    if(el.rGoals) el.rGoals.textContent = `${s.goalsCleared||0}/${s.goalsTotal||0}`;
    if(el.rMinis) el.rMinis.textContent = `${s.miniCleared||0}/${s.miniTotal||0}`;

    if(s.plate && Array.isArray(s.plate.counts)){
      if(el.rG1) el.rG1.textContent = String(s.plate.counts[0]??0);
      if(el.rG2) el.rG2.textContent = String(s.plate.counts[1]??0);
      if(el.rG3) el.rG3.textContent = String(s.plate.counts[2]??0);
      if(el.rG4) el.rG4.textContent = String(s.plate.counts[3]??0);
      if(el.rG5) el.rG5.textContent = String(s.plate.counts[4]??0);
      if(el.rGTotal) el.rGTotal.textContent = String(s.plate.total ?? 0);
    }

    // Make sure overlay is visible if present
    if(el.resultBackdrop) el.resultBackdrop.style.display = 'grid';
  }

  function onCoach(detail){
    if(!detail) return;
    if(detail.game && String(detail.game) !== 'plate') return;
    if(detail.msg) syncCoach(detail.msg, detail.mood);
  }

  // ---------- bind events ----------
  function bind(){
    root.addEventListener('hha:score', (e)=>{
      const d = e && e.detail;
      if(d && d.game && String(d.game) !== 'plate') return;
      onScore(d);
    });

    root.addEventListener('hha:time', (e)=>{
      const d = e && e.detail;
      if(d && d.game && String(d.game) !== 'plate') return;
      onTime(d);
    });

    root.addEventListener('quest:update', (e)=>{
      const d = e && e.detail;
      if(d && d.game && String(d.game) !== 'plate') return;
      onQuestUpdate(d);
    });

    root.addEventListener('hha:coach', (e)=>{
      const d = e && e.detail;
      onCoach(d);
    });

    root.addEventListener('hha:judge', (e)=>{
      const d = e && e.detail;
      if(d && d.game && String(d.game) !== 'plate') return;
      onJudge(d);
    });

    root.addEventListener('hha:end', (e)=>{
      const d = e && e.detail;
      if(d && d.game && String(d.game) !== 'plate') return;
      onEnd(d);
    });
  }

  // ---------- init ----------
  bind();

  // Default coach fallback (in case JS loads before plate.safe.js emits anything)
  if(el.coachMsg && !el.coachMsg.textContent) el.coachMsg.textContent = 'พร้อมลุย! เติมจานให้ครบ 5 หมู่ 💪';

})(window);