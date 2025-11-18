// fitness/js/jump-duck.js
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ----- DOM refs ----- */
const viewMenu     = $('#view-menu');
const viewResearch = $('#view-research');
const viewPlay     = $('#view-play');
const viewResult   = $('#view-result');

const elDiffSel = $('#difficulty');

const elHudMode  = $('#hud-mode');
const elHudDiff  = $('#hud-diff');
const elHudTime  = $('#hud-time');
const elHudScore = $('#hud-score');
const elHudCombo = $('#hud-combo');
const elHudMiss  = $('#hud-miss');

const playArea   = $('#playArea');
const lane       = $('#lane');
const hero       = $('#hero');
const judgeLabel = $('#judgeLabel');
const feverFill  = $('#feverFill');

const coachBubble = $('#coachBubble');
const comboCallEl = $('#comboCall');

/* result */
const resMode     = $('#res-mode');
const resDiff     = $('#res-diff');
const resEnd      = $('#res-end');
const resScore    = $('#res-score');
const resMaxCombo = $('#res-maxcombo');
const resObs      = $('#res-obs');
const resHits     = $('#res-hits');
const resMiss     = $('#res-miss');
const resAcc      = $('#res-acc');
const resRTMean   = $('#res-rtmean');
const resRTSD     = $('#res-rtsd');
const resFatigue  = $('#res-fatigue');

/* ----- Config ----- */

const GAME_DURATION_MS = 60000;

const DIFF_CONFIG = {
  easy:   { durationMs:60000, spawnIntervalMs:1200, travelMs:1700, judgeWindowMs:260, scorePer:8 },
  normal: { durationMs:60000, spawnIntervalMs:900,  travelMs:1500, judgeWindowMs:220, scorePer:10 },
  hard:   { durationMs:60000, spawnIntervalMs:700,  travelMs:1300, judgeWindowMs:190, scorePer:12 }
};

/* coach */
const COACH_LINES = {
  welcome: 'โฟกัสที่สิ่งกีดขวางให้ดี แล้วเลือกโดด/หมอบให้ถูก / Focus obstacles & choose jump/duck correctly 💡',
  combo:   'คอมโบยาวมาก สุดยอด! / Huge streak, awesome reflex! 🔥',
  miss:    'ชนไปนิดหน่อย รอบหน้าอ่านรูปสิ่งกีดขวางให้ชัดขึ้นนะ / Small miss, read obstacle shape more carefully 👍'
};
let lastCoachAt = 0;
let lastCoachSnapshot = null;
const COACH_COOLDOWN_MS = 4500;

/* state */

let gameMode = 'play'; // 'play' | 'research'
let sessionMeta = null;
let state = null;
let rafId = null;
let logger = null;
let pendingResearch = null;

/* CSV logger (self contained) */

