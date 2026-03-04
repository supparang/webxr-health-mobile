// === /herohealth/vr-brush/brush.safe.js ===
// Brush SAFE — DOM targets + DT-based timer (fix TIME=0)
// FULL v20260303e-BRUSH-SAFE-TIMERFIX
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

  const EMOJI = {
    plaque: ['🦷','✨','🫧','🪥','💎','⭐'],
    germ:   ['🦠','😈','🤢','💀','☣️','🧫']
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
    crosshair: D.getElementById('crosshair'),
    domTargets: D.getElementById('domTargets'),
  };

  const S = {
    started:false, ended:false,
    sessionId:`brush_${PID}_${Date.now()}`,
    startMs:0,
    timeLeft: TIME,
    score:0, combo:0, comboMax:0, miss:0,
    goodSpawn:0, junkSpawn:0, goodHit:0, junkHit:0, goodExpire:0,
    targets:new Map(),
    seq:0,
    spawnEveryMs:900,
    ttlMs:1500,
    raf:0,
    lastSpawnMs:0,
    lastFrameMs:0
  };

  let FX=null, MISS=null, AI=null;
  (async ()=>{
    try{ FX = (await import('./brush.fx.js?v=20260303e')).bootFx(); }catch(e){}
    try{ MISS = (await import('./brush.missions.js?v=20260303e')).bootMissions({ diff: DIFF }); }catch(e){}
    try{ AI = (await import('./ai-brush.js?v=20260303e')).bootBrushAI(); }catch(e){}
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

    if (UI.missionPill && MISS && typeof MISS.text === 'function') {
      UI.missionPill.textContent = `MISSION: ${MISS.text()}`;
    }
  }

  function rid(){ return `t${++S.seq}`; }

  function spawnDomTarget(id, kind, emoji){
    const layer = UI.domTargets;
    if(!layer) return null;
    const good = (kind === 'plaque');

    const el = D.createElement('div');
    el.className = `domTarget ${good ? 'good' : 'bad'}`;
    el.textContent = emoji;

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

    if (good) S.goodSpawn++; else S.junkSpawn++;

    const domEl = spawnDomTarget(id, kind, emoji);
    S.targets.set(id, { id, kind, good, emoji, bornAt, ttlAt, domEl });
  }

  function hitTarget(id){
    const t = S.targets.get(id);
    if(!t) return;

    if (t.good){
      S.goodHit++;
      S.combo++;
      if (S.combo > S.comboMax) S.comboMax = S.combo;
      S.score += (10 + Math.min(10, S.combo));
      if (MISS){ const r = MISS.onGoodHit(); if (r && r.advanced && FX) FX.toast('✅ Mission!', 'good', 700); }
    } else {
      S.junkHit++;
      S.miss++;
      S.combo = 0;
      S.score = Math.max(0, S.score - 8);
      if (FX) FX.pulse('bad', 120);
      if (MISS){ const r = MISS.onJunkHit(); if (r && r.failed && FX) FX.toast('⚠️ เชื้อเยอะ!', 'warn', 800); }
    }

    try{ t.domEl?.remove(); }catch(e){}
    S.targets.delete(id);
    hud();
  }

  function expireTick(tnow){
    for (const [id, t] of S.targets.entries()){
      if (tnow >= t.ttlAt){
        if (t.good){ S.goodExpire++; S.miss++; S.combo = 0; }
        try{ t.domEl?.remove(); }catch(e){}
        S.targets.delete(id);
      }
    }
  }

  function loop(){
    S.raf = requestAnimationFrame(loop);
    if (!S.started || S.ended) return;

    const tnow = now();
    const dtMs = S.lastFrameMs ? Math.min(80, Math.max(0, tnow - S.lastFrameMs)) : 16.7;
    S.lastFrameMs = tnow;

    // ✅ DT-based timer
    S.timeLeft = Math.max(0, S.timeLeft - (dtMs / 1000));

    if (S.timeLeft <= 0){
      S.ended = true;
      hud();
      return;
    }

    // spawn by ms
    if (!S.lastSpawnMs) S.lastSpawnMs = tnow;
    if (tnow - S.lastSpawnMs >= S.spawnEveryMs){
      S.lastSpawnMs = tnow;
      const junkRate = (DIFF==='hard') ? 0.26 : (DIFF==='easy' ? 0.12 : 0.18);
      spawnTarget((Math.random() < junkRate) ? 'germ' : 'plaque');
    }

    expireTick(tnow);
    hud();
  }

  async function start(){
    tuneByDiff();

    // reset
    S.started = true; S.ended = false;
    S.sessionId = `brush_${PID}_${Date.now()}`;
    S.startMs = now();
    S.timeLeft = TIME;
    S.score=0; S.combo=0; S.comboMax=0; S.miss=0;
    S.goodSpawn=0; S.junkSpawn=0; S.goodHit=0; S.junkHit=0; S.goodExpire=0;
    S.targets.clear();
    S.lastSpawnMs = 0;
    S.lastFrameMs = 0;

    try{ UI.domTargets && (UI.domTargets.innerHTML = ''); }catch(e){}
    if (UI.domTargets) UI.domTargets.style.pointerEvents = 'auto';

    hud();
    S.raf = requestAnimationFrame(loop);
  }

  function onUnlock(){}

  function bindUI(){
    D.getElementById('btnHelp')?.addEventListener('click', ()=> D.getElementById('panelHelp')?.classList.remove('hidden'));
    D.getElementById('btnCloseHelp')?.addEventListener('click', ()=> D.getElementById('panelHelp')?.classList.add('hidden'));
    D.getElementById('btnStart')?.addEventListener('click', ()=> start());
    D.getElementById('btnReplay')?.addEventListener('click', ()=>{ D.getElementById('panelEnd')?.classList.add('hidden'); start(); });
    D.getElementById('btnBack')?.addEventListener('click', ()=>{ location.href = qs('hub','../hub.html'); });
  }

  bindUI();
  hud();

  const api = { start, onUnlock, state:()=>({ ...S, targetsSize:S.targets.size }) };
  W.HHBrush_SAFE = api;
  return api;
}

try{ window.__BRUSH_BOOTGAME__ = bootGame; }catch(e){}