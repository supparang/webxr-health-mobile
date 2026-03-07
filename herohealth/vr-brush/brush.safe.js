// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE — Guided Brushing Zones + Evidence + Quiz
// PATCH v20260307-BRUSH-ZONEBRUSH-ACTUAL-TEACH
// ✅ Mouth map + guided brushing by zones
// ✅ A/B/C stages mapped to outside / inside / chewing+tongue
// ✅ Drag-to-brush gameplay
// ✅ Evidence in stage B
// ✅ Quiz in stage C
// ✅ cVR hha:shoot compatibility
// ✅ Back HUB links wired
// ✅ HHA_BRUSH.boot no-op for brush.boot.js integration

(function(){
  'use strict';

  const WIN = window, DOC = document;
  const $ = (s)=>DOC.querySelector(s);

  // ---------------- helpers ----------------
  const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));
  const safeNum = (x,d=0)=>{ const n=Number(x); return Number.isFinite(n)?n:d; };
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail })); }catch(_){}
  }
  function aiEmit(type, detail){
    if(!CTX.ai) return;
    try{ WIN.dispatchEvent(new CustomEvent('brush:ai', { detail: Object.assign({ type }, detail||{}) })); }catch(_){}
  }

  function toast(msg){
    const el = $('#toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove('show'), 1200);
  }

  function fatal(msg){
    const el = $('#fatal');
    if(!el){ alert(msg); return; }
    el.textContent = msg;
    el.classList.remove('br-hidden');
  }

  WIN.addEventListener('error', (e)=>{
    fatal('JS ERROR:\n' + (e?.message||e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
  });
  WIN.addEventListener('unhandledrejection', (e)=>{
    fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
  });

  function getQS(){ try{ return new URL(location.href).searchParams; }catch(_){ return new URLSearchParams(); } }
  function ymdLocal(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function getViewAuto(){
    const qs = getQS();
    const v = (qs.get('view')||'').toLowerCase();
    if(v) return v;
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'mobile' : 'pc';
  }
  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if(v==='cardboard' || v==='vr') return 'cvr';
    if(v==='cvr') return 'cvr';
    if(v==='mobile') return 'mobile';
    return 'pc';
  }
  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------- DOM refs ----------------
  const wrap = $('#br-wrap');
  const layer = $('#br-layer');
  const menu = $('#br-menu');
  const end  = $('#br-end');
  const quiz = $('#br-quiz');

  const btnStart = $('#btnStart');
  const btnRetry = $('#btnRetry');
  const btnPause = $('#btnPause');
  const btnHow = $('#btnHow');
  const btnRecenter = $('#btnRecenter');
  const btnBack = $('#btnBack');
  const btnBackHub2 = $('#btnBackHub2');

  const btnQuizSubmit = $('#btnQuizSubmit');
  const btnQuizSkip = $('#btnQuizSkip');
  const quizChoices = $('#quizChoices');

  const tStage = $('#tStage');
  const tScore = $('#tScore');
  const tCombo = $('#tCombo');
  const tMiss  = $('#tMiss');
  const tTime  = $('#tTime');

  const tClean = $('#tClean');
  const bClean = $('#bClean');
  const tFever = $('#tFever');
  const bFever = $('#bFever');

  const tEvi = $('#tEvi');
  const bEvi = $('#bEvi');

  const tRisk = $('#tRisk');
  const bRisk = $('#bRisk');
  const tTip  = $('#tTip');

  const ctxView = $('#br-ctx-view');
  const ctxSeed = $('#br-ctx-seed');
  const ctxTime = $('#br-ctx-time');
  const diffTag = $('#br-diffTag');
  const aiTag   = $('#br-aiTag');
  const mDiff = $('#mDiff');
  const mTime = $('#mTime');

  const sScore = $('#sScore');
  const sAcc   = $('#sAcc');
  const sMiss  = $('#sMiss');
  const sCombo = $('#sCombo');
  const sClean = $('#sClean');
  const sTime  = $('#sTime');
  const endGrade = $('#endGrade');
  const endNote  = $('#endNote');

  if(!wrap || !layer) throw new Error('BrushVR DOM missing (#br-wrap / #br-layer)');

  // ---------------- ctx ----------------
  const qs = getQS();
  const CTX = {
    hub: qs.get('hub') || '../hub.html',
    run: (qs.get('run')||qs.get('mode')||'play').toLowerCase(),
    view: normalizeView(getViewAuto()),
    diff: (qs.get('diff') || 'normal').toLowerCase(),
    time: safeNum(qs.get('time'), 80),
    seed: safeNum(qs.get('seed'), Date.now()),
    pid: (qs.get('pid') || '').trim(),
    studyId: (qs.get('studyId') || '').trim(),
    phase: (qs.get('phase') || '').trim(),
    conditionGroup: (qs.get('conditionGroup') || '').trim(),
    ai: String(qs.get('ai','1')) !== '0',
    debug: safeNum(qs.get('debug'), 0) === 1
  };
  CTX.time = clamp(CTX.time, 30, 120);
  if(!['easy','normal','hard'].includes(CTX.diff)) CTX.diff = 'normal';

  WIN.HHA_BRUSH_CTX = CTX;

  try{ DOC.documentElement.dataset.view = (CTX.view==='cvr' ? 'cvr' : CTX.view); }catch(_){}
  try{ DOC.body.setAttribute('data-view', CTX.view); }catch(_){}
  wrap.dataset.view = CTX.view;

  if(ctxView) ctxView.textContent = CTX.view;
  if(ctxSeed) ctxSeed.textContent = String((CTX.seed >>> 0));
  if(ctxTime) ctxTime.textContent = `${CTX.time}s`;
  if(diffTag) diffTag.textContent = CTX.diff;
  if(aiTag) aiTag.textContent = CTX.ai ? '1' : '0';
  if(mDiff) mDiff.textContent = CTX.diff;
  if(mTime) mTime.textContent = `${CTX.time}s`;

  function setBackLinks(){
    const hubUrl = CTX.hub || '../hub.html';
    [btnBack, btnBackHub2].forEach(a=>{
      if(!a) return;
      try{
        const u = new URL(hubUrl, location.href);
        if(CTX.pid) u.searchParams.set('pid', CTX.pid);
        if(CTX.studyId) u.searchParams.set('studyId', CTX.studyId);
        if(CTX.phase) u.searchParams.set('phase', CTX.phase);
        if(CTX.conditionGroup) u.searchParams.set('conditionGroup', CTX.conditionGroup);
        a.href = u.toString();
      }catch(_){
        a.href = hubUrl;
      }
    });
  }
  setBackLinks();

  const rng = seededRng(CTX.seed);

  // optional fun boost
  const fun = WIN.HHA?.createFunBoost?.({
    seed: (qs.get('seed') || CTX.pid || 'brush'),
    baseSpawnMul: 1.0,
    waveCycleMs: 20000,
    feverThreshold: 18,
    feverDurationMs: 6800,
    feverSpawnBoost: 1.18,
    feverTimeScale: 0.92
  });
  let director = fun ? fun.tick() : { spawnMul:1, timeScale:1, wave:'calm', intensity:0, feverOn:false };

  // ---------------- state ----------------
  const ZONES = [
    { id:'outerTop',    label:'ฟันบนด้านนอก', stage:'A', hint:'แปรงฟันบนด้านนอกเบา ๆ ให้ครบ' },
    { id:'outerBottom', label:'ฟันล่างด้านนอก', stage:'A', hint:'ต่อด้วยฟันล่างด้านนอก' },
    { id:'innerTop',    label:'ฟันบนด้านใน', stage:'B', hint:'อย่าลืมด้านในของฟันบน' },
    { id:'innerBottom', label:'ฟันล่างด้านใน', stage:'B', hint:'ต่อด้วยด้านในของฟันล่าง' },
    { id:'chew',        label:'ฟันบดเคี้ยว', stage:'C', hint:'แปรงผิวเคี้ยวของฟันกราม' },
    { id:'tongue',      label:'ลิ้น', stage:'C', hint:'สุดท้ายแปรงลิ้นเบา ๆ' }
  ];

  const S = {
    running:false,
    paused:false,
    ended:false,
    quizOpen:false,

    t0:0,
    score:0,
    combo:0,
    comboMax:0,
    miss:0,
    shots:0,
    hits:0,

    clean:0,
    cleanGainPerHit: 1.3,
    cleanLosePerMiss: 0.45,

    plaquePerZone: CTX.diff==='hard' ? 9 : (CTX.diff==='easy' ? 5 : 7),

    stage:'A',
    eviTotal:0,
    eviNeed:3,
    eviFlags:{ sugar:0, night:0, no_brush:0 },
    quizDone:false,
    quizCorrect:false,

    aiRisk:0,
    aiTip:'—',
    aiBand:'low',
    missStreak:0,
    lastAiEmit:0,

    zoneIndex:0,
    zoneDone:{},
    currentZoneId:'outerTop',

    brushDown:false,
    brushX:0,
    brushY:0,
    brushRadius: 34,

    // entities
    plaque:new Map(),   // id -> {id, x, y, zoneId, el, alive}
    evidence:new Map(), // id -> {id, x, y, kind, el, alive}
    uid:0,

    mouthRoot:null,
    brushEl:null,
    zoneEls:{}
  };

  // ---------------- scroll lock ----------------
  const ScrollLock = {
    on(){
      try{
        DOC.documentElement.style.overflow='hidden';
        DOC.body.style.overflow='hidden';
        DOC.body.style.height='100%';
        DOC.body.style.touchAction='none';
        DOC.body.classList.add('br-noscroll');
      }catch(_){}
    },
    off(){
      try{
        DOC.documentElement.style.overflow='';
        DOC.body.style.overflow='';
        DOC.body.style.height='';
        DOC.body.style.touchAction='';
        DOC.body.classList.remove('br-noscroll');
      }catch(_){}
    }
  };

  DOC.addEventListener('touchmove', (e)=>{
    if(S.running && !S.ended && !S.quizOpen) e.preventDefault();
  }, { passive:false });

  // ---------------- AI ----------------
  function aiPredict(){
    const acc = (S.shots>0) ? (S.hits/S.shots) : 0;
    const missRate = (S.shots>0) ? (S.miss/S.shots) : 0;
    const combo = S.combo;
    const clean = S.clean/100;
    const evi = S.eviTotal/3;
    const progress = S.zoneIndex / ZONES.length;

    let risk = 0.30;
    risk += missRate * 0.48;
    risk += (acc<0.55 ? 0.18 : (acc>0.85 ? -0.08 : 0));
    risk += (combo===0 ? 0.08 : (combo>=6 ? -0.05 : -0.02));
    risk += (clean<0.35 ? 0.08 : (clean>0.75 ? -0.04 : 0));
    risk += (S.stage==='B' && evi<0.67 ? 0.05 : 0);
    risk += (progress<0.34 && (now()-S.t0)>25000 ? 0.05 : 0);
    risk = clamp(risk, 0, 1);

    let band='low';
    if(risk>=0.68) band='high';
    else if(risk>=0.45) band='mid';

    let tip = currentZone() ? currentZone().hint : 'แปรงให้ครบทุกด้าน';
    if(risk>0.72) tip='ช้าลงนิด แล้วลากให้โดนคราบทีละจุด';
    else if(risk<0.35 && combo>=6) tip='ดีมาก! รักษาจังหวะการแปรงแบบนี้ต่อ';

    return { risk, band, tip };
  }

  function aiTick(force){
    if(!CTX.ai) return;
    const t = Date.now();
    if(!force && (t - S.lastAiEmit) < 520) return;
    S.lastAiEmit = t;

    const p = aiPredict();
    S.aiRisk = p.risk;
    S.aiBand = p.band;
    S.aiTip  = p.tip;

    aiEmit('risk', {
      risk:p.risk, band:p.band, tip:p.tip,
      stage:S.stage, zone: S.currentZoneId,
      combo:S.combo, missStreak:S.missStreak
    });
  }

  function onMissStreak(){
    if(!CTX.ai) return;
    if(S.missStreak===2) aiEmit('miss_streak', { n:2, band:S.aiBand });
    if(S.missStreak===4) aiEmit('miss_streak', { n:4, band:'high' });
  }
  function onComboHot(){
    if(!CTX.ai) return;
    if(S.combo===6) aiEmit('combo_hot', { combo:6 });
    if(S.combo===10) aiEmit('combo_hot', { combo:10 });
  }

  // ---------------- HUD ----------------
  function renderHud(force){
    const t = now();
    if(!force && S._lastHud && (t - S._lastHud) < 70) return;
    S._lastHud = t;

    const elapsed = S.running ? ((t - S.t0)/1000) : 0;
    const left = S.running ? Math.max(0, CTX.time - elapsed) : CTX.time;

    if(tStage) tStage.textContent = `${S.stage} · ${currentZone()?.label || '-'}`;
    if(tScore) tScore.textContent = String(S.score);
    if(tCombo) tCombo.textContent = String(S.combo);
    if(tMiss)  tMiss.textContent  = String(S.miss);
    if(tTime)  tTime.textContent  = left.toFixed(0);

    const clean = clamp(S.clean, 0, 100);
    if(tClean) tClean.textContent = `${Math.round(clean)}%`;
    if(bClean) bClean.style.width = `${clean}%`;

    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pctF = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    if(tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';
    if(bFever) bFever.style.width = `${pctF}%`;

    const ePct = clamp((S.eviTotal / S.eviNeed) * 100, 0, 100);
    if(tEvi) tEvi.textContent = `${S.eviTotal}/${S.eviNeed}`;
    if(bEvi) bEvi.style.width = `${ePct}%`;

    const rPct = clamp(S.aiRisk * 100, 0, 100);
    if(tRisk) tRisk.textContent = `${Math.round(rPct)}%`;
    if(bRisk) bRisk.style.width = `${rPct}%`;
    if(tTip)  tTip.textContent  = S.aiTip || '—';
  }

  // ---------------- mouth map ----------------
  function zoneRectMap(){
    const w = layer.clientWidth || 900;
    const h = layer.clientHeight || 420;

    return {
      outerTop:    { x:w*0.18, y:h*0.18, w:w*0.64, h:h*0.12, shape:'pill' },
      outerBottom: { x:w*0.18, y:h*0.68, w:w*0.64, h:h*0.12, shape:'pill' },
      innerTop:    { x:w*0.22, y:h*0.33, w:w*0.56, h:h*0.10, shape:'pill' },
      innerBottom: { x:w*0.22, y:h*0.54, w:w*0.56, h:h*0.10, shape:'pill' },
      chew:        { x:w*0.10, y:h*0.42, w:w*0.80, h:h*0.09, shape:'pill' },
      tongue:      { x:w*0.30, y:h*0.78, w:w*0.40, h:h*0.10, shape:'oval' }
    };
  }

  function ensureMouthMap(){
    if(S.mouthRoot) return;

    layer.innerHTML = '';

    const root = DOC.createElement('div');
    root.style.position = 'absolute';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';
    root.style.userSelect = 'none';

    const bg = DOC.createElement('div');
    bg.style.position = 'absolute';
    bg.style.inset = '5% 6% 8% 6%';
    bg.style.borderRadius = '28px';
    bg.style.background = 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.07), rgba(255,255,255,.02) 55%, rgba(2,6,23,.12) 100%)';
    bg.style.border = '1px solid rgba(255,255,255,.05)';
    root.appendChild(bg);

    const title = DOC.createElement('div');
    title.id = 'mouthGuide';
    title.style.position = 'absolute';
    title.style.left = '50%';
    title.style.top = '10px';
    title.style.transform = 'translateX(-50%)';
    title.style.padding = '8px 12px';
    title.style.borderRadius = '999px';
    title.style.background = 'rgba(2,6,23,.72)';
    title.style.border = '1px solid rgba(148,163,184,.18)';
    title.style.fontWeight = '900';
    title.style.fontSize = '12px';
    title.style.color = 'rgba(229,231,235,.96)';
    title.style.boxShadow = '0 10px 28px rgba(0,0,0,.25)';
    title.textContent = 'เริ่มแปรงฟัน';
    root.appendChild(title);

    const rects = zoneRectMap();
    const zoneEls = {};

    Object.keys(rects).forEach((id)=>{
      const z = rects[id];
      const el = DOC.createElement('div');
      el.dataset.zoneId = id;
      el.style.position = 'absolute';
      el.style.left = `${z.x}px`;
      el.style.top = `${z.y}px`;
      el.style.width = `${z.w}px`;
      el.style.height = `${z.h}px`;
      el.style.borderRadius = z.shape==='oval' ? '999px' : '18px';
      el.style.border = '1px dashed rgba(148,163,184,.22)';
      el.style.background = 'rgba(255,255,255,.02)';
      el.style.transition = 'all .18s ease';
      root.appendChild(el);
      zoneEls[id] = el;
    });

    const brush = DOC.createElement('div');
    brush.id = 'brushHead';
    brush.style.position = 'absolute';
    brush.style.width = `${S.brushRadius*2}px`;
    brush.style.height = `${S.brushRadius*2}px`;
    brush.style.borderRadius = '999px';
    brush.style.transform = 'translate(-50%,-50%)';
    brush.style.background = 'radial-gradient(circle at 40% 40%, rgba(255,255,255,.28), rgba(34,211,238,.20) 55%, rgba(34,211,238,.06) 100%)';
    brush.style.border = '2px solid rgba(34,211,238,.32)';
    brush.style.boxShadow = '0 0 26px rgba(34,211,238,.18)';
    brush.style.pointerEvents = 'none';
    brush.style.display = 'none';
    root.appendChild(brush);

    layer.appendChild(root);
    S.mouthRoot = root;
    S.zoneEls = zoneEls;
    S.brushEl = brush;

    updateZoneHighlight();
  }

  function currentZone(){
    return ZONES[S.zoneIndex] || null;
  }

  function updateZoneHighlight(){
    if(!S.zoneEls) return;
    const zone = currentZone();
    const guide = DOC.getElementById('mouthGuide');

    Object.keys(S.zoneEls).forEach((id)=>{
      const el = S.zoneEls[id];
      const done = !!S.zoneDone[id];
      const active = zone && zone.id === id;
      el.style.background = done
        ? 'rgba(16,185,129,.16)'
        : active
          ? 'rgba(34,211,238,.18)'
          : 'rgba(255,255,255,.02)';
      el.style.borderColor = done
        ? 'rgba(16,185,129,.46)'
        : active
          ? 'rgba(34,211,238,.56)'
          : 'rgba(148,163,184,.22)';
      el.style.boxShadow = active
        ? '0 0 0 2px rgba(34,211,238,.10) inset, 0 0 16px rgba(34,211,238,.12)'
        : 'none';
    });

    if(guide){
      guide.textContent = zone ? `ตอนนี้: ${zone.label}` : 'ครบทุกโซนแล้ว';
    }
  }

  function zoneBounds(zoneId){
    const rects = zoneRectMap();
    return rects[zoneId];
  }

  // ---------------- plaque / evidence ----------------
  function clearPlaque(){
    for(const v of S.plaque.values()){
      try{ v.el.remove(); }catch(_){}
    }
    S.plaque.clear();
  }

  function clearEvidence(){
    for(const v of S.evidence.values()){
      try{ v.el.remove(); }catch(_){}
    }
    S.evidence.clear();
  }

  function makeBubble(x, y, emoji, kind){
    const el = DOC.createElement('div');
    el.textContent = emoji;
    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.width = kind==='evidence' ? '38px' : '28px';
    el.style.height = kind==='evidence' ? '38px' : '28px';
    el.style.transform = 'translate(-50%,-50%)';
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.borderRadius = '999px';
    el.style.background = kind==='evidence'
      ? 'rgba(251,191,36,.16)'
      : 'rgba(2,6,23,.76)';
    el.style.border = kind==='evidence'
      ? '1px solid rgba(251,191,36,.34)'
      : '1px solid rgba(148,163,184,.18)';
    el.style.boxShadow = '0 12px 26px rgba(0,0,0,.26)';
    el.style.pointerEvents = 'none';
    el.style.userSelect = 'none';
    el.style.fontSize = kind==='evidence' ? '20px' : '16px';
    return el;
  }

  function spawnPlaqueForZone(zoneId){
    clearPlaque();
    const z = zoneBounds(zoneId);
    if(!z) return;

    const n = S.plaquePerZone;
    for(let i=0;i<n;i++){
      const px = z.x + 14 + rng() * Math.max(10, z.w - 28);
      const py = z.y + 10 + rng() * Math.max(10, z.h - 20);

      const id = 'p' + (++S.uid);
      const el = makeBubble(px, py, '🦠', 'plaque');
      layer.appendChild(el);
      S.plaque.set(id, { id, x:px, y:py, zoneId, el, alive:true });
    }
  }

  function spawnEvidenceIfNeeded(){
    clearEvidence();
    if(S.stage !== 'B' || S.eviTotal >= S.eviNeed) return;

    const kinds = ['sugar','night','no_brush'];
    const labels = { sugar:'🍬', night:'🌙', no_brush:'🚫🪥' };
    const missing = kinds.filter(k => !S.eviFlags[k]);
    const chosen = missing.length ? missing.slice(0, Math.min(2, missing.length)) : [];

    const z = zoneBounds(S.currentZoneId) || { x:100, y:100, w:200, h:80 };
    chosen.forEach((k, i)=>{
      const x = z.x + z.w * (0.25 + (i*0.45));
      const y = z.y - 26;
      const id = 'e' + (++S.uid);
      const el = makeBubble(x, y, labels[k], 'evidence');
      layer.appendChild(el);
      S.evidence.set(id, { id, x, y, kind:k, el, alive:true });
    });
  }

  function collectEvidence(kind){
    if(!kind || S.eviFlags[kind]) return;
    S.eviFlags[kind] = 1;
    S.eviTotal = clamp(S.eviTotal + 1, 0, S.eviNeed);
    toast(`หลักฐาน +1 (${S.eviTotal}/3)`);
    aiEmit('evidence', { kind, total:S.eviTotal });
  }

  // ---------------- gameplay ----------------
  function advanceZone(){
    const zone = currentZone();
    if(zone){
      S.zoneDone[zone.id] = true;
    }
    S.zoneIndex += 1;

    const next = currentZone();
    if(!next){
      if(S.stage !== 'C'){
        S.stage = 'C';
      }
      updateZoneHighlight();
      if(!S.quizDone) openQuiz();
      return;
    }

    S.stage = next.stage;
    updateZoneHighlight();
    spawnPlaqueForZone(next.id);
    spawnEvidenceIfNeeded();
    toast(`ต่อไป: ${next.label}`);
    aiEmit('stage', { stage:S.stage, zone:next.id, zoneLabel:next.label });
  }

  function hitPlaque(id){
    const p = S.plaque.get(id);
    if(!p || !p.alive) return;

    p.alive = false;
    S.plaque.delete(id);
    try{ p.el.remove(); }catch(_){}

    S.hits += 1;
    S.shots += 1;
    S.combo += 1;
    S.comboMax = Math.max(S.comboMax, S.combo);
    onComboHot();
    S.missStreak = 0;

    S.score += Math.round(4 + Math.min(10, S.combo * 0.5));
    S.clean = clamp(S.clean + S.cleanGainPerHit, 0, 100);

    if(fun){
      fun.onAction?.({ type:'hit' });
      director = fun.tick();
    }

    if(S.plaque.size === 0){
      if(S.stage === 'B' && S.eviTotal < S.eviNeed){
        toast('เก็บหลักฐานด้านบนให้ครบก่อน');
        spawnPlaqueForZone(S.currentZoneId); // เติมใหม่เล็กน้อยถ้ายังไม่เก็บ evidence
        return;
      }
      advanceZone();
    }
  }

  function hitEvidence(id){
    const e = S.evidence.get(id);
    if(!e || !e.alive) return;
    e.alive = false;
    S.evidence.delete(id);
    try{ e.el.remove(); }catch(_){}
    collectEvidence(e.kind);
  }

  function brushAt(x, y, source){
    S.brushX = x;
    S.brushY = y;

    if(S.brushEl){
      S.brushEl.style.display = 'block';
      S.brushEl.style.left = `${x}px`;
      S.brushEl.style.top = `${y}px`;
    }

    let hitAny = false;

    for(const [id, p] of Array.from(S.plaque.entries())){
      const dx = x - p.x;
      const dy = y - p.y;
      const d2 = dx*dx + dy*dy;
      const rr = S.brushRadius + 12;
      if(d2 <= rr*rr){
        hitPlaque(id);
        hitAny = true;
      }
    }

    for(const [id, e] of Array.from(S.evidence.entries())){
      const dx = x - e.x;
      const dy = y - e.y;
      const d2 = dx*dx + dy*dy;
      const rr = S.brushRadius + 14;
      if(d2 <= rr*rr){
        hitEvidence(id);
        hitAny = true;
      }
    }

    if(hitAny){
      renderHud(true);
      aiTick(false);
      emit('hha:score', { score:S.score, combo:S.combo, miss:S.miss, clean:S.clean, ts:Date.now(), source });
      return;
    }

    // whiff only when actively brushing, not every move
    if(source === 'stroke'){
      S.shots += 1;
      S.miss += 1;
      S.combo = 0;
      S.missStreak += 1;
      onMissStreak();
      S.clean = clamp(S.clean - S.cleanLosePerMiss, 0, 100);
      toast('ยังไม่โดนคราบ');
      renderHud(true);
      aiTick(false);
    }
  }

  function pointerPosFromEvent(ev){
    const r = layer.getBoundingClientRect();
    return {
      x: clamp(ev.clientX - r.left, 0, r.width),
      y: clamp(ev.clientY - r.top, 0, r.height)
    };
  }

  // ---------------- quiz ----------------
  function quizAnswer(){
    if(!quizChoices) return '';
    const checked = quizChoices.querySelector('input[name="quizA"]:checked');
    return checked ? String(checked.value||'') : '';
  }

  function openQuiz(){
    if(!quiz){ S.quizDone=true; return; }
    if(S.quizOpen || S.quizDone) return;
    S.quizOpen = true;
    quiz.hidden = false;
    quiz.style.display = 'grid';
    wrap.dataset.state = 'quiz';
    aiEmit('quiz', { state:'open' });
    toast('ตอบคำถามสั้น ๆ ก่อนจบ');
  }

  function closeQuiz(){
    if(!quiz) return;
    S.quizOpen = false;
    quiz.hidden = true;
    quiz.style.display = 'none';
    wrap.dataset.state = 'play';
    aiEmit('quiz', { state:'close', done:S.quizDone, correct:S.quizCorrect });
  }

  function applyQuizResult(ok){
    S.quizDone = true;
    S.quizCorrect = !!ok;
    closeQuiz();

    if(S.quizCorrect){
      S.score += 40;
      S.clean = clamp(S.clean + 8, 0, 100);
      toast('✅ ถูกต้อง!');
    }else{
      S.score += 12;
      toast('❌ ยังไม่ถูก แต่เล่นต่อได้');
    }

    aiEmit('quiz', { state:'done', correct:S.quizCorrect });

    if(S.zoneIndex >= ZONES.length){
      endGame('clean');
    }else{
      renderHud(true);
    }
  }

  function bindQuiz(){
    if(!quiz) return;
    quiz.hidden = true;
    quiz.style.display = 'none';

    btnQuizSubmit?.addEventListener('click', ()=>{
      const ok = (quizAnswer() === 'b');
      applyQuizResult(ok);
    }, { passive:true });

    btnQuizSkip?.addEventListener('click', ()=>{
      applyQuizResult(false);
    }, { passive:true });
  }

  // ---------------- main timers ----------------
  let tickTimer = null;

  function tick(){
    if(!S.running || S.paused || S.ended) return;

    if(fun) director = fun.tick();

    const elapsed = (now() - S.t0)/1000;
    const left = CTX.time - elapsed;

    if(left <= 10.3 && left >= 9.7){
      aiEmit('time', { left:10 });
    }

    aiTick(false);
    renderHud(false);
    emit('hha:time', { t: Math.max(0,left), elapsed, ts:Date.now() });

    if(left <= 0){
      endGame('time');
    }
  }

  function clearTimers(){
    clearInterval(tickTimer);
    tickTimer = null;
  }

  // ---------------- summary ----------------
  function gradeFromAcc(acc){
    if(acc >= 92) return 'S';
    if(acc >= 82) return 'A';
    if(acc >= 70) return 'B';
    if(acc >= 55) return 'C';
    return 'D';
  }

  function hardenViewBeforePlay(){
    ScrollLock.on();
    try{ DOC.body.style.webkitTextSizeAdjust = '100%'; }catch(_){}
  }
  function releaseAfterPlay(){
    ScrollLock.off();
  }

  function startGame(){
    S.running = true;
    S.paused = false;
    S.ended = false;
    S.quizOpen = false;
    S.t0 = now();

    S.score = 0;
    S.combo = 0;
    S.comboMax = 0;
    S.miss = 0;
    S.shots = 0;
    S.hits = 0;
    S.clean = 0;

    S.stage = 'A';
    S.eviTotal = 0;
    S.eviFlags = { sugar:0, night:0, no_brush:0 };
    S.quizDone = false;
    S.quizCorrect = false;

    S.aiRisk = 0;
    S.aiTip = '—';
    S.aiBand = 'low';
    S.missStreak = 0;
    S.lastAiEmit = 0;

    S.zoneIndex = 0;
    S.zoneDone = {};
    S.currentZoneId = ZONES[0].id;

    S.plaque.clear();
    S.evidence.clear();

    ensureMouthMap();
    updateZoneHighlight();
    clearPlaque();
    clearEvidence();
    spawnPlaqueForZone(ZONES[0].id);

    if(menu) menu.style.display='none';
    if(end){ end.hidden=true; end.style.display='none'; }
    if(quiz){ quiz.hidden=true; quiz.style.display='none'; }
    wrap.dataset.state='play';
    btnPause && (btnPause.textContent='Pause');

    hardenViewBeforePlay();

    toast('เริ่มแปรง! ทำตามลำดับให้ครบทุกด้าน');
    aiEmit('stage', { stage:S.stage, zone:S.currentZoneId, zoneLabel: currentZone().label });
    aiTick(true);
    renderHud(true);

    emit('hha:start', {
      game:'brush',
      category:'hygiene',
      pid: CTX.pid,
      studyId: CTX.studyId,
      phase: CTX.phase,
      conditionGroup: CTX.conditionGroup,
      seed: CTX.seed,
      diff: CTX.diff,
      view: CTX.view,
      timePlannedSec: CTX.time,
      ts: Date.now()
    });

    clearTimers();
    tickTimer = setInterval(tick, 80);
  }

  function endGame(reason){
    if(S.ended) return;
    S.ended = true;
    S.running = false;

    clearTimers();
    releaseAfterPlay();

    clearPlaque();
    clearEvidence();

    if(S.brushEl) S.brushEl.style.display = 'none';

    const acc = (S.shots>0) ? (S.hits/S.shots)*100 : 0;
    const grade = gradeFromAcc(acc);
    const elapsed = Math.min(CTX.time, (now()-S.t0)/1000);

    const summary = {
      game:'brush',
      category:'hygiene',
      reason,
      pid: CTX.pid,
      studyId: CTX.studyId,
      phase: CTX.phase,
      conditionGroup: CTX.conditionGroup,
      seed: CTX.seed,
      diff: CTX.diff,
      view: CTX.view,
      ai: CTX.ai ? 1 : 0,

      stage: S.stage,
      zonesDone: Object.keys(S.zoneDone).length,
      totalZones: ZONES.length,
      evidence: { total:S.eviTotal, flags: Object.assign({}, S.eviFlags) },
      quiz: { done:S.quizDone, correct:S.quizCorrect },

      score: S.score,
      comboMax: S.comboMax,
      miss: S.miss,
      shots: S.shots,
      hits: S.hits,
      accuracyPct: Math.round(acc*10)/10,
      grade,
      cleanPct: Math.round(clamp(S.clean,0,100)),
      timePlannedSec: CTX.time,
      timePlayedSec: Math.round(elapsed*10)/10,
      date: ymdLocal(),
      ts: Date.now()
    };

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const k='HHA_SUMMARY_HISTORY';
      const arr = JSON.parse(localStorage.getItem(k)||'[]');
      arr.push(summary);
      localStorage.setItem(k, JSON.stringify(arr.slice(-40)));
    }catch(_){}

    try{
      localStorage.setItem(`HHA_ZONE_DONE::hygiene::${ymdLocal()}`, '1');
    }catch(_){}

    emit('hha:end', summary);

    if(sScore) sScore.textContent = String(summary.score);
    if(sAcc)   sAcc.textContent   = `${summary.accuracyPct}%`;
    if(sMiss)  sMiss.textContent  = String(summary.miss);
    if(sCombo) sCombo.textContent = String(summary.comboMax);
    if(sClean) sClean.textContent = `${summary.cleanPct}%`;
    if(sTime)  sTime.textContent  = `${summary.timePlayedSec}s`;
    if(endGrade) endGrade.textContent = summary.grade;

    if(endNote){
      endNote.textContent =
        `reason=${reason} | zones=${summary.zonesDone}/${summary.totalZones} | evi=${summary.evidence.total}/3 | quiz=${summary.quiz.correct?'ok':'no'} | seed=${summary.seed}`;
    }

    if(end){
      end.hidden = false;
      end.style.display = 'grid';
    }
    if(menu) menu.style.display = 'none';
    if(quiz){ quiz.hidden = true; quiz.style.display = 'none'; }
    wrap.dataset.state = 'end';

    toast(reason==='clean' ? '🪥 แปรงครบทุกด้านแล้ว!' : 'หมดเวลา!');
  }

  function togglePause(){
    if(!S.running || S.ended || S.quizOpen) return;
    S.paused = !S.paused;
    btnPause && (btnPause.textContent = S.paused ? 'Resume' : 'Pause');
    toast(S.paused ? '⏸ Pause' : '▶ Resume');
    if(S.brushEl && S.paused) S.brushEl.style.display = 'none';
  }

  // ---------------- input ----------------
  layer.addEventListener('pointerdown', (ev)=>{
    if(CTX.view === 'cvr') return;
    if(!S.running || S.paused || S.ended || S.quizOpen) return;
    ev.preventDefault();

    S.brushDown = true;
    const p = pointerPosFromEvent(ev);
    brushAt(p.x, p.y, 'stroke');
  }, { passive:false });

  layer.addEventListener('pointermove', (ev)=>{
    if(CTX.view === 'cvr') return;
    if(!S.running || S.paused || S.ended || S.quizOpen || !S.brushDown) return;
    ev.preventDefault();

    const p = pointerPosFromEvent(ev);
    brushAt(p.x, p.y, 'drag');
  }, { passive:false });

  const endBrush = ()=>{
    S.brushDown = false;
    if(S.brushEl) S.brushEl.style.display = 'none';
  };

  layer.addEventListener('pointerup', endBrush, { passive:true });
  layer.addEventListener('pointerleave', endBrush, { passive:true });
  layer.addEventListener('pointercancel', endBrush, { passive:true });

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!S.running || S.paused || S.ended || S.quizOpen) return;
    const d = (ev && ev.detail) || {};
    const x = safeNum(d.x, WIN.innerWidth/2);
    const y = safeNum(d.y, WIN.innerHeight/2);
    const r = layer.getBoundingClientRect();
    const lx = clamp(x - r.left, 0, r.width);
    const ly = clamp(y - r.top, 0, r.height);
    brushAt(lx, ly, 'shoot');
  });

  // ---------------- controls ----------------
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRetry?.addEventListener('click', startGame, { passive:true });
  btnPause?.addEventListener('click', togglePause, { passive:true });

  btnHow?.addEventListener('click', ()=>{
    toast('ลากนิ้วแปรงคราบตามส่วนที่เกมบอกให้ครบทีละด้าน');
  }, { passive:true });

  btnRecenter?.addEventListener('click', ()=>{
    WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts:Date.now() } }));
    toast('Recenter');
  }, { passive:true });

  bindQuiz();

  if(end){ end.hidden=true; end.style.display='none'; }
  if(quiz){ quiz.hidden=true; quiz.style.display='none'; }
  if(menu) menu.style.display='grid';
  wrap.dataset.state='menu';

  aiTick(true);
  renderHud(true);
  toast('พร้อมแล้ว! กดเริ่มเกมได้เลย');

  // compatibility for brush.boot.js
  WIN.HHA_BRUSH = WIN.HHA_BRUSH || {};
  WIN.HHA_BRUSH.boot = function(){
    if(CTX.debug) console.log('[BrushVR] boot called (safe.js already autoloaded)');
  };

})();