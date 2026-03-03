// === /herohealth/vr-brush/brush.safe.js ===
// Brush VR SAFE — PRODUCTION (ESM) — BOOT compatible
// FULL v20260302-BRUSH-SAFE-ALLINONE-EMOJI
'use strict';

export function bootGame(){
  const W = window, D = document;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const qbool = (k, d=false)=>{ const v=String(qs(k, d?'1':'0')).toLowerCase(); return ['1','true','yes','y','on'].includes(v); };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b, Number(v)||0));
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const isoNow = ()=> new Date().toISOString();
  const qclean = (k, d='')=>{ const s = String(qs(k,d)||'').trim(); return s.length>220 ? s.slice(0,220) : s; };

  const RUN = String(qs('run','play')).toLowerCase();
  const DIFF = String(qs('diff','normal')).toLowerCase();
  const TIME = clamp(qs('time','80'), 30, 180);
  const PID  = String(qs('pid','anon'));
  const API  = String(qs('api',''));
  const LOG_ON = qbool('log', false);
  const VIEW = String(qs('view','')).toLowerCase();
  const IS_CVR = (VIEW === 'cvr');

  // ----- Emoji target pools -----
  const EMOJI = {
    plaque: ['🦷','✨','🫧','🪥','💎','⭐'],
    germ:   ['🦠','😈','🤢','💀','☣️','🧫']
  };
  function pickEmoji(kind){
    const a = EMOJI[kind] || ['🎯'];
    return a[Math.floor(Math.random() * a.length)];
  }
  function laneFromX(x){
    if (x < -0.12) return 'L';
    if (x >  0.12) return 'R';
    return 'M';
  }

  // ---------- 403-safe disable latch ----------
  const DIS_KEY = 'HHA_API_DISABLED';
  const DIS_TTL = 15*60*1000;
  function remoteDisabled(){
    try{
      const raw = sessionStorage.getItem(DIS_KEY);
      if(!raw) return false;
      const d = JSON.parse(raw);
      if(!d || !d.ts) return false;
      if(Date.now()-d.ts > DIS_TTL){ sessionStorage.removeItem(DIS_KEY); return false; }
      return true;
    }catch(e){ return false; }
  }
  function remoteDisable(code, reason){
    try{ sessionStorage.setItem(DIS_KEY, JSON.stringify({code:Number(code)||403, reason:String(reason||''), ts:Date.now()})); }catch(e){}
  }
  async function safePost(url, payload){
    try{
      if(!LOG_ON) return {ok:false, skipped:true};
      if(!url) return {ok:false, skipped:true};
      if(remoteDisabled()) return {ok:false, disabled:true};
      const r = await fetch(url, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify(payload),
        keepalive:true
      });
      if(r.status === 401 || r.status === 403){
        remoteDisable(r.status, 'forbidden');
        return {ok:false, disabled:true, code:r.status};
      }
      return {ok:r.ok, code:r.status};
    }catch(e){
      return {ok:false, error:String(e?.message||e)};
    }
  }

  // ---------- schema helpers ----------
  function studentMeta(){
    return {
      studentKey: qclean('studentKey', qclean('pid', PID)),
      schoolCode: qclean('schoolCode',''),
      classRoom: qclean('classRoom',''),
      studentNo: qclean('studentNo',''),
      nickName: qclean('nickName','')
    };
  }

  // EVENT schema (exact set user provided)
  function buildEventRow(eventType, payload={}){
    const sm = studentMeta();
    const extraObj = Object.assign({}, payload.extra||{}, payload||{});
    ['targetId','emoji','itemType','lane','rtMs','judgment','totalScore','combo','isGood','feverState','feverValue','goalProgress','miniProgress','extra']
      .forEach(k=>{ if(k in extraObj) delete extraObj[k]; });

    let extra = '';
    try{ extra = JSON.stringify(extraObj); if(extra.length>1800) extra = extra.slice(0,1800); }catch(e){ extra=''; }

    return {
      timestampIso: isoNow(),
      projectTag: qclean('projectTag', qclean('project','HeroHealth')),
      runMode: qclean('runMode', qclean('run', RUN)),
      studyId: qclean('studyId',''),
      phase: qclean('phase',''),
      conditionGroup: qclean('conditionGroup',''),
      sessionId: S.sessionId,

      eventType: String(eventType||''),
      gameMode: qclean('gameMode', RUN),
      diff: qclean('diff', DIFF),
      timeFromStartMs: Math.round(now() - (S.startMs || now())),

      targetId: qclean('targetId', payload.targetId || payload.id || ''),
      emoji: qclean('emoji', payload.emoji || ''),
      itemType: qclean('itemType', payload.itemType || payload.kind || ''),
      lane: qclean('lane', payload.lane ?? ''),

      rtMs: (payload.rtMs == null ? '' : Number(payload.rtMs)),
      judgment: qclean('judgment', payload.judgment || ''),
      totalScore: Math.round(Number(payload.totalScore ?? S.score ?? 0)),
      combo: Number(payload.combo ?? S.combo ?? 0),
      isGood: (payload.isGood == null ? '' : (payload.isGood ? 1 : 0)),

      feverState: qclean('feverState', payload.feverState || 'off'),
      feverValue: Number(payload.feverValue ?? 0),

      goalProgress: payload.goalProgress ?? '',
      miniProgress: payload.miniProgress ?? '',
      extra,

      ...sm
    };
  }

  function logEvent(eventType, payload={}){
    if(!LOG_ON) return;
    safePost(API, buildEventRow(eventType, payload));
  }

  // SESSION schema (minimal + extras)
  function avg(arr){ if(!arr || !arr.length) return ''; const s=arr.reduce((a,b)=>a+Number(b||0),0); return Math.round((s/arr.length)*10)/10; }
  function median(arr){
    if(!arr || !arr.length) return '';
    const a=arr.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);
    if(!a.length) return '';
    const m=Math.floor(a.length/2);
    return (a.length%2)? a[m] : Math.round(((a[m-1]+a[m])/2)*10)/10;
  }
  function pct(n,d){ n=Number(n)||0; d=Number(d)||0; if(d<=0) return ''; return Math.round((n/d)*1000)/10; }

  function buildSessionRow(reason='complete'){
    const sm = studentMeta();
    const endIso = isoNow();
    const startIso = S.startTimeIso || new Date(Date.now() - Math.round((now()-S.startMs))).toISOString();
    const durPlayed = TIME - Math.ceil(S.timeLeft);

    const accGood = pct(S.goodHit, Math.max(1, (S.goodHit + S.goodExpire)));
    const junkErr = pct(S.junkHit, Math.max(1, (S.junkSpawn || 1)));

    const avgRt = avg(S.rtGood);
    const medRt = median(S.rtGood);

    return {
      timestampIso: endIso,
      projectTag: qclean('projectTag', qclean('project','HeroHealth')),
      runMode: qclean('runMode', qclean('run', RUN)),
      studyId: qclean('studyId',''),
      phase: qclean('phase',''),
      conditionGroup: qclean('conditionGroup',''),

      sessionOrder: qclean('sessionOrder',''),
      blockLabel: qclean('blockLabel',''),
      siteCode: qclean('siteCode',''),
      schoolYear: qclean('schoolYear',''),
      semester: qclean('semester',''),

      sessionId: S.sessionId,
      gameMode: qclean('gameMode', RUN),
      diff: qclean('diff', DIFF),

      durationPlannedSec: TIME,
      durationPlayedSec: durPlayed,

      scoreFinal: Math.round(S.score),
      comboMax: S.comboMax,
      misses: S.miss,

      goalsCleared: (MISS ? (MISS.S?.cleared||0) : ''),
      goalsTotal: (MISS ? (MISS.S?.total||3) : ''),
      miniCleared: '',
      miniTotal: '',

      nTargetGoodSpawned: S.goodSpawn,
      nTargetJunkSpawned: S.junkSpawn,
      nTargetStarSpawned: 0,
      nTargetDiamondSpawned: 0,
      nTargetShieldSpawned: 0,

      nHitGood: S.goodHit,
      nHitJunk: S.junkHit,
      nHitJunkGuard: 0,
      nExpireGood: S.goodExpire,

      accuracyGoodPct: accGood,
      junkErrorPct: junkErr,
      avgRtGoodMs: avgRt,
      medianRtGoodMs: medRt,
      fastHitRatePct: '',

      device: (navigator.userAgent||'').slice(0,120),
      gameVersion: qclean('gameVersion', qclean('v','brush-v20260302')),
      reason: qclean('reason', reason),

      startTimeIso: startIso,
      endTimeIso: endIso,

      ...sm,

      gender: qclean('gender',''),
      age: qclean('age',''),
      gradeLevel: qclean('gradeLevel', qclean('grade','')),
      heightCm: qclean('heightCm',''),
      weightKg: qclean('weightKg',''),
      bmi: qclean('bmi',''),
      bmiGroup: qclean('bmiGroup',''),

      vrExperience: qclean('vrExperience',''),
      gameFrequency: qclean('gameFrequency',''),
      handedness: qclean('handedness',''),
      visionIssue: qclean('visionIssue',''),
      healthDetail: qclean('healthDetail',''),
      consentParent: qclean('consentParent',''),
      consentTeacher: qclean('consentTeacher',''),
      profileSource: qclean('profileSource', qclean('source','query')),
      surveyKey: qclean('surveyKey',''),
      excludeFlag: qclean('excludeFlag',''),
      noteResearcher: qclean('noteResearcher',''),

      rtBreakdownJson: (()=>{ try{ return JSON.stringify({ n:S.rtGood.length, avg:avgRt, med:medRt }); }catch(e){ return ''; } })(),
      __extraJson: (()=>{ try{ return JSON.stringify({ goodHit:S.goodHit, goodSpawn:S.goodSpawn, junkHit:S.junkHit, junkSpawn:S.junkSpawn, miss:S.miss, mission: MISS?.S || null }); }catch(e){ return ''; } })()
    };
  }

  // ---------- UI refs ----------
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
    btnStart:  D.getElementById('btnStart'),
    btnHelp:   D.getElementById('btnHelp'),
    btnCloseHelp: D.getElementById('btnCloseHelp'),
    panelHelp: D.getElementById('panelHelp'),
    panelEnd:  D.getElementById('panelEnd'),
    endSummary: D.getElementById('endSummary'),
    btnReplay: D.getElementById('btnReplay'),
    btnBack:   D.getElementById('btnBack'),
    crosshair: D.getElementById('crosshair'),

    scene: D.getElementById('scene') || D.querySelector('a-scene'),
    cam:   D.getElementById('cam') || D.querySelector('#cam') || D.querySelector('[camera]'),
    spawnRoot: D.getElementById('spawnRoot'),
  };

  // ---------- state ----------
  const S = {
    started:false, ended:false,
    sessionId:`brush_${PID}_${Date.now()}`,
    startMs:0,
    startTimeIso:'',
    timeLeft: TIME,

    score:0, combo:0, comboMax:0, miss:0,
    goodSpawn:0, junkSpawn:0, goodHit:0, junkHit:0, goodExpire:0,
    rtGood:[],

    cam3:null,
    targets:new Map(),
    seq:0,

    spawnEveryMs:900,
    ttlMs:1500,

    raf:0,
    lastSpawn:0,
  };

  // ---------- optional modules ----------
  let FX = null, MISS = null, AI = null;
  (async ()=>{
    try{ FX = (await import('./brush.fx.js?v=20260302')).bootFx(); }catch(e){}
    try{ MISS = (await import('./brush.missions.js?v=20260302')).bootMissions({ diff: DIFF }); }catch(e){}
    try{ AI = (await import('./ai-brush.js?v=20260302')).bootBrushAI(); }catch(e){}
  })();

  function tuneByDiff(){
    if (DIFF==='easy'){ S.spawnEveryMs=1050; S.ttlMs=1800; }
    else if (DIFF==='hard'){ S.spawnEveryMs=750; S.ttlMs=1350; }
    else { S.spawnEveryMs=900; S.ttlMs=1500; }
  }

  function hud(){
    if (UI.phasePill) UI.phasePill.textContent = `PHASE: BRUSH`;
    if (UI.timePill) UI.timePill.textContent = `TIME: ${Math.ceil(S.timeLeft)}`;
    if (UI.scorePill) UI.scorePill.textContent = `SCORE: ${Math.round(S.score)}`;
    if (UI.comboPill) UI.comboPill.textContent = `COMBO: ${S.combo}`;
    if (UI.missPill) UI.missPill.textContent = `MISS: ${S.miss}`;

    const den = (S.goodHit + S.goodExpire);
    const acc = den ? Math.round((S.goodHit / Math.max(1, den)) * 100) : 0;
    if (UI.accPill) UI.accPill.textContent = `ACC: ${acc}%`;

    if (UI.toolPill) UI.toolPill.textContent = `TOOL: BRUSH`;
    if (UI.viewPill) UI.viewPill.textContent = `VIEW: ${IS_CVR ? 'cVR' : 'PC/Mobile'}`;
    if (UI.crosshair) UI.crosshair.style.display = IS_CVR ? 'block' : 'none';

    if (UI.missionPill && MISS && typeof MISS.text === 'function') {
      UI.missionPill.textContent = `MISSION: ${MISS.text()}`;
    }
  }

  // ---------- camera ready ----------
  function getCam3(){
    try{
      const camEl = UI.cam || D.querySelector('#cam') || D.querySelector('[camera]');
      if (!camEl || !camEl.getObject3D) return null;
      return camEl.getObject3D('camera') || null;
    }catch(e){ return null; }
  }

  function waitForSceneAndCamera(){
    return new Promise((resolve)=>{
      const scene = UI.scene || D.querySelector('a-scene');
      if (!scene) return resolve(false);

      const tryBind = ()=>{
        const cam3 = getCam3();
        if (cam3) { S.cam3 = cam3; return resolve(true); }
        setTimeout(tryBind, 50);
      };

      if (scene.hasLoaded) tryBind();
      else scene.addEventListener('loaded', tryBind, { once:true });
    });
  }

  // ---------- targets (EMOJI) ----------
  function rid(){ return `t${++S.seq}`; }

  function spawnTarget(kind='plaque'){
    if (!S.started || S.ended) return;
    if (!S.cam3) return;

    const scene = UI.scene || D.querySelector('a-scene');
    const root = UI.spawnRoot || D.getElementById('spawnRoot') || scene;
    if (!scene || !root) return;

    const id = rid();
    const bornAt = now();
    const ttlAt = bornAt + S.ttlMs;

    const good = (kind === 'plaque');
    if (good) S.goodSpawn++; else S.junkSpawn++;

    const x = (Math.random() * 0.9 - 0.45);
    const y = (Math.random() * 0.6 - 0.15);
    const z = -3.0 + (Math.random() * 0.35 - 0.15);
    const lane = laneFromX(x);

    const emoji = pickEmoji(kind);

    const el = D.createElement('a-entity');
    el.setAttribute('id', id);
    el.setAttribute('position', `${x} ${1.35 + y} ${z}`);
    el.setAttribute('data-kind', kind);
    el.setAttribute('data-born', String(bornAt));
    el.setAttribute('data-emoji', emoji);
    el.setAttribute('data-lane', lane);

    // bigger hit area
    const plate = D.createElement('a-entity');
    plate.setAttribute('geometry', 'primitive: plane; width: 0.45; height: 0.45');
    plate.setAttribute('material',
      good
        ? 'color:#22c55e; opacity:0.18; transparent:true; shader:standard; roughness:1'
        : 'color:#ef4444; opacity:0.18; transparent:true; shader:standard; roughness:1'
    );
    el.appendChild(plate);

    // emoji text
    const txt = D.createElement('a-text');
    txt.setAttribute('value', emoji);
    txt.setAttribute('align', 'center');
    txt.setAttribute('color', good ? '#bbf7d0' : '#fecaca');
    txt.setAttribute('width', '2.8');
    txt.setAttribute('position', '0 0 0.01');
    txt.setAttribute('baseline', 'center');
    // NOTE: if your A-Frame build doesn't have look-at component, remove next line
    try { txt.setAttribute('look-at', '#cam'); } catch(e) {}
    el.appendChild(txt);

    const ring = D.createElement('a-entity');
    ring.setAttribute('geometry', 'primitive: ring; radiusInner: 0.18; radiusOuter: 0.24');
    ring.setAttribute('material', good
      ? 'color: #86efac; opacity: 0.50; side: double'
      : 'color: #fecaca; opacity: 0.50; side: double'
    );
    ring.setAttribute('rotation', '90 0 0');
    el.appendChild(ring);

    el.addEventListener('click', ()=> hitTarget(id));
    root.appendChild(el);

    S.targets.set(id, { el, kind, good, bornAt, ttlAt, emoji, lane });

    logEvent('target_spawn', {
      targetId: id,
      emoji,
      itemType: kind,
      lane,
      judgment: 'spawn',
      isGood: good ? 1 : 0
    });
  }

  function hitTarget(id){
    if (!S.started || S.ended) return;
    const t = S.targets.get(id);
    if (!t) return;

    const rt = Math.max(0, Math.round(now() - t.bornAt));

    if (t.good){
      S.goodHit++;
      S.combo++;
      if (S.combo > S.comboMax) S.comboMax = S.combo;
      S.score += (10 + Math.min(10, S.combo));
      S.rtGood.push(rt);

      if (MISS) {
        const r = MISS.onGoodHit();
        if (r && r.advanced && FX) { FX.toast('✅ Mission Clear!', 'good', 900); FX.pulse('good', 140); }
      }
      if (S.combo === 8 && AI && AI.enabled) {
        W.dispatchEvent(new CustomEvent('brush:ai', { detail:{ tip:'รักษาคอมโบ! จะได้คะแนนพุ่ง' } }));
      }
    } else {
      S.junkHit++;
      S.miss++;
      S.combo = 0;
      S.score = Math.max(0, S.score - 8);

      if (MISS) {
        const r = MISS.onJunkHit();
        if (r && r.failed && FX) { FX.toast('⚠️ โดนเชื้อเกิน!', 'warn', 900); FX.pulse('warn', 160); }
      }
      if (FX) FX.pulse('bad', 120);
      if (AI && AI.enabled) {
        W.dispatchEvent(new CustomEvent('brush:ai', { detail:{ tip:'เลี่ยงเชื้อสีแดงก่อน!' } }));
      }
    }

    try{ t.el?.parentNode?.removeChild(t.el); }catch(e){}
    S.targets.delete(id);

    hud();

    logEvent('target_hit', {
      targetId: id,
      emoji: t.emoji || '',
      itemType: t.kind,
      lane: t.lane || '',
      rtMs: rt,
      isGood: !!t.good,
      judgment: 'hit',
      totalScore: Math.round(S.score),
      combo: S.combo
    });
  }

  function expireTick(){
    const tnow = now();
    for (const [id, t] of S.targets.entries()){
      if (tnow >= t.ttlAt){
        if (t.good){
          S.goodExpire++;
          S.miss++;
          S.combo = 0;
        }
        logEvent('target_expire', {
          targetId: id,
          emoji: t.emoji || '',
          itemType: t.kind,
          lane: t.lane || '',
          isGood: t.good ? 1 : 0,
          judgment: 'expire'
        });
        try{ t.el?.parentNode?.removeChild(t.el); }catch(e){}
        S.targets.delete(id);
      }
    }
  }

  // ---------- cVR shoot ----------
  function findHitTargetIdFromRay(){
    try{
      if (!W.AFRAME || !W.AFRAME.THREE) return null;
      const cam3 = getCam3();
      if (!cam3) return null;

      const THREE = W.AFRAME.THREE;
      const origin = new THREE.Vector3();
      const dir = new THREE.Vector3(0,0,-1);

      cam3.getWorldPosition(origin);
      dir.applyQuaternion(cam3.quaternion).normalize();

      const ray = new THREE.Raycaster(origin, dir, 0.1, 8.0);
      const objs = [];
      for (const t of S.targets.values()){
        if (t.el?.object3D) objs.push(t.el.object3D);
      }
      if (!objs.length) return null;

      const hits = ray.intersectObjects(objs, true);
      if (!hits?.length) return null;

      let el = hits[0].object.el || hits[0].object.parent?.el;
      while (el && el.id && !S.targets.has(el.id)) el = el.parentEl;
      return (el && S.targets.has(el.id)) ? el.id : null;
    }catch(e){
      return null;
    }
  }

  function onShoot(){
    if (!IS_CVR || !S.started || S.ended) return;
    const id = findHitTargetIdFromRay();
    if (id) hitTarget(id);
  }

  // ---------- lifecycle ----------
  function resetGame(){
    for (const t of S.targets.values()){
      try{ t.el?.parentNode?.removeChild(t.el); }catch(e){}
    }
    S.targets.clear();

    S.started=false; S.ended=false;
    S.sessionId = `brush_${PID}_${Date.now()}`;
    S.startMs = 0;
    S.startTimeIso = '';
    S.timeLeft = TIME;

    S.score=0; S.combo=0; S.comboMax=0; S.miss=0;
    S.goodSpawn=0; S.junkSpawn=0; S.goodHit=0; S.junkHit=0; S.goodExpire=0;
    S.rtGood=[];
    S.lastSpawn = 0;

    if (MISS && typeof MISS.reset === 'function') MISS.reset();
    hud();
  }

  function endGame(reason='complete'){
    if (S.ended) return;
    S.ended = true;
    S.started = false;

    const den = (S.goodHit + S.goodExpire);
    const acc = den ? Math.round((S.goodHit / Math.max(1, den)) * 100) : 0;
    const avgRt = S.rtGood.length ? Math.round(S.rtGood.reduce((a,b)=>a+b,0)/S.rtGood.length) : 0;

    if (UI.endSummary){
      UI.endSummary.innerHTML =
        `Score <b>${Math.round(S.score)}</b> • ComboMax <b>${S.comboMax}</b> • Miss <b>${S.miss}</b><br/>`+
        `Accuracy <b>${acc}%</b> • Avg RT <b>${avgRt}ms</b><br/>`+
        `Good hit ${S.goodHit}/${S.goodSpawn} • Junk hit ${S.junkHit}/${S.junkSpawn}`;
    }
    UI.panelEnd?.classList.remove('hidden');

    if (LOG_ON) safePost(API, buildSessionRow(reason));
    logEvent('session_end', { judgment: reason, totalScore: Math.round(S.score), combo: S.comboMax, isGood: 1 });
  }

  function loop(){
    S.raf = requestAnimationFrame(loop);
    if (!S.started || S.ended) return;

    S.timeLeft = Math.max(0, S.timeLeft - (1/60));
    if (S.timeLeft <= 0){
      endGame('timeout');
      return;
    }

    const tnow = now();
    if (tnow - (S.lastSpawn||0) >= S.spawnEveryMs){
      S.lastSpawn = tnow;
      const junkRate = (DIFF==='hard') ? 0.26 : (DIFF==='easy' ? 0.12 : 0.18);
      const kind = (Math.random() < junkRate) ? 'germ' : 'plaque';
      spawnTarget(kind);
    }

    expireTick();
    hud();
  }

  async function start(){
    tuneByDiff();
    resetGame();
    hud();

    await waitForSceneAndCamera();

    if (UI.btnStart) UI.btnStart.textContent = 'กำลังเล่น...';
    S.started = true;
    S.startMs = now();
    S.startTimeIso = isoNow();
    S.lastSpawn = 0;

    logEvent('session_start', { judgment:'start', totalScore:0, combo:0, isGood:1 });
    S.raf = requestAnimationFrame(loop);
  }

  function bindUI(){
    UI.btnHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.remove('hidden'));
    UI.btnCloseHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.add('hidden'));

    UI.btnStart?.addEventListener('click', async ()=>{
      if (S.started || S.ended) return;
      UI.btnStart.textContent = 'กำลังเริ่ม...';
      await start();
    });

    UI.btnReplay?.addEventListener('click', ()=>{
      UI.panelEnd?.classList.add('hidden');
      resetGame();
      if (UI.btnStart) UI.btnStart.textContent = 'เริ่มเล่น';
    });

    UI.btnBack?.addEventListener('click', ()=>{
      const hub = qs('hub','../hub.html');
      location.href = hub;
    });

    W.addEventListener('hha:shoot', ()=>{ onShoot(); }, { passive:true });
    D.addEventListener('pointerdown', ()=>{ if(IS_CVR) onShoot(); }, { passive:true });
  }

  // init
  bindUI();
  hud();

  const api = {
    start,
    state: ()=>({ ...S, targetsSize: S.targets.size }),
    end: ()=>endGame('debug'),
    reset: ()=>resetGame()
  };
  W.HHBrush_SAFE = api;

  return api;
}