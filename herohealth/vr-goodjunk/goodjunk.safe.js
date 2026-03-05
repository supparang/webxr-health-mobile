// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION
// ✅ Dynamic HUD-safe spawn (auto avoid HUD/mission panels)
// ✅ Hero XP/Profile: localStorage + optional cloud hook
// ✅ AB Challenge Cards (A+B simultaneously)
// ✅ Hero Skill 1/round (CLEANSE)
// FULL v20260305i-SAFE-AB-CARDS-SKILL
'use strict';

export async function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  function $(id){ return DOC.getElementById(id); }
  function emit(name, detail){ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } }

  // ---------- MODE ----------
  const mode = String(qs('mode', cfg.mode || 'solo')).toLowerCase();
  const battleOn = (String(qs('battle','0')) === '1') || (mode === 'battle');

  // ---------- BATTLE (optional) ----------
  let battle = null;
  async function initBattleMaybe(pid, gameKey){
    if(!battleOn) return null;
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

  // ---------- localStorage helpers ----------
  function hhDayKey(){
    const d=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(2,'0');
    const dd=String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function hhLsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  function hhLsSet(k,v){ try{ localStorage.setItem(k,v); }catch(_){ } }

  // ---------- HERO PROFILE ----------
  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const nick = String(cfg.nick || qs('nick', pid)).trim() || pid;

  function loadLocalProfile(){
    try{
      const raw = hhLsGet(`HHA_PROFILE:${pid}`) || '';
      if(!raw) return { pid, nick, xp:0, lvl:1 };
      const j = JSON.parse(raw);
      if(!j || typeof j!=='object') return { pid, nick, xp:0, lvl:1 };
      j.pid = pid;
      if(!j.nick) j.nick = nick;
      if(!Number.isFinite(+j.xp)) j.xp = 0;
      if(!Number.isFinite(+j.lvl)) j.lvl = 1;
      return j;
    }catch(_){
      return { pid, nick, xp:0, lvl:1 };
    }
  }
  function saveLocalProfile(p){ try{ hhLsSet(`HHA_PROFILE:${pid}`, JSON.stringify(p)); }catch(_){ } }
  function lvlFromXp(xp){
    xp = Math.max(0, Number(xp)||0);
    return Math.floor(xp / 50) + 1;
  }
  async function heroCloudAddXpMaybe(xpGain){
    try{
      const mod = await import('../vr/hero-profile-cloud.js');
      await mod.addXp?.({ pid, nick, xpGain, meta:{ game:'goodjunk', ts: nowIso() } });
    }catch(_){}
  }

  // ---------- COOLDOWN BUTTON ----------
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
  const hudTop = $('hudTop');
  const hudMini = $('hudMini');
  const missionPanel = $('missionPanel');

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

  // ✅ AB cards UI
  const cardAEl = $('cardA');
  const cardAProgEl = $('cardAProg');
  const cardBEl = $('cardB');
  const cardBProgEl = $('cardBProg');

  // skill UI
  const skillBtn = $('skillBtn');
  const skillHint = $('skillHint');

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

  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const HH_CAT = 'nutrition';
  const HH_GAME = 'goodjunk';

  // battle init
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

  // ---------- SOLO tuning ----------
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

  // ---------- Coach ----------
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

  // ---------- game state ----------
  const startTimeIso = nowIso();
  let playing = true;
  let tLeft = plannedSec;
  let lastTick = nowMs();

  // wait-start (battle/race)
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
  WIN.addEventListener('hha:battle-start', ()=>{ try{ WIN.__GJ_START_NOW__?.(); }catch(e){} });
  WIN.addEventListener('hha:battle-state', (ev)=>{
    try{
      const phase = String(ev?.detail?.phase || '').toLowerCase();
      if(phase === 'running' && paused) WIN.__GJ_START_NOW__?.();
    }catch(e){}
  });

  // gameplay metrics
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

  const mini = { name:'—', t:0 };

  let bossActive = false;
  let bossHpMax = TUNE.bossHp;
  let bossHp = bossHpMax;
  let bossShieldHp = bossShieldBase();

  const targets = new Map();
  let idSeq = 1;

  // ---------- ✅ AB Challenge Cards ----------
  // A: Accuracy >= 75% when shots>=18
  // B: reach bestCombo >= 10 once
  const cards = {
    A: { code:'A', done:false, bonusXp:4 },
    B: { code:'B', done:false, bonusXp:4 }
  };

  function cardAProgress(){
    const acc = shots ? Math.round((hits/shots)*100) : 0;
    const need = Math.max(0, 18 - shots);
    return `acc ${acc}% • shots ${shots}/18${need>0?` (+${need})`:''}`;
  }
  function cardBProgress(){
    return `bestCombo ${bestCombo}/10`;
  }

  function updateCardsUI(){
    try{
      if(cardAEl){ const v = cardAEl.querySelector('.v') || cardAEl; v.textContent = 'A • Accuracy 75%+'; }
      if(cardAProgEl){
        const v = cardAProgEl.querySelector('.v') || cardAProgEl;
        v.textContent = cards.A.done ? 'DONE ✅' : cardAProgress();
        cardAProgEl.classList.toggle('dim', !cards.A.done);
      }

      if(cardBEl){ const v = cardBEl.querySelector('.v') || cardBEl; v.textContent = 'B • Combo 10+'; }
      if(cardBProgEl){
        const v = cardBProgEl.querySelector('.v') || cardBProgEl;
        v.textContent = cards.B.done ? 'DONE ✅' : cardBProgress();
        cardBProgEl.classList.toggle('dim', !cards.B.done);
      }
    }catch(_){}
  }

  function checkCardsDone(){
    if(!cards.A.done){
      const acc = shots ? (hits/shots)*100 : 0;
      if(shots >= 18 && acc >= 75){
        cards.A.done = true;
        sayCoach('Card A สำเร็จ! (ยิงแม่น 75%+) 🏅');
      }
    }
    if(!cards.B.done){
      if(bestCombo >= 10){
        cards.B.done = true;
        sayCoach('Card B สำเร็จ! (คอมโบ 10+) 🏅');
      }
    }
  }

  function cardsBonusXp(){
    return (cards.A.done ? cards.A.bonusXp : 0) + (cards.B.done ? cards.B.bonusXp : 0);
  }

  // ---------- ✅ Hero Skill 1/round (CLEANSE) ----------
  let skillUsed = false;

  function setSkillUI(){
    if(skillBtn){
      skillBtn.disabled = (!!skillUsed) || (!playing);
      skillBtn.textContent = skillUsed ? '✨ Skill (used)' : '✨ CLEANSE';
    }
    if(skillHint){
      skillHint.textContent = skillUsed ? 'ใช้ไปแล้ว' : 'ล้างขยะบนจอ + ลด miss';
    }
  }

  function useSkillCleanse(){
    if(!playing) return false;
    if(skillUsed) return false;
    skillUsed = true;

    let removed = 0;
    for(const [id,t] of targets){
      if(t.type==='junk'){
        try{ t.el.remove(); }catch(e){}
        targets.delete(id);
        removed++;
        if(removed>=2) break;
      }
    }

    if(missTotal > 0){
      missTotal = Math.max(0, missTotal - 1);
      missJunkHit = Math.max(0, missJunkHit - 1);
    }

    score += 10;
    const r = layer.getBoundingClientRect();
    fxFloatText(r.left + r.width*0.82, r.top + r.height*0.70, `CLEANSE! (-miss)`, false);
    sayCoach(`CLEANSE! ล้างขยะ ${removed} ชิ้น + ลด miss`);

    setSkillUI();
    updateCardsUI();
    emit('hha:event', { name:'skill', skill:'cleanse', removed, ts: nowIso() });
    return true;
  }

  if(skillBtn){
    skillBtn.addEventListener('click', (ev)=>{
      ev.preventDefault(); ev.stopPropagation();
      useSkillCleanse();
    }, { passive:false });
  }
  WIN.addEventListener('keydown', (ev)=>{
    if(String(ev.key||'').toLowerCase()==='s'){
      useSkillCleanse();
    }
  });

  // ---------- spawn safe area (dynamic HUD-safe) ----------
  function layerRect(){ return layer.getBoundingClientRect(); }

  function rectBottom(el){
    try{
      if(!el) return 0;
      const r = el.getBoundingClientRect();
      if(!Number.isFinite(r.bottom)) return 0;
      return r.bottom;
    }catch(_){ return 0; }
  }
  function dynamicNoSpawnBottom(){
    const b1 = rectBottom(hudTop);
    const b2 = rectBottom(missionPanel);
    const b3 = rectBottom(hudMini);
    const b4 = (bossBar && bossBar.style.display!=='none') ? rectBottom(bossBar) : 0;
    return Math.max(b1,b2,b3,b4);
  }
  function safeSpawnRect(){
    const r = layerRect();
    const W = r.width, H = r.height;
    const leftPad = 18;
    const rightPad = 18;
    const bottomPad = 140 + (view==='cvr'||view==='vr' ? 10 : 0);

    let topPadPx = dynamicNoSpawnBottom() + 16;
    if(!Number.isFinite(topPadPx) || topPadPx < 80) topPadPx = r.top + 140;

    const y1 = Math.min(r.top + H - 80, topPadPx);
    const y2 = Math.max(y1 + 80, r.top + H - bottomPad);

    const x1 = r.left + leftPad;
    const x2 = r.left + Math.max(leftPad+10, W - rightPad);

    return { x1, x2, y1, y2 };
  }
  function spawnPoint(){
    const s = safeSpawnRect();
    const x = s.x1 + (s.x2 - s.x1) * Math.max(0.02, Math.min(0.98, r01()));
    const y = s.y1 + (s.y2 - s.y1) * Math.max(0.02, Math.min(0.98, r01()));
    return { x, y };
  }

  // ---------- UI helpers ----------
  function setMissionUI(){
    if(missionTitle) missionTitle.textContent = STAGE_NAME[stage] || 'WARM';
    if(stage===0){
      if(missionGoal) missionGoal.textContent = `เก็บของดี ${WIN_TARGET.goodTarget} ชิ้น`;
      if(missionHint) missionHint.textContent = `เป้าหมาย: ของดี + คะแนนสะสม (อย่าโดนของขยะ)`;
    }else if(stage===1){
      if(missionGoal) missionGoal.textContent = `คอมโบ 8+ เพื่อเร่งแต้ม`;
      if(missionHint) missionHint.textContent = `TRICK: ทำคอมโบต่อเนื่อง • เล็งของดีให้ไว`;
    }else{
      if(missionGoal) missionGoal.textContent = `BOSS: ตีแตกโล่แล้วโจมตี 🎯`;
      if(missionHint) missionHint.textContent = `ยิง/แตะ 🎯 เพื่อลด HP บอส (ระวังโดนขยะ)`;
    }
  }
  function setBossUI(on){
    if(!bossBar) return;
    bossBar.style.display = on ? 'flex' : 'none';
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
    try{
      if(hud.score) hud.score.textContent = String(score|0);
      if(hud.time) hud.time.textContent = String(Math.ceil(tLeft));
      if(hud.miss) hud.miss.textContent = String(missTotal|0);
      if(hud.grade) hud.grade.textContent = gradeFromScore();
      if(hud.goal) hud.goal.textContent = (stage===2) ? 'BOSS' : (stage===1 ? 'TRICK' : 'WARM');
      if(hud.goalCur) hud.goalCur.textContent = String(goodHitCount|0);
      if(hud.goalTarget) hud.goalTarget.textContent = String(WIN_TARGET.goodTarget|0);
      if(hud.goalDesc) hud.goalDesc.textContent = (stage===2 ? 'ตีบอส' : 'เก็บของดี');
      if(hud.mini) hud.mini.textContent = mini.name || '—';
      if(hud.miniTimer) hud.miniTimer.textContent = String(Math.ceil(mini.t||0));
      if(missionFill){
        const p = (stage===2)
          ? (bossHpMax? (1-(bossHp/bossHpMax))*100 : 0)
          : clamp((goodHitCount/WIN_TARGET.goodTarget)*100, 0, 100);
        missionFill.style.setProperty('--p', p.toFixed(1)+'%');
      }
    }catch(e){}
  }

  function xpGainFromResult({reason, grade, score}){
    let xp = 4;
    if(reason === 'win') xp += 8;
    if(grade === 'A') xp += 3;
    if(grade === 'S') xp += 5;
    if(score >= WIN_TARGET.scoreTarget) xp += 2;
    xp += cardsBonusXp(); // ✅ AB bonus
    return clamp(xp, 2, 30);
  }

  async function endGame(reason){
    if(!playing) return;
    playing = false;

    // stop all targets
    for(const [id,t] of targets){
      try{ t.el.remove(); }catch(e){}
    }
    targets.clear();

    const grade = gradeFromScore();
    const accPct = shots ? Math.round((hits/shots)*100) : 0;

    const sum = {
      game: HH_GAME,
      pid,
      nick,
      diff,
      mode,
      score,
      missTotal,
      missGoodExpired,
      missJunkHit,
      shots,
      hits,
      accPct,
      grade,
      reason,
      cards: { A: !!cards.A.done, B: !!cards.B.done },
      skillUsed,
      startTimeIso,
      endTimeIso: nowIso()
    };

    try{
      hhLsSet(`HHA_LAST_SUMMARY:${HH_GAME}:${pid}`, JSON.stringify(sum));
      hhLsSet('HHA_LAST_SUMMARY', JSON.stringify(sum));
    }catch(e){}

    // hero xp
    try{
      const xpGain = xpGainFromResult({ reason, grade, score });
      const prof = loadLocalProfile();
      prof.nick = nick || prof.nick || pid;
      prof.xp = Math.max(0, Number(prof.xp)||0) + xpGain;
      prof.lvl = lvlFromXp(prof.xp);
      saveLocalProfile(prof);
      heroCloudAddXpMaybe(xpGain);

      sum.xpGain = xpGain;
      sum.heroLvl = prof.lvl;
      sum.heroXp = prof.xp;
    }catch(_){}

    try{ emit('hha:end', sum); }catch(e){}

    if(endOverlay){
      endOverlay.style.display = 'flex';
      if(endTitle) endTitle.textContent = (reason==='win') ? 'ชนะแล้ว! 🎉' : 'จบเกม';
      if(endSub){
        const ctxt = ` • A:${cards.A.done?'✅':'—'} B:${cards.B.done?'✅':'—'}`;
        const stxt = skillUsed ? ' • Skill used' : '';
        endSub.textContent = `score ${score} • acc ${accPct}% • miss ${missTotal} • reason=${reason}${sum.xpGain?` • +XP ${sum.xpGain}`:''}${ctxt}${stxt}`;
      }
      if(endGrade) endGrade.textContent = grade;
      if(endScore) endScore.textContent = String(score);
      if(endMiss) endMiss.textContent = String(missTotal);
      if(endTime) endTime.textContent = String(Math.round(plannedSec - tLeft));
      hhInjectCooldownButton({ endOverlayEl:endOverlay, hub:hubUrl, cat:HH_CAT, gameKey:HH_GAME, pid });
    }else{
      alert(`จบเกม: ${reason} (score ${score})`);
    }
  }

  // ---------- target factory ----------
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
    el.style.willChange = 'transform, opacity';
    el.style.transition = 'transform .08s ease';
    el.style.pointerEvents = 'auto';

    layer.appendChild(el);

    const id = String(idSeq++);
    const born = nowMs();

    const t = { id, type, emoji, ttl, born, el };
    targets.set(id, t);

    function onHit(ev){
      ev && ev.preventDefault && ev.preventDefault();
      ev && ev.stopPropagation && ev.stopPropagation();
      hitTarget(id);
    }
    el.addEventListener('pointerdown', onHit, { passive:false });

    return t;
  }

  function removeTarget(id){
    const t = targets.get(id);
    if(!t) return;
    targets.delete(id);
    try{ t.el.remove(); }catch(e){}
  }

  function coachTop2(){
    const acc = shots ? Math.round((hits/shots)*100) : 0;
    const facts = [];
    if(missJunkHit >= 2) facts.push({k:'โดนของเสีย', v: missJunkHit});
    if(missGoodExpired >= 2) facts.push({k:'ช้า ของดีหาย', v: missGoodExpired});
    if(shots >= 10 && acc <= 55) facts.push({k:'ยิงพลาดเยอะ', v: (100-acc)});
    facts.sort((a,b)=> (b.v||0)-(a.v||0));
    const top = facts.slice(0,2).map(x=>x.k);
    if(!top.length) return null;
    return `ระวัง: ${top.join(' + ')}`;
  }

  function hitTarget(id){
    const t = targets.get(id);
    if(!t || !playing) return;

    shots++;
    const type = t.type;

    const br = t.el.getBoundingClientRect();
    const x = br.left + br.width/2;
    const y = br.top + br.height/2;

    fxBurst(x,y);

    if(type === 'good'){
      hits++;
      goodHitCount++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      score += 12 + Math.min(8, combo);
      fxFloatText(x,y,`+${12 + Math.min(8, combo)}`,false);
    }else if(type === 'junk'){
      hits++;
      missTotal++;
      missJunkHit++;
      combo = 0;
      score = Math.max(0, score - 8);
      fxFloatText(x,y,'-8',true);
    }else if(type === 'bonus'){
      hits++;
      score += 25;
      fxFloatText(x,y,'+25',false);
      mini.name = 'BONUS ⚡';
      mini.t = 6;
    }else if(type === 'shield'){
      hits++;
      score += 6;
      shield = Math.min(9, shield + 1);
      fxFloatText(x,y,'+shield',false);
    }else if(type === 'bossweak'){
      hits++;
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
      if(bossHp <= 0){
        endGame('win');
      }
    }

    removeTarget(id);

    if(stage===0 && goodHitCount >= Math.ceil(WIN_TARGET.goodTarget*0.55)){
      stage = 1;
      setMissionUI();
      sayCoach('เข้า TRICK! ทำคอมโบ 8+ 🔥');
    }
    if(stage===1 && goodHitCount >= WIN_TARGET.goodTarget){
      stage = 2;
      bossActive = true;
      setMissionUI();
      setBossUI(true);
      bossHpMax = TUNE.bossHp;
      bossHp = bossHpMax;
      bossShieldHp = bossShieldBase();
      setBossHpUI();
      sayCoach('บอสมาแล้ว! ตีโล่ก่อนแล้วค่อยยิง 🎯');
    }

    // ✅ AB cards checks
    checkCardsDone();

    const explain = coachTop2();
    if(explain) sayCoach(explain);

    setHUD();
    updateCardsUI();
    setSkillUI();

    if(missTotal >= TUNE.lifeMissLimit){
      endGame('miss-limit');
    }
  }

  // ---------- spawn loop ----------
  let spawnAcc = 0;

  function spawnOne(){
    if(!playing) return;

    if(stage===2){
      if(!bossActive) return;
      let hasWeak=false;
      for(const [,t] of targets){ if(t.type==='bossweak') {hasWeak=true; break;} }
      if(!hasWeak){
        makeTarget('bossweak', WEAK, 1.6);
      }else{
        if(r01() < 0.55) makeTarget('junk', rPick(JUNK), TUNE.ttlJunk);
      }
      return;
    }

    const pShield = (diff==='hard') ? 0.10 : 0.12;
    const pBonus  = 0.12;
    const pJunk   = (diff==='easy') ? 0.28 : (diff==='hard' ? 0.38 : 0.33);

    const r = r01();
    if(r < pShield){
      makeTarget('shield', rPick(SHIELDS), 2.4);
    }else if(r < pShield + pBonus){
      makeTarget('bonus', rPick(BONUS), TUNE.ttlBonus);
    }else if(r < pShield + pBonus + pJunk){
      makeTarget('junk', rPick(JUNK), TUNE.ttlJunk);
    }else{
      makeTarget('good', rPick(GOOD), TUNE.ttlGood);
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

  // ---------- input: hha:shoot ----------
  function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
  function shootAtCenter(){
    if(!playing) return;
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
    if(best){
      hitTarget(best);
    }else{
      shots++;
      combo = 0;
      checkCardsDone();
      setHUD();
      updateCardsUI();
    }
  }
  WIN.addEventListener('hha:shoot', ()=>{ try{ shootAtCenter(); }catch(e){} });

  // ---------- tick ----------
  function tick(){
    const t = nowMs();
    let dt = (t - lastTick) / 1000;
    lastTick = t;
    dt = clamp(dt, 0, 0.05);

    if(!playing) return;

    if(paused){
      setHUD(); updateCardsUI(); setSkillUI();
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
      if(mini.t <= 0){ mini.name = '—'; }
    }

    spawnAcc += dt * (1 / TUNE.spawnBase);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
    }

    expireTargets();
    checkCardsDone();

    setHUD();
    updateCardsUI();
    setSkillUI();

    if(stage===2){
      setBossUI(true);
      setBossHpUI();
    }else{
      setBossUI(false);
    }

    requestAnimationFrame(tick);
  }

  // ---------- init ----------
  setMissionUI();
  setHUD();
  updateCardsUI();
  setSkillUI();

  if(WAIT_START){
    sayCoach('BATTLE/RACE: รอเริ่มพร้อมกัน… ⏳');
  }else{
    sayCoach('เริ่ม! เปิด Card A+B แล้ว 🎴🎴 (ผ่านแต่ละใบได้โบนัส XP)');
  }

  requestAnimationFrame(tick);
}