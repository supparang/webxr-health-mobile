// === /HeroHealth/vr/mode-factory.js (2025-11-12 hardened+HUD-safe) ===
// DOM spawn factory (click targets) + safe zone under HUD + visualViewport fix
// Emits: hha:layer-ready, hha:time, hha:score, hha:hit-screen, hha:expired, hha:pause/resume, hha:end

export function boot(opts){
  opts = opts || {};
  var duration   = Number(opts.duration!=null?opts.duration:60)|0;
  var pools      = opts.pools || {good:['✅'], bad:['❌']};
  var goodRate   = Number(opts.goodRate!=null?opts.goodRate:0.6);
  var judge      = typeof opts.judge==='function' ? opts.judge : function(){return {good:true,scoreDelta:1};};
  var onExpire   = typeof opts.onExpire==='function' ? opts.onExpire : null;
  var diff       = String(opts.difficulty||'normal');
  var powerups   = opts.powerups || [];
  var powerRate  = Number(opts.powerRate!=null?opts.powerRate:0.08);
  var powerEvery = Number(opts.powerEvery!=null?opts.powerEvery:7);

  function vw(){ return Math.max(0, window.innerWidth  || document.documentElement.clientWidth  || 0); }
  function vh(){ return Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0); }
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch(_){ } }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  // style
  (function inject(){
    if (document.getElementById('hha-factory-style')) return;
    const st=document.createElement('style'); st.id='hha-factory-style';
    st.textContent =
      '.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto;background:transparent}' +
      '.hha-layer.off{pointer-events:none!important}' +
      '.hha-tgt{position:absolute;transform:translate(-50%,-50%);display:block;opacity:1;' +
      ' user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;' +
      ' padding:14px 16px;border-radius:18px;font-size:64px;line-height:1;cursor:pointer;' +
      ' filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));transition:transform .12s ease,opacity .24s ease}' +
      '.hha-tgt.hit{transform:translate(-50%,-50%) scale(.85);opacity:.15}';
    document.head.appendChild(st);
  })();

  // layer
  const mount = document.querySelector('#spawnHost') || document.querySelector('.game-wrap') || document.body;
  let layer = document.querySelector('.hha-layer');
  if (!layer){
    layer = document.createElement('div');
    layer.className = 'hha-layer';
    mount.appendChild(layer);
  }
  fire('hha:layer-ready', {el:layer});

  // state
  let running=false, killed=false;
  let secLeft=duration|0, timerId=null;
  let spawnTimer=null, lifeMs=2000;
  let sinceLastPower=0, spawnCount=0;

  function computeSafeTop(){
    let safe = 120;
    try{
      const box = document.querySelector('#hudTop .score-box') || document.querySelector('[data-hud="scorebox"]');
      if (box){
        const r = box.getBoundingClientRect();
        safe = Math.max(60, Math.round(r.bottom + 24)); // +buffer for fever/shield line
      }
    }catch(_){}
    return safe;
  }
  function safePos(forceCenter){
    const safeTop = computeSafeTop();
    const safeBot = vh() - 60;
    const x = forceCenter ? vw()/2 : Math.floor(vw()*0.12 + Math.random()*vw()*0.76);
    const y = forceCenter ? Math.max(safeTop, Math.min(vh()/2, safeBot))
                          : Math.floor(Math.max(safeTop, Math.random()*(safeBot-safeTop)));
    return {x,y};
  }
  function getXY(ev){
    let cx = ev && ev.clientX != null ? ev.clientX : 0;
    let cy = ev && ev.clientY != null ? ev.clientY : 0;
    try{
      if (ev && ev.touches && ev.touches[0]){ cx=ev.touches[0].clientX; cy=ev.touches[0].clientY; }
      if (window.visualViewport && window.visualViewport.offsetTop){ cy -= window.visualViewport.offsetTop; }
    }catch(_){}
    return {cx, cy};
  }
  function shouldSpawnPower(){ if (sinceLastPower < powerEvery) return false; return Math.random() < powerRate; }

  function tick(){
    if (!running) return;
    secLeft = Math.max(0, secLeft-1);
    fire('hha:time',{sec:secLeft});
    if (secLeft<=0){ end('timeout'); }
  }

  function spawnOne(forceCenter){
    if(!running) return;
    spawnCount++; sinceLastPower++;

    let ch, isGood;
    if (powerups.length && shouldSpawnPower()){ ch = pick(powerups); isGood = true; sinceLastPower=0; }
    else { isGood = Math.random() < goodRate; ch = pick(isGood? (pools.good||['✅']) : (pools.bad||['❌'])); }

    const el = document.createElement('div');
    el.className = 'hha-tgt';
    el.textContent = ch;

    const p = safePos(!!forceCenter);
    el.style.left = p.x+'px';
    el.style.top  = p.y+'px';
    el.style.fontSize = (diff==='easy'?74:(diff==='hard'?56:64))+'px';

    let clicked=false;
    function onHit(ev){
      if(clicked || !running || killed) return;
      clicked=true;
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}

      const pt = getXY(ev);
      const res = judge(ch, { clientX:pt.cx, clientY:pt.cy, isGood });

      const good  = !!(res && res.good);
      const delta = (res && typeof res.scoreDelta==='number') ? res.scoreDelta : (good?1:-1);

      try{ el.classList.add('hit'); layer.removeChild(el); }catch(_){}
      fire('hha:hit-screen', {x:pt.cx, y:pt.cy, good, delta, char:ch, isGood});
      fire('hha:score', {delta, good});
      planNext();
    }
    el.addEventListener('pointerdown', onHit, {passive:false});
    el.addEventListener('touchstart',  onHit, {passive:false});
    el.addEventListener('mousedown',   onHit, {passive:false});
    el.addEventListener('click',       onHit, {passive:false});

    const killId = setTimeout(()=>{
      if(clicked || !running || killed) return;
      try{ layer.removeChild(el); }catch(_){}
      fire('hha:expired', {isGood, char:ch});
      if (onExpire) try{ onExpire({isGood, ch}); }catch(_){}
      planNext();
    }, lifeMs);
    el._killId = killId;

    layer.appendChild(el);
  }

  function planNext(){
    if(!running || killed) return;
    let gap = (diff==='easy'?480:(diff==='hard'?280:360));
    gap = Math.max(120, gap - Math.min(spawnCount*4, 120));
    clearTimeout(spawnTimer);
    spawnTimer = setTimeout(()=>spawnOne(false), gap);
  }

  function start(){
    if (running) return;
    running=true; killed=false;
    layer.classList.remove('off');
    clearInterval(timerId); secLeft=duration|0; fire('hha:time',{sec:secLeft});
    timerId=setInterval(tick,1000);
    requestAnimationFrame(()=>{ spawnOne(true); planNext(); });
  }
  function pause(){ if(!running) return; clearInterval(timerId); clearTimeout(spawnTimer); fire('hha:pause',{}); }
  function resume(){ if(!running) return; clearInterval(timerId); timerId=setInterval(tick,1000); fire('hha:resume',{}); }

  function hardClear(){
    try{
      layer.classList.add('off');
      const nodes = layer.querySelectorAll('.hha-tgt');
      nodes.forEach(n=>{ try{ if(n._killId) clearTimeout(n._killId); }catch{} });
      while(layer.firstChild) layer.removeChild(layer.firstChild);
    }catch(_){}
  }
  function end(reason){
    if (killed) return; killed=true;
    running=false;
    try{ clearInterval(timerId); }catch(_){}
    try{ clearTimeout(spawnTimer); }catch(_){}
    hardClear();
    fire('hha:end',{reason:reason||'done'});
  }
  function stop(){ end('done'); }

  try{ document.addEventListener('visibilitychange', ()=>{ if(document.hidden) pause(); else resume(); }); }catch(_){}

  return Promise.resolve({ start, pause, resume, stop });
}

export default { boot };
