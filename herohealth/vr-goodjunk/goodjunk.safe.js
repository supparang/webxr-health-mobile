// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (solo + duel battle mirror)
// ✅ Battle RTDB v2 + Mirror spawn (seed+startAt)
// ✅ Duel result overlay (winner + breakdown)
// FULL v20260304-SAFE-BATTLE-MIRROR-RESULT

'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;
  const AI  = cfg.ai || null;

  // helpers
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const $ = (id)=> DOC.getElementById(id);

  // DOM refs
  const layer = $('gj-layer');
  const hud = {
    score: $('hud-score'),
    time: $('hud-time'),
    miss: $('hud-miss'),
    grade: $('hud-grade'),
    goal: $('hud-goal'),
    goalCur: $('hud-goal-cur'),
    goalTarget: $('hud-goal-target'),
    goalDesc: $('goalDesc'),
    mini: $('hud-mini'),
    miniTimer: $('miniTimer'),
    aiRisk: $('aiRisk'),
    aiHint: $('aiHint'),
  };
  const feverFill = $('feverFill');
  const feverText = $('feverText');
  const shieldPills = $('shieldPills');
  const bossBar = $('bossBar');
  const bossFill = $('bossFill');
  const bossHint = $('bossHint');
  const lowTimeOverlay = $('lowTimeOverlay');
  const lowTimeNum = $('gj-lowtime-num');
  const progressFill = $('gjProgressFill');

  const endOverlay = $('endOverlay');
  const endTitle = $('endTitle');
  const endSub = $('endSub');
  const endGrade = $('endGrade');
  const endScore = $('endScore');
  const endMiss  = $('endMiss');
  const endTime  = $('endTime');

  if(!layer){
    console.warn('[GoodJunk] Missing #gj-layer');
    return;
  }

  // basic cfg
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);

  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const HH_CAT = 'nutrition';
  const HH_GAME = 'goodjunk';

  // solo seed (battle uses roomSeed)
  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));

  // ---------- battle v2 ----------
  let battle = null;
  let battleEnabled = (String(qs('battle','0')) === '1');
  let battleStarted = !battleEnabled;

  let mirror = null;

  async function initBattle(){
    if(!battleEnabled) return null;
    try{
      const mod = await import('../vr/battle-rtdb.js');
      battle = await mod.initBattle({
        enabled: true,
        room: qs('room',''),
        role: qs('brole',''),
        pid,
        gameKey: HH_GAME,
        hub: hubUrl,
        autostartMs: Number(qs('autostart','3000'))||3000,
        forfeitMs: Number(qs('forfeit','5000'))||5000,
      });
      if(!battle){
        battleEnabled = false;
        battleStarted = true;
        return null;
      }

      // when playing -> start
      WIN.addEventListener('hha:battle-state', (ev)=>{
        const s = ev?.detail || {};
        if(String(s.status) === 'playing') battleStarted = true;
      });

      return battle;
    }catch(e){
      console.warn('[GoodJunk] battle init failed (fallback solo)', e);
      battleEnabled = false;
      battleStarted = true;
      return null;
    }
  }

  // ---------- Duel Result Overlay ----------
  const duel = DOC.createElement('div');
  duel.id = 'gjDuelResult';
  duel.style.cssText = `
    position:fixed; inset:0; z-index:20000;
    display:none; align-items:center; justify-content:center;
    padding:18px;
    background: rgba(0,0,0,.60); backdrop-filter: blur(8px);
  `;
  duel.innerHTML = `
    <div style="
      width:min(760px, 94vw);
      border-radius:18px;
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.90);
      color: rgba(229,231,235,.96);
      box-shadow:0 18px 60px rgba(0,0,0,.45);
      padding:16px;
      font: 900 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial;
    ">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <div style="font-size:18px;font-weight:1000">🏁 Duel Result</div>
          <div id="gjDuelTop" style="margin-top:6px;opacity:.92;font-weight:900">—</div>
        </div>
        <div style="text-align:right;opacity:.86;font-weight:900">
          <div>rule: score→acc→miss→medianRT</div>
          <div id="gjDuelReason" style="margin-top:4px;font-size:12px">—</div>
        </div>
      </div>

      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px" id="gjDuelGrid">
        <div style="border:1px solid rgba(148,163,184,.14);border-radius:14px;padding:12px;background:rgba(2,6,23,.55)">
          <div style="font-weight:1000;opacity:.9">YOU</div>
          <div id="gjYouLine" style="margin-top:8px;font:1000 18px/1 ui-monospace,Menlo,monospace">—</div>
          <div id="gjYouSub" style="margin-top:8px;font-size:12px;opacity:.88">—</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.14);border-radius:14px;padding:12px;background:rgba(2,6,23,.55)">
          <div style="font-weight:1000;opacity:.9">OPPONENT</div>
          <div id="gjOppLine2" style="margin-top:8px;font:1000 18px/1 ui-monospace,Menlo,monospace">—</div>
          <div id="gjOppSub2" style="margin-top:8px;font-size:12px;opacity:.88">—</div>
        </div>
      </div>

      <div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        <button id="gjDuelRematch" style="border-radius:14px;padding:10px 12px;font-weight:1000;border:1px solid rgba(99,102,241,.35);background:rgba(99,102,241,.22);color:#e5e7eb;cursor:pointer">Rematch</button>
        <button id="gjDuelHub" style="border-radius:14px;padding:10px 12px;font-weight:1000;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.55);color:#e5e7eb;cursor:pointer">Back HUB</button>
      </div>
    </div>
    <style>
      @media (max-width: 560px){
        #gjDuelGrid{ grid-template-columns: 1fr; }
      }
    </style>
  `;
  DOC.body.appendChild(duel);

  const duelTop = $('gjDuelTop');
  const duelReason = $('gjDuelReason');
  const youLine = $('gjYouLine');
  const youSub = $('gjYouSub');
  const oppLine2 = $('gjOppLine2');
  const oppSub2 = $('gjOppSub2');

  duel.querySelector('#gjDuelHub')?.addEventListener('click', ()=> location.href = hubUrl);
  duel.querySelector('#gjDuelRematch')?.addEventListener('click', ()=>{
    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    // keep room & battle on
    location.href = u.toString();
  });

  function showDuelResult(payload){
    try{
      duel.style.display = 'flex';
      const w = String(payload?.winner || 'TIE');
      const reason = String(payload?.tieReason || payload?.reason || '-');

      duelTop.textContent = (w==='ME') ? '✅ YOU WIN!' : (w==='OPP') ? '❌ YOU LOSE' : '🤝 TIE';
      duelReason.textContent = `tie-break: ${reason}`;

      const a = payload?.a || {};
      const b = payload?.b || {};

      // we don’t know which is me; use winnerKey compare
      const winnerKey = String(payload?.winnerKey || '');
      const meKey = battle?.meKey || '';

      // Find my result among a/b
      const AisMe = (payload?.a?.raw && payload?.a?.raw?.battlePlayerKey) ? false : false; // ignore
      // easiest: compare normalized pid to our pid
      const aPid = String(payload?.a?.pid || payload?.a?.raw?.pid || '');
      const bPid = String(payload?.b?.pid || payload?.b?.raw?.pid || '');
      const meIsA = (aPid && aPid===pid) || (winnerKey && meKey && winnerKey===meKey && w==='ME'); // best-effort
      const me = meIsA ? a : b;
      const op = meIsA ? b : a;

      youLine.textContent = `S ${me.score|0} • A ${me.acc|0}% • M ${me.miss|0} • RT ${me.medianRt|0}ms`;
      youSub.textContent  = `pid=${pid}`;
      oppLine2.textContent = `S ${op.score|0} • A ${op.acc|0}% • M ${op.miss|0} • RT ${op.medianRt|0}ms`;
      oppSub2.textContent  = `pid=${String(op.pid||'')}`;
    }catch(e){}
  }

  WIN.addEventListener('hha:battle-ended', (ev)=>{
    if(!battleEnabled) return;
    showDuelResult(ev?.detail || {});
  });

  // ---------- gameplay state ----------
  const startTimeIso = nowIso();
  let playing = true;
  let paused = false;

  let score = 0;
  let missTotal = 0, missGoodExpired = 0, missJunkHit = 0;
  let combo = 0, bestCombo = 0;
  let fever = 0, rageOn = false, rageLeft = 0;
  let shield = 0, stormOn = false;

  let goodHitCount = 0, rtSum = 0;
  const rtList = [];

  let shots = 0, hits = 0;

  const goal = { name:'Daily', desc:'Hit GOOD 20', cur:0, target:20 };
  const mini = { name:'—', t:0 };

  let bossActive = false, bossHpMax = 18, bossHp = 18, bossPhase = 0, bossShieldHp = 5;

  const targets = new Map();
  let idSeq = 1;

  // timer: solo uses local dt, battle uses server elapsed
  let tLeft = plannedSec;
  let lastTick = nowMs();

  WIN.__GJ_SET_PAUSED__ = (on)=>{ paused = !!on; try{ lastTick = nowMs(); }catch(e){} };

  function layerRect(){ return layer.getBoundingClientRect(); }
  function getSpawnSafeLocal(){
    const r = layerRect();
    const pad = 18;
    return { xMin: pad, xMax: r.width-pad, yMin: 180, yMax: Math.max(220, r.height-130), w:r.width, h:r.height };
  }

  function median(arr){
    if(!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = (a.length/2)|0;
    return (a.length%2) ? a[m] : (a[m-1]+a[m])/2;
  }

  function accPct(){
    return shots>0 ? Math.round((hits/shots)*1000)/10 : 0;
  }

  function gradeFromScore(s){
    const played = Math.max(1, plannedSec - tLeft);
    const sps = s / played;
    const pen = missTotal * 6;
    const x = sps*10 - pen*0.4;
    if(x >= 70) return 'S';
    if(x >= 55) return 'A';
    if(x >= 40) return 'B';
    if(x >= 28) return 'C';
    return 'D';
  }

  // throttled score pulse
  let lastScoreEmitMs = 0;
  function emitScoreEvent(force=false){
    const t = nowMs();
    if(!force && (t - lastScoreEmitMs) < 250) return;
    lastScoreEmitMs = t;

    const payload = {
      score: score|0,
      miss: missTotal|0,
      accPct: accPct(),
      shots: shots|0,
      hits: hits|0,
      combo: combo|0,
      comboMax: bestCombo|0,
      feverPct: +clamp(fever,0,100),
      shield: shield|0,
      missGoodExpired: missGoodExpired|0,
      missJunkHit: missJunkHit|0,
      medianRtGoodMs: Math.round(median(rtList))|0
    };
    try{ WIN.dispatchEvent(new CustomEvent('hha:score', { detail: payload })); }catch(e){}
    try{ battle?.pushScore?.(payload); }catch(e){}
  }

  function setAIHud(pred){
    try{
      if(!pred) return;
      if(hud.aiRisk && typeof pred.hazardRisk === 'number') hud.aiRisk.textContent = String((+pred.hazardRisk).toFixed(2));
      if(hud.aiHint) hud.aiHint.textContent = String((pred.next5 && pred.next5[0]) || '—');
    }catch(e){}
  }

  // FX minimal
  const fxLayer = DOC.createElement('div');
  fxLayer.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:260;`;
  DOC.body.appendChild(fxLayer);

  function fxFloatText(x,y,text,isBad){
    const el = DOC.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position:absolute;left:${x}px;top:${y}px;
      transform:translate(-50%,-50%);
      font:900 18px/1.1 system-ui,-apple-system,Segoe UI,Roboto,Arial;
      letter-spacing:.2px;
      color:${isBad?'rgba(255,110,110,.96)':'rgba(229,231,235,.98)'};
      text-shadow:0 10px 30px rgba(0,0,0,.55);
      opacity:1;will-change:transform,opacity;
    `;
    fxLayer.appendChild(el);
    const t0 = nowMs(), dur=520;
    function tick(){
      const p = Math.min(1, (nowMs()-t0)/dur);
      el.style.top = `${y - (40*p)}px`;
      el.style.opacity = String(1-p);
      if(p<1) requestAnimationFrame(tick);
      else el.remove();
    }
    requestAnimationFrame(tick);
  }

  function setHUD(){
    if(hud.score) hud.score.textContent = String(score|0);
    if(hud.time)  hud.time.textContent  = String(Math.ceil(tLeft));
    if(hud.miss)  hud.miss.textContent  = String(missTotal|0);
    if(hud.grade) hud.grade.textContent = gradeFromScore(score);

    if(hud.goal) hud.goal.textContent = goal.name;
    if(hud.goalCur) hud.goalCur.textContent = String(goal.cur|0);
    if(hud.goalTarget) hud.goalTarget.textContent = String(goal.target|0);
    if(hud.goalDesc) hud.goalDesc.textContent = goal.desc;

    if(hud.mini) hud.mini.textContent = mini.name;
    if(hud.miniTimer) hud.miniTimer.textContent = mini.t>0 ? `${Math.ceil(mini.t)}s` : '—';

    if(feverFill) feverFill.style.width = `${clamp(fever,0,100)}%`;
    if(feverText) feverText.textContent = `${Math.round(clamp(fever,0,100))}%`;

    if(shieldPills) shieldPills.textContent = (shield<=0) ? '—' : '🛡️'.repeat(Math.min(6, shield));

    if(bossBar){
      if(!bossActive){
        bossBar.setAttribute('aria-hidden','true');
      }else{
        bossBar.setAttribute('aria-hidden','false');
        const hpPct = (bossHpMax>0) ? (bossHp/bossHpMax)*100 : 0;
        if(bossFill) bossFill.style.width = `${clamp(hpPct,0,100)}%`;
        if(bossHint) bossHint.textContent = bossPhase===0 ? 'Shield up! Break 🛡️ first' : 'Weakspot 🎯 ! Big damage';
      }
    }

    if(progressFill){
      const p = (plannedSec>0) ? (1 - (tLeft/plannedSec)) : 0;
      progressFill.style.width = `${clamp(p*100,0,100)}%`;
    }

    if(lowTimeOverlay){
      if(tLeft <= 5 && tLeft > 0){
        lowTimeOverlay.setAttribute('aria-hidden','false');
        if(lowTimeNum) lowTimeNum.textContent = String(Math.ceil(tLeft));
      }else{
        lowTimeOverlay.setAttribute('aria-hidden','true');
      }
    }

    emitScoreEvent(false);
  }

  const __HHA_END_SENT_KEY = '__HHA_GJ_END_SENT__';
  function hhaDispatchEndOnce(summary){
    try{
      if(WIN[__HHA_END_SENT_KEY]) return;
      WIN[__HHA_END_SENT_KEY] = 1;
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary || null }));
    }catch(e){}
  }

  function buildEndSummary(reason){
    const playedSec = Math.round(plannedSec - tLeft);
    return {
      projectTag:'GoodJunkVR',
      gameKey:HH_GAME,
      pid,
      zone:HH_CAT,
      gameVersion:'GoodJunkVR_SAFE_2026-03-04_BATTLE_MIRROR',
      device:view,
      runMode,
      diff,
      seed: seedStr,
      reason:String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: playedSec,
      scoreFinal: score|0,
      missTotal: missTotal|0,
      accPct: accPct(),
      shots: shots|0,
      hits: hits|0,
      comboMax: bestCombo|0,
      missGoodExpired: missGoodExpired|0,
      missJunkHit: missJunkHit|0,
      avgRtGoodMs: (goodHitCount>0 ? Math.round(rtSum/goodHitCount) : 0),
      medianRtGoodMs: Math.round(median(rtList))|0,
      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFromScore(score),
      tieBreakOrder:'score→acc→miss→medianRT',
      battle: battleEnabled ? 1 : 0,
      battleRoom: battle?.room || ''
    };
  }

  function showEnd(reason){
    playing = false;
    paused = false;

    for(const t of targets.values()){
      try{ t.el.remove(); }catch(e){}
    }
    targets.clear();

    const summary = buildEndSummary(reason);

    try{
      const aiEnd = AI?.onEnd?.(summary);
      if(aiEnd) summary.aiEnd = aiEnd;
    }catch(e){}

    WIN.__HHA_LAST_SUMMARY = summary;
    hhaDispatchEndOnce(summary);

    try{ battle?.finalizeEnd?.(summary); }catch(e){}

    if(endOverlay){
      endOverlay.setAttribute('aria-hidden','false');
      if(endTitle) endTitle.textContent = 'Game Over';
      if(endSub) endSub.textContent = `reason=${summary.reason} | acc=${summary.accPct}% | medRT=${summary.medianRtGoodMs}ms`;
      if(endGrade) endGrade.textContent = summary.grade || '—';
      if(endScore) endScore.textContent = String(summary.scoreFinal|0);
      if(endMiss)  endMiss.textContent  = String(summary.missTotal|0);
      if(endTime)  endTime.textContent  = String(summary.durationPlayedSec|0);
    }

    emitScoreEvent(true);
    setHUD();
  }

  // ---------- target mechanics ----------
  function makeTarget(kind, emoji, ttlSec){
    const id = String(idSeq++);
    const el = DOC.createElement('div');
    el.className = 'gj-target';
    el.textContent = emoji;
    el.dataset.id = id;
    el.dataset.kind = kind;

    const safe = getSpawnSafeLocal();
    const rPad = (view==='mobile') ? 34 : 42;

    const xMin = safe.xMin + rPad, xMax = safe.xMax - rPad;
    const yMin = safe.yMin + rPad, yMax = safe.yMax - rPad;

    const x = xMin + Math.random()*(Math.max(1, xMax-xMin));
    const y = yMin + Math.random()*(Math.max(1, yMax-yMin));

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.opacity = '1';

    const drift = (Math.random()*2-1) * (view==='mobile' ? 16 : 22);
    const born = nowMs();
    const ttl = Math.max(0.85, ttlSec) * 1000;

    layer.appendChild(el);
    targets.set(id, { id, el, kind, emoji, born, ttl, x, y, drift, promptMs: nowMs() });

    try{ AI?.onSpawn?.(kind, { id, emoji, ttlSec }); }catch(e){}
  }

  function removeTarget(id){
    const t = targets.get(String(id));
    if(!t) return;
    targets.delete(String(id));
    try{ t.el.remove(); }catch(e){}
  }

  function addFever(v){
    fever = clamp(fever + v, 0, 100);
    if(fever >= 100 && !rageOn){
      rageOn = true;
      rageLeft = 7.0;
      fever = 100;
    }
  }

  function addShield(){ shield = clamp(shield + 1, 0, 9); }

  function onHitGood(t, x, y){
    hits++;
    const rt = Math.max(0, Math.round(nowMs() - (t.promptMs||nowMs())));
    goodHitCount++; rtSum += rt; rtList.push(rt);

    combo++; bestCombo = Math.max(bestCombo, combo);
    let add = 10 + Math.min(12, combo);
    if(rageOn) add = Math.round(add * 1.6);

    score += add;
    goal.cur = clamp(goal.cur + 1, 0, 9999);
    addFever(6.5);

    fxFloatText(x,y-10, `+${add}`, false);
    try{ AI?.onHit?.(t.kind, { id:t.id }); }catch(e){}
    removeTarget(t.id);
  }

  function onHitJunk(t, x, y){
    hits++;
    if(shield > 0){
      shield--;
      fxFloatText(x,y-10, 'BLOCK 🛡️', false);
      removeTarget(t.id);
      return;
    }
    missTotal++; missJunkHit++;
    combo = 0;
    score = Math.max(0, score - 8);
    fxFloatText(x,y-10, '-8', true);
    removeTarget(t.id);
  }

  function onHitBonus(t, x, y){
    hits++;
    combo++; bestCombo = Math.max(bestCombo, combo);
    const add = (Math.random()<0.33?25:Math.random()<0.5?30:35);
    score += add;
    fxFloatText(x,y-10, `BONUS +${add}`, false);
    removeTarget(t.id);
  }

  function onHitShield(t, x, y){
    hits++;
    addShield();
    fxFloatText(x,y-10, '+SHIELD', false);
    removeTarget(t.id);
  }

  function onHitBoss(t, x, y){
    if(!bossActive) return;
    hits++;

    if(bossPhase===0){
      bossShieldHp--;
      fxFloatText(x,y-10, 'SHIELD -1', false);
      if(bossShieldHp<=0) bossPhase=1;
      removeTarget(t.id);
      return;
    }

    const dmg = rageOn ? 4 : 3;
    bossHp = Math.max(0, bossHp - dmg);
    score += (22 + dmg*6);

    fxFloatText(x,y-10, `BOSS +${22 + dmg*6}`, false);
    removeTarget(t.id);

    if(bossHp<=0){
      bossActive = false;
      score += 120;
      addFever(40);
    }
  }

  function hitTargetById(id, x, y){
    const t = targets.get(String(id));
    if(!t || !playing) return;
    shots++;

    if(t.kind==='good') onHitGood(t,x,y);
    else if(t.kind==='junk') onHitJunk(t,x,y);
    else if(t.kind==='bonus') onHitBonus(t,x,y);
    else if(t.kind==='shield') onHitShield(t,x,y);
    else if(t.kind==='boss') onHitBoss(t,x,y);
  }

  function onPointerDown(ev){
    if(!playing || paused) return;
    const el = ev.target && ev.target.closest ? ev.target.closest('.gj-target') : null;
    if(!el) return;
    hitTargetById(el.dataset.id, ev.clientX, ev.clientY);
  }
  if(view !== 'cvr'){
    layer.addEventListener('pointerdown', onPointerDown, { passive:true });
  }

  // ---------- spawner selection (solo vs battle mirror) ----------
  // solo tuning (kept close to your previous)
  const TUNE = (function(){
    let spawnBase = 0.78, lifeMissLimit = 10, ttlGood=2.6, ttlJunk=2.9, ttlBonus=2.4, stormMult=1.0, bossHp=18;
    if(diff==='easy'){ spawnBase=0.68; lifeMissLimit=14; ttlGood=3.0; ttlJunk=3.2; stormMult=0.9; bossHp=16; }
    else if(diff==='hard'){ spawnBase=0.95; lifeMissLimit=8; ttlGood=2.2; ttlJunk=2.4; stormMult=1.12; bossHp=22; }
    if(view==='cvr' || view==='vr'){ ttlGood+=0.15; ttlJunk+=0.15; }
    return { spawnBase, lifeMissLimit, ttlGood, ttlJunk, ttlBonus, stormMult, bossHp };
  })();

  bossHpMax = TUNE.bossHp;
  bossHp = bossHpMax;

  let spawnAcc = 0;
  function soloSpawnTick(dt){
    stormOn = (tLeft <= Math.min(40, plannedSec*0.45));
    const mult = stormOn ? TUNE.stormMult : 1.0;
    spawnAcc += TUNE.spawnBase * mult * (rageOn ? 1.18 : 1.0) * dt;

    while(spawnAcc >= 1){
      spawnAcc -= 1;

      if(!bossActive && tLeft <= plannedSec*0.35 && tLeft > 6){
        bossActive = true;
        bossHpMax = TUNE.bossHp; bossHp=bossHpMax;
        bossPhase=0; bossShieldHp=5;
      }

      let kind='good';
      const p = Math.random();

      if(bossActive && (Math.random() < 0.22)) kind='boss';
      else if(p < 0.64) kind='good';
      else if(p < 0.86) kind='junk';
      else if(p < 0.94) kind='bonus';
      else kind='shield';

      if(kind==='good') makeTarget('good', ['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑','🍉','🍊','🥕','🥒'][(Math.random()*14)|0], TUNE.ttlGood);
      else if(kind==='junk') makeTarget('junk', ['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭','🍫'][(Math.random()*9)|0], TUNE.ttlJunk);
      else if(kind==='bonus') makeTarget('bonus', ['⭐','💎','⚡'][(Math.random()*3)|0], TUNE.ttlBonus);
      else if(kind==='shield') makeTarget('shield', '🛡️', 2.6);
      else if(kind==='boss'){
        const emo = (bossPhase===0) ? '🛡️' : '🎯';
        makeTarget('boss', emo, 2.2);
      }
    }
  }

  // init mirror spawner once battle has seed+startAt
  async function ensureMirror(){
    if(!battleEnabled || !battle) return;
    if(mirror) return;

    const { createMirrorSpawner } = await import('../vr/battle-mirror.js');

    mirror = createMirrorSpawner({
      roomSeed: String(battle.roomSeed || battle.state?.roomSeed || `seed_${Date.now()}`),
      stepMs: 100, // 10Hz deterministic steps
      getElapsedMs: ()=>{
        const st = Number(battle.startAt || battle.state?.startAt || 0);
        if(!st) return 0;
        return Math.max(0, battle.serverNow() - st);
      },
      tune: {
        spawnBase: TUNE.spawnBase,
        stormMult: TUNE.stormMult,
        ttlGood: TUNE.ttlGood,
        ttlJunk: TUNE.ttlJunk,
        ttlBonus: TUNE.ttlBonus,
        bossHp: TUNE.bossHp
      },
      onSpawn: (s)=>{
        // Boss activation is also mirrored by timeline:
        // when time passes threshold, we activate boss so "boss targets" appear same.
        if(!bossActive && tLeft <= plannedSec*0.35 && tLeft > 6){
          bossActive = true;
          bossHpMax = TUNE.bossHp; bossHp=bossHpMax;
          bossPhase=0; bossShieldHp=5;
        }
        makeTarget(s.kind, s.emoji, s.ttlSec);
      }
    });
  }

  // update targets (shared)
  function updateTargets(dt){
    const tNow = nowMs();
    const safe = getSpawnSafeLocal();
    const rPad = (view==='mobile') ? 34 : 42;

    for(const t of Array.from(targets.values())){
      const age = tNow - t.born;
      const p = age / t.ttl;

      t.x += t.drift * dt;
      t.x = clamp(t.x, safe.xMin + rPad, safe.xMax - rPad);
      t.el.style.left = `${t.x}px`;

      if(p > 0.75){
        t.el.style.opacity = String(clamp(1 - (p-0.75)/0.25, 0.15, 1));
        t.el.style.transform = `translate(-50%,-50%) scale(${1 - 0.08*(p-0.75)/0.25})`;
      }

      if(age >= t.ttl){
        try{ AI?.onExpire?.(t.kind, { id:t.id }); }catch(e){}
        if(t.kind==='good'){
          missTotal++; missGoodExpired++;
          combo = 0;
          score = Math.max(0, score - 4);
          const r = t.el.getBoundingClientRect();
          fxFloatText(r.left+r.width/2, r.top+r.height/2, 'MISS', true);
        }
        removeTarget(t.id);
      }
    }
  }

  function updateRage(dt){
    if(!rageOn) return;
    rageLeft -= dt;
    if(rageLeft <= 0){
      rageOn = false;
      rageLeft = 0;
      fever = clamp(fever - 18, 0, 100);
    }
  }

  function updateMini(dt){
    if(mini.t > 0){
      mini.t = Math.max(0, mini.t - dt);
      if(mini.t<=0) mini.name='—';
      return;
    }
    if(Math.random() < dt*0.05){
      const pool = ['avoid-junk','combo-5','grab-bonus'];
      const type = pool[(Math.random()*pool.length)|0];
      if(type==='avoid-junk'){ mini.name='No JUNK 6s'; mini.t=6; }
      else if(type==='combo-5'){ mini.name='Combo x5'; mini.t=8; }
      else { mini.name='Grab ⭐'; mini.t=7; }
    }
  }

  function checkEnd(){
    if(tLeft <= 0){ showEnd('time'); return true; }
    if(missTotal >= TUNE.lifeMissLimit){ showEnd('miss-limit'); return true; }
    return false;
  }

  async function tick(){
    if(!playing) return;

    // battle gate
    if(battleEnabled){
      if(!battle) await initBattle();
      if(battle && !mirror) await ensureMirror();

      if(!battleStarted){
        setHUD();
        requestAnimationFrame(tick);
        return;
      }

      // battle time from server elapsed
      const elapsedMs = Math.max(0, battle.serverNow() - Number(battle.startAt||0));
      const elapsedSec = elapsedMs / 1000;
      tLeft = Math.max(0, plannedSec - elapsedSec);

      // use fixed dt for movement/expiry (still local smooth)
      const t = nowMs();
      const dt = Math.min(0.05, Math.max(0.001, (t - lastTick)/1000));
      lastTick = t;

      if(paused){
        setHUD();
        requestAnimationFrame(tick);
        return;
      }

      // mirror spawns
      mirror && mirror.tick({
        tLeftSec: tLeft,
        plannedSec,
        rageOn,
        bossActive,
        bossPhase
      });

      updateTargets(dt);
      updateRage(dt);
      updateMini(dt);

      try{
        const pred = AI?.onTick?.(dt, { missGoodExpired, missJunkHit, shield, fever, combo, shots, hits }) || null;
        setAIHud(pred);
      }catch(e){}

      setHUD();
      if(checkEnd()) return;
      requestAnimationFrame(tick);
      return;
    }

    // ----- SOLO path -----
    if(paused){
      try{ lastTick = nowMs(); }catch(e){}
      setHUD();
      requestAnimationFrame(tick);
      return;
    }

    const t = nowMs();
    const dt = Math.min(0.05, Math.max(0.001, (t - lastTick)/1000));
    lastTick = t;

    tLeft = Math.max(0, tLeft - dt);

    soloSpawnTick(dt);
    updateTargets(dt);
    updateRage(dt);
    updateMini(dt);

    try{
      const pred = AI?.onTick?.(dt, { missGoodExpired, missJunkHit, shield, fever, combo, shots, hits }) || null;
      setAIHud(pred);
    }catch(e){}

    setHUD();
    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){
      showEnd('background');
    }
  });

  // start
  initBattle().catch(()=>{});
  setHUD();
  requestAnimationFrame(tick);
}