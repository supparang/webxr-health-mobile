/* === /herohealth/fitness-planner/planner.safe.js — Fitness Planner SAFE Engine (Standalone) v20260213a ===
   Goals:
   ✅ Fun+Challenging+Clear for grade 5
   ✅ Build combo (3–5 moves)
   ✅ Run stages: punch/jump/duck/balance with pacing + progress bar
   ✅ Scoring: hit, perfect window, streak, miss penalty
   ✅ Mini-boss at last step (short intense)
   ✅ Summary + reflect + save last summary + back HUB
   ✅ Daily Gate: marks HHA_ZONE_DONE::fitness::YYYY-MM-DD when finished (optional)
*/

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  // ---------- small helpers ----------
  const $ = (s)=>DOC.querySelector(s);
  const clamp = (v,min,max)=>Math.max(min, Math.min(max,v));
  const pick = (arr, r)=>arr[Math.floor(r()*arr.length)];
  const ymdLocal = ()=>{
    const d=new Date();
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };

  function zoneDoneKey(zone){ return `HHA_ZONE_DONE::${zone}::${ymdLocal()}`; }
  function markZoneDone(zone){
    try{ localStorage.setItem(zoneDoneKey(zone), '1'); }catch(_){}
  }

  // ---------- game config ----------
  const MOVE_META = {
    punch_shadow: { emoji:'🥊', label:'ต่อยเงา', type:'punch' },
    punch_rhythm: { emoji:'🎵', label:'ต่อยจังหวะ', type:'punch' },
    jump: { emoji:'🦘', label:'กระโดด', type:'tap' },
    duck: { emoji:'🧎', label:'หมอบหลบ', type:'hold' },
    balance: { emoji:'⚖️', label:'ทรงตัว', type:'aim' }
  };

  const DIFF = {
    easy:   { stepSec: 5.2, bossSec: 6.0, punchSize: 86,  perfectMs: 520, holdSec: 2.2, aimSec: 2.4, moveSpeed: 0.85, missPenalty: 6,  streakBonus: 2 },
    normal: { stepSec: 4.2, bossSec: 5.2, punchSize: 74,  perfectMs: 420, holdSec: 2.6, aimSec: 2.8, moveSpeed: 1.00, missPenalty: 9,  streakBonus: 3 },
    hard:   { stepSec: 3.6, bossSec: 4.6, punchSize: 64,  perfectMs: 320, holdSec: 3.0, aimSec: 3.2, moveSpeed: 1.15, missPenalty: 12, streakBonus: 4 },
    final:  { stepSec: 3.2, bossSec: 4.2, punchSize: 58,  perfectMs: 260, holdSec: 3.2, aimSec: 3.4, moveSpeed: 1.25, missPenalty: 14, streakBonus: 5 }
  };

  function normalizeDiff(d){
    d = String(d||'normal').toLowerCase();
    if(d==='ok') d='normal';
    if(d==='expert') d='hard';
    return DIFF[d] ? d : 'normal';
  }

  // ---------- state ----------
  const S = {
    ctx:null,
    rng:Math.random,
    now:()=>performance.now(),

    view:'mobile',
    run:'play',
    diffKey:'normal',
    cfg: DIFF.normal,

    combo: [],
    score: 0,
    streak: 0,
    bestStreak: 0,
    pass: 0,
    total: 0,
    timeSum: 0,

    // step runtime
    stepIndex: 0,
    stepStart: 0,
    stepEnd: 0,
    stepTimer: null,
    raf: 0,

    // step flags
    solved: false,
    lastTapAt: 0,

    // aim tracking (balance)
    aimOkStart: 0,
    aimHolding: false
  };

  // ---------- DOM refs ----------
  const el = {};
  function cacheDom(){
    el.wrap = $('#fp-wrap');

    // build view
    el.vBuild = $('#fp-view-build');
    el.palette = DOC.querySelectorAll('.fp-card[data-move]');
    el.combo = $('#fp-combo');
    el.count = $('#fp-count');
    el.btnClear = $('#fp-clear');
    el.btnStart = $('#fp-start');

    // run view
    el.vRun = $('#fp-view-run');
    el.stepIdx = $('#fp-step-idx');
    el.stepTotal = $('#fp-step-total');
    el.score = $('#fp-score');
    el.time = $('#fp-time');
    el.instr = $('#fp-instr');
    el.target = $('#fp-target');
    el.center = $('#fp-center');
    el.actbar = $('#fp-actbar');
    el.btnJump = $('#fp-btn-jump');
    el.btnDuck = $('#fp-btn-duck');
    el.bar = $('#fp-bar');

    // summary view
    el.vSum = $('#fp-view-summary');
    el.sumScore = $('#fp-sum-score');
    el.sumPass = $('#fp-sum-pass');
    el.sumTotal = $('#fp-sum-total');
    el.sumTime = $('#fp-sum-time');
    el.btnSave = $('#fp-save');
    el.btnRetry = $('#fp-retry');

    // ctx labels (optional)
    el.ctxView = $('#fp-ctx-view');
    el.ctxSeed = $('#fp-ctx-seed');
    el.ctxDiff = $('#fp-ctx-diff');
    el.ctxTime = $('#fp-ctx-time');
    el.ctxRun  = $('#fp-ctx-run');
  }

  function show(view){
    // build/run/summary
    const views = [el.vBuild, el.vRun, el.vSum];
    views.forEach(v=>v && v.classList.add('fp-hidden'));

    if(view==='build') el.vBuild.classList.remove('fp-hidden');
    if(view==='run') el.vRun.classList.remove('fp-hidden');
    if(view==='summary') el.vSum.classList.remove('fp-hidden');

    if(el.wrap) el.wrap.dataset.state = view;
  }

  function setText(node, txt){
    if(!node) return;
    node.textContent = String(txt);
  }

  function setBtnEnabled(btn, enabled){
    if(!btn) return;
    btn.disabled = !enabled;
  }

  // ---------- combo UI ----------
  function renderCombo(){
    if(!el.combo) return;
    el.combo.innerHTML = '';

    S.combo.forEach((m, idx)=>{
      const meta = MOVE_META[m] || {emoji:'❓', label:m};
      const b = DOC.createElement('button');
      b.className = 'fp-chip';
      b.type = 'button';
      b.setAttribute('data-idx', String(idx));
      b.innerHTML = `<span class="e">${meta.emoji}</span><span class="t">${meta.label}</span><span class="x">✕</span>`;
      b.addEventListener('click', ()=>{
        S.combo.splice(idx,1);
        renderCombo();
      }, {passive:true});
      el.combo.appendChild(b);
    });

    setText(el.count, S.combo.length);
    setBtnEnabled(el.btnStart, S.combo.length>=3 && S.combo.length<=5);
  }

  function addMove(move){
    if(S.combo.length>=5) return;
    S.combo.push(move);
    renderCombo();
  }

  function clearCombo(){
    S.combo = [];
    renderCombo();
  }

  // ---------- step mechanics ----------
  function resetRunState(){
    S.score=0;
    S.streak=0;
    S.bestStreak=0;
    S.pass=0;
    S.total=S.combo.length;
    S.timeSum=0;

    S.stepIndex=0;
    S.solved=false;
    S.aimOkStart=0;
    S.aimHolding=false;
  }

  function hideAllStageWidgets(){
    if(el.target) el.target.classList.add('fp-hidden');
    if(el.center) el.center.classList.add('fp-hidden');
    if(el.actbar) el.actbar.classList.add('fp-hidden');
    if(el.btnDuck) el.btnDuck.classList.remove('is-hold');
  }

  function setProgress01(p){
    if(!el.bar) return;
    el.bar.style.width = `${clamp(p,0,1)*100}%`;
  }

  function addScore(delta){
    S.score = Math.max(0, Math.round(S.score + delta));
    setText(el.score, S.score);
  }

  function bumpStreak(ok){
    if(ok){
      S.streak++;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
      addScore(S.cfg.streakBonus * Math.min(10, S.streak)); // escalates but capped
    }else{
      S.streak = 0;
    }
  }

  function stepDurationSec(isBoss){
    // “ใช้งานจริง”: ถ้า ctx.time ระบุมา จะกระจายเวลาเฉลี่ยต่อสเต็ป
    const t = Number(S.ctx?.time);
    const hasTime = Number.isFinite(t) && t>10;
    if(hasTime){
      const base = t / Math.max(1, S.total);
      // boss step ให้สั้นลงนิดเพื่อเร้าใจ (หรือคงไว้)
      return isBoss ? Math.max(3.8, base*0.92) : Math.max(3.8, base);
    }
    return isBoss ? S.cfg.bossSec : S.cfg.stepSec;
  }

  function isBossStep(){
    return (S.stepIndex === S.total-1) && S.total>=4; // ถ้าคอมโบยาวพอ ให้มีบอสท้าย
  }

  function setInstr(txt){
    setText(el.instr, txt);
  }

  function moveTargetToRandom(){
    if(!el.target) return;
    const r = S.rng;

    // safe bounds inside stage (avoid edges; keep under top HUD)
    const stage = el.vRun ? el.vRun.querySelector('.fp-stage') : null;
    const rect = stage ? stage.getBoundingClientRect() : {left:0, top:0, width: window.innerWidth, height: window.innerHeight};

    const padX = 28;
    const padTop = 90;      // avoid runTop overlay
    const padBottom = 120;  // avoid action bar region

    const w = rect.width;
    const h = rect.height;

    const x = rect.left + padX + r()*(w - padX*2);
    const y = rect.top + padTop + r()*(h - padTop - padBottom);

    const size = S.cfg.punchSize * (isBossStep()? 0.92 : 1.0);

    el.target.style.width = size+'px';
    el.target.style.height = size+'px';
    el.target.style.left = (x - size/2) + 'px';
    el.target.style.top  = (y - size/2) + 'px';
  }

  function startStep(){
    const idx = S.stepIndex;
    const move = S.combo[idx];
    const meta = MOVE_META[move] || {label:move, type:'punch', emoji:'❓'};
    const boss = isBossStep();

    S.solved = false;
    S.aimOkStart = 0;
    S.aimHolding = false;

    hideAllStageWidgets();

    setText(el.stepIdx, idx+1);
    setText(el.stepTotal, S.total);

    const dur = stepDurationSec(boss);
    S.stepStart = S.now();
    S.stepEnd = S.stepStart + dur*1000;

    // stage instruction
    const bossTag = boss ? '🔥 MINI-BOSS: ' : '';
    if(meta.type==='punch'){
      setInstr(`${bossTag}${meta.emoji} ${meta.label} — แตะ/ยิง “เป้า” ให้โดน`);
      if(el.target){
        el.target.classList.remove('fp-hidden');
        moveTargetToRandom();
      }
    }else if(meta.type==='tap'){
      setInstr(`${bossTag}${meta.emoji} ${meta.label} — กดปุ่ม JUMP ให้ทัน!`);
      if(el.actbar) el.actbar.classList.remove('fp-hidden');
      if(el.btnJump) el.btnJump.classList.remove('fp-hidden');
      if(el.btnDuck) el.btnDuck.classList.add('fp-hidden');
    }else if(meta.type==='hold'){
      setInstr(`${bossTag}${meta.emoji} ${meta.label} — กดค้าง DUCK ให้ครบ`);
      if(el.actbar) el.actbar.classList.remove('fp-hidden');
      if(el.btnDuck) el.btnDuck.classList.remove('fp-hidden');
      if(el.btnJump) el.btnJump.classList.add('fp-hidden');
      el.btnDuck && el.btnDuck.classList.remove('is-hold');
    }else if(meta.type==='aim'){
      setInstr(`${bossTag}${meta.emoji} ${meta.label} — เล็งให้นิ่งที่ “จุดกลาง”`);
      if(el.center) el.center.classList.remove('fp-hidden');
    }

    // start tick
    stopTick();
    tick();
  }

  function finishStep(success, reason){
    if(S.solved) return;
    S.solved = true;

    const tNow = S.now();
    const stepSpent = Math.max(0, (tNow - S.stepStart)/1000);
    S.timeSum += stepSpent;

    if(success){
      S.pass++;
      bumpStreak(true);
      addScore(25); // base reward
      setInstr('✅ ผ่าน! เตรียมด่านถัดไป…');
    }else{
      bumpStreak(false);
      addScore(-S.cfg.missPenalty);
      setInstr(`❌ พลาด (${reason||'หมดเวลา'}) — ไปต่อ!`);
    }

    // small delay then next
    stopTick();
    setProgress01(1);

    clearTimeout(S.stepTimer);
    S.stepTimer = setTimeout(()=>{
      S.stepIndex++;
      if(S.stepIndex >= S.total){
        endRun();
      }else{
        startStep();
      }
    }, 650);
  }

  function stopTick(){
    if(S.raf) cancelAnimationFrame(S.raf);
    S.raf = 0;
  }

  function tick(){
    const t = S.now();
    const leftMs = S.stepEnd - t;
    const durMs = Math.max(1, S.stepEnd - S.stepStart);
    const p = 1 - clamp(leftMs/durMs, 0, 1);

    setProgress01(p);
    setText(el.time, (Math.max(0,leftMs)/1000).toFixed(1));

    // timeouts
    if(leftMs <= 0){
      finishStep(false, 'หมดเวลา');
      return;
    }

    // punch move target drift for excitement
    const move = S.combo[S.stepIndex];
    const meta = MOVE_META[move];
    if(meta && meta.type==='punch' && el.target && !el.target.classList.contains('fp-hidden')){
      // occasionally relocate in boss / rhythm move
      const boss = isBossStep();
      const relocateChance = (meta === MOVE_META.punch_rhythm ? 0.05 : 0.02) * S.cfg.moveSpeed * (boss?1.7:1.0);
      if(S.rng() < relocateChance){
        moveTargetToRandom();
      }
    }

    // balance: aim steady check (use crosshair center proximity)
    if(meta && meta.type==='aim'){
      const ok = isAimSteady();
      if(ok){
        if(!S.aimHolding){
          S.aimHolding = true;
          S.aimOkStart = t;
        }
        const need = (isBossStep()? S.cfg.aimSec*0.9 : S.cfg.aimSec) * 1000;
        if(t - S.aimOkStart >= need){
          addScore(30);
          finishStep(true, 'steady');
          return;
        }
      }else{
        S.aimHolding = false;
        S.aimOkStart = 0;
      }
    }

    S.raf = requestAnimationFrame(tick);
  }

  // For balance mode: detect "steady" by device motion? keep SAFE: use finger stillness + center dot visibility
  function isAimSteady(){
    // SAFE heuristic: if view=pc, require mouse stillness; if mobile, require no recent touch move
    const t = S.now();
    const dt = t - S.lastTapAt;
    // if no interaction recently, consider steady
    return dt > 260; // simple & stable for kids
  }

  // ---------- input handlers ----------
  function onTargetHit(ev){
    ev && ev.preventDefault && ev.preventDefault();
    if(S.solved) return;

    const t = S.now();
    const rt = t - S.stepStart;

    // perfect window: faster hit => more points
    const perfect = rt <= S.cfg.perfectMs;
    addScore(perfect ? 55 : 35);
    if(perfect) addScore(10);

    finishStep(true, perfect ? 'perfect' : 'hit');
  }

  function onJump(ev){
    ev && ev.preventDefault && ev.preventDefault();
    S.lastTapAt = S.now();
    if(S.solved) return;

    // success if pressed in last 40% of step (reaction)
    const t = S.now();
    const p = (t - S.stepStart) / Math.max(1, (S.stepEnd - S.stepStart));
    const ok = p >= 0.25; // not too early
    if(ok){
      addScore(45);
      finishStep(true, 'jump');
    }else{
      // too early counts as miss (but not end—one retry)
      addScore(-6);
      setInstr('⏱️ เร็วไปนิด! รอจังหวะแล้วกดอีกที');
    }
  }

  function onDuckDown(ev){
    ev && ev.preventDefault && ev.preventDefault();
    S.lastTapAt = S.now();
    if(S.solved) return;

    // start holding
    const t = S.now();
    S.aimHolding = true;
    S.aimOkStart = t;
    el.btnDuck && el.btnDuck.classList.add('is-hold');
    setInstr('🧎 กดค้างไว้…');
  }

  function onDuckUp(ev){
    ev && ev.preventDefault && ev.preventDefault();
    S.lastTapAt = S.now();
    if(S.solved) return;

    const t = S.now();
    const holdMs = S.aimHolding ? (t - S.aimOkStart) : 0;
    S.aimHolding = false;
    S.aimOkStart = 0;
    el.btnDuck && el.btnDuck.classList.remove('is-hold');

    const need = (isBossStep()? S.cfg.holdSec*0.92 : S.cfg.holdSec) * 1000;
    if(holdMs >= need){
      addScore(50);
      finishStep(true, 'duck');
    }else{
      addScore(-7);
      setInstr('🧎 ยังไม่ครบ! กดค้างให้นานขึ้น');
    }
  }

  // balance uses "stillness" so any interaction resets lastTapAt
  function bindRunInputs(){
    if(el.target){
      el.target.addEventListener('click', onTargetHit, {passive:false});
      el.target.addEventListener('pointerdown', onTargetHit, {passive:false});
    }
    if(el.btnJump){
      el.btnJump.addEventListener('click', onJump, {passive:false});
      el.btnJump.addEventListener('pointerdown', onJump, {passive:false});
    }
    if(el.btnDuck){
      // pointer hold
      el.btnDuck.addEventListener('pointerdown', onDuckDown, {passive:false});
      el.btnDuck.addEventListener('pointerup', onDuckUp, {passive:false});
      el.btnDuck.addEventListener('pointercancel', onDuckUp, {passive:false});
      el.btnDuck.addEventListener('mouseleave', onDuckUp, {passive:false});
      // touch fallback
      el.btnDuck.addEventListener('touchstart', onDuckDown, {passive:false});
      el.btnDuck.addEventListener('touchend', onDuckUp, {passive:false});
    }

    // any pointer move resets balance steadiness
    DOC.addEventListener('pointermove', ()=>{ S.lastTapAt = S.now(); }, {passive:true});
    DOC.addEventListener('touchmove', ()=>{ S.lastTapAt = S.now(); }, {passive:true});
  }

  // ---------- summary ----------
  function gradeFromScore(score, pass, total){
    const passRate = total ? pass/total : 0;
    // weight: pass is mandatory
    if(passRate >= 1 && score >= 240) return 'S';
    if(passRate >= 0.9 && score >= 200) return 'A';
    if(passRate >= 0.75 && score >= 160) return 'B';
    if(passRate >= 0.6) return 'C';
    return 'D';
  }

  function saveLastSummary(payload){
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
    }catch(_){}
  }

  function endRun(){
    stopTick();
    clearTimeout(S.stepTimer);

    // mark daily gate for fitness
    markZoneDone('fitness');

    const grade = gradeFromScore(S.score, S.pass, S.total);

    setText(el.sumScore, S.score);
    setText(el.sumPass, S.pass);
    setText(el.sumTotal, S.total);
    setText(el.sumTime, S.timeSum.toFixed(1));

    // save last summary in a hub-compatible way
    const payload = {
      game: 'fitness-planner',
      ts: Date.now(),
      date: ymdLocal(),
      pid: S.ctx?.pid || '',
      studyId: S.ctx?.studyId || '',
      phase: S.ctx?.phase || '',
      conditionGroup: S.ctx?.conditionGroup || '',
      view: S.ctx?.view || '',
      run: S.ctx?.run || '',
      diff: S.diffKey,
      time: S.ctx?.time || '',
      seed: S.ctx?.seed || '',
      score: S.score,
      pass: S.pass,
      total: S.total,
      grade,
      bestStreak: S.bestStreak,
      combo: S.combo.slice()
    };
    saveLastSummary(payload);

    // also append summary info into hub url if hub reads it (optional)
    // (ไม่บังคับ เพราะ hub ของคุณอ่าน HHA_LAST_SUMMARY ได้อยู่แล้วในอนาคต)
    show('summary');
  }

  // ---------- build actions ----------
  function bindBuildInputs(){
    el.palette.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const move = btn.getAttribute('data-move');
        if(!MOVE_META[move]) return;
        addMove(move);
      }, {passive:true});
    });

    el.btnClear && el.btnClear.addEventListener('click', clearCombo, {passive:true});

    el.btnStart && el.btnStart.addEventListener('click', ()=>{
      // require 3–5 moves
      if(S.combo.length < 3) return;
      if(S.combo.length > 5) S.combo = S.combo.slice(0,5);

      resetRunState();
      show('run');
      // small warm-up text
      setInstr('พร้อมนะ… 3…2…1…');
      setTimeout(()=> startStep(), 600);
    }, {passive:true});
  }

  // summary actions
  function bindSummaryInputs(){
    el.btnRetry && el.btnRetry.addEventListener('click', ()=>{
      resetRunState();
      show('run');
      setInstr('ลองคอมโบเดิมอีกครั้ง! 3…2…1…');
      setTimeout(()=> startStep(), 600);
    }, {passive:true});

    el.btnSave && el.btnSave.addEventListener('click', ()=>{
      // store reflection choice (for research)
      let diff = 'ok';
      const r = DOC.querySelector('input[name="diff"]:checked');
      if(r) diff = r.value;

      try{
        const last = JSON.parse(localStorage.getItem('HHA_LAST_SUMMARY')||'{}');
        last.reflect = { difficulty: diff };
        localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(last));
      }catch(_){}

      // quick feedback
      const old = el.btnSave.textContent;
      el.btnSave.textContent = '✅ บันทึกแล้ว';
      setTimeout(()=>{ el.btnSave.textContent = old; }, 900);
    }, {passive:true});
  }

  // ---------- public API ----------
  function boot({ctx, rng, now}){
    cacheDom();

    S.ctx = ctx || {};
    S.rng = typeof rng==='function' ? rng : Math.random;
    S.now = typeof now==='function' ? now : (()=>performance.now());

    S.view = (ctx && ctx.view) ? String(ctx.view) : 'mobile';
    S.run  = (ctx && ctx.run) ? String(ctx.run)  : 'play';

    S.diffKey = normalizeDiff(ctx?.diff || 'normal');
    S.cfg = DIFF[S.diffKey];

    // show ctx (optional)
    el.ctxView && (el.ctxView.textContent = S.view);
    el.ctxSeed && (el.ctxSeed.textContent = String((ctx?.seed>>>0) || '-'));
    el.ctxDiff && (el.ctxDiff.textContent = S.diffKey);
    el.ctxTime && (el.ctxTime.textContent = String(ctx?.time ?? '90'));
    el.ctxRun  && (el.ctxRun.textContent  = S.run);

    // init UI
    renderCombo();
    bindBuildInputs();
    bindRunInputs();
    bindSummaryInputs();

    show('build');
  }

  WIN.HHA_FITNESS_PLANNER = { boot };
})();