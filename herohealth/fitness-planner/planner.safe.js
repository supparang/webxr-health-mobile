// === HeroHealth — Fitness Planner SAFE Engine (FULL) ===
// FUN PACK + RESEARCH PACK — v20260210a
// ✅ Build combo (3–5 moves) + drag reorder + ✕ remove
// ✅ Practice 15s (skip) -> run
// ✅ Boss INSERT after step 3 (telegraph + 3 patterns; deterministic in research)
// ✅ Streak bonus, Fever (play only)
// ✅ Missions (play random / research fixed), Power-ups (play only)
// ✅ Hero EXP/Level (saved)
// ✅ Difficulty Director (play only) + AI Coach micro-tips (play only)
// ✅ Copy JSON + CSV(1 row) + Events CSV (HHA-ish schema)
// ✅ Local last summary: HHA_LAST_SUMMARY
// Emits (optional): hha:event

'use strict';

(function(){
  const WIN = window, DOC = document;
  if(!DOC) return;

  const $ = (s)=>DOC.querySelector(s);
  const $$ = (s)=>Array.from(DOC.querySelectorAll(s));

  const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
  const nowMs = ()=>performance.now();

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
  }

  function qsp(){
    try{ return new URL(location.href).searchParams; }
    catch{ return new URLSearchParams(); }
  }
  const QS = qsp();
  const q = (k, d='') => (QS.get(k) ?? d);

  // ------------------ deterministic RNG ------------------
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
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17; x >>>= 0;
      x ^= x << 5;  x >>>= 0;
      return (x >>> 0) / 4294967296;
    };
  }

  // ------------------ audio sfx (no assets) ------------------
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

  function fxPop(layer, text, x, y){
    if(!layer) return;
    const p = DOC.createElement('div');
    p.className = 'fp-pop';
    p.textContent = text;
    p.style.left = (Number(x)|| (WIN.innerWidth/2)) + 'px';
    p.style.top  = (Number(y)|| (WIN.innerHeight/2)) + 'px';
    layer.appendChild(p);
    setTimeout(()=>{ try{ p.remove(); }catch(e){} }, 650);
  }

  // ------------------ labels & specs ------------------
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
    switch(move){
      case 'punch_shadow':
      case 'punch_rhythm':
        return { kind:'punch', ttlMs: 2200, score: 10, lockPx: 28 };
      case 'jump':
        return { kind:'jump', ttlMs: 2200, score: 8, lockPx: 28 };
      case 'duck':
        return { kind:'duck', ttlMs: 1900, holdMs: 900, score: 9, lockPx: 28 };
      case 'balance':
        return { kind:'balance', ttlMs: 2800, holdMs: 1100, lockPx: 80, score: 12 };
      default:
        return { kind:'punch', ttlMs: 2200, score: 10, lockPx: 28 };
    }
  }

  // ------------------ rubric (Create score 0–10) ------------------
  function rubricCreate(combo){
    const moves = Array.isArray(combo) ? combo : [];
    const len = moves.length;
    const uniq = new Set(moves);
    const uniqueCount = uniq.size;

    const hasBalance = uniq.has('balance');
    const hasPunch = uniq.has('punch_shadow') || uniq.has('punch_rhythm');
    const hasJump = uniq.has('jump');
    const hasDuck = uniq.has('duck');

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
    return { createScore: score, len, uniqueCount, hasBalance, hasPunch, hasJump, hasDuck };
  }

  // ------------------ badges ------------------
  function computeBadges(last){
    const rb = last?.rubric || {};
    const b = [];

    if((rb.createScore||0) >= 9) b.push({ icon:'👑', title:'Creator King' });
    else if((rb.createScore||0) >= 7) b.push({ icon:'🧠', title:'Smart Planner' });
    else if((rb.createScore||0) >= 5) b.push({ icon:'✨', title:'Good Try' });

    if(rb.hasBalance) b.push({ icon:'⚖️', title:'Balance Pro' });
    if((rb.len||0) >= 5) b.push({ icon:'🔥', title:'Combo Master' });
    if((last.pass||0) === (last.total||999)) b.push({ icon:'🏅', title:'Perfect!' });

    if(last?.bossCleared) b.push({ icon:'👾', title:'Boss Slayer' });
    if((last?.maxStreak||0) >= 6) b.push({ icon:'⚡', title:'Streak Hero' });

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

  // ------------------ hero (level/exp) ------------------
  function getHero(){
    try{ return JSON.parse(localStorage.getItem('FP_HERO')||'null') || { level:1, exp:0 }; }
    catch{ return { level:1, exp:0 }; }
  }
  function saveHero(h){ try{ localStorage.setItem('FP_HERO', JSON.stringify(h)); }catch(e){} }
  function heroTitle(lv){
    return ['','Rookie Hero','Fit Explorer','Power Kid','Hero Master','Legend'][lv] || 'Legend';
  }

  // ------------------ csv helpers ------------------
  function csvEscape(v){
    const s = String(v ?? '');
    if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }

  function buildCSVRow(summary){
    const cols = [
      'ts','pid','studyId','phase','conditionGroup','view','seed',
      'combo','score','pass','total','timeSec',
      'createScore','uniqueCount','len','hasBalance','bossCleared','maxStreak'
    ];
    const rb = summary.rubric || {};
    const row = [
      summary.ts,
      summary.pid, summary.studyId, summary.phase, summary.conditionGroup,
      summary.view, summary.seed,
      (summary.combo||[]).join('|'),
      summary.score, summary.pass, summary.total, summary.timeSec,
      rb.createScore ?? '',
      rb.uniqueCount ?? '',
      rb.len ?? '',
      rb.hasBalance ? 1 : 0,
      summary.bossCleared ? 1 : 0,
      summary.maxStreak ?? 0
    ];
    return cols.map(csvEscape).join(',') + '\n' + row.map(csvEscape).join(',');
  }

  // ------------------ hit tests ------------------
  function hitPunch(targetEl, ev, lockOverride){
    const d = ev?.detail || {};
    const x = Number(d.x), y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const tr = targetEl.getBoundingClientRect();
    const lock = clamp(Number(lockOverride ?? d.lockPx ?? 0), 0, 140);
    return x >= (tr.left-lock) && x <= (tr.right+lock) && y >= (tr.top-lock) && y <= (tr.bottom+lock);
  }
  function hitBalance(centerEl, ev, lockPx){
    const d = ev?.detail || {};
    const x = Number(d.x), y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const cr = centerEl.getBoundingClientRect();
    const cx = (cr.left + cr.right)/2, cy = (cr.top + cr.bottom)/2;
    const lock = clamp(Number(lockPx ?? d.lockPx ?? 0), 0, 180);
    const dx = x - cx, dy = y - cy;
    return (dx*dx + dy*dy) <= (lock*lock);
  }

  // ------------------ server logger (optional ?log=) ------------------
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

  // =========================
  // PUBLIC BOOT
  // =========================
  function boot({ ctx = {} } = {}){
    const MODE = (q('mode','play') || 'play').toLowerCase();
    const IS_RESEARCH = (MODE === 'research' || MODE === 'study');

    // seed
    const seedStr = String(q('seed','') || ctx.seed || '');
    const seedU32 = (Number(seedStr) >>> 0) || hash32(seedStr || (Date.now()+'')) || 123456789;
    ctx.seed = seedU32;

    // ctx meta from qs (optional)
    ctx.pid = ctx.pid || q('pid','');
    ctx.studyId = ctx.studyId || q('studyId','');
    ctx.phase = ctx.phase || q('phase','');
    ctx.conditionGroup = ctx.conditionGroup || q('conditionGroup','');
    ctx.view = ctx.view || q('view','');
    ctx.log = ctx.log || q('log','');

    const rng = makeRng(seedU32);
    const log = makeLogger(ctx);
    const unHarden = log.harden();

    // UI
    const wrap = $('#fp-wrap') || DOC.body;

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
    const barOverallEl = $('#fp-bar-overall');

    const stageEl = viewRun ? viewRun.querySelector('.fp-stage') : null;

    const targetEl = $('#fp-target');
    const centerRingEl = $('#fp-centerRing');
    const centerEl = $('#fp-center');
    const actbarEl = $('#fp-actbar');
    const btnJump = $('#fp-btn-jump');
    const btnDuck = $('#fp-btn-duck');

    const bossEl = $('#fp-boss');

    const sumScore = $('#fp-sum-score');
    const sumPass  = $('#fp-sum-pass');
    const sumTot   = $('#fp-sum-total');
    const sumTime  = $('#fp-sum-time');
    const sumCreate = $('#fp-sum-create');
    const sumPowerEl = $('#fp-sum-power');

    const badgesEl = $('#fp-badges');
    const fxLayer  = $('#fp-fx');

    const btnSave = $('#fp-save');
    const btnRetry = $('#fp-retry');
    const btnCopy = $('#fp-copy');
    const btnCopyCSV = $('#fp-copycsv');
    const btnCopyEvents = $('#fp-copyevents');
    const backHub = $('#fp-backhub');

    // HUD (optional)
    const hudLevelEl = $('#fp-hud-level');
    const hudModeEl = $('#fp-hud-mode');
    const hudMissionEl = $('#fp-hud-mission');
    const hudPowerEl = $('#fp-hud-power');
    const hudFeverEl = $('#fp-hud-fever');
    const hudCoachEl = $('#fp-hud-coach');

    // Practice
    const practiceLeftEl = $('#fp-practice-left');
    const practiceHintEl = $('#fp-practice-hint');
    const practiceTargetEl = $('#fp-practice-target');
    const btnSkipPractice = $('#fp-skip-practice');

    // Header ctx (optional)
    const ctxView = $('#fp-ctx-view');
    const ctxSeed = $('#fp-ctx-seed');

    wrap.classList.toggle('fp-research', IS_RESEARCH);
    if(ctxView) ctxView.textContent = ctx.view || '-';
    if(ctxSeed) ctxSeed.textContent = String(ctx.seed>>>0);
    if(hudModeEl) hudModeEl.textContent = `mode: ${IS_RESEARCH ? 'research' : 'play'}`;

    // events buffer (export)
    const SID = `FP_${Date.now()}_${Math.floor((ctx.seed>>>0)%1e6)}`;
    const EVENT_ROWS = [];
    function ev(type, data){
      const row = {
        ts: Date.now(),
        sid: SID,
        pid: ctx.pid || '',
        game: 'fitness_planner',
        mode: IS_RESEARCH ? 'research' : 'play',
        view: ctx.view || '',
        seed: ctx.seed>>>0,
        type,
        data: data || {}
      };
      EVENT_ROWS.push(row);
      try{ log.push(type, Object.assign({ sid: SID }, data || {})); }catch(e){}
      try{ emit('hha:event', { sid: SID, game:'fitness_planner', type, ...row.data }); }catch(e){}
    }
    function buildEventsCSV(){
      const header = ['ts','sid','pid','game','mode','view','seed','type','data_json'];
      const lines = [header.join(',')];
      for(const r of EVENT_ROWS){
        const dataJson = JSON.stringify(r.data || {});
        const vals = [
          r.ts, r.sid, r.pid, r.game, r.mode, r.view, r.seed, r.type, dataJson
        ].map(csvEscape);
        lines.push(vals.join(','));
      }
      return lines.join('\n');
    }

    // state
    let combo = [];
    let run = null;

    // drag state
    let dragState = { active:false, idx:-1, el:null, pointerId:null };

    // ---------- views ----------
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

    // ---------- combo UI ----------
    function setCount(){
      if(countEl) countEl.textContent = String(combo.length);
      if(btnStart) btnStart.disabled = !(combo.length >= 3 && combo.length <= 5);
    }

    function renderCombo(){
      if(!comboEl) return;
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

        x.addEventListener('click', (evv)=>{
          evv.stopPropagation();
          const idx = Number(chip.dataset.idx);
          if(Number.isFinite(idx)){
            const removed = combo.splice(idx, 1)[0];
            renderCombo(); setCount();
            ev('combo_remove', { idx, move: removed, combo: combo.slice() });
          }
        });

        chip.appendChild(t);
        chip.appendChild(x);

        chip.addEventListener('pointerdown', (evv)=>{
          if(evv.target === x) return;
          dragState.active = true;
          dragState.idx = Number(chip.dataset.idx);
          dragState.el = chip;
          dragState.pointerId = evv.pointerId;

          chip.classList.add('fp-dragging');
          chip.setPointerCapture(evv.pointerId);

          ev('drag_start', { idx: dragState.idx, move: mv });
          evv.preventDefault();
        });

        chip.addEventListener('pointermove', (evv)=>{
          if(!dragState.active || dragState.el !== chip || dragState.pointerId !== evv.pointerId) return;

          const el = DOC.elementFromPoint(evv.clientX, evv.clientY);
          const other = el ? el.closest('.fp-chip') : null;
          if(!other || other === chip) return;

          const from = dragState.idx;
          const to = Number(other.dataset.idx);
          if(!Number.isFinite(to) || to === from) return;

          const item = combo.splice(from, 1)[0];
          combo.splice(to, 0, item);
          dragState.idx = to;

          renderCombo(); setCount();
          ev('drag_reorder', { from, to, combo: combo.slice() });
        });

        const endDrag = ()=>{
          if(!dragState.active || dragState.el !== chip) return;
          dragState.active = false;
          dragState.pointerId = null;
          dragState.idx = -1;
          dragState.el = null;
          chip.classList.remove('fp-dragging');
          ev('drag_end', { combo: combo.slice() });
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
      ev('combo_add', { move: mv, combo: combo.slice() });
    }

    function clearCombo(){
      combo = [];
      renderCombo(); setCount();
      ev('combo_clear', {});
    }

    // bind build cards
    $$('.fp-card').forEach((btn)=>{
      btn.addEventListener('click', ()=>{
        const mv = (btn.dataset.move || '').trim();
        if(!mv) return;
        addMove(mv);
      });
    });
    btnClear?.addEventListener('click', clearCombo);

    // =========================
    // FUN PACK: Director + Coach (play only)
    // =========================
    function initDirector(){
      return { diff: IS_RESEARCH ? 0.50 : 0.55, consecFail: 0, consecOk: 0, lastAdjustTs: 0 };
    }
    function adjustDirector(ok, reason){
      if(IS_RESEARCH || !run) return;
      const t = nowMs();
      if(t - (run.dir.lastAdjustTs||0) < 600) return;

      if(ok){ run.dir.consecOk += 1; run.dir.consecFail = 0; }
      else  { run.dir.consecFail += 1; run.dir.consecOk = 0; }

      if(run.dir.consecFail >= 2){
        run.dir.diff = clamp(run.dir.diff - 0.08, 0.20, 0.90);
        run.dir.lastAdjustTs = t;
        run.dir.consecFail = 0;
        fxPop(fxLayer,'🧩 ง่ายลงนิดนะ', WIN.innerWidth*0.5, WIN.innerHeight*0.16);
        ev('dir_adjust', { dir:'easier', diff: run.dir.diff, reason: reason||'fail2' });
      }else if(run.dir.consecOk >= 3){
        run.dir.diff = clamp(run.dir.diff + 0.06, 0.20, 0.90);
        run.dir.lastAdjustTs = t;
        run.dir.consecOk = 0;
        fxPop(fxLayer,'⚡ ท้าทายขึ้น!', WIN.innerWidth*0.5, WIN.innerHeight*0.16);
        ev('dir_adjust', { dir:'harder', diff: run.dir.diff, reason: reason||'ok3' });
      }
    }
    function applyAssistToSpec(spec){
      if(IS_RESEARCH || !run) return;
      const d = run.dir.diff;
      const ease = 1 - d;
      spec.ttlMs = Math.round(spec.ttlMs * (1 + ease*0.35));
      spec.lockPx = Math.round((spec.lockPx || 0) + ease*40);
    }
    function setTargetScaleByDifficulty(){
      if(!targetEl || IS_RESEARCH || !run) return;
      const d = run.dir.diff;
      const ease = 1 - d;
      const scale = 1 + ease*0.22;
      targetEl.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(3)})`;
    }

    function coachShow(text){
      if(!hudCoachEl) return;
      hudCoachEl.textContent = `💡 โค้ช: ${text}`;
      hudCoachEl.classList.remove('fp-hidden');
      setTimeout(()=>hudCoachEl.classList.add('fp-hidden'), 3600);
    }
    function initCoach(){
      return { lastTipTs: 0, tipCount: 0, maxTips: IS_RESEARCH ? 0 : 6, cooldownMs: 15000 };
    }
    function coachMaybeTip(trigger, meta){
      if(IS_RESEARCH || !run || !run.coach) return;
      const t = nowMs();
      if(run.coach.tipCount >= run.coach.maxTips) return;
      if(t - run.coach.lastTipTs < run.coach.cooldownMs) return;

      const kind = meta?.kind || '';
      let tip = '';
      if(trigger === 'fail'){
        if(kind === 'duck') tip = 'กดค้าง DUCK ให้นานขึ้นอีกนิด (ให้นับครบ)';
        else if(kind === 'balance') tip = 'ทรงตัว: แตะค้างนิ่ง ๆ กลางวง แล้วค่อยปล่อย';
        else tip = 'เล็งกลางเป้า แล้วแตะเร็ว ๆ จะติดง่ายขึ้น';
      }else if(trigger === 'streak'){
        tip = 'ดีมาก! รักษาจังหวะเดิมไว้ จะได้ streak ต่อเนื่อง';
      }else if(trigger === 'boss'){
        tip = 'บอสจะ “เตือนก่อนย้าย” รอสัญญาณแล้วค่อยยิง!';
      }else{
        tip = 'ถ้าเริ่มยาก ให้เล่นช้า ๆ ก่อน แล้วค่อยเร่ง';
      }

      run.coach.lastTipTs = t;
      run.coach.tipCount += 1;

      coachShow(tip);
      ev('coach_tip', { trigger, tip, kind, idx: meta?.idx ?? -1, diff: run.dir?.diff });
    }

    // =========================
    // Missions + Power-ups + Fever (play only)
    // =========================
    function setPowerText(){
      if(!hudPowerEl) return;
      if(IS_RESEARCH){ hudPowerEl.textContent = '🎁 Power: (OFF)'; return; }
      const t = run?.power ? (
        run.power==='shield' ? '🎁 Power: 🛡️ Shield'
      : run.power==='slow'   ? '🎁 Power: 🐢 Slow'
      : '🎁 Power: ✨ Double'
      ) : '🎁 Power: -';
      hudPowerEl.textContent = t;
    }

    function setMissionText(){
      if(!hudMissionEl || !run) return;
      const txt = (run.mission==='perfect2') ? '🎯 ภารกิจ: ผ่านติดกัน 2 ด่าน'
                : (run.mission==='nomiss')   ? '🎯 ภารกิจ: พลาดได้ไม่เกิน 1 ครั้ง'
                : '🎯 ภารกิจ: มือไว! เฉลี่ย < 1.2s';
      hudMissionEl.textContent = txt;
    }

    // =========================
    // Boss insert (after step 3) + patterns + telegraph
    // =========================
    function pickBossPattern(){
      if(IS_RESEARCH){
        const k = (ctx.seed >>> 0) % 3;
        return ['zigzag','popcorn','freeze'][k];
      }
      const r = rng();
      return (r < .34) ? 'zigzag' : (r < .67) ? 'popcorn' : 'freeze';
    }

    function telegraph(text){
      fxPop(fxLayer, text, WIN.innerWidth*0.5, WIN.innerHeight*0.26);
    }

    function moveBossTarget(){
      if(!run || !run.bossActive || !targetEl || !stageEl) return;

      telegraph('⚠️ เตรียมย้าย!');
      setTimeout(()=>{
        if(!run || !run.bossActive) return;

        if(run.bossPattern === 'zigzag'){
          run.__zz = !run.__zz;
          const box = stageEl.getBoundingClientRect();
          const x = run.__zz ? (box.width*0.22) : (box.width*0.78);
          const y = 140 + rng()*(box.height-220);
          targetEl.style.left = (x) + 'px';
          targetEl.style.top  = (y) + 'px';
        }else if(run.bossPattern === 'popcorn'){
          const box = stageEl.getBoundingClientRect();
          const pts = [
            {x: box.width*0.20, y: box.height*0.28},
            {x: box.width*0.80, y: box.height*0.28},
            {x: box.width*0.20, y: box.height*0.72},
            {x: box.width*0.80, y: box.height*0.72},
          ];
          const idx = Math.floor(rng()*pts.length);
          targetEl.style.left = (pts[idx].x) + 'px';
          targetEl.style.top  = (pts[idx].y) + 'px';
        }else{
          moveTargetRandom();
        }
      }, 600);
    }

    function startBoss(){
      if(!run) return;

      run.bossActive = true;
      run.bossPattern = pickBossPattern();
      run.bossHitNeed = IS_RESEARCH ? 6 : 7;
      run.bossHitNow = 0;
      run.bossTtlMs = IS_RESEARCH ? 10000 : 9500;
      run.__bossNextMove = null;
      run.__zz = false;

      if(bossEl){
        const name = (run.bossPattern==='zigzag')?'ZIGZAG'
                  : (run.bossPattern==='popcorn')?'POPCORN'
                  : 'FREEZE';
        bossEl.textContent = `👾 BOSS · ${name}`;
        bossEl.classList.remove('fp-hidden');
      }

      if(instrEl) instrEl.textContent = `👾 BOSS! ทำให้ครบ ${run.bossHitNeed} ครั้งใน ${Math.round(run.bossTtlMs/1000)} วิ`;
      setStage('punch');
      moveTargetRandom();

      run.stepT0 = nowMs();

      coachMaybeTip('boss', { idx: run.i, kind:'boss' });
      sfx('end');
      fxPop(fxLayer, '👾 BOSS!', WIN.innerWidth*0.5, WIN.innerHeight*0.28);

      ev('boss_start', { idx: run.i, pattern: run.bossPattern, need: run.bossHitNeed, ttlMs: run.bossTtlMs });
    }

    function endBoss(cleared, why){
      if(!run) return;

      run.bossActive = false;
      run.pendingBoss = false;
      run.bossDone = true;

      if(bossEl) bossEl.classList.add('fp-hidden');

      if(cleared){
        run.bossCleared = true;
        const bonus = 25;
        run.score += bonus;

        run.streak = (run.streak || 0) + 1;
        run.maxStreak = Math.max(run.maxStreak||0, run.streak||0);

        fxPop(fxLayer, `🏆 BOSS +${bonus}`, WIN.innerWidth*0.5, WIN.innerHeight*0.22);
        sfx('ok');
        ev('boss_end', { cleared:true, why: why||'boss_clear', bonus, scoreNow: run.score });
      }else{
        run.streak = 0;
        fxPop(fxLayer, `😵 แพ้บอส!`, WIN.innerWidth*0.5, WIN.innerHeight*0.22);
        sfx('bad');
        ev('boss_end', { cleared:false, why: why||'boss_fail' });
      }

      if(scoreEl) scoreEl.textContent = String(run.score);

      // overall progress (+1 for boss)
      if(barOverallEl && run.totalOverall){
        run.doneOverall = (run.doneOverall||0) + 1;
        const pAll = clamp((run.doneOverall / run.totalOverall) * 100, 0, 100);
        barOverallEl.style.width = pAll.toFixed(1) + '%';
      }

      setTimeout(nextStep, 360);
    }

    // =========================
    // Practice 15s
    // =========================
    let practiceTimer = null;
    let practiceLeft = 15;

    function startPracticeThenRun(){
      if(!viewPractice || !practiceTargetEl){
        startRunCore();
        return;
      }

      showPractice();
      practiceLeft = 15;
      if(practiceLeftEl) practiceLeftEl.textContent = String(practiceLeft);
      if(practiceHintEl) practiceHintEl.textContent = 'ลอง “ต่อย” โดยแตะที่เป้า หรือเล็งกากบาทแล้วแตะจอ';

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

      const onTap = (ev)=>onHit(ev?.clientX, ev?.clientY);

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
        ev('practice_skip', {});
        startRunCore();
      }, { once:true });

      movePracticeTarget();
      ev('practice_start', { sec: 15 });

      practiceTimer = setInterval(()=>{
        practiceLeft -= 1;
        if(practiceLeftEl) practiceLeftEl.textContent = String(practiceLeft);
        if(practiceLeft <= 0){
          cleanup();
          ev('practice_end', {});
          startRunCore();
        }
      }, 1000);
    }

    // =========================
    // RUN LOOP
    // =========================
    let rafId = 0;
    function stopLoop(){ if(rafId) cancelAnimationFrame(rafId); rafId = 0; }

    function loop(){
      if(!run) return;
      const t = nowMs();

      const totalSec = (t - run.t0) / 1000;
      if(timeEl) timeEl.textContent = totalSec.toFixed(1);

      // fever UI
      if(hudFeverEl){
        const on = (!IS_RESEARCH && run.feverUntil && t < run.feverUntil);
        hudFeverEl.classList.toggle('fp-hidden', !on);
      }
      wrap.classList.toggle('fp-fever', (!IS_RESEARCH && run.feverUntil && t < run.feverUntil));

      // boss movement ticker
      if(run.bossActive){
        if(run.__bossNextMove == null) run.__bossNextMove = t + 900;
        if(t >= run.__bossNextMove){
          run.__bossNextMove = t + (run.bossPattern==='freeze' ? 1200 : 900);
          moveBossTarget();
        }
      }

      const st = run.steps[run.i];
      if(!st && !run.bossActive){
        rafId = requestAnimationFrame(loop);
        return;
      }

      // progress bar (per-step)
      const elapsed = t - run.stepT0;
      const ttl = run.bossActive ? run.bossTtlMs : (st?.spec?.ttlMs || 1);
      const p = clamp(elapsed / ttl, 0, 1);
      if(barEl) barEl.style.width = (p*100).toFixed(1) + '%';

      // balance press-hold
      if(!run.bossActive && st?.spec?.kind === 'balance'){
        if(run.balancePressing){
          if(run.balanceHoldStart == null){
            run.balanceHoldStart = t;
            ev('balance_hold_start', { idx: run.i, mode:'press' });
          }
          if((t - run.balanceHoldStart) >= (st.spec.holdMs || 1100)){
            finishStep(true, 'balance_hold_press_ok');
          }
        }
      }

      // duck hold
      if(!run.bossActive && st?.spec?.kind === 'duck'){
        if(run.duckHoldStart != null){
          if((t - run.duckHoldStart) >= (st.spec.holdMs || 900)){
            finishStep(true, 'duck_hold_ok');
          }
        }
      }

      // timeouts
      if(!run.stepDone){
        if(run.bossActive){
          if(elapsed >= run.bossTtlMs){
            endBoss(false, 'boss_timeout');
          }
        }else{
          if(elapsed >= (st?.spec?.ttlMs || 0)){
            finishStep(false, 'timeout');
          }
        }
      }

      rafId = requestAnimationFrame(loop);
    }

    // =========================
    // step control
    // =========================
    function nextStep(){
      if(!run) return;

      // insert boss after passing step 3 (index 2)
      if(run.pendingBoss && !run.bossActive && !run.bossDone){
        startBoss();
        return;
      }

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

      // apply director assist (play only)
      applyAssistToSpec(spec);
      setTargetScaleByDifficulty();

      if(stepIdxEl) stepIdxEl.textContent = String(run.i + 1);
      if(stepTotEl) stepTotEl.textContent = String(run.steps.length);
      if(instrEl) instrEl.textContent = `ด่าน ${run.i+1}: ${st.label}`;

      if(barEl) barEl.style.width = '0%';

      setStage(spec.kind);
      if(spec.kind === 'punch') moveTargetRandom();

      // power gain (play only)
      if(!IS_RESEARCH && !run.bossActive && !run.power){
        if((run.i+1) % 2 === 0 && rng() < 0.30){
          const r = rng();
          run.power = (r<.34)?'shield': (r<.67)?'slow':'double';
          run.powerHistory.push(run.power);
          if(run.power==='shield') run.shield = 1;
          if(run.power==='slow') run.nextStepSlow = true;
          if(run.power==='double') run.nextStepDouble = true;
          setPowerText();
          fxPop(fxLayer, '🎁 ได้ Power!', WIN.innerWidth*0.5, WIN.innerHeight*0.22);
          sfx('ok');
          ev('power_gain', { power: run.power, idx: run.i });
        }
      }

      // apply slow (play only)
      if(!IS_RESEARCH && run.nextStepSlow){
        spec.ttlMs = Math.round(spec.ttlMs * 1.30);
      }

      run.stepT0 = nowMs();

      ev('step_start', {
        idx: run.i, move: st.move, kind: spec.kind,
        ttlMs: spec.ttlMs, lockPx: spec.lockPx||0,
        diff: run.dir?.diff, mission: run.mission, power: run.power||''
      });
    }

    function finishStep(ok, why){
      if(!run || run.stepDone) return;
      if(run.bossActive) return; // boss ends via endBoss()

      const st = run.steps[run.i];
      const spec = st.spec;
      const dt = nowMs() - run.stepT0;

      // shield block (play only)
      if(!ok && !IS_RESEARCH && run.shield > 0){
        run.shield = 0;
        run.power = null;
        setPowerText();
        fxPop(fxLayer, '🛡️ Shield กันพลาด!', WIN.innerWidth*0.5, WIN.innerHeight*0.24);
        sfx('ok');
        ev('shield_block', { idx: run.i });

        // pass but scoreAdd = 0
        const saved = spec.score;
        spec.score = 0;
        run.stepDone = false; // ensure normal path
        ok = true;
        why = 'shield_block';
        // restore later
        spec.score = saved;
      }

      run.stepDone = true;

      // mission tracking (non-boss)
      run.missionStepTimes.push(dt);

      if(ok){
        run.pass += 1;

        // streak
        run.streak = (run.streak || 0) + 1;
        run.maxStreak = Math.max(run.maxStreak||0, run.streak||0);

        // fever (play only)
        if(!IS_RESEARCH && run.streak === 5){
          run.feverUntil = nowMs() + 5000;
          fxPop(fxLayer,'🔥 FEVER!', WIN.innerWidth*0.5, WIN.innerHeight*0.20);
          sfx('end');
        }

        // score mult (fever + double)
        let mult = 1;
        if(!IS_RESEARCH && run.nextStepDouble) mult *= 2;
        if(!IS_RESEARCH && run.feverUntil && nowMs() < run.feverUntil) mult *= 2;

        const add = spec.score * mult;
        run.score += add;

        // streak bonus every 3 ok
        if(run.streak % 3 === 0){
          const bonus = 5;
          run.score += bonus;
          fxPop(fxLayer, `🔥 STREAK +${bonus}`, WIN.innerWidth*0.5, WIN.innerHeight*0.22);
          ev('streak_bonus', { streak: run.streak, bonus, scoreNow: run.score });
        }

        sfx('ok');
        fxPop(fxLayer, `✅ +${add}`, WIN.innerWidth*0.5, WIN.innerHeight*0.32);
      }else{
        run.streak = 0;
        sfx('bad');
        fxPop(fxLayer, `⏱️ ลองใหม่!`, WIN.innerWidth*0.5, WIN.innerHeight*0.32);
      }

      // clear one-step power effects
      if(!IS_RESEARCH){
        run.nextStepSlow = false;
        run.nextStepDouble = false;
        // consuming a power clears it (simple rule)
        if(run.power && run.power !== 'shield'){
          run.power = null;
          setPowerText();
        }
      }

      if(scoreEl) scoreEl.textContent = String(run.score);

      // mission evaluate (play bonus only)
      if(!run.bossActive && !run.missionDone){
        if(ok) run.missionOkStreak = (run.missionOkStreak||0) + 1;
        else{
          run.missionOkStreak = 0;
          run.missionMiss = (run.missionMiss||0) + 1;
        }

        if(run.mission === 'perfect2' && run.missionOkStreak >= 2) run.missionDone = true;
        if(run.mission === 'nomiss' && (run.missionMiss||0) > 1){
          // fail silently
        }
        if(run.mission === 'fasthands' && run.missionStepTimes.length >= 2){
          const last2 = run.missionStepTimes.slice(-2);
          const avg = (last2[0]+last2[1])/2;
          if(avg <= 1200) run.missionDone = true;
        }

        if(run.missionDone){
          const bonus = IS_RESEARCH ? 0 : 12;
          if(bonus){
            run.score += bonus;
            if(scoreEl) scoreEl.textContent = String(run.score);
            fxPop(fxLayer, `🎯 MISSION +${bonus}`, WIN.innerWidth*0.5, WIN.innerHeight*0.18);
            sfx('end');
          }
          ev('mission_done', { mission: run.mission, bonus, idx: run.i });
        }
      }

      // overall progress (combo steps)
      if(barOverallEl && run.totalOverall){
        run.doneOverall = (run.doneOverall||0) + (ok ? 1 : 0);
        const pAll = clamp((run.doneOverall / run.totalOverall) * 100, 0, 100);
        barOverallEl.style.width = pAll.toFixed(1) + '%';
      }

      ev('step_end', {
        idx: run.i,
        ok: !!ok, why: why||'',
        dtMs: Math.round(dt),
        scoreNow: run.score,
        streak: run.streak||0,
        diff: run.dir?.diff
      });

      // director + coach
      adjustDirector(ok, why);
      if(!ok) coachMaybeTip('fail', { idx: run.i, kind: spec.kind });
      if(ok && (run.streak||0) === 3) coachMaybeTip('streak', { idx: run.i, kind: spec.kind });

      // queue boss after step 3 success (index 2)
      if(ok && run.i === 2 && !run.bossDone){
        run.pendingBoss = true;
        ev('boss_queue', { afterStepIdx: 2 });
      }

      // advance
      run.i += 1;

      // per-step bar reset
      if(barEl) barEl.style.width = '0%';

      setTimeout(nextStep, 360);
    }

    // =========================
    // run start/end
    // =========================
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

        // holds
        balanceHoldStart: null,
        balancePressing: false,
        duckHoldStart: null,

        // fun
        streak: 0,
        maxStreak: 0,
        feverUntil: 0,

        // director/coach
        dir: initDirector(),
        coach: initCoach(),

        // boss insert
        pendingBoss: false,
        bossActive: false,
        bossDone: false,
        bossCleared: false,
        bossHitNeed: 0,
        bossHitNow: 0,
        bossTtlMs: 10000,
        bossPattern: '',
        __bossNextMove: null,
        __zz: false,

        // mission
        mission: IS_RESEARCH ? 'perfect2' : (rng()<.34?'perfect2': (rng()<.67?'nomiss':'fasthands')),
        missionDone: false,
        missionMiss: 0,
        missionOkStreak: 0,
        missionStepTimes: [],

        // power
        power: null,
        powerHistory: [],
        shield: 0,
        nextStepSlow: false,
        nextStepDouble: false,

        // overall progress: combo steps + boss
        totalOverall: steps.length + 1,
        doneOverall: 0
      };

      // HUD init
      try{
        const hero = getHero();
        if(hudLevelEl) hudLevelEl.textContent = `⭐ Lv ${hero.level}`;
      }catch(e){}

      setMissionText();
      setPowerText();

      if(barOverallEl) barOverallEl.style.width = '0%';
      if(scoreEl) scoreEl.textContent = '0';
      if(timeEl) timeEl.textContent = '0.0';
      if(stepTotEl) stepTotEl.textContent = String(steps.length);

      // rubric
      const rb = rubricCreate(combo);
      ev('rubric', Object.assign({ combo: combo.slice() }, rb));

      ev('session_start', { seed: ctx.seed>>>0, mode: IS_RESEARCH?'research':'play', combo: combo.slice(), mission: run.mission });

      showRun();
      nextStep();
      stopLoop();
      loop();
    }

    function endRun(){
      if(!run) return;
      stopLoop();

      const dt = (nowMs() - run.t0) / 1000;

      const rb = rubricCreate(combo);

      if(sumScore) sumScore.textContent = String(run.score);
      if(sumPass)  sumPass.textContent = String(run.pass);
      if(sumTot)   sumTot.textContent = String(run.steps.length);
      if(sumTime)  sumTime.textContent = dt.toFixed(1);
      if(sumCreate) sumCreate.textContent = String(rb.createScore);

      // summary object
      const last = {
        game: 'fitness_planner',
        ts: Date.now(),
        pid: ctx.pid || '',
        studyId: ctx.studyId || '',
        phase: ctx.phase || '',
        conditionGroup: ctx.conditionGroup || '',
        view: ctx.view || '',
        mode: IS_RESEARCH ? 'research' : 'play',
        seed: ctx.seed >>> 0,

        combo: combo.slice(),
        score: run.score,
        pass: run.pass,
        total: run.steps.length,
        timeSec: Number(dt.toFixed(2)),

        rubric: rb,
        bossCleared: !!run.bossCleared,
        maxStreak: run.maxStreak || 0,
        powerHistory: (run.powerHistory||[]).slice(),
        mission: run.mission,
        missionDone: !!run.missionDone
      };

      // show powers
      if(sumPowerEl){
        const list = (run.powerHistory||[]).filter(Boolean);
        sumPowerEl.textContent = list.length ? list.join(', ') : '-';
      }

      // hero exp/level (both modes ok; less flashy in research)
      try{
        const hero = getHero();
        const gainedExp = last.score + (last.maxStreak||0)*5 + (last.bossCleared?30:0);
        hero.exp += gainedExp;

        let leveled = false;
        while(hero.exp >= hero.level*100){
          hero.exp -= hero.level*100;
          hero.level += 1;
          leveled = true;
        }
        saveHero(hero);
        last.hero = { ...hero, gainedExp };

        if(hudLevelEl) hudLevelEl.textContent = `⭐ Lv ${hero.level}`;

        if(leveled && !IS_RESEARCH){
          fxPop(fxLayer, `⭐ LEVEL UP! ${heroTitle(hero.level)}`, WIN.innerWidth*0.5, WIN.innerHeight*0.18);
          sfx('end');
        }
      }catch(e){}

      // badges
      const b = computeBadges(last);
      renderBadges(badgesEl, b);
      ev('badges', { items: b });

      // store last summary
      try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(last)); }catch(e){}

      ev('session_end', {
        score: last.score, pass: last.pass, total: last.total, timeSec: last.timeSec,
        createScore: last.rubric?.createScore ?? null,
        bossCleared: !!last.bossCleared,
        maxStreak: last.maxStreak||0
      });

      sfx('end');
      fxPop(fxLayer, '🏁 จบแล้ว!', WIN.innerWidth*0.5, WIN.innerHeight*0.28);

      // flush server log
      log.flush('run_end');

      showSummary();
    }

    // =========================
    // Inputs
    // =========================

    // punch: tap on target
    targetEl?.addEventListener('pointerdown', (evv)=>{
      if(!run) return;

      // boss punch hit count
      if(run.bossActive){
        run.bossHitNow += 1;
        ev('boss_hit', { now: run.bossHitNow, need: run.bossHitNeed });
        fxPop(fxLayer, `🎯 ${run.bossHitNow}/${run.bossHitNeed}`, WIN.innerWidth*0.5, WIN.innerHeight*0.38);
        sfx('ok');
        moveTargetRandom();
        if(run.bossHitNow >= run.bossHitNeed){
          endBoss(true, 'boss_clear');
        }
        return;
      }

      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind === 'punch') finishStep(true, 'hit_ptr');
    });

    // jump
    btnJump?.addEventListener('click', ()=>{
      if(!run || run.bossActive) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'jump') return;
      finishStep(true, 'jump_ok');
    });

    // duck hold
    btnDuck?.addEventListener('pointerdown', ()=>{
      if(!run || run.bossActive) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'duck') return;
      run.duckHoldStart = nowMs();
      ev('duck_hold_start', { idx: run.i });
    });
    function duckUp(){
      if(!run || run.bossActive) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'duck') return;
      if(run.duckHoldStart == null) return;
      const held = nowMs() - run.duckHoldStart;
      ev('duck_hold_end', { idx: run.i, heldMs: Math.round(held) });
      if(held < (st.spec.holdMs||900) * 0.6){
        if(instrEl) instrEl.textContent = 'กดค้าง DUCK ให้นานขึ้นอีกนิดนะ';
      }
    }
    btnDuck?.addEventListener('pointerup', duckUp);
    btnDuck?.addEventListener('pointercancel', duckUp);
    btnDuck?.addEventListener('pointerleave', duckUp);

    // balance press/hold: press anywhere on stage
    function stageDown(){
      if(!run || run.bossActive) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'balance') return;
      run.balancePressing = true;
    }
    function stageUp(){
      if(!run || run.bossActive) return;
      const st = run.steps[run.i]; if(!st) return;
      if(st.spec.kind !== 'balance') return;
      if(run.balancePressing){
        ev('balance_hold_break', { idx: run.i, mode:'press' });
      }
      run.balancePressing = false;
      run.balanceHoldStart = null;
    }
    stageEl?.addEventListener('pointerdown', stageDown);
    stageEl?.addEventListener('pointerup', stageUp);
    stageEl?.addEventListener('pointercancel', stageUp);
    stageEl?.addEventListener('pointerleave', stageUp);

    // hha:shoot events (from vr-ui.js)
    function onShoot(evv){
      if(!run) return;

      // boss: hit count by shoot
      if(run.bossActive && targetEl){
        const ok = hitPunch(targetEl, evv, 0);
        if(ok){
          run.bossHitNow += 1;
          ev('boss_hit', { now: run.bossHitNow, need: run.bossHitNeed });
          fxPop(fxLayer, `🎯 ${run.bossHitNow}/${run.bossHitNeed}`, WIN.innerWidth*0.5, WIN.innerHeight*0.38);
          sfx('ok');
          moveTargetRandom();
          if(run.bossHitNow >= run.bossHitNeed){
            endBoss(true, 'boss_clear');
          }
        }else{
          ev('boss_shot_miss', { now: run.bossHitNow, need: run.bossHitNeed });
        }
        return;
      }

      const st = run.steps[run.i]; if(!st) return;
      const spec = st.spec;

      if(spec.kind === 'punch' && targetEl){
        const ok = hitPunch(targetEl, evv, 0);
        ev('shot', { idx: run.i, ok: !!ok, source: evv?.detail?.source||'' });
        if(ok) finishStep(true, 'hit_shoot');
        return;
      }

      if(spec.kind === 'balance' && centerEl){
        const ok = hitBalance(centerEl, evv, spec.lockPx);
        if(ok && !run.balancePressing){
          if(run.balanceHoldStart == null){
            run.balanceHoldStart = nowMs();
            ev('balance_hold_start', { idx: run.i, mode:'shoot' });
          }
        }else if(!ok && !run.balancePressing){
          run.balanceHoldStart = null;
        }
      }
    }
    WIN.addEventListener('hha:shoot', onShoot);

    // =========================
    // Buttons
    // =========================
    btnStart?.addEventListener('click', ()=>{
      if(combo.length < 3) return;
      startPracticeThenRun();
    });

    // summary save (simple reflect)
    btnSave?.addEventListener('click', async ()=>{
      const diff = (DOC.querySelector('input[name="diff"]:checked') || {}).value || 'ok';
      ev('reflect', { diff });
      try{
        const s = JSON.parse(localStorage.getItem('HHA_LAST_SUMMARY') || 'null');
        if(s && s.game === 'fitness_planner'){
          s.reflectDiff = diff;
          localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(s));
        }
      }catch(e){}
      await log.flush('reflect_save');
      if(btnSave){
        btnSave.textContent = 'บันทึกแล้ว ✅';
        btnSave.disabled = true;
        setTimeout(()=>{
          btnSave.textContent = 'บันทึกผล';
          btnSave.disabled = false;
        }, 1200);
      }
    });

    // copy JSON
    btnCopy?.addEventListener('click', async ()=>{
      let txt = '';
      try{ txt = localStorage.getItem('HHA_LAST_SUMMARY') || ''; }catch(e){ txt=''; }
      if(!txt){
        if(btnCopy){
          btnCopy.textContent = 'ยังไม่มีผลให้คัดลอก';
          setTimeout(()=>btnCopy.textContent='คัดลอกผล (JSON)', 900);
        }
        return;
      }
      try{
        await navigator.clipboard.writeText(txt);
        if(btnCopy) btnCopy.textContent = 'คัดลอกแล้ว ✅';
      }catch(e){
        try{ WIN.prompt('คัดลอกผล (JSON):', txt); }catch(_){}
        if(btnCopy) btnCopy.textContent = 'คัดลอกด้วยหน้าต่าง ✅';
      }
      setTimeout(()=>{ if(btnCopy) btnCopy.textContent='คัดลอกผล (JSON)'; }, 900);
    });

    // copy CSV 1 row
    btnCopyCSV?.addEventListener('click', async ()=>{
      let txt = '';
      try{
        const s = JSON.parse(localStorage.getItem('HHA_LAST_SUMMARY') || 'null');
        if(!s) throw new Error('no summary');
        txt = buildCSVRow(s);
      }catch(e){
        if(btnCopyCSV){
          btnCopyCSV.textContent = 'ยังไม่มีผล';
          setTimeout(()=>btnCopyCSV.textContent='คัดลอก CSV (1 แถว)', 900);
        }
        return;
      }
      try{
        await navigator.clipboard.writeText(txt);
        if(btnCopyCSV) btnCopyCSV.textContent = 'คัดลอกแล้ว ✅';
      }catch(e){
        try{ WIN.prompt('คัดลอก CSV:', txt); }catch(_){}
        if(btnCopyCSV) btnCopyCSV.textContent = 'คัดลอกด้วยหน้าต่าง ✅';
      }
      setTimeout(()=>{ if(btnCopyCSV) btnCopyCSV.textContent='คัดลอก CSV (1 แถว)'; }, 900);
    });

    // copy Events CSV
    btnCopyEvents?.addEventListener('click', async ()=>{
      const txt = buildEventsCSV();
      if(!txt || txt.split('\n').length < 2){
        if(btnCopyEvents){
          btnCopyEvents.textContent = 'ยังไม่มี events';
          setTimeout(()=>btnCopyEvents.textContent='คัดลอก Events CSV', 900);
        }
        return;
      }
      try{
        await navigator.clipboard.writeText(txt);
        if(btnCopyEvents) btnCopyEvents.textContent = 'คัดลอกแล้ว ✅';
      }catch(e){
        try{ WIN.prompt('คัดลอก Events CSV:', txt); }catch(_){}
        if(btnCopyEvents) btnCopyEvents.textContent = 'คัดลอกด้วยหน้าต่าง ✅';
      }
      setTimeout(()=>{ if(btnCopyEvents) btnCopyEvents.textContent='คัดลอก Events CSV'; }, 900);
    });

    // retry
    btnRetry?.addEventListener('click', ()=>{
      ev('retry', { combo: combo.slice() });
      run = null;
      showBuild();
    });

    // back hub (just flush)
    backHub?.addEventListener('click', async ()=>{
      try{
        ev('back_hub', {});
        await log.flush('back_hub');
      }catch(e){}
      unHarden && unHarden();
    });

    // =========================
    // INIT
    // =========================
    showBuild();
    setCount();
    renderCombo();

    // set HUD hero on load
    try{
      const hero = getHero();
      if(hudLevelEl) hudLevelEl.textContent = `⭐ Lv ${hero.level}`;
    }catch(e){}

    ev('ready', { view: ctx.view||'', seed: ctx.seed>>>0, mode: IS_RESEARCH?'research':'play' });
  }

  WIN.HHA_FITNESS_PLANNER = { boot };
})();