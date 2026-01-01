// === /herohealth/plate/plate-hud.js ===
// HeroHealth Plate — HUD Binder (PRODUCTION)
// ✅ Bind UI for PlateVR (DOM HUD)
// ✅ Listen: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end, hha:celebrate
// ✅ Safe: missing elements won't crash
// ✅ Coach images from /herohealth/img: coach-fever.png, coach-happy.png, coach-neutral.png, coach-sad.png

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  const $ = (id) => doc.getElementById(id);

  function clamp(v, a, b){ v = Number(v)||0; return v<a?a : (v>b?b:v); }

  // --------- Soft judge toast (optional) ----------
  function ensureJudgeToast(){
    let el = doc.querySelector('.plate-judge-toast');
    if(el) return el;

    el = doc.createElement('div');
    el.className = 'plate-judge-toast';
    el.style.cssText = `
      position:fixed;
      left:50%;
      top:calc(14px + env(safe-area-inset-top,0px));
      transform:translateX(-50%) translateY(-8px);
      z-index:80;
      pointer-events:none;
      opacity:0;
      transition: opacity .16s ease, transform .16s ease;
      font: 1100 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", sans-serif;
      color:rgba(229,231,235,.95);
      background:rgba(2,6,23,.78);
      border:1px solid rgba(148,163,184,.18);
      border-radius:999px;
      padding:10px 12px;
      box-shadow:0 18px 50px rgba(0,0,0,.35);
      backdrop-filter: blur(10px);
      white-space:nowrap;
    `;
    doc.body.appendChild(el);
    return el;
  }

  function showJudge(text, kind){
    const el = ensureJudgeToast();
    if(!el) return;

    // color hint
    const good = 'rgba(34,197,94,.28)';
    const warn = 'rgba(250,204,21,.30)';
    const bad  = 'rgba(239,68,68,.28)';
    const bc = (kind === 'bad') ? bad : (kind === 'warn') ? warn : good;

    el.style.borderColor = bc;
    el.textContent = String(text || '');
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0px)';

    clearTimeout(showJudge._t);
    showJudge._t = setTimeout(()=>{
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(-8px)';
    }, 900);
  }

  // --------- Celebrate flash ----------
  function flashCelebrate(kind){
    // try use particles.js if present (global)
    try{
      if(root.Particles && typeof root.Particles.celebrate === 'function'){
        root.Particles.celebrate(kind || 'end');
      }
    }catch(_){}

    // small body flash
    try{
      doc.body.classList.remove('plate-celebrate');
      void doc.body.offsetWidth;
      doc.body.classList.add('plate-celebrate');
      clearTimeout(flashCelebrate._t);
      flashCelebrate._t = setTimeout(()=>doc.body.classList.remove('plate-celebrate'), 420);
    }catch(_){}
  }

  // inject minimal css once
  (function ensureCss(){
    const id = 'plate-hud-binder-css';
    if(doc.getElementById(id)) return;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = `
      .plate-celebrate{
        animation: plateCelebrate .42s ease-out 0s 1;
      }
      @keyframes plateCelebrate{
        0%{ filter:none; }
        35%{ filter:brightness(1.25) saturate(1.15); }
        100%{ filter:none; }
      }
    `;
    doc.head.appendChild(st);
  })();

  // --------- UI setters ----------
  function setText(id, v){
    const el = $(id);
    if(el) el.textContent = String(v);
  }
  function setWidth(id, pct){
    const el = $(id);
    if(el) el.style.width = `${clamp(pct,0,100)}%`;
  }

  function setCoach(msg, mood){
    const msgEl = $('coachMsg');
    if(msgEl && msg != null) msgEl.textContent = String(msg);

    const img = $('coachImg');
    if(img){
      const m = String(mood || 'neutral').toLowerCase();
      const map = {
        happy:  './img/coach-happy.png',
        neutral:'./img/coach-neutral.png',
        sad:    './img/coach-sad.png',
        fever:  './img/coach-fever.png',
      };
      img.src = map[m] || map.neutral;
    }
  }

  // --------- Event handlers ----------
  function onScore(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if(String(d.game||'') !== 'plate') return;

    if(d.score != null) setText('uiScore', d.score);
    if(d.combo != null) setText('uiCombo', d.combo);
    if(d.comboMax != null) setText('uiComboMax', d.comboMax);
    if(d.miss != null) setText('uiMiss', d.miss);

    if(d.plateHave != null) setText('uiPlateHave', d.plateHave);

    if(Array.isArray(d.gCount)){
      setText('uiG1', d.gCount[0] ?? 0);
      setText('uiG2', d.gCount[1] ?? 0);
      setText('uiG3', d.gCount[2] ?? 0);
      setText('uiG4', d.gCount[3] ?? 0);
      setText('uiG5', d.gCount[4] ?? 0);
    }

    if(d.accuracyGoodPct != null) setText('uiAcc', `${Math.round(Number(d.accuracyGoodPct)||0)}%`);
    if(d.grade != null) setText('uiGrade', d.grade);

    if(d.timeLeftSec != null) setText('uiTime', Math.ceil(Number(d.timeLeftSec)||0));

    if(d.fever != null) setWidth('uiFeverFill', d.fever);
    if(d.shield != null) setText('uiShieldN', d.shield);
  }

  function onTime(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if(String(d.game||'') !== 'plate') return;
    if(d.timeLeftSec != null) setText('uiTime', Math.ceil(Number(d.timeLeftSec)||0));
  }

  function onQuest(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if(String(d.game||'') !== 'plate') return;

    const goal = d.goal || null;
    const mini = d.mini || null;

    if(goal){
      setText('uiGoalTitle', goal.title ?? '—');
      setText('uiGoalCount', `${goal.cur ?? 0}/${goal.target ?? 0}`);
      const pct = (goal.target ? (Number(goal.cur)||0) / (Number(goal.target)||1) * 100 : 0);
      setWidth('uiGoalFill', pct);
    }

    if(mini){
      setText('uiMiniTitle', mini.title ?? '—');

      // miniCount may be managed by game; if provided, use it
      if(mini.countText != null) setText('uiMiniCount', mini.countText);
      // else keep whatever game sets elsewhere

      const tl = (mini.timeLeft == null) ? null : Number(mini.timeLeft);
      setText('uiMiniTime', tl == null ? '--' : `${Math.ceil(Math.max(0, tl))}s`);

      const dur = Number(mini.target)||0;
      if(dur > 0 && tl != null){
        const pct = (dur - tl) / dur * 100;
        setWidth('uiMiniFill', pct);
      }
    }
  }

  function onCoach(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if(String(d.game||'') !== 'plate') return;
    setCoach(d.msg, d.mood);
  }

  function onJudge(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if(String(d.game||'') !== 'plate') return;
    if(d.text != null) showJudge(d.text, d.kind || 'info');
  }

  function onEnd(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if(String(d.game||'') !== 'plate') return;

    // We don't control result card (plate.safe.js writes ids r*)
    // but we can do a final flash / toast.
    try{
      const s = d.summary || null;
      if(s && s.grade){
        showJudge(`🏁 END • GRADE ${String(s.grade).toUpperCase()}`, (String(s.grade).toUpperCase()==='C'?'bad':'good'));
      }else{
        showJudge('🏁 END', 'good');
      }
    }catch(_){}
    flashCelebrate('end');
  }

  function onCelebrate(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if(String(d.game||'') !== 'plate') return;
    flashCelebrate(d.kind || 'end');
  }

  // --------- Bind ----------
  root.addEventListener('hha:score', onScore);
  root.addEventListener('hha:time', onTime);
  root.addEventListener('quest:update', onQuest);
  root.addEventListener('hha:coach', onCoach);
  root.addEventListener('hha:judge', onJudge);
  root.addEventListener('hha:end', onEnd);
  root.addEventListener('hha:celebrate', onCelebrate);

  // boot: sync preview values if present
  try{
    const u = new URL(location.href);
    const diff = u.searchParams.get('diff') || 'normal';
    const time = u.searchParams.get('time') || '90';
    const run  = u.searchParams.get('run') || u.searchParams.get('runMode') || 'play';
    if($('uiDiffPreview')) $('uiDiffPreview').textContent = diff;
    if($('uiTimePreview')) $('uiTimePreview').textContent = time;
    if($('uiRunPreview'))  $('uiRunPreview').textContent  = run;
  }catch(_){}

})(window);