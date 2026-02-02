// ---------- Shockwave Ring ----------
  function ring(x, y, opts){
    const layer = ensureLayer();
    cleanupIfNeeded(layer);

    const vx = clamp(x, 0, WIN.innerWidth||999999);
    const vy = clamp(y, 0, WIN.innerHeight||999999);

    const el = DOC.createElement('div');
    el.className = 'hha-ring';
    const size = clamp((opts && opts.size) || 110, 60, 220);
    const ms   = clamp((opts && opts.ms)   || 420, 200, 900);
    const cls  = (opts && opts.className) ? String(opts.className) : '';
    if(cls) el.className += ' ' + cls;

    el.style.left = vx + 'px';
    el.style.top  = vy + 'px';
    el.style.setProperty('--ringSize', size + 'px');
    el.style.setProperty('--ringMs', ms + 'ms');

    layer.appendChild(el);
    // eslint-disable-next-line no-unused-expressions
    el.offsetHeight;

    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, ms + 80);
    return true;
  }