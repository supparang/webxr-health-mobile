// === HeroHealth/vr/mode-factory.js — DOM fallback, high z-index, must-show ===
export async function boot(config){
  config = config || {};
  var diff = String(config.difficulty || 'normal');
  var dur  = (typeof config.duration==='number')
      ? Number(config.duration)
      : (diff==='easy'?90:(diff==='hard'?45:60));

  var pools = config.pools || { good:['🍎','🍐','🍇','🥕','🥦'], bad:['🍔','🍟','🍕','🍩','🧋'] };
  var goodRate = (typeof config.goodRate==='number') ? config.goodRate : 0.7;
  var judge = (typeof config.judge==='function') ? config.judge : function(){ return {good:true, scoreDelta:1}; };

  // ---------- helpers ----------
  function pick(a){ return a[(Math.random()*a.length)|0]; }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function fire(name,detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(_){} }
  function vw(){ return Math.max(320, window.innerWidth||320); }
  function vh(){ return Math.max(320, window.innerHeight||320); }

  // ---------- style (once) ----------
  if(!document.getElementById('hha-style-dom')){
    var st=document.createElement('style');
    st.id='hha-style-dom';
    st.textContent =
`.hha-layer{position:fixed;inset:0;z-index:5000;pointer-events:auto;background:transparent;}
.hha-tgt{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  pointer-events:auto;display:block;font:900 72px/1 system-ui,Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji,sans-serif;
  color:#ffffff; text-shadow:0 2px 8px rgba(0,0,0,.55); filter:drop-shadow(0 10px 16px rgba(0,0,0,.45));
  transition:transform .12s ease, opacity .24s ease; opacity:1;}
.hha-tgt.hit{transform:translate(-50%,-50%) scale(.85);opacity:.12;}
.hha-debug{position:fixed;left:50%;top:54px;transform:translateX(-50%);z-index:5001;
  background:#0f172acc;color:#fff;padding:6px 10px;border:1px solid #475569;border-radius:10px;font:700 12px system-ui;}`;
    document.head.appendChild(st);
  }

  // ---------- layer ----------
  // ล้างรอบเก่า (ถ้ามี)
  Array.prototype.forEach.call(document.querySelectorAll('.hha-layer'), function(n){ try{ n.remove(); }catch(_){} });
  var layer=document.createElement('div');
  layer.className='hha-layer';
  layer.setAttribute('data-hha-ui','1'); // ให้ index ล้างได้
  document.body.appendChild(layer);

  // ---------- state ----------
  var running=true, score=0, combo=0, misses=0;
  var left=Math.max(1,Math.round(dur));
  var spawnTimer=null, timeTimer=null, watchdog=null;

  // speed/ttl by difficulty
  var spawnMin=900, spawnMax=1200, life=1600, baseFont=68;
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1850; baseFont=78; }
  if(diff==='hard'){ spawnMin=700;  spawnMax=950;  life=1400; baseFont=60; }

  function ensureOnScreen(el){
    try{
      var r=el.getBoundingClientRect();
      var inside = (r.width>0 && r.height>0 && r.left>-4 && r.top>-4 && r.right<vw()+4 && r.bottom<vh()+4);
      if(!inside){ el.style.left=(vw()/2)+'px'; el.style.top=(vh()/2)+'px'; }
    }catch(_){}
  }

  function planNextSpawn(){ if(!running) return;
    var wait = Math.floor(spawnMin + Math.random()*(spawnMax-spawnMin));
    spawnTimer = setTimeout(spawnOne, wait);
  }

  function spawnOne(forceCenter){
    if(!running) return;
    var isGood = Math.random() < goodRate;
    var ch = pick(isGood ? (pools.good||['✅']) : (pools.bad||['❌']));
    var el=document.createElement('div');
    el.className='hha-tgt';
    el.textContent=ch;
    // pos
    var x = forceCenter ? vw()/2 : Math.floor(vw()*0.12 + Math.random()*vw()*0.76);
    var y = forceCenter ? vh()/2 : Math.floor(vh()*0.18 + Math.random()*vh()*0.62);
    el.style.left=x+'px'; el.style.top=y+'px';
    el.style.fontSize = baseFont+'px';

    var clicked=false;
    function onHit(ev){
      if(clicked) return; clicked=true;
      try{ ev.preventDefault(); }catch(_){}
      var res = judge(ch,{score:score,combo:combo,misses:misses,diff:diff});
      var good = !!(res && res.good);
      var delta = (res && typeof res.scoreDelta==='number') ? res.scoreDelta : (good?1:-1);
      combo = good ? Math.min(9999, combo+1) : 0;
      score = clamp(score + delta, 0, 999999);
      try{ el.classList.add('hit'); layer.removeChild(el); }catch(_){}
      fire('hha:score',{score:score,combo:combo,delta:delta,good:good});
      planNextSpawn();
    }
    el.addEventListener('click', onHit, {passive:false});
    el.addEventListener('touchstart', onHit, {passive:false});

    // auto-expire = miss
    setTimeout(function(){
      if(clicked || !running) return;
      try{ layer.removeChild(el); }catch(_){}
      combo=0; misses++; fire('hha:miss',{count:misses}); planNextSpawn();
    }, life);

    layer.appendChild(el);
    ensureOnScreen(el);
  }

  // watchdog: ว่างเกิน 2s → spawn กลางจอ
  function startWatchdog(){
    if(watchdog) clearInterval(watchdog);
    watchdog=setInterval(function(){
      if(!running) return;
      if(layer.querySelectorAll('.hha-tgt').length===0){ spawnOne(true); }
    }, 2000);
  }

  function tickTime(){
    if(!running) return;
    left=Math.max(0,left-1); fire('hha:time',{sec:left}); if(left<=0) end();
  }

  function start(){
    if(timeTimer) clearInterval(timeTimer);
    timeTimer=setInterval(tickTime,1000);
    // ให้เห็นชัวร์: ยิง 2 ชิ้นแรกกลางจอ + ใกล้กลาง
    spawnOne(true);
    setTimeout(function(){ spawnOne(true); }, 350);
    planNextSpawn();
    startWatchdog();
  }

  function end(){
    if(!running) return; running=false;
    try{ clearInterval(timeTimer); }catch(_){}
    try{ clearTimeout(spawnTimer); }catch(_){}
    try{ clearInterval(watchdog); }catch(_){}
    try{ layer.querySelectorAll('.hha-tgt').forEach(function(n){ n.remove(); }); }catch(_){}
    try{ layer.remove(); }catch(_){}
    fire('hha:end',{score:score,combo:combo,misses:misses,duration:dur});
    try{ window.removeEventListener('hha:dispose-ui', onDispose); }catch(_){}
    try{ document.removeEventListener('visibilitychange', onVis); }catch(_){}
  }

  function onDispose(){ end(); }
  window.addEventListener('hha:dispose-ui', onDispose);

  function onVis(){ if(document.hidden){ if(running){ running=false; clearInterval(timeTimer); clearTimeout(spawnTimer); } }
                   else { if(!running){ running=true; start(); } } }
  document.addEventListener('visibilitychange', onVis);

  // HUD init + go
  fire('hha:time',{sec:left});
  fire('hha:score',{score:0,combo:0});
  start();

  return { stop:end, pause:function(){ if(!running) return; running=false; clearInterval(timeTimer); clearTimeout(spawnTimer); },
           resume:function(){ if(running) return; running=true; start(); } };
}
export default { boot };