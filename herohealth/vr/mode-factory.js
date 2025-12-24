// === /herohealth/vr/mode-factory.js ===
// DOM Emoji Target Spawner (Factory)
// ✅ spawnHost + boundsHost
// ✅ spawnStrategy: 'grid9' (กระจายแบบรู้สึกได้)
// ✅ minSeparation + maxSpawnTries
// ✅ excludeSelectors (กันทับ HUD)
// ✅ powerEvery (กันไม่ออก power นานเกิน)
// ✅ random ring variants + afterimage on hit
// ✅ returns { stop() }

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function rand(a,b){ return a + Math.random()*(b-a); }
function pickOne(arr, fallback){
  if (!Array.isArray(arr) || arr.length===0) return fallback;
  return arr[(Math.random()*arr.length)|0];
}
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }

function getEl(ref){
  if (!DOC) return null;
  if (!ref) return null;
  if (typeof ref === 'string') return DOC.querySelector(ref);
  return ref;
}

function rectOf(el){
  try{ return el.getBoundingClientRect(); }catch{ return null; }
}

function collectExcludeRects(selectors){
  const out = [];
  if (!DOC) return out;
  const list = Array.isArray(selectors) ? selectors : [];
  for (const sel of list){
    try{
      const nodes = DOC.querySelectorAll(sel);
      nodes.forEach(n=>{
        const r = rectOf(n);
        if (r && r.width>1 && r.height>1) out.push(r);
      });
    }catch{}
  }
  return out;
}

function insideAnyRect(x,y, rects){
  for (const r of rects){
    if (x>=r.left && x<=r.right && y>=r.top && y<=r.bottom) return true;
  }
  return false;
}

function distNorm(a,b){
  const dx=a.nx-b.nx, dy=a.ny-b.ny;
  return Math.sqrt(dx*dx + dy*dy);
}

function makeTargetEl(){
  const el = DOC.createElement('div');
  el.className = 'hvr-target';
  el.style.position = 'absolute';
  el.style.left = '50%';
  el.style.top  = '50%';
  el.style.transform = 'translate(-50%,-50%)';
  el.style.width  = '132px';
  el.style.height = '132px';
  el.style.borderRadius = '999px';
  el.style.display='flex';
  el.style.alignItems='center';
  el.style.justifyContent='center';
  el.style.userSelect='none';
  el.style.cursor='pointer';
  el.style.willChange='transform,left,top,opacity';
  el.style.pointerEvents='auto';

  // inner container for wiggle
  const wiggle = DOC.createElement('div');
  wiggle.className = 'hvr-wiggle';
  wiggle.style.width='100%';
  wiggle.style.height='100%';
  wiggle.style.display='flex';
  wiggle.style.alignItems='center';
  wiggle.style.justifyContent='center';
  wiggle.style.borderRadius='999px';

  // emoji
  const icon = DOC.createElement('div');
  icon.className = 'hvr-emoji';
  icon.style.fontSize = '58px';
  icon.style.lineHeight = '1';
  icon.style.fontFamily = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui';

  wiggle.appendChild(icon);
  el.appendChild(wiggle);

  return { el, wiggle, icon };
}

function createRandomRing(size){
  const ringEl = DOC.createElement('div');
  ringEl.className = 'hvr-ring ' + pickOne(['r1','r2','r3'], 'r1');
  ringEl.style.position = 'absolute';
  ringEl.style.left = '50%';
  ringEl.style.top  = '50%';
  ringEl.style.width  = (size * 0.36) + 'px';
  ringEl.style.height = (size * 0.36) + 'px';
  ringEl.style.transform = 'translate(-50%, -50%)';
  ringEl.style.borderRadius = '999px';
  ringEl.style.pointerEvents = 'none';
  return ringEl;
}

function addAfterimage(host, x, y, ch){
  try{
    const ghost = DOC.createElement('div');
    ghost.className = 'hvr-afterimage';
    ghost.style.left = x + 'px';
    ghost.style.top  = y + 'px';

    const gi = DOC.createElement('div');
    gi.className = 'hvr-afterimage-inner';
    gi.textContent = ch;

    ghost.appendChild(gi);
    host.appendChild(ghost);
    ROOT.setTimeout(()=>{ try{ ghost.remove(); }catch{} }, 520);
  }catch{}
}

function pickGrid9Point(nx, ny){
  // 3x3 grid center points with jitter
  const gx = [1/6, 3/6, 5/6];
  const gy = [1/6, 3/6, 5/6];
  const cx = pickOne(gx, 0.5);
  const cy = pickOne(gy, 0.5);
  // small jitter so it won't look rigid
  const jx = rand(-0.10, 0.10);
  const jy = rand(-0.10, 0.10);
  return { nx: clamp(cx + jx, 0.08, 0.92), ny: clamp(cy + jy, 0.10, 0.90) };
}

