// === /HeroHealth/vr/mode-factory.js (pass click coords + prevent double hits) ===
export async function boot(config){
  config=config||{};
  var host=config.host||document.getElementById('spawnHost')||document.body;
  var diff=String(config.difficulty||'normal');
  var dur =Number(config.duration||60);
  var pools=config.pools||{good:['✅'],bad:['❌']};
  var goodRate=(typeof config.goodRate==='number')?config.goodRate:0.7;
  var powerPool=Array.isArray(config.powerups)?config.powerups:['⭐','💎','🛡️','🔥'];
  var powerRate=(typeof config.powerRate==='number')?config.powerRate:0.08;
  var powerEvery=(typeof config.powerEvery==='number')?config.powerEvery:7;
  var judge=typeof config.judge==='function'?config.judge:function(){return {good:true,scoreDelta:1};};
  var onExpire=typeof config.onExpire==='function'?config.onExpire:null;
  var onFinish=typeof config.onFinish==='function'?config.onFinish:null;
  var running=true;

  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
  function fire(name,detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(_){ } }
  function vw(){ return Math.max(320, window.innerWidth||320); }
  function vh(){ return Math.max(320, window.innerHeight||320); }

  if(!document.getElementById('hha-style')){
    var st=document.createElement('style'); st.id='hha-style';
    st.textContent = '.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto;background:transparent;}'+
      '.hha-tgt{position:absolute;pointer-events:auto;display:block;transform:translate(-50%,-50%);font-size:64px;line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));transition:transform .12s ease,opacity .24s ease;opacity:1;}'+
      '.hha-tgt.hit{transform:translate(-50%,-50%) scale(.85);opacity:.15;}'+
      '.hha-badge{position:fixed;left:50%;top:50px;transform:translateX(-50%);background:#0f172acc;color:#fff;padding:6px 10px;border:1px solid #475569;border-radius:10px;font:700 12px system-ui;}';
    document.head.appendChild(st);
  }
  var olds=document.querySelectorAll('.hha-layer'); for(var oi=0;oi<olds.length;oi++){ try{olds[oi].parentNode.removeChild(olds[oi]);}catch(_e){} }
  var layer=document.createElement('div'); layer.className='hha-layer'; document.body.appendChild(layer);

  var score=0, combo=0, misses=0, left=Math.max(1,Math.round(dur));
  var spawnTimer=null, timeTimer=null, watchdog=null;
  var spawnCount=0, sinceLastPower=0;

  var spawnMin=900, spawnMax=1200, life=1600;
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1800; }
  if(diff==='hard'){ spawnMin=700;  spawnMax=950;  life=1400; }

  function tickTime(){ if(!running) return; left=Math.max(0,left-1); fire('hha:time',{sec:left}); if(left<=0) end(); }
  function planNextSpawn(){ if(!running) return; var wait=Math.floor(spawnMin+Math.random()*(spawnMax-spawnMin)); spawnTimer=setTimeout(spawnOne, wait); }

  function shouldSpawnPower(){ if(sinceLastPower>=powerEvery) return true; return Math.random()<powerRate; }

  function spawnOne(forceCenter){
    if(!running) return; spawnCount++; sinceLastPower++;

    var usePower = powerPool.length>0 && shouldSpawnPower();
    var isGood, ch;
    if(usePower){ ch=pick(powerPool); isGood=true; sinceLastPower=0; }
    else { isGood=Math.random()<goodRate; ch=pick(isGood?(pools.good||['✅']):(pools.bad||['❌'])); }

    var el=document.createElement('div'); el.className='hha-tgt'; el.textContent=ch;
    var x = forceCenter ? vw()/2 : Math.floor(vw()*0.12 + Math.random()*vw()*0.76);
    var y = forceCenter ? vh()/2 : Math.floor(vh()*0.18 + Math.random()*vh()*0.62);
    el.style.left=x+'px'; el.style.top=y+'px'; el.style.fontSize=(diff==='easy'?74:(diff==='hard'?56:64))+'px';

    var clicked=false;
    function onHit(ev){
      if(clicked) return; clicked=true; el.style.pointerEvents='none';
      try{ ev.preventDefault(); }catch(_){}
      var cx=vw()/2, cy=vh()/2;
      if (ev.touches && ev.touches[0]) { cx=ev.touches[0].clientX; cy=ev.touches[0].clientY; }
      else if (ev.clientX!=null) { cx=ev.clientX; cy=ev.clientY; }
      // pass coords to judge
      var res = judge(ch, {score:score, combo:combo, misses:misses, diff:diff, isGood:isGood, clientX:cx, clientY:cy});
      var good=!!(res&&res.good); var delta=(res && typeof res.scoreDelta==='number') ? res.scoreDelta : (good?1:-1);
      combo = good ? Math.min(9999, combo+1) : 0;
      score = clamp(score + delta, 0, 999999);
      if(!good){ misses+=1; fire('hha:miss',{count:misses}); }
      try{ el.className='hha-tgt hit'; layer.removeChild(el);}catch(_){}
      fire('hha:score',{score:score, combo:combo, delta:delta, good:good});
      fire('hha:hit-screen',{x:cx, y:cy, good:good, delta:delta, char:ch, isGood:isGood});
      planNextSpawn();
    }
    el.addEventListener('click', onHit, {passive:false});
    el.addEventListener('touchstart', onHit, {passive:false});

    setTimeout(function(){
      if(clicked||!running) return;
      try{ layer.removeChild(el);}catch(_){}
      if(isGood){ combo=0; misses+=1; fire('hha:miss',{count:misses}); fire('hha:score',{score:score,combo:combo}); }
      else { fire('hha:avoid',{ch:ch}); fire('hha:expired',{isGood:false,ch:ch}); if(onExpire) try{ onExpire({isGood:false,ch:ch}); }catch(_){ } }
      planNextSpawn();
    }, life);

    layer.appendChild(el);
  }

  function start(){ if(timeTimer) clearInterval(timeTimer); timeTimer=setInterval(tickTime,1000); spawnOne(true); planNextSpawn();
    if(watchdog) clearInterval(watchdog);
    watchdog=setInterval(function(){ if(!running) return; if(layer.querySelectorAll('.hha-tgt').length===0) spawnOne(true); },2000);
  }
  function end(){
    if(!running) return; running=false;
    try{ clearInterval(timeTimer);}catch(_){}
    try{ clearTimeout(spawnTimer);}catch(_){}
    try{ clearInterval(watchdog);}catch(_){}
    try{ layer.querySelectorAll('.hha-tgt').forEach(n=>n.remove()); }catch(_){}
    var base={score:score, combo:combo, misses:misses, duration:dur};
    if(onFinish){ try{ var extra=onFinish(base)||{}; Object.assign(base,extra); }catch(_){ } }
    fire('hha:end', base);
    try{ document.body.removeChild(layer);}catch(_){}
  }

  start();
  return { stop:end, pause:function(){ if(!running) return; running=false; try{clearInterval(timeTimer);}catch(_){ } try{clearTimeout(spawnTimer);}catch(_){ } },
           resume:function(){ if(running) return; running=true; start(); } };
}
export default { boot };
