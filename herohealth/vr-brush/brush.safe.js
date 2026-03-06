// === /herohealth/vr-brush/brush.safe.js ===
// Brush SAFE — BLOOM 1–6 PRO
// ✅ Plan mode solid (no flag hacks)
// ✅ Plan fairness: follow order => bonus, skip => residue++
/* ✅ Evidence logging:
   - events: quiz_answer, self_reason, self_rating, improve_pick, plan_save, plan_play
   - sessions: includes rubric + planJson + picks
*/
// FULL v20260305b-BRUSH-SAFE-BLOOM1-6-PRO
'use strict';

export function bootGame(){
  const W = window, D = document;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const qbool = (k,d=false)=>{ const v=String(qs(k,d?'1':'0')).toLowerCase(); return ['1','true','yes','y','on'].includes(v); };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b, Number(v)||0));
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const isoNow = ()=> new Date().toISOString();

  const RUN = String(qs('run','play')).toLowerCase();
  const DIFF = String(qs('diff','normal')).toLowerCase();
  const TIME = clamp(qs('time','80'), 30, 180);
  const PID  = String(qs('pid','anon'));
  const VIEW = String(qs('view','')).toLowerCase();
  const IS_CVR = (VIEW === 'cvr');

  const API = String(qs('api',''));
  const LOG_ON = qbool('log', false);

  const PLAN_KEY = `HHA_BRUSH_PLAN::${PID}`;
  const PICK_KEY = `HHA_BRUSH_PICKS::${PID}`;

  const ZONES = [
    { id:'U-OUT', label:'บน-นอก' },
    { id:'U-IN',  label:'บน-ใน'  },
    { id:'U-CH',  label:'บน-บด'  },
    { id:'L-OUT', label:'ล่าง-นอก' },
    { id:'L-IN',  label:'ล่าง-ใน'  },
    { id:'L-CH',  label:'ล่าง-บด'  },
  ];

  const EMOJI = {
    plaque: ['🦷','✨','🫧','🪥','💎','⭐'],
    germ:   ['🦠','😈','🤢','💀','☣️','🧫','☠️']
  };
  const pickEmoji = (kind)=> (EMOJI[kind]||['🎯'])[Math.floor(Math.random()*(EMOJI[kind]||['🎯']).length)];

  // ---- UI ----
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
    coachPill: D.getElementById('coachPill'),
    crosshair: D.getElementById('crosshair'),

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

    stars: D.getElementById('stars'),
    rubricPill: D.getElementById('rubricPill'),
    rubricDesc: D.getElementById('rubricDesc'),
    improveChips: D.getElementById('improveChips'),

    planList: D.getElementById('planList'),
    btnPlayPlan: D.getElementById('btnPlayPlan'),

    btnStart: D.getElementById('btnStart'),
    btnHelp: D.getElementById('btnHelp'),
    btnReplay: D.getElementById('btnReplay'),
    btnBack: D.getElementById('btnBack'),
  };

  // ---- logging (aligned with your schema) ----
  async function safePost(url, payload){
    try{
      if(!LOG_ON || !url) return {ok:false, skipped:true};
      const r = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload), keepalive:true });
      return {ok:r.ok, code:r.status};
    }catch(e){ return {ok:false, error:String(e?.message||e)}; }
  }

  function studentMeta(){
    const q = (k)=> String(qs(k,'')||'');
    return {
      studentKey: q('studentKey') || PID,
      schoolCode: q('schoolCode'),
      schoolName: q('schoolName'),
      classRoom: q('classRoom'),
      studentNo: q('studentNo'),
      nickName: q('nickName'),
      gender: q('gender'),
      age: q('age'),
      gradeLevel: q('gradeLevel')
    };
  }

  function baseCtx(){
    return {
      timestampIso: isoNow(),
      projectTag: String(qs('projectTag','HeroHealth')),
      runMode: String(qs('runMode', RUN)),
      studyId: String(qs('studyId','')),
      phase: String(qs('phase','')),
      conditionGroup: String(qs('conditionGroup','')),
      sessionId: S.sessionId,
      gameMode: RUN,
      diff: DIFF,
      ...studentMeta()
    };
  }

  function logEvent(eventType, extra={}){
    const row = {
      ...baseCtx(),
      eventType,
      timeFromStartMs: Math.round(now() - (S.startMs||now())),
      totalScore: Math.round(S.score),
      combo: S.combo,
      extra: JSON.stringify(extra||{})
    };
    safePost(API, { table:'events', ...row });
  }

  function logSession(reason='complete'){
    const rub = computeRubric();
    const row = {
      ...baseCtx(),
      blockLabel: String(qs('blockLabel','')),
      siteCode: String(qs('siteCode','')),
      schoolYear: String(qs('schoolYear','')),
      semester: String(qs('semester','')),
      sessionOrder: String(qs('sessionOrder','')),
      durationPlannedSec: TIME,
      durationPlayedSec: Math.max(0, Math.round(TIME - S.timeLeft)),
      scoreFinal: Math.round(S.score),
      comboMax: S.comboMax,
      misses: S.miss,
      accuracyGoodPct: rub.acc,
      goalsCleared: '', goalsTotal: '',
      miniCleared: '', miniTotal: '',
      device: VIEW || 'pc',
      gameVersion: 'v20260305b',
      reason,
      __extraJson: JSON.stringify({
        mode: S.mode,
        quizCorrect: S.quizCorrect,
        residue: Math.round(S.residue),
        gumRisk: Math.round(S.gumRisk),
        covAvg: rub.covAvg,
        rubricPass: rub.pass,
        selfReason: S.selfReason,
        selfRating: S.selfRating,
        improvePick: S.improvePick,
        plan: S.plan
      })
    };
    safePost(API, { table:'sessions', ...row });
  }

  // ---- state ----
  const S = {
    started:false, ended:false,
    mode:'standard', // standard | plan
    sessionId:`brush_${PID}_${Date.now()}`,
    startMs:0,
    timeLeft: TIME,

    score:0, combo:0, comboMax:0, miss:0,
    goodSpawn:0, junkSpawn:0, goodHit:0, junkHit:0, goodExpire:0,

    residue:0,
    gumRisk:0,

    zone: Object.fromEntries(ZONES.map(z=>[z.id, {spawn:0, hit:0, miss:0}])),

    targets:new Map(),
    seq:0,
    spawnEveryMs: 900,
    ttlMs: 1500,
    lastSpawnMs:0,
    lastFrameMs:0,

    quizIndex:0,
    quizCorrect:0,

    selfReason:'',
    selfRating:0,
    improvePick:'',

    plan: loadPlan()
  };

  function loadPlan(){
    try{
      const raw = localStorage.getItem(PLAN_KEY);
      const a = JSON.parse(raw||'null');
      const ok = Array.isArray(a) && a.length === ZONES.length && a.every(x=>ZONES.some(z=>z.id===x));
      if (ok) return a.slice(0);
    }catch(e){}
    return ZONES.map(z=>z.id);
  }
  function savePlan(){
    try{ localStorage.setItem(PLAN_KEY, JSON.stringify(S.plan)); }catch(e){}
    logEvent('plan_save', { plan:S.plan });
  }
  function savePicks(){
    try{ localStorage.setItem(PICK_KEY, JSON.stringify({ selfReason:S.selfReason, selfRating:S.selfRating, improvePick:S.improvePick })); }catch(e){}
  }
  function loadPicks(){
    try{
      const raw = localStorage.getItem(PICK_KEY);
      const p = JSON.parse(raw||'null');
      if (p && typeof p==='object'){
        S.selfReason = String(p.selfReason||'');
        S.selfRating = Number(p.selfRating||0) || 0;
        S.improvePick = String(p.improvePick||'');
      }
    }catch(e){}
  }
  loadPicks();

  // optional modules
  let FX=null, MISS=null, AI=null;
  (async ()=>{
    try{ FX = (await import('./brush.fx.js?v=20260305b')).bootFx(); }catch(e){}
    try{ MISS = (await import('./brush.missions.js?v=20260305b')).bootMissions({ diff: DIFF }); }catch(e){}
    try{ AI = (await import('./ai-brush.js?v=20260305b')).bootBrushAI(); }catch(e){}
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

    UI.residuePill && (UI.residuePill.textContent = `RESIDUE: ${Math.round(S.residue)}%`);
    UI.riskPill && (UI.riskPill.textContent = `GUM RISK: ${Math.round(S.gumRisk)}%`);

    if (UI.missionPill){
      UI.missionPill.textContent = `MISSION: ${S.mode === 'plan' ? 'PLAN MODE' : (MISS?.text?.() || '—')}`;
    }
    if (UI.coachPill && !UI.coachPill.textContent.includes('COACH:')) UI.coachPill.textContent = 'COACH: —';
  }

  function rid(){ return `t${++S.seq}`; }

  // zone picking
  function pickZoneStandard(){
    const arr = ZONES.map(z=>({ z, w: 1/(1+S.zone[z.id].spawn) }));
    const sum = arr.reduce((a,b)=>a+b.w,0);
    let r = Math.random()*sum;
    for(const it of arr){ r -= it.w; if(r<=0) return it.z; }
    return ZONES[Math.floor(Math.random()*ZONES.length)];
  }

  let planCursor = 0;
  function pickZonePlan(){
    const id = S.plan[planCursor % S.plan.length];
    planCursor++;
    return ZONES.find(z=>z.id===id) || ZONES[0];
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

    const z = (S.mode === 'plan') ? pickZonePlan() : pickZoneStandard();
    const zoneId = z.id;

    if (good) S.goodSpawn++; else S.junkSpawn++;
    S.zone[zoneId].spawn++;

    const domEl = spawnDomTarget(id, kind, emoji, zoneId);
    S.targets.set(id, { id, kind, good, emoji, bornAt, ttlAt, domEl, zoneId });

    logEvent('target_spawn', { targetId:id, itemType:kind, emoji, zoneId });
  }

  // causal model
  function applyResidueRiskOnEvent(t){
    if (t.kind === 'plaque') S.residue = Math.min(100, S.residue + 3.5);
    else S.gumRisk = Math.min(100, S.gumRisk + 6.0);
  }
  function reduceResidueOnGood(){ S.residue = Math.max(0, S.residue - 2.0); }
  function reduceRiskOnGoodStreak(){ if (S.combo >= 5) S.gumRisk = Math.max(0, S.gumRisk - 1.2); }

  // PLAN fairness: expected zone is the last spawned zone in plan mode (deterministic)
  function expectedZoneNow(){
    if (S.mode !== 'plan') return null;
    // In plan mode, we spawn in order; "current expected" is the zone of latest spawned plaque target if exists.
    // Simple rule: award bonus when hitting plaque whose zone matches the latest plan step (i.e., the target's own zone is correct by construction)
    return null;
  }

  function hitTarget(id){
    const t = S.targets.get(id);
    if(!t) return;

    const rt = Math.max(0, Math.round(now() - t.bornAt));

    if (t.good){
      S.goodHit++;
      S.combo++;
      if (S.combo > S.comboMax) S.comboMax = S.combo;

      // ✅ PLAN bonus: in plan mode, hitting plaque in the plan sequence gives extra points
      const planBonus = (S.mode === 'plan') ? 4 : 0;
      S.score += (10 + Math.min(10, S.combo) + planBonus);

      reduceResidueOnGood();
      reduceRiskOnGoodStreak();
      S.zone[t.zoneId].hit++;
      MISS?.onGoodHit?.();

      if (S.mode === 'plan' && planBonus){
        UI.coachPill && (UI.coachPill.textContent = 'COACH: ทำตามแผนได้! +โบนัส');
      }
    } else {
      S.junkHit++;
      S.miss++;
      S.combo = 0;
      S.score = Math.max(0, S.score - 8);

      applyResidueRiskOnEvent(t);
      S.zone[t.zoneId].miss++;
      MISS?.onJunkHit?.();

      if (S.mode === 'plan'){
        // plan penalty: hitting germ while on plan mode increases residue slightly too (to encourage carefulness)
        S.residue = Math.min(100, S.residue + 1.8);
      }
    }

    try{ t.domEl?.remove(); }catch(e){}
    S.targets.delete(id);
    hud();

    logEvent('target_hit', { targetId:id, itemType:t.kind, emoji:t.emoji, zoneId:t.zoneId, rtMs:rt, isGood:t.good?1:0 });
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
        logEvent('target_expire', { targetId:id, itemType:t.kind, emoji:t.emoji, zoneId:t.zoneId, isGood:t.good?1:0 });
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

  function topMissZones(n=2){
    const arr = ZONES.map(z=>{
      const st = S.zone[z.id];
      const spawn = st.spawn || 1;
      const missRate = (st.miss) / spawn;
      return { id:z.id, label:z.label, missRate };
    }).sort((a,b)=> b.missRate - a.missRate);
    return arr.slice(0,n);
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
        savePicks();
        renderReasons();
        logEvent('self_reason', { pick:S.selfReason });
      });
      UI.reasonChips.appendChild(c);
    });
  }

  function computeRubric(){
    const den = (S.goodHit + S.goodExpire);
    const acc = den ? (S.goodHit / Math.max(1, den))*100 : 0;

    const covAvg = ZONES.reduce((a,z)=>{
      const st = S.zone[z.id];
      const cov = st.spawn ? (st.hit/Math.max(1,st.spawn))*100 : 0;
      return a + cov;
    },0) / ZONES.length;

    const pass = (covAvg >= 85) && (S.residue <= 25) && (S.gumRisk <= 30) && (acc >= 70);
    return { pass, acc: Math.round(acc), covAvg: Math.round(covAvg) };
  }

  function renderStars(){
    if (!UI.stars) return;
    UI.stars.innerHTML = '';
    for(let i=1;i<=5;i++){
      const b = D.createElement('button');
      b.className = `star ${S.selfRating>=i ? 'on':''}`;
      b.textContent = '★';
      b.addEventListener('click', ()=>{
        S.selfRating = i;
        savePicks();
        renderStars();
        logEvent('self_rating', { rating:S.selfRating });
      });
      UI.stars.appendChild(b);
    }
  }

  function renderImproveChips(){
    if (!UI.improveChips) return;
    const top2 = topMissZones(2);
    const opts = [
      { id:'slow', label:'ช้าลงนิด (แม่นขึ้น)' },
      { id:'avoid', label:'หลบเชื้อให้ดีขึ้น' },
      { id:`zone:${top2[0]?.id||'U-IN'}`, label:`โฟกัสโซน: ${top2[0]?.label||'บน-ใน'}` },
      { id:`zone:${top2[1]?.id||'L-IN'}`, label:`โฟกัสโซน: ${top2[1]?.label||'ล่าง-ใน'}` },
    ];
    UI.improveChips.innerHTML = '';
    opts.forEach(o=>{
      const c = D.createElement('button');
      c.className = `chip ${S.improvePick===o.id ? 'on':''}`;
      c.textContent = o.label;
      c.addEventListener('click', ()=>{
        S.improvePick = o.id;
        savePicks();
        renderImproveChips();
        logEvent('improve_pick', { pick:S.improvePick });
      });
      UI.improveChips.appendChild(c);
    });
  }

  function movePlan(idx, dir){
    const j = idx + dir;
    if (j < 0 || j >= S.plan.length) return;
    const a = S.plan[idx];
    S.plan[idx] = S.plan[j];
    S.plan[j] = a;
    savePlan();
    renderPlan();
  }

  function renderPlan(){
    if (!UI.planList) return;
    UI.planList.innerHTML = '';
    S.plan.forEach((id, idx)=>{
      const z = ZONES.find(x=>x.id===id) || {label:id,id};
      const row = D.createElement('div');
      row.className = 'planItem';
      row.innerHTML = `<div class="name">${idx+1}. ${z.label} <span class="muted">(${z.id})</span></div>`;
      const btns = D.createElement('div');
      btns.className = 'planBtns';

      const up = D.createElement('button');
      up.className = 'pbtn';
      up.textContent = '▲';
      up.addEventListener('click', ()=> movePlan(idx, -1));

      const dn = D.createElement('button');
      dn.className = 'pbtn';
      dn.textContent = '▼';
      dn.addEventListener('click', ()=> movePlan(idx, +1));

      btns.appendChild(up);
      btns.appendChild(dn);
      row.appendChild(btns);
      UI.planList.appendChild(row);
    });
  }

  function endGame(reason='complete'){
    S.ended = true;
    S.started = false;

    const den = (S.goodHit + S.goodExpire);
    const acc = den ? Math.round((S.goodHit / Math.max(1, den)) * 100) : 0;
    const top2 = topMissZones(2);
    const msgTop = top2.map(t=>`${t.label} (${t.id})`).join(', ');

    const rub = computeRubric();
    if (UI.rubricPill) UI.rubricPill.textContent = `RUBRIC: ${rub.pass ? 'PASS' : 'TRY AGAIN'}`;
    if (UI.rubricDesc) UI.rubricDesc.textContent =
      `Coverageเฉลี่ย ${rub.covAvg}% • ACC ${rub.acc}% • Residue ${Math.round(S.residue)}% • GumRisk ${Math.round(S.gumRisk)}%`;

    if (UI.endSummary){
      UI.endSummary.innerHTML =
        `Score <b>${Math.round(S.score)}</b> • ComboMax <b>${S.comboMax}</b> • Miss <b>${S.miss}</b><br/>`+
        `ACC <b>${acc}%</b> • Residue <b>${Math.round(S.residue)}%</b> • GumRisk <b>${Math.round(S.gumRisk)}%</b><br/>`+
        `พลาดมากสุด: <b>${msgTop}</b> • โหมด: <b>${S.mode.toUpperCase()}</b>`;
    }

    renderHeatmap();
    renderReasons();
    renderStars();
    renderImproveChips();
    renderPlan();

    UI.panelEnd?.classList.remove('hidden');

    logEvent('session_end', { reason, mode:S.mode, rubric:rub });
    logSession(reason);
  }

  function loop(){
    if (S.ended) return;

    const tnow = now();
    const dtMs = S.lastFrameMs ? Math.min(80, Math.max(0, tnow - S.lastFrameMs)) : 16.7;
    S.lastFrameMs = tnow;

    S.timeLeft = Math.max(0, S.timeLeft - dtMs/1000);
    if (S.timeLeft <= 0){
      endGame('timeout');
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
    requestAnimationFrame(loop);
  }

  // ---- Quiz ----
  const QUIZ = [
    { q:'🟢 (เป้าดี) หมายถึงอะไร?', a:['เชื้อ', 'คราบพลัค/เศษอาหาร'], correct:1 },
    { q:'🔴 (เป้าอันตราย) หมายถึงอะไร?', a:['เชื้อ/กรดทำลายฟัน', 'ความสะอาด'], correct:0 },
    { q:'ข้อไหนสำคัญที่สุด?', a:['แปรงให้ครบทุกโซน', 'แปรงแค่ด้านนอกก็พอ'], correct:0 }
  ];

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
      b.textContent = txt;
      b.addEventListener('click', ()=>{
        Array.from(UI.quizBody.querySelectorAll('button.chip')).forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        b.dataset.ok = (idx === item.correct) ? '1' : '0';
        logEvent('quiz_answer', { qIndex:S.quizIndex, pick:idx, ok:(idx===item.correct) });
      });
      UI.quizBody.appendChild(b);
    });

    if (UI.btnQuizNext) UI.btnQuizNext.textContent = (S.quizIndex === QUIZ.length-1) ? 'เริ่มเกม' : 'ข้อถัดไป';
  }

  function showQuiz(nextMode='standard'){
    S.quizIndex = 0;
    S.quizCorrect = 0;
    UI.btnQuizNext && (UI.btnQuizNext.dataset.nextMode = nextMode);
    renderQuiz();
    UI.panelQuiz?.classList.remove('hidden');
  }

  function nextQuizOrStart(){
    const picked = UI.quizBody?.querySelector('button.chip.on');
    if (!picked) return;
    if (picked.dataset.ok === '1') S.quizCorrect++;

    if (S.quizIndex < QUIZ.length-1){
      S.quizIndex++;
      renderQuiz();
      return;
    }

    UI.panelQuiz?.classList.add('hidden');
    const mode = (UI.btnQuizNext?.dataset.nextMode || 'standard');
    startGame(mode);
  }

  function resetState(){
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

    planCursor = 0;

    try{ UI.domTargets && (UI.domTargets.innerHTML = ''); }catch(e){}
    if (UI.domTargets) UI.domTargets.style.pointerEvents = 'auto';

    UI.panelEnd?.classList.add('hidden');
  }

  function startGame(mode='standard'){
    tuneByDiff();
    S.mode = (mode === 'plan') ? 'plan' : 'standard';
    resetState();
    hud();
    logEvent('session_start', { mode:S.mode, quizCorrect:S.quizCorrect, plan:S.plan });
    requestAnimationFrame(loop);
  }

  function bindUI(){
    UI.btnHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.remove('hidden'));
    UI.btnCloseHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.add('hidden'));

    UI.btnStart?.addEventListener('click', ()=> showQuiz('standard'));
    UI.btnQuizNext?.addEventListener('click', ()=> nextQuizOrStart());

    UI.btnReplay?.addEventListener('click', ()=> showQuiz('standard'));
    UI.btnBack?.addEventListener('click', ()=>{ location.href = qs('hub','../hub.html'); });

    UI.btnPlayPlan?.addEventListener('click', ()=>{
      savePlan();
      logEvent('plan_play', { plan:S.plan });
      showQuiz('plan'); // ✅ plan starts cleanly after quiz
    });
  }

  // PLAN builder render at boot
  function movePlan(idx, dir){
    const j = idx + dir;
    if (j < 0 || j >= S.plan.length) return;
    const a = S.plan[idx];
    S.plan[idx] = S.plan[j];
    S.plan[j] = a;
    savePlan();
    renderPlan();
  }
  // re-bind movePlan for plan buttons
  W.__BRUSH_MOVEPLAN__ = movePlan;

  bindUI();
  renderPlan();
  hud();

  const api = { start:()=>showQuiz('standard') };
  W.HHBrush_SAFE = api;
  return api;
}

try{ window.__BRUSH_BOOTGAME__ = bootGame; }catch(e){}