// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION
// PATCH v20260307-BATTLE-END-EXPLAIN-FULL
'use strict';

export async function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;
  const AI = cfg.ai || null;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  function $(id){ return DOC.getElementById(id); }

  const mode = String(qs('mode', cfg.mode || 'solo')).toLowerCase();
  const battleOn = (String(qs('battle','0')) === '1') || (mode === 'battle');

  let battle = null;
  let battleEndedInfo = null;
  let battlePlayersState = [];
  let oppDisconnectedWarned = false;
  let lastOppConnected = true;

  async function initBattleMaybe(pid, gameKey){
    if(!battleOn) return null;
    try{
      const mod = await import('../vr/battle-rtdb.js');
      battle = await mod.initBattle({
        enabled: true,
        room: qs('room', ''),
        pid,
        nick: qs('nick', pid),
        gameKey,
        autostartMs: Number(qs('autostart','3000'))||3000,
        forfeitMs: Number(qs('forfeit','5000'))||5000
      });
      return battle;
    }catch(e){
      console.warn('[GoodJunk] battle init failed', e);
      return null;
    }
  }

  function hhDayKey(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function hhLsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  function hhLsSet(k,v){ try{ localStorage.setItem(k,v); }catch(_){ } }

  function loadJson(k, fallback){
    try{
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    }catch(_){ return fallback; }
  }
  function saveJson(k, v){
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){}
  }

  function hhCooldownDone(cat, gameKey, pid){
    const day = hhDayKey();
    const p = String(pid||'anon').trim()||'anon';
    const c = String(cat||'nutrition').toLowerCase();
    const g = String(gameKey||'unknown').toLowerCase();
    const kNew = `HHA_COOLDOWN_DONE:${c}:${g}:${p}:${day}`;
    const kOld = `HHA_COOLDOWN_DONE:${c}:${p}:${day}`;
    return (hhLsGet(kNew)==='1') || (hhLsGet(kOld)==='1');
  }

  function hhBuildCooldownUrl({ hub, nextAfterCooldown, cat, gameKey, pid }){
    const gate = new URL('../warmup-gate.html', location.href);
    gate.searchParams.set('gatePhase','cooldown');
    gate.searchParams.set('cat', String(cat||'nutrition'));
    gate.searchParams.set('theme', String(gameKey||'unknown'));
    gate.searchParams.set('pid', String(pid||'anon'));
    if(hub) gate.searchParams.set('hub', String(hub));
    gate.searchParams.set('next', String(nextAfterCooldown || hub || '../hub.html'));

    const sp = new URL(location.href).searchParams;
    [
      'run','diff','time','seed','studyId','phase','conditionGroup','view','log',
      'planSeq','planDay','planSlot','planMode','planSlots','planIndex','autoNext',
      'plannedGame','finalGame','zone','cdnext','grade',
      'battle','room','autostart','forfeit','mode',
      'ai','pro','wait','debugStart'
    ].forEach(k=>{
      const v = sp.get(k);
      if(v!=null && v!=='') gate.searchParams.set(k, v);
    });

    return gate.toString();
  }

  function hhInjectCooldownButton({ endOverlayEl, hub, cat, gameKey, pid }){
    if(!endOverlayEl) return;
    const cdDone = hhCooldownDone(cat, gameKey, pid);
    if(cdDone) return;

    const sp = new URL(location.href).searchParams;
    const cdnext = sp.get('cdnext') || '';
    const nextAfterCooldown = cdnext || hub || '../hub.html';
    const url = hhBuildCooldownUrl({ hub, nextAfterCooldown, cat, gameKey, pid });

    const panel = endOverlayEl.querySelector('.panel') || endOverlayEl;
    let row = panel.querySelector('.hh-end-actions');
    if(!row){
      row = DOC.createElement('div');
      row.className = 'hh-end-actions';
      row.style.display='flex';
      row.style.gap='10px';
      row.style.flexWrap='wrap';
      row.style.justifyContent='center';
      row.style.marginTop='12px';
      row.style.paddingTop='10px';
      row.style.borderTop='1px solid rgba(148,163,184,.16)';
      panel.appendChild(row);
    }
    if(row.querySelector('[data-hh-cd="1"]')) return;

    const btn = DOC.createElement('button');
    btn.type='button';
    btn.dataset.hhCd = '1';
    btn.textContent='🧘 ไป Cooldown';
    btn.className = 'btn cooldown';
    btn.addEventListener('click', ()=> location.href = url);
    row.appendChild(btn);
  }

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
  function makeRng(seedStr){
    const seed = xmur3(seedStr);
    return sfc32(seed(), seed(), seed(), seed());
  }

  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const rPick = (arr)=> arr[(r01()*arr.length)|0];

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

  const bossBar = $('bossBar');
  const bossFill = $('bossFill');
  const bossHint = $('bossHint');

  const missionTitle = $('missionTitle');
  const missionGoal  = $('missionGoal');
  const missionHint  = $('missionHint');
  const missionFill  = $('missionFill');

  const endOverlay = $('endOverlay');
  const endTitle = $('endTitle');
  const endSub = $('endSub');
  const endGrade = $('endGrade');
  const endScore = $('endScore');
  const endMiss  = $('endMiss');
  const endTime  = $('endTime');
  const endDecision = $('endDecision');
  const endCompare  = $('endCompare');

  const uiView = $('uiView');
  const uiRun  = $('uiRun');
  const uiDiff = $('uiDiff');

  if(!layer){
    console.warn('[GoodJunk] Missing #gj-layer');
    return;
  }

  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);

  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const nick = String(cfg.nick || qs('nick', pid)).trim() || pid;
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const HH_CAT = 'nutrition';
  const HH_GAME = 'goodjunk';

  const RESEARCH_MODE = String(qs('research','0')) === '1';
  const AI_PLAY_ADAPT = !RESEARCH_MODE && String(qs('ai','1')) !== '0';

  let lastBattleSyncAt = 0;
  const BATTLE_SYNC_EVERY_MS = 220;

  function currentAccPct(){
    return shots ? Math.round((hits/shots)*100) : 0;
  }

  function median(arr){
    if(!arr || !arr.length) return 0;
    const a = [...arr].sort((x,y)=>x-y);
    const m = Math.floor(a.length/2);
    return a.length % 2 ? a[m] : Math.round((a[m-1]+a[m])/2);
  }

  function currentMedianRtGoodMs(){
    return median(rtList);
  }

  function currentFinishMs(){
    return Math.max(0, Math.round((plannedSec - tLeft) * 1000));
  }

  function syncBattleScore(force=false){
    if(!battle || !battle.enabled || !battleOn) return;
    const now = nowMs();
    if(!force && (now - lastBattleSyncAt < BATTLE_SYNC_EVERY_MS)) return;
    lastBattleSyncAt = now;

    try{
      battle.syncScore?.({
        score,
        accPct: currentAccPct(),
        missTotal: missTotal,
        medianRtGoodMs: currentMedianRtGoodMs(),
        finishMs: currentFinishMs()
      });
    }catch(e){
      console.warn('[GoodJunk] battle syncScore failed', e);
    }
  }

  initBattleMaybe(pid, HH_GAME).then(async (b)=>{
    battle = b || battle;
    WIN.__HHA_BATTLE__ = battle || null;

    try{
      if(battle && battle.enabled){
        const role = typeof battle.getRole === 'function' ? battle.getRole() : 'player';

        if(role === 'player'){
          await battle.setReady?.(true);

          try{
            if(hud.aiHint) hud.aiHint.textContent = 'พร้อมแล้ว • รอผู้เล่น/เริ่มรอบ';
            if(hud.aiRisk) hud.aiRisk.textContent = 'ready';
          }catch(_){}

          sayCoach('พร้อมแล้ว! กำลังรอเริ่มรอบ Battle…', true);
        }else if(role === 'spectator'){
          try{
            if(hud.aiHint) hud.aiHint.textContent = 'spectator';
            if(hud.aiRisk) hud.aiRisk.textContent = 'watch';
          }catch(_){}
          sayCoach('ห้องนี้เต็มหรือเริ่มไปแล้ว • เข้าชมแบบ spectator', true);
        }
      }
    }catch(e){
      console.warn('[GoodJunk] battle setReady failed', e);
    }
  }).catch(()=>{
    WIN.__HHA_BATTLE__ = null;
  });

  if(uiView) uiView.textContent = view;
  if(uiRun)  uiRun.textContent  = runMode;
  if(uiDiff) uiDiff.textContent = diff;

  let stage = 0;
  const STAGE_NAME = ['WARM', 'TRICK', 'BOSS'];

  const WIN_TARGET = (function(){
    let scoreTarget = 650;
    let goodTarget  = 40;
    if(diff==='easy'){ scoreTarget = 520; goodTarget = 32; }
    else if(diff==='hard'){ scoreTarget = 780; goodTarget = 46; }
    if(view==='cvr' || view==='vr'){ scoreTarget = Math.round(scoreTarget * 0.96); }
    return { scoreTarget, goodTarget };
  })();

  const PRO = (diff==='hard' && String(qs('pro','0'))==='1');

  function bossShieldBase(){
    if(diff==='easy') return 4;
    if(diff==='hard') return PRO ? 7 : 6;
    return 5;
  }

  const TUNE = (function(){
    let spawnBase = 0.78;
    let lifeMissLimit = 10;
    let ttlGood = 2.6;
    let ttlJunk = 2.9;
    let ttlBonus = 2.4;
    let bossHp = 18;

    if(diff==='easy'){
      spawnBase = 0.68;
      lifeMissLimit = 14;
      ttlGood = 3.0;
      ttlJunk = 3.2;
      bossHp = 16;
    }else if(diff==='hard'){
      spawnBase = 0.95;
      lifeMissLimit = 8;
      ttlGood = 2.2;
      ttlJunk = 2.4;
      bossHp = 22;
    }
    if(view==='cvr' || view==='vr'){
      ttlGood += 0.15;
      ttlJunk += 0.15;
    }
    if(PRO){
      spawnBase *= 1.08;
      ttlGood   -= 0.10;
      ttlJunk   -= 0.08;
      bossHp    += 3;
      lifeMissLimit = Math.max(6, lifeMissLimit - 1);
    }
    return { spawnBase, lifeMissLimit, ttlGood, ttlJunk, ttlBonus, bossHp };
  })();

  const GOOD = ['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑','🍉','🍊','🥕','🥒'];
  const JUNK = ['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭','🍫'];
  const BONUS = ['⭐','💎','⚡'];
  const SHIELDS = ['🛡️','🛡️','🛡️'];
  const GREEN_FOCUS = ['🥦','🥬','🥒'];
  const WEAK = '🎯';

  const WARM_POOL = ['good_only','avoid_junk','green_focus'];
  const TRICK_POOL = ['combo_rush','bonus_hunt','speed_clear'];
  const BOSS_POOL = ['normal_boss','shield_boss','storm_boss'];

  const missionSet = {
    warm: rPick(WARM_POOL),
    trick: rPick(TRICK_POOL),
    boss: rPick(BOSS_POOL)
  };

  const fxLayer = DOC.createElement('div');
  fxLayer.style.position = 'fixed';
  fxLayer.style.inset = '0';
  fxLayer.style.pointerEvents = 'none';
  fxLayer.style.zIndex = '260';
  DOC.body.appendChild(fxLayer);

  const fxState = {
    screenFlash: 0,
    hitScalePulse: 0,
    comboPulse: 0,
    nearEndPulse: 0,
    bossHitFlash: 0,
    stageBannerLeft: 0,
    stageBannerText: '',
    milestoneTextLeft: 0,
    milestoneText: ''
  };

  function emitFx(){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:solo-fx', {
        detail: {
          stageText: fxState.stageBannerText,
          stageOn: fxState.stageBannerLeft > 0,
          milestoneText: fxState.milestoneText,
          milestoneOn: fxState.milestoneTextLeft > 0
        }
      }));
    }catch(_){}
  }

  function comboMilestoneText(combo){
    if(combo >= 15) return 'MEGA COMBO!';
    if(combo >= 10) return 'AWESOME!';
    if(combo >= 5) return 'NICE COMBO!';
    return '';
  }

  function showStageBanner(text){
    fxState.stageBannerText = text;
    fxState.stageBannerLeft = 1.6;
    emitFx();
  }

  function fxFloatText(x,y,text,isBad){
    const el = DOC.createElement('div');
    el.textContent = text;
    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.font = '900 18px/1.1 system-ui, -apple-system, Segoe UI, Roboto, Arial';
    el.style.letterSpacing = '.2px';
    el.style.color = isBad ? 'rgba(255,110,110,.96)' : 'rgba(229,231,235,.98)';
    el.style.textShadow = '0 10px 30px rgba(0,0,0,.55)';
    el.style.filter = 'drop-shadow(0 10px 26px rgba(0,0,0,.45))';
    fxLayer.appendChild(el);

    const t0 = nowMs();
    const dur = 520;
    const rise = 34 + (r01()*14);
    function tick(){
      const p = Math.min(1, (nowMs() - t0)/dur);
      el.style.top = `${y - rise*p}px`;
      el.style.opacity = String(1 - p);
      el.style.transform = `translate(-50%,-50%) scale(${1 + 0.08*Math.sin(p*3.14)})`;
      if(p<1) requestAnimationFrame(tick);
      else el.remove();
    }
    requestAnimationFrame(tick);
  }

  function fxBurst(x,y){
    const n = 10 + ((r01()*6)|0);
    for(let i=0;i<n;i++){
      const dot = DOC.createElement('div');
      dot.style.position = 'absolute';
      dot.style.left = `${x}px`;
      dot.style.top  = `${y}px`;
      dot.style.width = '6px';
      dot.style.height = '6px';
      dot.style.borderRadius = '999px';
      dot.style.background = 'rgba(229,231,235,.92)';
      dot.style.opacity = '1';
      dot.style.transform = 'translate(-50%,-50%)';
      fxLayer.appendChild(dot);

      const ang = r01()*Math.PI*2;
      const sp = 40 + r01()*80;
      const vx = Math.cos(ang)*sp;
      const vy = Math.sin(ang)*sp;
      const t0 = nowMs();
      const dur = 420 + r01()*220;

      function tick(){
        const p = Math.min(1, (nowMs() - t0)/dur);
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

  const coach = DOC.createElement('div');
  coach.style.position = 'fixed';
  coach.style.left = '10px';
  coach.style.right = '10px';
  coach.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + 10px)`;
  coach.style.zIndex = '210';
  coach.style.pointerEvents = 'none';
  coach.style.display = 'flex';
  coach.style.justifyContent = 'center';
  coach.style.opacity = '0';
  coach.style.transform = 'translateY(6px)';
  coach.style.transition = 'opacity .18s ease, transform .18s ease';
  coach.innerHTML = `
    <div style="
      max-width:760px; width:100%;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(2,6,23,.62);
      color:rgba(229,231,235,.96);
      border-radius:16px;
      padding:10px 12px;
      box-shadow:0 18px 55px rgba(0,0,0,.40);
      backdrop-filter: blur(10px);
      font: 900 13px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;">
      <span style="opacity:.9">🧑‍⚕️ Coach:</span> <span id="coachText">—</span>
    </div>`;
  DOC.body.appendChild(coach);

  const coachText = coach.querySelector('#coachText');
  let coachLatchMs = 0;

  function sayCoach(msg, bypass=false){
    const t = nowMs();
    if(!bypass && (t - coachLatchMs < 3500)) return;
    coachLatchMs = t;
    if(coachText) coachText.textContent = String(msg||'');
    coach.style.opacity = '1';
    coach.style.transform = 'translateY(0)';
    setTimeout(()=>{
      coach.style.opacity = '0';
      coach.style.transform = 'translateY(6px)';
    }, 2200);
  }

  function coachTop2(missGoodExpired, missJunkHit, shots, acc){
    const facts = [];
    if(missJunkHit >= 2) facts.push({k:'โดนของเสีย', v: missJunkHit});
    if(missGoodExpired >= 2) facts.push({k:'ช้า ของดีหาย', v: missGoodExpired});
    if(shots >= 10 && acc <= 55) facts.push({k:'ยิงพลาดเยอะ', v: (100-acc)});
    facts.sort((a,b)=> (b.v||0)-(a.v||0));
    const top = facts.slice(0,2).map(x=>x.k);
    return top.length ? `ระวัง: ${top.join(' + ')}` : null;
  }

  function setAIHud(pred){
    try{
      if(!pred) return;
      if(hud.aiRisk && typeof pred.hazardRisk === 'number') hud.aiRisk.textContent = String((+pred.hazardRisk).toFixed(2));
      if(hud.aiHint) hud.aiHint.textContent = String((pred.next5 && pred.next5[0]) || '—');
    }catch(e){}
  }

  const startTimeIso = nowIso();
  let playing = true;
  let ended = false;
  let tLeft = plannedSec;
  let lastTick = nowMs();

  let paused = false;
  const WAIT_START = battleOn ? true : (String(qs('wait','0')) === '1');
  if(WAIT_START) paused = true;

  WIN.__GJ_SET_PAUSED__ = function(on){
    paused = !!on;
    lastTick = nowMs();
  };
  WIN.__GJ_START_NOW__ = function(){
    paused = false;
    lastTick = nowMs();
    lastBattleSyncAt = 0;
    sayCoach('GO! 🔥', true);
  };

  WIN.addEventListener('hha:battle-start', ()=>{ try{ WIN.__GJ_START_NOW__?.(); }catch(e){} });
  WIN.addEventListener('hha:battle-state', (ev)=>{
    try{
      const phase = String(ev?.detail?.phase || '').toLowerCase();
      if(phase === 'running' && paused) WIN.__GJ_START_NOW__?.();
    }catch(e){}
  });

  WIN.addEventListener('hha:battle-countdown', (ev)=>{
    try{
      const leftMs = Number(ev?.detail?.leftMs || 0) || 0;
      const sec = Math.max(0, Math.ceil(leftMs / 1000));
      if(hud.aiHint) hud.aiHint.textContent = `เริ่มใน ${sec}s`;
      if(hud.aiRisk) hud.aiRisk.textContent = 'countdown';

      if(leftMs <= 0 && paused){
        setTimeout(()=>{
          try{ WIN.__GJ_START_NOW__?.(); }catch(_){}
        }, 80);
      }
    }catch(_){}
  });

  WIN.addEventListener('hha:battle-state', (ev)=>{
    try{
      const phase = String(ev?.detail?.phase || '').toLowerCase();

      if(phase === 'lobby'){
        if(hud.aiHint) hud.aiHint.textContent = 'รอผู้เล่นพร้อม';
        if(hud.aiRisk) hud.aiRisk.textContent = 'lobby';
      }else if(phase === 'countdown'){
        if(hud.aiRisk) hud.aiRisk.textContent = 'countdown';
      }else if(phase === 'running'){
        if(hud.aiHint) hud.aiHint.textContent = 'เริ่มแล้ว!';
        if(hud.aiRisk) hud.aiRisk.textContent = 'running';
      }else if(phase === 'ended'){
        if(hud.aiHint) hud.aiHint.textContent = 'จบรอบ';
        if(hud.aiRisk) hud.aiRisk.textContent = 'ended';
      }
    }catch(_){}
  });

  WIN.addEventListener('hha:battle-players', (ev)=>{
    try{
      const players = Array.isArray(ev?.detail?.players) ? ev.detail.players : [];
      battlePlayersState = players;

      if(!battle || !battle.enabled) return;
      const meKey = battle.meKey || '';
      const opp = players.find(p => p.key !== meKey) || null;

      const oppConnected = !!(opp && opp.connected !== false);
      if(lastOppConnected && !oppConnected && currentPhaseString() === 'running'){
        if(!oppDisconnectedWarned){
          oppDisconnectedWarned = true;
          sayCoach('⚠️ คู่แข่งหลุดการเชื่อมต่อ', true);
          if(hud.aiHint) hud.aiHint.textContent = 'คู่แข่งหลุด';
          if(hud.aiRisk) hud.aiRisk.textContent = 'disconnect';
        }
      }
      if(!lastOppConnected && oppConnected){
        oppDisconnectedWarned = false;
        sayCoach('✅ คู่แข่งกลับมาแล้ว', true);
      }
      lastOppConnected = oppConnected;
    }catch(e){}
  });

  WIN.addEventListener('hha:battle-ended', (ev)=>{
    try{
      battleEndedInfo = ev?.detail || null;
      if(playing && !ended){
        sayCoach('Battle จบรอบแล้ว', true);
      }
    }catch(_){}
  });

  function currentPhaseString(){
    try{
      return String(WIN.__HHA_BATTLE_LAST_PHASE || '').toLowerCase();
    }catch(_){ return ''; }
  }

  WIN.addEventListener('hha:battle-state', (ev)=>{
    try{
      WIN.__HHA_BATTLE_LAST_PHASE = String(ev?.detail?.phase || '').toLowerCase();
    }catch(_){}
  });

  let score = 0;
  let missTotal = 0;
  let missGoodExpired = 0;
  let missJunkHit = 0;
  let combo = 0;
  let bestCombo = 0;
  let shield = 0;
  let goodHitCount = 0;
  let shots = 0;
  let hits  = 0;
  const rtList = [];
  const mini = { name:'—', t:0 };

  let bossActive = false;
  let bossHpMax = TUNE.bossHp;
  let bossHp = bossHpMax;
  let bossShieldHp = bossShieldBase();
  let bossStormTimer = 0;

  const targets = new Map();
  let spawnAcc = 0;

  const LS_BEST = `HHA_GJ_BEST:${pid}:${diff}`;
  const LS_BADGES = `HHA_GJ_BADGES:${pid}`;
  const LS_DAILY = `HHA_GJ_DAILY:${pid}:${hhDayKey()}`;
  const LS_STREAK = `HHA_GJ_STREAK:${pid}`;

  function layerRect(){ return layer.getBoundingClientRect(); }

  function safeSpawnRect(){
    const r = layerRect();
    const W = r.width, H = r.height;
    const topPad = 120 + ((view==='cvr'||view==='vr') ? 20 : 0);
    const bottomPad = 120 + ((view==='cvr'||view==='vr') ? 10 : 0);
    const leftPad = 18, rightPad = 18;

    const x1 = r.left + leftPad;
    const x2 = r.left + Math.max(leftPad+10, W - rightPad);
    const y1 = r.top + Math.min(H-60, topPad);
    const y2 = r.top + Math.max(y1+60, H - bottomPad);
    return { x1, x2, y1, y2 };
  }

  function spawnPoint(){
    const s = safeSpawnRect();
    return {
      x: s.x1 + (s.x2 - s.x1) * r01(),
      y: s.y1 + (s.y2 - s.y1) * r01()
    };
  }

  function currentMissionKey(){
    if(stage===0) return missionSet.warm;
    if(stage===1) return missionSet.trick;
    return missionSet.boss;
  }

  function setMissionUI(){
    const k = currentMissionKey();
    if(missionTitle) missionTitle.textContent = STAGE_NAME[stage] || 'WARM';

    if(k === 'good_only'){
      if(missionGoal) missionGoal.textContent = `เก็บของดี ${WIN_TARGET.goodTarget} ชิ้น`;
      if(missionHint) missionHint.textContent = `เก็บของดีให้ครบ • อย่าเผลอโดนของขยะ`;
    }else if(k === 'avoid_junk'){
      if(missionGoal) missionGoal.textContent = `เก็บของดี + หลีกเลี่ยงขยะ`;
      if(missionHint) missionHint.textContent = `โดน junk จะเสียแต้มแรงขึ้น`;
    }else if(k === 'green_focus'){
      if(missionGoal) missionGoal.textContent = `เน้นผักสีเขียวโบนัส`;
      if(missionHint) missionHint.textContent = `🥦 🥬 🥒 ได้แต้มเพิ่ม`;
    }else if(k === 'combo_rush'){
      if(missionGoal) missionGoal.textContent = `ทำคอมโบ 8+`;
      if(missionHint) missionHint.textContent = `เร่งคอมโบเพื่อโบนัสแต้ม`;
    }else if(k === 'bonus_hunt'){
      if(missionGoal) missionGoal.textContent = `ล่า BONUS`;
      if(missionHint) missionHint.textContent = `โบนัสเกิดบ่อยขึ้นช่วงนี้`;
    }else if(k === 'speed_clear'){
      if(missionGoal) missionGoal.textContent = `สปีดเคลียร์`;
      if(missionHint) missionHint.textContent = `ของดีหายไว แต่แต้มมากขึ้น`;
    }else if(k === 'shield_boss'){
      if(missionGoal) missionGoal.textContent = `BOSS โล่หนา`;
      if(missionHint) missionHint.textContent = `ตีโล่ให้แตกก่อนค่อยยิง HP`;
    }else if(k === 'storm_boss'){
      if(missionGoal) missionGoal.textContent = `BOSS + junk storm`;
      if(missionHint) missionHint.textContent = `ระวัง junk storm ทุกช่วง`;
    }else{
      if(missionGoal) missionGoal.textContent = `BOSS ปกติ`;
      if(missionHint) missionHint.textContent = `ยิง weak spot 🎯 เพื่อลด HP`;
    }
  }

  function setBossUI(on){
    if(bossBar) bossBar.style.display = on ? 'flex' : 'none';
  }

  function setBossHpUI(){
    if(!bossFill) return;
    const p = bossHpMax ? clamp((bossHp/bossHpMax)*100, 0, 100) : 0;
    bossFill.style.setProperty('--hp', p.toFixed(1)+'%');
    if(bossHint){
      bossHint.textContent = bossShieldHp>0 ? `🛡️ โล่บอสเหลือ ${bossShieldHp}` : `🎯 โจมตีบอส! HP ${bossHp}/${bossHpMax}`;
    }
  }

  function gradeFromScore(){
    const acc = shots ? (hits/shots)*100 : 0;
    if(score>=WIN_TARGET.scoreTarget && acc>=80 && missTotal<=2) return 'S';
    if(score>=WIN_TARGET.scoreTarget && acc>=70 && missTotal<=4) return 'A';
    if(score>=WIN_TARGET.scoreTarget*0.85) return 'B';
    if(score>=WIN_TARGET.scoreTarget*0.70) return 'C';
    return 'D';
  }

  function setHUD(){
    if(hud.score) hud.score.textContent = String(score|0);
    if(hud.time) hud.time.textContent = String(Math.ceil(tLeft));
    if(hud.miss) hud.miss.textContent = String(missTotal|0);
    if(hud.grade) hud.grade.textContent = gradeFromScore();
    if(hud.goal) hud.goal.textContent = (stage===2 ? 'BOSS' : stage===1 ? 'TRICK' : 'WARM');
    if(hud.goalCur) hud.goalCur.textContent = String(goodHitCount|0);
    if(hud.goalTarget) hud.goalTarget.textContent = String(WIN_TARGET.goodTarget|0);
    if(hud.goalDesc) hud.goalDesc.textContent = currentMissionKey();
    if(hud.mini) hud.mini.textContent = mini.name || '—';
    if(hud.miniTimer) hud.miniTimer.textContent = String(Math.ceil(mini.t||0));
    if(missionFill){
      const p = (stage===2)
        ? (bossHpMax ? (1-(bossHp/bossHpMax))*100 : 0)
        : clamp((goodHitCount/WIN_TARGET.goodTarget)*100, 0, 100);
      missionFill.style.setProperty('--p', p.toFixed(1)+'%');
    }
  }

  function grantBadges(detail){
    const badges = loadJson(LS_BADGES, {
      firstClear:false,
      noMiss:false,
      sharpShooter:false,
      comboMaster:false
    });

    if(detail.win && !badges.firstClear) badges.firstClear = true;
    if(detail.win && detail.missTotal === 0) badges.noMiss = true;
    if(detail.accPct >= 90) badges.sharpShooter = true;
    if((detail.comboBest || 0) >= 12) badges.comboMaster = true;

    saveJson(LS_BADGES, badges);
    return badges;
  }

  function saveBest(detail){
    const prev = loadJson(LS_BEST, null);
    if(!prev || (detail.scoreFinal > (prev.scoreFinal||0))){
      saveJson(LS_BEST, detail);
    }
  }

  function grantDaily(detail){
    const daily = loadJson(LS_DAILY, {
      played:false,
      clear:false,
      noMiss:false,
      score900:false
    });

    daily.played = true;
    if(detail.win) daily.clear = true;
    if(detail.missTotal === 0) daily.noMiss = true;
    if(detail.scoreFinal >= 900) daily.score900 = true;

    saveJson(LS_DAILY, daily);
    return daily;
  }

  function updateStreak(){
    const today = hhDayKey();
    const prev = loadJson(LS_STREAK, { lastDay:'', count:0 });

    if(prev.lastDay === today) return prev;
    prev.count = (prev.count || 0) + 1;
    prev.lastDay = today;
    saveJson(LS_STREAK, prev);
    return prev;
  }

  function getPlayerProfile(){
    const accPct = shots ? Math.round((hits/shots)*100) : 0;
    return {
      accPct,
      missTotal,
      missGoodExpired,
      missJunkHit,
      comboBest: bestCombo,
      score,
      stage,
      tLeft
    };
  }

  function aiDirector(profile){
    let spawnMul = 1;
    let junkBias = 0;
    let goodBias = 0;
    let ttlMul = 1;
    let coach = null;

    if(profile.accPct < 55 || profile.missTotal >= 7){
      spawnMul = 0.92;
      junkBias = -0.06;
      goodBias = +0.06;
      ttlMul = 1.08;
      coach = 'ค่อย ๆ เล็งของดีทีละชิ้น';
    }else if(profile.accPct > 85 && profile.missTotal <= 2){
      spawnMul = 1.08;
      junkBias = +0.05;
      goodBias = -0.03;
      ttlMul = 0.96;
      coach = 'เก่งมาก ลองเร่งคอมโบต่อ!';
    }

    return { spawnMul, junkBias, goodBias, ttlMul, coach };
  }

  function buildEndDetail(reason){
    const accPct = shots ? Math.round((hits/shots)*100) : 0;
    const grade = gradeFromScore();
    const timePlayedSec = Math.round(plannedSec - tLeft);
    const medianRtGoodMs = median(rtList);

    const detail = {
      game: HH_GAME,
      gameKey: HH_GAME,
      cat: HH_CAT,
      pid,
      nick,
      seed: seedStr,
      mode,
      run: runMode,
      diff,
      view,
      pro: PRO ? 1 : 0,

      score,
      scoreFinal: score,
      scoreTarget: WIN_TARGET.scoreTarget,
      goodTarget: WIN_TARGET.goodTarget,

      shots,
      hits,
      accPct,
      missTotal,
      missGoodExpired,
      missJunkHit,
      comboBest: bestCombo,

      goodHitCount,
      stageFinal: STAGE_NAME[stage] || 'WARM',
      bossCleared: bossHp <= 0,
      bossHpLeft: bossHp,
      bossHpMax,

      grade,
      reason,
      win: reason === 'win',

      timePlayedSec,
      timePlannedSec: plannedSec,
      timeLeftSec: Math.max(0, Math.ceil(tLeft)),
      finishMs: Math.max(0, Math.round(timePlayedSec * 1000)),

      medianRtGoodMs,
      hub: hubUrl,
      battle: battleOn ? 1 : 0,
      room: qs('room',''),
      battleRoundId: (battle && battle.roundId) ? String(battle.roundId) : '',
      studyId: String(qs('studyId','') || ''),
      phase: String(qs('phase','') || ''),
      conditionGroup: String(qs('conditionGroup','') || ''),
      planDay: String(qs('planDay','') || ''),
      planSlot: String(qs('planSlot','') || ''),
      planMode: String(qs('planMode','') || ''),
      zone: String(qs('zone','nutrition') || 'nutrition'),

      missionSet,

      startTimeIso,
      endTimeIso: nowIso()
    };

    detail.badges = grantBadges(detail);
    detail.daily = grantDaily(detail);
    detail.streakCount = (updateStreak().count || 0);

    saveBest(detail);
    return detail;
  }

  function applyBattleResultToOverlay(detail){
    if(!battleOn || !battleEndedInfo || !battle || !battle.enabled) return detail;

    const meKey = battle.meKey || '';
    const winner = String(battleEndedInfo.winner || '');
    const reason = String(battleEndedInfo.reason || 'battle');

    detail.battleWinnerKey = winner;
    detail.battleReason = reason;
    detail.battleMeKey = meKey;
    detail.battleResults = Array.isArray(battleEndedInfo.results) ? battleEndedInfo.results : [];

    if(!winner){
      detail.reason = `battle-tie:${reason}`;
      detail.win = false;
      return detail;
    }

    if(winner === meKey){
      detail.reason = `battle-win:${reason}`;
      detail.win = true;
    }else{
      detail.reason = `battle-lose:${reason}`;
      detail.win = false;
    }
    return detail;
  }

  function buildBattleExplain(detail){
    if(!battleOn) return { decision:'โหมดเดี่ยว', compare:'—' };

    const rule = String(detail?.battleReason || '').toLowerCase();
    const meKey = String(detail?.battleMeKey || '');
    const rows = Array.isArray(detail?.battleResults) ? detail.battleResults : [];
    const me = rows.find(r => String(r.key || '') === meKey) || null;
    const opp = rows.find(r => String(r.key || '') !== meKey) || null;

    let decision = 'ระบบตัดสินผลจาก Battle';
    if(rule === 'score') decision = 'ตัดสินจากคะแนนรวม (Score มากกว่าชนะ)';
    else if(rule === 'acc') decision = 'ตัดสินจากความแม่นยำ (Accuracy มากกว่าชนะ)';
    else if(rule === 'miss') decision = 'ตัดสินจากจำนวนพลาด (Miss น้อยกว่าชนะ)';
    else if(rule === 'medianrt') decision = 'ตัดสินจากความเร็วตอบสนอง (Median RT น้อยกว่าชนะ)';
    else if(rule === 'forfeit') decision = 'ตัดสินจากการหลุด/ออกจากห้องของอีกฝ่าย';
    else if(rule === 'debugsolo') decision = 'รอบทดสอบ debug คนเดียว';
    else if(rule === 'tie') decision = 'ผลเสมอ';
    else if(rule) decision = `ตัดสินจากกติกา: ${rule}`;

    let compare = 'ไม่มีข้อมูลคู่แข่ง';
    if(me && opp){
      compare =
        `คุณ ${Number(me.score||0)} คะแนน, acc ${Number(me.acc||0)}%, miss ${Number(me.miss||0)}, medianRT ${Number(me.medianRT||0)} ms • ` +
        `คู่แข่ง ${Number(opp.score||0)} คะแนน, acc ${Number(opp.acc||0)}%, miss ${Number(opp.miss||0)}, medianRT ${Number(opp.medianRT||0)} ms`;
    }else if(me){
      compare =
        `คุณ ${Number(me.score||0)} คะแนน, acc ${Number(me.acc||0)}%, miss ${Number(me.miss||0)}, medianRT ${Number(me.medianRT||0)} ms`;
    }

    return { decision, compare };
  }

  function buildCloudRoundReport(detail){
    return {
      source: 'goodjunk.safe.js',
      room: String(detail?.room || qs('room','') || '').trim().toUpperCase(),
      roundId: String(detail?.battleRoundId || detail?.roundId || ''),
      pid: String(detail?.pid || pid || 'anon'),
      nick: String(detail?.nick || nick || pid),
      mode: String(detail?.mode || mode || 'solo'),
      diff: String(detail?.diff || diff || 'normal'),
      view: String(detail?.view || view || 'mobile'),

      studyId: String(detail?.studyId || ''),
      phase: String(detail?.phase || ''),
      conditionGroup: String(detail?.conditionGroup || ''),
      planDay: String(detail?.planDay || ''),
      planSlot: String(detail?.planSlot || ''),
      planMode: String(detail?.planMode || ''),
      zone: String(detail?.zone || 'nutrition'),

      score: Number(detail?.scoreFinal ?? detail?.score ?? 0) || 0,
      accPct: Number(detail?.accPct ?? 0) || 0,
      missTotal: Number(detail?.missTotal ?? 0) || 0,
      medianRtGoodMs: Number(detail?.medianRtGoodMs ?? 0) || 0,

      grade: String(detail?.grade || '-'),
      reason: String(detail?.reason || '-'),
      win: !!detail?.win,

      shots: Number(detail?.shots ?? 0) || 0,
      hits: Number(detail?.hits ?? 0) || 0,
      comboBest: Number(detail?.comboBest ?? 0) || 0,
      goodHitCount: Number(detail?.goodHitCount ?? 0) || 0,

      stageFinal: String(detail?.stageFinal || ''),
      scoreTarget: Number(detail?.scoreTarget ?? 0) || 0,
      goodTarget: Number(detail?.goodTarget ?? 0) || 0,
      timePlayedSec: Number(detail?.timePlayedSec ?? 0) || 0,
      timePlannedSec: Number(detail?.timePlannedSec ?? 0) || 0,
      timeLeftSec: Number(detail?.timeLeftSec ?? 0) || 0,

      bossCleared: !!detail?.bossCleared,
      bossHpLeft: Number(detail?.bossHpLeft ?? 0) || 0,
      bossHpMax: Number(detail?.bossHpMax ?? 0) || 0,

      battleWinnerKey: String(detail?.battleWinnerKey || ''),
      battleReason: String(detail?.battleReason || ''),
      battleMeKey: String(detail?.battleMeKey || ''),

      startTimeIso: String(detail?.startTimeIso || ''),
      endTimeIso: String(detail?.endTimeIso || '')
    };
  }

  function endGame(reason){
    if(!playing || ended) return;
    ended = true;
    playing = false;

    for(const [,t] of targets){
      try{ t.el.remove(); }catch(e){}
    }
    targets.clear();

    let detail = buildEndDetail(reason);
    detail = applyBattleResultToOverlay(detail);

    try{
      battle?.syncScore?.({
        score: detail.scoreFinal,
        accPct: detail.accPct,
        missTotal: detail.missTotal,
        medianRtGoodMs: detail.medianRtGoodMs,
        finishMs: detail.finishMs
      });
    }catch(e){
      console.warn('[GoodJunk] final battle syncScore failed', e);
    }

    try{
      hhLsSet(`HHA_LAST_SUMMARY:${HH_GAME}:${pid}`, JSON.stringify(detail));
      hhLsSet('HHA_LAST_SUMMARY', JSON.stringify(detail));
    }catch(e){}

    try{
      if(battle && battle.enabled && typeof battle.saveRoundReport === 'function'){
        const cloudRow = buildCloudRoundReport(detail);
        battle.saveRoundReport(cloudRow).catch(()=>{});
      }
    }catch(e){
      console.warn('[GoodJunk] cloud saveRoundReport failed', e);
    }

    try{
      WIN.dispatchEvent(new CustomEvent('hha:end', { detail }));
    }catch(e){}

    if(endOverlay){
      endOverlay.style.display = 'flex';

      if(battleOn && battleEndedInfo && battle && battle.enabled){
        const meKey = battle.meKey || '';
        const winner = String(battleEndedInfo.winner || '');
        const rule = String(battleEndedInfo.reason || 'battle');

        if(!winner){
          if(endTitle) endTitle.textContent = 'เสมอ Battle';
          if(endSub) endSub.textContent = `tie • rule=${rule} • score ${detail.scoreFinal} • acc ${detail.accPct}% • miss ${detail.missTotal}`;
        }else if(winner === meKey){
          if(endTitle) endTitle.textContent = 'ชนะ Battle! ⚔️';
          if(endSub) endSub.textContent = `winner=you • rule=${rule} • score ${detail.scoreFinal} • acc ${detail.accPct}% • miss ${detail.missTotal}`;
        }else{
          if(endTitle) endTitle.textContent = 'แพ้ Battle';
          if(endSub) endSub.textContent = `winner=opponent • rule=${rule} • score ${detail.scoreFinal} • acc ${detail.accPct}% • miss ${detail.missTotal}`;
        }

        const exp = buildBattleExplain(detail);
        if(endDecision) endDecision.textContent = exp.decision;
        if(endCompare) endCompare.textContent = exp.compare;
      }else{
        if(endTitle) endTitle.textContent = (reason==='win') ? 'ชนะแล้ว! 🎉' : 'จบเกม';
        if(endSub) endSub.textContent = `score ${detail.scoreFinal} • acc ${detail.accPct}% • miss ${detail.missTotal} • reason=${detail.reason}`;
        if(endDecision) endDecision.textContent = 'โหมดเดี่ยว';
        if(endCompare) endCompare.textContent = 'ไม่มีคู่แข่งในรอบนี้';
      }

      if(endGrade) endGrade.textContent = detail.grade;
      if(endScore) endScore.textContent = String(detail.scoreFinal);
      if(endMiss) endMiss.textContent = String(detail.missTotal);
      if(endTime) endTime.textContent = String(detail.timePlayedSec);
      hhInjectCooldownButton({ endOverlayEl:endOverlay, hub:hubUrl, cat:HH_CAT, gameKey:HH_GAME, pid });
    }else{
      alert(`จบเกม: ${detail.reason} (score ${detail.scoreFinal})`);
    }
  }

  function makeTarget(type, emoji, ttl){
    const { x, y } = spawnPoint();
    const el = DOC.createElement('div');
    el.className = 'gj-target';
    el.dataset.type = type;
    el.textContent = emoji;

    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.fontSize = (type==='bossweak') ? '52px' : '46px';
    el.style.lineHeight = '1';
    el.style.userSelect = 'none';
    el.style.cursor = 'pointer';
    el.style.filter = 'drop-shadow(0 18px 40px rgba(0,0,0,.45))';
    el.style.textShadow = '0 14px 40px rgba(0,0,0,.55)';
    el.style.pointerEvents = 'auto';
    el.style.transition = 'transform .08s ease';

    layer.appendChild(el);

    const id = String(Date.now()) + '_' + String(Math.random()).slice(2);
    const born = nowMs();
    const t = { id, type, emoji, ttl, born, el };
    targets.set(id, t);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      hitTarget(id);
    }, { passive:false });

    return t;
  }

  function removeTarget(id){
    const t = targets.get(id);
    if(!t) return;
    targets.delete(id);
    try{ t.el.remove(); }catch(e){}
  }

  function hitTarget(id){
    const t = targets.get(id);
    if(!t || !playing || paused) return;

    const br = t.el.getBoundingClientRect();
    const x = br.left + br.width/2;
    const y = br.top + br.height/2;

    shots++;
    fxBurst(x,y);

    const missionKey = currentMissionKey();

    if(t.type === 'good'){
      hits++;
      goodHitCount++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);

      let plus = 12 + Math.min(8, combo);
      if(missionKey === 'green_focus' && GREEN_FOCUS.includes(t.emoji)) plus += 6;
      if(missionKey === 'speed_clear') plus += 4;

      score += plus;

      const rt = Math.max(80, Math.round(nowMs() - t.born));
      rtList.push(rt);

      fxState.hitScalePulse = 0.18;
      fxState.comboPulse = Math.min(1, combo / 15);

      const milestone = comboMilestoneText(combo);
      if(milestone && (combo === 5 || combo === 10 || combo === 15)){
        fxState.milestoneText = milestone;
        fxState.milestoneTextLeft = 1.2;
        emitFx();
        sayCoach(milestone);
      }

      fxFloatText(x,y,`+${plus}`,false);
    }else if(t.type === 'junk'){
      hits++;
      missTotal++;
      missJunkHit++;
      combo = 0;
      let minus = 8;
      if(missionKey === 'avoid_junk') minus = 14;
      score = Math.max(0, score - minus);
      fxState.screenFlash = 0.16;
      fxFloatText(x,y,`-${minus}`,true);
    }else if(t.type === 'bonus'){
      hits++;
      score += 25;
      fxFloatText(x,y,'+25',false);
      mini.name = 'BONUS ⚡';
      mini.t = 6;
    }else if(t.type === 'shield'){
      hits++;
      shield = Math.min(9, shield + 1);
      score += 6;
      fxFloatText(x,y,'+shield',false);
    }else if(t.type === 'bossweak'){
      hits++;
      fxState.bossHitFlash = 0.22;
      if(bossShieldHp > 0){
        bossShieldHp--;
        score += 8;
        fxFloatText(x,y,'🛡️',false);
      }else{
        bossHp = Math.max(0, bossHp - 1);
        score += 10;
        fxFloatText(x,y,'🎯',false);
      }
      setBossHpUI();
      if(bossHp <= 0) return endGame('win');
    }

    removeTarget(id);

    if(stage===0 && goodHitCount >= Math.ceil(WIN_TARGET.goodTarget*0.55)){
      stage = 1;
      setMissionUI();
      showStageBanner('TRICK MODE');
      sayCoach('เข้า TRICK! ทำคอมโบ 8+ 🔥');
    }
    if(stage===1 && goodHitCount >= WIN_TARGET.goodTarget){
      stage = 2;
      bossActive = true;
      setMissionUI();
      showStageBanner('BOSS BATTLE');
      setBossUI(true);
      bossHpMax = TUNE.bossHp + (missionSet.boss === 'shield_boss' ? 4 : 0);
      bossHp = bossHpMax;
      bossShieldHp = bossShieldBase() + (missionSet.boss === 'shield_boss' ? 2 : 0);
      bossStormTimer = 0;
      setBossHpUI();
      sayCoach('บอสมาแล้ว! ตีโล่ก่อนแล้วค่อยยิง 🎯');
    }

    const acc = shots ? Math.round((hits/shots)*100) : 0;
    const explain = coachTop2(missGoodExpired, missJunkHit, shots, acc);
    if(explain) sayCoach(explain);

    setHUD();

    if(missTotal >= TUNE.lifeMissLimit){
      endGame('miss-limit');
    }
  }

  function expireTargets(){
    const t = nowMs();
    for(const [id,obj] of targets){
      const age = (t - obj.born) / 1000;
      if(age >= obj.ttl){
        if(obj.type === 'good'){
          missTotal++;
          missGoodExpired++;
          combo = 0;
          const r = obj.el.getBoundingClientRect();
          fxFloatText(r.left + r.width/2, r.top + r.height/2, 'ช้า!', true);
        }
        removeTarget(id);
      }
    }
  }

  function spawnOne(adaptive){
    if(!playing || paused) return;

    const missionKey = currentMissionKey();
    const ttlMul = adaptive.ttlMul || 1;

    if(stage===2){
      if(!bossActive) return;
      let hasWeak = false;
      for(const [,t] of targets){ if(t.type==='bossweak') { hasWeak = true; break; } }
      if(!hasWeak){
        makeTarget('bossweak', WEAK, 1.6 * ttlMul);
      }else{
        if(missionSet.boss === 'storm_boss'){
          if(r01() < 0.75) makeTarget('junk', rPick(JUNK), TUNE.ttlJunk * ttlMul);
        }else{
          if(r01() < 0.55) makeTarget('junk', rPick(JUNK), TUNE.ttlJunk * ttlMul);
        }
      }
      return;
    }

    let pShield = (diff==='hard') ? 0.10 : 0.12;
    let pBonus  = 0.12;
    let pJunk   = (diff==='easy') ? 0.28 : (diff==='hard' ? 0.38 : 0.33);

    pJunk = clamp(pJunk + (adaptive.junkBias || 0), 0.15, 0.55);

    if(missionKey === 'bonus_hunt') pBonus += 0.10;
    if(missionKey === 'avoid_junk') pJunk += 0.06;

    const r = r01();
    if(r < pShield){
      makeTarget('shield', rPick(SHIELDS), 2.4 * ttlMul);
    }else if(r < pShield + pBonus){
      makeTarget('bonus', rPick(BONUS), TUNE.ttlBonus * ttlMul);
    }else if(r < pShield + pBonus + pJunk){
      makeTarget('junk', rPick(JUNK), TUNE.ttlJunk * ttlMul);
    }else{
      let emoji = rPick(GOOD);
      if(missionKey === 'green_focus' && r01() < 0.38){
        emoji = rPick(GREEN_FOCUS);
      }
      makeTarget('good', emoji, (missionKey === 'speed_clear' ? (TUNE.ttlGood - 0.25) : TUNE.ttlGood) * ttlMul);
    }
  }

  function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }

  function shootAtCenter(){
    if(!playing || paused) return;
    const r = layerRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;

    let best=null, bestD=Infinity;
    for(const [id,t] of targets){
      const br = t.el.getBoundingClientRect();
      const tx = br.left + br.width/2;
      const ty = br.top  + br.height/2;
      const d = dist2(cx,cy,tx,ty);
      if(d < bestD){
        bestD = d;
        best = id;
      }
    }
    if(best) hitTarget(best);
    else{
      shots++;
      combo = 0;
      setHUD();
    }
  }

  WIN.addEventListener('hha:shoot', ()=>{
    try{ shootAtCenter(); }catch(e){}
  });

  function tick(){
    const t = nowMs();
    let dt = (t - lastTick) / 1000;
    lastTick = t;
    dt = clamp(dt, 0, 0.05);

    if(!playing) return;

    if(paused){
      setHUD();
      emitFx();
      requestAnimationFrame(tick);
      return;
    }

    tLeft = Math.max(0, tLeft - dt);
    if(tLeft <= 0){
      const win = (score >= WIN_TARGET.scoreTarget) || (stage===2 && bossHp<=0);
      endGame(win ? 'win' : 'time');
      return;
    }

    if(mini.t > 0){
      mini.t = Math.max(0, mini.t - dt);
      if(mini.t <= 0) mini.name = '—';
    }

    if(tLeft <= 10) fxState.nearEndPulse = Math.min(1, fxState.nearEndPulse + dt * 2.2);
    else fxState.nearEndPulse = Math.max(0, fxState.nearEndPulse - dt * 2.2);

    fxState.screenFlash = Math.max(0, fxState.screenFlash - dt * 1.8);
    fxState.hitScalePulse = Math.max(0, fxState.hitScalePulse - dt * 1.8);
    fxState.comboPulse = Math.max(0, fxState.comboPulse - dt * 0.8);
    fxState.bossHitFlash = Math.max(0, fxState.bossHitFlash - dt * 1.8);
    fxState.stageBannerLeft = Math.max(0, fxState.stageBannerLeft - dt);
    fxState.milestoneTextLeft = Math.max(0, fxState.milestoneTextLeft - dt);

    let adaptive = { spawnMul:1, junkBias:0, goodBias:0, ttlMul:1, coach:null };
    if(AI_PLAY_ADAPT){
      adaptive = aiDirector(getPlayerProfile());
      if(adaptive.coach) setAIHud({ hazardRisk: 0.5, next5: [adaptive.coach] });
    }

    spawnAcc += dt * (1 / (TUNE.spawnBase / adaptive.spawnMul));
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne(adaptive);
    }

    if(stage===2 && missionSet.boss === 'storm_boss'){
      bossStormTimer += dt;
      if(bossStormTimer >= 4){
        bossStormTimer = 0;
        for(let i=0;i<2;i++) makeTarget('junk', rPick(JUNK), TUNE.ttlJunk * (adaptive.ttlMul || 1));
      }
    }

    expireTargets();
    setHUD();

    if(stage===2){
      setBossUI(true);
      setBossHpUI();
    }else{
      setBossUI(false);
    }

    if(AI && typeof AI.predict === 'function'){
      try{
        const accPct = shots ? Math.round((hits/shots)*100) : 0;
        const pred = AI.predict({
          score, missTotal, missGoodExpired, missJunkHit, shots, hits, accPct, stage, tLeft
        });
        setAIHud(pred);
      }catch(e){}
    }

    syncBattleScore(false);

    emitFx();
    requestAnimationFrame(tick);
  }

  setMissionUI();
  setHUD();

  if(WAIT_START) sayCoach('BATTLE: รอผู้เล่นพร้อม / countdown… ⏳', true);
  else sayCoach('พร้อมแล้ว! ยิงของดี 🥦', true);

  requestAnimationFrame(tick);
}