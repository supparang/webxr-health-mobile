// === Hero Health Academy — game/modes/goodjunk.js (FINAL v1) ===
// • DOM-spawn, คลิกที่อาหารดีได้คะแนน / อาหารแย่ = miss
// • รองรับ difficulty (Easy/Normal/Hard) → spawn rate + อายุไอเท็ม
// • Golden item (🌟) = PERFECT +200
// • Power-up เล็กน้อย (x2 / freeze / sweep / shield) — ส่งผ่าน bus.power()
// • Watchdog: ถ้าหยุดสปอว์น >2s ให้กระตุ้นใหม่
// • cleanup() เก็บกวาด DOM ทุกครั้งเมื่อจบเกม/ออกกลางคัน

export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['x2','freeze','sweep','shield'];
const PGLYPH = { x2:'×2', freeze:'🧊', sweep:'🧲', shield:'🛡️' };

// ---- Internal state ----
let host = null;
let alive = false;
let rate = 0.70;   // วินาทีต่อ “หนึ่งชุด” (ยิ่งน้อยยิ่งถี่)
let life = 1.60;   // อายุไอเท็มวินาทีก่อนหาย
let diff = 'Normal';
let lastSpawnAt = 0;
let frozenUntil = 0;
let scoreMult = 1;

// difficulty mapping
function applyDiff(d = 'Normal'){
  diff = String(d);
  if (diff === 'Easy'){  rate = 0.85; life = 1.95; }
  else if (diff === 'Hard'){ rate = 0.56; life = 1.35; }
  else { rate = 0.70; life = 1.60; }
}

// safe host
function ensureHost(){
  let h = document.getElementById('spawnHost');
  if (!h){
    h = document.createElement('div');
    h.id = 'spawnHost';
    document.body.appendChild(h);
  }
  // ให้แน่ใจว่า “กดได้” และทับแคนวาสแน่นอน
  h.style.position = 'fixed';
  h.style.inset = '0';
  h.style.pointerEvents = 'auto';
  h.style.zIndex = '2000';
  return h;
}

// small util
function rndInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function put(el){ host.appendChild(el); }

// spawn one emoji item
function spawnItem(glyph, isGood, isGolden, bus){
  const d = document.createElement('button');
  d.type = 'button';
  d.className = 'spawn-emoji';
  d.textContent = glyph;

  const baseSize = (diff==='Easy'? 46 : diff==='Hard'? 34 : 40);
  Object.assign(d.style, {
    position:'absolute', border:'0', background:'transparent',
    fontSize: baseSize + 'px',
    transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 3px 8px rgba(0,0,0,.45))',
    cursor:'pointer', userSelect:'none'
  });

  const pad = 48, W = innerWidth, H = innerHeight;
  const x = rndInt(pad, Math.max(pad, W - pad));
  const y = rndInt(pad, Math.max(pad, H - pad - 120));
  d.style.left = x + 'px';
  d.style.top  = y + 'px';

  // อายุไอเท็ม
  const lifeMs = Math.floor((life + (isGolden?0.25:0)) * 1000);
  const killer = setTimeout(()=>{ try{ d.remove(); }catch{} bus?.miss?.(); }, lifeMs);

  d.addEventListener('click', (ev)=>{
    clearTimeout(killer);
    try{ d.remove(); }catch{}
    if (isGood){
      const perfect = isGolden || Math.random() < 0.22;
      const base = perfect ? 200 : 100;
      const pts = Math.round(base * scoreMult);
      bus?.hit?.({ kind:(perfect?'perfect':'good'), points: pts, ui:{x:ev.clientX, y:ev.clientY} });
      bus?.sfx?.[perfect?'perfect':'good']?.();
    } else {
      bus?.miss?.();
      bus?.sfx?.bad?.();
    }
  }, { passive:true });

  put(d);
}

// spawn power-up
function spawnPower(kind, bus){
  const d = document.createElement('button');
  d.type = 'button';
  d.className = 'spawn-emoji power';
  d.textContent = PGLYPH[kind] || '★';
  Object.assign(d.style, {
    position:'absolute', border:'0', background:'transparent',
    fontSize:'44px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 4px 10px rgba(0,200,255,.55))', cursor:'pointer'
  });
  const pad = 48, W = innerWidth, H = innerHeight;
  d.style.left = rndInt(pad, W - pad) + 'px';
  d.style.top  = rndInt(pad, H - pad - 120) + 'px';

  const killer = setTimeout(()=>{ try{ d.remove(); }catch{} }, Math.floor((life + .25)*1000));
  d.addEventListener('click', (ev)=>{
    clearTimeout(killer);
    try{ d.remove(); }catch{}
    // apply effect (แบบง่าย)
    if (kind === 'x2'){ scoreMult = 2; setTimeout(()=> scoreMult = 1, 3500); }
    if (kind === 'freeze'){ frozenUntil = performance.now() + 1400; }
    if (kind === 'sweep'){ // ล้างของเสียรอบ ๆ
      document.querySelectorAll('.spawn-emoji').forEach(n=>{ try{ n.remove(); }catch{} });
    }
    if (kind === 'shield'){ /* reserved: ไม่ตัดคอมโบครั้งถัดไป */ }
    bus?.power?.(kind);
    bus?.hit?.({ kind:'good', points:0, ui:{x:ev.clientX, y:ev.clientY} });
    bus?.sfx?.power?.();
  }, { passive:true });

  put(d);
}

// ---- Public API (factory style) ----
export function create(){
  return {
    start(opts = {}){
      host = ensureHost();
      host.innerHTML = '';
      host.style.display = 'block';
      alive = true;
      scoreMult = 1;
      frozenUntil = 0;
      lastSpawnAt = performance.now();
      applyDiff(String((opts?.difficulty)||'Normal'));
    },
    update(dt, bus){
      if (!alive) return;

      // freeze window
      if (performance.now() < frozenUntil) return;

      // คุมอัตราการสปอว์น
      // (rate = วินาทีต่อ “หนึ่งรอบ” → dt สะสมด้วยตัวแปรภายใน)
      this._acc = (this._acc||0) + dt;
      if (this._acc >= rate){
        this._acc -= rate;
        lastSpawnAt = performance.now();

        const roll = Math.random();
        if (roll < 0.12){
          // power-up
          spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus);
        } else {
          // item ปกติ
          const isGolden = Math.random() < 0.12;
          const isGood   = isGolden || (Math.random() < 0.70);
          const glyph    = isGolden ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
          spawnItem(glyph, isGood, isGolden, bus);
        }
      }

      // Watchdog: ถ้านิ่งเกิน 2.2s ให้สปอว์นทันที
      if (performance.now() - lastSpawnAt > 2200){
        lastSpawnAt = performance.now();
        const isGood = Math.random() < 0.8;
        const glyph  = isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
        spawnItem(glyph, isGood, false, bus);
      }
    },
    cleanup(){
      alive = false;
      scoreMult = 1;
      frozenUntil = 0;
      try{
        if (host){
          host.innerHTML = '';
          // ไม่ลบ host เพื่อให้รอบหน้าทำงานต่อได้
        }
      }catch{}
    }
  };
}

// (optional legacy entry points เพื่อความเข้ากันได้)
export function init(state, hud, cfg){ applyDiff(state?.difficulty||'Normal'); }
export function cleanup(){ try{ if (host) host.innerHTML=''; }catch{} }
