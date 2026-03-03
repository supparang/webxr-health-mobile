// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (solo + duel battle)
// ✅ Battle RTDB (optional ?battle=1): create/join UI, autostart, forfeit, opponent HUD
// ✅ hha:score + end summary -> battle push/end
// FULL v20260304-SAFE-BATTLE-DUEL-GATE

'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;
  const AI  = cfg.ai || null;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const $ = (id)=> DOC.getElementById(id);

  // ---------- BATTLE (optional) ----------
  let battle = null;
  let battleEnabled = (String(qs('battle','0')) === '1');
  let battleStarted = !battleEnabled;

  async function initBattleMaybe(pid, gameKey){
    if(!battleEnabled) return null;
    try{
      const mod = await import('../vr/battle-rtdb.js');
      battle = await mod.initBattle({
        enabled: true,
        room: qs('room',''),
        role: qs('brole',''),
        pid,
        gameKey,
        hub: cfg.hub || qs('hub','../hub.html'),
        autostartMs: Number(qs('autostart','3000'))||3000,
        forfeitMs: Number(qs('forfeit','5000'))||5000,
      });
      if(!battle){
        // ถ้าไม่มี config → ปิด battle แล้วกลับไป solo ไม่ให้เกมพัง
        battleEnabled = false;
        battleStarted = true;
        return null;
      }
      // watch state
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

  // ---------- DOM refs ----------
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
  const progressWrap = DOC.querySelector('.gj-progress');
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

  // ---------- basic cfg ----------
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);

  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const HH_CAT = 'nutrition';
  const HH_GAME = 'goodjunk';

  // seed (solo: from url; battle: still used by AI only; spawn fairness is “mostly” time-aligned)
  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));

  // opponent HUD (small)
  const oppHud = DOC.createElement('div');
  oppHud.style.cssText = `
    position:fixed;
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    right: calc(env(safe-area-inset-right, 0px) + 10px);
    z-index: 222;
    pointer-events:none;
    padding: 8px 10px;
    border: 1px solid rgba(148,163,184,.16);
    background: rgba(2,6,23,.55);
    color: rgba(229,231,235,.96);
    border-radius: 14px;
    font: 900 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial;
    backdrop-filter: blur(10px);
  `;
  oppHud.innerHTML = `<div style="opacity:.85">Opponent</div><div id="gjOppLine" style="margin-top:3px">—</div>`;
  DOC.body.appendChild(oppHud);
  const oppLine = oppHud.querySelector('#gjOppLine');

  function setOpponentLine(){
    if(!battleEnabled || !battle) { oppHud.style.display='none'; return; }
    oppHud.style.display='block';
    const opp = battle.getOpponent?.();
    if(!opp){ if(oppLine) oppLine.textContent = 'Waiting…'; return; }
    const acc = (Number(opp.accPct)||0);
    if(oppLine) oppLine.textContent = `Score ${opp.score|0} • Acc ${acc}% • Miss ${opp.miss|0} • RT ${(opp.medianRtGoodMs|0)}ms`;
  }

  // ---------- deterministic RNG for local spawn (solo) ----------
  function xmur3(str){
    str = String(str||'');
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed){
    const s = xmur3(seed);
    return sfc32(s(), s(), s(), s());
  }
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const rPick = (arr)=> arr[(r01()*arr.length)|0];

  // ---------- difficulty tuning ----------
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

  // ---------- assets ----------
  const GOOD = ['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑','🍉','🍊','🥕','🥒'];
  const JUNK = ['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭','🍫'];
  const BONUS = ['⭐','💎','⚡'];
  const SHIELDS = ['🛡️','🛡️','🛡️'];
  const BOSS_SHIELD = '🛡️';
  const WEAK = '🎯';

  // ---------- FX layer ----------
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
      filter:drop-shadow(0 10px 26px rgba(0,0,0,.45));
      opacity:1;will-change:transform,opacity;
    `;
    fxLayer.appendChild(el);

    const t0 = nowMs();
    const dur = 520;
    const rise = 34 + (r01()*14);
    function tick(){
      const t = nowMs() - t0;
      const p = Math.min(1, t/dur);
      el.style.top = `${y - rise*p}px`;
      el.style.opacity = String(1 - p);
      el.style.transform = `translate(-50%,-50%) scale(${1 + 0.08*Math.sin(p*Math.PI)})`;
      if(p<1) requestAnimationFrame(tick);
      else el.remove();
    }
    requestAnimationFrame(tick);
  }

  function fxBurst(x,y){
    const n = 10 + ((r01()*6)|0);
    for(let i=0;i<n;i++){
      const dot = DOC.createElement('div');
      dot.style.cssText = `
        position:absolute;left:${x}px;top:${y}px;width:6px;height:6px;
        border-radius:999px;background:rgba(229,231,235,.92);
        opacity:1;transform:translate(-50%,-50%);will-change:transform,opacity;
      `;
      fxLayer.appendChild(dot);

      const ang = r01()*Math.PI*2;
      const sp = 40 + r01()*80;
      const vx = Math.cos(ang)*sp;
      const vy = Math.sin(ang)*sp;
      const t0 = nowMs();
      const dur = 420 + r01()*220;

      function tick(){
        const t = nowMs() - t0;
        const p = Math.min(1, t/dur);
        dot.style.left = `${x + vx*p}px`;
        dot.style.top  = `${y + vy*p - 30*p*p}px`;
        dot.style.opacity = String(1 - p);
        dot.style.transform = `translate(-50%,-50%) scale(${1 - 0.4*p})`;
        if(p<1) requestAnimationFrame(tick);
        else dot.remove();
      }
      requestAnimationFrame(tick);
    }
  }

  // ---------- Coach ----------
  const coach = DOC.createElement('div');
  coach.style.cssText = `
    position:fixed;left:10px;right:10px;
    bottom:calc(env(safe-area-inset-bottom, 0px) + 10px);
    z-index:210;pointer-events:none;display:flex;justify-content:center;
    opacity:0;transform:translateY(6px);transition:opacity .18s ease, transform .18s ease;
  `;
  coach.innerHTML = `
    <div style="
      max-width:760px;width:100%;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(2,6,23,.62);
      color:rgba(229,231,235,.96);
      border-radius:16px;
      padding:10px 12px;
      box-shadow:0 18px 55px rgba(0,0,0,.40);
      backdrop-filter: blur(10px);
      font: 900 13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial;">
      <span style="opacity:.9">🧑‍⚕️ Coach:</span> <span id="coachText">—</span>
    </div>`;
  DOC.body.appendChild(coach);

  const coachText = coach.querySelector('#coachText');
  let coachLatchMs = 0;
  function sayCoach(msg){
    const t = nowMs();
    if(t - coachLatchMs < 3500) return;
    coachLatchMs = t;
    if(coachText) coachText.textContent = String(msg||'');
    coach.style.opacity = '1';
    coach.style.transform = 'translateY(0)';
    setTimeout(()=>{ coach.style.opacity='0'; coach.style.transform='translateY(6px)'; }, 2200);
  }

  // ---------- AI HUD ----------
  function setAIHud(pred){
    try{
      if(!pred) return;
      if(hud.aiRisk && typeof pred.hazardRisk === 'number') hud.aiRisk.textContent = String((+pred.hazardRisk).toFixed(2));
      if(hud.aiHint) hud.aiHint.textContent = String((pred.next5 && pred.next5[0]) || '—');
    }catch(e){}
  }

  // ---------- game state ----------
  const startTimeIso = nowIso();
  let playing = true;
  let tLeft = plannedSec;
  let lastTick = nowMs();

  let paused = false;
  WIN.__GJ_SET_PAUSED__ = (on)=>{ paused = !!on; try{ lastTick = nowMs(); }catch(e){} };

  let score = 0;
  let missTotal = 0, missGoodExpired = 0, missJunkHit = 0;
  let combo = 0, bestCombo = 0;
  let fever = 0, rageOn = false, rageLeft = 0;
  let shield = 0, stormOn = false;

  // RT (GOOD hit only)
  let goodHitCount = 0, rtSum = 0;
  const rtList = [];

  // ACC
  let shots = 0, hits = 0;

  const goal = { name:'Daily', desc:'Hit GOOD 20', cur:0, target:20 };
  const mini = { name:'—', t:0 };

  let bossActive = false, bossHpMax = TUNE.bossHp, bossHp = bossHpMax, bossPhase = 0, bossShieldHp = 5;

  const targets = new Map();
  let idSeq = 1;

  function layerRect(){ return layer.getBoundingClientRect(); }
  function getSpawnSafeLocal(){
    const r = layerRect();
    const pad = 18;
    return { xMin: pad, xMax: r.width-pad, yMin: 180, yMax: Math.max(220, r.height-130), w:r.width, h:r.height };
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

  function median(arr){
    if(!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = (a.length/2)|0;
    return (a.length%2) ? a[m] : (a[m-1]+a[m])/2;
  }

  function accPct(){
    return shots>0 ? Math.round((hits/shots)*1000)/10 : 0;
  }

  // throttled score pulse + battle push
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

    if(progressWrap && progressFill){
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

    setOpponentLine();
    emitScoreEvent(false);
  }

  // end event
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
    const avgRt = goodHitCount>0 ? Math.round(rtSum/goodHitCount) : 0;
    const medRt = Math.round(median(rtList));
    return {
      projectTag: 'GoodJunkVR',
      gameKey: HH_GAME,
      pid,
      zone: HH_CAT,
      gameVersion: 'GoodJunkVR_SAFE_2026-03-04_BATTLE_DUEL',
      device: view,
      runMode,
      diff,
      seed: seedStr,
      reason: String(reason||''),
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
      avgRtGoodMs: avgRt|0,
      medianRtGoodMs: medRt|0,
      bossDefeated: !!(bossActive && bossHp<=0),
      stormOn: !!stormOn,
      rageOn: !!rageOn,
      shieldEnd: shield|0,
      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFromScore(score),
      tieBreakOrder: 'score→acc→miss→medianRT'
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

    // finalize battle
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
    sayCoach(summary.missTotal >= TUNE.lifeMissLimit ? 'โฟกัสของดี + เก็บโล่เพิ่มนะ!' : 'ดีมาก! ✨');
    setHUD();
  }

  // gameplay
  function makeTarget(kind, emoji, ttlSec){
    const id = String(idSeq++);
    const el = DOC.createElement('div');
    el.className = 'gj-target';
    el.textContent = emoji;
    el.dataset.id = id;
    el.dataset.kind = kind;

    const safe = getSpawnSafeLocal();
    const rPad = (view==='mobile') ? 34 : 42;

    const xMin = safe.xMin + rPad;
    const xMax = safe.xMax - rPad;
    const yMin = safe.yMin + rPad;
    const yMax = safe.yMax - rPad;

    const x = xMin + r01()*(Math.max(1, xMax-xMin));
    const y = yMin + r01()*(Math.max(1, yMax-yMin));

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.opacity = '1';

    const drift = (r01()*2-1) * (view==='mobile' ? 16 : 22);
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
      sayCoach('FEVER! คะแนนคูณ 🔥');
    }
  }
  function addShield(){
    shield = clamp(shield + 1, 0, 9);
    sayCoach('ได้โล่! 🛡️');
  }

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

    fxBurst(x,y);
    fxFloatText(x,y-10, `+${add}`, false);

    removeTarget(t.id);
  }

  function onHitJunk(t, x, y){
    hits++;
    if(shield > 0){
      shield--;
      fxBurst(x,y);
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
    let add = rPick([25,30,35]);
    if(rageOn) add = Math.round(add * 1.5);
    score += add;
    fxBurst(x,y);
    fxFloatText(x,y-10, `BONUS +${add}`, false);
    removeTarget(t.id);
  }

  function onHitShield(t, x, y){
    hits++;
    addShield();
    fxBurst(x,y);
    fxFloatText(x,y-10, '+SHIELD', false);
    removeTarget(t.id);
  }

  function onHitBoss(t, x, y){
    if(!bossActive) return;
    hits++;

    if(bossPhase===0){
      bossShieldHp--;
      fxBurst(x,y);
      fxFloatText(x,y-10, 'SHIELD -1', false);
      if(bossShieldHp<=0){ bossPhase=1; sayCoach('โล่แตก! ยิง 🎯'); }
      removeTarget(t.id);
      return;
    }

    const dmg = rageOn ? 4 : 3;
    bossHp = Math.max(0, bossHp - dmg);
    let add = 22 + dmg*6;
    if(rageOn) add = Math.round(add*1.4);
    score += add;
    addFever(9);

    fxBurst(x,y);
    fxFloatText(x,y-10, `BOSS +${add}`, false);
    removeTarget(t.id);

    if(bossHp<=0){
      bossActive = false;
      score += 120;
      addFever(40);
      sayCoach('บอสแพ้แล้ว! 🎉');
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

  function pickTargetAt(x,y, lockPx){
    lockPx = clamp(lockPx ?? 64, 16, 140);
    let best=null, bestD=1e9;
    for(const t of targets.values()){
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const d = Math.hypot(cx-x, cy-y);
      if(d < bestD){ bestD=d; best=t; }
    }
    if(best && bestD <= lockPx) return best;
    return null;
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const r = layerRect();
    const x = r.left + r.width/2;
    const y = r.top  + r.height/2;
    const lockPx = ev?.detail?.lockPx ?? 64;
    const t = pickTargetAt(x,y, lockPx);
    if(t) hitTargetById(t.id, x, y);
    else shots++;
  });

  let spawnAcc = 0;
  function spawnTick(dt){
    stormOn = (tLeft <= Math.min(40, plannedSec*0.45));
    const mult = stormOn ? TUNE.stormMult : 1.0;
    spawnAcc += TUNE.spawnBase * mult * (rageOn ? 1.18 : 1.0) * dt;

    while(spawnAcc >= 1){
      spawnAcc -= 1;

      if(!bossActive && tLeft <= plannedSec*0.35 && tLeft > 6){
        bossActive = true;
        bossHpMax = TUNE.bossHp;
        bossHp = bossHpMax;
        bossPhase = 0;
        bossShieldHp = 5;
        sayCoach('บอสมาแล้ว! แตกโล่ 🛡️');
      }

      let kind='good';
      const p = r01();

      if(bossActive && (r01()<0.22)) kind='boss';
      else if(p < 0.64) kind='good';
      else if(p < 0.86) kind='junk';
      else if(p < 0.94) kind='bonus';
      else kind='shield';

      if(kind==='good') makeTarget('good', rPick(GOOD), TUNE.ttlGood);
      else if(kind==='junk') makeTarget('junk', rPick(JUNK), TUNE.ttlJunk);
      else if(kind==='bonus') makeTarget('bonus', rPick(BONUS), TUNE.ttlBonus);
      else if(kind==='shield') makeTarget('shield', rPick(SHIELDS), 2.6);
      else if(kind==='boss'){
        const emo = (bossPhase===0) ? BOSS_SHIELD : WEAK;
        makeTarget('boss', emo, 2.2);
      }
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
    if(r01() < dt*0.05){
      const type = rPick(['avoid-junk','combo-5','grab-bonus']);
      if(type==='avoid-junk'){ mini.name='No JUNK 6s'; mini.t=6; }
      else if(type==='combo-5'){ mini.name='Combo x5'; mini.t=8; }
      else { mini.name='Grab ⭐'; mini.t=7; }
    }
  }

  function checkEnd(){
    if(tLeft <= 0){ showEnd('time'); return true; }
    if(missTotal >= TUNE.lifeMissLimit){ showEnd('miss-limit'); return true; }
    if(goal.cur >= goal.target && playing){
      goal.target += 10;
      score += 60;
      addFever(18);
      const r = layerRect();
      fxBurst(r.left+r.width/2, r.top+r.height*0.55);
      fxFloatText(r.left+r.width/2, r.top+r.height*0.55, 'GOAL +60', false);
    }
    return false;
  }

  function tick(){
    if(!playing) return;

    // battle gate: wait until RTDB state is playing
    if(battleEnabled && !battleStarted){
      setOpponentLine();
      setHUD();
      requestAnimationFrame(tick);
      return;
    }

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

    spawnTick(dt);
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

  // start battle init early
  initBattleMaybe(pid, HH_GAME).catch(()=>{});

  sayCoach('แตะของดี เลี่ยงของเสีย! 🥦🍎');
  setHUD();
  requestAnimationFrame(tick);
}