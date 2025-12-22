// === /herohealth/vr/mode-factory.js ===
// HeroHealth VR/Quest — Generic DOM target spawner (adaptive-ish, safezone, crosshair friendly)
// ✅ judge() can return { remove:false } / { keep:true } to keep target (multi-hit boss)
// ✅ ctx.targetEl provided
// ✅ each target has el.__hhaData with data._hit(...) usable for "shootCrosshair" synth
// ✅ onExpire callback
// ✅ excludeSelectors safezone
// ✅ getViewOffset() support (for layer translate by camera yaw/pitch like GoodJunk/Plate)
// Export: boot(opts) -> Promise<api>

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const doc = ROOT.document;

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rnd = (a,b)=>a+Math.random()*(b-a);
const now = ()=> (ROOT.performance?.now?.() ?? Date.now());

function rectPad(r, p){
  return { left:r.left-p, top:r.top-p, right:r.right+p, bottom:r.bottom+p, width:r.width+2*p, height:r.height+2*p };
}
function rectIntersects(a,b){
  return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
}

function getRectsFromSelectors(selectors){
  const out = [];
  if (!selectors || !selectors.length) return out;
  for (const sel of selectors){
    const el = doc.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 8 && r.height > 8){
      out.push({ left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height });
    }
  }
  return out;
}

// ----- default difficulty base -----
const BASE_TABLE = {
  easy:   { spawnMs: 900, size: 92, life: 3200 },
  normal: { spawnMs: 780, size: 78, life: 2700 },
  hard:   { spawnMs: 660, size: 66, life: 2300 },
};

function pickSafePoint({ boundsRect, blockedRects, sizePx, margin=14, getViewOffset }){
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const off = (typeof getViewOffset === 'function') ? (getViewOffset() || {x:0,y:0}) : {x:0,y:0};

  const half = sizePx*0.5;
  const tries = 80;

  // usable screen area (screen coords)
  const minX = margin + half;
  const maxX = (boundsRect ? boundsRect.right : vw) - margin - half;
  const minY = (boundsRect ? boundsRect.top : 0) + margin + half;
  const maxY = (boundsRect ? boundsRect.bottom : vh) - margin - half;

  for (let i=0;i<tries;i++){
    const sx = rnd(minX, Math.max(minX+1, maxX));
    const sy = rnd(minY, Math.max(minY+1, maxY));

    const sr = { left:sx-half, top:sy-half, right:sx+half, bottom:sy+half };

    let ok = true;
    for (const b of blockedRects){
      if (rectIntersects(sr, b)){ ok = false; break; }
    }
    if (!ok) continue;

    // convert to spawnHost local (subtract layer translate offset)
    return { x: sx - off.x, y: sy - off.y };
  }

  // fallback center-ish
  const sx = (boundsRect ? (boundsRect.left + boundsRect.right)*0.55 : vw*0.55);
  const sy = (boundsRect ? (boundsRect.top + boundsRect.bottom)*0.55 : vh*0.55);
  return { x: sx - off.x, y: sy - off.y };
}

function makeTargetEl(spawnHost, sizePx){
  const el = doc.createElement('div');
  el.className = 'hvr-target';
  Object.assign(el.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    width: `${sizePx}px`,
    height: `${sizePx}px`,
    borderRadius: '999px',
    pointerEvents: 'auto',
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    transform: 'translate3d(0,0,0) scale(1)',
    transformOrigin: 'center',
  });
  spawnHost.appendChild(el);
  return el;
}

