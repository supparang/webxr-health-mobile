// === /herohealth/vr-brush/brush.safe.js ===
// Brush VR SAFE — PRODUCTION (ESM)
// FULL v20260301-BRUSH-SAFE-ESM-FIXTARGET-CAMERA403
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const W = window, D = document;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const qbool = (k, d=false)=>{ const v=String(qs(k, d?'1':'0')).toLowerCase(); return ['1','true','yes','y','on'].includes(v); };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b, Number(v)||0));
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  const RUN = String(qs('run','play')).toLowerCase();
  const DIFF = String(qs('diff','normal')).toLowerCase();
  const TIME = clamp(qs('time','80'), 30, 180);
  const PID  = String(qs('pid','anon'));
  const API  = String(qs('api',''));
  const LOG_ON = qbool('log', false);
  const VIEW = String(qs('view','')).toLowerCase();
  const IS_CVR = (VIEW === 'cvr');

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

  // ---------- UI ----------
  const UI = {
    phasePill: D.getElementById('phasePill'),
    timePill:  D.getElementById('timePill'),
    scorePill: D.getElementById('scorePill'),
    comboPill: D.getElementById('comboPill'),
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
    timeLeft: TIME,

    score:0, combo:0, comboMax:0, miss:0,
    goodSpawn:0, junkSpawn:0, goodHit:0, junkHit:0, goodExpire:0,
    rtGood:[],

    cam3:null,
    targets:new Map(),
    seq:0,

    spawnEveryMs:900,
    ttlMs:1500,
    lockPx:44,

    raf: 0,
    lastSpawn: 0,
  };

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
  }

  // ---------- wait for camera ----------
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

  // ---------- gameplay ----------
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

    const el = D.createElement('a-entity');
    el.setAttribute('id', id);
    el.setAttribute('position', `${x} ${1.35 + y} ${z}`);
    el.setAttribute('geometry', `primitive: sphere; radius: ${good ? 0.10 : 0.09}`);
    el.setAttribute('material', good
      ? 'color: #22c55e; roughness: 0.5; metalness: 0.0'
      : 'color: #ef4444; roughness: 0.7; metalness: 0.0'
    );
    el.setAttribute('data-kind', kind);
    el.setAttribute('data-born', String(bornAt));

    const ring = D.createElement('a-entity');
    ring.setAttribute('geometry', 'primitive: ring; radiusInner: 0.12; radiusOuter: 0.16');
    ring.setAttribute('material', good
      ? 'color: #86efac; opacity: 0.55; side: double'
      : 'color: #fecaca; opacity: 0.55; side: double'
    );
    ring.setAttribute('rotation', '90 0 0');
    el.appendChild(ring);

    el.addEventListener('click', ()=> hitTarget(id));
    root.appendChild(el);

    S.targets.set(id, { el, kind, good, bornAt, ttlAt });

    safePost(API, { table:'events', eventType:'target_spawn', sessionId:S.sessionId, pid:PID, kind, targetId:id, ts:Date.now() });
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
    } else {
      S.junkHit++;
      S.miss++;
      S.combo = 0;
      S.score = Math.max(0, S.score - 8);
    }

    try{ t.el?.parentNode?.removeChild(t.el); }catch(e){}
    S.targets.delete(id);
    hud();

    safePost(API, {
      table:'events',
      eventType:'target_hit',
      sessionId:S.sessionId,
      pid:PID,
      kind:t.kind,
      targetId:id,
      rtMs:rt,
      isGood:!!t.good,
      totalScore:Math.round(S.score),
      combo:S.combo,
      ts:Date.now()
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
        try{ t.el?.parentNode?.removeChild(t.el); }catch(e){}
        S.targets.delete(id);
      }
    }
  }

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

  function resetGame(){
    for (const t of S.targets.values()){
      try{ t.el?.parentNode?.removeChild(t.el); }catch(e){}
    }
    S.targets.clear();

    S.started=false; S.ended=false;
    S.sessionId = `brush_${PID}_${Date.now()}`;
    S.startMs = 0;
    S.timeLeft = TIME;

    S.score=0; S.combo=0; S.comboMax=0; S.miss=0;
    S.goodSpawn=0; S.junkSpawn=0; S.goodHit=0; S.junkHit=0; S.goodExpire=0;
    S.rtGood=[];
    S.lastSpawn = 0;

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

    safePost(API, {
      table:'sessions',
      timestampIso:new Date().toISOString(),
      projectTag:qs('projectTag','HeroHealth'),
      runMode:qs('runMode',RUN),
      studyId:qs('studyId',''),
      phase:qs('phase',''),
      conditionGroup:qs('conditionGroup',''),
      sessionId:S.sessionId,
      gameMode:RUN,
      diff:DIFF,
      durationPlannedSec:TIME,
      durationPlayedSec: TIME - Math.ceil(S.timeLeft),
      scoreFinal:Math.round(S.score),
      comboMax:S.comboMax,
      misses:S.miss,
      accuracyGoodPct:acc,
      avgRtGoodMs:avgRt,
      studentKey:qs('studentKey',PID),
      schoolCode:qs('schoolCode',''),
      classRoom:qs('classRoom',''),
      studentNo:qs('studentNo',''),
      nickName:qs('nickName',''),
      reason,
      ts:Date.now()
    });
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
      const kind = (Math.random() < 0.18) ? 'germ' : 'plaque';
      spawnTarget(kind);
    }

    expireTick();
    hud();
  }

  function bindUI(){
    UI.btnHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.remove('hidden'));
    UI.btnCloseHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.add('hidden'));

    UI.btnStart?.addEventListener('click', async ()=>{
      if (S.started || S.ended) return;
      UI.btnStart.textContent = 'กำลังเริ่ม...';

      await waitForSceneAndCamera();

      S.started = true;
      S.startMs = now();
      S.lastSpawn = 0;
      UI.btnStart.textContent = 'กำลังเล่น...';

      safePost(API, { table:'events', eventType:'session_start', sessionId:S.sessionId, pid:PID, runMode:RUN, diff:DIFF, time:TIME, ts:Date.now() });
      S.raf = requestAnimationFrame(loop);
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

  async function init(){
    tuneByDiff();
    resetGame();
    bindUI();
    hud();
    await waitForSceneAndCamera();

    // expose debug
    W.HHBrush = {
      state: ()=>({ ...S, targetsSize: S.targets.size }),
      spawn: ()=>spawnTarget(Math.random()<0.2?'germ':'plaque'),
      end: ()=>endGame('debug'),
      reset: ()=>resetGame()
    };

    console.log('[Brush] ready', { run: RUN, diff: DIFF, time: TIME, pid: PID, cvr: IS_CVR, log: LOG_ON });
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  return { S, UI, safePost };
}