// === HeroHealth — Fitness Planner SAFE Engine (Standalone) ===
// VR/cVR ready, uses vr-ui.js => hha:shoot
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const $ = (s)=>DOC.querySelector(s);

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
    // Designed for Grade 5: short, clear, forgiving but still fun
    switch(move){
      case 'punch_shadow':
      case 'punch_rhythm':
        return { kind:'punch', ttlMs: 2200, score: 10 };
      case 'jump':
        return { kind:'jump', ttlMs: 2200, score: 8 };
      case 'duck':
        return { kind:'duck', ttlMs: 1800, holdMs: 900, score: 9 };
      case 'balance':
        return { kind:'balance', ttlMs: 2600, holdMs: 1200, lockPx: 34, score: 12 };
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
        // fallback: console only
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
        // if fail, restore (best effort)
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
    const backHub = $('#fp-backhub');

    let combo = []; // array of move ids (3-5)
    let run = null;

    function setCount(){
      countEl.textContent = String(combo.length);
      btnStart.disabled = !(combo.length >= 3 && combo.length <= 5);
    }

    function renderCombo(){
      comboEl.innerHTML = '';
      combo.forEach((mv, i)=>{
        const b = DOC.createElement('button');
        b.type = 'button';
        b.className = 'fp-chip';
        b.dataset.idx = String(i);
        b.innerHTML = `<span class="t">${pickLabel(mv)}</span><span class="x">✕</span>`;
        b.addEventListener('click', ()=>{
          const idx = Number(b.dataset.idx);
          if(Number.isFinite(idx)){
            combo.splice(idx, 1);
            renderCombo(); setCount();
            log.push('combo_remove', { idx, move: mv, combo: combo.slice() });
          }
        });
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
      actbarEl.classList.add('fp-hidden');
      if(kind === 'punch') targetEl.classList.remove('fp-hidden');
      if(kind === 'balance') centerEl.classList.remove('fp-hidden');
      if(kind === 'jump' || kind === 'duck') actbarEl.classList.remove('fp-hidden');
      if(kind === 'duck') actbarEl.classList.remove('fp-hidden');
    }

    function moveTargetRandom(){
      // place within stage bounds, avoid HUD top; forgiving for kids
      const stage = viewRun.querySelector('.fp-stage');
      if(!stage) return;
      const r = stage.getBoundingClientRect();
      const pad = 30;
      const w = Math.min(180, r.width * 0.4);
      const h = w;
      const x = pad + rng() * (r.width - pad*2 - w);
      const y = 110 + rng() * (r.height - 160 - h); // keep away from title/progress area
      targetEl.style.left = (x + w/2) + 'px';
      targetEl.style.top = (y + h/2) + 'px';
    }

    function hitTestShoot(ev){
      // ev.detail: {x,y,lockPx,source} (from vr-ui.js)
      const d = ev?.detail || {};
      const x = Number(d.x), y = Number(d.y);
      if(!Number.isFinite(x) || !Number.isFinite(y)) return false;

      // Punch: within target rect (plus lockPx assist)
      if(!targetEl.classList.contains('fp-hidden')){
        const tr = targetEl.getBoundingClientRect();
        const lock = clamp(Number(d.lockPx || 0), 0, 80);
        const inside =
          x >= (tr.left - lock) && x <= (tr.right + lock) &&
          y >= (tr.top - lock) && y <= (tr.bottom + lock);
        return inside;
      }

      // Balance: must be close to screen center dot area (use lockPx)
      if(!centerEl.classList.contains('fp-hidden')){
        const cr = centerEl.getBoundingClientRect();
        const lock = clamp(Number(d.lockPx || 0), 0, 120);
        const cx = (cr.left + cr.right)/2, cy = (cr.top + cr.bottom)/2;
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
        balanceHoldStart: null,
        duckHoldStart: null
      };

      stepTotEl.textContent = String(steps.length);
      scoreEl.textContent = '0';
      timeEl.textContent = '0.0';

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

      // save last summary (HHA style)
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
        timeSec: Number(dt.toFixed(2))
      };
      try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(last)); }catch(e){}

      log.push('run_end', last);
      log.flush('run_end'); // best effort now

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
      run.duckHoldStart = null;

      const st = run.steps[run.i];
      const spec = st.spec;

      stepIdxEl.textContent = String(run.i + 1);

      // instruction
      instrEl.textContent = `ด่าน ${run.i+1}: ${st.label}`;

      setStage(spec.kind);
      barEl.style.width = '0%';

      // move target if punch
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
      // small delay for readability (kid-friendly)
      setTimeout(nextStep, 380);
    }

    function loop(){
      if(!run) return;
      const t = now();
      const totalSec = (t - run.t0) / 1000;
      timeEl.textContent = totalSec.toFixed(1);

      const st = run.steps[run.i];
      if(!st){
        requestAnimationFrame(loop);
        return;
      }
      const spec = st.spec;
      const elapsed = t - run.stepT0;
      const p = clamp(elapsed / spec.ttlMs, 0, 1);
      barEl.style.width = (p*100).toFixed(1) + '%';

      // balance / duck hold detection
      if(spec.kind === 'balance'){
        // hold aim at center using hha:shoot + lockPx -> accumulate hold time
        // if user doesn't "shoot", they can still tap target by screen center (vr-ui sends shoot on tap)
        // here we just check state variables updated by events
        if(run.balanceHoldStart != null){
          if((t - run.balanceHoldStart) >= spec.holdMs){
            finishStep(true, 'balance_hold_ok');
          }
        }
      }

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
    function onPunchHit(){
      finishStep(true, 'hit');
    }

    function onJump(){
      finishStep(true, 'jump_ok');
    }

    function onDuckDown(){
      // start hold
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'duck') return;
      run.duckHoldStart = now();
      log.push('duck_hold_start', { idx: run.i });
    }

    function onDuckUp(){
      // if released too early, fail softly (but still time-based)
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'duck') return;
      if(run.duckHoldStart == null) return;
      const held = now() - run.duckHoldStart;
      log.push('duck_hold_end', { idx: run.i, heldMs: Math.round(held) });
      // don't auto-fail; let timer continue (kid-friendly)
      if(held < st.spec.holdMs * 0.6){
        // gentle hint
        instrEl.textContent = `กดค้าง DUCK ให้นานขึ้นอีกนิดนะ`;
      }
    }

    function onShoot(ev){
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      const spec = st.spec;

      // balance: treat valid aim as "hold started" (continuous)
      if(spec.kind === 'balance'){
        const ok = hitTestShoot(ev);
        if(ok){
          if(run.balanceHoldStart == null){
            run.balanceHoldStart = now();
            log.push('balance_hold_start', { idx: run.i });
          }
        }else{
          if(run.balanceHoldStart != null){
            log.push('balance_hold_break', { idx: run.i });
          }
          run.balanceHoldStart = null;
        }
        return;
      }

      // punch: hit if within target rect (+ lockPx)
      if(spec.kind === 'punch'){
        const ok = hitTestShoot(ev);
        log.push('shot', { idx: run.i, ok: !!ok, source: ev?.detail?.source || '' });
        if(ok) onPunchHit();
        return;
      }

      // other kinds: ignore shoots
    }

    // direct tap/click on target (mobile/pc friendly)
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

    // Listen to vr-ui.js shoot
    WIN.addEventListener('hha:shoot', onShoot);

    // Build palette clicks
    DOC.querySelectorAll('.fp-card').forEach((btn)=>{
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

      // merge into last summary
      try{
        const s = JSON.parse(localStorage.getItem('HHA_LAST_SUMMARY') || 'null');
        if(s && s.game === 'fitness_planner'){
          s.reflectDiff = diff;
          localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(s));
        }
      }catch(e){}

      await log.flush('reflect_save');
      instrEl.textContent = 'บันทึกแล้ว ✅';
      btnSave.textContent = 'บันทึกแล้ว';
      btnSave.disabled = true;
      setTimeout(()=>{
        btnSave.textContent = 'บันทึกผล';
        btnSave.disabled = false;
      }, 1200);
    });

    // Summary: retry
    btnRetry.addEventListener('click', ()=>{
      // reset UI only; keep same combo
      log.push('retry', { combo: combo.slice() });
      showBuild();
      // quick auto-start again if you want:
      // startRun();
    });

    // Back hub: flush before leaving
    backHub.addEventListener('click', async (e)=>{
      try{
        log.push('back_hub', {});
        await log.flush('back_hub');
      }catch(err){}
      // allow navigation
      unHarden && unHarden();
    });

    // init UI
    showBuild();
    setCount();
    renderCombo();

    // emit ready
    log.push('ready', { view: ctx.view, seed: ctx.seed>>>0 });
    emit('hha:session', { kind:'fitness_planner', action:'ready', view: ctx.view, seed: ctx.seed>>>0 });
  }

  WIN.HHA_FITNESS_PLANNER = { boot };
})();