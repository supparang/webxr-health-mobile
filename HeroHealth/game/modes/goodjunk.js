// === modes/goodjunk.js — DOM-spawn icons + Fever hooks + Shield/Star (v2) ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['star','shield']; // star=+points burst, shield=ignore next miss

let host=null, alive=false;
let rate=0.70, life=1.60;          // spawn/sec และอายุ (วินาที)
let diff='Normal';
let fever=false, allowMiss=0;      // fever visual/score handled in main; here only spawn tempo
let _accum=0;                      // สะสมเวลาสำหรับตัวสุ่ม

export function start(cfg={}) {
  // สร้าง host ถ้ายังไม่มี
  host = document.getElementById('spawnHost') || (()=> {
    const h = document.createElement('div');
    h.id = 'spawnHost';
    h.style.cssText = 'position:fixed;inset:0;pointer-events:auto;z-index:5;';
    document.body.appendChild(h);
    return h;
  })();

  // เคลียร์ก่อนเริ่ม
  try { host.innerHTML = ''; } catch {}
  alive = true;

  // ความยาก
  diff = String(cfg.difficulty || 'Normal');
  if (diff === 'Easy')       { rate = 0.82; life = 1.90; }
  else if (diff === 'Hard')  { rate = 0.56; life = 1.40; }
  else                       { rate = 0.70; life = 1.60; }

  // รีเซ็ตตัวสะสมเวลา
  _accum = 0;
}

export function stop() {
  alive = false;
  try { host && (host.innerHTML = ''); } catch {}
}

export function setFever(on) { fever = !!on; }
export function grantShield(n=1) { allowMiss += n|0; }

function consumeShield() {
  if (allowMiss > 0) { allowMiss--; return true; }
  return false;
}

function spawnOne(glyph, isGood, isGolden, bus) {
  const d = document.createElement('button');
  d.className = 'spawn-emoji';
  d.type = 'button';
  d.textContent = glyph;

  // ขนาดตามระดับ + ทองใหญ่ขึ้นอีกนิด
  const base = (diff==='Easy' ? 56 : diff==='Hard' ? 42 : 48);
  const size = isGolden ? base + 10 : base;

  Object.assign(d.style, {
    position:'absolute',
    border:'0',
    background:'transparent',
    fontSize: size + 'px',
    transform:'translate(-50%,-50%)',
    filter: isGolden
      ? 'drop-shadow(0 10px 28px rgba(255,220,60,.75))'
      : 'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
    transition:'transform .12s ease-out'
  });

  // กระจายตำแหน่งบนจอ
  const pad = 56, W = innerWidth, H = innerHeight;
  const x = Math.floor(pad + Math.random() * (W - pad * 2));
  const y = Math.floor(pad + Math.random() * (H - pad * 2 - 140));
  d.style.left = x + 'px';
  d.style.top  = y + 'px';

  // อายุไอคอน
  const lifeMs = Math.floor((life + (isGolden ? 0.25 : 0)) * 1000);
  let dead = false;
  const killto = setTimeout(()=>{
    if (dead) return;
    dead = true;
    safeRemove(d);
    onMiss(bus);
  }, lifeMs);

  d.addEventListener('click', (ev)=>{
    if (dead) return;
    dead = true;
    clearTimeout(killto);
    explodeAt(x, y);
    safeRemove(d);

    if (isGood) {
      const perfect = isGolden || Math.random() < 0.22;
      const basePts = perfect ? 200 : 100;
      const mult    = fever ? 1.5 : 1.0;
      const pts     = Math.round(basePts * mult);

      bus?.hit?.({
        kind: perfect ? 'perfect' : 'good',
        points: pts,
        ui: { x: ev.clientX, y: ev.clientY }
      });
      if (perfect) bus?.sfx?.perfect?.(); else bus?.sfx?.good?.();
    } else {
      onMiss(bus);
    }
  }, { passive:true });

  host.appendChild(d);
}

function spawnPower(kind, bus) {
  const d = document.createElement('button');
  d.className = 'spawn-emoji power';
  d.type = 'button';
  d.textContent = (kind === 'shield' ? '🛡️' : '⭐');

  Object.assign(d.style, {
    position:'absolute', border:'0', background:'transparent',
    fontSize:'48px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 8px 18px rgba(70,160,255,.65))'
  });

  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random() * (W - pad * 2));
  const y = Math.floor(pad + Math.random() * (H - pad * 2 - 140));
  d.style.left = x + 'px';
  d.style.top  = y + 'px';

  let dead=false;
  const killto = setTimeout(()=>{ if(dead) return; dead=true; safeRemove(d); }, Math.floor((life+0.25)*1000));

  d.addEventListener('click', (ev)=>{
    if (dead) return;
    dead = true;
    clearTimeout(killto);
    safeRemove(d);

    if (kind === 'shield') {
      grantShield(1);
      bus?.power?.('shield');
    } else { // star = โบนัสแต้ม (นับเป็น perfect)
      bus?.hit?.({ kind:'perfect', points: 150, ui:{ x: ev.clientX, y: ev.clientY } });
      bus?.sfx?.perfect?.();
    }
  }, { passive:true });

  host.appendChild(d);
}

function onMiss(bus) {
  // ใช้ชิลด์กันหนึ่งครั้ง
  if (consumeShield()) { bus?.sfx?.power?.(); return; }
  bus?.miss?.();
  bus?.sfx?.bad?.();
}

export function update(dt, bus) {
  if (!alive) return;

  // เร่ง spawn เมื่อ FEVER
  const spawnRate = fever ? rate * 1.35 : rate;
  _accum += dt;

  // กำหนดจำนวนที่จะ spawn จาก accumulated time
  const need = Math.floor(_accum / Math.max(0.01, spawnRate));
  if (need <= 0) return;
  _accum -= need * spawnRate;

  for (let i=0; i<need; i++) {
    const r = Math.random();

    // power ~8% ปกติ / ~12% ตอน FEVER
    const pChance = fever ? 0.12 : 0.08;
    if (r < pChance) {
      spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus);
      continue;
    }

    const isGolden = Math.random() < (fever ? 0.18 : 0.12);
    const isGood   = isGolden || (Math.random() < 0.70);
    const glyph    = isGolden
      ? '🌟'
      : (isGood
          ? GOOD[(Math.random()*GOOD.length)|0]
          : JUNK[(Math.random()*JUNK.length)|0]);

    spawnOne(glyph, isGood, isGolden, bus);
  }
}

// ---- FX: particle burst เมื่อคลิกถูก ----
function explodeAt(x, y) {
  const n = 8 + ((Math.random()*6)|0);
  for (let i=0;i<n;i++){
    const p = document.createElement('div');
    p.textContent = '✦';
    Object.assign(p.style, {
      position:'fixed', left:x+'px', top:y+'px',
      transform:'translate(-50%,-50%)',
      font:'900 16px ui-rounded,system-ui',
      color:'#a7c8ff',
      textShadow:'0 2px 12px #4ea9ff',
      transition:'transform .7s ease-out, opacity .7s ease-out',
      opacity:'1', zIndex:1200, pointerEvents:'none'
    });
    document.body.appendChild(p);
    const dx = (Math.random()*120 - 60);
    const dy = (Math.random()*120 - 60);
    const s  = 0.6 + Math.random()*0.6;
    requestAnimationFrame(()=>{ p.style.transform = `translate(${dx}px,${dy}px) scale(${s})`; p.style.opacity='0'; });
    setTimeout(()=>{ safeRemove(p); }, 720);
  }
}

function safeRemove(el){ try{ el.remove(); }catch{} }
