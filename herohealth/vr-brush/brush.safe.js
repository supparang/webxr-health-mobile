// === /herohealth/vr-brush/brush.safe.js ===
// FULL v20260303-BRUSH-SAFE-CAMREL-DEBUG
'use strict';

export function bootGame(){
  const W = window, D = document;

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

  const EMOJI = {
    plaque: ['🦷','✨','🫧','🪥','💎','⭐'],
    germ:   ['🦠','😈','🤢','💀','☣️','🧫']
  };
  function pickEmoji(kind){
    const a = EMOJI[kind] || ['🎯'];
    return a[Math.floor(Math.random() * a.length)];
  }

  // 403-safe
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

  // schema minimal (events only used for debug; keep aligned)
  function studentMeta(){
    return {
      studentKey: qclean('studentKey', qclean('pid', PID)),
      schoolCode: qclean('schoolCode',''),
      classRoom: qclean('classRoom',''),
      studentNo: qclean('studentNo',''),
      nickName: qclean('nickName','')
    };
  }
  function buildEventRow(eventType, payload={}){
    const sm = studentMeta();
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

      targetId: qclean('targetId', payload.targetId || ''),
      emoji: qclean('emoji', payload.emoji || ''),
      itemType: qclean('itemType', payload.itemType || ''),
      lane: qclean('lane', payload.lane || ''),
      rtMs: (payload.rtMs == null ? '' : Number(payload.rtMs)),
      judgment: qclean('judgment', payload.judgment || ''),
      totalScore: Math.round(Number(payload.totalScore ?? S.score ?? 0)),
      combo: Number(payload.combo ?? S.combo ?? 0),
      isGood: (payload.isGood == null ? '' : (payload.isGood ? 1 : 0)),
      feverState: 'off',
      feverValue: 0,
      goalProgress: '',
      miniProgress: '',
      extra: '',
      ...sm
    };
  }
  function logEvent(type, payload){
    if(!LOG_ON) return;
    safePost(API, buildEventRow(type, payload||{}));
  }

  // UI
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

  // optional modules
  let FX = null, MISS = null, AI = null;
  (async ()=>{
    try{ FX = (await import('./brush.fx.js?v=20260303')).bootFx(); }catch(e){}
    try{ MISS = (await import('./brush.missions.js?v=20260303')).bootMissions({ diff: DIFF }); }catch(e){}
    try{ AI = (await import('./ai-brush.js?v=20260303')).bootBrushAI(); }catch(e){}
  })();

  function tuneByDiff(){
    if (DIFF==='easy'){ S.spawnEveryMs=1050; S.ttlMs=1800; }
    else if (DIFF==='hard'){ S.spawnEveryMs=750; S.ttlMs=1350; }
    else { S.spawnEveryMs=900; S.ttlMs=1500; }
  }

  function hud(){
    UI.phasePill && (UI.phasePill.textContent = `PHASE: BRUSH`);
    UI.timePill && (UI.timePill.textContent = `TIME: ${Math.ceil(S.timeLeft)}`);
    UI.scorePill && (UI.scorePill.textContent = `SCORE: ${Math.round(S.score)}`);
    UI.comboPill && (UI.comboPill.textContent = `COMBO: ${S.combo}`);
    UI.missPill && (UI.missPill.textContent = `MISS: ${S.miss}`);

    const den = (S.goodHit + S.goodExpire);
    const acc = den ? Math.round((S.goodHit / Math.max(1, den)) * 100) : 0;
    UI.accPill && (UI.accPill.textContent = `ACC: ${acc}%`);

    UI.toolPill && (UI.toolPill.textContent = `TOOL: BRUSH`);
    UI.viewPill && (UI.viewPill.textContent = `VIEW: ${IS_CVR ? 'cVR' : 'PC/Mobile'}`);
    UI.crosshair && (UI.crosshair.style.display = IS_CVR ? 'block' : 'none');

    if (UI.missionPill && MISS && typeof MISS.text === 'function') {
      UI.missionPill.textContent = `MISSION: ${MISS.text()}`;
    }
  }

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

  function ensureDebugMarker(){
    try{
      const scene = UI.scene || D.querySelector('a-scene');
      if(!scene) return;
      if (D.getElementById('dbgMarker')) return;

      const mk = D.createElement('a-entity');
      mk.setAttribute('id','dbgMarker');
      mk.setAttribute('geometry','primitive: sphere; radius: 0.18');
      mk.setAttribute('material','shader: flat; color: #fde047; opacity: 0.95; transparent:true');
      mk.setAttribute('position','0 1.6 -1.5');
      scene.appendChild(mk);
    }catch(e){}
  }

  function cameraBasis(){
    try{
      if(!W.AFRAME || !W.AFRAME.THREE) return null;
      const THREE = W.AFRAME.THREE;
      const camEl = UI.cam || D.querySelector('#cam') || D.querySelector('[camera]');
      if(!camEl || !camEl.object3D) return null;

      const origin = new THREE.Vector3();
      camEl.object3D.getWorldPosition(origin);

      const q = new THREE.Quaternion();
      camEl.object3D.getWorldQuaternion(q);

      const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(q).normalize();
      const up  = new THREE.Vector3(0,1,0).applyQuaternion(q).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, up).normalize();

      return { origin, fwd, right, up, THREE };
    }catch(e){
      return null;
    }
  }

  function rid(){ return `t${++S.seq}`; }

  function spawnTarget(kind='plaque'){
    if (!S.started || S.ended) return;
    if (!S.cam3) return;

    const scene = UI.scene || D.querySelector('a-scene');
    const root = UI.spawnRoot || D.getElementById('spawnRoot') || scene;
    if (!scene || !root) return;

    ensureDebugMarker();

    const id = rid();
    const bornAt = now();
    const ttlAt = bornAt + S.ttlMs;
    const good = (kind === 'plaque');
    if (good) S.goodSpawn++; else S.junkSpawn++;

    const emoji = pickEmoji(kind);

    // camera-relative position (always in front)
    const basis = cameraBasis();
    let posStr = '0 1.55 -1.8';
    let lane = 'M';
    if (basis){
      const { origin, fwd, right, up, THREE } = basis;
      const dist = 1.6;
      const ox = (Math.random()*0.9 - 0.45);
      const oy = (Math.random()*0.55 - 0.15);
      const p = new THREE.Vector3()
        .copy(origin)
        .add(fwd.clone().multiplyScalar(dist))
        .add(right.clone().multiplyScalar(ox))
        .add(up.clone().multiplyScalar(oy));

      posStr = `${p.x.toFixed(3)} ${p.y.toFixed(3)} ${p.z.toFixed(3)}`;
      lane = (ox < -0.12) ? 'L' : (ox > 0.12 ? 'R' : 'M');
    }

    const el = D.createElement('a-entity');
    el.setAttribute('id', id);
    el.setAttribute('position', posStr);

    const plate = D.createElement('a-entity');
    plate.setAttribute('geometry', 'primitive: plane; width: 0.78; height: 0.78');
    plate.setAttribute('material', good
      ? 'shader: flat; color:#22c55e; opacity:0.42; transparent:true'
      : 'shader: flat; color:#ef4444; opacity:0.42; transparent:true'
    );
    el.appendChild(plate);

    const dot = D.createElement('a-entity');
    dot.setAttribute('geometry', 'primitive: sphere; radius: 0.12');
    dot.setAttribute('material', good
      ? 'shader: flat; color:#86efac; opacity:0.98; transparent:true'
      : 'shader: flat; color:#fecaca; opacity:0.98; transparent:true'
    );
    dot.setAttribute('position', '0 0 0.03');
    el.appendChild(dot);

    const ring = D.createElement('a-entity');
    ring.setAttribute('geometry', 'primitive: ring; radiusInner: 0.30; radiusOuter: 0.40');
    ring.setAttribute('material', good
      ? 'shader: flat; color:#86efac; opacity:0.70; transparent:true; side:double'
      : 'shader: flat; color:#fecaca; opacity:0.70; transparent:true; side:double'
    );
    ring.setAttribute('rotation', '90 0 0');
    ring.setAttribute('position', '0 0 0.02');
    el.appendChild(ring);

    const txt = D.createElement('a-text');
    txt.setAttribute('value', emoji);
    txt.setAttribute('align', 'center');
    txt.setAttribute('color', good ? '#dcfce7' : '#fee2e2');
    txt.setAttribute('width', '3.6');
    txt.setAttribute('position', '0 0 0.08');
    txt.setAttribute('baseline', 'center');
    el.appendChild(txt);

    el.addEventListener('click', ()=> hitTarget(id));

    root.appendChild(el);
    S.targets.set(id, { el, kind, good, bornAt, ttlAt, emoji, lane });

    logEvent('target_spawn', { targetId:id, emoji, itemType:kind, lane, judgment:'spawn', isGood: good?1:0 });
  }

  function hitTarget(id){
    const t = S.targets.get(id);
    if (!t) return;

    if (t.good){
      S.goodHit++;
      S.combo++;
      if (S.combo > S.comboMax) S.comboMax = S.combo;
      S.score += (10 + Math.min(10, S.combo));
      if (MISS) { const r = MISS.onGoodHit(); if (r && r.advanced && FX) FX.toast('✅ Mission!', 'good', 700); }
    } else {
      S.junkHit++;
      S.miss++;
      S.combo = 0;
      S.score = Math.max(0, S.score - 8);
      if (FX) FX.pulse('bad', 120);
      if (MISS) { const r = MISS.onJunkHit(); if (r && r.failed && FX) FX.toast('⚠️ เชื้อเยอะ!', 'warn', 800); }
    }

    try{ t.el && t.el.setAttribute && t.el.setAttribute('visible','false'); }catch(e){}
    try{ t.el?.parentNode?.removeChild(t.el); }catch(e){}
    S.targets.delete(id);

    hud();
    logEvent('target_hit', { targetId:id, emoji:t.emoji||'', itemType:t.kind, lane:t.lane||'', judgment:'hit', totalScore:Math.round(S.score), combo:S.combo, isGood:t.good?1:0 });
  }

  function expireTick(){
    const tnow = now();
    for (const [id, t] of S.targets.entries()){
      if (tnow >= t.ttlAt){
        if (t.good){ S.goodExpire++; S.miss++; S.combo = 0; }
        logEvent('target_expire', { targetId:id, emoji:t.emoji||'', itemType:t.kind, lane:t.lane||'', judgment:'expire', isGood:t.good?1:0 });
        try{ t.el && t.el.setAttribute && t.el.setAttribute('visible','false'); }catch(e){}
        try{ t.el?.parentNode?.removeChild(t.el); }catch(e){}
        S.targets.delete(id);
      }
    }
  }

  function loop(){
    S.raf = requestAnimationFrame(loop);
    if (!S.started || S.ended) return;

    S.timeLeft = Math.max(0, S.timeLeft - (1/60));
    if (S.timeLeft <= 0){ S.ended = true; return; }

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
    S.started = true;
    S.ended = false;
    S.startMs = now();
    S.startTimeIso = isoNow();
    S.timeLeft = TIME;
    S.lastSpawn = 0;

    await waitForSceneAndCamera();
    hud();
    S.raf = requestAnimationFrame(loop);
  }

  function bindUI(){
    D.getElementById('btnHelp')?.addEventListener('click', ()=> D.getElementById('panelHelp')?.classList.remove('hidden'));
    D.getElementById('btnCloseHelp')?.addEventListener('click', ()=> D.getElementById('panelHelp')?.classList.add('hidden'));
    D.getElementById('btnStart')?.addEventListener('click', ()=> start());
  }

  bindUI();
  hud();

  const api = { start, state:()=>({ ...S, targetsSize:S.targets.size }) };
  W.HHBrush_SAFE = api;
  return api;
}