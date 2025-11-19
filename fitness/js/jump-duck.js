// fitness/js/jump-duck.js
// VR-Fitness: Jump & Duck — self-contained version (no imports)
// Mode: play / research, CSV เฉพาะโหมดวิจัย

'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---------- Views & HUD refs ---------- */

const viewMenu     = $('#view-menu');
const viewResearch = $('#view-research');
const viewPlay     = $('#view-play');
const viewResult   = $('#view-result');

const elDiffSel  = $('#difficulty');

const hudMode   = $('#hud-mode');
const hudDiff   = $('#hud-diff');
const hudTime   = $('#hud-time');
const hudStab   = $('#hud-stability');
const hudObs    = $('#hud-obstacles');

const playArea  = $('#playArea');   // กล่องกลางจอ (16:9 หรือ 9:16)
const laneTrack = $('#lane-track'); // ถ้ามีเลนวิ่ง
const avatarEl  = $('#avatar');     // ตัวผู้เล่น (emoji)

const btnJump   = $('#btn-jump');
const btnDuck   = $('#btn-duck');

const coachEl   = $('#coachBubble');
const coachText = coachEl;
const comboCall = $('#comboCall'); // ถ้าอยากมี effect

// Result fields
const resMode   = $('#res-mode');
const resDiff   = $('#res-diff');
const resEnd    = $('#res-end');
const resScore  = $('#res-score');
const resStab   = $('#res-stability');
const resHit    = $('#res-hits');
const resMiss   = $('#res-miss');
const resAvoid  = $('#res-avoidRate');
const resReact  = $('#res-rtmean');

// note CSV (มุมล่างเกี่ยวกับ research)
const csvNote   = $('#view-result .note');

/* ---------- Config ---------- */

const GAME_DURATION_MS = 60000;

const DIFF_CONFIG = {
  easy:   { name:'easy',   spawnMin:900,  spawnMax:1300, penalty:10, reward:3 },
  normal: { name:'normal', spawnMin:700,  spawnMax:1100, penalty:15, reward:4 },
  hard:   { name:'hard',   spawnMin:520,  spawnMax:950,  penalty:20, reward:5 }
};

// obstacle type: 'high' → ต้อง Duck, 'low' → ต้อง Jump
const OB_TYPES = ['high','low'];

/* ---------- State ---------- */

let gameMode   = 'play';   // 'play' | 'research'
let diffKey    = 'normal';

let state      = null;
let rafId      = null;
let logger     = null;
let lastInput  = null;     // 'jump' | 'duck' | null
let lastCoachAt= 0;

/* ---------- Helpers ---------- */

function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>v?.classList.add('hidden'));
  if (name==='menu')    viewMenu?.classList.remove('hidden');
  if (name==='research')viewResearch?.classList.remove('hidden');
  if (name==='play')    viewPlay?.classList.remove('hidden');
  if (name==='result')  viewResult?.classList.remove('hidden');
}

function randRange(min,max){
  return min + Math.random()*(max-min);
}
const fmtPercent = v => (v==null||Number.isNaN(v)) ? '-' : (v*100).toFixed(1)+' %';
const fmtMs      = v => (!v||v<=0) ? '-' : v.toFixed(0)+' ms';

function setCoach(text){
  if (!coachEl) return;
  coachEl.textContent = text;
  coachEl.classList.remove('hidden');
  lastCoachAt = performance.now();
  setTimeout(()=> coachEl && coachEl.classList.add('hidden'), 3200);
}

function maybeCoachOnMiss(){
  const now = performance.now();
  if (now - lastCoachAt < 4000) return;
  if (!state) return;
  if (state.missCount>=5 && state.missCount<10){
    setCoach('ลองสังเกตไอคอนให้ชัด ๆ ก่อนกดนะ 👀');
  }else if (state.missCount>=10){
    setCoach('ถ้าชนบ่อย ลองชะลอแล้วโฟกัสจังหวะให้มั่นใจก่อนกด ⏱️');
  }
}

function hitFX(ok){
  if (!playArea) return;
  playArea.classList.add(ok?'hit-ok':'hit-bad');
  setTimeout(()=>playArea && playArea.classList.remove('hit-ok','hit-bad'),220);
}

/* ---------- CSV logger (research only) ---------- */

