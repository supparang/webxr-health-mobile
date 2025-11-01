// === modes/goodjunk.js — rate limiter + density cap ===
export const name = 'goodjunk';

const GOOD  = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK  = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS= ['star','shield'];

let host=null, alive=false, diff='Normal';
let life=1.6;                 // อายุไอคอน (วินาที)
let rps=1.2;                  // จำนวน spawn ต่อวินาที (จริง ๆ)
let maxIcons=24;              // เพดานจำนวนบนจอพร้อมกัน
let acc=0;                    // accumulator สำหรับตัวจับเวลา
let active=0;                 // จำนวนไอคอนบนจอ (นับเอง)

let fever=false, allowMiss=0;

export function start(cfg={}){
  host = document.getElementById('spawnHost')
      || (()=>{ const h=document.createElement('div'); h.id='spawnHost'; document.body.appendChild(h); return h; })();

  Object.assign(host.style,{ position:'fixed', inset:'0', pointerEvents:'auto', zIndex:'3200' });
  host.innerHTML='';
  alive=true;
  diff=String(cfg.difficulty||'Normal');
  acc=0; active=0;

  // ปรับตามระดับ (คุม “จำนวน” ไม่ใช่สุ่มต่อเฟรม)
  if (diff==='Easy'){  rps=0.9; life=2.0; maxIcons=18; }
  else if (diff==='Hard'){ rps=1.6; life=1.35; maxIcons=28; }
  else {                rps=1.2; life=1.6;  maxIcons=24; }
}

export function stop(){ alive=false; try{ host && (host.innerHTML=''); }catch{} }
export function setFever(on){ fever=!!on; }
export function grantShield(n=1){ allowMiss += n|0; }
function consumeShield(){ if(allowMiss>0){ allowMiss--; return true; } return false; }

function markSpawn(){ try{ window.__HHA_MARK_SPAWNED && window.__HHA_MARK_SPAWNED(); }catch{} }

function spawnOne(glyph, isGood, isGolden, bus){
  active++;
  const d=document.createElement('button');
  d.className='spawn-emoji'; d.type='button'; d.textContent=glyph;

  const base = (diff==='Easy'? 64 : diff==='Hard'? 46 : 54);
  const size = isGolden ? base+10 : base;
  Object.assign(d.style,{
    position:'absolute', border:'0', background:'transparent',
    fontSize:size+'px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
    zIndex:'3300', cursor:'pointer'
  });

  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left=x+'px'; d.style.top=y+'px';

  const lifeMs = Math.floor((life + (isGolden?0.25:0))*1000);
  const killto = setTimeout(()=>{ cleanup(); onMiss(bus); }, lifeMs);

  function cleanup(){ try{ d.remove(); }catch{} active=Math.max(0,active-1); }

  d.addEventListener('click',(ev)=>{
    clearTimeout(killto);
    explodeAt(x,y);
    cleanup();
    if (isGood){
      const perfect = Math.random()<0.18 || isGolden;
      const basePts = perfect ? 200 : 100;
      const mult = fever ? 1.5 : 1.0;
      const pts  = Math.round(basePts*mult);
      bus?.hit?.({ kind:(isGolden?'perfect':'good'), points:pts, ui:{x:ev.clientX, y:ev.clientY} });
      if (isGolden) bus?.sfx?.perfect?.(); else bus?.sfx?.good?.();
    } else {
      onMiss(bus);
    }
  }, {passive:true});

  host.appendChild(d);
  markSpawn();
}

function spawnPower(kind,bus){
  active++;
  const d=document.createElement('button');
  d.className='spawn-emoji power'; d.type='button'; d.textContent=(kind==='shield'?'🛡️':'⭐');
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent',
    fontSize:'56px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))', zIndex:'3300', cursor:'pointer' });

  const pad=56, W=innerWidth, H=innerHeight;
  const x=Math.floor(pad+Math.random()*(W-pad*2));
  const y=Math.floor(pad+Math.random()*(H-pad*2-140));
  d.style.left=x+'px'; d.style.top=y+'px';

  const killto=setTimeout(()=>{ cleanup(); }, Math.floor((life+0.25)*1000));
  function cleanup(){ try{ d.remove(); }catch{} active=Math.max(0,active-1); }

  d.addEventListener('click',(ev)=>{
    clearTimeout(killto); cleanup();
    if (kind==='shield'){ grantShield(1); bus?.power?.('shield'); }
    else { bus?.hit?.({ kind:'perfect', points:150, ui:{x:ev.clientX,y:ev.clientY} }); }
  }, {passive:true});

  host.appendChild(d);
  markSpawn();
}

function onMiss(bus){
  if (consumeShield()){ bus?.sfx?.power?.(); return; }
  bus?.miss?.(); bus?.sfx?.bad?.();
}

// ตัวควบคุมอัตรา spawn แบบ “ตามเวลา”
export function update(dt,bus){
  if(!alive) return;

  // backpressure: ถ้าเฟรมช้า dt ใหญ่ → ลด rps ชั่วคราวเล็กน้อย
  const dynRps = rps * (dt>0.05 ? 0.8 : 1.0);

  acc += dt;
  const step = 1/Math.max(0.1, dynRps);

  while (acc >= step) {
    acc -= step;

    // อย่าเกินเพดานจำนวนบนจอ
    if (active >= maxIcons) break;

    const r = Math.random();
    if (r < 0.06){ // Power 6% (ลดจากเดิม)
      spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus);
    } else {
      const isGolden = Math.random() < 0.08;     // Golden 8% (ลดจากเดิม)
      const isGood   = isGolden || (Math.random() < 0.75);
      const glyph = isGolden ? '🌟'
                   : (isGood ? GOOD[(Math.random()*GOOD.length)|0]
                             : JUNK[(Math.random()*JUNK.length)|0]);
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}

// เอฟเฟกต์แตกกระจาย
function explodeAt(x,y){
  const n=8+((Math.random()*6)|0);
  for(let i=0;i<n;i++){
    const p=document.createElement('div');
    p.textContent='✦';
    Object.assign(p.style,{
      position:'fixed', left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
      font:'900 16px ui-rounded,system-ui', color:'#a7c8ff',
      textShadow:'0 2px 12px #4ea9ff', transition:'transform .7s ease-out, opacity .7s ease-out',
      opacity:'1', zIndex:3400, pointerEvents:'none'
    });
    document.body.appendChild(p);
    const dx=(Math.random()*120-60), dy=(Math.random()*120-60), s=0.6+Math.random()*0.6;
    requestAnimationFrame(()=>{ p.style.transform=`translate(${dx}px,${dy}px) scale(${s})`; p.style.opacity='0'; });
    setTimeout(()=>{ try{p.remove();}catch{} }, 720);
  }
}
