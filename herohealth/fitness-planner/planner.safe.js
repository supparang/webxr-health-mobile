// === HeroHealth — Fitness Planner SAFE Engine (Standalone) ===
// PATCH v20260209-ABC
// A) Balance easier for Grade 5: assist ring + hold-to-count
// B) Combo drag/touch reorder
// C) Research rubric + Copy JSON
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const $ = (s)=>DOC.querySelector(s);
  const $$ = (s)=>Array.from(DOC.querySelectorAll(s));

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
  }

  function pickLabel(move){
    switch(move){
      case 'punch_shadow': return '🥊 ต่อ ย เง า';
      case 'punch_rhythm': return '🎵 ต่อ ย จัง หว ะ';
      case 'jump': return '🦘 กระ โด ด';
      case 'duck': return '🧎 ห ม อ บ ห ล บ';
      case 'balance': return '⚖️ ท ร ง ตั ว';
      default: return move;
    }
  }

  function stepSpec(move){
    // Grade 5 friendly (for research use)
    switch(move){
      case 'punch_shadow':
      case 'punch_rhythm':
        return { kind:'punch', ttlMs: 2200, score: 10 };
      case 'jump':
        return { kind:'jump', ttlMs: 2200, score: 8 };
      case 'duck':
        return { kind:'duck', ttlMs: 1900, holdMs: 900, score: 9 };
      case 'balance':
        // A) easier: larger lock + hold-to-count
        return { kind:'balance', ttlMs: 2800, holdMs: 1100, lockPx: 80, score: 12 };
      default:
        return { kind:'punch', ttlMs: 2200, score: 10 };
    }
  }

  // ---------- lightweight logger (optional ?log= endpoint) ----------
  function makeLogger(ctx){
    const endpoint = ctx?.log || '';
    const buf = [];
    let seq = 0;

    function base(){
      return {
        ts: Date.now(),
        seq: ++seq,
        pid: ctx.pid || '',
        studyId: ctx.studyId || '',
        phase: ctx.phase || '',
        conditionGroup: ctx.conditionGroup || '',
        view: ctx.view || '',
        seed: ctx.seed >>> 0
      };
    }

    function push(type, data){
      buf.push(Object.assign(base(), { type }, data || {}));
    }

    async function flush(reason){
      if(!buf.length) return;
      const payload = buf.splice(0, buf.length);
      if(!endpoint){
        try{ console.log('[FP LOG]', reason, payload); }catch(e){}
        return;
      }
      try{
        await fetch(endpoint, {
          method:'POST',
          headers:{ 'content-type':'application/json' },
          body: JSON.stringify({ kind:'fitness_planner', reason, items: payload })
        });
      }catch(e){
        Array.prototype.unshift.apply(buf, payload);
      }
    }

    function harden(){
      const onVis = ()=>{ if(DOC.visibilityState === 'hidden') flush('visibility_hidden'); };
      const onHide = ()=>flush('pagehide');
      const onBefore = ()=>flush('beforeunload');
      DOC.addEventListener('visibilitychange', onVis);
      WIN.addEventListener('pagehide', onHide);
      WIN.addEventListener('beforeunload', onBefore);
      return ()=> {
        DOC.removeEventListener('visibilitychange', onVis);
        WIN.removeEventListener('pagehide', onHide);
        WIN.removeEventListener('beforeunload', onBefore);
      };
    }

    return { push, flush, harden };
  }

  // C) rubric scoring for Create (research)
  function rubricCreate(combo){
    const moves = Array.isArray(combo) ? combo : [];
    const len = moves.length;
    const uniq = new Set(moves);
    const uniqueCount = uniq.size;

    const hasBalance = uniq.has('balance');
    const hasPunch = uniq.has('punch_shadow') || uniq.has('punch_rhythm');
    const hasJump = uniq.has('jump');
    const hasDuck = uniq.has('duck');

    // Simple, explainable rubric (0–10)
    let score = 0;
    // length
    if(len >= 3) score += 2;
    if(len >= 4) score += 1;
    if(len >= 5) score += 1;

    // diversity
    if(uniqueCount >= 2) score += 2;
    if(uniqueCount >= 3) score += 2;
    if(uniqueCount >= 4) score += 1;

    // balance of skills
    if(hasPunch) score += 1;
    if(hasBalance) score += 1;
    if(hasJump && hasDuck) score += 1;

    score = clamp(score, 0, 10);

    return {
      createScore: score,
      len,
      uniqueCount,
      hasBalance,
      hasPunch,
      hasJump,
      hasDuck
    };
  }

  // ---------- Engine ----------
  function boot({ ctx, rng, now }){
    const log = makeLogger(ctx);
    const unHarden = log.harden();

    const wrap = $('#fp-wrap');
    const viewBuild = $('#fp-view-build');
    const viewRun = $('#fp-view-run');
    const viewSum = $('#fp-view-summary');

    const comboEl = $('#fp-combo');
    const countEl = $('#fp-count');
    const btnClear = $('#fp-clear');
    const btnStart = $('#fp-start');

    const stepIdxEl = $('#fp-step-idx');
    const stepTotEl = $('#fp-step-total');
    const scoreEl = $('#fp-score');
    const timeEl = $('#fp-time');
    const instrEl = $('#fp-instr');
    const barEl = $('#fp-bar');

    const targetEl = $('#fp-target');
    const centerRingEl = $('#fp-centerRing');
    const centerEl = $('#fp-center');
    const actbarEl = $('#fp-actbar');
    const btnJump = $('#fp-btn-jump');
    const btnDuck = $('#fp-btn-duck');

    const sumScore = $('#fp-sum-score');
    const sumPass = $('#fp-sum-pass');
    const sumTot = $('#fp-sum-total');
    const sumTime = $('#fp-sum-time');
    const btnSave = $('#fp-save');
    const btnRetry = $('#fp-retry');
    const btnCopy = $('#fp-copy');
    const backHub = $('#fp-backhub');

    const stageEl = viewRun ? viewRun.querySelector('.fp-stage') : null;

    let combo = []; // array of move ids (3-5)
    let run = null;

    // B) drag/touch reorder state
    let dragState = { active:false, idx:-1, el:null, pointerId:null };

    function setCount(){
      countEl.textContent = String(combo.length);
      btnStart.disabled = !(combo.length >= 3 && combo.length <= 5);
    }

    function renderCombo(){
      comboEl.innerHTML = '';
      combo.forEach((mv, i)=>{
        const b = DOC.createElement('div');
        b.className = 'fp-chip';
        b.dataset.idx = String(i);
        b.innerHTML = `<span class="t">${pickLabel(mv)}</span><span class="x">✕</span>`;
        // tap X remove (kid-friendly)
        b.addEventListener('click', (ev)=>{
          // if dragging, ignore click
          if(dragState.active) return;
          // remove when tapping the chip (simple)
          const idx = Number(b.dataset.idx);
          if(Number.isFinite(idx)){
            combo.splice(idx, 1);
            renderCombo(); setCount();
            log.push('combo_remove', { idx, move: mv, combo: combo.slice() });
          }
        });

        // B) pointer drag reorder
        b.addEventListener('pointerdown', (ev)=>{
          // long press not required; start drag immediately
          dragState.active = true;
          dragState.idx = Number(b.dataset.idx);
          dragState.el = b;
          dragState.pointerId = ev.pointerId;
          b.classList.add('fp-dragging');
          b.setPointerCapture(ev.pointerId);
          log.push('drag_start', { idx: dragState.idx, move: mv });

          // prevent scroll while dragging
          ev.preventDefault();
        });

        b.addEventListener('pointermove', (ev)=>{
          if(!dragState.active || dragState.el !== b || dragState.pointerId !== ev.pointerId) return;

          // detect target index by elementFromPoint
          const el = DOC.elementFromPoint(ev.clientX, ev.clientY);
          const chip = el ? el.closest('.fp-chip') : null;
          if(!chip || chip === b) return;

          const from = dragState.idx;
          const to = Number(chip.dataset.idx);
          if(!Number.isFinite(to) || to === from) return;

          // reorder array
          const item = combo.splice(from, 1)[0];
          combo.splice(to, 0, item);
          dragState.idx = to;

          renderCombo(); setCount();
          log.push('drag_reorder', { from, to, combo: combo.slice() });
        });

        const endDrag = (ev)=>{
          if(!dragState.active || dragState.el !== b) return;
          dragState.active = false;
          dragState.pointerId = null;
          dragState.idx = -1;
          dragState.el = null;
          b.classList.remove('fp-dragging');
          log.push('drag_end', { combo: combo.slice() });
        };

        b.addEventListener('pointerup', endDrag);
        b.addEventListener('pointercancel', endDrag);

        comboEl.appendChild(b);
      });
    }

    function addMove(mv){
      if(combo.length >= 5) return;
      combo.push(mv);
      renderCombo(); setCount();
      log.push('combo_add', { move: mv, combo: combo.slice() });
    }

    function clearCombo(){
      combo = [];
      renderCombo(); setCount();
      log.push('combo_clear', {});
    }

    function showBuild(){
      viewBuild.classList.remove('fp-hidden');
      viewRun.classList.add('fp-hidden');
      viewSum.classList.add('fp-hidden');
      wrap.dataset.state = 'build';
    }

    function showRun(){
      viewBuild.classList.add('fp-hidden');
      viewRun.classList.remove('fp-hidden');
      viewSum.classList.add('fp-hidden');
      wrap.dataset.state = 'run';
    }

    function showSummary(){
      viewBuild.classList.add('fp-hidden');
      viewRun.classList.add('fp-hidden');
      viewSum.classList.remove('fp-hidden');
      wrap.dataset.state = 'summary';
    }

    function setStage(kind){
      targetEl.classList.add('fp-hidden');
      centerEl.classList.add('fp-hidden');
      if(centerRingEl) centerRingEl.classList.add('fp-hidden');
      actbarEl.classList.add('fp-hidden');

      if(kind === 'punch') targetEl.classList.remove('fp-hidden');
      if(kind === 'balance'){
        if(centerRingEl) centerRingEl.classList.remove('fp-hidden');
        centerEl.classList.remove('fp-hidden');
      }
      if(kind === 'jump' || kind === 'duck') actbarEl.classList.remove('fp-hidden');
    }

    function moveTargetRandom(){
      const stage = stageEl;
      if(!stage) return;
      const r = stage.getBoundingClientRect();
      const pad = 30;
      const w = Math.min(180, r.width * 0.4);
      const h = w;
      const x = pad + rng() * (r.width - pad*2 - w);
      const y = 110 + rng() * (r.height - 160 - h);
      targetEl.style.left = (x + w/2) + 'px';
      targetEl.style.top = (y + h/2) + 'px';
    }

    // A) easier balance: accept "hold finger on stage" as continuous OK,
    // plus aim assist via lockPx when using shoot events
    function hitTestShoot(ev, lockOverride){
      const d = ev?.detail || {};
      const x = Number(d.x), y = Number(d.y);
      if(!Number.isFinite(x) || !Number.isFinite(y)) return false;

      // Punch
      if(!targetEl.classList.contains('fp-hidden')){
        const tr = targetEl.getBoundingClientRect();
        const lock = clamp(Number(lockOverride ?? d.lockPx ?? 0), 0, 140);
        return (
          x >= (tr.left - lock) && x <= (tr.right + lock) &&
          y >= (tr.top - lock) && y <= (tr.bottom + lock)
        );
      }

      // Balance
      if(!centerEl.classList.contains('fp-hidden')){
        const cr = centerEl.getBoundingClientRect();
        const cx = (cr.left + cr.right)/2, cy = (cr.top + cr.bottom)/2;
        const lock = clamp(Number(lockOverride ?? d.lockPx ?? 0), 0, 180);
        const dx = x - cx, dy = y - cy;
        return (dx*dx + dy*dy) <= (lock*lock);
      }
      return false;
    }

    function startRun(){
      if(combo.length < 3) return;

      const steps = combo.map((mv)=>({ move: mv, label: pickLabel(mv), spec: stepSpec(mv) }));
      run = {
        steps,
        i: 0,
        score: 0,
        pass: 0,
        t0: now(),
        stepT0: now(),
        stepDone: false,
        // A) balance hold tracking
        balanceHoldStart: null,
        balancePressing: false,
        // duck hold
        duckHoldStart: null,
      };

      stepTotEl.textContent = String(steps.length);
      scoreEl.textContent = '0';
      timeEl.textContent = '0.0';

      // C) rubric at start (based on created combo)
      const rb = rubricCreate(combo);
      log.push('rubric', Object.assign({ combo: combo.slice() }, rb));
      emit('hha:session', { kind:'fitness_planner', action:'rubric', ...rb });

      log.push('run_start', { combo: combo.slice(), steps: steps.map(s=>s.move) });
      emit('hha:session', { kind:'fitness_planner', action:'start', combo: combo.slice(), seed: ctx.seed>>>0 });

      showRun();
      nextStep();
      loop();
    }

    function endRun(){
      const dt = (now() - run.t0) / 1000;
      sumScore.textContent = String(run.score);
      sumPass.textContent = String(run.pass);
      sumTot.textContent = String(run.steps.length);
      sumTime.textContent = dt.toFixed(1);

      const rb = rubricCreate(combo);

      const last = {
        game: 'fitness_planner',
        ts: Date.now(),
        pid: ctx.pid || '',
        studyId: ctx.studyId || '',
        phase: ctx.phase || '',
        conditionGroup: ctx.conditionGroup || '',
        view: ctx.view || '',
        seed: ctx.seed >>> 0,
        combo: combo.slice(),
        score: run.score,
        pass: run.pass,
        total: run.steps.length,
        timeSec: Number(dt.toFixed(2)),
        rubric: rb
      };
      try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(last)); }catch(e){}

      log.push('run_end', last);
      log.flush('run_end');

      showSummary();
    }

    function nextStep(){
      if(!run) return;
      if(run.i >= run.steps.length){
        endRun();
        return;
      }

      run.stepDone = false;
      run.balanceHoldStart = null;
      run.balancePressing = false;
      run.duckHoldStart = null;

      const st = run.steps[run.i];
      const spec = st.spec;

      stepIdxEl.textContent = String(run.i + 1);
      instrEl.textContent = `ด่าน ${run.i+1}: ${st.label}`;
      setStage(spec.kind);
      barEl.style.width = '0%';

      if(spec.kind === 'punch') moveTargetRandom();
      run.stepT0 = now();

      log.push('step_start', { idx: run.i, move: st.move, kind: spec.kind });
    }

    function finishStep(ok, why){
      if(!run || run.stepDone) return;
      run.stepDone = true;

      const st = run.steps[run.i];
      const spec = st.spec;
      const dt = now() - run.stepT0;

      if(ok){
        run.pass += 1;
        run.score += spec.score;
      }
      scoreEl.textContent = String(run.score);

      log.push('step_end', {
        idx: run.i, move: st.move, kind: spec.kind,
        ok: !!ok, why: why || '',
        dtMs: Math.round(dt),
        scoreAdd: ok ? spec.score : 0,
        scoreNow: run.score
      });

      run.i += 1;
      setTimeout(nextStep, 360);
    }

    function loop(){
      if(!run) return;
      const t = now();
      const totalSec = (t - run.t0) / 1000;
      timeEl.textContent = totalSec.toFixed(1);

      const st = run.steps[run.i];
      if(!st){ requestAnimationFrame(loop); return; }
      const spec = st.spec;

      const elapsed = t - run.stepT0;
      const p = clamp(elapsed / spec.ttlMs, 0, 1);
      barEl.style.width = (p*100).toFixed(1) + '%';

      // A) Balance: if pressing, count hold (very Grade-5 friendly)
      if(spec.kind === 'balance'){
        if(run.balancePressing){
          if(run.balanceHoldStart == null){
            run.balanceHoldStart = t;
            log.push('balance_hold_start', { idx: run.i, mode:'press' });
          }
          if((t - run.balanceHoldStart) >= spec.holdMs){
            finishStep(true, 'balance_hold_press_ok');
          }
        }
      }

      // Duck hold
      if(spec.kind === 'duck'){
        if(run.duckHoldStart != null){
          if((t - run.duckHoldStart) >= spec.holdMs){
            finishStep(true, 'duck_hold_ok');
          }
        }
      }

      if(!run.stepDone && elapsed >= spec.ttlMs){
        finishStep(false, 'timeout');
      }

      requestAnimationFrame(loop);
    }

    // ----- input handlers -----
    function onPunchHit(){ finishStep(true, 'hit'); }

    function onJump(){ finishStep(true, 'jump_ok'); }

    function onDuckDown(){
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'duck') return;
      run.duckHoldStart = now();
      log.push('duck_hold_start', { idx: run.i });
    }

    function onDuckUp(){
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'duck') return;
      if(run.duckHoldStart == null) return;
      const held = now() - run.duckHoldStart;
      log.push('duck_hold_end', { idx: run.i, heldMs: Math.round(held) });
      if(held < st.spec.holdMs * 0.6){
        instrEl.textContent = `กดค้าง DUCK ให้นานขึ้นอีกนิดนะ`;
      }
    }

    // A) balance press-to-count: press anywhere on stage to hold
    function onStageDown(){
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'balance') return;
      run.balancePressing = true;
    }
    function onStageUp(){
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'balance') return;
      if(run.balancePressing){
        log.push('balance_hold_break', { idx: run.i, mode:'press' });
      }
      run.balancePressing = false;
      run.balanceHoldStart = null;
    }

    function onShoot(ev){
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      const spec = st.spec;

      // Balance (optional): shoot-based aim assist (still works), but press mode is primary
      if(spec.kind === 'balance'){
        const ok = hitTestShoot(ev, spec.lockPx);
        if(ok){
          // if not pressing, allow shoot to start hold too (bonus)
          if(!run.balancePressing){
            if(run.balanceHoldStart == null){
              run.balanceHoldStart = now();
              log.push('balance_hold_start', { idx: run.i, mode:'shoot' });
            }
            // keep holding as long as repeated shoot events remain ok
          }
        }else{
          if(!run.balancePressing){
            run.balanceHoldStart = null;
          }
        }
        return;
      }

      // Punch
      if(spec.kind === 'punch'){
        const ok = hitTestShoot(ev, 0);
        log.push('shot', { idx: run.i, ok: !!ok, source: ev?.detail?.source || '' });
        if(ok) onPunchHit();
        return;
      }
    }

    // direct tap/click on target
    targetEl.addEventListener('pointerdown', ()=>{
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind === 'punch') onPunchHit();
    });

    btnJump.addEventListener('click', ()=>{
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'jump') return;
      onJump();
    });

    btnDuck.addEventListener('pointerdown', onDuckDown);
    btnDuck.addEventListener('pointerup', onDuckUp);
    btnDuck.addEventListener('pointercancel', onDuckUp);
    btnDuck.addEventListener('pointerleave', onDuckUp);

    // Stage press for balance (A)
    if(stageEl){
      stageEl.addEventListener('pointerdown', onStageDown);
      stageEl.addEventListener('pointerup', onStageUp);
      stageEl.addEventListener('pointercancel', onStageUp);
      stageEl.addEventListener('pointerleave', onStageUp);
    }

    // Listen to vr-ui.js shoot
    WIN.addEventListener('hha:shoot', onShoot);

    // Build palette clicks
    $$('.fp-card').forEach((btn)=>{
      btn.addEventListener('click', ()=>{
        const mv = (btn.dataset.move || '').trim();
        if(!mv) return;
        addMove(mv);
      });
    });

    btnClear.addEventListener('click', clearCombo);
    btnStart.addEventListener('click', startRun);

    // Summary: save reflection
    btnSave.addEventListener('click', async ()=>{
      const diff = (DOC.querySelector('input[name="diff"]:checked') || {}).value || 'ok';
      log.push('reflect', { diff });
      emit('hha:session', { kind:'fitness_planner', action:'reflect', diff });

      try{
        const s = JSON.parse(localStorage.getItem('HHA_LAST_SUMMARY') || 'null');
        if(s && s.game === 'fitness_planner'){
          s.reflectDiff = diff;
          localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(s));
        }
      }catch(e){}

      await log.flush('reflect_save');
      btnSave.textContent = 'บันทึกแล้ว ✅';
      btnSave.disabled = true;
      setTimeout(()=>{
        btnSave.textContent = 'บันทึกผล';
        btnSave.disabled = false;
      }, 1200);
    });

    // C) copy JSON to clipboard
    if(btnCopy){
      btnCopy.addEventListener('click', async ()=>{
        let txt = '';
        try{
          const s = localStorage.getItem('HHA_LAST_SUMMARY') || '';
          txt = s || '';
        }catch(e){ txt = ''; }

        if(!txt){
          btnCopy.textContent = 'ยังไม่มีผลให้คัดลอก';
          setTimeout(()=>btnCopy.textContent='คัดลอกผล (JSON)', 900);
          return;
        }

        try{
          await navigator.clipboard.writeText(txt);
          log.push('copy_json', { ok:true });
          btnCopy.textContent = 'คัดลอกแล้ว ✅';
        }catch(e){
          // fallback: prompt
          try{ WIN.prompt('คัดลอกผล (JSON):', txt); }catch(_){}
          log.push('copy_json', { ok:false });
          btnCopy.textContent = 'คัดลอกด้วยหน้าต่าง ✅';
        }
        setTimeout(()=>btnCopy.textContent='คัดลอกผล (JSON)', 900);
      });
    }

    // Summary: retry
    btnRetry.addEventListener('click', ()=>{
      log.push('retry', { combo: combo.slice() });
      showBuild();
    });

    // Back hub: flush before leaving
    backHub.addEventListener('click', async ()=>{
      try{
        log.push('back_hub', {});
        await log.flush('back_hub');
      }catch(err){}
      unHarden && unHarden();
    });

    // init UI
    showBuild();
    setCount();
    renderCombo();

    log.push('ready', { view: ctx.view, seed: ctx.seed>>>0 });
    emit('hha:session', { kind:'fitness_planner', action:'ready', view: ctx.view, seed: ctx.seed>>>0 });
  }

  WIN.HHA_FITNESS_PLANNER = { boot };
})();