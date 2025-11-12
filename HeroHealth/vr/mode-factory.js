// === /HeroHealth/vr/mode-factory.js (2025-11-12 LATEST+MOUNT-FIX) ===
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

  function vw(){ return Math.max(0, window.innerWidth  || document.documentElement.clientWidth  || 0); }
  function vh(){ return Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0); }
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch(_){ } }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  // ---------- styles ----------
  (function inject(){
    if (document.getElementById('hha-factory-style')) return;
    var st=document.createElement('style'); st.id='hha-factory-style';
    st.textContent =
      '.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto;background:transparent;}' +
      '.hha-tgt{position:absolute;transform:translate(-50%,-50%);display:block;opacity:1;' +
      ' user-select:none;-webkit-user-select:none;touch-action:none;' +
      ' -webkit-tap-highlight-color:transparent;background:transparent;' +
      ' padding:14px 16px;border-radius:18px; font-size:64px;line-height:1;' +
      ' filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));' +
      ' transition:transform .12s ease,opacity .24s ease;cursor:pointer}' +
      '.hha-tgt.hit{transform:translate(-50%,-50%) scale(.85);opacity:.15}' +
      '.hha-layer.off{pointer-events:none!important;}' +
      '.hha-debug{position:fixed;left:50%;top:10px;transform:translateX(-50%);' +
      ' background:#0b1220cc;color:#e2e8f0;padding:6px 10px;border:1px solid #334155;border-radius:8px;font:700 12px system-ui;z-index:9999;}';
    document.head.appendChild(st);
  })();

  // ---------- mount (สำคัญ) ----------
  // อย่าผูกกับ #spawnHost (มักถูกตั้ง pointer-events:none)
  var mount = document.querySelector('.game-wrap') || document.body;
  // กัน parent มี pointer-events:none
  try{ mount.style.pointerEvents = 'auto'; }catch(_){}
  // สร้างเลเยอร์ด้านบน A-Frame canvas เสมอ
  var layer = document.querySelector('.hha-layer');
  if (!layer){
    layer = document.createElement('div');
    layer.className = 'hha-layer';
    mount.appendChild(layer);
  }
  // ยก z-index ขึ้นอีกชั้นเผื่อธีมอื่น
  try{ layer.style.zIndex = '900'; }catch(_){}
  fire('hha:layer-ready', { el: layer });

  // debug badge (เปิดด้วย ?debug=1)
  var DEBUG = /(?:^|[?&])debug=1(?:&|$)/.test(location.search);
  var dbg = null;
  function setDbg(txt){
    if(!DEBUG) return;
    if(!dbg){ dbg = document.createElement('div'); dbg.className='hha-debug'; document.body.appendChild(dbg); }
    dbg.textContent = txt;
  }

  // ---------- state ----------
  var running=false, killed=false;
  var timerId=null, secLeft=duration|0;
  var spawnTimer=null, lifeMs=2000;
  var sinceLastPower=0, spawnCount=0;

  // ---------- time ----------
  function tick(){
    if (!running) return;
    secLeft = Math.max(0, secLeft-1);
    fire('hha:time', {sec:secLeft});
    if (secLeft<=0){ endGame('timeout'); return; }
  }

  function shouldSpawnPower(){
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
    return {cx, cy};
  }

  function computeSafeTop(){
    var safe = 120;
    try{
      var box = document.querySelector('#hudTop .score-box') || document.querySelector('[data-hud="scorebox"]');
      if (box){
        var r = box.getBoundingClientRect();
        safe = Math.max(60, Math.round(r.bottom + 24));
      }
    }catch(_){}
    return safe;
  }

  function safePos(forceCenter){
    var W = vw(), H = vh();
    var safeTop = computeSafeTop();
    var safeBot = H - 60;
    var x = forceCenter ? W/2 : Math.floor(W*0.12 + Math.random()*W*0.76);
    var y = forceCenter ? Math.max(safeTop, Math.min(H/2, safeBot))
                        : Math.floor(Math.max(safeTop, Math.random()*(safeBot - safeTop)));
    return {x,y};
  }

  function spawnOne(forceCenter){
    if(!running) return;
    spawnCount++; sinceLastPower++;
    setDbg('spawn #' + spawnCount);

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
      if(clicked || !running || killed) return;
      clicked=true;
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

    el.addEventListener('pointerdown', onHit, {passive:false});
    el.addEventListener('touchstart',  onHit, {passive:false});
    el.addEventListener('mousedown',   onHit, {passive:false});
    el.addEventListener('click',       onHit, {passive:false});

    var killId = setTimeout(function(){
      if(clicked || !running || killed) return;
      try{ layer.removeChild(el); }catch(_){}
      if (isGood){
        fire('hha:expired', {isGood:true, char:ch});
        if (onExpire) try{ onExpire({isGood:true, ch:ch}); }catch(_){}
      } else {
        fire('hha:expired', {isGood:false, char:ch});
        if (onExpire) try{ onExpire({isGood:false, ch:ch}); }catch(_){}
      }
      planNextSpawn();
    }, lifeMs);
    el._killId = killId;

    layer.appendChild(el);
  }

  function planNextSpawn(){
    if(!running || killed) return;
    var gap = (diff==='easy'?480:(diff==='hard'?280:360));
    gap = Math.max(120, gap - Math.min(spawnCount*4, 120));
    clearTimeout(spawnTimer);
    spawnTimer = setTimeout(function(){ spawnOne(false); }, gap);
  }

  function start(){
    if (running) return;
    running = true; killed = false;
    layer.classList.remove('off');
    // time
    clearInterval(timerId); secLeft = duration|0;
    fire('hha:time',{sec:secLeft});
    timerId = setInterval(tick, 1000);
    // first target — ให้แน่ใจว่า HUD วางแล้ว
    requestAnimationFrame(()=>{ spawnOne(true); planNextSpawn(); });
    setTimeout(()=>{ if(spawnCount===0) { spawnOne(true); planNextSpawn(); } }, 0);
  }

  function pause(){ if(!running) return; clearInterval(timerId); clearTimeout(spawnTimer); fire('hha:pause',{}); }
  function resume(){ if(!running) return; clearInterval(timerId); timerId=setInterval(tick,1000); fire('hha:resume',{}); }

  function hardClearLayer(){
    try{
      layer.classList.add('off');
      var nodes = layer.querySelectorAll('.hha-tgt');
      for (var i=0;i<nodes.length;i++){ try{ if(nodes[i]._killId) clearTimeout(nodes[i]._killId); }catch(_){}} 
      while(layer.firstChild) layer.removeChild(layer.firstChild);
    }catch(_){}
  }

  function endGame(reason){
    if (killed) return; killed=true; running=false;
    try{ clearInterval(timerId); }catch(_){}
    try{ clearTimeout(spawnTimer); }catch(_){}
    hardClearLayer();
    fire('hha:end',{reason:reason||'done'});
  }

  function stop(){ endGame('done'); }

  try{
    document.addEventListener('visibilitychange', function(){
      if (document.hidden) pause(); else resume();
    });
  }catch(_){}

  return Promise.resolve({ start, pause, resume, stop });
}
export default { boot };
