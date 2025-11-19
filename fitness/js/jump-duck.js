// fitness/js/jump-duck.js
// Self-contained DOM engine สำหรับ Jump & Duck (PC / Mobile / VR WebView friendly)

'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---------- Views & elements ---------- */

const viewMenu    = $('#view-menu');
const viewResearch= $('#view-research');
const viewPlay    = $('#view-play');
const viewResult  = $('#view-result');

const elDiffSel   = $('#difficulty');

// HUD
const elHudMode   = $('#hud-mode');
const elHudDiff   = $('#hud-diff');
const elHudScore  = $('#hud-score');
const elHudCombo  = $('#hud-combo');
const elHudMiss   = $('#hud-miss');
const elHudHP     = $('#hud-hp');
const elHudTime   = $('#hud-time');

// Play area
const playArea    = $('#playArea');
const runner      = $('#runner');
const runnerEmoji = $('#runner-emoji');
const obsLayer    = $('#obstacle-layer');
const judgeLabel  = $('#judgeLabel');

// Result
const resMode     = $('#res-mode');
const resDiff     = $('#res-diff');
const resEnd      = $('#res-end');
const resScore    = $('#res-score');
const resMaxCombo = $('#res-maxcombo');
const resMiss     = $('#res-miss');
const resHPEnd    = $('#res-hp-end');
const resObsTotal = $('#res-obs-total');
const resObsClear = $('#res-obs-clear');
const resHitRate  = $('#res-hit-rate');
const resAvgRT    = $('#res-avg-rt');

/* ---------- Config ---------- */

const DIFF_CONFIG = {
  easy: {
    durationMs:   60000,
    spawnMinMs:   900,
    spawnMaxMs:   1300,
    hpMax:        120,
    damage:       10,
    bonusScore:   15,
    clearScore:   8,
    actionWindow: 420,  // ms window สำหรับ jump/duck รอบ impact
    animSec:      1.6
  },
  normal: {
    durationMs:   60000,
    spawnMinMs:   750,
    spawnMaxMs:   1150,
    hpMax:        100,
    damage:       14,
    bonusScore:   18,
    clearScore:   10,
    actionWindow: 380,
    animSec:      1.45
  },
  hard: {
    durationMs:   60000,
    spawnMinMs:   620,
    spawnMaxMs:   980,
    hpMax:        80,
    damage:       18,
    bonusScore:   22,
    clearScore:   12,
    actionWindow: 340,
    animSec:      1.35
  }
};

function pickConfig(key){
  return DIFF_CONFIG[key] || DIFF_CONFIG.normal;
}

/* ---------- CSV logger (เฉพาะโหมดวิจัย) ---------- */

function createCSVLogger(meta){
  const rows = [];
  rows.push([
    'timestamp_ms',
    'game_id',
    'player_id',
    'mode',
    'difficulty',
    'phase',
    'event',
    'obstacle_id',
    'obstacle_type',
    'need_action',
    'did_action',
    'result',
    'reaction_ms',
    'score',
    'combo',
    'miss_count',
    'hp',
    'elapsed_ms'
  ]);

  function addRow(e){
    rows.push([
      e.t ?? Date.now(),
      meta.gameId || 'jump-duck',
      meta.playerId || '',
      meta.mode || '',
      meta.difficulty || '',
      meta.phase || '',
      e.event || '',
      e.id ?? '',
      e.obType || '',
      e.needAction || '',
      e.didAction || '',
      e.result || '',
      e.reactionMs ?? '',
      e.score ?? '',
      e.combo ?? '',
      e.missCount ?? '',
      e.hp ?? '',
      e.elapsedMs ?? ''
    ]);
  }

  function download(){
    const csv = rows.map(r=>r.map(v=>{
      const s = String(v ?? '');
      if (s.includes('"') || s.includes(',')){
        return '"' + s.replace(/"/g,'""') + '"';
      }
      return s;
    }).join(',')).join('\r\n');

    const blob = new Blob([csv],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const name = `vrfitness_jumpduck_${meta.playerId||'anon'}_${Date.now()}.csv`;
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },100);
  }

  return {
    logSpawn(info){
      addRow({
        event:'spawn',
        id:info.id,
        obType:info.type,
        needAction:info.needAction,
        hp:info.hp,
        elapsedMs:info.elapsedMs
      });
    },
    logResolve(info){
      addRow({
        event:'resolve',
        id:info.id,
        obType:info.type,
        needAction:info.needAction,
        didAction:info.didAction,
        result:info.result,
        reactionMs:info.reactionMs,
        score:info.score,
        combo:info.combo,
        missCount:info.missCount,
        hp:info.hp,
        elapsedMs:info.elapsedMs
      });
    },
    finish(summary){
      addRow({
        event:'end',
        result:summary.endReason || '',
        score:summary.score,
        combo:summary.maxCombo,
        missCount:summary.missCount,
        hp:summary.hpEnd,
        elapsedMs:summary.elapsedMs,
        obType:'-',
        id:'-',
        needAction:'',
        didAction:''
      });
      download();
    }
  };
}

