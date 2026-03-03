// === /herohealth/vr-brush/brush.safe.js ===
// Brush SAFE — AUTO DOM-FALLBACK when A-Frame/WebGL not rendering
// FULL v20260303-BRUSH-SAFE-DOMFALLBACK
'use strict';

export function bootGame(){
  const W = window, D = document;

  // helpers
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

  // emoji pools
  const EMOJI = {
    plaque: ['🦷','✨','🫧','🪥','💎','⭐'],
    germ:   ['🦠','😈','🤢','💀','☣️','🧫']
  };
  function pickEmoji(kind){
    const a = EMOJI[kind] || ['🎯'];
    return a[Math.floor(Math.random() * a.length)];
  }

  // 403-safe latch
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

  // schema (events minimal)
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

  // UI refs
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
    crosshair: D.getElementById('crosshair'),
    scene: D.getElementById('scene') || D.querySelector('a-scene'),
    cam:   D.getElementById('cam') || D.querySelector('#cam') || D.querySelector('[camera]'),
    spawnRoot: D.getElementById('spawnRoot'),
    domTargets: D.getElementById('domTargets'),
  };

  const S = {
    started:false, ended:false,
    sessionId:`brush_${PID}_${Date.now()}`,
    startMs:0,
    timeLeft: TIME,
    score:0, combo:0, comboMax:0, miss:0,
    goodSpawn:0, junkSpawn:0, goodHit:0, junkHit:0, goodExpire:0,
    rtGood:[],
    targets:new Map(),
    seq:0,
    spawnEveryMs:900,
    ttlMs:1500,
    raf:0,
    lastSpawn:0,
    useDomFallback:false
  };

  // optional modules
  let FX=null, MISS=null, AI=null;
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

  function rid(){ return `t${++S.seq}`; }

  // ✅ detect if canvas exists & has size; otherwise DOM fallback
  async function detectFallback(){
    try{
      const scene = UI.scene;
      if(!scene) return true;

      // wait a bit after loaded
      await new Promise(r=>setTimeout(r, 250));

      const canvas = scene.canvas || scene.querySelector('canvas');
      if(!canvas) return true;

      const rect = canvas.getBoundingClientRect();
      if(rect.width < 10 || rect.height < 10) return true;

      return false;
    }catch(e){
      return true;
    }
  }

  // DOM target create
  function spawnDomTarget(id, kind, emoji){
    const layer = UI.domTargets;
    if(!layer) return;

    const good = (kind === 'plaque');
    const el = D.createElement('div');
    el.className = `domTarget ${good ? 'good' : 'bad'}`;
    el.textContent = emoji;

    // random position safe margins
    const w = window.innerWidth || 360;
    const h = window.innerHeight || 640;
    const x = Math.round(w*0.18 + Math.random()*w*0.64);
    const y = Math.round(h*0.22 + Math.random()*h*0.56);

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    el.addEventListener('click', (e)=>{
      e.preventDefault();
      hitTarget(id);
    }, { passive:false });

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

    if (good) S.goodSpawn++; else S.junkSpawn++;

    // choose render path
    let domEl = null;
    if (S.useDomFallback){
      domEl = spawnDomTarget(id, kind, emoji);
    } else {
      // still try 3D spawn (if canvas is okay)
      try{
        const scene = UI.scene || D.querySelector('a-scene');
        const root = UI.spawnRoot || scene;
        if (scene && root){
          const a = D.createElement('a-entity');
          a.setAttribute('id', id);
          a.setAttribute('position', `0 1.55 -1.8`); // safe center
          const plate = D.createElement('a-entity');
          plate.setAttribute('geometry', 'primitive: plane; width: 0.78; height: 0.78');
          plate.setAttribute('material',
            good
              ? 'shader: flat; color:#22c55e; opacity:0.42; transparent:true'
              : 'shader: flat; color:#ef4444; opacity:0.42; transparent:true'
          );
          a.appendChild(plate);

          const dot = D.createElement('a-entity');
          dot.setAttribute('geometry', 'primitive: sphere; radius: 0.12');
          dot.setAttribute('material',
            good
              ? 'shader: flat; color:#86efac; opacity:0.98; transparent:true'
              : 'shader: flat; color:#fecaca; opacity:0.98; transparent:true'
          );
          dot.setAttribute('position', '0 0 0.03');
          a.appendChild(dot);

          const txt = D.createElement('a-text');
          txt.setAttribute('value', emoji);
          txt.setAttribute('align', 'center');
          txt.setAttribute('color', good ? '#dcfce7' : '#fee2e2');
          txt.setAttribute('width', '3.6');
          txt.setAttribute('position', '0 0 0.08');
          txt.setAttribute('baseline', 'center');
          a.appendChild(txt);

          a.addEventListener('click', ()=> hitTarget(id));
          root.appendChild(a);
          domEl = null;
        }
      }catch(e){
        // if 3D fails mid-game, switch to DOM fallback
        S.useDomFallback = true;
        domEl = spawnDomTarget(id, kind, emoji);
      }
    }

    S.targets.set(id, { id, kind, good, emoji, bornAt, ttlAt, domEl });

    logEvent('target_spawn', { targetId:id, emoji, itemType:kind, judgment:'spawn', isGood: good?1:0 });
  }

  function hitTarget(id){
    const t = S.targets.get(id);
    if(!t) return;

    const rt = Math.max(0, Math.round(now() - t.bornAt));

    if (t.good){
      S.goodHit++;
      S.combo++;
      if (S.combo > S.comboMax) S.comboMax = S.combo;
      S.score += (10 + Math.min(10, S.combo));
      S.rtGood.push(rt);
      if (MISS){ const r = MISS.onGoodHit(); if (r && r.advanced && FX) FX.toast('✅ Mission!', 'good', 700); }
    } else {
      S.junkHit++;
      S.miss++;
      S.combo = 0;
      S.score = Math.max(0, S.score - 8);
      if (FX) FX.pulse('bad', 120);
      if (MISS){ const r = MISS.onJunkHit(); if (r && r.failed && FX) FX.toast('⚠️ เชื้อเยอะ!', 'warn', 800); }
    }

    // remove visual (DOM or 3D)
    try{ t.domEl?.remove(); }catch(e){}
    try{
      const el3d = D.getElementById(id);
      if (el3d && el3d.parentNode) el3d.parentNode.removeChild(el3d);
    }catch(e){}

    S.targets.delete(id);

    hud();
    logEvent('target_hit', { targetId:id, emoji:t.emoji||'', itemType:t.kind, rtMs:rt, judgment:'hit', totalScore:Math.round(S.score), combo:S.combo, isGood:t.good?1:0 });
  }

  function expireTick(){
    const tnow = now();
    for (const [id, t] of S.targets.entries()){
      if (tnow >= t.ttlAt){
        if (t.good){ S.goodExpire++; S.miss++; S.combo = 0; }
        try{ t.domEl?.remove(); }catch(e){}
        try{
          const el3d = D.getElementById(id);
          if (el3d && el3d.parentNode) el3d.parentNode.removeChild(el3d);
        }catch(e){}
        S.targets.delete(id);
        logEvent('target_expire', { targetId:id, emoji:t.emoji||'', itemType:t.kind, judgment:'expire', isGood:t.good?1:0 });
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

    // reset state
    S.started = true; S.ended = false;
    S.sessionId = `brush_${PID}_${Date.now()}`;
    S.startMs = now();
    S.timeLeft = TIME;
    S.score=0; S.combo=0; S.comboMax=0; S.miss=0;
    S.goodSpawn=0; S.junkSpawn=0; S.goodHit=0; S.junkHit=0; S.goodExpire=0;
    S.rtGood=[];
    S.targets.clear();
    S.lastSpawn = 0;

    // clear dom layer
    try{ UI.domTargets && (UI.domTargets.innerHTML = ''); }catch(e){}

    // decide fallback
    const forceDom = qbool('dom', false);
    const needDom = forceDom || await detectFallback();
    S.useDomFallback = !!needDom;

    // if using dom fallback, make layer clickable
    if (UI.domTargets){
      UI.domTargets.style.pointerEvents = S.useDomFallback ? 'auto' : 'none';
    }

    hud();
    S.raf = requestAnimationFrame(loop);
  }

  function bindUI(){
    D.getElementById('btnHelp')?.addEventListener('click', ()=> D.getElementById('panelHelp')?.classList.remove('hidden'));
    D.getElementById('btnCloseHelp')?.addEventListener('click', ()=> D.getElementById('panelHelp')?.classList.add('hidden'));
    D.getElementById('btnStart')?.addEventListener('click', ()=> start());
    D.getElementById('btnReplay')?.addEventListener('click', ()=>{
      D.getElementById('panelEnd')?.classList.add('hidden');
      start();
    });
    D.getElementById('btnBack')?.addEventListener('click', ()=>{
      const hub = qs('hub','../hub.html');
      location.href = hub;
    });
  }

  bindUI();
  hud();

  const api = { start, state:()=>({ ...S, targetsSize:S.targets.size, domFallback:S.useDomFallback }) };
  W.HHBrush_SAFE = api;
  return api;
}