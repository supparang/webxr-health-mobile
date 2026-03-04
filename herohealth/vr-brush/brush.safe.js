// === /herohealth/vr-brush/brush.safe.js ===
// Brush SAFE — BLOOM PACK1 (Quiz + Zones + Residue/Risk + Heatmap)
// FULL v20260304-BRUSH-SAFE-BLOOM1
'use strict';

export function bootGame(){
  const W = window, D = document;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b, Number(v)||0));
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  const DIFF = String(qs('diff','normal')).toLowerCase();
  const TIME = clamp(qs('time','80'), 30, 180);
  const PID  = String(qs('pid','anon'));
  const VIEW = String(qs('view','')).toLowerCase();
  const IS_CVR = (VIEW === 'cvr');

  // --- Bloom: zones (6) ---
  const ZONES = [
    { id:'U-OUT', label:'บน-นอก' },
    { id:'U-IN',  label:'บน-ใน'  },
    { id:'U-CH',  label:'บน-บด'  },
    { id:'L-OUT', label:'ล่าง-นอก' },
    { id:'L-IN',  label:'ล่าง-ใน'  },
    { id:'L-CH',  label:'ล่าง-บด'  },
  ];

  // emoji pools
  const EMOJI = {
    plaque: ['🦷','✨','🫧','🪥','💎','⭐'],
    germ:   ['🦠','😈','🤢','💀','☣️','🧫','☠️']
  };
  const pickEmoji = (kind)=> (EMOJI[kind]||['🎯'])[Math.floor(Math.random()*(EMOJI[kind]||['🎯']).length)];

  const UI = {
    phasePill: D.getElementById('phasePill'),
    timePill:  D.getElementById('timePill'),
    scorePill: D.getElementById('scorePill'),
    comboPill: D.getElementById('comboPill'),
    missionPill: D.getElementById('missionPill'),
    missPill:  D.getElementById('missPill'),
    accPill:   D.getElementById('accPill'),
    toolPill:  D.getElementById('toolPill'),
    viewPill:  D.getElementById('viewPill'),
    residuePill: D.getElementById('residuePill'),
    riskPill: D.getElementById('riskPill'),

    domTargets: D.getElementById('domTargets'),

    panelQuiz: D.getElementById('panelQuiz'),
    quizBody: D.getElementById('quizBody'),
    btnQuizNext: D.getElementById('btnQuizNext'),

    panelHelp: D.getElementById('panelHelp'),
    btnCloseHelp: D.getElementById('btnCloseHelp'),

    panelEnd: D.getElementById('panelEnd'),
    endSummary: D.getElementById('endSummary'),
    heatmap: D.getElementById('heatmap'),
    reasonChips: D.getElementById('reasonChips'),

    btnStart: D.getElementById('btnStart'),
    btnHelp: D.getElementById('btnHelp'),
    btnReplay: D.getElementById('btnReplay'),
    btnBack: D.getElementById('btnBack'),
    crosshair: D.getElementById('crosshair'),
  };

  const S = {
    started:false, ended:false,
    sessionId:`brush_${PID}_${Date.now()}`,
    startMs:0,
    timeLeft: TIME,

    score:0, combo:0, comboMax:0, miss:0,
    goodSpawn:0, junkSpawn:0, goodHit:0, junkHit:0, goodExpire:0,

    residue:0,     // 0..100 (B2)
    gumRisk:0,     // 0..100 (B2)

    // zone stats (B3-B4)
    zone: Object.fromEntries(ZONES.map(z=>[z.id, {spawn:0, hit:0, miss:0}] )),

    targets:new Map(),
    seq:0,
    spawnEveryMs: 900,
    ttlMs: 1500,
    lastSpawnMs:0,
    lastFrameMs:0,

    quizIndex:0,
    quizCorrect:0,
    selfReason:'',
  };

  // Optional modules (best-effort)
  let MISS=null;
  (async ()=>{
    try{ MISS = (await import('./brush.missions.js?v=20260304')).bootMissions({ diff: DIFF }); }catch(e){}
    try{ await import('./ai-brush.js?v=20260304'); }catch(e){}
    try{ await import('./brush.fx.js?v=20260304'); }catch(e){}
  })();

  function tuneByDiff(){
    if (DIFF==='easy'){ S.spawnEveryMs=1050; S.ttlMs=1800; }
    else if (DIFF==='hard'){ S.spawnEveryMs=750; S.ttlMs=1350; }
    else { S.spawnEveryMs=900; S.ttlMs=1500; }
  }

  function hud(){
    UI.phasePill && (UI.phasePill.textContent = `PHASE: BRUSH`);
    UI.timePill  && (UI.timePill.textContent  = `TIME: ${Math.max(0, Math.ceil(S.timeLeft))}`);
    UI.scorePill && (UI.scorePill.textContent = `SCORE: ${Math.round(S.score)}`);
    UI.comboPill && (UI.comboPill.textContent = `COMBO: ${S.combo}`);
    UI.missPill  && (UI.missPill.textContent  = `MISS: ${S.miss}`);

    const den = (S.goodHit + S.goodExpire);
    const acc = den ? Math.round((S.goodHit / Math.max(1, den)) * 100) : 0;
    UI.accPill && (UI.accPill.textContent = `ACC: ${acc}%`);

    UI.toolPill && (UI.toolPill.textContent = `TOOL: BRUSH`);
    UI.viewPill && (UI.viewPill.textContent = `VIEW: ${IS_CVR ? 'cVR' : 'PC/Mobile'}`);
    UI.crosshair && (UI.crosshair.style.display = IS_CVR ? 'block' : 'none');

    if (UI.residuePill) UI.residuePill.textContent = `RESIDUE: ${Math.round(S.residue)}%`;
    if (UI.riskPill) UI.riskPill.textContent = `GUM RISK: ${Math.round(S.gumRisk)}%`;

    if (UI.missionPill && MISS && typeof MISS.text === 'function'){
      UI.missionPill.textContent = `MISSION: ${MISS.text()}`;
    }
  }

  function rid(){ return `t${++S.seq}`; }

  function pickZone(){
    // ensure coverage: prefer zones with low spawn count
    const arr = ZONES.map(z=>({z, w: 1/(1+S.zone[z.id].spawn)}));
    const sum = arr.reduce((a,b)=>a+b.w,0);
    let r = Math.random()*sum;
    for(const it of arr){ r -= it.w; if(r<=0) return it.z; }
    return ZONES[Math.floor(Math.random()*ZONES.length)];
  }

  function spawnDomTarget(id, kind, emoji, zoneId){
    const layer = UI.domTargets;
    if(!layer) return null;
    const good = (kind === 'plaque');

    const el = D.createElement('div');
    el.className = `domTarget ${good ? 'good' : 'bad'}`;
    el.textContent = emoji;

    const ztag = D.createElement('div');
    ztag.className = 'z';
    ztag.textContent = zoneId;
    el.appendChild(ztag);

    const w = window.innerWidth || 360;
    const h = window.innerHeight || 640;
    const x = Math.round(w*0.18 + Math.random()*w*0.64);
    const y = Math.round(h*0.22 + Math.random()*h*0.56);
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    el.addEventListener('click', (e)=>{ e.preventDefault(); hitTarget(id); }, { passive:false });
    layer.appendChild(el);
    return el;
  }

  function spawnTarget(kind='plaque'){
    if (!S.started || S.ended) return;

    const id = rid();
    const bornAt = now();
    const ttlAt = bornAt + S.ttlMs;

    const emoji = pickEmoji(kind);
    const good = (kind === 'plaque');

    const z = pickZone();
    const zoneId = z.id;

    if (good) S.goodSpawn++; else S.junkSpawn++;
    S.zone[zoneId].spawn++;

    const domEl = spawnDomTarget(id, kind, emoji, zoneId);
    S.targets.set(id, { id, kind, good, emoji, bornAt, ttlAt, domEl, zoneId });
  }

  function applyResidueRiskOnEvent(t){
    // Bloom 2 causal model (simple, explainable)
    // miss plaque => residue↑, hit germ => risk↑
    if (t.kind === 'plaque'){
      // missed plaque increases residue
      S.residue = Math.min(100, S.residue + 3.5);
    } else {
      // hit germ increases risk
      S.gumRisk = Math.min(100, S.gumRisk + 6.0);
    }
  }

  function reduceResidueOnGood(){
    // cleaning effect
    S.residue = Math.max(0, S.residue - 2.0);
  }
  function reduceRiskOnGoodStreak(){
    if (S.combo >= 5) S.gumRisk = Math.max(0, S.gumRisk - 1.2);
  }

  function hitTarget(id){
    const t = S.targets.get(id);
    if(!t) return;

    if (t.good){
      S.goodHit++;
      S.combo++;
      if (S.combo > S.comboMax) S.comboMax = S.combo;
      S.score += (10 + Math.min(10, S.combo));
      reduceResidueOnGood();
      reduceRiskOnGoodStreak();
      S.zone[t.zoneId].hit++;
      if (MISS) MISS.onGoodHit?.();
    } else {
      S.junkHit++;
      S.miss++;
      S.combo = 0;
      S.score = Math.max(0, S.score - 8);
      applyResidueRiskOnEvent(t);
      S.zone[t.zoneId].miss++;
      if (MISS) MISS.onJunkHit?.();
    }

    try{ t.domEl?.remove(); }catch(e){}
    S.targets.delete(id);
    hud();
  }

  function expireTick(tnow){
    for (const [id, t] of S.targets.entries()){
      if (tnow >= t.ttlAt){
        if (t.good){
          S.goodExpire++;
          S.miss++;
          S.combo = 0;
          S.zone[t.zoneId].miss++;
          applyResidueRiskOnEvent(t);
        }
        try{ t.domEl?.remove(); }catch(e){}
        S.targets.delete(id);
      }
    }
  }

  function heatColor(pct){
    if (pct >= 85) return 'good';
    if (pct >= 60) return 'mid';
    return 'bad';
  }

  function renderHeatmap(){
    if (!UI.heatmap) return;
    UI.heatmap.innerHTML = '';
    for(const z of ZONES){
      const st = S.zone[z.id];
      const cov = st.spawn ? Math.round((st.hit / Math.max(1, st.spawn))*100) : 0;
      const card = D.createElement('div');
      card.className = `hm ${heatColor(cov)}`;
      card.innerHTML = `<div class="t">${z.label} (${z.id})</div><div class="v">${cov}%</div>`;
      UI.heatmap.appendChild(card);
    }
  }

  function topMissZones(){
    const arr = ZONES.map(z=>{
      const st = S.zone[z.id];
      const miss = st.miss;
      const spawn = st.spawn || 1;
      const missRate = miss / spawn;
      return { id:z.id, label:z.label, miss, spawn, missRate };
    }).sort((a,b)=> b.missRate - a.missRate);
    return arr.slice(0,2);
  }

  function renderReasons(){
    const reasons = [
      { id:'fast', label:'ฉันรีบเกินไป' },
      { id:'notsee', label:'ฉันมองไม่ทัน/ไม่เห็น' },
      { id:'confuse', label:'ฉันสับสนโซนฟัน' },
      { id:'risk', label:'ฉันหลบเชื้อไม่ทัน' },
    ];
    if (!UI.reasonChips) return;
    UI.reasonChips.innerHTML = '';
    reasons.forEach(r=>{
      const c = D.createElement('button');
      c.className = `chip ${S.selfReason===r.id ? 'on':''}`;
      c.textContent = r.label;
      c.addEventListener('click', ()=>{
        S.selfReason = r.id;
        renderReasons();
      });
      UI.reasonChips.appendChild(c);
    });
  }

  function endGame(){
    S.ended = true;
    S.started = false;

    const den = (S.goodHit + S.goodExpire);
    const acc = den ? Math.round((S.goodHit / Math.max(1, den)) * 100) : 0;

    const top2 = topMissZones();
    const msgTop = top2.map(t=>`${t.label} (${t.id})`).join(', ');

    if (UI.endSummary){
      UI.endSummary.innerHTML =
        `Score <b>${Math.round(S.score)}</b> • ComboMax <b>${S.comboMax}</b> • Miss <b>${S.miss}</b><br/>`+
        `ACC <b>${acc}%</b> • Residue <b>${Math.round(S.residue)}%</b> • GumRisk <b>${Math.round(S.gumRisk)}%</b><br/>`+
        `พลาดมากสุด: <b>${msgTop}</b>`;
    }

    renderHeatmap();
    renderReasons();
    UI.panelEnd?.classList.remove('hidden');
  }

  function loop(){
    if (S.ended) return;
    S.lastFrameMs = S.lastFrameMs || now();
    const tnow = now();
    const dtMs = Math.min(80, Math.max(0, tnow - S.lastFrameMs));
    S.lastFrameMs = tnow;

    S.timeLeft = Math.max(0, S.timeLeft - dtMs/1000);
    if (S.timeLeft <= 0){
      endGame();
      return;
    }

    if (!S.lastSpawnMs) S.lastSpawnMs = tnow;
    if (tnow - S.lastSpawnMs >= S.spawnEveryMs){
      S.lastSpawnMs = tnow;
      const junkRate = (DIFF==='hard') ? 0.26 : (DIFF==='easy' ? 0.12 : 0.18);
      spawnTarget((Math.random() < junkRate) ? 'germ' : 'plaque');
    }

    expireTick(tnow);
    hud();
    S.raf = requestAnimationFrame(loop);
  }

  // --- Quiz (Bloom 1) ---
  const QUIZ = [
    {
      q:'🟢 (เป้าดี) หมายถึงอะไร?',
      a:['เชื้อ', 'คราบพลัค/เศษอาหาร'],
      correct:1
    },
    {
      q:'🔴 (เป้าอันตราย) หมายถึงอะไร?',
      a:['เชื้อ/กรดทำลายฟัน', 'ความสะอาด'],
      correct:0
    },
    {
      q:'ข้อไหนสำคัญที่สุด?',
      a:['แปรงให้ครบทุกโซน', 'แปรงแค่ด้านนอกก็พอ'],
      correct:0
    }
  ];

  function showQuiz(){
    S.quizIndex = 0; S.quizCorrect = 0;
    renderQuiz();
    UI.panelQuiz?.classList.remove('hidden');
  }

  function renderQuiz(){
    const item = QUIZ[S.quizIndex];
    if (!UI.quizBody || !item) return;
    UI.quizBody.innerHTML = '';

    const q = D.createElement('div');
    q.style.fontWeight = '900';
    q.style.marginBottom = '10px';
    q.textContent = `${S.quizIndex+1}/3 — ${item.q}`;
    UI.quizBody.appendChild(q);

    item.a.forEach((txt, idx)=>{
      const b = D.createElement('button');
      b.className = 'chip';
      b.style.cursor = 'pointer';
      b.textContent = txt;
      b.addEventListener('click', ()=>{
        // mark answer
        const ok = (idx === item.correct);
        if (ok) S.quizCorrect++;
        // visual
        Array.from(UI.quizBody.querySelectorAll('button.chip')).forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        b.dataset.pick = String(idx);
      });
      UI.quizBody.appendChild(b);
    });

    if (UI.btnQuizNext) UI.btnQuizNext.textContent = (S.quizIndex === QUIZ.length-1) ? 'เริ่มเกม' : 'ข้อถัดไป';
  }

  function nextQuizOrStart(startFn){
    const body = UI.quizBody;
    if (body){
      const picked = body.querySelector('button.chip.on');
      if (!picked){
        // require pick
        return;
      }
    }
    if (S.quizIndex < QUIZ.length-1){
      S.quizIndex++;
      renderQuiz();
      return;
    }
    UI.panelQuiz?.classList.add('hidden');
    startFn();
  }

  // --- Start ---
  function startGame(){
    tuneByDiff();

    // reset
    S.started = true; S.ended = false;
    S.sessionId = `brush_${PID}_${Date.now()}`;
    S.startMs = now();
    S.timeLeft = TIME;

    S.score=0; S.combo=0; S.comboMax=0; S.miss=0;
    S.goodSpawn=0; S.junkSpawn=0; S.goodHit=0; S.junkHit=0; S.goodExpire=0;
    S.residue=0; S.gumRisk=0;

    for(const z of ZONES) S.zone[z.id] = {spawn:0, hit:0, miss:0};

    S.targets.clear();
    S.seq=0;
    S.lastSpawnMs=0;
    S.lastFrameMs=0;
    S.selfReason='';

    try{ UI.domTargets && (UI.domTargets.innerHTML = ''); }catch(e){}
    if (UI.domTargets) UI.domTargets.style.pointerEvents = 'auto';

    UI.panelEnd?.classList.add('hidden');
    hud();
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(loop);
  }

  function bindUI(){
    UI.btnHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.remove('hidden'));
    UI.btnCloseHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.add('hidden'));

    UI.btnStart?.addEventListener('click', ()=>{
      // show quiz every start (can later make once/day)
      showQuiz();
    });

    UI.btnQuizNext?.addEventListener('click', ()=> nextQuizOrStart(startGame));

    UI.btnReplay?.addEventListener('click', ()=> showQuiz());
    UI.btnBack?.addEventListener('click', ()=>{ location.href = qs('hub','../hub.html'); });
  }

  bindUI();
  hud();

  const api = { start:startGame };
  W.HHBrush_SAFE = api;
  return api;
}

try{ window.__BRUSH_BOOTGAME__ = bootGame; }catch(e){}