// === modes/goodjunk.js — DOM spawn + size by difficulty + gold/star + penalty(junk) + MISS(good timeout) + fever hook ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['star','shield'];            // star = +points, gold event; shield = ignore next miss (from good timeout only)

let host=null, alive=false;
let diff='Normal';
let iconSizeBase=48;
let spawnIntervalS = 0.70;   // seconds/spawn
let lifeS           = 1.60;   // lifetime per icon (s)
let _accum = 0;
let fever=false;
let allowMiss=0;               // shield stock

export function setFever(on){ fever = !!on; }
export function grantShield(n=1){ allowMiss += n|0; }
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
function clearHost(){ try{ host && (host.innerHTML=''); }catch{} }

export function start(cfg={}){
  ensureHost(); clearHost(); alive=true;
  diff = String(cfg.difficulty||'Normal');

  // ขนาดไอคอน & pace ตามระดับ
  if (diff==='Easy'){ spawnIntervalS=0.82; lifeS=1.90; iconSizeBase=64; }
  else if (diff==='Hard'){ spawnIntervalS=0.56; lifeS=1.40; iconSizeBase=44; }
  else { spawnIntervalS=0.70; lifeS=1.60; iconSizeBase=54; } // Normal

  _accum=0; fever=false; allowMiss=0;
}

export function stop(){ alive=false; clearHost(); }

function spawnPower(kind, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji power'; d.type='button';
  d.textContent=(kind==='shield'?'🛡️':'⭐');
  Object.assign(d.style,{
    position:'absolute', border:'0', background:'transparent', cursor:'pointer',
    fontSize:(iconSizeBase)+'px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))'
  });
  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left=x+'px'; d.style.top=y+'px';

  const killto=setTimeout(()=>{ try{d.remove();}catch{} }, Math.floor((lifeS+0.25)*1000));
  d.addEventListener('click',(ev)=>{
    clearTimeout(killto); try{d.remove();}catch{}
    if (kind==='shield'){ grantShield(1); bus?.power?.('shield'); }
    else {
      const base = 150, mult = fever?1.5:1.0, pts = Math.round(base*mult);
      bus?.hit?.({ kind:'gold', points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:{good:true,golden:true} });
    }
  }, { passive:true });
  host.appendChild(d);
}

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
    requestAnimationFrame(()=>{ p.style.transform=`translate(${dx}px,${dy}px) scale(${s})`; p.style.opacity='0'; });
    setTimeout(()=>{ try{p.remove();}catch{} }, 720);
  }
}

function spawnOne(glyph, isGood, isGolden, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji'; d.type='button'; d.textContent=glyph;

  const size = (isGolden? (iconSizeBase+10) : iconSizeBase);
  Object.assign(d.style,{
    position:'absolute', border:'0', background:'transparent',
    fontSize:size+'px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))', cursor:'pointer'
  });

  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left = x+'px'; d.style.top = y+'px';

  // อายุ: ถ้าเป็น good เท่านั้นที่ถือว่า MISS เมื่อหมดเวลา
  const lifeMs = Math.floor((lifeS + (isGolden?0.25:0))*1000);
  const killto = setTimeout(()=>{
    try{ d.remove(); }catch{}
    if (isGood){                                // ✅ MISS เฉพาะ good ที่ไม่ทันเวลา
      if (!consumeShield()){
        bus?.miss?.({ kind:'goodTimeout' });
      } // ถ้ามี shield จะกัน MISS
    }
  }, lifeMs);

  d.addEventListener('click', (ev)=>{
    clearTimeout(killto);
    explodeAt(x,y);
    try{ d.remove(); }catch{}
    if (isGood){
      const perfect = isGolden || Math.random()<0.22;
      const basePts = perfect ? 200 : 100;
      const mult = fever ? 1.5 : 1.0;
      const pts = Math.round(basePts*mult);
      bus?.hit?.({
        kind:(isGolden?'gold':(perfect?'perfect':'good')),
        points:pts, ui:{x:ev.clientX, y:ev.clientY},
        meta:{good:true, golden:!!isGolden, perfect}
      });
    } else {
      // ✅ Junk = โทษ ไม่ใช่ MISS
      bus?.penalty?.({ kind:'junk' });
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
    if (r < 0.10){ // 10% power
      spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus);
    } else {
      const isGolden = Math.random() < 0.12;
      const isGood   = isGolden || (Math.random() < 0.70);
      const glyph    = isGolden ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}

// สำหรับ main ที่ใช้สไตล์ create/init
export function create(){
  return {
    start: (cfg)=>start(cfg),
    update: (dt,bus)=>update(dt,bus),
    cleanup: ()=>stop(),
    setFever: (on)=>setFever(on)
  };
}
