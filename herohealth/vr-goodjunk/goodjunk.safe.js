// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (FX + Coach + mission 3-stage UI + PRO + battle sync)
// FULL v20260305m-SAFE-REWARD-ABC-HEROXP
'use strict';

export async function boot(cfg){
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

  // ---------- localStorage helpers ----------
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,String(v)); }catch(_){ } }
  function lsDel(k){ try{ localStorage.removeItem(k); }catch(_){ } }

  // ---------- COOL DOWN BUTTON (PER-GAME DAILY) ----------
  function hhDayKey(){
    const d=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(2,'0');
    const dd=String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function hhCooldownDone(cat, gameKey, pid){
    const day = hhDayKey();
    const p = String(pid||'anon').trim()||'anon';
    const c = String(cat||'nutrition').toLowerCase();
    const g = String(gameKey||'unknown').toLowerCase();
    const kNew = `HHA_COOLDOWN_DONE:${c}:${g}:${p}:${day}`;
    const kOld = `HHA_COOLDOWN_DONE:${c}:${p}:${day}`;
    return (lsGet(kNew)==='1') || (lsGet(kOld)==='1');
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

  // ---------- Coach (rate-limited) ----------
  const coach = DOC.createElement('div');
  coach.style.position = 'fixed';
  coach.style.left = '10px';
  coach.style.right = '10px';
  coach.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + 10px)`;
  coach.style.zIndex = '240';
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

  // ---------- gameplay state ----------
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

  function layerRect(){ return layer.getBoundingClientRect(); }

  // ====== UI bounds aware SAFE SPAWN (HUD/mission/bossbar) ======
  function getUiBlocks(){
    const b = WIN.HHA_UI_BOUNDS || null;
    const blocks = [];
    function pushRect(r){
      if(!r) return;
      blocks.push({ x1:r.left, y1:r.top, x2:r.right, y2:r.bottom });
    }
    pushRect(b?.L); pushRect(b?.R); pushRect(b?.M); pushRect(b?.B);
    return blocks;
  }
  function overlapsBlock(x,y, blocks, pad){
    for(const r of blocks){
      if(x >= r.x1-pad && x <= r.x2+pad && y >= r.y1-pad && y <= r.y2+pad) return true;
    }
    return false;
  }
  function safeSpawnRect(){
    const r = layerRect();
    const W = r.width, H = r.height;

    const leftPad = 18, rightPad = 18;
    const topPadBase = (view==='cvr'||view==='vr') ? 130 : 120;
    const bottomPadBase = (view==='cvr'||view==='vr') ? 120 : 110;

    const x1 = r.left + leftPad;
    const x2 = r.left + Math.max(leftPad+10, W - rightPad);
    const y1 = r.top + Math.min(H-80, topPadBase);
    const y2 = r.top + Math.max(y1+80, H - bottomPadBase);

    return { x1, x2, y1, y2 };
  }
  function spawnPoint(){
    const s = safeSpawnRect();
    const blocks = getUiBlocks();
    const pad = 14;
    const maxTry = 18;

    for(let i=0;i<maxTry;i++){
      const x = s.x1 + (s.x2 - s.x1) * r01();
      const y = s.y1 + (s.y2 - s.y1) * r01();
      if(!overlapsBlock(x,y, blocks, pad)) return { x, y };
    }
    return {
      x: s.x1 + (s.x2 - s.x1) * r01(),
      y: s.y1 + (s.y2 - s.y1) * r01()
    };
  }

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
      if(hud.goal){
        hud.goal.textContent = (stage===2) ? 'BOSS' : (stage===1 ? 'TRICK' : 'WARM');
      }
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

  // ========== REWARD ENGINE: ABC Cards + Hero XP ==========
  function heroXpKey(pid){ return `HHA_HERO_XP:${String(pid||'anon')}`; }
  function cardBookKey(pid){ return `HHA_CARD_BOOK:${String(pid||'anon')}`; }
  function lastRewardKey(pid){ return `HHA_LAST_REWARD:${String(pid||'anon')}`; }

  function parseJson(s, fallback){
    try{ return JSON.parse(String(s||'')); }catch(_){ return fallback; }
  }

  // level curve: XP grows => Lv increases smoothly (kids feel progress fast early)
  function levelFromXp(xp){
    xp = Math.max(0, Number(xp)||0);
    // Lv1 at 0; ~Lv5 at ~800; ~Lv10 at ~3000
    return 1 + Math.floor(Math.sqrt(xp / 80));
  }

  function awardCardFromGrade(g){
    // ✅ D = no card
    if(g==='S' || g==='A' || g==='B' || g==='C') return g;
    return '';
  }

  function computeXpGain({ score, accPct, bestCombo, missTotal, reason }){
    const win = (reason === 'win');
    // base from score
    let xp = Math.floor((score||0) / 30);            // 0..~30+
    xp += Math.floor((accPct||0) / 10);             // 0..10
    xp += Math.min(12, Math.floor((bestCombo||0) / 3)); // 0..12
    if(win) xp += 12;                               // win bonus
    xp -= Math.min(10, Math.floor((missTotal||0) / 2)); // penalty
    if(PRO && win) xp += 3;                         // PRO bonus
    // clamp
    xp = clamp(xp, 0, 45);
    return xp|0;
  }

  function updateRewards({ grade, xpGain, sum }){
    const kXp = heroXpKey(pid);
    const curXp = Number(lsGet(kXp)||'0') || 0;
    const nextXp = Math.max(0, curXp + (xpGain|0));
    lsSet(kXp, String(nextXp));

    // card book
    const kBook = cardBookKey(pid);
    const book = parseJson(lsGet(kBook), null) || { pid, cards:{S:0,A:0,B:0,C:0}, last: null, history: [] };
    const card = awardCardFromGrade(grade);
    if(card){
      book.cards[card] = (book.cards[card]||0) + 1;
    }
    const level = levelFromXp(nextXp);

    const reward = {
      pid,
      game: HH_GAME,
      at: nowIso(),
      grade,
      card: card || '—',
      xpGain: xpGain|0,
      xpTotal: nextXp|0,
      level,
      reason: sum?.reason || '',
      score: sum?.score || 0,
      accPct: sum?.accPct || 0,
      missTotal: sum?.missTotal || 0,
      bestCombo: bestCombo|0,
      // hints for UI
      cardHint: card ? `รับการ์ด ${card} แล้ว! เก็บสะสมไว้แลก Badge` : `เกรด D ยังไม่ได้การ์ด (ลองลด Miss + ยิงแม่นขึ้น)`,
    };

    book.last = reward;
    book.history = Array.isArray(book.history) ? book.history : [];
    book.history.unshift(reward);
    book.history = book.history.slice(0, 30);
    lsSet(kBook, JSON.stringify(book));
    lsSet(lastRewardKey(pid), JSON.stringify(reward));
    lsSet('HHA_LAST_REWARD', JSON.stringify(reward)); // global convenience

    // broadcast
    try{ WIN.dispatchEvent(new CustomEvent('hha:reward', { detail: reward })); }catch(_){}

    return reward;
  }

  function endGame(reason){
    if(!playing) return;
    playing = false;

    for(const [id,t] of targets){
      try{ t.el.remove(); }catch(e){}
    }
    targets.clear();

    const grade = gradeFromScore();
    const accPct = shots ? Math.round((hits/shots)*100) : 0;

    const sum = {
      game: HH_GAME,
      pid,
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
      startTimeIso,
      endTimeIso: nowIso()
    };
    try{
      lsSet(`HHA_LAST_SUMMARY:${HH_GAME}:${pid}`, JSON.stringify(sum));
      lsSet('HHA_LAST_SUMMARY', JSON.stringify(sum));
    }catch(e){}

    // ✅ REWARD compute + save + emit
    const xpGain = computeXpGain({ score, accPct, bestCombo, missTotal, reason });
    const reward = updateRewards({ grade, xpGain, sum });

    try{
      WIN.dispatchEvent(new CustomEvent('hha:end', { detail: sum }));
    }catch(e){}

    if(endOverlay){
      endOverlay.style.display = 'flex';
      if(endTitle) endTitle.textContent = (reason==='win') ? 'ชนะแล้ว! 🎉' : 'จบเกม';
      if(endSub) endSub.textContent = `score ${score} • acc ${accPct}% • miss ${missTotal} • reason=${reason}`;
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
      hitTarget(id, x, y);
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

  function hitTarget(id, x, y){
    const t = targets.get(id);
    if(!t || !playing) return;

    shots++;
    const type = t.type;

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
      shield = Math.min(9, shield + 1);
      score += 6;
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
      if(bossHp <= 0) endGame('win');
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

    const acc = shots ? Math.round((hits/shots)*100) : 0;
    const explain = coachTop2(missGoodExpired, missJunkHit, shots, acc);
    if(explain) sayCoach(explain);

    setHUD();

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

  // ---------- input: hha:shoot => hit nearest target ----------
  function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }

  function shootAtCenter(){
    if(!playing) return;
    const r = layerRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;

    let best=null, bestD=Infinity, bestXY=null;
    for(const [id,t] of targets){
      const br = t.el.getBoundingClientRect();
      const tx = br.left + br.width/2;
      const ty = br.top  + br.height/2;
      const d = dist2(cx,cy,tx,ty);
      if(d < bestD){
        bestD = d;
        best = id;
        bestXY = { x: tx, y: ty };
      }
    }
    if(best && bestXY){
      hitTarget(best, bestXY.x, bestXY.y);
    }else{
      shots++;
      combo = 0;
      setHUD();
    }
  }

  WIN.addEventListener('hha:shoot', ()=>{
    try{ shootAtCenter(); }catch(e){}
  });

  // ---------- tick ----------
  function tick(){
    const t = nowMs();
    let dt = (t - lastTick) / 1000;
    lastTick = t;
    dt = clamp(dt, 0, 0.05);

    if(!playing) return;

    if(paused){
      setHUD();
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
    setHUD();

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

  if(WAIT_START){
    sayCoach('BATTLE/RACE: รอเริ่มพร้อมกัน… ⏳');
  }else{
    sayCoach('พร้อมแล้ว! ยิงของดี 🥦 (กด H ย่อ HUD ได้)');
  }

  requestAnimationFrame(tick);
}