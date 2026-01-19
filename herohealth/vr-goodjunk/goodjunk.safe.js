// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — S / FAIR PACK
// ✅ Fair for P.5
// ✅ Boss by MISS (not random)
// ✅ Storm / Boss / Rage rules
// ✅ No AI modules (pure gameplay)
// ✅ Uses safe-area vars from run html

'use strict';

const WIN = window;
const DOC = document;

/* ---------------- Utils ---------------- */
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const nowMs = ()=>performance.now();
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const emit = (name,detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){} };

/* ---------------- DOM ---------------- */
const el = {};
function bindDom(){
  const ids = [
    'hud-score','hud-time','hud-miss','hud-grade',
    'hud-goal','goalDesc','hud-goal-cur','hud-goal-target',
    'hud-mini','miniTimer',
    'feverFill','feverText','shieldPills',
    'lowTimeOverlay','gj-lowtime-num'
  ];
  ids.forEach(id=>el[id]=DOC.getElementById(id));
}

/* ---------------- State ---------------- */
const S = {
  started:false, ended:false,

  view:'mobile', run:'play', diff:'normal',
  timePlanSec:80, tLeftSec:0,

  score:0,
  combo:0, comboMax:0,

  miss_total:0,
  miss_goodExpired:0,
  miss_junkHit:0,

  fever:0,
  shield:0,

  // boss / storm
  inStorm:false,
  inBoss:false,
  inRage:false,
  bossHp:0,
  bossHpMax:0,
  bossPhase2Until:0,

  lastTick:0,
  lastSpawn:0,
};

/* ---------------- Difficulty (FAIR) ---------------- */
function diffCfg(){
  if(S.diff==='easy')   return { goodLife:2100, junkLife:2000, spawnGap:900, bossHp:10 };
  if(S.diff==='hard')   return { goodLife:1600, junkLife:1500, spawnGap:700, bossHp:14 };
  return                 { goodLife:1800, junkLife:1700, spawnGap:800, bossHp:12 };
}

/* ---------------- HUD ---------------- */
function setText(node,v){ if(node) node.textContent=String(v); }
function updateHud(){
  setText(el['hud-score'], S.score);
  setText(el['hud-time'], Math.ceil(S.tLeftSec));
  setText(el['hud-miss'], S.miss_total);
  setText(el['hud-grade'], calcGrade());
  setText(el['shieldPills'], S.shield?`x${S.shield}`:'—');
  if(el['feverFill']) el['feverFill'].style.width = `${S.fever}%`;
  setText(el['feverText'], `${S.fever}%`);
}

/* ---------------- Grade ---------------- */
function calcGrade(){
  if(S.score>=180 && S.miss_total<=3) return 'A';
  if(S.score>=120 && S.miss_total<=5) return 'B';
  if(S.score>=70) return 'C';
  return 'D';
}

/* ---------------- Spawn helpers ---------------- */
function safeRect(){
  const top = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gj-top-safe'))||120;
  const bot = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gj-bottom-safe'))||96;
  return {
    x:20,
    y:top,
    w: innerWidth-40,
    h: innerHeight-top-bot
  };
}

function spawnTarget(kind, lifeMs){
  const r = safeRect();
  const x = r.x + Math.random()*r.w;
  const y = r.y + Math.random()*r.h;

  const node = DOC.createElement('div');
  node.className='gj-target spawn';
  node.textContent = kind==='good'?'🍎':(kind==='junk'?'🍟':'⭐');
  node.style.left=`${x}px`;
  node.style.top =`${y}px`;
  node.style.fontSize='56px';

  const layer = DOC.getElementById('gj-layer');
  layer.appendChild(node);

  const born = nowMs();
  let dead=false;

  const kill=(expired)=>{
    if(dead) return;
    dead=true;
    node.classList.add('gone');
    setTimeout(()=>node.remove(),140);
    if(expired && kind==='good'){
      S.miss_goodExpired++;
      S.miss_total++;
    }
  };

  node.addEventListener('pointerdown',()=>{
    if(dead) return;
    dead=true;
    node.remove();

    if(kind==='good'){
      S.score+=10+Math.min(10,S.combo);
      S.combo++;
      S.comboMax=Math.max(S.comboMax,S.combo);
    }else if(kind==='junk'){
      if(S.shield>0){
        S.shield--;
      }else{
        S.miss_junkHit++;
        S.miss_total++;
        S.combo=0;
      }
    }
  });

  setTimeout(()=>kill(true), lifeMs);
}

/* ---------------- Boss / Storm logic ---------------- */
function checkPhases(){
  // Storm by time
  S.inStorm = (S.tLeftSec<=30);

  // Boss by MISS
  if(!S.inBoss && S.miss_total>=4){
    S.inBoss=true;
    const cfg = diffCfg();
    S.bossHpMax = cfg.bossHp;
    S.bossHp = cfg.bossHp;
  }

  // Rage
  S.inRage = (S.miss_total>=5);

  // Phase2 (6s)
  if(S.inBoss && S.bossHp<=Math.ceil(S.bossHpMax/2) && S.bossPhase2Until===0){
    S.bossPhase2Until = nowMs()+6000;
  }
}

/* ---------------- Tick ---------------- */
function tick(){
  if(!S.started||S.ended) return;
  const t = nowMs();
  const dt = Math.min(0.25,(t-S.lastTick)/1000);
  S.lastTick=t;
  S.tLeftSec = Math.max(0,S.tLeftSec-dt);

  checkPhases();

  // spawn
  const cfg = diffCfg();
  let gap = cfg.spawnGap;
  let lifeGood = cfg.goodLife;
  let lifeJunk = cfg.junkLife;

  if(S.inStorm){ gap*=0.9; }
  if(S.inRage){ gap*=0.85; }

  // FAIR LIMIT (mobile)
  lifeGood = Math.max(1600, lifeGood);
  lifeJunk = Math.max(1500, lifeJunk);

  if(t-S.lastSpawn>=gap){
    S.lastSpawn=t;
    spawnTarget(Math.random()<0.75?'good':'junk', lifeGood);
  }

  updateHud();

  if(S.tLeftSec<=0){
    endGame('timeup');
    return;
  }

  requestAnimationFrame(tick);
}

/* ---------------- End ---------------- */
function endGame(reason){
  if(S.ended) return;
  S.ended=true;
  updateHud();
  emit('hha:end',{
    score:S.score,
    miss:S.miss_total,
    grade:calcGrade(),
    reason
  });
}

/* ---------------- Boot ---------------- */
export function boot(opts={}){
  bindDom();

  S.view = opts.view||qs('view','mobile');
  S.run  = opts.run ||qs('run','play');
  S.diff = opts.diff||qs('diff','normal');
  S.timePlanSec = Number(opts.time)||80;
  S.tLeftSec = S.timePlanSec;

  S.started=true;
  S.lastTick=nowMs();
  S.lastSpawn=nowMs();

  emit('hha:start',{
    view:S.view, run:S.run, diff:S.diff, time:S.timePlanSec
  });

  updateHud();
  requestAnimationFrame(tick);
}