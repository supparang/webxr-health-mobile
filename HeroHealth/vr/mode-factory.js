// === /HeroHealth/vr/mode-factory.js (2025-11-13 ADAPTIVE+) ===
// DOM click-target spawner for all modes
// Emits: hha:time, hha:score, hha:hit-screen, hha:expired, hha:pause/resume, hha:end, hha:layer-ready, hha:tune, hha:toast

export function boot(opts = {}) {
  // ---- config ----
  const duration   = Number(opts.duration ?? 60) | 0;
  const pools      = opts.pools || { good: ['✅'], bad: ['❌'] };
  const goodRate   = Number(opts.goodRate ?? 0.6);
  const judge      = typeof opts.judge === 'function' ? opts.judge : () => ({ good: true, scoreDelta: 1 });
  const onExpire   = typeof opts.onExpire === 'function' ? opts.onExpire : null;
  const powerups   = opts.powerups || [];
  const powerRate  = Number(opts.powerRate ?? 0.1);
  const powerEvery = Number(opts.powerEvery ?? 7);
  const diff       = String(opts.difficulty || 'normal');

  // ---- adaptive tuning (optional) ----
  const adaptive = Object.assign({
    enabled: false,
    stepGood: 12,          // ทุก ๆ กี่ hit ดี เพิ่มความยาก
    lifeBase: 2000,        // อายุเป้าเริ่มต้น (ms)
    lifeMin: 900,          // อายุเป้าน้อยสุด (ms)
    lifeStep: 80,          // ลดอายุเป้าครั้งละเท่าไร (ms)
    gapEasy: 480,          // base gap โดย diff
    gapNormal: 360,
    gapHard: 280,
    gapMin: 120,           // ช่วง spawn ต่ำสุด (ms)
    gapStep: 16,           // ลด gap ครั้งละเท่าไร (ms)
    toast: (lvl)=>`ความท้าทายเพิ่มขึ้น! เลเวล ${lvl}`
  }, (opts.adaptive||{}));

  // ---- utils ----
  const vw = () => Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
  const vh = () => Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const fire = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch(_){} };

  function getXY(ev){
    let cx = 0, cy = 0;
    try{
      if (ev?.touches?.[0]) { cx = ev.touches[0].clientX; cy = ev.touches[0].clientY; }
      else if (ev?.changedTouches?.[0]) { cx = ev.changedTouches[0].clientX; cy = ev.changedTouches[0].clientY; }
      else { cx = ev?.clientX ?? 0; cy = ev?.clientY ?? 0; }
      if (window.visualViewport && window.visualViewport.offsetTop) {
        cy -= window.visualViewport.offsetTop;
      }
    }catch(_){}
    return { cx, cy };
  }

  function computeSafeTop(){
    let safe = 100;
    try{
      const el = document.querySelector('#hudTop .score-box') ||
                 document.querySelector('[data-hud="scorebox"]');
      if (el){
        const r = el.getBoundingClientRect();
        safe = Math.max(60, Math.round(r.bottom + 24));
      }
    }catch(_){}
    return safe;
  }

  function safePos(forceCenter){
    const safeTop = computeSafeTop();
    const safeBot = vh() - 60;
    const x = forceCenter ? vw()/2 : Math.floor(vw()*0.12 + Math.random()*vw()*0.76);
    const y = forceCenter ? clamp(vh()/2, safeTop, safeBot)
                          : Math.floor(Math.max(safeTop, Math.random()*(safeBot - safeTop)));
    return { x, y };
  }

  // ---- style ----
  (function injectCSS(){
    if (document.getElementById('hha-factory-style')) return;
    const st = document.createElement('style'); st.id = 'hha-factory-style';
    st.textContent = `
      .hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto;background:transparent}
      .hha-layer.off{pointer-events:none!important}
      .hha-tgt{position:absolute;transform:translate(-50%,-50%);display:block;opacity:1;
        user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;
        background:transparent;padding:14px 16px;border-radius:18px;
        font-size:64px;line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));
        transition:transform .12s ease,opacity .24s ease;cursor:pointer}
      .hha-tgt.hit{transform:translate(-50%,-50%) scale(.85);opacity:.15}
    `;
    document.head.appendChild(st);
  })();

  // ---- mount layer ----
  const mount = document.querySelector('#spawnHost') ||
                document.querySelector('.game-wrap') ||
                document.body;
  let layer = document.querySelector('.hha-layer');
  if (!layer){
    layer = document.createElement('div');
    layer.className = 'hha-layer';
    mount.appendChild(layer);
  }
  fire('hha:layer-ready', { el: layer });

  // ---- state ----
  let running = false, killed = false;
  let secLeft = duration | 0;
  let timerId = null, spawnTimer = null;

  // life & gap base
  let lifeMs = adaptive.enabled ? adaptive.lifeBase : 2000;
  const gapBase = (diff==='easy' ? (adaptive.enabled?adaptive.gapEasy:480)
                  : diff==='hard' ? (adaptive.enabled?adaptive.gapHard:280)
                  : (adaptive.enabled?adaptive.gapNormal:360));

  // dynamics
  let sinceLastPower = 0, spawnCount = 0;
  let level = 0, goodHit = 0;   // adaptive counters
  let extraGapCut = 0;          // cumulative gap reduction by level

  // ---- time loop ----
  function tick(){
    if (!running) return;
    secLeft = Math.max(0, secLeft - 1);
    fire('hha:time', { sec: secLeft });
    if (secLeft <= 0) { endGame('timeout'); }
  }

  const shouldSpawnPower = () => (sinceLastPower >= powerEvery) && (Math.random() < powerRate);

  function currentGap(){
    // base gap - speedup by spawnCount - adaptive extra
    let gap = gapBase - Math.min(spawnCount * 4, 120) - extraGapCut;
    gap = Math.max(adaptive.enabled ? adaptive.gapMin : 120, gap);
    return gap;
  }

  function spawnOne(forceCenter){
    if (!running) return;
    spawnCount++; sinceLastPower++;

    const usePower = powerups.length>0 && shouldSpawnPower();
    const isGood = usePower ? true : (Math.random() < goodRate);
    const ch = usePower ? pick(powerups) : pick(isGood ? (pools.good || ['✅']) : (pools.bad || ['❌']));

    const el = document.createElement('div');
    el.className = 'hha-tgt';
    el.textContent = ch;

    const p = safePos(!!forceCenter);
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.style.fontSize = (diff==='easy'?74 : (diff==='hard'?56 : 64)) + 'px';

    let clicked = false;

    function onHit(ev){
      if (clicked || !running || killed) return;
      clicked = true;
      try { ev.preventDefault(); ev.stopPropagation(); } catch(_){}

      const pt = getXY(ev);
      const res = judge(ch, { clientX: pt.cx, clientY: pt.cy, cx: pt.cx, cy: pt.cy, isGood });

      const good  = !!(res && res.good);
      const delta = (res && typeof res.scoreDelta === 'number') ? res.scoreDelta : (good ? 1 : -1);

      try { el.classList.add('hit'); layer.removeChild(el); } catch(_){}

      // --- adaptive count on good hits ---
      if (adaptive.enabled && good){
        goodHit++;
        if (goodHit % adaptive.stepGood === 0){
          level++;
          lifeMs = Math.max(adaptive.lifeMin, lifeMs - adaptive.lifeStep);
          extraGapCut = Math.min((level * adaptive.gapStep), (gapBase - adaptive.gapMin));
          fire('hha:tune', { level, lifeMs, extraGapCut });
          fire('hha:toast', { text: adaptive.toast(level), level });
        }
      }

      fire('hha:hit-screen', { x: pt.cx, y: pt.cy, good, delta, char: ch, isGood });
      fire('hha:score', { delta, good });

      planNextSpawn();
    }

    el.addEventListener('pointerdown', onHit, { passive: false });
    el.addEventListener('touchstart',  onHit, { passive: false });
    el.addEventListener('mousedown',   onHit, { passive: false });
    el.addEventListener('click',       onHit, { passive: false });

    const killId = setTimeout(() => {
      if (clicked || !running || killed) return;
      try { layer.removeChild(el); } catch(_){}
      fire('hha:expired', { isGood, char: ch });
      if (onExpire) { try { onExpire({ isGood, ch }); } catch(_){ } }
      planNextSpawn();
    }, lifeMs);
    el._killId = killId;

    layer.appendChild(el);
  }

  function planNextSpawn(){
    if (!running || killed) return;
    clearTimeout(spawnTimer);
    spawnTimer = setTimeout(() => spawnOne(false), currentGap());
  }

  // ---- lifecycle ----
  function start(){
    if (running) return;
    running = true; killed = false;
    layer.classList.remove('off');

    clearInterval(timerId);
    secLeft = duration | 0;
    fire('hha:time', { sec: secLeft });
    timerId = setInterval(tick, 1000);

    requestAnimationFrame(() => { spawnOne(true); planNextSpawn(); });
  }

  function pause(){
    if (!running) return;
    try { clearInterval(timerId); } catch(_){}
    try { clearTimeout(spawnTimer); } catch(_){}
    fire('hha:pause', {});
  }

  function resume(){
    if (!running) return;
    try { clearInterval(timerId); } catch(_){}
    timerId = setInterval(tick, 1000);
    fire('hha:resume', {});
  }

  function hardClearLayer(){
    try{
      layer.classList.add('off');
      const nodes = layer.querySelectorAll('.hha-tgt');
      nodes.forEach(n => { try { if (n._killId) clearTimeout(n._killId); } catch(_){ } });
      while (layer.firstChild) layer.removeChild(layer.firstChild);
    }catch(_){}
  }

  function endGame(reason){
    if (killed) return; killed = true; running = false;
    try { clearInterval(timerId); } catch(_){}
    try { clearTimeout(spawnTimer); } catch(_){}
    hardClearLayer();
    fire('hha:end', { reason: reason || 'done' });
  }

  function stop(){ endGame('done'); }

  try {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause(); else resume();
    });
  } catch(_){}

  return Promise.resolve({ start, pause, resume, stop });
}

export default { boot };