function createCSVLogger(meta){
  const rows = [];
  const header = [
    'timestamp_ms','game_id','player_id','mode','difficulty',
    'event','ob_id','ob_type','player_action','result','reaction_ms',
    'stability','score','hitCount','missCount'
  ];
  rows.push(header);

  function push(ev, extra){
    const t = Date.now();
    const e = extra||{};
    rows.push([
      t,
      meta.gameId || 'jump-duck',
      meta.playerId || '',
      meta.mode || '',
      meta.difficulty || '',
      ev,
      e.id ?? '',
      e.obType ?? '',
      e.action ?? '',
      e.result ?? '',
      e.reactionMs ?? '',
      e.stability ?? '',
      e.score ?? '',
      e.hitCount ?? '',
      e.missCount ?? ''
    ]);
  }

  return {
    logSpawn(ob){
      push('spawn',{ id:ob.id, obType:ob.type });
    },
    logResolve(ob,res,action,rt){
      push('resolve',{
        id:ob.id,
        obType:ob.type,
        action,
        result:res,
        reactionMs:rt,
        stability: state?.stability ?? '',
        score: state?.score ?? '',
        hitCount: state?.hitCount ?? '',
        missCount: state?.missCount ?? ''
      });
    },
    finish(finalState){
      if (meta.mode!=='research') return; // ⬅ เฉพาะโหมดวิจัยเท่านั้น
      const csv = rows.map(r=>r.map(v=>{
        const s = String(v ?? '');
        if (s.includes('"') || s.includes(',')) {
          return '"' + s.replace(/"/g,'""') + '"';
        }
        return s;
      }).join(',')).join('\r\n');

      const blob = new Blob([csv],{type:'text/csv'});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      const name = `vrfitness_jumpduck_${meta.playerId||'anon'}_${Date.now()}.csv`;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },100);
    }
  };
}

/* ---------- Game start ---------- */

function buildSessionMeta(){
  const pid = (gameMode==='research'
    ? ($('#researchId')?.value.trim()||'anon')
    : 'play-'+Date.now());
  return {
    gameId:'jump-duck',
    playerId:pid,
    mode:gameMode,
    difficulty:diffKey
  };
}

