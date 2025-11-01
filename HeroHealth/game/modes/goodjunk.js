// === modes/goodjunk.js — DOM-spawn icons + FEVER hooks + Shield/Star (stable) ===
'use strict';

export const name = 'goodjunk';

var GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
var JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
var POWERS = ['star','shield']; // star=+points burst, shield=ignore next miss

var host=null, alive=false;
var diff='Normal';
var iconSizeBase=48;

// seconds per spawn & life
var spawnIntervalS = 0.70;   // Normal
var lifeS           = 1.60;
var _accum          = 0;

var fever=false, allowMiss=0;

export function start(cfg){
  ensureHost();
  clearHost();
  alive=true;

  diff = String((cfg && cfg.difficulty) || 'Normal');

  if (diff==='Easy'){ spawnIntervalS=0.82; lifeS=1.90; iconSizeBase=54; }
  else if (diff==='Hard'){ spawnIntervalS=0.56; lifeS=1.40; iconSizeBase=40; }
  else { spawnIntervalS=0.70; lifeS=1.60; iconSizeBase=48; }

  _accum = 0;
}

export function stop(){ alive=false; clearHost(); }
export function setFever(on){ fever = !!on; }
export function grantShield(n){ var k=(n|0); if(k>0) allowMiss += k; }

function consumeShield(){ if(allowMiss>0){ allowMiss--; return true; } return false; }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if (!host){
    host = document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;';
    document.body.appendChild(host);
  }
}
function clearHost(){ try{ if(host) host.innerHTML=''; }catch(e){} }

function spawnOne(glyph, isGood, isGolden, bus){
  var d=document.createElement('button');
  d.className='spawn-emoji';
  d.type='button';
  d.textContent=glyph;

  var size = isGolden ? (iconSizeBase+8) : iconSizeBase;
  d.style.position='absolute';
  d.style.border='0';
  d.style.background='transparent';
  d.style.fontSize=size+'px';
  d.style.transform='translate(-50%,-50%)';
  d.style.filter='drop-shadow(0 6px 16px rgba(0,0,0,.55))';
  d.style.cursor='pointer';

  var pad=56, bottomPad=180, W=window.innerWidth, H=window.innerHeight;
  var x = Math.floor(pad + Math.random()*(W - pad*2));
  var y = Math.floor(pad + Math.random()*(H - pad - bottomPad));
  d.style.left = x+'px'; d.style.top = y+'px';

  var lifeMs = Math.floor((lifeS + (isGolden?0.25:0))*1000);
  var killto = setTimeout(function(){ try{ d.remove(); }catch(e){}; onTimeout(bus); }, lifeMs);

  d.addEventListener('click', function(ev){
    clearTimeout(killto);
    explodeAt(x,y);
    try{ d.remove(); }catch(e){}
    if (isGood){
      var perfect = isGolden || Math.random()<0.22;
      var basePts = perfect ? 200 : 100;
      var mult = fever ? 1.5 : 1.0;
      var pts = Math.round(basePts*mult);
      var meta = { gold: !!isGolden, junk:false };
      if(bus && bus.hit) bus.hit({ kind:(perfect?'perfect':'good'), points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:meta });
      if(bus && bus.sfx){ if(perfect && bus.sfx.perfect) bus.sfx.perfect(); else if(bus.sfx.good) bus.sfx.good(); }
    } else {
      if(bus && bus.miss) bus.miss({ kind:'junk' });
      if(bus && bus.sfx && bus.sfx.bad) bus.sfx.bad();
    }
  }, { passive:true });

  host.appendChild(d);
}

function spawnPower(kind, bus){
  var d=document.createElement('button');
  d.className='spawn-emoji power';
  d.type='button';
  d.textContent=(kind==='shield'?'🛡️':'⭐');

  d.style.position='absolute';
  d.style.border='0';
  d.style.background='transparent';
  d.style.fontSize=iconSizeBase+'px';
  d.style.transform='translate(-50%,-50%)';
  d.style.filter='drop-shadow(0 8px 18px rgba(10,120,220,.55))';
  d.style.cursor='pointer';

  var pad=56, bottomPad=180, W=window.innerWidth, H=window.innerHeight;
  var x = Math.floor(pad + Math.random()*(W - pad*2));
  var y = Math.floor(pad + Math.random()*(H - pad - bottomPad));
  d.style.left=x+'px'; d.style.top=y+'px';

  var killto=setTimeout(function(){ try{d.remove();}catch(e){}; }, Math.floor((lifeS+0.25)*1000));
  d.addEventListener('click', function(ev){
    clearTimeout(killto);
    try{ d.remove(); }catch(e){}
    if (kind==='shield'){ grantShield(1); if(bus && bus.power) bus.power('shield'); }
    else {
      // star = burst points (ไม่ใช่ gold quest)
      if(bus && bus.hit) bus.hit({ kind:'perfect', points:150, ui:{x:ev.clientX,y:ev.clientY}, meta:{ gold:false, junk:false } });
    }
  }, { passive:true });

  host.appendChild(d);
}

function onTimeout(bus){
  if (consumeShield()){ if(bus && bus.sfx && bus.sfx.power) bus.sfx.power(); return; }
  // timeout ของดี -> ถือเป็นพลาดธรรมดา (ไม่ใช่ junk)
  if(bus && bus.miss) bus.miss({ kind:'timeout' });
  if(bus && bus.sfx && bus.sfx.bad) bus.sfx.bad();
}

export function update(dt, bus){
  if(!alive) return;

  _accum += dt;
  while (_accum >= spawnIntervalS) {
    _accum -= spawnIntervalS;

    var r = Math.random();
    if (r < 0.10){
      var pk = POWERS[(Math.random()*POWERS.length)|0];
      spawnPower(pk, bus);
    } else {
      var isGolden = Math.random() < 0.12;
      var isGood   = isGolden || (Math.random() < 0.70);
      var glyph    = isGolden ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}

// simple particle burst
function explodeAt(x,y){
  var n=8+((Math.random()*6)|0);
  for(var i=0;i<n;i++){
    var p=document.createElement('div');
    p.textContent='✦';
    p.style.position='fixed';
    p.style.left=x+'px'; p.style.top=y+'px';
    p.style.transform='translate(-50%,-50%)';
    p.style.font='900 16px ui-rounded,system-ui';
    p.style.color='#a7c8ff';
    p.style.textShadow='0 2px 12px #4ea9ff';
    p.style.transition='transform .7s ease-out, opacity .7s ease-out';
    p.style.opacity='1';
    p.style.zIndex='2200';
    p.style.pointerEvents='none';
    document.body.appendChild(p);
    var dx=(Math.random()*120-60), dy=(Math.random()*120-60), s=0.6+Math.random()*0.6;
    (function(el,dx,dy,s){
      requestAnimationFrame(function(){ el.style.transform='translate('+dx+'px,'+dy+'px) scale('+s+')'; el.style.opacity='0'; });
      setTimeout(function(){ try{el.remove();}catch(e){}; }, 720);
    })(p,dx,dy,s);
  }
}

// compatibility wrapper for older main
export function create(){
  return {
    start:function(cfg){ start(cfg); },
    update:function(dt,bus){ update(dt,bus); },
    cleanup:function(){ stop(); }
  };
}