export async function boot(opts = {}){
  if (!doc) throw new Error('mode-factory: document not available');

  const spawnHost = opts.spawnHost || doc.body;
  const boundsHost = opts.boundsHost || doc.body;

  const difficulty = String(opts.difficulty || 'normal').toLowerCase();
  const base = BASE_TABLE[difficulty] || BASE_TABLE.normal;

  const duration = Math.max(10, Number(opts.duration || 80) || 80);

  const pickItem = (typeof opts.pickItem === 'function') ? opts.pickItem : (()=>({ ch:'🥗', isGood:true, itemType:'good', extra:{} }));
  const decorateTarget = (typeof opts.decorateTarget === 'function') ? opts.decorateTarget : null;
  const judge = (typeof opts.judge === 'function') ? opts.judge : null;
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : null;

  const excludeSelectors = Array.isArray(opts.excludeSelectors) ? opts.excludeSelectors : [];
  const getViewOffset = (typeof opts.getViewOffset === 'function') ? opts.getViewOffset : null;

  const spawnIntervalMul = (typeof opts.spawnIntervalMul === 'function') ? opts.spawnIntervalMul : (()=>1);

  // state
  let running = true;
  let paused = false;
  const startedAt = now();
  let nextSpawnAt = startedAt + 350;

  let seq = 0;
  const targets = new Set(); // store data objects

  function stop(){
    running = false;
    paused = false;
    // cleanup
    for (const d of Array.from(targets)){
      try { d.el?.remove(); } catch(_) {}
      targets.delete(d);
    }
  }

  function pause(){ paused = true; }
  function resume(){ paused = false; }

  function computeSizePx(picked){
    const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
    const scale = clamp(Math.min(vw, vh) / 820, 0.86, 1.12);
    let sz = clamp((base.size || 78) * scale, 48, 140);
    if (picked && typeof picked.sizeMul === 'number') sz = clamp(sz * picked.sizeMul, 24, 220);
    return Math.round(sz);
  }

  function computeLifeMs(picked){
    let life = base.life || 2700;
    if (picked && typeof picked.lifeMs === 'number') life = picked.lifeMs;
    return Math.max(350, Math.round(life));
  }

  function removeData(d){
    if (!d || d.dead) return;
    d.dead = true;
    targets.delete(d);
    try { d.el?.remove(); } catch(_) {}
  }

  function expireTick(tNow){
    for (const d of Array.from(targets)){
      if (d.dead) { targets.delete(d); continue; }
      if (tNow >= d.dieAt){
        try { onExpire && onExpire({ el:d.el, data:d, ch:d.ch, itemType:d.itemType, extra:d.extra }); } catch(e){
          console.error('[mode-factory] onExpire error', e);
        }
        removeData(d);
      }
    }
  }

  function spawnOne(){
    const picked = pickItem({ t: now(), difficulty });
    const sizePx = computeSizePx(picked);
    const lifeMs = computeLifeMs(picked);

    const boundsRect = boundsHost?.getBoundingClientRect ? boundsHost.getBoundingClientRect() : null;
    const blocked = getRectsFromSelectors(excludeSelectors).map(r => rectPad(r, 10));

    const pos = pickSafePoint({
      boundsRect: boundsRect || {left:0, top:0, right:ROOT.innerWidth, bottom:ROOT.innerHeight},
      blockedRects: blocked,
      sizePx,
      margin: 14,
      getViewOffset
    });

    const el = makeTargetEl(spawnHost, sizePx);
    el.dataset.hhaId = String(++seq);

    // allow className injection
    if (picked && typeof picked.className === 'string' && picked.className.trim()){
      picked.className.trim().split(/\s+/).forEach(c => el.classList.add(c));
    }

    // set position (spawnHost local)
    const sc = 0.92 + Math.random()*0.22;
    el.style.transform = `translate3d(${Math.round(pos.x - sizePx/2)}px, ${Math.round(pos.y - sizePx/2)}px, 0) scale(${sc})`;

    // put content
    if (decorateTarget){
      try { decorateTarget(el, null, picked, { sizePx, lifeMs }); } catch(e){
        console.error('[mode-factory] decorateTarget error', e);
      }
    } else {
      el.textContent = String(picked?.ch || '🥗');
      el.style.display = 'grid';
      el.style.placeItems = 'center';
      el.style.fontSize = `${Math.max(20, Math.round(sizePx*0.52))}px`;
      el.style.background = 'rgba(34,197,94,.14)';
      el.style.border = '1px solid rgba(34,197,94,.35)';
    }

    const bornAt = now();
    const dieAt = bornAt + lifeMs;

    const d = {
      el,
      ch: picked?.ch,
      itemType: picked?.itemType || (picked?.isGood ? 'good' : 'bad'),
      extra: picked?.extra || {},
      bornAt,
      dieAt,
      sizePx,
      dead: false,
      _lastHitAt: 0,
      _hit: null,
    };

    // attach backref for synth hit
    el.__hhaData = d;

    function consumeHit(ev){
      if (!running || paused) return;
      if (d.dead) return;

      const tNow = now();
      if (d._lastHitAt && (tNow - d._lastHitAt) < 120) return;
      d._lastHitAt = tNow;

      // compute screen center of target
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const sx = ROOT.innerWidth/2;
      const sy = ROOT.innerHeight/2;
      const distToCrosshair = Math.hypot(cx - sx, cy - sy);

      const ctx = {
        targetEl: el,
        data: d,
        ch: d.ch,
        itemType: d.itemType,
        extra: d.extra,
        sizePx: d.sizePx,
        rect: r,
        cx, cy,
        crossX: sx,
        crossY: sy,
        distToCrosshair,
        t: Math.round((tNow - startedAt) || 0),
        rawEvent: ev || null,
      };

      let jr = null;
      try { jr = judge ? judge(d.ch, ctx) : null; } catch(e){
        console.error('[mode-factory] judge error', e);
      }

      const keep = !!(jr && (jr.keep === true || jr.remove === false));

      if (!keep){
        removeData(d);
      } else {
        // tiny feedback for keep targets
        try{
          el.classList.add('hha-keep');
          setTimeout(()=> el.classList.remove('hha-keep'), 120);
        }catch(_){}
      }
      return jr;
    }

    d._hit = consumeHit;

    const hitHandler = (e)=>{
      try{
        e.preventDefault();
        e.stopPropagation();
      }catch(_){}
      consumeHit(e);
    };

    el.addEventListener('pointerdown', hitHandler, { passive:false });
    el.addEventListener('click', hitHandler, { passive:false });
    el.addEventListener('touchstart', hitHandler, { passive:false });

    targets.add(d);
    return d;
  }

  function spawnBurst(n){
    const m = Math.max(1, n|0);
    for (let i=0;i<m;i++) spawnOne();
  }

  function tick(){
    if (!running) return;
    const tNow = now();

    if (!paused){
      // duration end auto-stop (caller may stop earlier)
      if (((tNow - startedAt)/1000) >= duration){
        // let caller handle end; just stop spawning
        nextSpawnAt = Infinity;
      }

      expireTick(tNow);

      if (tNow >= nextSpawnAt){
        const mul = clamp(Number(spawnIntervalMul() || 1), 0.15, 6.0);
        const baseMs = base.spawnMs || 780;
        const interval = clamp(baseMs * mul, 220, 2600);
        const jitter = rnd(-120, 120);

        spawnBurst(1);

        nextSpawnAt = tNow + Math.max(180, interval + jitter);
      }
    }

    ROOT.requestAnimationFrame(tick);
  }

  ROOT.requestAnimationFrame(tick);

  return {
    stop,
    pause,
    resume,
    spawnNow: (n=1)=>spawnBurst(n),
    getTargets: ()=>Array.from(targets),
    isRunning: ()=>running,
    isPaused: ()=>paused,
  };
}