function startGame(kind){
  gameMode = (kind==='research') ? 'research' : 'play';
  diffKey  = elDiffSel?.value || 'normal';

  const cfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;

  state = {
    startedAt: performance.now(),
    elapsed:0,
    remaining:GAME_DURATION_MS,
    nextSpawnAt: performance.now()+800,
    obstacles:[],
    nextId:1,

    stability:100,
    score:0,
    hitCount:0,
    missCount:0,
    totalSpawn:0,

    rtList:[]
  };

  lastInput = null;
  lastCoachAt = 0;
  logger = createCSVLogger(buildSessionMeta());

  if (hudMode) hudMode.textContent = (gameMode==='research'?'Research':'Play');
  if (hudDiff) hudDiff.textContent = diffKey;
  if (hudTime) hudTime.textContent = (GAME_DURATION_MS/1000).toFixed(1);
  if (hudStab) hudStab.textContent = '100.0 %';
  if (hudObs)  hudObs.textContent  = '0';
  if (coachEl) coachEl.classList.add('hidden');

  if (avatarEl){
    avatarEl.classList.remove('pose-jump','pose-duck');
    avatarEl.classList.add('pose-stand');
  }

  showView('play');
  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

/* ---------- Loop ---------- */

function loop(now){
  if (!state) return;
  state.elapsed = now - state.startedAt;
  state.remaining = Math.max(0, GAME_DURATION_MS - state.elapsed);

  if (hudTime) hudTime.textContent = (state.remaining/1000).toFixed(1);

  if (state.remaining<=0){
    endGame('timeout');
    return;
  }

  // spawn obstacle
  if (now>=state.nextSpawnAt){
    spawnObstacle(now);
    const cfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
    const delay = randRange(cfg.spawnMin,cfg.spawnMax);
    state.nextSpawnAt = now + delay;
  }

  // move obstacles
  updateObstacles(now);

  rafId = requestAnimationFrame(loop);
}

/* ---------- Obstacles ---------- */

function spawnObstacle(now){
  const type = OB_TYPES[Math.floor(Math.random()*OB_TYPES.length)];
  const id   = state.nextId++;

  const ob = {
    id,
    type,                // 'high' | 'low'
    createdAt:now,
    // เวลา "check" ที่จะชน (ชนกลางจอ) กำหนด ~800ms หลังสร้าง
    triggerAt: now+800,
    resolved:false,
    element:null
  };
  state.obstacles.push(ob);
  state.totalSpawn++;

  if (laneTrack){
    const el = document.createElement('div');
    el.className = 'obstacle obstacle-'+type;
    el.dataset.id = String(id);
    laneTrack.appendChild(el);
    ob.element = el;

    // animate ด้วย CSS class
    requestAnimationFrame(()=> el.classList.add('run'));
  }

  logger?.logSpawn(ob);
  if (hudObs) hudObs.textContent = `${state.hitCount} / ${state.totalSpawn}`;
}

function updateObstacles(now){
  const remain = [];
  for (const ob of state.obstacles){
    if (!ob.resolved && now>=ob.triggerAt){
      resolveObstacle(ob, now);
    }
    // ถ้าหมด animation แล้ว ลบ DOM
    if (ob.element){
      const rect = ob.element.getBoundingClientRect();
      const area = playArea?.getBoundingClientRect();
      if (area && rect.right < area.left-40){
        ob.element.remove();
      }
    }
    if (!ob.resolved){
      remain.push(ob);
    }
  }
  state.obstacles = remain;
}

/* ---------- Resolve obstacle ---------- */

function resolveObstacle(ob, now){
  ob.resolved = true;
  const expected = (ob.type === 'high') ? 'duck' : 'jump';
  const action   = lastInput; // ปุ่มที่กดล่าสุด
  const rt       = action ? (now - ob.triggerAt) : null;

  let ok = false;
  if (action === expected && rt!=null && rt>=0 && rt<=600){
    ok = true;
  }

  const cfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;

  if (ok){
    state.hitCount++;
    state.score += 10;
    state.stability = Math.min(100, state.stability + cfg.reward);
    if (rt!=null) state.rtList.push(rt);
    hitFX(true);
  }else{
    state.missCount++;
    state.score = Math.max(0, state.score-5);
    state.stability = Math.max(0, state.stability - cfg.penalty);
    hitFX(false);
    maybeCoachOnMiss();
  }

  if (hudStab) hudStab.textContent = state.stability.toFixed(1)+' %';
  if (hudObs)  hudObs.textContent  = `${state.hitCount} / ${state.totalSpawn}`;

  logger?.logResolve(ob, ok?'hit':'miss', action||'', rt||'');

  // ถ้าความมั่นคงเหลือ 0 → จบ
  if (state.stability<=0){
    endGame('stability-zero');
  }
}

/* ---------- Input (Jump / Duck) ---------- */

function applyPose(action){
  if (!avatarEl) return;
  avatarEl.classList.remove('pose-stand','pose-jump','pose-duck');
  if (action==='jump') avatarEl.classList.add('pose-jump');
  else if (action==='duck') avatarEl.classList.add('pose-duck');
  setTimeout(()=>{
    avatarEl.classList.remove('pose-jump','pose-duck');
    avatarEl.classList.add('pose-stand');
  }, 260);
}

function onJump(){
  lastInput = 'jump';
  applyPose('jump');
}
function onDuck(){
  lastInput = 'duck';
  applyPose('duck');
}

/* ---------- End & Result ---------- */

function avg(arr){
  if (!arr || !arr.length) return 0;
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}

function endGame(reason){
  if (!state) return;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }

  const total   = state.totalSpawn || 1;
  const avoid   = state.hitCount / total;
  const rtMean  = avg(state.rtList);

  // fill result
  if (resMode)  resMode.textContent = (gameMode==='research'?'Research':'Play');
  if (resDiff)  resDiff.textContent = diffKey;
  if (resEnd)   resEnd.textContent  =
      reason==='timeout' ? 'ครบเวลา 60 วินาที' :
      reason==='stability-zero' ? 'เสียสมดุลจนหมด' :
      reason||'-';
  if (resScore) resScore.textContent= String(state.score);
  if (resStab)  resStab.textContent = state.stability.toFixed(1)+' %';
  if (resHit)   resHit.textContent  = String(state.hitCount);
  if (resMiss)  resMiss.textContent = String(state.missCount);
  if (resAvoid) resAvoid.textContent= fmtPercent(avoid);
  if (resReact) resReact.textContent= fmtMs(rtMean);

  // note CSV เฉพาะโหมดวิจัย
  if (csvNote){
    if (gameMode==='research') csvNote.classList.remove('hidden');
    else                       csvNote.classList.add('hidden');
  }

  logger?.finish({
    endedBy:reason,
    score:state.score,
    hitCount:state.hitCount,
    missCount:state.missCount,
    stability:state.stability,
    elapsedMs:state.elapsed
  });

  state = null;
  showView('result');
}

/* ---------- Init ---------- */

function init(){
  // ปุ่มเมนู
  $('[data-action="start-play"]')?.addEventListener('click',()=>{
    startGame('play');
  });
  $('[data-action="goto-research"]')?.addEventListener('click',()=>{
    showView('research');
  });
  $('[data-action="start-research"]')?.addEventListener('click',()=>{
    startGame('research');
  });
  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click',()=> showView('menu'));
  });

  // ปุ่มในเกม
  if (btnJump) btnJump.addEventListener('click', onJump);
  if (btnDuck) btnDuck.addEventListener('click', onDuck);

  // shortcut: แตะซ้าย = duck, ขวา = jump (เผื่อ mobile)
  if (playArea){
    playArea.addEventListener('pointerdown',ev=>{
      const rect = playArea.getBoundingClientRect();
      const mid  = rect.left + rect.width/2;
      if (ev.clientY > rect.bottom - rect.height*0.35){
        // ล่างจอ → duck
        onDuck();
      }else{
        // บนจอ → jump
        onJump();
      }
    });
  }

  showView('menu');
}

window.addEventListener('DOMContentLoaded', init);