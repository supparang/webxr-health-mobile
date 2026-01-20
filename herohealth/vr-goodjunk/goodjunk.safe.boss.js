// === /herohealth/vr-goodjunk/goodjunk.safe.boss.js ===
// GoodJunkVR SAFE — BOSS PACK (HARD++ but FAIR)
// ✅ Boss on miss>=4; HP by diff: 10/12/14
// ✅ Phase2 lasts 6s then back to P1
// ✅ Storm when timeLeft<=30s (once)
// ✅ Still fair: no AI director, no hidden adaptive tricks
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:storm, hha:boss, hha:end

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const now = ()=>performance.now();
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();
  const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 140;
  const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 130;

  const x = 22;
  const y = Math.max(80, top);
  const w = Math.max(120, r.width - 44);
  const h = Math.max(140, r.height - y - bot);

  return { x,y,w,h };
}

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');
  const layer   = DOC.getElementById('gj-layer');

  const bossBar = DOC.getElementById('gjBossBar');
  const bossFill= DOC.getElementById('gjBossFill');
  const bossNum = DOC.getElementById('gjBossNum');

  const BOSS_HP_MAX = (diff==='easy') ? 10 : (diff==='hard' ? 14 : 12);

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng: makeRNG(seed),

    score:0, miss:0,
    hitGood:0, hitJunk:0, expireGood:0,
    combo:0, comboMax:0,

    lastTick:0,
    lastSpawn:0,

    storm:false,

    boss:false,
    bossHp:0,
    bossHpMax:BOSS_HP_MAX,
    bossPhase:0, // 0 none, 1 p1, 2 p2
    phase2Sec:6,
    phase2Until:0
  };

  function setBossUI(show){
    if(!bossBar) return;
    bossBar.style.display = show ? 'flex' : 'none';
    bossBar.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  function renderBoss(){
    if(!S.boss) { setBossUI(false); return; }
    setBossUI(true);
    const pct = (S.bossHpMax<=0) ? 0 : (S.bossHp / S.bossHpMax) * 100;
    if(bossFill) bossFill.style.width = `${clamp(pct,0,100)}%`;
    if(bossNum) bossNum.textContent = `${S.bossHp}/${S.bossHpMax} · P${S.bossPhase}`;
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);

    let g='C';
    if(S.score>=180 && S.miss<=3) g='A';
    else if(S.score>=120) g='B';
    else if(S.score>=70) g='C';
    else g='D';
    if(elGrade) elGrade.textContent = g;

    emit('hha:score',{ score:S.score });
  }

  function bossOn(){
    if(S.boss) return;
    S.boss = true;
    S.bossHp = S.bossHpMax;
    S.bossPhase = 1;
    S.phase2Until = 0;
    renderBoss();
    emit('hha:boss', { on:true, hp:S.bossHp, hpMax:S.bossHpMax, phase:S.bossPhase, phase2Sec:S.phase2Sec });
    emit('hha:judge', { type:'bad', label:'BOSS!' });
  }

  function bossDamage(dmg){
    if(!S.boss) return;
    S.bossHp = clamp(S.bossHp - Math.max(1, dmg|0), 0, S.bossHpMax);

    // enter phase2 at half
    const half = Math.ceil(S.bossHpMax * 0.5);
    if(S.bossPhase !== 2 && S.bossHp <= half){
      S.bossPhase = 2;
      S.phase2Until = now() + S.phase2Sec*1000;
      emit('hha:boss', { on:true, hp:S.bossHp, hpMax:S.bossHpMax, phase:2, phase2Sec:S.phase2Sec });
      emit('hha:judge', { type:'bad', label:'PHASE 2!' });
    }

    // clear boss
    if(S.bossHp <= 0){
      S.boss = false;
      S.bossPhase = 0;
      S.phase2Until = 0;
      renderBoss();
      emit('hha:boss', { on:false, hp:0, hpMax:S.bossHpMax, phase:0 });
      emit('hha:judge', { type:'perfect', label:'BOSS DOWN!' });
    }else{
      renderBoss();
    }
  }

  function bossTick(){
    if(!S.boss) return;
    if(S.bossPhase === 2 && S.phase2Until>0 && now() >= S.phase2Until){
      S.bossPhase = 1;
      S.phase2Until = 0;
      emit('hha:boss', { on:true, hp:S.bossHp, hpMax:S.bossHpMax, phase:1, phase2Sec:S.phase2Sec });
      renderBoss();
    }
  }

  function stormOn(){
    if(S.storm) return;
    S.storm = true;
    emit('hha:storm', { on:true, t:S.timeLeft });
    emit('hha:judge', { type:'warn', label:'STORM!' });
    DOC.body.classList.add('gj-storm-on');
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();
    const x = safe.x + S.rng()*safe.w;
    const y = safe.y + S.rng()*safe.h;

    const t = DOC.createElement('div');
    t.className = 'gj-target';
    t.textContent = (kind==='good' ? '🥦' : '🍟');
    t.style.left = x+'px';
    t.style.top  = y+'px';

    // phase2: smaller + faster (แรงแบบเห็นได้)
    const base = (kind==='good') ? 56 : 58;
    const size = (S.boss && S.bossPhase===2) ? (base-6) : base;
    t.style.fontSize = size+'px';

    let alive = true;

    t.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      alive=false;
      t.remove();

      if(kind==='good'){
        S.hitGood++;
        S.combo++;
        S.comboMax = Math.max(S.comboMax, S.combo);

        const bonus = S.boss ? (S.bossPhase===2 ? 2 : 1) : 0;
        S.score += 11 + Math.min(10, S.combo) + bonus;

        // good hits damage boss
        if(S.boss) bossDamage(S.bossPhase===2 ? 2 : 1);

        emit('hha:judge', { type:'good', label:'GOOD' });
      }else{
        S.hitJunk++;
        S.miss++;
        S.combo=0;

        // junk hit heals boss a bit (pressure but capped)
        if(S.boss && S.bossHp < S.bossHpMax) {
          S.bossHp = clamp(S.bossHp + (S.bossPhase===2 ? 2 : 1), 0, S.bossHpMax);
          renderBoss();
        }

        emit('hha:judge', { type:'bad', label:'OOPS' });
      }

      // boss trigger
      if(!S.boss && S.miss >= 4) bossOn();

      setHUD();
    });

    layer.appendChild(t);

    // TTL: fair baseline; phase2 shorter
    const ttl = (S.boss && S.bossPhase===2) ? 1300 : 1600;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      alive=false;
      t.remove();
      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo=0;

        // boss trigger
        if(!S.boss && S.miss >= 4) bossOn();

        emit('hha:judge', { type:'miss', label:'MISS' });
        setHUD();
      }
    }, ttl);
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    DOC.body.classList.remove('gj-storm-on');
    setBossUI(false);

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : '—';
    const summary = {
      game:'GoodJunkVR',
      pack:'boss',
      view:S.view,
      runMode:S.run,
      diff:S.diff,
      seed:S.seed,
      durationPlannedSec:S.timePlan,
      durationPlayedSec: Math.round(S.timePlan - S.timeLeft),
      scoreFinal:S.score,
      miss:S.miss,
      comboMax:S.comboMax,
      hitGood:S.hitGood,
      hitJunk:S.hitJunk,
      expireGood:S.expireGood,
      bossTriggered: S.boss || (S.miss>=4),
      bossHpMax: S.bossHpMax,
      grade,
      reason
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
    emit('hha:end', summary);
  }

  function tick(ts){
    if(S.ended) return;
    if(!S.lastTick) S.lastTick = ts;

    const dt = Math.min(0.25, (ts - S.lastTick)/1000);
    S.lastTick = ts;

    S.timeLeft = Math.max(0, S.timeLeft - dt);
    if(elTime) elTime.textContent = String(Math.ceil(S.timeLeft));
    emit('hha:time', { left:S.timeLeft });

    // storm trigger at 30s
    if(S.timeLeft <= 30 && !S.storm) stormOn();

    bossTick();

    // spawn interval:
    // fair baseline 860-920ms, storm slightly faster, boss P2 faster
    let interval = 900;
    if(S.storm) interval = 820;
    if(S.boss && S.bossPhase===1) interval = 780;
    if(S.boss && S.bossPhase===2) interval = 640;

    if(ts - S.lastSpawn >= interval){
      S.lastSpawn = ts;

      // junk ratio increases in storm/boss (but still fair)
      let junkRate = 0.28;
      if(S.storm) junkRate += 0.06;
      if(S.boss && S.bossPhase===1) junkRate += 0.08;
      if(S.boss && S.bossPhase===2) junkRate += 0.12;

      spawn(S.rng() < clamp(1 - junkRate, 0.35, 0.78) ? 'good' : 'junk');
    }

    if(S.timeLeft<=0){
      endGame('timeup');
      return;
    }
    requestAnimationFrame(tick);
  }

  // start
  S.started = true;
  setHUD();
  renderBoss();
  emit('hha:start', { game:'GoodJunkVR', pack:'boss', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}