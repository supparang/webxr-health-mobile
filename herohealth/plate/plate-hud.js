// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder (A+B)
// ✅ Listens: hha:score, quest:update, hha:coach, hha:judge, hha:celebrate, hha:end
// ✅ Adds: judge toast, streak glow, perfect pop, damage vignette, grade chip data-grade
// ✅ Safe: if elements missing, no crash

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function qs(id){ return doc.getElementById(id); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function setText(id, txt){
    const el = qs(id);
    if (el) el.textContent = String(txt);
  }

  const hudTop = qs('hudTop');
  const coachMsg = qs('coachMsg');
  const coachImg = qs('coachImg');
  const feverFill = qs('uiFeverFill');
  const gradeChip = (function(){
    // In plate-vr.html, grade is inside .hudStat.gradeChip
    const el = doc.querySelector('.hudStat.gradeChip');
    return el || null;
  })();

  // -------- Judge toast (auto DOM) --------
  function ensureJudgeToast(){
    let t = qs('hhaJudgeToast');
    if (t) return t;

    t = doc.createElement('div');
    t.id = 'hhaJudgeToast';
    t.innerHTML = `
      <div class="card">
        <span class="tag" id="hhaJudgeTag">INFO</span>
        <span id="hhaJudgeText">—</span>
      </div>
    `;
    doc.body.appendChild(t);
    return t;
  }

  function showJudge(text, kind){
    const toast = ensureJudgeToast();
    const tag = qs('hhaJudgeTag');
    const tx  = qs('hhaJudgeText');

    if (tx) tx.textContent = String(text || '');
    if (tag){
      const k = String(kind || 'info').toLowerCase();
      tag.textContent =
        (k === 'good') ? 'GOOD' :
        (k === 'warn') ? 'WARN' :
        (k === 'bad')  ? 'BAD' :
        (k === 'perfect') ? 'PERFECT' :
        'INFO';
    }

    toast.classList.remove('good','warn','bad','perfect','show');
    const kk = String(kind||'info').toLowerCase();
    if (kk === 'good' || kk === 'warn' || kk === 'bad' || kk === 'perfect') toast.classList.add(kk);

    // pop
    void toast.offsetWidth;
    toast.classList.add('show');

    clearTimeout(showJudge._t);
    showJudge._t = setTimeout(()=>{
      toast.classList.remove('show','good','warn','bad','perfect');
    }, 900);
  }

  // -------- HUD pulse helpers --------
  function pulseHud(){
    if(!hudTop) return;
    hudTop.classList.remove('hha-streakPulse');
    void hudTop.offsetWidth;
    hudTop.classList.add('hha-streakPulse');
    clearTimeout(pulseHud._t);
    pulseHud._t = setTimeout(()=>hudTop && hudTop.classList.remove('hha-streakPulse'), 320);
  }

  function setStreakClass(combo, grade){
    if(!hudTop) return;
    hudTop.classList.remove('hha-streak','hha-streak-hot','hha-streak-ss','hha-streak-sss');

    const c = Number(combo)||0;
    const g = String(grade||'').toUpperCase();

    // Combo-based hype
    if (c >= 6) hudTop.classList.add('hha-streak');
    if (c >= 12) hudTop.classList.add('hha-streak-hot');

    // Grade-based premium
    if (g === 'SS') hudTop.classList.add('hha-streak-ss');
    if (g === 'SSS') hudTop.classList.add('hha-streak-sss');
  }

  function damageVignette(){
    doc.body.classList.remove('hha-damage');
    void doc.body.offsetWidth;
    doc.body.classList.add('hha-damage');
    clearTimeout(damageVignette._t);
    damageVignette._t = setTimeout(()=>doc.body.classList.remove('hha-damage'), 320);
  }

  // -------- Perfect pop at pointer position --------
  function perfectPop(x, y, label){
    const el = doc.createElement('div');
    el.className = 'hha-perfect';
    el.textContent = label || '⚡ PERFECT!';
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';
    doc.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 650);
  }

  // Track last mouse/touch position (fallback for PERFECT)
  const lastPt = { x: (root.innerWidth||360)/2, y:(root.innerHeight||640)/2 };
  root.addEventListener('pointermove', (e)=>{ lastPt.x=e.clientX; lastPt.y=e.clientY; }, { passive:true });
  root.addEventListener('pointerdown', (e)=>{ lastPt.x=e.clientX; lastPt.y=e.clientY; }, { passive:true });

  // -------- Score updates --------
  const prev = { score:0, combo:0, miss:0, grade:'C' };

  function onScore(d){
    if(!d) return;

    // Text updates (safe even if plate.safe.js already sets)
    if (typeof d.score !== 'undefined') setText('uiScore', d.score);
    if (typeof d.combo !== 'undefined') setText('uiCombo', d.combo);
    if (typeof d.comboMax !== 'undefined') setText('uiComboMax', d.comboMax);
    if (typeof d.miss !== 'undefined') setText('uiMiss', d.miss);
    if (typeof d.plateHave !== 'undefined') setText('uiPlateHave', d.plateHave);

    if (Array.isArray(d.gCount)){
      setText('uiG1', d.gCount[0]||0);
      setText('uiG2', d.gCount[1]||0);
      setText('uiG3', d.gCount[2]||0);
      setText('uiG4', d.gCount[3]||0);
      setText('uiG5', d.gCount[4]||0);
    }

    if (typeof d.accuracyGoodPct !== 'undefined') setText('uiAcc', Math.round(d.accuracyGoodPct) + '%');
    if (typeof d.grade !== 'undefined') setText('uiGrade', d.grade);
    if (typeof d.timeLeftSec !== 'undefined') setText('uiTime', Math.ceil(d.timeLeftSec));

    if (feverFill && typeof d.fever !== 'undefined'){
      feverFill.style.width = clamp(d.fever,0,100) + '%';
    }
    if (typeof d.shield !== 'undefined') setText('uiShieldN', d.shield);

    // Grade chip glow attr
    if (gradeChip && typeof d.grade !== 'undefined'){
      gradeChip.setAttribute('data-grade', String(d.grade||'C').toUpperCase());
    }

    // Pulse logic
    const scoreUp = (Number(d.score||0) > prev.score);
    const comboUp = (Number(d.combo||0) > prev.combo);

    if (scoreUp || comboUp) pulseHud();

    // Streak glow classes (combo+grade)
    setStreakClass(d.combo, d.grade);

    prev.score = Number(d.score||0);
    prev.combo = Number(d.combo||0);
    prev.miss  = Number(d.miss||0);
    prev.grade = String(d.grade||prev.grade);
  }

  // -------- Quest update --------
  function onQuest(d){
    if(!d) return;

    if (d.goal){
      setText('uiGoalTitle', d.goal.title || '—');
      setText('uiGoalCount', (d.goal.target!=null) ? `${d.goal.cur||0}/${d.goal.target||0}` : '0/0');
      const gf = qs('uiGoalFill');
      if(gf){
        const pct = (d.goal.target>0) ? (Number(d.goal.cur||0)/Number(d.goal.target||1))*100 : 0;
        gf.style.width = clamp(pct,0,100) + '%';
      }
    }

    if (d.mini){
      setText('uiMiniTitle', d.mini.title || '—');

      // miniCount comes from plate.safe.js, but keep safe if absent
      // uiMiniTime + uiMiniFill
      const tl = (d.mini.timeLeft==null) ? null : Number(d.mini.timeLeft);
      setText('uiMiniTime', (tl==null) ? '--' : `${Math.ceil(Math.max(0,tl))}s`);

      const mf = qs('uiMiniFill');
      if(mf){
        const dur = Number(d.mini.target||0);
        const pct = (dur>0 && tl!=null) ? ((dur - Math.max(0,tl))/dur)*100 : 0;
        mf.style.width = clamp(pct,0,100) + '%';
      }
    }
  }

  // -------- Coach update --------
  function onCoach(d){
    if(!d) return;
    if (coachMsg && d.msg) coachMsg.textContent = String(d.msg);

    if (coachImg && d.mood){
      const m = String(d.mood||'neutral');
      const map = {
        happy: './img/coach-happy.png',
        neutral:'./img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      coachImg.src = map[m] || map.neutral;
    }
  }

  // -------- Celebrate (goal/mini/end) --------
  function onCelebrate(d){
    if(!d) return;
    // Extra pulse + optional particles burst
    pulseHud();

    try{
      const P = root.Particles;
      if (P && typeof P.burst === 'function'){
        // burst near top-center
        P.burst((root.innerWidth||360)/2, (qs('hhaJudgeToast')? (qs('hhaJudgeToast').getBoundingClientRect().top+20):120));
      }
    }catch(e){}
  }

  // -------- PERFECT / STREAK / DAMAGE extra events (from plate.safe.js patch below) --------
  function onPerfect(d){
    const x = (d && typeof d.x==='number') ? d.x : lastPt.x;
    const y = (d && typeof d.y==='number') ? d.y : lastPt.y;
    perfectPop(x, y, '⚡ PERFECT!');
    showJudge('⚡ PERFECT!', 'perfect');
    pulseHud();
  }

  function onStreak(d){
    if(!hudTop) return;
    const tier = String((d && d.tier) || '').toLowerCase();
    // just pulse + keep current class selection
    pulseHud();
    if (tier === 'ss' || tier === 'sss'){
      // a little extra judge for hype
      showJudge(tier === 'sss' ? '🌟🔥 STREAK SSS!' : '✨ STREAK SS!', 'perfect');
    }else if (tier === 'hot'){
      showJudge('🔥 HOT STREAK!', 'warn');
    }else{
      showJudge('✅ STREAK!', 'good');
    }
  }

  function onDamage(){
    damageVignette();
  }

  // -------- Judge event passthrough --------
  function onJudge(d){
    if(!d) return;
    showJudge(d.text || '—', d.kind || 'info');
    if (String(d.kind||'').toLowerCase() === 'bad') damageVignette();
  }

  // -------- End event (ensure grade chip stable) --------
  function onEnd(d){
    try{
      const s = d && d.summary;
      if(s && gradeChip){
        gradeChip.setAttribute('data-grade', String(s.grade||'C').toUpperCase());
      }
    }catch(e){}
  }

  // ---- bind ----
  root.addEventListener('hha:score', (e)=> onScore(e.detail), { passive:true });
  root.addEventListener('quest:update', (e)=> onQuest(e.detail), { passive:true });
  root.addEventListener('hha:coach', (e)=> onCoach(e.detail), { passive:true });
  root.addEventListener('hha:judge', (e)=> onJudge(e.detail), { passive:true });
  root.addEventListener('hha:celebrate', (e)=> onCelebrate(e.detail), { passive:true });
  root.addEventListener('hha:end', (e)=> onEnd(e.detail), { passive:true });

  // extra hype events
  root.addEventListener('hha:perfect', (e)=> onPerfect(e.detail), { passive:true });
  root.addEventListener('hha:streak', (e)=> onStreak(e.detail), { passive:true });
  root.addEventListener('hha:damage', ()=> onDamage(), { passive:true });

})(window);