/* ---------- Dashboard hook ---------- */

function recordSessionToDashboard(summary){
  try{
    if (window.VRFitnessStats && typeof window.VRFitnessStats.recordSession === 'function'){
      window.VRFitnessStats.recordSession('jump-duck', summary);
    }else{
      // fallback localStorage
      const key = 'vrfit_sessions_jumpduck';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({...summary, ts:Date.now()});
      localStorage.setItem(key, JSON.stringify(arr));
    }
  }catch(e){
    console.warn('JumpDuck dashboard store failed', e);
  }
}

/* ---------- State ---------- */

let gameMode   = 'play'; // 'play' | 'research'
let diffKey    = 'normal';
let config     = pickConfig('normal');

let running    = false;
let startTime  = 0;
let elapsedMs  = 0;
let spawnTimer = null;
let rafId      = null;
let nextObId   = 1;

let logger     = null;
let sessionMeta= null;

const obstacles = [];  // {id,type,needAction,impactAt,spawnAt,dom,resolved,reactionMs}
let stats = null;      // per-session stats
let lastAction = null; // {type:'jump'|'duck', time:ms}

/* ---------- View helpers ---------- */

function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>{
    if (!v) return;
    if (name==='menu'    && v===viewMenu)     v.classList.remove('hidden');
    else if(name==='research' && v===viewResearch) v.classList.remove('hidden');
    else if(name==='play' && v===viewPlay)   v.classList.remove('hidden');
    else if(name==='result' && v===viewResult) v.classList.remove('hidden');
    else v.classList.add('hidden');
  });
}

function mapEndReason(code){
  switch(code){
    case 'timeout': return 'เล่นครบเวลา / Timeout';
    case 'hp-empty':return 'HP หมด / Player HP 0';
    case 'manual':  return 'หยุดเอง / Stopped by player';
    default:        return code || '-';
  }
}

/* judge label */

let judgeTimer = null;
function showJudge(text,kind){
  if (!judgeLabel) return;
  judgeLabel.textContent = text;
  judgeLabel.className = 'judge';
  if (kind==='ok')   judgeLabel.classList.add('judge-ok');
  if (kind==='miss') judgeLabel.classList.add('judge-miss');
  judgeLabel.classList.add('show');
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=> judgeLabel.classList.remove('show'), 420);
}

/* runner anim */

function doAction(type){
  if (!runner) return;
  runner.classList.remove('jump','duck');
  if (type==='jump') runner.classList.add('jump');
  if (type==='duck') runner.classList.add('duck');
}

/* ---------- Game control ---------- */

function resetState(){
  running   = false;
  startTime = 0;
  elapsedMs = 0;
  nextObId  = 1;
  if (spawnTimer) { clearTimeout(spawnTimer); spawnTimer=null; }
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }

  obstacles.splice(0, obstacles.length);
  if (obsLayer) obsLayer.innerHTML = '';

  stats = {
    score:0,
    combo:0,
    maxCombo:0,
    missCount:0,
    hp:config.hpMax,
    totalObstacles:0,
    clearCount:0,
    hitCount:0,
    rtList:[]
  };
  lastAction = null;

  if (elHudScore) elHudScore.textContent = '0';
  if (elHudCombo) elHudCombo.textContent = '0';
  if (elHudMiss)  elHudMiss.textContent  = '0';
  if (elHudHP)    elHudHP.textContent    = String(config.hpMax);
  if (elHudTime)  elHudTime.textContent  = (config.durationMs/1000).toFixed(1);
}

function buildSessionMeta(){
  const pid   = (gameMode==='research'
                  ? ($('#researchId')?.value || '').trim()
                  : `JD-${Date.now()}`);
  const group = (gameMode==='research'
                  ? ($('#researchGroup')?.value || '').trim()
                  : '');
  const phase = (gameMode==='research'
                  ? ($('#researchPhase')?.value || '').trim()
                  : '');

  return {
    gameId:'jump-duck',
    playerId: pid || 'anon',
    group,
    phase,
    mode: gameMode,
    difficulty: diffKey
  };
}

