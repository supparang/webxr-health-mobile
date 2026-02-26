// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (FX + Coach + hha:shoot + deterministic + end-event hardened + HUD-safe spawn)
// + ✅ Help Pause Hook (__GJ_SET_PAUSED__) for always-on Help overlay
// + ✅ End Summary: show "Go Cooldown (daily-first per-game)" button when needed
// FULL v20260226-SAFE-HELPPAUSE
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();

  function $(id){ return DOC.getElementById(id); }

  // ---------- COOL DOWN BUTTON (PER-GAME DAILY) ----------
  function hhDayKey(){
    const d=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(2,'0');
    const dd=String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function hhLsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }

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
      'plannedGame','finalGame','zone','cdnext','grade'
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

  // deterministic RNG (xmur3 + sfc32)
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

  // ---------- view/run/diff/time ----------
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);

  // hub / pid / cat / gameKey (used for cooldown button)
  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const HH_CAT = 'nutrition';
  const HH_GAME = 'goodjunk';

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

  // ---------- Coach (micro tips) ----------
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

  // ✅ Help Pause Hook
  let paused = false;
  WIN.__GJ_SET_PAUSED__ = function(on){
    paused = !!on;
    try{ lastTick = nowMs(); }catch(e){}
  };

  let score = 0;
  let missTotal = 0;
  let missGoodExpired = 0;
  let missJunkHit = 0;

  let combo = 0;
  let bestCombo = 0;

  let fever = 0;
  let rageOn = false;
  let rageLeft = 0;

  let shield = 0;
  let stormOn = false;

  let goodHitCount = 0;
  let rtSum = 0;
  const rtList = [];

  const goal = { name:'Daily', desc:'Hit GOOD 20', cur:0, target:20 };
  const mini = { name:'—', t:0 };

  let bossActive = false;
  let bossHpMax = TUNE.bossHp;
  let bossHp = bossHpMax;
  let bossPhase = 0;
  let bossShieldHp = 5;

  const targets = new Map();
  let idSeq = 1;

  WIN.__GJ_STATE__ = {
    targets,
    get miss(){ return missTotal; },
    get score(){ return score; },
    get combo(){ return combo; },
    get fever(){ return fever; }
  };

  function layerRect(){ return layer.getBoundingClientRect(); }

  function getSpawnSafeLocal(){
    const r = layerRect();
    let s = null;
    try{ s = WIN.__HHA_SPAWN_SAFE__ || null; }catch(e){ s = null; }

    if(s && Number.isFinite(s.xMin) && Number.isFinite(s.xMax) && Number.isFinite(s.yMin) && Number.isFinite(s.yMax)){
      let xMin = Number(s.xMin) - r.left;
      let xMax = Number(s.xMax) - r.left;
      let yMin = Number(s.yMin) - r.top;
      let yMax = Number(s.yMax) - r.top;

      xMin = clamp(xMin, 0, r.width);
      xMax = clamp(xMax, 0, r.width);
      yMin = clamp(yMin, 0, r.height);
      yMax = clamp(yMax, 0, r.height);

      if((xMax - xMin) >= 120 && (yMax - yMin) >= 140){
        return { xMin, xMax, yMin, yMax, w:r.width, h:r.height };
      }
    }

    const pad = 18;
    const yMin = Math.min(r.height - 160, 180);
    const yMax = Math.max(yMin + 160, r.height - 110);
    return {
      xMin: pad,
      xMax: Math.max(pad + 120, r.width - pad),
      yMin: clamp(yMin, pad, Math.max(pad, r.height - 200)),
      yMax: clamp(yMax, Math.max(pad+160, yMin+160), Math.max(pad+200, r.height - pad)),
      w: r.width,
      h: r.height
    };
  }

  WIN.__GJ_SET_SPAWN_SAFE__ = function(safe){
    try{ WIN.__HHA_SPAWN_SAFE__ = safe; }catch(e){}
  };

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

  function setHUD(){
    if(hud.score) hud.score.textContent = String(score|0);
    if(hud.time) hud.time.textContent = String(Math.ceil(tLeft));
    if(hud.miss) hud.miss.textContent = String(missTotal|0);
    if(hud.grade) hud.grade.textContent = gradeFromScore(score);

    if(hud.goal) hud.goal.textContent = goal.name;
    if(hud.goalCur) hud.goalCur.textContent = String(goal.cur|0);
    if(hud.goalTarget) hud.goalTarget.textContent = String(goal.target|0);
    if(hud.goalDesc) hud.goalDesc.textContent = goal.desc;

    if(hud.mini) hud.mini.textContent = mini.name;
    if(hud.miniTimer) hud.miniTimer.textContent = mini.t>0 ? `${Math.ceil(mini.t)}s` : '—';

    if(feverFill) feverFill.style.width = `${clamp(fever,0,100)}%`;
    if(feverText) feverText.textContent = `${Math.round(clamp(fever,0,100))}%`;

    if(shieldPills){
      if(shield<=0) shieldPills.textContent = '—';
      else shieldPills.textContent = '🛡️'.repeat(Math.min(6, shield));
    }

    if(bossBar){
      if(!bossActive){
        bossBar.setAttribute('aria-hidden','true');
      }else{
        bossBar.setAttribute('aria-hidden','false');
        const hpPct = (bossHpMax>0) ? (bossHp/bossHpMax)*100 : 0;
        if(bossFill) bossFill.style.width = `${clamp(hpPct,0,100)}%`;
        if(bossHint){
          bossHint.textContent =
            bossPhase===0 ? 'Shield up! Break 🛡️ first' : 'Weakspot 🎯 ! Big damage';
        }
      }
    }

    if(progressWrap && progressFill){
      const p = (plannedSec>0) ? (1 - (tLeft/plannedSec)) : 0;
      progressWrap.setAttribute('aria-hidden','false');
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
  }

  const __HHA_END_SENT_KEY = '__HHA_GJ_END_SENT__';
  function hhaDispatchEndOnce(summary){
    try{
      if(WIN[__HHA_END_SENT_KEY]) return;
      WIN[__HHA_END_SENT_KEY] = 1;
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary || null }));
    }catch(e){}
  }

  function median(arr){
    if(!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = (a.length/2)|0;
    return (a.length%2) ? a[m] : (a[m-1]+a[m])/2;
  }

  function buildEndSummary(reason){
    const playedSec = Math.round(plannedSec - tLeft);
    const avgRt = goodHitCount>0 ? Math.round(rtSum/goodHitCount) : 0;
    const medRt = Math.round(median(rtList));
    return {
      projectTag: 'GoodJunkVR',
      gameVersion: 'GoodJunkVR_SAFE_2026-02-26_HELPPAUSE',
      device: view,
      runMode: runMode,
      diff: diff,
      seed: seedStr,
      reason: String(reason || ''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: playedSec,
      scoreFinal: score|0,
      comboMax: bestCombo|0,
      missTotal: missTotal|0,
      missGoodExpired: missGoodExpired|0,
      missJunkHit: missJunkHit|0,
      avgRtGoodMs: avgRt,
      medianRtGoodMs: medRt,
      bossDefeated: !!(bossActive && bossHp<=0),
      stormOn: !!stormOn,
      rageOn: !!rageOn,
      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFromScore(score)
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
    WIN.__HHA_LAST_SUMMARY = summary;
    hhaDispatchEndOnce(summary);

    if(endOverlay){
      endOverlay.setAttribute('aria-hidden','false');
      if(endTitle) endTitle.textContent = 'Game Over';
      if(endSub) endSub.textContent = `reason=${summary.reason} | mode=${runMode} | view=${view}`;
      if(endGrade) endGrade.textContent = summary.grade || '—';
      if(endScore) endScore.textContent = String(summary.scoreFinal|0);
      if(endMiss)  endMiss.textContent  = String(summary.missTotal|0);
      if(endTime)  endTime.textContent  = String(summary.durationPlayedSec|0);

      try{
        hhInjectCooldownButton({ endOverlayEl: endOverlay, hub: hubUrl, cat: HH_CAT, gameKey: HH_GAME, pid });
      }catch(e){}
    }

    sayCoach(summary.missTotal >= TUNE.lifeMissLimit ? 'ลองโฟกัส “ของดี” ก่อนนะ แล้วค่อยเสี่ยง!' : 'ดีมาก! ไปต่อได้เลย ✨');
    setHUD();
  }

  function makeTarget(kind, emoji, ttlSec){
    const id = String(idSeq++);
    const el = DOC.createElement('div');
    el.className = 'gj-target';
    el.textContent = emoji;
    el.dataset.id = id;
    el.dataset.kind = kind;

    const safe = getSpawnSafeLocal();
    const rPad = (view==='mobile') ? 32 : 38;
    const xMin = safe.xMin + rPad;
    const xMax = safe.xMax - rPad;
    const yMin = safe.yMin + rPad;
    const yMax = safe.yMax - rPad;

    const x = xMin + r01()*(Math.max(1, xMax - xMin));
    const y = yMin + r01()*(Math.max(1, yMax - yMin));

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.opacity = '1';

    const drift = (r01()*2-1) * (view==='mobile' ? 16 : 22);
    const born = nowMs();
    const ttl = Math.max(0.8, ttlSec) * 1000;

    layer.appendChild(el);

    const tObj = { id, el, kind, born, ttl, x, y, drift, promptMs: nowMs() };
    targets.set(id, tObj);
    return tObj;
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
    sayCoach('ได้โล่! 🛡️ กันของเสียได้');
  }

  function onHitGood(t, clientX, clientY){
    const rt = Math.max(0, Math.round(nowMs() - (t.promptMs||nowMs())));
    goodHitCount++;
    rtSum += rt;
    rtList.push(rt);

    combo++;
    bestCombo = Math.max(bestCombo, combo);

    let add = 10 + Math.min(12, combo);
    if(rageOn) add = Math.round(add * 1.6);

    score += add;
    goal.cur = clamp(goal.cur + 1, 0, 9999);
    addFever(6.5);

    fxBurst(clientX, clientY);
    fxFloatText(clientX, clientY-10, `+${add}`, false);

    if(combo===5) sayCoach('คอมโบเริ่มมาแล้ว! 🔥');
    if(rt <= 520 && combo>=3) sayCoach('ดี! รีแอคไวมาก');

    removeTarget(t.id);
  }

  function onHitJunk(t, clientX, clientY){
    if(shield > 0){
      shield--;
      fxBurst(clientX, clientY);
      fxFloatText(clientX, clientY-10, 'BLOCK 🛡️', false);
      sayCoach('บล็อกได้! โดนของเสียไม่เป็นไร');
      removeTarget(t.id);
      return;
    }

    missTotal++;
    missJunkHit++;
    combo = 0;

    const sub = 8;
    score = Math.max(0, score - sub);

    fxFloatText(clientX, clientY-10, `-${sub}`, true);
    removeTarget(t.id);

    if(missTotal===3) sayCoach('ระวังของเสีย! เห็น 🍔🍟 แล้วเลี่ยง');
  }

  function onHitBonus(t, clientX, clientY){
    combo++;
    bestCombo = Math.max(bestCombo, combo);

    let add = rPick([25,30,35]);
    if(rageOn) add = Math.round(add * 1.5);
    score += add;

    fxBurst(clientX, clientY);
    fxFloatText(clientX, clientY-10, `BONUS +${add}`, false);
    sayCoach('โบนัสมา! เก็บต่อเนื่องเลย');

    removeTarget(t.id);
  }

  function onHitShield(t, clientX, clientY){
    addShield();
    fxBurst(clientX, clientY);
    fxFloatText(clientX, clientY-10, '+SHIELD', false);
    removeTarget(t.id);
  }

  function onHitBoss(t, clientX, clientY){
    if(!bossActive) return;

    if(bossPhase===0){
      bossShieldHp--;
      fxBurst(clientX, clientY);
      fxFloatText(clientX, clientY-10, 'SHIELD -1', false);
      if(bossShieldHp<=0){
        bossPhase = 1;
        sayCoach('โล่แตก! ยิง 🎯 เพื่อทำดาเมจหนัก');
      }
      removeTarget(t.id);
      return;
    }

    const dmg = rageOn ? 4 : 3;
    bossHp = Math.max(0, bossHp - dmg);

    let add = 22 + dmg*6;
    if(rageOn) add = Math.round(add * 1.4);
    score += add;
    addFever(9);

    fxBurst(clientX, clientY);
    fxFloatText(clientX, clientY-10, `BOSS +${add}`, false);

    removeTarget(t.id);

    if(bossHp<=0){
      sayCoach('บอสแพ้แล้ว! 🎉');
      bossActive = false;
      score += 120;
      addFever(40);
    }
  }

  function hitTargetById(id, clientX, clientY){
    const t = targets.get(String(id));
    if(!t || !playing) return;

    const kind = t.kind;
    if(kind==='good') onHitGood(t, clientX, clientY);
    else if(kind==='junk') onHitJunk(t, clientX, clientY);
    else if(kind==='bonus') onHitBonus(t, clientX, clientY);
    else if(kind==='shield') onHitShield(t, clientX, clientY);
    else if(kind==='boss') onHitBoss(t, clientX, clientY);
  }

  function onPointerDown(ev){
    if(!playing || paused) return;
    const el = ev.target && ev.target.closest ? ev.target.closest('.gj-target') : null;
    if(!el) return;
    const id = el.dataset.id;
    hitTargetById(id, ev.clientX, ev.clientY);
  }
  layer.addEventListener('pointerdown', onPointerDown, { passive:true });

  function pickTargetAt(x,y, lockPx){
    lockPx = clamp(lockPx ?? 44, 16, 120);
    let best = null;
    let bestD = 1e9;
    for(const t of targets.values()){
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const d = Math.hypot(cx-x, cy-y);
      if(d < bestD){
        bestD = d;
        best = t;
      }
    }
    if(best && bestD <= lockPx) return best;
    return null;
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    try{
      const lockPx = ev?.detail?.lockPx ?? 56;
      const r = layerRect();
      const x = r.left + r.width/2;
      const y = r.top  + r.height/2;
      const t = pickTargetAt(x,y, lockPx);
      if(t) hitTargetById(t.id, x, y);
    }catch(e){}
  });

  let spawnAcc = 0;
  function spawnTick(dt){
    stormOn = (tLeft <= Math.min(40, plannedSec*0.45));
    const mult = stormOn ? TUNE.stormMult : 1.0;
    const base = TUNE.spawnBase * mult;
    const rageBoost = rageOn ? 1.18 : 1.0;

    spawnAcc += base * rageBoost * dt;

    while(spawnAcc >= 1){
      spawnAcc -= 1;

      if(!bossActive && tLeft <= plannedSec*0.35 && tLeft > 6){
        bossActive = true;
        bossHpMax = TUNE.bossHp;
        bossHp = bossHpMax;
        bossPhase = 0;
        bossShieldHp = 5;
        sayCoach('บอสมาแล้ว! แตกโล่ 🛡️ ก่อน');
      }

      let kind = 'good';
      const p = r01();

      if(bossActive && (r01() < 0.22)){
        kind = 'boss';
      }else if(p < 0.64){
        kind = 'good';
      }else if(p < 0.86){
        kind = 'junk';
      }else if(p < 0.94){
        kind = 'bonus';
      }else{
        kind = 'shield';
      }

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
    const rPad = (view==='mobile') ? 32 : 38;

    for(const t of Array.from(targets.values())){
      const age = tNow - t.born;
      const p = age / t.ttl;

      const dx = t.drift * dt;
      t.x += dx;

      const xMin = safe.xMin + rPad;
      const xMax = safe.xMax - rPad;
      t.x = clamp(t.x, xMin, xMax);
      t.el.style.left = `${t.x}px`;

      if(p > 0.75){
        t.el.style.opacity = String(clamp(1 - (p-0.75)/0.25, 0.15, 1));
        t.el.style.transform = `translate(-50%,-50%) scale(${1 - 0.08*(p-0.75)/0.25})`;
      }

      if(age >= t.ttl){
        if(t.kind === 'good'){
          missTotal++;
          missGoodExpired++;
          combo = 0;

          score = Math.max(0, score - 4);
          const r = t.el.getBoundingClientRect();
          fxFloatText(r.left+r.width/2, r.top+r.height/2, 'MISS', true);

          if(missTotal===1) sayCoach('ถ้าช้าไป ของดีจะหาย (นับ MISS) นะ');
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
      sayCoach('FEVER หมดแล้ว แต่ยังไหว!');
    }
  }

  function updateMini(dt){
    if(mini.t > 0){
      mini.t = Math.max(0, mini.t - dt);
      if(mini.t<=0) mini.name = '—';
    }else{
      if(r01() < dt*0.05){
        const type = rPick(['avoid-junk','combo-5','grab-bonus']);
        if(type==='avoid-junk'){
          mini.name = 'No JUNK 6s';
          mini.t = 6;
          sayCoach('ภารกิจ: 6 วิ ห้ามโดนของเสีย!');
        }else if(type==='combo-5'){
          mini.name = 'Combo x5';
          mini.t = 8;
          sayCoach('ภารกิจ: ทำคอมโบให้ถึง 5!');
        }else{
          mini.name = 'Grab ⭐';
          mini.t = 7;
          sayCoach('ภารกิจ: เก็บโบนัส!');
        }
      }
    }
  }

  function checkEnd(){
    if(tLeft <= 0){ showEnd('time'); return true; }
    if(missTotal >= TUNE.lifeMissLimit){ showEnd('miss-limit'); return true; }

    if(goal.cur >= goal.target && playing){
      goal.target += 10;
      score += 60;
      addFever(18);
      sayCoach('ทำเป้าหมายสำเร็จ! +60 ✨');
      const r = layerRect();
      fxBurst(r.left+r.width/2, r.top+r.height*0.55);
      fxFloatText(r.left+r.width/2, r.top+r.height*0.55, 'GOAL +60', false);
    }
    return false;
  }

  function tick(){
    if(!playing) return;

    // ✅ Pause-safe: do not advance timers/spawn while paused
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

    setHUD();

    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){
      showEnd('background');
    }
  });

  try{ WIN[__HHA_END_SENT_KEY] = 0; }catch(e){}
  sayCoach('แตะ “ของดี” เลี่ยงของเสีย! 🥦🍎');
  setHUD();
  requestAnimationFrame(tick);
}