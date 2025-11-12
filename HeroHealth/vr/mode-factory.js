// === /HeroHealth/vr/mode-factory.js (2025-11-12 LATEST)
// - DOM spawn factory for click targets (safe hitbox + pointerdown)
// - Safe spawn zone (avoid HUD), visualViewport offset fix
// - End-safe: remove layer + disable pointer events so targets "คลิกไม่ได้"
// - Emits: hha:time, hha:score, hha:hit-screen, hha:expired, hha:pause/resume

export function boot(opts){
  opts = opts || {};
  var duration   = Number(opts.duration!=null?opts.duration:60)|0;
  var pools      = opts.pools || {good:['✅'], bad:['❌']};
  var goodRate   = Number(opts.goodRate!=null?opts.goodRate:0.6);
  var judge      = typeof opts.judge==='function' ? opts.judge : function(){return {good:true,scoreDelta:1};};
  var onExpire   = typeof opts.onExpire==='function' ? opts.onExpire : null;
  var powerups   = opts.powerups || [];
  var powerRate  = Number(opts.powerRate!=null?opts.powerRate:0.1);
  var powerEvery = Number(opts.powerEvery!=null?opts.powerEvery:7);
  var diff       = String(opts.difficulty||'normal');

  // --------- small helpers ---------
  function vw(){ return Math.max(0, window.innerWidth  || document.documentElement.clientWidth  || 0); }
  function vh(){ return Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0); }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail})) }catch(_){ } }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  // --------- style (hitbox + animation) ---------
  (function inject(){
    if (document.getElementById('hha-factory-style')) return;
    var st=document.createElement('style'); st.id='hha-factory-style';
    st.textContent =
      '.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto;background:transparent}'+
      '.hha-tgt{position:absolute;transform:translate(-50%,-50%);display:block;opacity:1;'+
      ' user-select:none;-webkit-user-select:none;touch-action:none;'+
      ' -webkit-tap-highlight-color:transparent;background:transparent;'+
      ' padding:14px 16px;border-radius:18px; /* wider invisible hitbox */ '+
      ' font-size:64px;line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));'+
      ' transition:transform .12s ease,opacity .24s ease;cursor:pointer}'+
      '.hha-tgt.hit{transform:translate(-50%,-50%) scale(.85);opacity:.15}'+
      '.hha-badge{position:fixed;left:50%;top:50px;transform:translateX(-50%);background:#0f172acc;color:#fff;padding:6px 10px;border:1px solid #475569;border-radius:10px;font:700 12px system-ui}';
    document.head.appendChild(st);
  })();

  // --------- layer ---------
  var layer = document.querySelector('.hha-layer');
  if (!layer){
    layer = document.createElement('div');
    layer.className = 'hha-layer';
    (document.querySelector('.game-wrap')||document.body).appendChild(layer);
  }

  // --------- state ---------
  var running=false, killed=false;
  var timerId=null, secLeft=duration|0;
  var spawnTimer=null, lifeMs=2000;
  var sinceLastPower=0, spawnCount=0;

  // --------- time loop ---------
  function tick(){
    if (!running) return;
    secLeft = Math.max(0, secLeft-1);
    fire('hha:time', {sec:secLeft});
    if (secLeft<=0){ endGame('timeout'); return; }
  }

  // --------- spawn helpers ---------
  function shouldSpawnPower(){
    // guard: not too frequent + probability gate
    if (sinceLastPower < powerEvery) return false;
    return Math.random() < powerRate;
  }

  function getXY(ev){
    var cx = ev && ev.clientX != null ? ev.clientX : 0;
    var cy = ev && ev.clientY != null ? ev.clientY : 0;
    try{
      if (ev && ev.touches && ev.touches[0]){ cx=ev.touches[0].clientX; cy=ev.touches[0].clientY; }
      if (window.visualViewport && window.visualViewport.offsetTop){ cy -= window.visualViewport.offsetTop; }
    }catch(_){}
    return {cx:cx, cy:cy};
  }

  function safePos(forceCenter){
    var safeTop = 120;                // avoid HUD
    var safeBot = vh() - 60;
    var x = forceCenter ? vw()/2 : Math.floor(vw()*0.12 + Math.random()*vw()*0.76);
    var y = forceCenter ? Math.max(safeTop, Math.min(vh()/2, safeBot))
                        : Math.floor(Math.max(safeTop, Math.random()*(safeBot - safeTop)));
    return {x:x, y:y};
  }

  function spawnOne(forceCenter){
    if(!running) return;
    spawnCount++; sinceLastPower++;

    var usePower = powerups.length>0 && shouldSpawnPower();
    var ch, isGood;
    if (usePower){ ch = pick(powerups); isGood=true; sinceLastPower=0; }
    else { isGood = Math.random() < goodRate; ch = pick(isGood?(pools.good||['✅']):(pools.bad||['❌'])); }

    var el = document.createElement('div');
    el.className = 'hha-tgt'; el.textContent = ch;

    var p = safePos(!!forceCenter);
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.style.fontSize = (diff==='easy'?74:(diff==='hard'?56:64))+'px';

    var clicked=false;
    function onHit(ev){
      if(clicked || !running) return; clicked=true;
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}

      var pt = getXY(ev);
      var res = judge(ch, { clientX:pt.cx, clientY:pt.cy, isGood:isGood });

      var good  = !!(res && res.good);
      var delta = (res && typeof res.scoreDelta==='number') ? res.scoreDelta : (good?1:-1);

      try{ el.classList.add('hit'); layer.removeChild(el); }catch(_){}
      fire('hha:hit-screen', {x:pt.cx, y:pt.cy, good:good, delta:delta, char:ch, isGood:isGood});
      fire('hha:score', {delta:delta, good:good});
      planNextSpawn();
    }

    // pointer-first (fast), with fallbacks
    el.addEventListener('pointerdown', onHit, {passive:false});
    el.addEventListener('touchstart',  onHit, {passive:false});
    el.addEventListener('mousedown',   onHit, {passive:false});
    el.addEventListener('click',       onHit, {passive:false});

    // expiry
    var ttl = lifeMs;
    var killId = setTimeout(function(){
      if(clicked || !running) return;
      try{ layer.removeChild(el); }catch(_){}
      // GOOD expired → miss; JUNK expired → avoid
      if (isGood){
        fire('hha:expired', {isGood:true, char:ch});
        if (onExpire) try{ onExpire({isGood:true, ch:ch}); }catch(_){}
      } else {
        fire('hha:expired', {isGood:false, char:ch});
        if (onExpire) try{ onExpire({isGood:false, ch:ch}); }catch(_){}
      }
      planNextSpawn();
    }, ttl);

    layer.appendChild(el);
  }

  function planNextSpawn(){
    if(!running) return;
    var gap = (diff==='easy'?480:(diff==='hard'?280:360));
    // dynamic: slightly faster if many clicks
    gap = Math.max(120, gap - Math.min(spawnCount*4, 120));
    clearTimeout(spawnTimer);
    spawnTimer = setTimeout(function(){ spawnOne(false); }, gap);
  }

  // --------- lifecycle ---------
  function start(){
    if (running) return;
    running = true; killed = false;
    layer.style.pointerEvents = 'auto';
    // time
    clearInterval(timerId); secLeft = duration|0;
    fire('hha:time',{sec:secLeft});
    timerId = setInterval(tick, 1000);
    // first target
    spawnOne(true);
    planNextSpawn();
  }

  function pause(){ if(!running) return; clearInterval(timerId); clearTimeout(spawnTimer); fire('hha:pause',{}); }
  function resume(){ if(!running) return; clearInterval(timerId); timerId=setInterval(tick,1000); fire('hha:resume',{}); }

  function endGame(reason){
    if (killed) return; killed=true;
    running=false;
    try{ clearInterval(timerId); }catch(_){}
    try{ clearTimeout(spawnTimer); }catch(_){}
    // remove all targets & disable hit
    try{
      layer.style.pointerEvents = 'none';
      while(layer.firstChild) layer.removeChild(layer.firstChild);
    }catch(_){}
    fire('hha:end',{reason:reason||'done'});
  }

  function stop(){ endGame('done'); }

  // ---- external events (visibility) ----
  try{
    document.addEventListener('visibilitychange', function(){
      if (document.hidden) pause(); else resume();
    });
  }catch(_){}

  return Promise.resolve({
    start, pause, resume, stop
  });
}

export default { boot };
