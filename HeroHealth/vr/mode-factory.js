// === HeroHealth/vr/mode-factory.js — production, must-spawn + watchdog, no optional chaining ===
export async function boot(config){
  config = config || {};
  var host   = config.host || document.getElementById('spawnHost') || document.body;
  var diff   = String(config.difficulty || 'normal');
  // auto duration by difficulty (fallback 60)
  var dur    = (typeof config.duration === 'number')
      ? Number(config.duration)
      : (diff === 'easy' ? 90 : (diff === 'hard' ? 45 : 60));

  var pools  = config.pools || { good: ['🍎','🍐','🍇','🥕','🥦'], bad: ['🍔','🍟','🍕','🍩','🧋'] };
  var goodRate = (typeof config.goodRate==='number') ? config.goodRate : 0.7;
  var judge  = (typeof config.judge === 'function') ? config.judge : function(){ return {good:true, scoreDelta:1}; };

  var running = true;

  // --- helpers ---
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){} }
  function getFlag(name){
    var q = (typeof window!=='undefined' && window.location && window.location.search) ? window.location.search : '';
    return new RegExp('[?&]'+name+'(?:=1|&|$)').test(q);
  }
  var DEBUG = getFlag('debug');

  // --- inject style (once) ---
  if(!document.getElementById('hha-style')){
    var st = document.createElement('style');
    st.id = 'hha-style';
    st.textContent =
      '.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto;background:transparent;}'+
      '.hha-tgt{position:absolute;pointer-events:auto;display:block;transform:translate(-50%,-50%);'+
      'font-size:64px;line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));'+
      'transition:transform .12s ease, opacity .24s ease;opacity:1;}'+
      '.hha-tgt.hit{transform:translate(-50%,-50%) scale(.85);opacity:.15;}'+
      '.hha-badge{position:fixed;left:50%;top:50px;transform:translateX(-50%);background:#0f172acc;'+
      'color:#fff;padding:6px 10px;border:1px solid #475569;border-radius:10px;font:700 12px system-ui;}';
    document.head.appendChild(st);
  }

  // --- layer host (attached to body to avoid A-Frame pointer issue) ---
  // ล้างเลเยอร์ค้าง (ถ้ามีจากรอบก่อน)
  var old = document.querySelectorAll('.hha-layer');
  for(var oi=0; oi<old.length; oi++){ try{ old[oi].parentNode.removeChild(old[oi]); }catch(_e){} }

  var layer = document.createElement('div');
  layer.className = 'hha-layer';
  layer.setAttribute('data-hha-ui','1'); // ให้ index ล้างได้
  document.body.appendChild(layer);

  var dbg;
  if(DEBUG){
    dbg = document.createElement('div');
    dbg.className = 'hha-badge';
    dbg.textContent = 'DEBUG: waiting…';
    document.body.appendChild(dbg);
  }

  // --- state ---
  var score=0, combo=0, misses=0;
  var left = Math.max(1, Math.round(dur));
  var spawnTimer = null, timeTimer = null, watchdog = null;

  // --- difficulty tuning ---
  var spawnMin=900, spawnMax=1200, life=1600;
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1800; }
  if(diff==='hard'){ spawnMin=700;  spawnMax=950;  life=1400; }

  function vw(){ return Math.max(320, window.innerWidth||320); }
  function vh(){ return Math.max(320, window.innerHeight||320); }

  function updateDBG(txt){ if(!DEBUG) return; try{ dbg.textContent = 'DEBUG: '+txt; }catch(_e){} }

  function tickTime(){
    if(!running) return;
    left = Math.max(0, left-1);
    fire('hha:time', {sec:left});
    if(left<=0){ end(); }
  }

  function planNextSpawn(){
    if(!running) return;
    var wait = Math.floor(spawnMin + Math.random()*(spawnMax-spawnMin));
    spawnTimer = setTimeout(spawnOne, wait);
  }

  function ensureOnScreen(el){
    try{
      var r = el.getBoundingClientRect();
      var okW = r.width>0 && r.height>0;
      var inside = okW && r.left>=-2 && r.top>=-2 && r.right<=vw()+2 && r.bottom<=vh()+2;
      if(!inside){
        el.style.left = (vw()/2)+'px';
        el.style.top  = (vh()/2)+'px';
      }
    }catch(_e){}
  }

  function spawnOne(forceCenter){
    if(!running) return;

    var gPool = (pools && pools.good && pools.good.length) ? pools.good : ['✅'];
    var bPool = (pools && pools.bad  && pools.bad.length ) ? pools.bad  : ['❌'];
    var isGood = Math.random() < goodRate;
    var ch = pick(isGood ? gPool : bPool);

    var el = document.createElement('div');
    el.className = 'hha-tgt';
    el.textContent = ch;

    // position
    var x = forceCenter ? vw()/2 : Math.floor(vw()*0.12 + Math.random()*vw()*0.76);
    var y = forceCenter ? vh()/2 : Math.floor(vh()*0.18 + Math.random()*vh()*0.62);
    el.style.left = x+'px';
    el.style.top  = y+'px';

    // font-size by difficulty
    var fs = 64; if(diff==='easy') fs=74; if(diff==='hard') fs=56;
    el.style.fontSize = fs+'px';

    var clicked = false;

    function onHit(ev){
      if(clicked) return;
      clicked = true;
      try{ ev.preventDefault(); }catch(_e){}
      var res = judge(ch, {score:score, combo:combo, misses:misses, diff:diff});
      var good = !!(res && res.good);
      var delta = (res && typeof res.scoreDelta==='number') ? res.scoreDelta : (good?1:-1);

      combo = good ? clamp(combo+1, 0, 9999) : 0;
      score = clamp(score + delta, -99999, 999999);

      try{ layer.removeChild(el); }catch(_e){}
      fire('hha:score', {score:score, combo:combo, delta:delta, good:good});
      updateDBG('hit '+ch+' (good='+good+') score='+score);
      planNextSpawn();
    }

    el.addEventListener('click', onHit, {passive:false});
    el.addEventListener('touchstart', onHit, {passive:false});

    var ttl = setTimeout(function(){
      if(clicked || !running) return;
      try{ layer.removeChild(el); }catch(_e){}
      combo = 0; misses += 1;
      // แจ้ง miss ให้ HUD
      fire('hha:miss', {count:misses});
      planNextSpawn();
    }, life);

    layer.appendChild(el);
    ensureOnScreen(el);
  }

  // --- watchdog: ถ้า 2 วินาทีไม่มีลูกเป้า จะสปอว์นกลางจออีกรอบ ---
  function startWatchdog(){
    if(watchdog) clearInterval(watchdog);
    watchdog = setInterval(function(){
      if(!running) return;
      var leftOvers = layer.querySelectorAll('.hha-tgt');
      if(leftOvers.length===0){
        updateDBG('watchdog spawn');
        spawnOne(true);
      }
    }, 2000);
  }

  function start(){
    if(timeTimer) clearInterval(timeTimer);
    timeTimer = setInterval(tickTime, 1000);
    // สปอว์นก้อนแรก “ทันที” กลางจอ เพื่อยืนยันว่าเห็นแน่
    spawnOne(true);
    planNextSpawn();
    startWatchdog();
  }

  function end(){
    if(!running) return;
    running = false;
    try{ clearInterval(timeTimer); }catch(_e){}
    try{ clearTimeout(spawnTimer); }catch(_e){}
    try{ clearInterval(watchdog); }catch(_e){}
    try{
      var nodes = layer.querySelectorAll('.hha-tgt');
      for(var i=0;i<nodes.length;i++){ try{ layer.removeChild(nodes[i]); }catch(_e){} }
    }catch(_e){}
    fire('hha:end', {score:score, combo:combo, misses:misses, duration:dur});
    try{ document.body.removeChild(layer); }catch(_e){}
    if(DEBUG){ try{ document.body.removeChild(dbg); }catch(_e){} }
    // cleanup listeners
    try{ document.removeEventListener('visibilitychange', onVis); }catch(_e){}
    try{ window.removeEventListener('hha:dispose-ui', onDispose); }catch(_e){}
  }

  // ===== lifecycle bindings =====
  function onDispose(){ end(); }
  window.addEventListener('hha:dispose-ui', onDispose);

  // auto pause/resume with page visibility
  function onVis(){
    if(document.hidden){ if(running){ /* pause */ running=false; clearInterval(timeTimer); clearTimeout(spawnTimer); } }
    else { if(!running){ /* resume */ running=true; start(); } }
  }
  document.addEventListener('visibilitychange', onVis);

  // kick!
  fire('hha:time', {sec:left});  // HUD initial
  start();

  return {
    stop: end,
    pause: function(){
      if(!running) return;
      running = false;
      try{ clearInterval(timeTimer); }catch(_e){}
      try{ clearTimeout(spawnTimer); }catch(_e){}
    },
    resume: function(){
      if(running) return;
      running = true;
      start();
    }
  };
}
export default { boot };