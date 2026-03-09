// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION
// FULL PATCH v20260308-GJ-SAFE-BATTLE-READY-FIX
'use strict';

export async function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;
  const AI = cfg.ai || null;
  const SOUND = cfg.sound || null;

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
  let battleRematchState = { roundId:'', requestedBy:'', requestedAtMs:0, votes:{} };
  let battleMatchState = { bestOf:3, winsToChampion:2, wins:{}, champion:'', matchComplete:false };
  let oppDisconnectedWarned = false;
  let lastOppConnected = true;
  let rematchTransitioning = false;
  let championCelebrated = false;

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
        forfeitMs: Number(qs('forfeit','5000'))||5000,
        bestOf: Number(qs('bestOf','3')) || 3
      });
      return battle;
    }catch(e){
      console.warn('[GoodJunk] battle init failed', e);
      return null;
    }
  }

  function showChampionCelebration(text){
    const wrap = DOC.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.zIndex = '500';
    wrap.style.pointerEvents = 'none';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.background = 'radial-gradient(circle at center, rgba(251,191,36,.08), rgba(2,6,23,.18) 52%, rgba(2,6,23,.46) 100%)';

    const box = DOC.createElement('div');
    box.style.padding = '24px 28px';
    box.style.borderRadius = '28px';
    box.style.border = '1px solid rgba(251,191,36,.34)';
    box.style.background = 'rgba(15,23,42,.84)';
    box.style.backdropFilter = 'blur(12px)';
    box.style.boxShadow = '0 24px 80px rgba(0,0,0,.42)';
    box.style.textAlign = 'center';
    box.style.transform = 'scale(.92)';
    box.style.opacity = '0';
    box.style.transition = 'transform .22s ease, opacity .22s ease';
    box.innerHTML = `
      <div style="font-size:18px;font-weight:1000;color:#fde68a;">🏆 CHAMPION</div>
      <div style="margin-top:10px;font-size:42px;font-weight:1000;line-height:1.04;color:#fff;">${text}</div>
      <div style="margin-top:10px;font-size:14px;color:#cbd5e1;">GoodJunk Battle Match Complete</div>
    `;
    wrap.appendChild(box);
    DOC.body.appendChild(wrap);

    requestAnimationFrame(()=>{
      box.style.opacity = '1';
      box.style.transform = 'scale(1)';
    });

    for(let i=0;i<90;i++){
      const conf = DOC.createElement('div');
      conf.textContent = ['✨','🎉','⭐','🏆'][i % 4];
      conf.style.position = 'absolute';
      conf.style.left = `${Math.random() * 100}%`;
      conf.style.top = '-10%';
      conf.style.fontSize = `${18 + Math.random()*18}px`;
      conf.style.opacity = '0.95';
      conf.style.transform = 'translateY(0)';
      conf.style.transition = 'transform 2.2s linear, opacity 2.2s linear';
      wrap.appendChild(conf);
      requestAnimationFrame(()=>{
        conf.style.transform = `translateY(${120 + Math.random()*40}vh) rotate(${Math.random()*220-110}deg)`;
        conf.style.opacity = '0';
      });
    }

    setTimeout(()=>{
      box.style.opacity = '0';
      box.style.transform = 'scale(.96)';
      setTimeout(()=> wrap.remove(), 280);
    }, 2400);
  }

  function writeGameRunAttendanceOnceFactory(){
    let done = false;
    return async function(){
      if(done) return;
      done = true;
      try{
        if(!window.firebase?.database) return;
        const db = window.firebase.database();
        const pidKey = String(pid || nick || 'anon').trim();
        const roomCode = String(qs('room','')).trim().toUpperCase();
        if(!roomCode) return;

        const row = {
          pid: pidKey,
          nick: String(nick || pidKey),
          room: roomCode,
          source: 'game-run',
          view,
          diff,
          time: plannedSec,
          mode,
          atMs: Date.now(),
          atIso: new Date().toISOString()
        };
        const key = `${pidKey}_game-run`.replace(/[.#$/[\]]/g, '_');
        await db.ref(`hha-battle/goodjunk/rooms/${row.room}/attendance/${key}`).set(row);
      }catch(err){
        console.warn('[GoodJunk] write game-run attendance failed', err);
      }
    };
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
      'ai','pro','wait','bestOf'
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

  const coachInline = $('coachInline');
  const coachExplain = $('coachExplain');
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

  const uiView = $('uiView');
  const uiRun  = $('uiRun');
  const uiDiff = $('uiDiff');

  const btnReplay  = $('btnReplay');
  const btnRequestRematch = $('btnRequestRematch');
  const btnAcceptRematch = $('btnAcceptRematch');
  const btnDeclineRematch = $('btnDeclineRematch');
  const btnBackHub = $('btnEndBackHub');

  const endDecision = $('endDecision');
  const endRematchStatus = $('endRematchStatus');

  const cmpYouScore = $('cmpYouScore');
  const cmpOppScore = $('cmpOppScore');
  const cmpYouAcc = $('cmpYouAcc');
  const cmpOppAcc = $('cmpOppAcc');
  const cmpYouMiss = $('cmpYouMiss');
  const cmpOppMiss = $('cmpOppMiss');
  const cmpYouRt = $('cmpYouRt');
  const cmpOppRt = $('cmpOppRt');
  const cmpYouFinish = $('cmpYouFinish');
  const cmpOppFinish = $('cmpOppFinish');

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
  let lastWarningSfxAt = 0;

  function sfx(name, meta){
    try{ SOUND?.play?.(name, meta || {}); }catch(_){}
  }

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
      spawnBase *= 1.10;
      ttlGood   -= 0.12;
      ttlJunk   -= 0.10;
      bossHp    += 4;
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
  const TRICK_POOL = ['combo_rush','bonus_hunt','speed_clear','lane_rush','center_burst'];
  const BOSS_POOL = [
    'normal_boss',
    'shield_boss',
    'storm_boss',
    'phase_shift_boss',
    'decoy_boss',
    'mirror_boss',
    'precision_boss',
    'rage_boss'
  ];

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
    if(combo >= 20) return 'ULTRA COMBO!';
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

  function setDanger(on){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:danger', { detail:{ on:!!on } }));
    }catch(_){}
    if(on){
      const n = nowMs();
      if(n - lastWarningSfxAt > 1600){
        lastWarningSfxAt = n;
        sfx('warning');
      }
    }
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

  function setCoachInline(msg, explain=''){
    if(coachInline) coachInline.textContent = String(msg||'—');
    if(coachExplain && explain) coachExplain.textContent = String(explain);
  }

  function sayCoach(msg, bypass=false, explain=''){
    const t = nowMs();
    if(!bypass && (t - coachLatchMs < 3000)) return;
    coachLatchMs = t;
    if(coachText) coachText.textContent = String(msg||'');
    setCoachInline(msg, explain);
    coach.style.opacity = '1';
    coach.style.transform = 'translateY(0)';
    setTimeout(()=>{
      coach.style.opacity = '0';
      coach.style.transform = 'translateY(6px)';
    }, 2200);
  }

  function setAIHud(pred){
    try{
      if(!pred) return;
      if(hud.aiRisk && typeof pred.hazardRisk === 'number') hud.aiRisk.textContent = String((+pred.hazardRisk).toFixed(2));
      if(hud.aiHint) hud.aiHint.textContent = String((pred.next5 && pred.next5[0]) || '—');
      const explain = pred.explainText || (pred.topFactors||[]).map(x=>x.key).join(', ');
      if(pred.coach) setCoachInline(pred.coach, explain);
    }catch(e){}
  }

  const startTimeIso = nowIso();
  let playing = true;
  let ended = false;
  let tLeft = plannedSec;
  let lastTick = nowMs();

  let paused = false;
  const WAIT_START = (String(qs('wait','0')) === '1');
  if(WAIT_START) paused = true;

  WIN.__GJ_SET_PAUSED__ = function(on){
    paused = !!on;
    lastTick = nowMs();
  };
  WIN.__GJ_START_NOW__ = function(){
    paused = false;
    lastTick = nowMs();
    lastBattleSyncAt = 0;
    writeGameRunAttendanceOnce();
    sayCoach('GO! 🔥', true);
  };

  function rebuildUrlForNextRound(nextRoundId){
    const u = new URL(location.href);
    if(nextRoundId) u.searchParams.set('roundId', String(nextRoundId));
    u.searchParams.set('wait', '1');
    return u.toString();
  }

  function handleBattleRematchReady(detail){
    if(rematchTransitioning) return;
    rematchTransitioning = true;
    championCelebrated = false;
    sayCoach('Rematch พร้อมแล้ว กลับ lobby รอบใหม่...', true);
    try{
      if(endOverlay) endOverlay.style.display = 'none';
    }catch(_){}
    setTimeout(()=>{
      location.href = rebuildUrlForNextRound(detail?.roundId || '');
    }, 900);
  }

  WIN.addEventListener('hha:battle-start', ()=>{ try{ WIN.__GJ_START_NOW__?.(); }catch(e){} });

  WIN.addEventListener('hha:battle-state', (ev)=>{
    try{
      const phase = String(ev?.detail?.phase || '').toLowerCase();
      WIN.__HHA_BATTLE_LAST_PHASE = phase;

      if(phase === 'lobby'){
        if(WAIT_START) paused = true;
        sayCoach('อยู่ใน lobby • รอผู้เล่นพร้อม', true);
      }else if(phase === 'countdown'){
        if(WAIT_START) paused = true;
        sayCoach('Countdown แล้ว เตรียมเริ่ม!', true);
      }else if(phase === 'running'){
        sayCoach('เริ่มเกมแล้ว!', true);
        WIN.__GJ_START_NOW__?.();
      }else if(phase === 'ended'){
        sayCoach('จบรอบ Battle แล้ว', true);
      }
    }catch(_){}
  });

  WIN.addEventListener('hha:battle-rematch-ready', (ev)=>{
    try{
      handleBattleRematchReady(ev?.detail || {});
    }catch(e){
      console.warn('[GoodJunk] rematch-ready handler failed', e);
    }
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

  WIN.addEventListener('hha:battle-rematch-state', (ev)=>{
    try{
      battleRematchState = ev?.detail || { roundId:'', requestedBy:'', requestedAtMs:0, votes:{} };
      renderRematchUI();
      renderRematchEndStatus();

      const meKey = String(battle?.meKey || '');
      const requestedBy = String(battleRematchState?.requestedBy || '');
      const myVote = (battleRematchState?.votes || {})[meKey] || null;
      const others = Object.entries(battleRematchState?.votes || {}).filter(([k]) => k !== meKey);

      if(requestedBy && requestedBy !== meKey && !myVote){
        sayCoach('อีกฝ่ายขอ Rematch — ตอบรับหรือปฏิเสธได้เลย', true);
      }else if(requestedBy && myVote?.accepted && others.length && others.some(([,v]) => v?.accepted)){
        sayCoach('Rematch กำลังจะเริ่มใหม่...', true);
      }else if(requestedBy && myVote?.declined){
        sayCoach('คุณปฏิเสธ Rematch แล้ว', true);
      }
    }catch(_){}
  });

  WIN.addEventListener('hha:battle-match', (ev)=>{
    try{
      battleMatchState = ev?.detail || { bestOf:3, winsToChampion:2, wins:{}, champion:'', matchComplete:false };

      const championKey = String(battleMatchState?.champion || '');
      if(battleMatchState?.matchComplete && championKey && !championCelebrated){
        championCelebrated = true;
        const championName = (battlePlayersState || []).find(p => p.key === championKey)?.nick || championKey;
        showChampionCelebration(championName);
        try{ SOUND?.play?.('win', { big:true }); }catch(_){}
      }
    }catch(err){
      console.warn('[GoodJunk] champion celebration failed', err);
    }
  });

  WIN.addEventListener('hha:battle-champion', (ev)=>{
    try{
      const d = ev?.detail || {};
      const championKey = String(d.champion || '');
      if(championKey && !championCelebrated){
        championCelebrated = true;
        const championName = (battlePlayersState || []).find(p => p.key === championKey)?.nick || championKey;
        showChampionCelebration(championName);
      }
    }catch(err){
      console.warn('[GoodJunk] battle-champion event failed', err);
    }
  });

  function currentPhaseString(){
    try{
      return String(WIN.__HHA_BATTLE_LAST_PHASE || '').toLowerCase();
    }catch(_){ return ''; }
  }

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
  let streakMiss = 0;
  let fever = 0;
  let comebackReady = false;
  const rtList = [];
  const mini = { name:'—', t:0 };

  let bossActive = false;
  let bossHpMax = TUNE.bossHp;
  let bossHp = bossHpMax;
  let bossShieldHp = bossShieldBase();
  let bossStormTimer = 0;
  let bossPhase2 = false;
  let bossRage = false;
  let decoyWeakId = '';
  let mirrorWeakIds = [];
  let precisionWindow = 0;

  const targets = new Map();
  const patternLog = [];
  let spawnSeq = 0;

  let spawnAcc = 0;
  let lanePulse = 0;

  const LS_BEST = `HHA_GJ_BEST:${pid}:${diff}`;
  const LS_BADGES = `HHA_GJ_BADGES:${pid}`;
  const LS_DAILY = `HHA_GJ_DAILY:${pid}:${hhDayKey()}`;
  const LS_STREAK = `HHA_GJ_STREAK:${pid}`;

  function emitPatternEvent(eventName, payload={}){
    try{
      const row = {
        game: HH_GAME,
        pid,
        nick,
        seed: seedStr,
        room: String(qs('room','') || ''),
        mode,
        diff,
        view,
        eventName: String(eventName || ''),
        tGameMs: Math.max(0, Math.round((plannedSec - tLeft) * 1000)),
        seq: ++spawnSeq,
        payload
      };
      patternLog.push(row);
      WIN.dispatchEvent(new CustomEvent('goodjunk:pattern-event', { detail: row }));
    }catch(_){}
  }

  function exportPatternSummary(){
    return {
      seed: seedStr,
      missionSet,
      totalEvents: patternLog.length,
      rows: patternLog
    };
  }

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
    return { x1, x2, y1, y2, W, H, left:r.left, top:r.top };
  }

  function spawnPoint(){
    const s = safeSpawnRect();
    return {
      x: s.x1 + (s.x2 - s.x1) * r01(),
      y: s.y1 + (s.y2 - s.y1) * r01()
    };
  }

  function spawnPointLane(laneIndex=1, total=3){
    const s = safeSpawnRect();
    const frac = (laneIndex + 0.5) / total;
    return {
      x: s.x1 + (s.x2 - s.x1) * frac,
      y: s.y1 + (s.y2 - s.y1) * (0.15 + r01() * 0.7)
    };
  }

  function spawnPointCenterBurst(){
    const s = safeSpawnRect();
    const cx = (s.x1 + s.x2) / 2;
    const cy = (s.y1 + s.y2) / 2;
    return {
      x: cx + (r01() * 180 - 90),
      y: cy + (r01() * 120 - 60)
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
    }else if(k === 'lane_rush'){
      if(missionGoal) missionGoal.textContent = `Lane Rush`;
      if(missionHint) missionHint.textContent = `เป้ามาเป็นเลน เร่งอ่านทางให้ไว`;
    }else if(k === 'center_burst'){
      if(missionGoal) missionGoal.textContent = `Center Burst`;
      if(missionHint) missionHint.textContent = `กลางจอเดือดขึ้น เก็บให้แม่น`;
    }else if(k === 'shield_boss'){
      if(missionGoal) missionGoal.textContent = `BOSS โล่หนา`;
      if(missionHint) missionHint.textContent = `ตีโล่ให้แตกก่อนค่อยยิง HP`;
    }else if(k === 'storm_boss'){
      if(missionGoal) missionGoal.textContent = `BOSS + junk storm`;
      if(missionHint) missionHint.textContent = `ระวัง junk storm ทุกช่วง`;
    }else if(k === 'phase_shift_boss'){
      if(missionGoal) missionGoal.textContent = `BOSS Phase Shift`;
      if(missionHint) missionHint.textContent = `ครึ่งหลังบอสจะเร็วขึ้นและอันตรายขึ้น`;
    }else if(k === 'decoy_boss'){
      if(missionGoal) missionGoal.textContent = `BOSS Decoy`;
      if(missionHint) missionHint.textContent = `ระวัง weak point หลอก เล็งของจริงให้แม่น`;
    }else if(k === 'mirror_boss'){
      if(missionGoal) missionGoal.textContent = `BOSS Mirror`;
      if(missionHint) missionHint.textContent = `เป้าจะออกเป็นคู่กระจก เลือกของจริงให้ถูก`;
    }else if(k === 'precision_boss'){
      if(missionGoal) missionGoal.textContent = `BOSS Precision`;
      if(missionHint) missionHint.textContent = `ยิงเฉพาะช่วง precision window เท่านั้น`;
    }else if(k === 'rage_boss'){
      if(missionGoal) missionGoal.textContent = `BOSS Rage`;
      if(missionHint) missionHint.textContent = `ยิ่งใกล้หมดเวลา บอสจะเดือดและเร็วขึ้น`;
    }else{
      if(missionGoal) missionGoal.textContent = `BOSS ปกติ`;
      if(missionHint) missionHint.textContent = `ยิง weak spot 🎯 เพื่อลด HP`;
    }
  }

  function setBossUI(on){
    if(bossBar) bossBar.style.display = on ? 'block' : 'none';
  }

  function setBossHpUI(){
    if(!bossFill) return;
    const p = bossHpMax ? clamp((bossHp/bossHpMax)*100, 0, 100) : 0;
    bossFill.style.setProperty('--hp', p.toFixed(1)+'%');
    if(bossHint){
      if(bossShieldHp > 0){
        bossHint.textContent = `🛡️ โล่บอสเหลือ ${bossShieldHp}`;
      }else if(missionSet.boss === 'decoy_boss'){
        bossHint.textContent = `🎯 เลือก weak point ให้ถูก! HP ${bossHp}/${bossHpMax}`;
      }else if(missionSet.boss === 'mirror_boss'){
        bossHint.textContent = `🪞 เป้าคู่กระจก • เลือกของจริง HP ${bossHp}/${bossHpMax}`;
      }else if(missionSet.boss === 'precision_boss'){
        bossHint.textContent = precisionWindow > 0
          ? `🎯 PRECISION OPEN! HP ${bossHp}/${bossHpMax}`
          : `⏳ รอ precision window... HP ${bossHp}/${bossHpMax}`;
      }else if(missionSet.boss === 'rage_boss'){
        bossHint.textContent = bossRage
          ? `😡 RAGE MODE! HP ${bossHp}/${bossHpMax}`
          : `🎯 โจมตีบอส! HP ${bossHp}/${bossHpMax}`;
      }else{
        bossHint.textContent = `🎯 โจมตีบอส! HP ${bossHp}/${bossHpMax}`;
      }
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
    if(battleMatchState){
      const bestOfEl = $('battleBestOf');
      const winsToChampionEl = $('battleWinsToChampion');
      const battleStatusEl = $('battleStatus');
      const battleChampionEl = $('battleChampion');
      const myWinsEl = $('battleMyWins');
      const oppWinsEl = $('battleOppWins');

      if(bestOfEl) bestOfEl.textContent = String(Number(battleMatchState.bestOf || 3));
      if(winsToChampionEl) winsToChampionEl.textContent = String(Number(battleMatchState.winsToChampion || 2));
      if(battleStatusEl) battleStatusEl.textContent = battleMatchState.matchComplete ? 'COMPLETE' : 'LIVE';

      const championKey = String(battleMatchState.champion || '');
      const championName = championKey ? ((battlePlayersState || []).find(p => p.key === championKey)?.nick || championKey) : '—';
      if(battleChampionEl) battleChampionEl.textContent = championName;

      if(battle && battle.enabled){
        const meKey = battle.meKey || '';
        const opp = (battlePlayersState || []).find(p => p.key !== meKey);
        if(myWinsEl) myWinsEl.textContent = String(Number((battleMatchState.wins || {})[meKey] || 0));
        if(oppWinsEl) oppWinsEl.textContent = String(Number((battleMatchState.wins || {})[opp?.key] || 0));
      }
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
      score,
      missTotal,
      missGoodExpired,
      missJunkHit,
      shots,
      hits,
      accPct,
      combo,
      comboBest: bestCombo,
      stage,
      tLeft,
      plannedSec,
      bossHp,
      bossHpMax,
      scoreTarget: WIN_TARGET.scoreTarget,
      goodHitCount,
      goodTarget: WIN_TARGET.goodTarget,
      medianRtGoodMs: median(rtList),
      fever,
      shield,
      streakMiss
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

    if(profile.tLeft <= 10){
      spawnMul *= 1.12;
      coach = coach || 'ช่วงท้ายแล้ว เร่งเก็บแต้ม!';
    }

    if(profile.stage === 2 && profile.bossHpMax > 0){
      const ratio = profile.bossHp / profile.bossHpMax;
      if(ratio > 0.55 && profile.tLeft <= 18){
        spawnMul *= 1.08;
      }
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
      fever,
      shield,

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
      patternSummary: exportPatternSummary(),
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

  function fmtMs(v){
    const n = Number(v || 0) || 0;
    return n > 0 ? `${n} ms` : '—';
  }

  function setCmpCell(el, value, win=false){
    if(!el) return;
    el.textContent = value;
    el.classList.toggle('cmp-win', !!win);
  }

  function compareForRule(rule, me, opp){
    if(!me || !opp) return { you:false, opp:false };

    if(rule === 'score'){
      return {
        you: Number(me.score||0) > Number(opp.score||0),
        opp: Number(opp.score||0) > Number(me.score||0)
      };
    }
    if(rule === 'acc'){
      return {
        you: Number(me.acc||0) > Number(opp.acc||0),
        opp: Number(opp.acc||0) > Number(me.acc||0)
      };
    }
    if(rule === 'miss'){
      return {
        you: Number(me.miss||0) < Number(opp.miss||0),
        opp: Number(opp.miss||0) < Number(me.miss||0)
      };
    }
    if(rule === 'medianRT'){
      const my = Number(me.medianRT||0) || 0;
      const op = Number(opp.medianRT||0) || 0;
      if(my <= 0 && op <= 0) return { you:false, opp:false };
      if(my > 0 && op <= 0) return { you:true, opp:false };
      if(op > 0 && my <= 0) return { you:false, opp:true };
      return { you: my < op, opp: op < my };
    }
    if(rule === 'finishMs'){
      return {
        you: Number(me.finishMs||0) < Number(opp.finishMs||0),
        opp: Number(opp.finishMs||0) < Number(me.finishMs||0)
      };
    }
    return { you:false, opp:false };
  }

  function getBattleCompareRows(){
    if(!battleOn || !battle || !battle.enabled) return null;
    const meKey = battle.meKey || '';
    const rows = (battlePlayersState || []).map(p=>({
      key: p.key,
      nick: p.nick || p.pid || p.key,
      score: Number(p.score||0) || 0,
      acc: Number(p.acc||0) || 0,
      miss: Number(p.miss||0) || 0,
      medianRT: Number(p.medianRT||0) || 0,
      finishMs: Number(p.finishMs||0) || 0
    }));
    const me = rows.find(r => r.key === meKey) || null;
    const opp = rows.find(r => r.key !== meKey) || null;
    return { me, opp };
  }

  function renderCompareTable(detail){
    const pack = getBattleCompareRows();
    if(!pack){
      setCmpCell(cmpYouScore, '—');
      setCmpCell(cmpOppScore, '—');
      setCmpCell(cmpYouAcc, '—');
      setCmpCell(cmpOppAcc, '—');
      setCmpCell(cmpYouMiss, '—');
      setCmpCell(cmpOppMiss, '—');
      setCmpCell(cmpYouRt, '—');
      setCmpCell(cmpOppRt, '—');
      setCmpCell(cmpYouFinish, '—');
      setCmpCell(cmpOppFinish, '—');
      return;
    }

    const me = pack.me || {
      nick: nick,
      score: detail.scoreFinal,
      acc: detail.accPct,
      miss: detail.missTotal,
      medianRT: detail.medianRtGoodMs,
      finishMs: detail.finishMs
    };
    const opp = pack.opp || null;

    const winScore = compareForRule('score', me, opp);
    const winAcc = compareForRule('acc', me, opp);
    const winMiss = compareForRule('miss', me, opp);
    const winRt = compareForRule('medianRT', me, opp);
    const winFinish = compareForRule('finishMs', me, opp);

    setCmpCell(cmpYouScore, String(Number(me.score||0)), winScore.you);
    setCmpCell(cmpOppScore, opp ? String(Number(opp.score||0)) : '—', winScore.opp);

    setCmpCell(cmpYouAcc, `${Number(me.acc||0)}%`, winAcc.you);
    setCmpCell(cmpOppAcc, opp ? `${Number(opp.acc||0)}%` : '—', winAcc.opp);

    setCmpCell(cmpYouMiss, String(Number(me.miss||0)), winMiss.you);
    setCmpCell(cmpOppMiss, opp ? String(Number(opp.miss||0)) : '—', winMiss.opp);

    setCmpCell(cmpYouRt, fmtMs(me.medianRT), winRt.you);
    setCmpCell(cmpOppRt, opp ? fmtMs(opp.medianRT) : '—', winRt.opp);

    setCmpCell(cmpYouFinish, fmtMs(me.finishMs), winFinish.you);
    setCmpCell(cmpOppFinish, opp ? fmtMs(opp.finishMs) : '—', winFinish.opp);
  }

  function renderDecision(detail){
    if(!endDecision) return;

    if(!battleOn || !battle || !battle.enabled){
      endDecision.textContent = `โหมดเดี่ยว • เป้าหมาย score ${detail.scoreTarget} หรือชนะบอส`;
      return;
    }

    const rule = String(detail?.battleReason || '').trim();
    const winner = String(detail?.battleWinnerKey || '').trim();
    const meKey = String(detail?.battleMeKey || battle?.meKey || '').trim();

    if(!winner){
      endDecision.textContent = `เสมอ • ลำดับตัดสิน: score → acc → miss → medianRT`;
      return;
    }

    const who = winner === meKey ? 'YOU' : 'OPPONENT';
    endDecision.textContent = `ผู้ชนะ: ${who} • rule=${rule || 'score'} • ลำดับตัดสิน: score → acc → miss → medianRT`;
  }

  function myRematchVote(){
    if(!battle || !battle.enabled) return null;
    const meKey = String(battle.meKey || '');
    return (battleRematchState?.votes || {})[meKey] || null;
  }

  function oppRematchVote(){
    if(!battle || !battle.enabled) return null;
    const meKey = String(battle.meKey || '');
    const votes = battleRematchState?.votes || {};
    const entry = Object.entries(votes).find(([k]) => k !== meKey);
    return entry ? entry[1] : null;
  }

  function renderRematchEndStatus(){
    if(!endRematchStatus) return;

    if(!battleOn || !battle || !battle.enabled){
      endRematchStatus.textContent = 'solo mode';
      return;
    }

    const requestedBy = String(battleRematchState?.requestedBy || '');
    const meKey = String(battle?.meKey || '');
    const myVote = myRematchVote();
    const oppVote = oppRematchVote();

    if(!requestedBy){
      endRematchStatus.textContent = 'ยังไม่มีคำขอ rematch';
      return;
    }

    const parts = [];
    parts.push(`requestedBy=${requestedBy === meKey ? 'you' : 'opponent'}`);
    parts.push(`you=${myVote?.accepted ? 'accepted' : myVote?.declined ? 'declined' : 'pending'}`);
    parts.push(`opponent=${oppVote?.accepted ? 'accepted' : oppVote?.declined ? 'declined' : 'pending'}`);

    endRematchStatus.textContent = parts.join(' • ');
  }

  function renderRematchUI(){
    if(!btnRequestRematch || !btnAcceptRematch || !btnDeclineRematch) return;

    if(!battleOn || !battle || !battle.enabled){
      btnRequestRematch.style.display = '';
      btnAcceptRematch.style.display = 'none';
      btnDeclineRematch.style.display = 'none';
      btnRequestRematch.textContent = 'Replay';
      return;
    }

    const requestedBy = String(battleRematchState?.requestedBy || '');
    const meKey = String(battle?.meKey || '');
    const myVote = myRematchVote();
    const oppVote = oppRematchVote();

    btnRequestRematch.disabled = false;
    btnAcceptRematch.disabled = false;
    btnDeclineRematch.disabled = false;

    btnRequestRematch.style.display = '';
    btnAcceptRematch.style.display = 'none';
    btnDeclineRematch.style.display = 'none';

    if(!requestedBy){
      btnRequestRematch.textContent = 'Request Rematch';
      btnRequestRematch.disabled = false;
      return;
    }

    if(requestedBy === meKey){
      btnRequestRematch.textContent = myVote?.accepted ? 'Waiting Opponent…' : 'Request Rematch';
      btnRequestRematch.disabled = true;
      if(myVote?.declined){
        btnRequestRematch.textContent = 'Declined';
      }
      return;
    }

    if(myVote?.accepted){
      btnRequestRematch.textContent = 'Accepted';
      btnRequestRematch.disabled = true;
      btnDeclineRematch.style.display = '';
      btnDeclineRematch.textContent = 'Decline Instead';
      btnDeclineRematch.disabled = !!oppVote?.accepted;
      return;
    }

    if(myVote?.declined){
      btnRequestRematch.textContent = 'Declined';
      btnRequestRematch.disabled = true;
      btnAcceptRematch.style.display = '';
      btnAcceptRematch.textContent = 'Accept Instead';
      return;
    }

    btnRequestRematch.style.display = 'none';
    btnAcceptRematch.style.display = '';
    btnDeclineRematch.style.display = '';
    btnAcceptRematch.disabled = false;
    btnDeclineRematch.disabled = false;
  }

  async function requestRematchAction(){
    if(!battleOn || !battle || !battle.enabled){
      location.href = new URL(location.href).toString();
      return;
    }
    try{
      const requestedBy = String(battleRematchState?.requestedBy || '');
      const meKey = String(battle.meKey || '');

      if(!requestedBy){
        await battle.requestRematch?.();
        sayCoach('ส่งคำขอ Rematch แล้ว', true);
      }else if(requestedBy === meKey){
        sayCoach('รออีกฝ่ายตอบรับ Rematch', true);
      }
      renderRematchUI();
      renderRematchEndStatus();
    }catch(err){
      console.warn('[GoodJunk] request rematch failed', err);
      sayCoach('ส่งคำขอ Rematch ไม่สำเร็จ', true);
    }
  }

  async function acceptRematchAction(){
    if(!battleOn || !battle || !battle.enabled) return;
    try{
      await battle.acceptRematch?.();
      sayCoach('ตอบรับ Rematch แล้ว', true);
      renderRematchUI();
      renderRematchEndStatus();
    }catch(err){
      console.warn('[GoodJunk] accept rematch failed', err);
      sayCoach('ตอบรับ Rematch ไม่สำเร็จ', true);
    }
  }

  async function declineRematchAction(){
    if(!battleOn || !battle || !battle.enabled) return;
    try{
      await battle.declineRematch?.();
      sayCoach('ปฏิเสธ Rematch แล้ว', true);
      renderRematchUI();
      renderRematchEndStatus();
    }catch(err){
      console.warn('[GoodJunk] decline rematch failed', err);
      sayCoach('ปฏิเสธ Rematch ไม่สำเร็จ', true);
    }
  }

  WIN.__GJ_REMATCH_REQUEST__ = requestRematchAction;
  WIN.__GJ_REMATCH_ACCEPT__ = acceptRematchAction;
  WIN.__GJ_REMATCH_DECLINE__ = declineRematchAction;

  function renderEndOverlay(detail){
    if(!endOverlay) return;
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
    }else{
      if(endTitle) endTitle.textContent = (detail.win) ? 'ชนะแล้ว! 🎉' : 'จบเกม';
      if(endSub) endSub.textContent = `score ${detail.scoreFinal} • acc ${detail.accPct}% • miss ${detail.missTotal} • reason=${detail.reason}`;
    }

    if(endGrade) endGrade.textContent = detail.grade;
    if(endScore) endScore.textContent = String(detail.scoreFinal);
    if(endMiss) endMiss.textContent = String(detail.missTotal);
    if(endTime) endTime.textContent = String(detail.timePlayedSec);

    renderDecision(detail);
    renderCompareTable(detail);
    renderRematchEndStatus();
    renderRematchUI();
    hhInjectCooldownButton({ endOverlayEl:endOverlay, hub:hubUrl, cat:HH_CAT, gameKey:HH_GAME, pid });
  }

  function makeTarget(type, emoji, ttl, point=null){
    const { x, y } = point || spawnPoint();
    const el = DOC.createElement('div');
    el.className = 'gj-target';
    el.dataset.type = type;
    el.textContent = emoji;

    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.fontSize = (type==='bossweak') ? '54px' : (type==='bossdecoy' ? '48px' : '46px');
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

    emitPatternEvent('spawn', {
      type,
      emoji,
      ttl,
      x: Math.round(x),
      y: Math.round(y),
      stage: STAGE_NAME[stage] || 'WARM',
      mission: currentMissionKey()
    });

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

  function enterFever(sec=6){
    fever = Math.max(fever, sec);
    mini.name = 'FEVER 🔥';
    mini.t = Math.max(mini.t, sec);
    sfx('fever');
    sayCoach('FEVER! แต้มคูณช่วงสั้น ๆ 🔥', true);
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
    streakMiss = 0;

    if(t.type === 'good'){
      hits++;
      goodHitCount++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);

      let plus = 12 + Math.min(8, combo);
      if(missionKey === 'green_focus' && GREEN_FOCUS.includes(t.emoji)) plus += 6;
      if(missionKey === 'speed_clear') plus += 4;
      if(missionKey === 'lane_rush') plus += 3;
      if(missionKey === 'center_burst') plus += 3;
      if(fever > 0) plus = Math.round(plus * 1.35);

      score += plus;

      const rt = Math.max(80, Math.round(nowMs() - t.born));
      rtList.push(rt);

      fxState.hitScalePulse = 0.18;
      fxState.comboPulse = Math.min(1, combo / 15);

      if(combo === 8 || combo === 14){
        enterFever(5);
      }

      const milestone = comboMilestoneText(combo);
      if(milestone && (combo === 5 || combo === 10 || combo === 15 || combo === 20)){
        fxState.milestoneText = milestone;
        fxState.milestoneTextLeft = 1.2;
        emitFx();
        sfx('combo', { tier: combo >= 20 ? 4 : combo >= 15 ? 3 : combo >= 10 ? 2 : 1 });
        sayCoach(milestone);
      }else{
        sfx('hit-good');
      }

      emitPatternEvent('hit', { targetType:'good', scorePlus:plus, combo, rt });
      fxFloatText(x,y,`+${plus}`,false);

    }else if(t.type === 'junk'){
      hits++;
      missTotal++;
      missJunkHit++;
      streakMiss++;
      combo = 0;
      let minus = 8;
      if(missionKey === 'avoid_junk') minus = 14;
      if(tLeft <= 10) minus += 2;
      score = Math.max(0, score - minus);
      fxState.screenFlash = 0.16;
      sfx('hit-junk');
      emitPatternEvent('hit', { targetType:'junk', scoreMinus:minus });
      fxFloatText(x,y,`-${minus}`,true);

    }else if(t.type === 'bonus'){
      hits++;
      const bonusScore = fever > 0 ? 34 : 25;
      score += bonusScore;
      sfx('bonus');
      emitPatternEvent('hit', { targetType:'bonus', scorePlus:bonusScore });
      fxFloatText(x,y, `+${bonusScore}`, false);
      mini.name = 'BONUS ⚡';
      mini.t = 6;
      if(r01() < 0.35) enterFever(4);

    }else if(t.type === 'shield'){
      hits++;
      shield = Math.min(9, shield + 1);
      score += 6;
      sfx('shield');
      emitPatternEvent('hit', { targetType:'shield', shield });
      fxFloatText(x,y,'+shield',false);

    }else if(t.type === 'bossdecoy'){
      hits++;
      missTotal++;
      missJunkHit++;
      combo = 0;
      score = Math.max(0, score - 10);
      sfx('hit-junk');
      emitPatternEvent('boss-hit', { boss: missionSet.boss, result:'decoy-object', targetId:id });
      fxFloatText(x,y,'DECOY!',true);

    }else if(t.type === 'bossweak'){
      hits++;
      fxState.bossHitFlash = 0.22;

      const isWrongDecoy =
        (missionSet.boss === 'decoy_boss' && decoyWeakId && id !== decoyWeakId) ||
        (missionSet.boss === 'mirror_boss' && mirrorWeakIds.length && mirrorWeakIds[0] && id !== mirrorWeakIds[0]);

      if(isWrongDecoy){
        missTotal++;
        missJunkHit++;
        combo = 0;
        score = Math.max(0, score - 10);
        sfx('hit-junk');
        emitPatternEvent('boss-hit', {
          boss: missionSet.boss,
          result: 'wrong-target',
          targetId: id
        });
        fxFloatText(x,y,'DECOY!',true);

      }else if(missionSet.boss === 'precision_boss' && precisionWindow <= 0){
        missTotal++;
        missJunkHit++;
        combo = 0;
        score = Math.max(0, score - 8);
        sfx('hit-junk');
        emitPatternEvent('boss-hit', {
          boss: 'precision_boss',
          result: 'outside-window',
          targetId: id
        });
        fxFloatText(x,y,'EARLY!',true);

      }else if(bossShieldHp > 0){
        bossShieldHp--;
        score += 8;
        sfx('boss-hit');
        emitPatternEvent('boss-hit', {
          boss: missionSet.boss,
          result: 'shield-hit',
          shieldLeft: bossShieldHp
        });
        fxFloatText(x,y,'🛡️',false);

      }else{
        let dmg = fever > 0 ? 2 : 1;
        if(missionSet.boss === 'precision_boss' && precisionWindow > 0) dmg += 1;
        if(missionSet.boss === 'rage_boss' && bossRage) dmg += 1;

        bossHp = Math.max(0, bossHp - dmg);
        score += fever > 0 ? 16 : 10;
        sfx('boss-hit');
        emitPatternEvent('boss-hit', {
          boss: missionSet.boss,
          result: 'hp-hit',
          damage: dmg,
          hpLeft: bossHp
        });
        fxFloatText(x,y,fever > 0 ? '💥' : '🎯',false);

        if(missionSet.boss === 'phase_shift_boss' && !bossPhase2 && bossHpMax > 0 && bossHp / bossHpMax <= 0.5){
          bossPhase2 = true;
          enterFever(4);
          sayCoach('บอสเข้า Phase 2 แล้ว! เร็วขึ้น!', true);
          emitPatternEvent('boss-phase', {
            boss: 'phase_shift_boss',
            phase: 2
          });
        }
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
      emitPatternEvent('stage-change', { stage:'TRICK' });
    }

    if(stage===1 && goodHitCount >= WIN_TARGET.goodTarget){
      stage = 2;
      bossActive = true;
      bossPhase2 = false;
      bossRage = false;
      precisionWindow = 0;
      setMissionUI();
      showStageBanner('BOSS BATTLE');
      setBossUI(true);
      bossHpMax = TUNE.bossHp + (
        missionSet.boss === 'shield_boss' ? 4 :
        missionSet.boss === 'phase_shift_boss' ? 3 :
        missionSet.boss === 'rage_boss' ? 4 :
        missionSet.boss === 'precision_boss' ? 2 : 0
      );
      bossHp = bossHpMax;
      bossShieldHp = bossShieldBase() + (missionSet.boss === 'shield_boss' ? 2 : 0);
      bossStormTimer = 0;
      decoyWeakId = '';
      mirrorWeakIds = [];
      setBossHpUI();
      emitPatternEvent('boss-start', {
        boss: missionSet.boss,
        hpMax: bossHpMax,
        shield: bossShieldHp
      });
      sayCoach(
        missionSet.boss === 'decoy_boss' ? 'บอสหลอกมาแล้ว! เลือกเป้าของจริงให้ถูก 🎯' :
        missionSet.boss === 'phase_shift_boss' ? 'บอสจะเร็วขึ้นเมื่อ HP ครึ่งหนึ่ง!' :
        missionSet.boss === 'mirror_boss' ? 'บอสกระจกมาแล้ว! เป้าซ้าย-ขวาจะหลอกกัน!' :
        missionSet.boss === 'precision_boss' ? 'ยิงเฉพาะตอน precision window เปิดเท่านั้น!' :
        missionSet.boss === 'rage_boss' ? 'ยิ่งใกล้หมดเวลา บอสจะเดือดขึ้น!' :
        'บอสมาแล้ว! ตีโล่ก่อนแล้วค่อยยิง 🎯'
      , true);
    }

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
          streakMiss++;
          combo = 0;
          const r = obj.el.getBoundingClientRect();
          emitPatternEvent('expire', { targetType:'good', targetId:id });
          fxFloatText(r.left + r.width/2, r.top + r.height/2, 'ช้า!', true);
        }
        removeTarget(id);
      }
    }
  }

  function spawnLaneRush(adaptive){
    const ttlMul = adaptive.ttlMul || 1;
    lanePulse = (lanePulse + 1) % 3;
    const goodLane = lanePulse;
    for(let i=0;i<3;i++){
      const pt = spawnPointLane(i, 3);
      if(i === goodLane){
        makeTarget('good', rPick(GOOD), (TUNE.ttlGood - 0.1) * ttlMul, pt);
      }else{
        makeTarget('junk', rPick(JUNK), (TUNE.ttlJunk - 0.1) * ttlMul, pt);
      }
    }
    emitPatternEvent('pattern', { pattern:'lane_rush', goodLane });
  }

  function spawnCenterBurst(adaptive){
    const ttlMul = adaptive.ttlMul || 1;
    for(let i=0;i<3;i++){
      makeTarget('good', rPick(GOOD), (TUNE.ttlGood - 0.15) * ttlMul, spawnPointCenterBurst());
    }
    if(r01() < 0.55){
      makeTarget('junk', rPick(JUNK), (TUNE.ttlJunk - 0.05) * ttlMul, spawnPointCenterBurst());
    }
    emitPatternEvent('pattern', { pattern:'center_burst' });
  }

  function spawnBossDecoyPattern(adaptive){
    const ttlMul = adaptive.ttlMul || 1;
    const trueWeak = makeTarget('bossweak', WEAK, 1.45 * ttlMul);
    decoyWeakId = trueWeak.id;

    if(r01() < 0.8){
      const d1 = makeTarget('bossdecoy', WEAK, 1.3 * ttlMul);
      if(r01() < 0.6){
        makeTarget('bossdecoy', WEAK, 1.2 * ttlMul);
      }
      emitPatternEvent('boss-pattern', {
        pattern: 'decoy_boss',
        trueWeakId: trueWeak.id,
        firstDecoyId: d1.id
      });
    }else{
      emitPatternEvent('boss-pattern', {
        pattern: 'decoy_boss',
        trueWeakId: trueWeak.id
      });
    }
  }

  function spawnBossMirrorPattern(adaptive){
    const ttlMul = adaptive.ttlMul || 1;
    mirrorWeakIds = [];

    const s = safeSpawnRect();
    const centerY = s.y1 + (s.y2 - s.y1) * (0.25 + r01() * 0.5);
    const leftX = s.x1 + (s.x2 - s.x1) * 0.32;
    const rightX = s.x1 + (s.x2 - s.x1) * 0.68;

    const trueSideLeft = r01() < 0.5;
    const trueWeak = makeTarget('bossweak', WEAK, 1.45 * ttlMul, {
      x: trueSideLeft ? leftX : rightX,
      y: centerY
    });
    mirrorWeakIds.push(trueWeak.id);

    const mirror = makeTarget('bossdecoy', WEAK, 1.45 * ttlMul, {
      x: trueSideLeft ? rightX : leftX,
      y: centerY
    });
    mirrorWeakIds.push(mirror.id);

    emitPatternEvent('boss-pattern', {
      pattern: 'mirror_boss',
      trueWeakId: trueWeak.id,
      mirrorId: mirror.id
    });
  }

  function openPrecisionWindow(sec=1.4){
    precisionWindow = Math.max(precisionWindow, sec);
    sayCoach('PRECISION WINDOW เปิดแล้ว! ยิงตอนนี้!', true);
    emitPatternEvent('boss-pattern', {
      pattern: 'precision_window_open',
      sec
    });
  }

  function spawnOne(adaptive){
    if(!playing || paused) return;

    const missionKey = currentMissionKey();
    const ttlMul = adaptive.ttlMul || 1;

    if(stage===2){
      if(!bossActive) return;

      let hasWeak = false;
      for(const [,t] of targets){
        if(t.type==='bossweak' || t.type==='bossdecoy'){ hasWeak = true; break; }
      }

      if(!hasWeak){
        if(missionSet.boss === 'decoy_boss'){
          spawnBossDecoyPattern(adaptive);
        }else if(missionSet.boss === 'mirror_boss'){
          spawnBossMirrorPattern(adaptive);
        }else{
          const weakTtl =
            missionSet.boss === 'phase_shift_boss' && bossPhase2 ? 1.15 :
            missionSet.boss === 'rage_boss' && bossRage ? 1.05 :
            1.6;
          const weak = makeTarget('bossweak', WEAK, weakTtl * ttlMul);
          emitPatternEvent('boss-pattern', {
            pattern: missionSet.boss,
            targetId: weak.id,
            ttl: weakTtl * ttlMul
          });
        }
      }else{
        const extraJunkProb =
          missionSet.boss === 'storm_boss' ? 0.82 :
          missionSet.boss === 'phase_shift_boss' && bossPhase2 ? 0.76 :
          missionSet.boss === 'rage_boss' && bossRage ? 0.78 :
          0.60;

        if(r01() < extraJunkProb){
          const ttlJ =
            missionSet.boss === 'phase_shift_boss' && bossPhase2 ? TUNE.ttlJunk - 0.18 :
            missionSet.boss === 'rage_boss' && bossRage ? TUNE.ttlJunk - 0.22 :
            TUNE.ttlJunk;
          const junk = makeTarget('junk', rPick(JUNK), ttlJ * ttlMul);
          emitPatternEvent('boss-pattern', {
            pattern: `${missionSet.boss}-junk`,
            targetId: junk.id,
            ttl: ttlJ * ttlMul
          });
        }
      }
      return;
    }

    if(missionKey === 'lane_rush' && r01() < 0.44){
      spawnLaneRush(adaptive);
      return;
    }
    if(missionKey === 'center_burst' && r01() < 0.38){
      spawnCenterBurst(adaptive);
      return;
    }

    let pShield = (diff==='hard') ? 0.10 : 0.12;
    let pBonus  = 0.12 + (fever > 0 ? 0.04 : 0);
    let pJunk   = (diff==='easy') ? 0.28 : (diff==='hard' ? 0.38 : 0.33);

    pJunk = clamp(pJunk + (adaptive.junkBias || 0), 0.15, 0.58);

    if(missionKey === 'bonus_hunt') pBonus += 0.10;
    if(missionKey === 'avoid_junk') pJunk += 0.06;
    if(tLeft <= 10) pJunk += 0.05;
    if(comebackReady && tLeft <= 20){
      pBonus += 0.04;
      pJunk -= 0.03;
    }

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
      streakMiss++;
      combo = 0;
      emitPatternEvent('miss-shot', { reason:'no-target' });
      setHUD();
    }
  }

  WIN.addEventListener('hha:shoot', ()=>{
    try{
      SOUND?.unlock?.();
      shootAtCenter();
    }catch(e){}
  });

  function getOpponentLead(){
    if(!battleOn || !battle || !battle.enabled) return 0;
    const meKey = battle.meKey || '';
    const me = battlePlayersState.find(p => p.key === meKey);
    const opp = battlePlayersState.find(p => p.key !== meKey);
    const myScore = Number(me?.score ?? score) || 0;
    const opScore = Number(opp?.score ?? 0) || 0;
    return opScore - myScore;
  }

  function maybeComebackBoost(){
    if(!battleOn) return;
    const lead = getOpponentLead();
    if(lead >= 140 && tLeft <= 20){
      comebackReady = true;
      if(fever <= 0) enterFever(5);
      sayCoach('ยังกลับมาได้! ช่วง COMEBACK 🔥', true);
    }else{
      comebackReady = false;
    }
  }

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
    fever = Math.max(0, fever - dt);
    precisionWindow = Math.max(0, precisionWindow - dt);

    const dangerNow =
      tLeft <= 10 ||
      (stage===2 && bossHpMax>0 && bossHp/bossHpMax >= 0.55 && tLeft <= 18);

    setDanger(dangerNow);
    maybeComebackBoost();

    if(tLeft <= 0){
      const win = (score >= WIN_TARGET.scoreTarget) || (stage===2 && bossHp<=0);
      endGame(win ? 'win' : 'time');
      return;
    }

    if(mini.t > 0){
      mini.t = Math.max(0, mini.t - dt);
      if(mini.t <= 0) mini.name = fever > 0 ? 'FEVER 🔥' : '—';
    }else if(fever > 0){
      mini.name = 'FEVER 🔥';
      mini.t = Math.max(1, fever);
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
    }

    if(fever > 0){
      adaptive.spawnMul *= 1.06;
      adaptive.ttlMul *= 0.98;
    }

    if(comebackReady){
      adaptive.spawnMul *= 1.05;
      adaptive.ttlMul *= 1.02;
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
        for(let i=0;i<2;i++){
          const junk = makeTarget('junk', rPick(JUNK), TUNE.ttlJunk * (adaptive.ttlMul || 1));
          emitPatternEvent('boss-pattern', {
            pattern: 'storm_boss-extra-junk',
            targetId: junk.id
          });
        }
      }
    }

    if(stage===2 && missionSet.boss === 'phase_shift_boss' && bossPhase2){
      bossStormTimer += dt;
      if(bossStormTimer >= 3.4){
        bossStormTimer = 0;
        const junk = makeTarget('junk', rPick(JUNK), (TUNE.ttlJunk - 0.16) * (adaptive.ttlMul || 1));
        emitPatternEvent('boss-pattern', {
          pattern: 'phase_shift_phase2_junk',
          targetId: junk.id
        });
      }
    }

    if(stage===2 && missionSet.boss === 'precision_boss'){
      bossStormTimer += dt;
      if(bossStormTimer >= 3.2){
        bossStormTimer = 0;
        openPrecisionWindow(1.25);
      }
    }

    if(stage===2 && missionSet.boss === 'rage_boss' && !bossRage){
      if(tLeft <= 12 || (bossHpMax > 0 && bossHp / bossHpMax <= 0.45)){
        bossRage = true;
        sayCoach('RAGE MODE! ระวังให้ดี!', true);
        emitPatternEvent('boss-phase', {
          boss: 'rage_boss',
          phase: 'rage'
        });
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

    try{
      const profile = getPlayerProfile();
      if(AI && typeof AI.recommend === 'function'){
        const rec = AI.recommend(profile);
        setAIHud(rec);
        if(rec.coach && (!coachInline || coachInline.textContent !== rec.coach)){
          if(rec.hazardRisk >= 0.72 || rec.frustrationRisk >= 0.68 || rec.winChance >= 0.82){
            sayCoach(rec.coach, false, rec.explainText || '');
          }
        }
      }else if(AI && typeof AI.predict === 'function'){
        const pred = AI.predict(profile);
        setAIHud(pred);
      }
    }catch(e){}

    syncBattleScore(false);
    emitFx();
    requestAnimationFrame(tick);
  }

  if(btnReplay){
    btnReplay.onclick = ()=> location.href = new URL(location.href).toString();
  }
  if(btnBackHub){
    btnBackHub.onclick = ()=> location.href = hubUrl;
  }
  if(btnRequestRematch){
    btnRequestRematch.onclick = ()=> requestRematchAction();
  }
  if(btnAcceptRematch){
    btnAcceptRematch.onclick = ()=> acceptRematchAction();
  }
  if(btnDeclineRematch){
    btnDeclineRematch.onclick = ()=> declineRematchAction();
  }

  const writeGameRunAttendanceOnce = writeGameRunAttendanceOnceFactory();

  initBattleMaybe(pid, HH_GAME).then(async (b)=>{
    battle = b || battle;
    WIN.__HHA_BATTLE__ = battle || null;

    try{
      if(battleOn && battle && battle.enabled){
        await battle.setReady?.(true);
        sayCoach('เชื่อม Battle แล้ว • พร้อมเริ่มเกม', true);

        if(!WAIT_START){
          paused = false;
        }else{
          paused = true;
        }

        setHUD();
        renderRematchUI();
        renderRematchEndStatus();
      }
    }catch(err){
      console.warn('[GoodJunk] setReady failed', err);
    }
  }).catch(()=>{
    WIN.__HHA_BATTLE__ = null;
  });

  if(!WAIT_START){
    writeGameRunAttendanceOnce();
  }

  WIN.__GJ_EXPORT_PATTERN_SUMMARY__ = ()=> exportPatternSummary();

  setMissionUI();
  setHUD();
  renderRematchEndStatus();
  renderRematchUI();

  if(WAIT_START){
    sayCoach('BATTLE/RACE: รอเริ่มพร้อมกัน… ⏳', true);
  }else{
    sayCoach('พร้อมแล้ว! ยิงของดี 🥦', true);
    if(battleOn){
      paused = false;
    }
  }

  requestAnimationFrame(tick);
}