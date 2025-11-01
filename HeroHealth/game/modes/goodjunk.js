// === modes/goodjunk.js — DOM-spawn icons + Fever hooks + Shield/Star (stable) ===
export const name = 'goodjunk';

const GOOD   = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK   = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['star','shield']; // star=+points burst, shield=ignore next miss

let host=null, alive=false;
let diff='Normal';
let iconSizeBase=48;

// spawn control (seconds per spawn)
let spawnIntervalS = 0.70;
let lifeS          = 1.60;
let _accum = 0;

let fever=false, allowMiss=0;

export function setFever(on){ fever = !!on; }
export function grantShield(n){ allowMiss += (n|0); }
function consumeShield(){ if(allowMiss>0){ allowMiss--; return true; } return false; }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host=document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;';
    document.body.appendChild(host);
  }
}
function clearHost(){ try{ if(host) host.innerHTML=''; }catch(e){} }

export function start(cfg){
  ensureHost(); clearHost(); alive=true;
  diff = String((cfg && cfg.difficulty) || 'Normal');

  if (diff==='Easy'){ spawnIntervalS=0.82; lifeS=1.90; iconSizeBase=54; }
  else if (diff==='Hard'){ spawnIntervalS=0.56; lifeS=1.40; iconSizeBase=40; }
  else { spawnIntervalS=0.70; lifeS=1.60; iconSizeBase=48; }

  _accum = 0;
}

export function stop(){ alive=false; clearHost(); }

function onMiss(bus){
  if (consumeShield()){ try{ bus && bus.sfx && bus.sfx.power && bus.sfx.power(); }catch(e){} return; }
  try{ if(bus && bus.miss) bus.miss({ kind:'miss' }); }catch(e){}
  try{ if(bus && bus.sfx && bus.sfx.bad) bus.sfx.bad(); }catch(e){}
}

function spawnOne(glyph, isGood, isGolden, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji'; d.type='button'; d.textContent=glyph;

  const size = isGolden ? (iconSizeBase+8) : iconSizeBase;
  Object.assign(d.style,{
    position:'absolute', border:'0', background:'transparent',
    fontSize:size+'px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))', cursor:'pointer'
  });

  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left = x+'px'; d.style.top = y+'px';

  // life timeout — นับ miss เฉพาะกรณี "พลาด GOOD"
  const lifeMs = Math.floor((lifeS + (isGolden?0.25:0))*1000);
  const killto = setTimeout(function(){
    try{ d.remove(); }catch(e){}
    if (isGood) onMiss(bus); // JUNK หมดเวลา -> ไม่นับ miss
  }, lifeMs);

  d.addEventListener('click', function(ev){
    clearTimeout(killto);
    explodeAt(x,y);
    try{ d.remove(); }catch(e){}
    if (isGood){
      const perfect = isGolden || Math.random()<0.22;
      const basePts = perfect ? 200 : 100;
      const mult    = fever ? 1.5 : 1.0;
      const pts     = Math.round(basePts*mult);
      try{
        if(bus && bus.hit) bus.hit({ kind:(isGolden?'perfect':(perfect?'perfect':'good')),
                                     points:pts, ui:{x:ev.clientX, y:ev.clientY} });
        if(bus && bus.sfx){
          if(perfect && bus.sfx.perfect) bus.sfx.perfect(); else if(bus.sfx.good) bus.sfx.good();
        }
      }catch(e){}
    } else {
      // คลิก JUNK = miss (บทลงโทษ)
      onMiss(bus);
    }
  }, { passive:true });

  host.appendChild(d);
}

function spawnPower(kind, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji power'; d.type='button'; d.textContent=(kind==='shield'?'🛡️':'⭐');
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent',
    fontSize:(iconSizeBase)+'px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))', cursor:'pointer' });
  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left=x+'px'; d.style.top=y+'px';
  const killto=setTimeout(function(){ try{d.remove();}catch(e){} }, Math.floor((lifeS+0.25)*1000));
  d.addEventListener('click',function(ev){
    clearTimeout(killto); try{d.remove();}catch(e){}
    if (kind==='shield'){ grantShield(1); try{ if(bus && bus.power) bus.power('shield'); }catch(e){} }
    else {
      try{ if(bus && bus.hit) bus.hit({ kind:'perfect', points:150, ui:{x:ev.clientX,y:ev.clientY} }); }catch(e){}
    }
  }, { passive:true });
  host.appendChild(d);
}

export function update(dt, bus){
  if(!alive) return;
  _accum += dt;
  while (_accum >= spawnIntervalS) {
    _accum -= spawnIntervalS;
    const r = Math.random();
    if (r < 0.10){
      spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus);
    } else {
      const isGolden = Math.random() < 0.12;
      const isGood   = isGolden || (Math.random() < 0.70);
      const glyph    = isGolden ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}

// simple particle burst
function explodeAt(x,y){
  const n=8+((Math.random()*6)|0);
  for(let i=0;i<n;i++){
    const p=document.createElement('div');
    p.textContent='✦';
    Object.assign(p.style,{
      position:'fixed', left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
      font:'900 16px ui-rounded,system-ui', color:'#a7c8ff', textShadow:'0 2px 12px #4ea9ff',
      transition:'transform .7s ease-out, opacity .7s ease-out', opacity:'1', zIndex:1200, pointerEvents:'none'
    });
    document.body.appendChild(p);
    const dx=(Math.random()*120-60), dy=(Math.random()*120-60), s=0.6+Math.random()*0.6;
    requestAnimationFrame(function(){ p.style.transform='translate('+dx+'px,'+dy+'px) scale('+s+')'; p.style.opacity='0'; });
    setTimeout(function(){ try{p.remove();}catch(e){} }, 720);
  }
}

// Back-compat factory
export function create(){
  return {
    start: function(cfg){ start(cfg); },
    update: function(dt,bus){ update(dt,bus); },
    cleanup: function(){ stop(); },
    setFever: function(on){ setFever(on); }
  };
}
