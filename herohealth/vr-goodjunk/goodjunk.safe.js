// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (FX + Coach + mission 3-stage UI + PRO + race wait + battle start sync)
// FULL v20260305a-SAFE-SAFERECT-FULLGAME
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;
  const AI = cfg.ai || null;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  function $(id){ return DOC.getElementById(id); }

  // ---------- MODE ----------
  const mode = String(qs('mode', cfg.mode || 'solo')).toLowerCase();
  const battleOn = (String(qs('battle','0')) === '1') || (mode === 'battle');

  // ---------- BATTLE (optional) ----------
  let battle = null;
  async function initBattleMaybe(pid, gameKey){
    const on = battleOn;
    if(!on) return null;
    try{
      const mod = await import('../vr/battle-rtdb.js');
      battle = await mod.initBattle({
        enabled: true,
        room: qs('room', ''),
        pid,
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

  // ---------- COOL DOWN BUTTON (PER-GAME DAILY) ----------
  function hhDayKey(){
    const d=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(2,'0');
    const dd=String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function hhLsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  function hhLsSet(k,v){ try{ localStorage.setItem(k,v); }catch(_){ } }

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
      'ai','pro','wait'
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
    btn.textContent='ไป Cooldown (ครั้งแรกของวันนี้)';
    btn.className = 'btn primary';
    btn.style.border='1px solid rgba(34,197,94,.30)';
    btn.style.background='rgba(34,197,94,.14)';
    btn.style.color='rgba(229,231,235,.96)';
    btn.style.borderRadius='14px';
    btn.style.padding='10px 12px';
    btn.style.fontWeight='1000';
    btn.style.cursor='pointer';
    btn.style.minHeight='42px';
    btn.addEventListener('click', ()=> location.href = url);
    row.appendChild(btn);
  }

  // ---------- deterministic RNG ----------
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

  if(!layer){
    console.warn('[GoodJunk] Missing #gj-layer');
    return;
  }

  // ---------- view/run/diff/time ----------
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);

  // hub / pid / cat / gameKey
  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const HH_CAT = 'nutrition';
  const HH_GAME = 'goodjunk';

  // ✅ Battle: init + auto-ready
  initBattleMaybe(pid, HH_GAME).then((b)=>{
    battle = b || battle;
    if(battle && battle.enabled){
      try{ battle.setReady?.(true); }catch(e){}
    }
  }).catch(()=>{});

  try{
    if(uiView) uiView.textContent = view;
    if(uiRun)  uiRun.textContent  = runMode;
    if(uiDiff) uiDiff.textContent = diff;
  }catch(e){}

  // ---------- SOLO WIN targets + PRO switch ----------
  let stage = 0; // 0=Warm, 1=Trick, 2=Boss
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

  const TUNE = (function(){
    let spawnBase = 0.78;     // spawns/sec
    let lifeMissLimit = 10;   // game over
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
  const WEAK = '🎯';

  // ---------- FX layer ----------
  const fxLayer = DOC.createElement('div');
  fxLayer.style.position = 'fixed';
  fxLayer.style.inset = '0';
  fxLayer.style.pointerEvents = 'none';
  fxLayer.style.zIndex = '260';
  DOC.body.appendChild(fxLayer);

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
    el.style.opacity = '1';
    el.style.willChange = 'transform, opacity';
    fxLayer.appendChild(el);

    const t0 = nowMs();
    const dur = 520;
    const rise = 34 + (r01()*14);
    function tick(){
      const t = nowMs() - t0;
      const p = Math.min(1, t/dur);
      const yy = y - rise * (p);
      const sc = 1 + 0.08*Math.sin(p*3.14);
      el.style.top = `${yy}px`;
      el.style.opacity = String(1 - p);
      el.style.transform = `translate(-50%,-50%) scale(${sc})`;
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
      dot.style.willChange = 'transform, opacity';
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
        const xx = x + vx*p;
        const yy = y + vy*p - 30*p*p;
        dot.style.left = `${xx}px`;
        dot.style.top  = `${yy}px`;
        dot.style.opacity = String(1 - p);
        dot.style.transform = `translate(-50%,-50%) scale(${1 - 0.4*p})`;
        if(p<1) requestAnimationFrame(tick);
        else dot.remove();
      }
      requestAnimationFrame(tick);
    }
  }

  // ---------- Coach (rate-limited) ----------
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
      -webkit-backdrop-filter: blur(10px);
      font: 900 13px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;">
      <span style="opacity:.9">🧑‍⚕️ Coach:</span> <span id="coachText">—</span>
    </div>`;
  DOC.body.appendChild(coach);

  const coachText = coach.querySelector('#coachText');
  let coachLatchMs = 0;

  function sayCoach(msg){
    const t = nowMs();
    if(t - coachLatchMs < 4500) return;
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
    if(!top.length) return null;
    return `ระวัง: ${top.join(' + ')}`;
  }

  // ---------- gameplay state ----------
  const startTimeIso = nowIso();
  let playing = true;
  let tLeft = plannedSec;
  let lastTick = nowMs();

  // ✅ wait-start (battle/race)
  let paused = false;
  const WAIT_START = (String(qs('wait','0')) === '1');
  if(WAIT_START) paused = true;

  WIN.__GJ_SET_PAUSED__ = function(on){
    paused = !!on;
    try{ lastTick = nowMs(); }catch(e){}
  };
  WIN.__GJ_START_NOW__ = function(){
    try{
      paused = false;
      lastTick = nowMs();
      sayCoach('GO! 🔥');
    }catch(e){}
  };

  WIN.addEventListener('hha:battle-start', ()=>{
    try{ WIN.__GJ_START_NOW__?.(); }catch(e){}
  });
  WIN.addEventListener('hha:battle-state', (ev)=>{
    try{
      const phase = String(ev?.detail?.phase || '').toLowerCase();
      if(phase === 'running' && paused){
        WIN.__GJ_START_NOW__?.();
      }
    }catch(e){}
  });

  // scores & counters
  let score = 0;
  let missTotal = 0;
  let missGoodExpired = 0;
  let missJunkHit = 0;

  let combo = 0;
  let bestCombo = 0;

  let goodHitCount = 0;
  let shots = 0;
  let hits  = 0;

  // reaction time (good only)
  const rtList = [];

  // mini
  const mini = { name:'—', t:0, on:false };

  // boss
  let bossActive = false;
  const bossHpMax = TUNE.bossHp;
  let bossHp = bossHpMax;

  // targets
  const targets = new Map();
  let idSeq = 1;

  // ---------- FIX: Safe spawn rect (กัน HUD/mission) ----------
  function safeRect(){
    const r = layer.getBoundingClientRect();
    const hudEl = $('hud');
    const hudR = hudEl ? hudEl.getBoundingClientRect() : null;

    // mission box is fixed below hud
    const missionBox = missionTitle ? missionTitle.closest('.box') : null;
    const missionR = missionBox ? missionBox.getBoundingClientRect() : null;

    const topBlock = Math.max(
      (hudR ? hudR.bottom : (r.top+10)),
      (missionR ? missionR.bottom : (r.top+70))
    );

    const pad = 14;
    const top = Math.min(r.bottom - 120, topBlock + pad);
    const bottom = r.bottom - (pad + 12);
    const left = r.left + pad;
    const right = r.right - pad;

    // fallback if weird
    return {
      l: left,
      r: Math.max(left+220, right),
      t: Math.max(r.top+pad, top),
      b: Math.max(top+260, bottom),
      w: Math.max(10, right-left),
      h: Math.max(10, bottom-top),
      layer: r
    };
  }

  function gradeFrom(score, accPct, miss){
    // playful but fair
    if(miss <= 1 && accPct >= 85 && score >= 900) return 'S';
    if(accPct >= 82 && miss <= 2) return 'A';
    if(accPct >= 70 && miss <= 4) return 'B';
    if(accPct >= 58 && miss <= 7) return 'C';
    return 'D';
  }

  function setHUD(){
    const accPct = shots ? Math.round((hits/shots)*100) : 0;
    const g = gradeFrom(score, accPct, missTotal);

    if(hud.score) hud.score.textContent = String(score|0);
    if(hud.time) hud.time.textContent = String(Math.max(0, Math.ceil(tLeft)));
    if(hud.miss) hud.miss.textContent = String(missTotal|0);
    if(hud.grade) hud.grade.textContent = g;

    const goalText = (stage===0)
      ? `WARM: score≥${WIN_TARGET.scoreTarget}, good≥${WIN_TARGET.goodTarget}`
      : (stage===1)
        ? `TRICK: คอมโบ + โบนัส`
        : `BOSS: HP ${bossHp}/${bossHpMax}`;
    if(hud.goal) hud.goal.textContent = goalText;

    if(hud.goalCur) hud.goalCur.textContent = String(score|0);
    if(hud.goalTarget) hud.goalTarget.textContent = String(WIN_TARGET.scoreTarget);
    if(hud.goalDesc) hud.goalDesc.textContent = `เป้าหมาย: score ≥ ${WIN_TARGET.scoreTarget} และ good ≥ ${WIN_TARGET.goodTarget}`;

    if(hud.mini) hud.mini.textContent = mini.name || '—';
    if(hud.miniTimer) hud.miniTimer.textContent = String(Math.max(0, Math.ceil(mini.t||0)));

    // mission panel
    if(missionTitle) missionTitle.textContent = (stage===0?'WARM-UP':stage===1?'TRICK':'BOSS');
    if(missionGoal){
      missionGoal.textContent = (stage===0)
        ? 'เก็บของดีให้ครบ'
        : (stage===1)
          ? 'เก็บโบนัส + รักษาคอมโบ'
          : 'ตีบอสให้ล้ม (โดน WEAK จะเจ็บมาก)';
    }
    if(missionHint){
      missionHint.textContent = (stage===0)
        ? 'โฟกัสของดี (+) คอมโบ'
        : (stage===1)
          ? 'โบนัสช่วยพุ่งคะแนน • อย่าโดน junk'
          : 'หา 🎯 แล้วกด/ยิงใส่!';
    }
    if(missionFill){
      let p=0;
      if(stage===0){
        const p1 = Math.min(1, score / WIN_TARGET.scoreTarget);
        const p2 = Math.min(1, goodHitCount / WIN_TARGET.goodTarget);
        p = 0.55*p1 + 0.45*p2;
      }else if(stage===1){
        p = Math.min(1, (score - WIN_TARGET.scoreTarget) / 380);
      }else{
        p = 1 - (bossHp / bossHpMax);
      }
      missionFill.style.width = `${Math.round(p*100)}%`;
    }
  }

  function makeTarget(kind, emoji, ttl){
    const id = idSeq++;
    const el = DOC.createElement('div');
    el.className = 'tgt';
    el.dataset.id = String(id);
    el.dataset.kind = kind;
    el.innerHTML = `<div class="ring"></div><div class="emo">${emoji}</div>`;
    layer.appendChild(el);

    const born = nowMs();
    const s = safeRect();

    const x = s.l + 34 + r01()*(Math.max(60, s.r - s.l) - 68);
    const y = s.t + 34 + r01()*(Math.max(120, s.b - s.t) - 68);

    el.style.left = `${x - s.layer.left}px`;
    el.style.top  = `${y - s.layer.top}px`;

    const obj = { id, kind, emoji, el, born, ttl, x, y, hit:false };
    targets.set(id, obj);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onHit(id, ev.clientX, ev.clientY);
    }, {passive:false});

    return obj;
  }

  function killTarget(id){
    const t = targets.get(id);
    if(!t) return;
    targets.delete(id);
    try{ t.el.remove(); }catch(e){}
  }

  function onHit(id, clientX, clientY){
    const t = targets.get(id);
    if(!t || t.hit || !playing) return;
    t.hit = true;

    shots++;
    hits++;

    const isGood = (t.kind==='good');
    const isJunk = (t.kind==='junk');
    const isBonus = (t.kind==='bonus');
    const isWeak = (t.kind==='weak');

    if(isGood){
      goodHitCount++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      const gain = 10 + Math.min(18, combo);
      score += gain;
      rtList.push(Math.max(1, nowMs() - t.born));
      fxBurst(clientX, clientY);
      fxFloatText(clientX, clientY, `+${gain}`, false);
    }else if(isBonus){
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      const gain = 28 + ((r01()*12)|0);
      score += gain;
      fxBurst(clientX, clientY);
      fxFloatText(clientX, clientY, `BONUS +${gain}`, false);
      if(!mini.on){
        mini.on = true;
        mini.name = 'BONUS';
        mini.t = 6;
        sayCoach('โบนัสมาแล้ว! เก็บต่อเนื่อง 🔥');
      }
    }else if(isWeak){
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      const dmg = 2 + ((r01()*2)|0);
      bossHp = Math.max(0, bossHp - dmg);
      score += 18 + dmg*6;
      fxBurst(clientX, clientY);
      fxFloatText(clientX, clientY, `WEAK! -${dmg}HP`, false);
    }else if(isJunk){
      // miss = junk hit
      missTotal++;
      missJunkHit++;
      combo = 0;
      const lose = 12;
      score = Math.max(0, score - lose);
      fxBurst(clientX, clientY);
      fxFloatText(clientX, clientY, `-MISS`, true);
    }

    killTarget(id);

    // coach explain
    const accPct = shots ? Math.round((hits/shots)*100) : 0;
    const c2 = coachTop2(missGoodExpired, missJunkHit, shots, accPct);
    if(c2) sayCoach(c2);

    setHUD();
    checkStageAdvance();
    checkLose();
  }

  // allow crosshair shoot
  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing) return;
    const s = safeRect();
    const x = Number(ev?.detail?.x);
    const y = Number(ev?.detail?.y);
    const cx = Number.isFinite(x) ? x : (s.layer.left + s.layer.width/2);
    const cy = Number.isFinite(y) ? y : (s.layer.top + s.layer.height/2);

    // find nearest target within radius
    let best=null, bestD=99999;
    targets.forEach(t=>{
      const dx = (t.x - cx);
      const dy = (t.y - cy);
      const d = Math.hypot(dx,dy);
      if(d < bestD){ bestD = d; best = t; }
    });
    if(best && bestD <= 90){
      onHit(best.id, cx, cy);
    }else{
      shots++;
      combo = 0;
      setHUD();
    }
  });

  function spawnTick(dt){
    // base spawn rate
    const rate = TUNE.spawnBase * (stage===2 ? 1.1 : 1.0) * (mini.on ? 1.15 : 1.0);
    spawnAccum += dt*rate;

    while(spawnAccum >= 1){
      spawnAccum -= 1;

      // boss stage: spawn weak points + junk
      if(stage===2){
        const roll = r01();
        if(roll < 0.42){
          makeTarget('weak', WEAK, 1.2);
        }else if(roll < 0.72){
          makeTarget('junk', rPick(JUNK), TUNE.ttlJunk);
        }else{
          makeTarget('good', rPick(GOOD), TUNE.ttlGood);
        }
        continue;
      }

      // warm/trick
      const r = r01();
      if(stage===0){
        if(r < 0.62) makeTarget('good', rPick(GOOD), TUNE.ttlGood);
        else makeTarget('junk', rPick(JUNK), TUNE.ttlJunk);
      }else{
        if(r < 0.50) makeTarget('good', rPick(GOOD), TUNE.ttlGood);
        else if(r < 0.72) makeTarget('bonus', rPick(BONUS), TUNE.ttlBonus);
        else makeTarget('junk', rPick(JUNK), TUNE.ttlJunk);
      }
    }
  }

  function expireTick(){
    const t = nowMs();
    targets.forEach((obj, id)=>{
      if(obj.hit) return;
      if((t - obj.born) >= (obj.ttl*1000)){
        // expired
        if(obj.kind === 'good'){
          missTotal++;
          missGoodExpired++;
          combo = 0;
        }
        killTarget(id);
      }
    });
  }

  function checkStageAdvance(){
    if(stage===0){
      const ok = (score >= WIN_TARGET.scoreTarget) && (goodHitCount >= WIN_TARGET.goodTarget);
      if(ok){
        stage = 1;
        sayCoach('ผ่าน WARM! เข้าช่วง TRICK 🔥');
      }
    }else if(stage===1){
      // after some progress, enter boss
      if(score >= (WIN_TARGET.scoreTarget + 320)){
        stage = 2;
        bossActive = true;
        bossHp = bossHpMax;
        sayCoach('บอสมาแล้ว! หา 🎯 แล้วกดเลย!');
      }
    }else{
      if(bossHp <= 0){
        endGame('win');
      }
    }
  }

  function checkLose(){
    if(missTotal >= TUNE.lifeMissLimit){
      endGame('miss-limit');
    }
  }

  function endGame(reason){
    if(!playing) return;
    playing = false;

    // clear targets
    targets.forEach((_, id)=> killTarget(id));

    const accPct = shots ? Math.round((hits/shots)*100) : 0;
    const grade = gradeFrom(score, accPct, missTotal);

    // UI
    if(endOverlay) endOverlay.classList.add('show');
    if(endTitle) endTitle.textContent = (reason==='win') ? 'ชนะแล้ว! 🎉' : 'จบเกม';
    if(endSub) endSub.textContent = (reason==='win')
      ? 'ผ่านบอสสำเร็จ • เก่งมาก!'
      : (reason==='miss-limit')
        ? 'Miss เยอะไปหน่อย ลองใหม่ได้!'
        : 'จบเวลา';

    if(endGrade) endGrade.textContent = grade;
    if(endScore) endScore.textContent = String(score|0);
    if(endMiss)  endMiss.textContent  = String(missTotal|0);
    if(endTime)  endTime.textContent  = String(Math.max(0, Math.ceil(tLeft)));

    // save summary for AutoDiff
    const summary = {
      game: 'goodjunk',
      pid,
      diff,
      seed: seedStr,
      mode,
      reason,
      score,
      missTotal,
      missGoodExpired,
      missJunkHit,
      shots,
      hits,
      accPct,
      goodHitCount,
      bestCombo,
      grade,
      startTimeIso,
      endTimeIso: nowIso()
    };
    try{
      hhLsSet('HHA_LAST_SUMMARY', JSON.stringify(summary));
      hhLsSet(`HHA_LAST_SUMMARY:goodjunk:${pid}`, JSON.stringify(summary));
    }catch(_){}

    // cooldown button injection (daily per game)
    try{
      hhInjectCooldownButton({ endOverlayEl: endOverlay, hub: hubUrl, cat: HH_CAT, gameKey: HH_GAME, pid });
    }catch(_){}

    // emit score for battle (if any)
    try{
      WIN.dispatchEvent(new CustomEvent('hha:score', { detail: summary }));
    }catch(_){}

    // coach
    if(reason==='win') sayCoach('สุดยอด! ไปต่อได้เลย 🔥');
    else sayCoach('ไม่เป็นไร ลองใหม่อีกรอบ!');
  }

  // ---------- main loop ----------
  let spawnAccum = 0;

  function tick(){
    const t = nowMs();
    const dt = Math.min(0.08, Math.max(0, (t - lastTick) / 1000));
    lastTick = t;

    if(playing){
      if(!paused){
        tLeft -= dt;
        if(mini.on){
          mini.t -= dt;
          if(mini.t <= 0){
            mini.on = false;
            mini.name = '—';
            mini.t = 0;
          }
        }

        spawnTick(dt);
        expireTick();

        if(tLeft <= 0){
          // if boss not dead -> lose by time
          endGame(bossActive && bossHp>0 ? 'time' : (stage>=1 ? 'time' : 'time'));
        }

        // occasional coach tips
        if(((t|0) % 6000) < 30){
          const accPct = shots ? Math.round((hits/shots)*100) : 0;
          const c2 = coachTop2(missGoodExpired, missJunkHit, shots, accPct);
          if(c2) sayCoach(c2);
        }
      }
      setHUD();
      requestAnimationFrame(tick);
    }
  }

  // init HUD
  setHUD();

  if(WAIT_START){
    sayCoach('BATTLE/RACE: รอเริ่มพร้อมกัน… ⏳');
  }else{
    sayCoach('เริ่มเลย! เก็บของดีให้ไว 🔥');
  }

  // start loop
  requestAnimationFrame(tick);
}