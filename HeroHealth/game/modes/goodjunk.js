// === modes/goodjunk.js — DOM-spawn icons + Fever + Shield/Star + spawn-cap (final) ===
'use strict';

export const name = 'goodjunk';

const GOOD  = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK  = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWER = ['star','shield']; // click 'star' counts as power use (ไม่ใช่ gold food)

let host=null, alive=false, diff='Normal';
let baseSize=48, lifeS=1.6, spawnS=0.70, accum=0;
let fever=false, shield=0;

// spawn caps per diff (กันท่วม)
const CAP = { Easy:4, Normal:6, Hard:7 };

export function start(cfg={}){
  ensureHost(); clearHost(); alive=true;
  diff = String(cfg.difficulty||'Normal');
  if(diff==='Easy'){ baseSize=54; lifeS=1.90; spawnS=0.82; }
  else if(diff==='Hard'){ baseSize=40; lifeS=1.40; spawnS=0.56; }
  else { baseSize=48; lifeS=1.60; spawnS=0.70; }
  accum = 0;
}
export function stop(){ alive=false; clearHost(); }
export function cleanup(){ stop(); }

export function setFever(on){ fever=!!on; }
export function grantShield(n=1){ shield += (n|0); }
function useShield(){ if(shield>0){ shield--; return true; } return false; }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host=document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;';
    document.body.appendChild(host);
  }
}
function clearHost(){ if(host) try{ host.innerHTML=''; }catch{} }

function spawnEmoji(glyph, isGood, isGold, bus){
  const b=document.createElement('button');
  b.type='button';
  b.className='spawn-emoji';
  b.textContent=glyph;
  const size = isGold ? (baseSize+8) : baseSize;
  Object.assign(b.style,{
    position:'absolute', border:'0', background:'transparent', cursor:'pointer',
    fontSize:size+'px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))'
  });

  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  b.style.left=x+'px'; b.style.top=y+'px';

  const lifeMs = Math.floor((lifeS + (isGold?0.25:0))*1000);
  const to = setTimeout(()=>{ try{b.remove();}catch{}; onTimeout(bus); }, lifeMs);

  b.addEventListener('click',(ev)=>{
    clearTimeout(to);
    try{ b.remove(); }catch{}
    explodeAt(x,y);

    if(isGood){
      const perfect = isGold || Math.random()<0.22;
      const pts = Math.round((perfect?200:100) * (fever?1.5:1.0));
      bus && bus.hit && bus.hit({
        kind: perfect?'perfect':'good',
        points: pts,
        ui:{x:ev.clientX,y:ev.clientY},
        meta:{ good:true, gold:!!isGold }
      });
      if(bus && bus.sfx){ if(perfect && bus.sfx.perfect) bus.sfx.perfect(); else if(bus.sfx.good) bus.sfx.good(); }
    } else {
      onClickJunk(bus, ev.clientX, ev.clientY);
    }
  }, {passive:true});

  host.appendChild(b);
}

function spawnPower(kind, bus){
  const b=document.createElement('button');
  b.type='button'; b.className='spawn-emoji power';
  b.textContent = (kind==='shield'?'🛡️':'⭐');
  Object.assign(b.style,{
    position:'absolute', border:'0', background:'transparent', cursor:'pointer',
    fontSize: baseSize+'px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))'
  });
  const pad=56, W=innerWidth, H=innerHeight;
  b.style.left  = Math.floor(pad + Math.random()*(W - pad*2))+'px';
  b.style.top   = Math.floor(pad + Math.random()*(H - pad*2 - 140))+'px';

  const to=setTimeout(()=>{ try{b.remove();}catch{}; }, Math.floor((lifeS+0.25)*1000));
  b.addEventListener('click',(ev)=>{
    clearTimeout(to); try{b.remove();}catch{}
    if(kind==='shield'){ grantShield(1); if(bus && bus.power) bus.power('shield'); }
    else { if(bus && bus.power) bus.power('star'); if(bus && bus.hit) bus.hit({kind:'perfect', points:150, ui:{x:ev.clientX,y:ev.clientY}}); }
  }, {passive:true});

  host.appendChild(b);
}

function onTimeout(bus){
  // time-out ไม่ถือเป็น junk; ใช้สำหรับ quest "no miss"
  if(bus && bus.miss) bus.miss({kind:'timeout'});
  if(bus && bus.sfx && bus.sfx.bad) bus.sfx.bad();
}
function onClickJunk(bus, x,y){
  if(useShield()){
    if(bus && bus.sfx && bus.sfx.power) bus.sfx.power();
    return; // consume shield; ไม่ถือว่า miss
  }
  if(bus && bus.miss) bus.miss({kind:'junk', ui:{x,y}});
  if(bus && bus.sfx && bus.sfx.bad) bus.sfx.bad();
}

export function update(dt, bus){
  if(!alive) return;

  // spawn using accumulator
  accum += dt;
  const cap = CAP[diff] || 6;
  while(accum >= spawnS){
    accum -= spawnS;

    // limit active non-power icons
    const active = host ? host.querySelectorAll('.spawn-emoji:not(.power)').length : 0;
    if(active >= cap) continue;

    const r = Math.random();
    if(r < 0.10){
      spawnPower(POWER[(Math.random()*POWER.length)|0], bus);
    } else {
      // โอกาสทอง: ปรับเพิ่มเล็กน้อยเพื่อให้ gold quest ผ่านได้จริง
      const baseGold = (diff==='Easy'?0.18:(diff==='Hard'?0.12:0.15));
      const isGold   = Math.random() < baseGold;
      const isGood   = isGold || (Math.random() < 0.70);
      const glyph    = isGold ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
      spawnEmoji(glyph, isGood, isGold, bus);
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
    requestAnimationFrame(()=>{ p.style.transform = 'translate('+dx+'px,'+dy+'px) scale('+s+')'; p.style.opacity='0'; });
    setTimeout(()=>{ try{p.remove();}catch{}; }, 720);
  }
}

// Back-compat factory (for older main)
export function create(){
  return { start:(cfg)=>start(cfg), update:(dt,bus)=>update(dt,bus), setFever:(on)=>setFever(on), stop:()=>stop(), cleanup:()=>cleanup() };
}
