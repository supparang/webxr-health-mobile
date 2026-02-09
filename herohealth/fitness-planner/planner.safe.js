// === HeroHealth — Fitness Planner SAFE Engine (Standalone) ===
// FULL PATCH v20260209-ABC123
// A) Balance easier for Grade 5: assist ring + press/hold-to-count
// B) Combo drag/touch reorder + explicit ✕ remove
// C) Research rubric + Copy JSON
// 1) Badges
// 2) FX pop + SFX (WebAudio)
// 3) Practice 15s (skipable) then auto-start real run

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const $ = (s)=>DOC.querySelector(s);
  const $$ = (s)=>Array.from(DOC.querySelectorAll(s));

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function nowMs(){ return performance.now(); }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
  }

  function qsp(){
    try{ return new URL(location.href).searchParams; }
    catch{ return new URLSearchParams(); }
  }
  const QS = qsp();
  const q = (k, d='') => (QS.get(k) ?? d);

  // --- deterministic RNG (seeded) ---
  function hash32(s){
    let h = 2166136261 >>> 0;
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seedU32){
    let x = (seedU32 >>> 0) || 123456789;
    return function rng(){
      // xorshift32
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17; x >>>= 0;
      x ^= x << 5;  x >>>= 0;
      return (x >>> 0) / 4294967296;
    };
  }

  // ---------- labels ----------
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

  // ---------- step specs ----------
  function stepSpec(move){
    // Grade 5 friendly
    switch(move){
      case 'punch_shadow':
      case 'punch_rhythm':
        return { kind:'punch', ttlMs: 2200, score: 10 };
      case 'jump':
        return { kind:'jump', ttlMs: 2200, score: 8 };
      case 'duck':
        return { kind:'duck', ttlMs: 1900, holdMs: 900, score: 9 };
      case 'balance':
        // A) easier: press/hold and larger lock (shoot assist)
        return { kind:'balance', ttlMs: 2800, holdMs: 1100, lockPx: 80, score: 12 };
      default:
        return { kind:'punch', ttlMs: 2200, score: 10 };
    }
  }

  // ---------- logger (optional ?log= endpoint) ----------
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
        seed: (ctx.seed >>> 0)
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

  // ---------- rubric (C) ----------
  function rubricCreate(combo){
    const moves = Array.isArray(combo) ? combo : [];
    const len = moves.length;
    const uniq = new Set(moves);
    const uniqueCount = uniq.size;

    const hasBalance = uniq.has('balance');
    const hasPunch = uniq.has('punch_shadow') || uniq.has('punch_rhythm');
    const hasJump = uniq.has('jump');
    const hasDuck = uniq.has('duck');

    // explainable 0–10
    let score = 0;
    if(len >= 3) score += 2;
    if(len >= 4) score += 1;
    if(len >= 5) score += 1;

    if(uniqueCount >= 2) score += 2;
    if(uniqueCount >= 3) score += 2;
    if(uniqueCount >= 4) score += 1;

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

  // ---------- FX / SFX (2) ----------
  let __fpAudio = null;

  function sfx(type='ok'){
    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AC) return;
      if(!__fpAudio) __fpAudio = new AC();
      const ac = __fpAudio;
      if(ac.state === 'suspended') ac.resume().catch(()=>{});

      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);

      const t0 = ac.currentTime;
      const dur = (type==='end') ? 0.22 : (type==='bad') ? 0.14 : 0.10;
      const f0 = (type==='end') ? 740 : (type==='bad') ? 180 : 520;
      const f1 = (type==='end') ? 980 : (type==='bad') ? 120 : 720;

      o.frequency.setValueAtTime(f0, t0);
      o.frequency.linearRampToValueAtTime(f1, t0 + dur);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.10, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }catch(e){}
  }

  function fxPop(fxLayer, text, x, y){
    if(!fxLayer) return;
    const p = DOC.createElement('div');
    p.className = 'fp-pop';
    p.textContent = text;
    p.style.left = (Number(x)|| (WIN.innerWidth/2)) + 'px';
    p.style.top  = (Number(y)|| (WIN.innerHeight/2)) + 'px';
    fxLayer.appendChild(p);
    setTimeout(()=>{ try{ p.remove(); }catch(e){} }, 650);
  }

  // ---------- Badges (1) ----------
  function computeBadges(last){
    const rb = last?.rubric || {};
    const b = [];

    if((rb.createScore||0) >= 9) b.push({ icon:'👑', title:'Creator King' });
    else if((rb.createScore||0) >= 7) b.push({ icon:'🧠', title:'Smart Planner' });
    else if((rb.createScore||0) >= 5) b.push({ icon:'✨', title:'Good Try' });

    if(rb.hasBalance) b.push({ icon:'⚖️', title:'Balance Pro' });
    if((rb.len||0) >= 5) b.push({ icon:'🔥', title:'Combo Master' });
    if((last.pass||0) === (last.total||999)) b.push({ icon:'🏅', title:'Perfect!' });

    return b.slice(0, 4);
  }

  function renderBadges(badgesEl, list){
    if(!badgesEl) return;
    badgesEl.innerHTML = '';
    if(!list || !list.length){
      badgesEl.classList.add('fp-hidden');
      return;
    }
    badgesEl.classList.remove('fp-hidden');
    list.forEach((it)=>{
      const d = DOC.createElement('div');
      d.className = 'fp-badge';
      d.innerHTML = `<span class="i">${it.icon}</span><span class="t">${it.title}</span>`;
      badgesEl.appendChild(d);
    });
  }

  // ---------- hit test helper for shoot events ----------
  function hitTestShootForPunch(targetEl, ev, lockOverride){
    const d = ev?.detail || {};
    const x = Number(d.x), y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return false;

    const tr = targetEl.getBoundingClientRect();
    const lock = clamp(Number(lockOverride ?? d.lockPx ?? 0), 0, 140);
    return (
      x >= (tr.left - lock) && x <= (tr.right + lock) &&
      y >= (tr.top - lock) && y <= (tr.bottom + lock)
    );
  }

  function hitTestShootForBalance(centerEl, ev, lockPx){
    const d = ev?.detail || {};
    const x = Number(d.x), y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return false;

    const cr = centerEl.getBoundingClientRect();
    const cx = (cr.left + cr.right)/2, cy = (cr.top + cr.bottom)/2;

    const lock = clamp(Number(lockPx ?? d.lockPx ?? 0), 0, 180);
    const dx = x - cx, dy = y - cy;
    return (dx*dx + dy*dy) <= (lock*lock);
  }

  // =========================
  // PUBLIC BOOT
  // =========================
  function boot({ ctx }){
    const log = makeLogger(ctx);
    const unHarden = log.harden();

    // UI elements
    const wrap = $('#fp-wrap');

    const viewBuild = $('#fp-view-build');
    const viewPractice = $('#fp-view-practice');
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

    const stageEl = viewRun ? viewRun.querySelector('.fp-stage') : null;

    const targetEl = $('#fp-target');
    const centerRingEl = $('#fp-centerRing');
    const centerEl = $('#fp-center');
    const actbarEl = $('#fp-actbar');
    const btnJump = $('#fp-btn-jump');
    const btnDuck = $('#fp-btn-duck');

    const sumScore = $('#fp-sum-score');
    const sumPass  = $('#fp-sum-pass');
    const sumTot   = $('#fp-sum-total');
    const sumTime  = $('#fp-sum-time');
    const sumCreate = $('#fp-sum-create');

    const badgesEl = $('#fp-badges');
    const fxLayer  = $('#fp-fx');

    const btnSave = $('#fp-save');
    const btnRetry = $('#fp-retry');
    const btnCopy = $('#fp-copy');
    const backHub = $('#fp-backhub');

    // Practice elements
    const practiceLeftEl = $('#fp-practice-left');
    const practiceHintEl = $('#fp-practice-hint');
    const practiceTargetEl = $('#fp-practice-target');
    const btnSkipPractice = $('#fp-skip-practice');

    // Context header (optional)
    const ctxView = $('#fp-ctx-view');
    const ctxSeed = $('#fp-ctx-seed');

    // Seed & RNG
    const seedStr = String(q('seed','') || ctx.seed || '');
    const seedU32 = (Number(seedStr) >>> 0) || hash32(seedStr || (Date.now()+'')) || 123456789;
    ctx.seed = seedU32;

    const rng = makeRng(seedU32);

    if(ctxView) ctxView.textContent = ctx.view || q('view','') || '-';
    if(ctxSeed) ctxSeed.textContent = String(seedU32);

    // State
    let combo = [];
    let run = null;

    // Drag state (B)
    let dragState = { active:false, idx:-1, el:null, pointerId:null };

    function setCount(){
      countEl.textContent = String(combo.length);
      btnStart.disabled = !(combo.length >= 3 && combo.length <= 5);
    }

    // B) explicit ✕ remove + drag reorder
    function renderCombo(){
      comboEl.innerHTML = '';
      combo.forEach((mv, i)=>{
        const chip = DOC.createElement('div');
        chip.className = 'fp-chip';
        chip.dataset.idx = String(i);

        const t = DOC.createElement('span');
        t.className = 't';
        t.textContent = pickLabel(mv);

        const x = DOC.createElement('button');
        x.type = 'button';
        x.className = 'x';
        x.textContent = '✕';
        x.style.border = '0';
        x.style.background = 'transparent';
        x.style.color = 'var(--muted)';
        x.style.fontWeight = '1000';
        x.style.cursor = 'pointer';

        x.addEventListener('click', (ev)=>{
          ev.stopPropagation();
          const idx = Number(chip.dataset.idx);
          if(Number.isFinite(idx)){
            const removed = combo.splice(idx, 1)[0];
            renderCombo(); setCount();
            log.push('combo_remove', { idx, move: removed, combo: combo.slice() });
          }
        });

        chip.appendChild(t);
        chip.appendChild(x);

        chip.addEventListener('pointerdown', (ev)=>{
          if(ev.target === x) return;
          dragState.active = true;
          dragState.idx = Number(chip.dataset.idx);
          dragState.el = chip;
          dragState.pointerId = ev.pointerId;

          chip.classList.add('fp-dragging');
          chip.setPointerCapture(ev.pointerId);

          log.push('drag_start', { idx: dragState.idx, move: mv });
          ev.preventDefault();
        });

        chip.addEventListener('pointermove', (ev)=>{
          if(!dragState.active || dragState.el !== chip || dragState.pointerId !== ev.pointerId) return;

          const el = DOC.elementFromPoint(ev.clientX, ev.clientY);
          const other = el ? el.closest('.fp-chip') : null;
          if(!other || other === chip) return;

          const from = dragState.idx;
          const to = Number(other.dataset.idx);
          if(!Number.isFinite(to) || to === from) return;

          const item = combo.splice(from, 1)[0];
          combo.splice(to, 0, item);
          dragState.idx = to;

          renderCombo(); setCount();
          log.push('drag_reorder', { from, to, combo: combo.slice() });
        });

        const endDrag = ()=>{
          if(!dragState.active || dragState.el !== chip) return;
          dragState.active = false;
          dragState.pointerId = null;
          dragState.idx = -1;
          dragState.el = null;
          chip.classList.remove('fp-dragging');
          log.push('drag_end', { combo: combo.slice() });
        };

        chip.addEventListener('pointerup', endDrag);
        chip.addEventListener('pointercancel', endDrag);

        comboEl.appendChild(chip);
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
      viewBuild?.classList.remove('fp-hidden');
      viewPractice?.classList.add('fp-hidden');
      viewRun?.classList.add('fp-hidden');
      viewSum?.classList.add('fp-hidden');
      wrap.dataset.state = 'build';
    }

    function showPractice(){
      viewBuild?.classList.add('fp-hidden');
      viewPractice?.classList.remove('fp-hidden');
      viewRun?.classList.add('fp-hidden');
      viewSum?.classList.add('fp-hidden');
      wrap.dataset.state = 'practice';
    }

    function showRun(){
      viewBuild?.classList.add('fp-hidden');
      viewPractice?.classList.add('fp-hidden');
      viewRun?.classList.remove('fp-hidden');
      viewSum?.classList.add('fp-hidden');
      wrap.dataset.state = 'run';
    }

    function showSummary(){
      viewBuild?.classList.add('fp-hidden');
      viewPractice?.classList.add('fp-hidden');
      viewRun?.classList.add('fp-hidden');
      viewSum?.classList.remove('fp-hidden');
      wrap.dataset.state = 'summary';
    }

    function setStage(kind){
      targetEl?.classList.add('fp-hidden');
      centerEl?.classList.add('fp-hidden');
      centerRingEl?.classList.add('fp-hidden');
      actbarEl?.classList.add('fp-hidden');

      if(kind === 'punch') targetEl?.classList.remove('fp-hidden');
      if(kind === 'balance'){
        centerRingEl?.classList.remove('fp-hidden');
        centerEl?.classList.remove('fp-hidden');
      }
      if(kind === 'jump' || kind === 'duck') actbarEl?.classList.remove('fp-hidden');
    }

    function moveTargetRandom(){
      if(!stageEl || !targetEl) return;
      const r = stageEl.getBoundingClientRect();
      const pad = 30;
      const w = Math.min(180, r.width * 0.4);
      const h = w;
      const x = pad + rng() * (r.width - pad*2 - w);
      const y = 110 + rng() * (r.height - 160 - h);
      targetEl.style.left = (x + w/2) + 'px';
      targetEl.style.top  = (y + h/2) + 'px';
    }

    // =========================
    // PRACTICE 15s (3)
    // =========================
    let practiceTimer = null;
    let practiceLeft = 15;

    function startPracticeThenRun(){
      if(!viewPractice || !practiceTargetEl){
        // fallback: if practice view not present, start real run immediately
        startRunCore();
        return;
      }

      showPractice();
      practiceLeft = 15;
      if(practiceLeftEl) practiceLeftEl.textContent = String(practiceLeft);

      if(practiceHintEl){
        practiceHintEl.textContent = 'ลอง “ต่อย” โดยแตะที่เป้า หรือเล็งกากบาทแล้วแตะจอ';
      }

      const box = viewPractice.querySelector('.fp-practiceStage');
      const movePracticeTarget = ()=>{
        if(!box || !practiceTargetEl) return;
        const r = box.getBoundingClientRect();
        const w = Math.min(180, r.width*0.45);
        const pad = 20;
        const x = pad + rng()*(r.width - pad*2 - w);
        const y = 20 + rng()*(r.height - 60 - w);
        practiceTargetEl.style.left = (x + w/2) + 'px';
        practiceTargetEl.style.top  = (y + w/2) + 'px';
      };

      const onHit = (x,y)=>{
        sfx('ok');
        fxPop(fxLayer, '✅ เยี่ยม!', x||WIN.innerWidth*0.5, y||WIN.innerHeight*0.38);
        movePracticeTarget();
      };

      const onTap = (ev)=>{
        onHit(ev?.clientX, ev?.clientY);
      };

      const onShootPractice = (ev)=>{
        if(!practiceTargetEl) return;
        const d = ev?.detail || {};
        const x = Number(d.x), y = Number(d.y);
        if(!Number.isFinite(x) || !Number.isFinite(y)) return;

        const tr = practiceTargetEl.getBoundingClientRect();
        const lock = clamp(Number(d.lockPx||34), 0, 120);
        const ok = x >= tr.left-lock && x <= tr.right+lock && y >= tr.top-lock && y <= tr.bottom+lock;
        if(ok) onHit(x,y);
      };

      function cleanup(){
        try{ practiceTargetEl.removeEventListener('pointerdown', onTap); }catch(e){}
        WIN.removeEventListener('hha:shoot', onShootPractice);
        if(practiceTimer) clearInterval(practiceTimer);
        practiceTimer = null;
      }

      practiceTargetEl.addEventListener('pointerdown', onTap);
      WIN.addEventListener('hha:shoot', onShootPractice);

      btnSkipPractice?.addEventListener('click', ()=>{
        cleanup();
        startRunCore();
      }, { once:true });

      movePracticeTarget();
      log.push('practice_start', { sec: 15 });

      practiceTimer = setInterval(()=>{
        practiceLeft -= 1;
        if(practiceLeftEl) practiceLeftEl.textContent = String(practiceLeft);
        if(practiceLeft <= 0){
          cleanup();
          log.push('practice_end', {});
          startRunCore();
        }
      }, 1000);
    }

    // =========================
    // RUN CORE
    // =========================
    let rafId = 0;

    function stopLoop(){
      if(rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function loop(){
      if(!run) return;
      const t = nowMs();

      const totalSec = (t - run.t0) / 1000;
      timeEl.textContent = totalSec.toFixed(1);

      const st = run.steps[run.i];
      if(!st){
        rafId = requestAnimationFrame(loop);
        return;
      }
      const spec = st.spec;

      const elapsed = t - run.stepT0;
      const p = clamp(elapsed / spec.ttlMs, 0, 1);
      barEl.style.width = (p*100).toFixed(1) + '%';

      // A) balance: press/hold-to-count
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

      // duck hold
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

      rafId = requestAnimationFrame(loop);
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
      run.stepT0 = nowMs();

      log.push('step_start', { idx: run.i, move: st.move, kind: spec.kind });
    }

    function finishStep(ok, why){
      if(!run || run.stepDone) return;
      run.stepDone = true;

      const st = run.steps[run.i];
      const spec = st.spec;
      const dt = nowMs() - run.stepT0;

      if(ok){
        run.pass += 1;
        run.score += spec.score;
        sfx('ok');
        fxPop(fxLayer, `✅ +${spec.score}`, WIN.innerWidth*0.5, WIN.innerHeight*0.32);
      }else{
        sfx('bad');
        fxPop(fxLayer, `⏱️ ลองใหม่!`, WIN.innerWidth*0.5, WIN.innerHeight*0.32);
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

    function startRunCore(){
      if(combo.length < 3) return;

      const steps = combo.map((mv)=>({ move: mv, label: pickLabel(mv), spec: stepSpec(mv) }));
      run = {
        steps,
        i: 0,
        score: 0,
        pass: 0,
        t0: nowMs(),
        stepT0: nowMs(),
        stepDone: false,
        balanceHoldStart: null,
        balancePressing: false,
        duckHoldStart: null,
      };

      stepTotEl.textContent = String(steps.length);
      scoreEl.textContent = '0';
      timeEl.textContent = '0.0';

      // C) rubric at run start
      const rb = rubricCreate(combo);
      log.push('rubric', Object.assign({ combo: combo.slice() }, rb));
      emit('hha:session', { kind:'fitness_planner', action:'rubric', ...rb });

      log.push('run_start', { combo: combo.slice(), steps: steps.map(s=>s.move) });
      emit('hha:session', { kind:'fitness_planner', action:'start', combo: combo.slice(), seed: ctx.seed>>>0 });

      showRun();
      nextStep();
      stopLoop();
      loop();
    }

    function endRun(){
      if(!run) return;

      stopLoop();

      const dt = (nowMs() - run.t0) / 1000;
      sumScore.textContent = String(run.score);
      sumPass.textContent = String(run.pass);
      sumTot.textContent = String(run.steps.length);
      sumTime.textContent = dt.toFixed(1);

      const rb = rubricCreate(combo);
      if(sumCreate) sumCreate.textContent = String(rb.createScore);
      log.push('rubric_summary', rb);

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

      // 1) badges
      const b = computeBadges(last);
      renderBadges(badgesEl, b);
      log.push('badges', { items: b });

      log.push('run_end', last);
      log.flush('run_end');

      sfx('end');
      fxPop(fxLayer, '🏁 จบแล้ว!', WIN.innerWidth*0.5, WIN.innerHeight*0.28);

      showSummary();
    }

    // =========================
    // INPUTS
    // =========================

    // Direct tap/click on target for punch
    targetEl?.addEventListener('pointerdown', (ev)=>{
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind === 'punch') finishStep(true, 'hit_ptr');
    });

    // Jump
    btnJump?.addEventListener('click', ()=>{
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'jump') return;
      finishStep(true, 'jump_ok');
    });

    // Duck hold
    btnDuck?.addEventListener('pointerdown', ()=>{
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'duck') return;
      run.duckHoldStart = nowMs();
      log.push('duck_hold_start', { idx: run.i });
    });
    function duckUp(){
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'duck') return;
      if(run.duckHoldStart == null) return;
      const held = nowMs() - run.duckHoldStart;
      log.push('duck_hold_end', { idx: run.i, heldMs: Math.round(held) });
      if(held < st.spec.holdMs * 0.6){
        instrEl.textContent = `กดค้าง DUCK ให้นานขึ้นอีกนิดนะ`;
      }
    }
    btnDuck?.addEventListener('pointerup', duckUp);
    btnDuck?.addEventListener('pointercancel', duckUp);
    btnDuck?.addEventListener('pointerleave', duckUp);

    // A) Balance press/hold: press anywhere on stage counts
    function stageDown(){
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'balance') return;
      run.balancePressing = true;
    }
    function stageUp(){
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'balance') return;
      if(run.balancePressing){
        log.push('balance_hold_break', { idx: run.i, mode:'press' });
      }
      run.balancePressing = false;
      run.balanceHoldStart = null;
    }
    stageEl?.addEventListener('pointerdown', stageDown);
    stageEl?.addEventListener('pointerup', stageUp);
    stageEl?.addEventListener('pointercancel', stageUp);
    stageEl?.addEventListener('pointerleave', stageUp);

    // Shoot events from vr-ui.js
    function onShoot(ev){
      if(!run) return;
      const st = run.steps[run.i]; if(!st) return;
      const spec = st.spec;

      // Punch: shoot must hit target rect
      if(spec.kind === 'punch' && targetEl){
        const ok = hitTestShootForPunch(targetEl, ev, 0);
        log.push('shot', { idx: run.i, ok: !!ok, source: ev?.detail?.source || '' });
        if(ok) finishStep(true, 'hit_shoot');
        return;
      }

      // Balance: optional aim-based hold (bonus). Press mode is primary.
      if(spec.kind === 'balance' && centerEl){
        const ok = hitTestShootForBalance(centerEl, ev, spec.lockPx);
        if(ok && !run.balancePressing){
          // if user keeps shooting on center, it behaves like hold
          if(run.balanceHoldStart == null){
            run.balanceHoldStart = nowMs();
            log.push('balance_hold_start', { idx: run.i, mode:'shoot' });
          }
        }else if(!ok && !run.balancePressing){
          run.balanceHoldStart = null;
        }
      }
    }
    WIN.addEventListener('hha:shoot', onShoot);

    // =========================
    // BUILD UI
    // =========================
    $$('.fp-card').forEach((btn)=>{
      btn.addEventListener('click', ()=>{
        const mv = (btn.dataset.move || '').trim();
        if(!mv) return;
        addMove(mv);
      });
    });

    btnClear?.addEventListener('click', clearCombo);

    // Start => Practice => Run
    btnStart?.addEventListener('click', ()=>{
      if(combo.length < 3) return;
      startPracticeThenRun();
    });

    // =========================
    // SUMMARY UI
    // =========================
    btnSave?.addEventListener('click', async ()=>{
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

    // Copy JSON
    btnCopy?.addEventListener('click', async ()=>{
      let txt = '';
      try{ txt = localStorage.getItem('HHA_LAST_SUMMARY') || ''; }catch(e){ txt = ''; }

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
        try{ WIN.prompt('คัดลอกผล (JSON):', txt); }catch(_){}
        log.push('copy_json', { ok:false });
        btnCopy.textContent = 'คัดลอกด้วยหน้าต่าง ✅';
      }
      setTimeout(()=>btnCopy.textContent='คัดลอกผล (JSON)', 900);
    });

    btnRetry?.addEventListener('click', ()=>{
      log.push('retry', { combo: combo.slice() });
      run = null;
      showBuild();
    });

    backHub?.addEventListener('click', async ()=>{
      try{
        log.push('back_hub', {});
        await log.flush('back_hub');
      }catch(err){}
      unHarden && unHarden();
    });

    // Init
    showBuild();
    setCount();
    renderCombo();

    log.push('ready', { view: ctx.view, seed: ctx.seed>>>0 });
    emit('hha:session', { kind:'fitness_planner', action:'ready', view: ctx.view, seed: ctx.seed>>>0 });
  }

  WIN.HHA_FITNESS_PLANNER = { boot };
})();