function startGame(kind){
  gameMode = (kind==='research' ? 'research' : 'play');
  diffKey  = elDiffSel?.value || 'normal';
  config   = pickConfig(diffKey);

  sessionMeta = buildSessionMeta();

  // HUD static
  if (elHudMode) elHudMode.textContent =
    (gameMode==='research' ? 'Research' : 'Play');
  if (elHudDiff) elHudDiff.textContent = diffKey;

  // logger เฉพาะโหมดวิจัย
  logger = (gameMode==='research' ? createCSVLogger(sessionMeta) : null);

  resetState();

  running   = true;
  startTime = performance.now();

  showView('play');

  scheduleNextSpawn();
  rafId = requestAnimationFrame(loop);
}

/* ---------- Spawning & collision ---------- */

function randomObstacleType(){
  const r = Math.random();
  if (r < 0.4) return 'low';
  if (r < 0.8) return 'high';
  return 'bonus';
}

function scheduleNextSpawn(){
  if (!running) return;
  const delay = config.spawnMinMs +
    Math.random() * (config.spawnMaxMs - config.spawnMinMs);
  spawnTimer = setTimeout(spawnObstacle, delay);
}

function spawnObstacle(){
  if (!running) return;
  if (!obsLayer) return;

  const type = randomObstacleType();
  const id   = nextObId++;
  const needAction =
    (type === 'low'  ? 'jump' :
     type === 'high' ? 'duck' : '');

  const el = document.createElement('div');
  el.className = 'obstacle';
  if (type==='low')  el.classList.add('low');
  if (type==='high') el.classList.add('high');
  if (type==='bonus')el.classList.add('bonus');

  // emoji theme
  if (type==='low')   el.textContent = '🟥';
  if (type==='high')  el.textContent = '🟦';
  if (type==='bonus') el.textContent = '⭐';

  const animSec = config.animSec || 1.5;
  el.style.setProperty('--dur', animSec+'s');

  obsLayer.appendChild(el);

  const now = performance.now();
  const impactAt = now + animSec*0.7*1000; // ตอนที่มาชน runner โดยประมาณ

  const obj = {
    id,
    type,
    needAction,
    spawnAt: now,
    impactAt,
    dom: el,
    resolved:false,
    reactionMs:null,
    result:'',
  };
  obstacles.push(obj);

  stats.totalObstacles++;

  if (logger){
    logger.logSpawn({
      id,
      type,
      needAction,
      hp: stats.hp,
      elapsedMs: elapsedMs
    });
  }

  // ตั้งเวลาไว้ตรวจ collision
  const delayToImpact = impactAt - now;
  setTimeout(()=> resolveObstacle(id), delayToImpact);

  scheduleNextSpawn();
}

function resolveObstacle(id){
  if (!running) return;
  const obj = obstacles.find(o=>o.id===id);
  if (!obj || obj.resolved) return;

  obj.resolved = true;

  const need = obj.needAction;
  const now  = performance.now();
  let did    = '';
  let rt     = null;
  let result = '';

  if (lastAction){
    did = lastAction.type;
    rt  = Math.abs(obj.impactAt - lastAction.time);
  }

  // ตัดสินผล
  const inWindow = (rt!=null && rt<=config.actionWindow);
  if (!need){ // bonus
    if (did && inWindow){
      // เก็บดาว
      result = 'bonus-ok';
      stats.score += config.bonusScore;
      stats.combo++;
      stats.clearCount++;
      stats.rtList.push(rt);
      showJudge('BONUS!', 'ok');
    }else{
      result = 'bonus-skip';
      // ไม่ลงโทษ
    }
  }else{
    if (did===need && inWindow){
      result = 'clear';
      stats.score += config.clearScore;
      stats.combo++;
      stats.clearCount++;
      stats.rtList.push(rt);
      showJudge('CLEAR', 'ok');
    }else{
      result = 'hit';
      stats.combo = 0;
      stats.missCount++;
      stats.hp = Math.max(0, stats.hp - config.damage);
      showJudge('HIT', 'miss');
    }
  }

  if (stats.combo>stats.maxCombo) stats.maxCombo = stats.combo;
  if (result==='hit') stats.hitCount++;

  // update HUD
  if (elHudScore) elHudScore.textContent = String(stats.score);
  if (elHudCombo) elHudCombo.textContent = String(stats.combo);
  if (elHudMiss)  elHudMiss.textContent  = String(stats.missCount);
  if (elHudHP)    elHudHP.textContent    = String(stats.hp);

  // cleanup DOM
  if (obj.dom && obj.dom.parentNode){
    setTimeout(()=> obj.dom && obj.dom.remove(), 200);
  }

  // log
  if (logger){
    logger.logResolve({
      id:obj.id,
      type:obj.type,
      needAction:obj.needAction,
      didAction:did,
      result,
      reactionMs:rt,
      score:stats.score,
      combo:stats.combo,
      missCount:stats.missCount,
      hp:stats.hp,
      elapsedMs:elapsedMs
    });
  }

  // check HP หมด
  if (stats.hp<=0){
    stopGame('hp-empty');
  }
}

