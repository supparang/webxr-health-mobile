// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — Battle v3 (mirror spawn + rematch) + solo fallback
// FULL v20260304-SAFE-BATTLE-V3-REMATCH

'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;
  const AI  = cfg.ai || null;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const $ = (id)=> DOC.getElementById(id);

  // DOM
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

  // cfg
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);
  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const seedStrSolo = String(cfg.seed || qs('seed', String(Date.now())));

  const HH_CAT = 'nutrition';
  const HH_GAME = 'goodjunk';

  // battle flags
  let battleEnabled = (String(qs('battle','0')) === '1');
  let battle = null;
  let mirror = null;

  let battleStarted = !battleEnabled;
  let battleRound = 1;
  let battleSeed = '';

  // ---------- Duel Result overlay (includes Rematch request) ----------
  const duel = DOC.createElement('div');
  duel.id = 'gjDuelResult';
  duel.style.cssText = `
    position:fixed; inset:0; z-index:20000;
    display:none; align-items:center; justify-content:center;
    padding:18px; background: rgba(0,0,0,.60); backdrop-filter: blur(8px);
  `;
  duel.innerHTML = `
    <div style="
      width:min(760px, 94vw);
      border-radius:18px; border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.90); color: rgba(229,231,235,.96);
      box-shadow:0 18px 60px rgba(0,0,0,.45); padding:16px;
      font: 900 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial;">
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
      <div id="gjDuelHint" style="margin-top:10px;font-size:12px;opacity:.82">—</div>
    </div>
    <style>@media (max-width: 560px){ #gjDuelGrid{grid-template-columns:1fr;} }</style>
  `;
  DOC.body.appendChild(duel);

  const duelTop = DOC.getElementById('gjDuelTop');
  const duelReason = DOC.getElementById('gjDuelReason');
  const duelHint = DOC.getElementById('gjDuelHint');
  const youLine = DOC.getElementById('gjYouLine');
  const youSub = DOC.getElementById('gjYouSub');
  const oppLine2 = DOC.getElementById('gjOppLine2');
  const oppSub2 = DOC.getElementById('gjOppSub2');

  duel.querySelector('#gjDuelHub')?.addEventListener('click', ()=> location.href = hubUrl);
  duel.querySelector('#gjDuelRematch')?.addEventListener('click', async ()=>{
    if(!battleEnabled || !battle){
      // solo rematch = reload new seed
      const u = new URL(location.href);
      u.searchParams.set('seed', String(Date.now()));
      location.href = u.toString();
      return;
    }
    // battle rematch request
    duelHint.textContent = 'Requesting rematch…';
    const ok = await battle.requestRematch();
    duelHint.textContent = ok ? '✅ Rematch requested (waiting opponent)…' : '❌ Rematch request failed';
  });

  function showDuelResult(payload){
    duel.style.display = 'flex';
    const w = String(payload?.winner || 'TIE');
    const reason = String(payload?.tieReason || payload?.reason || '-');

    duelTop.textContent = (w==='ME') ? '✅ YOU WIN!' : (w==='OPP') ? '❌ YOU LOSE' : '🤝 TIE';
    duelReason.textContent = `tie-break: ${reason}`;
    duelHint.textContent = battleEnabled ? 'กด Rematch ได้เลย (ห้องเดิม รอบใหม่)' : '—';

    const a = payload?.a || {};
    const b = payload?.b || {};
    const aPid = String(a.pid||'');
    const bPid = String(b.pid||'');
    const meIsA = aPid && aPid===pid;
    const me = meIsA ? a : b;
    const op = meIsA ? b : a;

    youLine.textContent = `S ${me.score|0} • A ${me.acc|0}% • M ${me.miss|0} • RT ${me.medianRt|0}ms`;
    youSub.textContent  = `pid=${pid}`;
    oppLine2.textContent = `S ${op.score|0} • A ${op.acc|0}% • M ${op.miss|0} • RT ${op.medianRt|0}ms`;
    oppSub2.textContent  = `pid=${String(op.pid||'')}`;
  }

  WIN.addEventListener('hha:battle-ended', (ev)=>{
    if(!battleEnabled) return;
    showDuelResult(ev?.detail || {});
  });

  // ---------- Mirror spawner ----------
  async function ensureMirror(){
    if(!battleEnabled || !battle) return;
    if(mirror && battleSeed === String(battle.roomSeed||'')) return;

    const { createMirrorSpawner } = await import('../vr/battle-mirror.js');
    battleSeed = String(battle.roomSeed || battle.state?.roomSeed || '');

    mirror = createMirrorSpawner({
      roomSeed: battleSeed || `seed_${Date.now()}`,
      stepMs: 100,
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
        // boss activation threshold shared by time, so ok
        if(!bossActive && tLeft <= plannedSec*0.35 && tLeft > 6){
          bossActive = true;
          bossHpMax = TUNE.bossHp; bossHp=bossHpMax;
          bossPhase=0; bossShieldHp=5;
        }
        makeTarget(s.kind, s.emoji, s.ttlSec);
      }
    });
  }

  // ---------- init battle ----------
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

      WIN.addEventListener('hha:battle-state', (ev)=>{
        const s = ev?.detail || {};
        const st = String(s.status||'');
        const rd = Number(s.round||1) || 1;
        const seed = String(s.roomSeed||'');

        // round change => reset game hard
        if(rd !== battleRound || seed !== battleSeed){
          battleRound = rd;
          battleSeed = seed;
          resetForNewRound(`round_${rd}`);
        }

        if(st === 'playing') battleStarted = true;
        if(st === 'waiting' || st === 'countdown'){
          // keep lobby overlays closed in game view; game will gate start
        }
      });

      return battle;
    }catch(e){
      console.warn('[GoodJunk] battle init failed, fallback solo', e);
      battleEnabled = false;
      battleStarted = true;
      return null;
    }
  }

  // ---------- tuning ----------
  const TUNE = (function(){
    let spawnBase = 0.78;
    let lifeMissLimit = 10;
    let ttlGood = 2.6;
    let ttlJunk = 2.9;
    let ttlBonus = 2.4;
    let stormMult = 1.0;
    let bossHp = 18;

    if(diff==='easy'){
      spawnBase = 0.68;
      lifeMissLimit = 14;
      ttlGood = 3.0;
      ttlJunk = 3.2;
      stormMult = 0.9;
      bossHp = 16;
    }else if(diff==='hard'){
      spawnBase = 0.95;
      lifeMissLimit = 8;
      ttlGood = 2.2;
      ttlJunk = 2.4;
      stormMult = 1.12;
      bossHp = 22;
    }
    if(view==='cvr' || view==='vr'){
      ttlGood += 0.15;
      ttlJunk += 0.15;
    }
    return { spawnBase, lifeMissLimit, ttlGood, ttlJunk, ttlBonus, stormMult, bossHp };
  })();

  // ---------- game state ----------
  const startTimeIso = nowIso();

  let playing = true;
  let paused = false;

  let tLeft = plannedSec;
  let lastTick = nowMs();

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

  let bossActive = false, bossHpMax = TUNE.bossHp, bossHp = TUNE.bossHp, bossPhase = 0, bossShieldHp = 5;

  const targets = new Map();
  let idSeq = 1;

  WIN.__GJ_SET_PAUSED__ = (on)=>{ paused = !!on; try{ lastTick = nowMs(); }catch(e){} };

  function resetForNewRound(reason){
    // clear overlays
    duel.style.display = 'none';
    if(endOverlay) endOverlay.setAttribute('aria-hidden','true');

    // wipe targets
    for(const t of targets.values()){
      try{ t.el.remove(); }catch(e){}
    }
    targets.clear();
    idSeq = 1;

    // reset stats
    score = 0; missTotal = 0; missGoodExpired = 0; missJunkHit = 0;
    combo = 0; bestCombo = 0;
    fever = 0; rageOn = false; rageLeft = 0;
    shield = 0; stormOn = false;
    goodHitCount = 0; rtSum = 0; rtList.length = 0;
    shots = 0; hits = 0;
    goal.cur = 0; goal.target = 20;
    mini.name = '—'; mini.t = 0;

    bossActive = false; bossHpMax = TUNE.bossHp; bossHp = bossHpMax; bossPhase = 0; bossShieldHp = 5;

    tLeft = plannedSec;
    lastTick = nowMs();

    // reset mirror step index
    try{ mirror?.reset?.(); }catch(e){}

    // light signal
    try{ console.log('[GJ] resetForNewRound', reason); }catch(e){}
  }

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
      gameVersion:'GoodJunkVR_SAFE_2026-03-04_BATTLE_V3',
      device:view,
      runMode,
      diff,
      seed: battleEnabled ? (battleSeed || seedStrSolo) : seedStrSolo,
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
      battleRoom: battle?.room || '',
      battleRound: battleEnabled ? (battleRound|0) : 0
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

    // battle: wait for duel result overlay from hha:battle-ended
  }

  // ---------- gameplay ----------
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

  function onHitGood(t){
    hits++;
    const rt = Math.max(0, Math.round(nowMs() - (t.promptMs||nowMs())));
    goodHitCount++; rtSum += rt; rtList.push(rt);

    combo++; bestCombo = Math.max(bestCombo, combo);
    let add = 10 + Math.min(12, combo);
    if(rageOn) add = Math.round(add * 1.6);

    score += add;
    goal.cur = clamp(goal.cur + 1, 0, 9999);
    addFever(6.5);
    removeTarget(t.id);
  }

  function onHitJunk(t){
    hits++;
    if(shield > 0){
      shield--;
      removeTarget(t.id);
      return;
    }
    missTotal++; missJunkHit++;
    combo = 0;
    score = Math.max(0, score - 8);
    removeTarget(t.id);
  }

  function onHitBonus(t){
    hits++;
    combo++; bestCombo = Math.max(bestCombo, combo);
    score += (Math.random()<0.33?25:Math.random()<0.5?30:35);
    removeTarget(t.id);
  }

  function onHitShield(t){
    hits++;
    addShield();
    removeTarget(t.id);
  }

  function onHitBoss(t){
    if(!bossActive) return;
    hits++;

    if(bossPhase===0){
      bossShieldHp--;
      if(bossShieldHp<=0) bossPhase=1;
      removeTarget(t.id);
      return;
    }

    const dmg = rageOn ? 4 : 3;
    bossHp = Math.max(0, bossHp - dmg);
    score += (22 + dmg*6);
    removeTarget(t.id);

    if(bossHp<=0){
      bossActive = false;
      score += 120;
      addFever(40);
    }
  }

  function hitTargetById(id){
    const t = targets.get(String(id));
    if(!t || !playing) return;
    shots++;

    if(t.kind==='good') onHitGood(t);
    else if(t.kind==='junk') onHitJunk(t);
    else if(t.kind==='bonus') onHitBonus(t);
    else if(t.kind==='shield') onHitShield(t);
    else if(t.kind==='boss') onHitBoss(t);
  }

  function onPointerDown(ev){
    if(!playing || paused) return;
    const el = ev.target && ev.target.closest ? ev.target.closest('.gj-target') : null;
    if(!el) return;
    hitTargetById(el.dataset.id);
  }
  if(view !== 'cvr'){
    layer.addEventListener('pointerdown', onPointerDown, { passive:true });
  }

  // SOLO spawn (fallback)
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

      if(kind==='good') makeTarget('good', '🥦', TUNE.ttlGood);
      else if(kind==='junk') makeTarget('junk', '🍟', TUNE.ttlJunk);
      else if(kind==='bonus') makeTarget('bonus', '⭐', TUNE.ttlBonus);
      else if(kind==='shield') makeTarget('shield', '🛡️', 2.6);
      else if(kind==='boss') makeTarget('boss', (bossPhase===0?'🛡️':'🎯'), 2.2);
    }
  }

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
        if(t.kind==='good'){
          missTotal++; missGoodExpired++;
          combo = 0;
          score = Math.max(0, score - 4);
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
      mini.name = 'Trick';
      mini.t = 6;
    }
  }

  function checkEnd(){
    if(tLeft <= 0){ showEnd('time'); return true; }
    if(missTotal >= TUNE.lifeMissLimit){ showEnd('miss-limit'); return true; }
    return false;
  }

  async function tick(){
    if(!playing) return;

    // BATTLE path
    if(battleEnabled){
      if(!battle) await initBattle();
      if(battle) await ensureMirror();

      // gate until playing (state=playing + startAt)
      if(!battleStarted){
        setHUD();
        requestAnimationFrame(tick);
        return;
      }

      const st = Number(battle.startAt || battle.state?.startAt || 0);
      if(!st){
        setHUD();
        requestAnimationFrame(tick);
        return;
      }

      // time = server elapsed
      const elapsedMs = Math.max(0, battle.serverNow() - st);
      tLeft = Math.max(0, plannedSec - (elapsedMs/1000));

      const t = nowMs();
      const dt = Math.min(0.05, Math.max(0.001, (t - lastTick)/1000));
      lastTick = t;

      if(paused){
        setHUD();
        requestAnimationFrame(tick);
        return;
      }

      // mirror spawns
      mirror && mirror.tick({ tLeftSec:tLeft, plannedSec, rageOn, bossActive, bossPhase });

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

    // SOLO path
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

  initBattle().catch(()=>{});
  setHUD();
  requestAnimationFrame(tick);
}