function createCSVLogger(meta){
  const rows = [];
  const header = [
    'timestamp','event',
    'playerId','group','phase','mode',
    'difficulty',
    'obstacleId','obstacleType','actionType',
    'result','score','combo','missCount',
    'reactionMs'
  ];
  rows.push(header);

  function push(ev,extra){
    const t = Date.now();
    const e = extra || {};
    rows.push([
      t,ev,
      meta.playerId||'', meta.group||'', meta.phase||'', meta.mode||'',
      meta.difficulty||'',
      e.id ?? '', e.obstacleType ?? '', e.actionType ?? '',
      e.result ?? '', e.score ?? '', e.combo ?? '', e.missCount ?? '',
      e.reactionMs ?? ''
    ]);
  }

  return {
    logSpawn(info){
      push('spawn',{ id:info.id, obstacleType:info.type });
    },
    logHit(info){
      push('hit',{
        id:info.id,
        obstacleType:info.obstacleType,
        actionType:info.actionType,
        result:info.result,
        score:info.score,
        combo:info.combo,
        missCount:info.missCount,
        reactionMs:info.reactionMs
      });
    },
    logExpire(info){
      push('expire',{ id:info.id, obstacleType:info.type, result:info.result });
    },
    finish(payload){
      push('summary',{
        result:payload.endedBy,
        score:payload.score,
        combo:payload.maxCombo,
        missCount:payload.missCount
      });

      if (meta.mode === 'research'){
        const csv = rows.map(r=>r.map(v=>{
          const s = String(v ?? '');
          if (s.includes('"') || s.includes(',')) return '"' + s.replace(/"/g,'""') + '"';
          return s;
        }).join(',')).join('\r\n');

        const blob = new Blob([csv],{type:'text/csv'});
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `vrfitness_jumpduck-${meta.difficulty}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>{
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },100);
      }
    }
  };
}

/* dashboard stub */

function recordSessionToDashboard(summary){
  try{
    const key = 'vrfit_sessions_jumpduck';
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.push({...summary, ts:Date.now()});
    localStorage.setItem(key, JSON.stringify(arr));
  }catch(e){}
}

/* helpers */

function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>v.classList.add('hidden'));
  if (name==='menu')    viewMenu.classList.remove('hidden');
  if (name==='research')viewResearch.classList.remove('hidden');
  if (name==='play')    viewPlay.classList.remove('hidden');
  if (name==='result')  viewResult.classList.remove('hidden');
}
function mapEndReason(code){
  switch(code){
    case 'timeout': return 'ครบเวลา / Timeout';
    case 'manual':  return 'หยุดเอง / Stopped by player';
    default:        return code || '-';
  }
}
const fmtPercent = v => (v==null||Number.isNaN(v))?'-':(v*100).toFixed(1)+' %';
const fmtMs      = v => (!v||v<=0)?'-':v.toFixed(0)+' ms';
const fmtFloat   = (v,d=2)=>(v==null||Number.isNaN(v))?'-':v.toFixed(d);

/* judge label */
let judgeTimer = null;
function showJudge(text,kind){
  if (!judgeLabel) return;
  judgeLabel.textContent = text;
  judgeLabel.className = 'judge show';
  if (kind) judgeLabel.classList.add('judge-'+kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=> judgeLabel.classList.remove('show'), 380);
}

/* particles */
function spawnHitParticle(parent,x,y,emoji){
  if (!parent) return;
  const el = document.createElement('div');
  el.className = 'hitParticle';
  el.textContent = emoji || '💥';
  el.style.left = x+'px';
  el.style.top  = y+'px';
  parent.appendChild(el);
  setTimeout(()=> el.remove(), 480);
}

/* SFX (optional) */
const sfxCache = {};
['jump','duck','hit','miss','fever'].forEach(name=>{
  try{
    const a = new Audio('../sfx/'+name+'.mp3');
    a.preload = 'auto';
    sfxCache[name]=a;
  }catch(e){}
});
function playSFX(name){
  const a = sfxCache[name];
  if (!a) return;
  try{ a.currentTime=0; a.play().catch(()=>{}); }catch(e){}
}

/* fever bar */

function updateFeverVisual(){
  if (!state || !feverFill || !playArea) return;
  const c = Math.max(0,Math.min(100,state.fever));
  feverFill.style.width = c+'%';
  if (state.feverActive) playArea.classList.add('hot');
  else playArea.classList.remove('hot');
}

/* coach */

function showCoach(key){
  const now = performance.now();
  if (!coachBubble || now-lastCoachAt<COACH_COOLDOWN_MS) return;
  lastCoachAt = now;
  coachBubble.textContent = COACH_LINES[key] || '';
  coachBubble.classList.remove('hidden');
  setTimeout(()=> coachBubble && coachBubble.classList.add('hidden'), 3800);
}
function updateCoach(){
  if (!state) return;
  const snap = { combo:state.combo, miss:state.missCount };
  if (!lastCoachSnapshot){
    showCoach('welcome');
    lastCoachSnapshot = snap;
    return;
  }
  const prev = lastCoachSnapshot;
  if (snap.combo>=10 && prev.combo<10) showCoach('combo');
  else if (snap.miss>prev.miss) showCoach('miss');
  lastCoachSnapshot = snap;
}

/* session meta */

function buildSessionMeta(diffKey){
  const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
  let playerId='anon', group='', phase='';
  if (gameMode==='research' && pendingResearch){
    playerId = pendingResearch.id || 'anon';
    group    = pendingResearch.group || '';
    phase    = pendingResearch.phase || '';
  }
  return {
    playerId,group,phase,
    mode:gameMode,
    difficulty:diffKey,
    durationMs:diffCfg.durationMs
  };
}

/* start game */

function startGame(kind){
  gameMode = (kind==='research') ? 'research' : 'play';
  const diffKey = elDiffSel?.value || 'normal';
  const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;

  sessionMeta = buildSessionMeta(diffKey);

  const now = performance.now();
  state = {
    diffKey,
    durationMs: diffCfg.durationMs,
    spawnIntervalMs: diffCfg.spawnIntervalMs,
    travelMs: diffCfg.travelMs,
    judgeWindowMs: diffCfg.judgeWindowMs,
    scorePer: diffCfg.scorePer,

    startTime: now,
    elapsed:0,
    nextSpawnAt: now+600,

    obstacles:[],
    nextId:1,

    score:0,
    combo:0,
    maxCombo:0,
    missCount:0,
    hits:0,

    fever:0,
    feverActive:false,
    feverUntil:0
  };

  if (elHudMode)  elHudMode.textContent = (gameMode==='research'?'Research':'Play');
  if (elHudDiff)  elHudDiff.textContent = diffKey;
  if (elHudScore) elHudScore.textContent = '0';
  if (elHudCombo) elHudCombo.textContent = '0';
  if (elHudMiss)  elHudMiss.textContent  = '0';
  if (elHudTime)  elHudTime.textContent  = (state.durationMs/1000).toFixed(1);

  lane.querySelectorAll('.obs').forEach(o=>o.remove());
  lastCoachAt = 0;
  lastCoachSnapshot = null;
  if (coachBubble) coachBubble.classList.add('hidden');

  logger = createCSVLogger(sessionMeta);
  updateFeverVisual();
  showView('play');

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

/* loop */

function loop(now){
  if (!state) return;

  state.elapsed = now - state.startTime;
  const remain = Math.max(0,state.durationMs - state.elapsed);
  if (elHudTime) elHudTime.textContent = (remain/1000).toFixed(1);

  if (state.elapsed >= state.durationMs){
    stopGame('timeout');
    return;
  }

  // fever decay
  const dtSec = 16/1000;
  if (!state.feverActive){
    state.fever = Math.max(0,state.fever-6*dtSec);
  }else if (now>=state.feverUntil){
    state.feverActive=false;
  }
  updateFeverVisual();

  // spawn obstacle
  while(now >= state.nextSpawnAt){
    spawnObstacle(state.nextSpawnAt);
    state.nextSpawnAt += state.spawnIntervalMs;
  }

  // auto expire & miss
  const windowMs = state.judgeWindowMs;
  for (const obs of state.obstacles){
    if (obs.resolved) continue;
    if (now >= obs.hitTime + windowMs + 120){
      obs.resolved = true;
      state.missCount++;
      state.combo = 0;
      if (elHudMiss) elHudMiss.textContent = String(state.missCount);
      showJudge('MISS','miss');
      logger?.logExpire({id:obs.id,type:obs.type,result:'miss'});
      if (playArea){
        playArea.classList.add('shake');
        setTimeout(()=> playArea.classList.remove('shake'),140);
      }
    }
  }

  updateCoach();
  rafId = requestAnimationFrame(loop);
}

/* spawn obstacle */

function spawnObstacle(spawnTime){
  const type = Math.random()<0.5 ? 'jump' : 'duck';
  const id   = state.nextId++;
  const travel = state.travelMs;

  const hitTime = spawnTime + travel*0.55;

  const obs = { id, type, spawnTime, hitTime, resolved:false, success:false, rt:null };
  state.obstacles.push(obs);

  const el = document.createElement('div');
  el.className = 'obs ' + (type==='jump'?'obs-low':'obs-high');
  el.dataset.id = String(id);
  el.textContent = (type==='jump'?'⬛':'⚡');
  el.style.animationDuration = travel+'ms';
  lane.appendChild(el);

  setTimeout(()=> el.remove(), travel+200);

  logger?.logSpawn({id,type});
}

/* handle action */

function handleAction(action,ev){
  if (!state) return;
  const now = performance.now();
  const windowMs = state.judgeWindowMs;

  // hero anim
  if (hero){
    hero.classList.remove('hero-jump','hero-duck');
    hero.classList.add(action==='jump'?'hero-jump':'hero-duck');
    setTimeout(()=> hero.classList.remove('hero-jump','hero-duck'),260);
  }

  // particle
  if (playArea && ev){
    const rect = playArea.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    spawnHitParticle(playArea,x,y,'💥');
  }

  // best obstacle near hit zone
  let best=null, bestDt=Infinity;
  for (const obs of state.obstacles){
    if (obs.resolved) continue;
    const dt = Math.abs(now - obs.hitTime);
    if (dt<=windowMs && dt<bestDt){
      best = obs; bestDt = dt;
    }
  }

  if (!best){
    state.missCount++;
    state.combo = 0;
    if (elHudMiss) elHudMiss.textContent = String(state.missCount);
    showJudge('MISS','miss');
    playSFX('miss');
    if (playArea){
      playArea.classList.add('shake');
      setTimeout(()=> playArea.classList.remove('shake'),140);
    }
    return;
  }

  best.resolved = true;
  const rt = now - best.hitTime;
  best.rt = rt;

  const correctType = (action===best.type);
  if (!correctType){
    state.missCount++;
    state.combo=0;
    if (elHudMiss) elHudMiss.textContent = String(state.missCount);
    showJudge('MISS','miss');
    playSFX('miss');
    if (playArea){
      playArea.classList.add('shake');
      setTimeout(()=> playArea.classList.remove('shake'),140);
    }
    logger?.logHit({
      id:best.id,
      obstacleType:best.type,
      actionType:action,
      result:'wrong-action',
      score:state.score,
      combo:state.combo,
      missCount:state.missCount,
      reactionMs:Math.abs(rt)
    });
    return;
  }

  // timing
  let quality='good';
  if (Math.abs(rt)<=windowMs*0.4) quality='perfect';

  state.hits++;
  state.combo++;
  if (state.combo>state.maxCombo) state.maxCombo = state.combo;

  let gain = state.scorePer;
  if (quality==='perfect') gain += 4;

  const mult = state.feverActive ? 2 : 1;
  state.score += gain*mult;

  state.fever += (quality==='perfect'?10:6);
  if (!state.feverActive && state.fever>=100){
    state.feverActive=true;
    state.feverUntil=now+5000;
    playSFX('fever');
    comboCall('FEVER!! 🔥');
  }

  if (elHudScore) elHudScore.textContent = String(state.score);
  if (elHudCombo) elHudCombo.textContent = String(state.combo);

  showJudge(quality==='perfect'?'PERFECT':'GOOD','good');
  playSFX(action==='jump'?'jump':'duck');
  updateFeverVisual();

  logger?.logHit({
    id:best.id,
    obstacleType:best.type,
    actionType:action,
    result:quality,
    score:state.score,
    combo:state.combo,
    missCount:state.missCount,
    reactionMs:Math.abs(rt)
  });

  if (state.combo===5 || state.combo===10 || state.combo===20){
    comboCall('COMBO x'+state.combo+'! 🔥');
  }
}

/* combo overlay */

function comboCall(text){
  if (!comboCallEl) return;
  comboCallEl.textContent = text;
  comboCallEl.classList.add('show');
  setTimeout(()=> comboCallEl.classList.remove('show'),600);
}

/* analytics */

function computeAnalytics(){
  const obs = state ? state.obstacles : [];
  if (!obs || !obs.length){
    return {
      total:0,hits:0,miss:0,
      accuracy:0,rtMean:0,rtStd:0,fatigue:0
    };
  }
  const total = obs.length;
  const hitObs = obs.filter(o=>o.resolved && o.rt!=null && o.rt!==0);
  const hits  = hitObs.length;
  const miss  = total - hits;

  const rtList = hitObs.map(o=>Math.abs(o.rt));
  const rtMean = rtList.length ? rtList.reduce((a,b)=>a+b,0)/rtList.length : 0;
  let rtStd=0;
  if (rtList.length>1){
    const m=rtMean;
    const varSum = rtList.reduce((a,b)=>a+Math.pow(b-m,2),0)/(rtList.length-1);
    rtStd = Math.sqrt(varSum);
  }

  let fatigue = 0;
  if (hitObs.length>=4){
    const n = hitObs.length;
    const seg = Math.max(1,Math.floor(n*0.25));
    const early = hitObs.slice(0,seg).map(o=>Math.abs(o.rt));
    const late  = hitObs.slice(-seg).map(o=>Math.abs(o.rt));
    const mE = early.reduce((a,b)=>a+b,0)/early.length;
    const mL = late.reduce((a,b)=>a+b,0)/late.length;
    if (mE>0) fatigue = (mL-mE)/mE;
  }

  return {
    total,
    hits,
    miss,
    accuracy: total? hits/total : 0,
    rtMean,
    rtStd,
    fatigue
  };
}

/* stop */

function stopGame(endedBy){
  if (!state) return;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }

  const a = computeAnalytics();

  logger?.finish({
    endedBy:mapEndReason(endedBy),
    score:state.score,
    maxCombo:state.maxCombo,
    missCount:state.missCount,
    analytics:a
  });

  const summary = {
    mode:sessionMeta.mode,
    difficulty:sessionMeta.difficulty,
    score:state.score,
    maxCombo:state.maxCombo,
    missCount:state.missCount,
    totalObstacles:a.total,
    hits:a.hits,
    accuracy:a.accuracy,
    avgReactionMs:a.rtMean,
    fatigueIndex:a.fatigue
  };
  recordSessionToDashboard(summary);

  // fill result
  resMode.textContent     = (sessionMeta.mode==='research'?'Research':'Play');
  resDiff.textContent     = sessionMeta.difficulty || '-';
  resEnd.textContent      = mapEndReason(endedBy);
  resScore.textContent    = String(state.score);
  resMaxCombo.textContent = String(state.maxCombo);
  resObs.textContent      = String(a.total);
  resHits.textContent     = String(a.hits);
  resMiss.textContent     = String(a.miss);
  resAcc.textContent      = fmtPercent(a.accuracy);
  resRTMean.textContent   = fmtMs(a.rtMean);
  resRTSD.textContent     = fmtMs(a.rtStd);
  resFatigue.textContent  = fmtFloat(a.fatigue,3);

  state = null;
  showView('result');
}

/* init & events */

function init(){
  // menu
  $('[data-action="start-normal"]')?.addEventListener('click',()=>{
    pendingResearch=null;
    startGame('play');
  });
  $('[data-action="goto-research"]')?.addEventListener('click',()=>{
    showView('research');
  });
  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click',()=> showView('menu'));
  });

  // research
  $('[data-action="start-research"]')?.addEventListener('click',()=>{
    pendingResearch = {
      id:   $('#researchId')?.value.trim()   || 'anon',
      group:$('#researchGroup')?.value.trim()|| '',
      phase:$('#researchPhase')?.value.trim()|| ''
    };
    startGame('research');
  });

  // stop
  $('[data-action="stop"]')?.addEventListener('click',()=>{
    if (state) stopGame('manual');
  });

  // playArea pointer: top = jump, bottom = duck
  playArea?.addEventListener('pointerdown',ev=>{
    ev.preventDefault();
    const rect = playArea.getBoundingClientRect();
    const relY = ev.clientY - rect.top;
    const action = (relY < rect.height/2) ? 'jump' : 'duck';
    handleAction(action,ev);
  },{passive:false});

  // keyboard
  window.addEventListener('keydown',ev=>{
    if (!state) return;
    if (ev.key==='ArrowUp' || ev.key===' '){
      handleAction('jump');
    }else if (ev.key==='ArrowDown' || ev.key==='Shift'){
      handleAction('duck');
    }
  });

  showView('menu');
}

window.addEventListener('DOMContentLoaded', init);