/* ---------- Main loop ---------- */

function loop(now){
  if (!running) return;
  elapsedMs = now - startTime;
  const remain = Math.max(0, config.durationMs - elapsedMs);
  if (elHudTime) elHudTime.textContent = (remain/1000).toFixed(1);

  if (remain <= 0){
    stopGame('timeout');
    return;
  }

  rafId = requestAnimationFrame(loop);
}

/* ---------- Stop & result ---------- */

function computeAnalytics(){
  const total = stats.totalObstacles || 0;
  const clear = stats.clearCount || 0;
  const hitRate = total ? clear/total : 0;

  const list = stats.rtList || [];
  let avgRT = 0;
  if (list.length){
    avgRT = list.reduce((a,b)=>a+b,0) / list.length;
  }

  return { total, clear, hitRate, avgRT };
}

function fmtPercent(v){
  if (!v || Number.isNaN(v)) return '-';
  return (v*100).toFixed(1)+' %';
}
function fmtMs(v){
  if (!v || v<=0) return '-';
  return v.toFixed(0)+' ms';
}

function stopGame(reason){
  if (!running) return;
  running = false;

  if (spawnTimer){ clearTimeout(spawnTimer); spawnTimer=null; }
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }

  const analytics = computeAnalytics();
  const endReason = mapEndReason(reason);
  const hpEnd     = stats.hp;

  // fill result
  resMode.textContent     = (gameMode==='research' ? 'Research' : 'Play');
  resDiff.textContent     = diffKey;
  resEnd.textContent      = endReason;
  resScore.textContent    = String(stats.score);
  resMaxCombo.textContent = String(stats.maxCombo);
  resMiss.textContent     = String(stats.missCount);
  resHPEnd.textContent    = String(hpEnd);
  resObsTotal.textContent = String(analytics.total);
  resObsClear.textContent = String(analytics.clear);
  resHitRate.textContent  = fmtPercent(analytics.hitRate);
  resAvgRT.textContent    = fmtMs(analytics.avgRT);

  // dashboard summary
  recordSessionToDashboard({
    mode: gameMode,
    difficulty: diffKey,
    score: stats.score,
    maxCombo: stats.maxCombo,
    missCount: stats.missCount,
    hpEnd,
    totalObstacles: analytics.total,
    clearCount: analytics.clear,
    hitRate: analytics.hitRate,
    avgReactionMs: analytics.avgRT
  });

  // CSV เฉพาะโหมดวิจัย
  if (gameMode==='research' && logger){
    logger.finish({
      endReason,
      score: stats.score,
      maxCombo: stats.maxCombo,
      missCount: stats.missCount,
      hpEnd,
      elapsedMs
    });
  }

  showView('result');
}

/* ---------- Input handling ---------- */

function handleAction(type){
  if (!running) return;
  lastAction = { type, time: performance.now() };
  doAction(type);
}

/* ---------- Init & events ---------- */

function init(){
  // menu buttons
  $('[data-action="start-normal"]')?.addEventListener('click',()=>{
    startGame('play');
  });
  $('[data-action="goto-research"]')?.addEventListener('click',()=>{
    showView('research');
  });
  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click',()=> showView('menu'));
  });

  // research start
  $('[data-action="start-research"]')?.addEventListener('click',()=>{
    startGame('research');
  });

  // play actions
  $('[data-action="jump"]')?.addEventListener('click',()=>{
    handleAction('jump');
  });
  $('[data-action="duck"]')?.addEventListener('click',()=>{
    handleAction('duck');
  });

  // tap บน playArea: บนจอ = jump, ล่างจอ = duck
  if (playArea){
    playArea.addEventListener('pointerdown',ev=>{
      if (!running) return;
      const rect = playArea.getBoundingClientRect();
      const yRel = (ev.clientY - rect.top) / rect.height;
      if (yRel <= 0.5) handleAction('jump');
      else handleAction('duck');
    });
  }

  // stop
  $('[data-action="stop"]')?.addEventListener('click',()=>{
    if (running) stopGame('manual');
  });

  // result play again
  $('[data-action="play-again"]')?.addEventListener('click',()=>{
    showView('menu');
  });

  showView('menu');
}

window.addEventListener('DOMContentLoaded', init);