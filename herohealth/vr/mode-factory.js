// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) — PRODUCTION (HHA Standard)
// ✅ spawn in mount playRect (fixed layer)
// ✅ SAFEZONE exclusion (avoid HUD) + auto-relax when rect too small
// ✅ Seeded RNG: cfg.seed + cfg.rng override
// ✅ crosshair shooting: listens hha:shoot and resolves nearest target
// ✅ NEW (Plate/Boss ready):
//    - pickExtra(t, ctx) -> attach meta (e.g., groupIndex)
//    - apply dataset: data-kind / data-group / data-tag
//    - onHit receives t with extra fields

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function seededRng(seed){
  let t = (seed>>>0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rectOf(el){
  if(!el) return null;
  const r = el.getBoundingClientRect();
  return { x:r.left, y:r.top, w:r.width, h:r.height };
}

function pointInRect(x,y,r){
  return x>=r.x && y>=r.y && x<=(r.x+r.w) && y<=(r.y+r.h);
}

function dist2(ax,ay,bx,by){
  const dx=ax-bx, dy=ay-by;
  return dx*dx + dy*dy;
}

function ensureSafezones(cfg){
  // SAFEZONE rects list (screen coords)
  // Caller can pass cfg.safezones as array of DOM selectors or rect objects
  const out = [];
  const zs = cfg.safezones || [];
  for(const z of zs){
    if(!z) continue;
    if(typeof z === 'string'){
      const el = DOC.querySelector(z);
      const r = rectOf(el);
      if(r && r.w>2 && r.h>2) out.push(r);
    } else if(typeof z === 'object' && z.x!=null){
      out.push({ x:+z.x, y:+z.y, w:+z.w, h:+z.h });
    }
  }
  return out;
}

function relaxSafezonesIfTiny(play, safezones){
  // ถ้า playRect เล็กจนแทบไม่มีพื้นที่ ให้ลด safezone ลง
  if(!play || play.w < 220 || play.h < 220) return [];
  // ถ้าพื้นที่ที่เหลือ (คร่าวๆ) น้อยไป -> relax
  const total = play.w*play.h;
  let cover = 0;
  for(const s of safezones){
    const iw = Math.max(0, Math.min(play.x+play.w, s.x+s.w) - Math.max(play.x, s.x));
    const ih = Math.max(0, Math.min(play.y+play.h, s.y+s.h) - Math.max(play.y, s.y));
    cover += iw*ih;
  }
  if(cover/Math.max(1,total) > 0.45) return [];
  return safezones;
}

function randomPosIn(play, rng){
  const x = play.x + rng()*play.w;
  const y = play.y + rng()*play.h;
  return {x,y};
}

function avoidSafezones(play, safezones, rng, tries=14){
  if(!safezones || safezones.length===0) return randomPosIn(play, rng);
  for(let i=0;i<tries;i++){
    const p = randomPosIn(play, rng);
    let ok = true;
    for(const s of safezones){
      if(pointInRect(p.x,p.y,s)){ ok=false; break; }
    }
    if(ok) return p;
  }
  // fallback: accept any
  return randomPosIn(play, rng);
}

function resolveKind(cfg, rng){
  const kinds = cfg.kinds || [{kind:'good', weight:1}];
  let sum = 0;
  for(const k of kinds) sum += Math.max(0, Number(k.weight)||0);
  if(sum<=0) return kinds[0].kind || 'good';
  let t = rng()*sum;
  for(const k of kinds){
    t -= Math.max(0, Number(k.weight)||0);
    if(t<=0) return k.kind || 'good';
  }
  return kinds[kinds.length-1].kind || 'good';
}

function defaultMakeEl(t){
  const el = DOC.createElement('div');
  el.className = (t.className || 'hhaTarget');
  el.textContent = t.text || '🎯';
  el.style.position = 'absolute';
  el.style.left = `${t.cx}px`;
  el.style.top  = `${t.cy}px`;
  el.style.transform = 'translate(-50%,-50%)';
  el.style.width = `${t.size}px`;
  el.style.height = `${t.size}px`;
  el.style.borderRadius = '999px';
  el.style.display = 'grid';
  el.style.placeItems = 'center';
  el.style.userSelect = 'none';
  el.style.cursor = 'pointer';
  el.dataset.kind = t.kind || 'good';
  return el;
}

export function boot(cfg={}){
  if(!DOC) throw new Error('mode-factory: document missing');

  const mount = cfg.mount || DOC.body;
  const rng = cfg.rng || seededRng(cfg.seed || Date.now());

  // timing
  const spawnRate = clamp(cfg.spawnRate ?? 900, 120, 5000);
  const lifeMs    = clamp(cfg.lifeMs ?? 1800, 400, 15000);

  // visuals / sizing
  const sizeRange = cfg.sizeRange || [44, 64];

  // hooks
  const makeEl  = (typeof cfg.makeEl === 'function') ? cfg.makeEl : defaultMakeEl;
  const pickExtra = (typeof cfg.pickExtra === 'function') ? cfg.pickExtra : null;
  const onHit   = (typeof cfg.onHit === 'function') ? cfg.onHit : ()=>{};
  const onExpire= (typeof cfg.onExpire === 'function') ? cfg.onExpire : ()=>{};
  const onSpawn = (typeof cfg.onSpawn === 'function') ? cfg.onSpawn : ()=>{};
  const onTick  = (typeof cfg.onTick === 'function') ? cfg.onTick : ()=>{};

  // state
  const S = {
    running:true,
    targets:[],
    lastSpawn:0,
    safezones:[],
    playRect:null,
    aimLockPx: clamp(cfg.lockPx ?? 28, 6, 120)
  };

  function computeRects(){
    const play = rectOf(mount);
    if(!play) return;
    let safe = ensureSafezones(cfg);
    safe = relaxSafezonesIfTiny(play, safe);
    S.playRect = play;
    S.safezones = safe;
  }

  function spawnOne(){
    if(!S.playRect) computeRects();
    if(!S.playRect) return;

    const kind = resolveKind(cfg, rng);
    const size = Math.round(sizeRange[0] + rng()*(sizeRange[1]-sizeRange[0]));
    const p = avoidSafezones(S.playRect, S.safezones, rng);

    const t = {
      id: Math.random().toString(16).slice(2),
      kind,
      size,
      cx: Math.round(p.x),
      cy: Math.round(p.y),
      bornAt: now(),
      dieAt: now()+lifeMs,

      // optional meta
      groupIndex: null,
      tag: ''
    };

    // ✅ NEW: allow caller attach extra fields (e.g., groupIndex)
    if(pickExtra){
      const extra = pickExtra(t, {
        rng,
        playRect:S.playRect,
        safezones:S.safezones
      }) || {};
      Object.assign(t, extra);
    }

    const el = makeEl(t);
    t.el = el;

    // dataset for css rules
    if(el){
      el.dataset.kind = t.kind || '';
      if(t.groupIndex != null) el.dataset.group = String(t.groupIndex);
      if(t.tag) el.dataset.tag = String(t.tag);

      el.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault();
        hitTarget(t, { source:'tap', x:ev.clientX, y:ev.clientY });
      }, { passive:false });
    }

    mount.appendChild(el);
    S.targets.push(t);
    onSpawn(t);
  }

  function removeTarget(t, reason='expire'){
    if(!t) return;
    const i = S.targets.indexOf(t);
    if(i>=0) S.targets.splice(i,1);
    try{ t.el && t.el.remove(); }catch(_){}
    if(reason==='expire') onExpire(t);
  }

  function hitTarget(t, ctx){
    if(!t || !S.running) return;
    removeTarget(t, 'hit');
    onHit(Object.assign({}, t, { hit:ctx || null }));
  }

  // ✅ hha:shoot support (crosshair/tap-to-shoot from vr-ui.js)
  function onShoot(e){
    if(!S.running) return;
    const d = e.detail || {};
    const x = Number(d.x); const y = Number(d.y);
    if(!isFinite(x) || !isFinite(y)) return;

    // pick nearest target within lock radius
    const lockPx = clamp(d.lockPx ?? S.aimLockPx, 6, 160);
    const lock2 = lockPx*lockPx;
    let best=null, bestD=1e18;
    for(const t of S.targets){
      const dd = dist2(x,y, t.cx, t.cy);
      if(dd <= lock2 && dd < bestD){
        best=t; bestD=dd;
      }
    }
    if(best){
      hitTarget(best, { source:d.source||'shoot', x, y, lockPx });
    }
  }

  function tick(){
    if(!S.running) return;
    const t = now();

    // recompute play rect occasionally (orientation changes / resize)
    if(!S.playRect || (t - S.lastRectAt) > 900){
      S.lastRectAt = t;
      computeRects();
    }

    // expire targets
    for(let i=S.targets.length-1;i>=0;i--){
      const tg = S.targets[i];
      if(tg.dieAt <= t){
        removeTarget(tg,'expire');
      }
    }

    // spawn
    if(t - S.lastSpawn >= spawnRate){
      S.lastSpawn = t;
      spawnOne();
    }

    onTick({ t, n:S.targets.length });
    requestAnimationFrame(tick);
  }

  // init
  computeRects();
  ROOT.addEventListener('hha:shoot', onShoot);

  requestAnimationFrame(tick);

  return {
    stop(){
      S.running = false;
      ROOT.removeEventListener('hha:shoot', onShoot);
      // cleanup
      const arr = S.targets.slice();
      for(const t of arr) removeTarget(t,'stop');
      S.targets.length = 0;
    },
    getTargets(){ return S.targets.slice(); },
    recompute(){ computeRects(); }
  };
}