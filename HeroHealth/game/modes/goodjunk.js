// === modes/goodjunk.js — DOM spawner (gold/shield, miss only for good-timeout, junk=penalty, FEVER aware) ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['gold','shield']; // gold=⭐ (นับเป็น gold quest), shield=กัน miss/penalty ครั้งถัดไป

let host=null, alive=false, fever=false;
let diff='Normal', iconSizeBase=52, spawnIntervalS=0.70, lifeS=1.60;
let _accum=0, allowShield=0;

export function setFever(on){ fever=!!on; } // main จะเรียก
export function grantShield(n=1){ allowShield += n|0; }
function consumeShield(){ if(allowShield>0){ allowShield--; return true; } return false; }

export function start(cfg={}){
  ensureHost(); clearHost(); alive=true;
  diff=String(cfg.difficulty||'Normal');
  if(diff==='Easy'){ iconSizeBase=64; spawnIntervalS=0.85; lifeS=2.0; }
  else if(diff==='Hard'){ iconSizeBase=44; spawnIntervalS=0.56; lifeS=1.40; }
  else { iconSizeBase=52; spawnIntervalS=0.70; lifeS=1.60; }
  _accum=0; allowShield=0; fever=false;
}

export function cleanup(){ stop(); }
export function stop(){ alive=false; clearHost(); }

function ensureHost(){
  host=document.getElementById('spawnHost');
  if(!host){ host=document.createElement('div'); host.id='spawnHost'; host.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;'; document.body.appendChild(host); }
}
function clearHost(){ if(host) host.innerHTML=''; }

function posRandom(){
  const pad=56, W=innerWidth, H=innerHeight;
  const x=Math.floor(pad + Math.random()*(W - pad*2));
  const y=Math.floor(pad + Math.random()*(H - pad*2 - 140));
  return {x,y};
}

function spawnGood(bus,{golden=false}={}){
  const d=document.createElement('button'); d.className='spawn-emoji good'; d.type='button';
  d.textContent = golden ? '🌟' : GOOD[(Math.random()*GOOD.length)|0];
  const size = golden ? (iconSizeBase+10) : iconSizeBase;
  Object.assign(d.style,{position:'absolute',border:'0',background:'transparent',fontSize:size+'px',transform:'translate(-50%,-50%)',filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',cursor:'pointer'});
  const p=posRandom(); d.style.left=p.x+'px'; d.style.top=p.y+'px';

  const lifeMs=Math.floor((lifeS + (golden?0.25:0))*1000);
  const to=setTimeout(()=>{ // หมดเวลา = MISS (เฉพาะ good)
    if(consumeShield()){ bus?.power?.('shield-consume'); try{d.remove();}catch{}; return; }
    try{d.remove();}catch{}; bus?.miss?.({by:'good-timeout'});
  }, lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(to); try{d.remove();}catch{};
    const perfect = golden || Math.random()<0.22;
    let base = perfect ? 200 : 100;
    if(fever) base = Math.round(base*1.5);
    const pts = base;
    bus?.hit?.({ kind: golden?'gold':(perfect?'perfect':'good'), points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:{gold:golden} });
    if(perfect) bus?.sfx?.perfect?.(); else bus?.sfx?.good?.();
  }, {passive:true});

  host.appendChild(d);
}

function spawnJunk(bus){
  const d=document.createElement('button'); d.className='spawn-emoji junk'; d.type='button';
  d.textContent = JUNK[(Math.random()*JUNK.length)|0];
  Object.assign(d.style,{position:'absolute',border:'0',background:'transparent',fontSize:iconSizeBase+'px',transform:'translate(-50%,-50%)',filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',cursor:'pointer'});
  const p=posRandom(); d.style.left=p.x+'px'; d.style.top=p.y+'px';

  const lifeMs=Math.floor((lifeS-0.1)*1000);
  const to=setTimeout(()=>{ try{d.remove();}catch{}; /* หมดเวลา: ไม่ถือว่า miss */ }, lifeMs);

  d.addEventListener('click',()=>{
    clearTimeout(to); try{d.remove();}catch{};
    if(consumeShield()){ bus?.power?.('shield-consume'); return; }
    bus?.penalty?.({by:'junk-click'}); // ไม่ใช่ miss
  },{passive:true});

  host.appendChild(d);
}

function spawnPower(kind,bus){ // kind: 'gold'|'shield'
  const d=document.createElement('button'); d.className='spawn-emoji power'; d.type='button';
  d.textContent = kind==='shield' ? '🛡️' : '⭐';
  Object.assign(d.style,{position:'absolute',border:'0',background:'transparent',fontSize:(iconSizeBase+2)+'px',transform:'translate(-50%,-50%)',filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))',cursor:'pointer'});
  const p=posRandom(); d.style.left=p.x+'px'; d.style.top=p.y+'px';
  const to=setTimeout(()=>{ try{d.remove();}catch{}; }, Math.floor((lifeS+0.25)*1000));

  d.addEventListener('click',(ev)=>{
    clearTimeout(to); try{d.remove();}catch{};
    if(kind==='shield'){ grantShield(1); bus?.power?.('shield'); }
    else { // gold power star — นับเป็น gold quest
      const pts = fever ? 225 : 150;
      bus?.hit?.({ kind:'gold', points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:{gold:true} });
    }
  }, {passive:true});

  host.appendChild(d);
}

export function update(dt,bus){
  if(!alive) return;
  _accum += dt;
  const spawnEvery = Math.max(0.38, spawnIntervalS * (fever?0.75:1)); // เร็วขึ้นตอน FEVER
  while(_accum >= spawnEvery){
    _accum -= spawnEvery;
    const r=Math.random();
    if(r < 0.12){ // power 12%
      spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus);
    } else {
      const isGolden = Math.random() < 0.14;
      const isGood   = isGolden || (Math.random() < 0.70);
      if(isGood) spawnGood(bus,{golden:isGolden}); else spawnJunk(bus);
    }
  }
}

// compatibility กับ main แบบเก่า
export function create(){ return { start:(cfg)=>start(cfg), update:(dt,b)=>update(dt,b), cleanup:()=>stop() }; }