/**
 * boot({
 *   modeKey, difficulty, duration,
 *   spawnHost, boundsHost,
 *   spawnAroundCrosshair, spawnStrategy,
 *   spawnRadiusX, spawnRadiusY,
 *   minSeparation, maxSpawnTries,
 *   excludeSelectors,
 *   pools:{good,bad}, goodRate,
 *   powerups, powerRate, powerEvery,
 *   dragThresholdPx,
 *   spawnIntervalMul: ()=>number,
 *   decorateTarget(el, parts, data, meta),
 *   judge(ch, ctx),
 *   onExpire(info)
 * })
 */
export async function boot(opts = {}){
  if (!DOC) return { stop(){} };

  const hostSpawn = getEl(opts.spawnHost);
  const boundsEl  = getEl(opts.boundsHost) || hostSpawn;

  if (!hostSpawn || !boundsEl){
    console.error('[mode-factory] spawnHost/boundsHost missing');
    return { stop(){} };
  }

  const diff = String(opts.difficulty || 'easy').toLowerCase();
  const baseInterval =
    diff==='hard' ? 520 :
    diff==='normal' ? 620 :
    720;

  const spawnStrategy = String(opts.spawnStrategy || 'grid9');
  const minSep = clamp(opts.minSeparation ?? 0.88, 0.20, 2.0);
  const maxTries = clamp(opts.maxSpawnTries ?? 14, 6, 40);

  const pools = opts.pools || {};
  const goodPool = Array.isArray(pools.good) ? pools.good : ['💧'];
  const badPool  = Array.isArray(pools.bad)  ? pools.bad  : ['🥤'];

  const powerups = Array.isArray(opts.powerups) ? opts.powerups : [];
  const goodRate = clamp(opts.goodRate ?? 0.65, 0.05, 0.95);
  const powerRate = clamp(opts.powerRate ?? 0.10, 0.00, 0.45);
  const powerEvery = clamp(opts.powerEvery ?? 6, 0, 99);

  const excludeSelectors = Array.isArray(opts.excludeSelectors) ? opts.excludeSelectors : [];

  const state = {
    stopped:false,
    active: new Map(),     // id -> obj
    recent: [],            // recent spawn positions for min separation
    spawnCount: 0,
    lastPowerAt: 0,
    lastSpawnAt: 0,
    timerId: null
  };

  function boundsRect(){
    const r = rectOf(boundsEl);
    if (!r || r.width<10 || r.height<10){
      return { left:0, top:0, width: innerWidth, height: innerHeight, right: innerWidth, bottom: innerHeight };
    }
    return r;
  }

  function spawnRect(){
    const r = rectOf(hostSpawn);
    if (!r || r.width<10 || r.height<10){
      const b = boundsRect();
      return { left:b.left, top:b.top, width:b.width, height:b.height, right:b.right, bottom:b.bottom };
    }
    return r;
  }

  function makeCandidate(){
    // normalized (0..1) inside bounds
    let p;
    if (spawnStrategy === 'grid9'){
      p = pickGrid9Point();
    } else {
      p = { nx: rand(0.08,0.92), ny: rand(0.10,0.90) };
    }
    return p;
  }

  function isFarEnough(p){
    for (const q of state.recent){
      if (distNorm(p,q) < minSep*0.18) return false; // tuned: 0.18 feels right for grid9
    }
    return true;
  }

  function pushRecent(p){
    state.recent.push(p);
    if (state.recent.length > 8) state.recent.shift();
  }

  function chooseKind(){
    state.spawnCount++;
    const mustPower = (powerEvery>0) && ((state.spawnCount - state.lastPowerAt) >= powerEvery) && powerups.length>0;
    if (mustPower){
      state.lastPowerAt = state.spawnCount;
      return { kind:'power', ch: pickOne(powerups, '⭐') };
    }
    const r = Math.random();
    if (powerups.length>0 && r < powerRate){
      state.lastPowerAt = state.spawnCount;
      return { kind:'power', ch: pickOne(powerups, '⭐') };
    }
    if (r < powerRate + goodRate){
      return { kind:'good', ch: pickOne(goodPool, '💧') };
    }
    return { kind:'bad', ch: pickOne(badPool, '🥤') };
  }

  function calcLifetime(){
    // lifetime: slightly faster on harder
    const base = diff==='hard' ? 980 : (diff==='normal' ? 1150 : 1320);
    // mild randomness
    return clamp(base + rand(-160, 220), 520, 1700);
  }

  function spawnOne(){
    if (state.stopped) return;

    const b = boundsRect();
    const s = spawnRect();
    const exRects = collectExcludeRects(excludeSelectors);

    let pick = null;
    for (let i=0;i<maxTries;i++){
      const p = makeCandidate();
      if (!isFarEnough(p)) continue;

      const x = b.left + p.nx * b.width;
      const y = b.top  + p.ny * b.height;

      if (insideAnyRect(x,y, exRects)) continue;

      pick = { ...p, x, y };
      break;
    }

    // fallback: even if minSep fail, still spawn somewhere valid
    if (!pick){
      for (let i=0;i<maxTries;i++){
        const p = { nx: rand(0.10,0.90), ny: rand(0.12,0.88) };
        const x = b.left + p.nx * b.width;
        const y = b.top  + p.ny * b.height;
        if (!insideAnyRect(x,y, collectExcludeRects(excludeSelectors))){
          pick = { ...p, x, y };
          break;
        }
      }
    }
    if (!pick){
      pick = { nx:0.5, ny:0.5, x:b.left + b.width/2, y:b.top + b.height/2 };
    }

    pushRecent(pick);

    const { kind, ch } = chooseKind();

    const { el, wiggle, icon } = makeTargetEl();
    const size = 132;
    el.style.width = size+'px';
    el.style.height = size+'px';

    // place relative to spawnHost
    // convert viewport x/y into local coords inside spawnHost
    const lx = pick.x - s.left;
    const ly = pick.y - s.top;

    el.style.left = lx + 'px';
    el.style.top  = ly + 'px';

    // add ring (random)
    const ringEl = createRandomRing(size);
    el.insertBefore(ringEl, wiggle);

    icon.textContent = ch;

    // flags
    const id = 't' + Math.random().toString(16).slice(2) + (now()|0);
    const data = {
      id,
      ch,
      kind,
      isGood: kind==='good',
      isPower: kind==='power'
    };

    // class tags
    el.classList.toggle('hvr-good', data.isGood && !data.isPower);
    el.classList.toggle('hvr-junk', !data.isGood && !data.isPower);
    el.classList.toggle('hvr-power', data.isPower);

    // let game customize
    try{
      if (typeof opts.decorateTarget === 'function'){
        opts.decorateTarget(el, { wiggle, icon, ringEl }, data, { difficulty: diff, modeKey: String(opts.modeKey||'') });
      }
    }catch{}

    hostSpawn.appendChild(el);

    const born = now();
    const life = calcLifetime();
    let killed = false;

    function kill(reason){
      if (killed) return;
      killed = true;
      try{ el.remove(); }catch{}
      state.active.delete(id);
      if (reason==='expire'){
        try{
          if (typeof opts.onExpire === 'function'){
            opts.onExpire({ id, ch, isGood:data.isGood, isPower:data.isPower, kind:data.kind });
          }
        }catch{}
      }
    }

    // click / tap hit
    const onDown = (ev)=>{
      // respect drag threshold if provided: if user is dragging view, ignore
      // (we can’t fully know here, but keep it light)
      const cx = (ev.clientX ?? (s.left + lx));
      const cy = (ev.clientY ?? (s.top + ly));

      // remove first (so it feels snappy)
      kill('hit');

      // afterimage at local coordinate
      addAfterimage(hostSpawn, lx, ly, ch);

      // judge callback
      try{
        if (typeof opts.judge === 'function'){
          opts.judge(ch, {
            id,
            isGood:data.isGood,
            isPower:data.isPower,
            kind:data.kind,
            clientX: cx,
            clientY: cy
          });
        }
      }catch{}
      ev.preventDefault?.();
      ev.stopPropagation?.();
    };

    el.addEventListener('pointerdown', onDown, { passive:false });

    // expire timer
    const expireTimer = ROOT.setTimeout(()=> kill('expire'), life);

    state.active.set(id, {
      id, el, data,
      born, life,
      expireTimer,
      kill
    });
  }

  function scheduleNext(){
    if (state.stopped) return;
    const mul = (typeof opts.spawnIntervalMul === 'function') ? (Number(opts.spawnIntervalMul())||1) : 1;
    const delay = clamp(baseInterval * clamp(mul, 0.35, 2.5), 180, 1600);
    state.timerId = ROOT.setTimeout(()=>{
      state.timerId = null;
      spawnOne();
      scheduleNext();
    }, delay);
  }

  // start
  scheduleNext();

  function stop(){
    if (state.stopped) return;
    state.stopped = true;
    try{ if (state.timerId) ROOT.clearTimeout(state.timerId); }catch{}
    state.timerId = null;

    for (const it of state.active.values()){
      try{ ROOT.clearTimeout(it.expireTimer); }catch{}
      try{ it.el.remove(); }catch{}
    }
    state.active.clear();
    state.recent.length = 0;
  }

  return { stop };
}

export default { boot };