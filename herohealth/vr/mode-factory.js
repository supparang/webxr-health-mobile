// === /herohealth/vr/mode-factory.js ===
// DOM target spawn factory (SAFE) — with mount rect fallback + shot_miss callback
'use strict';

/**
 * boot({
 *   mount, seed, spawnRate, sizeRange, kinds, decorateTarget,
 *   onHit, onExpire, onShotMiss
 * })
 *
 * kinds: [{kind:'good', weight:0.7}, {kind:'junk', weight:0.3}]
 */
export function boot(opts = {}){
  const mount = opts.mount;
  if (!mount) throw new Error('mode-factory: missing mount');

  const ROOT = window;
  const DOC = document;

  const spawnRate = Math.max(120, Number(opts.spawnRate || 900));
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 64];
  const kinds     = Array.isArray(opts.kinds) && opts.kinds.length ? opts.kinds : [{kind:'good', weight:1}];
  const decorateTarget = (typeof opts.decorateTarget === 'function') ? opts.decorateTarget : ()=>{};
  const onHit     = (typeof opts.onHit === 'function') ? opts.onHit : ()=>{};
  const onExpire  = (typeof opts.onExpire === 'function') ? opts.onExpire : ()=>{};
  const onShotMiss= (typeof opts.onShotMiss === 'function') ? opts.onShotMiss : null;

  // -------- rng --------
  function seededRng(seed){
    let t = (Number(seed) || Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = seededRng(opts.seed);

  const rand  = (a,b)=> a + (b-a)*rng();

  // -------- state --------
  let stopped = false;
  let spawnTimer = null;
  let rafId = 0;
  let seq = 0;

  // active targets: id -> record
  const active = new Map();

  // dedupe shot_miss between pointerdown on target and global pointerdown
  let lastTargetPointerTs = 0;

  // -------- geometry / safe-zone --------
  function getMountRectSafe(){
    let r = null;
    try { r = mount.getBoundingClientRect(); } catch {}
    let w = r ? r.width : 0;
    let h = r ? r.height : 0;
    let x = r ? r.left : 0;
    let y = r ? r.top  : 0;

    let fallback = false;
    if (!(w > 8 && h > 8)){
      fallback = true;

      // Try offset sizes first
      w = mount.offsetWidth || 0;
      h = mount.offsetHeight || 0;
      x = 0; y = 0;

      if (!(w > 8 && h > 8)){
        // viewport fallback (important when layout not ready)
        w = ROOT.innerWidth  || DOC.documentElement.clientWidth  || 360;
        h = ROOT.innerHeight || DOC.documentElement.clientHeight || 640;
        x = 0; y = 0;
      }
    }

    // safe insets from CSS vars if available
    const cs = getComputedStyle(DOC.documentElement);
    const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
    const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;
    const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
    const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;

    // HUD avoidance (top/bottom)
    const topPad = Math.max(12 + sat, 120);   // reserve top HUD area
    const botPad = Math.max(12 + sab, 180);   // reserve coach+controls area
    const sidePadL = Math.max(12 + sal, 12);
    const sidePadR = Math.max(12 + sar, 12);

    const safe = {
      left:   x + sidePadL,
      top:    y + topPad,
      right:  x + Math.max(sidePadL + 80, w - sidePadR),
      bottom: y + Math.max(topPad + 120, h - botPad)
    };

    // ensure valid safe area
    if (safe.right - safe.left < 80){
      safe.left = x + 8;
      safe.right = x + Math.max(120, w - 8);
    }
    if (safe.bottom - safe.top < 80){
      safe.top = y + 8;
      safe.bottom = y + Math.max(120, h - 8);
    }

    emitSpawnDebug('mount_rect', {
      rect: { x:Math.round(x), y:Math.round(y), w:Math.round(w), h:Math.round(h) },
      safe: {
        left:Math.round(safe.left), top:Math.round(safe.top),
        right:Math.round(safe.right), bottom:Math.round(safe.bottom)
      },
      fallback
    });

    return { x, y, w, h, safe, fallback };
  }

  // -------- weighted kind pick --------
  function pickKind(){
    let total = 0;
    for (const k of kinds) total += Math.max(0, Number(k.weight || 0));
    if (total <= 0) return { kind:'good', rng };

    let t = rng() * total;
    for (const k of kinds){
      t -= Math.max(0, Number(k.weight || 0));
      if (t <= 0) return { ...k, rng };
    }
    return { ...kinds[kinds.length - 1], rng };
  }

  // -------- target create/remove --------
  function createTarget(){
    if (stopped) return;
    const g = getMountRectSafe();

    const size = Math.round(rand(
      Math.min(sizeRange[0], sizeRange[1]),
      Math.max(sizeRange[0], sizeRange[1])
    ));

    // spawn inside SAFE area
    const minX = g.safe.left;
    const maxX = g.safe.right - size;
    const minY = g.safe.top;
    const maxY = g.safe.bottom - size;

    // if geometry still weird, skip this tick quietly
    if (!(maxX > minX && maxY > minY)){
      emitSpawnDebug('spawn_skip_bad_safe', {
        minX, maxX, minY, maxY, size,
        rect: { w:g.w, h:g.h }, fallback: g.fallback
      });
      return;
    }

    const vx = rand(minX, maxX);
    const vy = rand(minY, maxY);

    const kindObj = pickKind();
    const id = `t_${Date.now()}_${(++seq)}`;

    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'plateTarget';
    el.dataset.id = id;
    el.dataset.kind = String(kindObj.kind || 'good');

    // place relative to mount
    const localX = Math.round(vx - g.x);
    const localY = Math.round(vy - g.y);
    el.style.left = `${localX}px`;
    el.style.top = `${localY}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;

    // default TTL by mode if not provided
    let ttl = 2200;
    if (kindObj.kind === 'junk') ttl = 2400;
    if (spawnRate <= 700) ttl = Math.max(1500, ttl - 250);

    const rec = {
      id, el,
      kind: kindObj.kind || 'good',
      groupIndex: null,
      bornAt: performance.now(),
      ttl,
      dead: false,
      x: localX, y: localY, size
    };

    // let game decorate assign group/emoji/etc
    try { decorateTarget(el, { ...kindObj, el, id, size }); } catch (e) {
      console.warn('decorateTarget error', e);
    }

    const gId = Number(el.dataset.group || 0);
    if (gId >= 1 && gId <= 5) rec.groupIndex = gId - 1;

    // target hit
    const onTargetPointer = (ev)=>{
      if (stopped || rec.dead) return;
      rec.dead = true;
      lastTargetPointerTs = performance.now();

      el.classList.add('hit');
      setTimeout(()=>{ tryRemove(id); }, 70);

      try {
        onHit({
          id: rec.id,
          el: rec.el,
          kind: rec.kind,
          groupIndex: rec.groupIndex,
          x: rec.x, y: rec.y, size: rec.size,
          event: ev
        });
      } catch (e) {
        console.warn('onHit error', e);
      }
    };

    el.addEventListener('pointerdown', onTargetPointer, { passive:true });
    el.addEventListener('click', onTargetPointer, { passive:true });

    active.set(id, rec);
    mount.appendChild(el);

    emitSpawnDebug('spawn', {
      id,
      kind: rec.kind,
      groupIndex: rec.groupIndex,
      x: rec.x, y: rec.y, size: rec.size,
      ttl,
      mountFallback: g.fallback
    });
  }

  function tryRemove(id){
    const rec = active.get(id);
    if (!rec) return false;
    active.delete(id);
    try { rec.el.remove(); } catch {}
    return true;
  }

  // -------- expire loop --------
  function tick(){
    if (stopped) return;
    const now = performance.now();

    for (const [id, rec] of active){
      if (rec.dead) continue;
      if ((now - rec.bornAt) >= rec.ttl){
        rec.dead = true;
        rec.el.classList.add('expire');
        setTimeout(()=>{ tryRemove(id); }, 90);

        try {
          onExpire({
            id: rec.id,
            el: rec.el,
            kind: rec.kind,
            groupIndex: rec.groupIndex,
            x: rec.x, y: rec.y, size: rec.size
          });
        } catch (e) {
          console.warn('onExpire error', e);
        }
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  // -------- global shot_miss bridge --------
  function fireShotMiss(meta){
    if (!onShotMiss) return;
    try { onShotMiss(meta || {}); } catch (e) { console.warn('onShotMiss error', e); }
  }

  function onGlobalPointerDown(ev){
    if (stopped) return;

    // If a target pointer happened same frame-ish, skip miss
    const dt = performance.now() - lastTargetPointerTs;
    if (dt >= 0 && dt < 30) return;

    const t = ev.target;
    if (t && t.closest && t.closest('.plateTarget')) return;

    fireShotMiss({
      source: 'pointer',
      x: Number(ev.clientX)||0,
      y: Number(ev.clientY)||0
    });
  }

  function onShootEvent(ev){
    if (stopped) return;

    // Let run page / vr-ui try auto-hit first; if no target got clicked in short window => miss
    const d = ev.detail || {};
    const ts0 = performance.now();
    setTimeout(()=>{
      const dt = performance.now() - lastTargetPointerTs;
      if (lastTargetPointerTs < ts0 && dt >= 0){
        fireShotMiss({
          source: 'hha:shoot',
          x: Number(d.x)||0,
          y: Number(d.y)||0,
          lockPx: Number(d.lockPx)||0
        });
      }
    }, 24);
  }

  // -------- spawn debug event --------
  function emitSpawnDebug(type, detail){
    try{
      ROOT.dispatchEvent(new CustomEvent('hha:spawn_debug', {
        detail: { type, ...(detail||{}) }
      }));
    }catch{}
  }

  // -------- controls --------
  function startSpawning(){
    if (spawnTimer) clearInterval(spawnTimer);
    createTarget(); // immediate first target
    spawnTimer = setInterval(createTarget, spawnRate);
    emitSpawnDebug('start', { spawnRate });
  }

  function stop(){
    if (stopped) return;
    stopped = true;

    try { clearInterval(spawnTimer); } catch {}
    spawnTimer = null;

    try { cancelAnimationFrame(rafId); } catch {}
    rafId = 0;

    ROOT.removeEventListener('pointerdown', onGlobalPointerDown, true);
    ROOT.removeEventListener('hha:shoot', onShootEvent, false);

    for (const [id] of active) tryRemove(id);
    active.clear();

    emitSpawnDebug('stop', {});
  }

  // -------- init --------
  ROOT.addEventListener('pointerdown', onGlobalPointerDown, true);
  ROOT.addEventListener('hha:shoot', onShootEvent, { passive:true });

  startSpawning();
  rafId = requestAnimationFrame(tick);

  return {
    stop,
    getState(){
      return {
        stopped,
        spawnRate,
        activeCount: active.size
      };
    }
  };
}