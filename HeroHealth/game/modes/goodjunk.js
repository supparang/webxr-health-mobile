// === modes/goodjunk.js — DOM-spawn (production) ===
// - GOOD คลิกไม่ทัน = นับเป็น miss (มี shield กัน miss ได้)
// - JUNK คลิก = bad (ไม่ใช่ miss) | ปล่อยหายไป = ไม่ถือว่า miss
// - GOLD/STAR นับเป็น "gold" ใน Quests ผ่าน kind
// - ไอคอนใหญ่ขึ้นตามระดับความยาก: Easy > Normal > Hard
// - ใช้ time-accumulator คุมอัตรา spawn ให้สม่ำเสมอ

export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['star','shield']; // star=+points, shield=กัน miss ครั้งถัดไป

let host = null;
let alive = false;
let difficulty = 'Normal';

// ปรับขนาดไอคอน/อายุ/อัตราเกิดตามระดับ
let iconSizeBase = 48;
let lifeS = 1.60;          // อายุอยู่บนจอ
let spawnIntervalS = 0.70; // ค่าต่ำ = โผล่ถี่ขึ้น

let _accum = 0;
let shieldCount = 0;

// ---------- lifecycle ----------
export function start(cfg = {}){
  ensureHost();
  clearHost();
  alive = true;

  difficulty = String(cfg.difficulty || 'Normal');

  if (difficulty === 'Easy'){
    iconSizeBase = 60;    // ใหญ่สุด
    lifeS = 2.00;
    spawnIntervalS = 0.80;
  } else if (difficulty === 'Hard'){
    iconSizeBase = 44;    // เล็กลงเล็กน้อย
    lifeS = 1.40;
    spawnIntervalS = 0.56;
  } else {
    iconSizeBase = 52;    // ใหญ่กว่าเดิมเล็กน้อย
    lifeS = 1.60;
    spawnIntervalS = 0.70;
  }

  _accum = 0;
  shieldCount = 0;
}

export function cleanup(){
  alive = false;
  clearHost();
}

// main.js เรียกผ่าน update(dt, bus)
export function update(dt, bus){
  if(!alive) return;

  _accum += dt;
  while (_accum >= spawnIntervalS){
    _accum -= spawnIntervalS;

    const r = Math.random();

    // ~10% เป็น power (star/shield)
    if (r < 0.10){
      spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus);
      continue;
    }

    // ~12% เป็น GOLD (🌟), ที่เหลือสุ่ม GOOD 70% / JUNK 30%
    const isGolden = Math.random() < 0.12;
    const isGood = isGolden || (Math.random() < 0.70);
    const glyph = isGolden ? '🌟' : (isGood ? pick(GOOD) : pick(JUNK));
    spawnOne(glyph, isGood, isGolden, bus);
  }
}

// ---------- DOM helpers ----------
function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.cssText = 'position:fixed;inset:0;pointer-events:auto;z-index:5;';
    document.body.appendChild(host);
  }
}
function clearHost(){ try{ host && (host.innerHTML = ''); }catch(_e){} }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

// ---------- spawn ----------
function spawnOne(glyph, isGood, isGolden, bus){
  const d = document.createElement('button');
  d.className = 'spawn-emoji';
  d.type = 'button';
  d.textContent = glyph;

  const size = isGolden ? (iconSizeBase + 8) : iconSizeBase;
  d.style.position = 'absolute';
  d.style.border = '0';
  d.style.background = 'transparent';
  d.style.fontSize = size + 'px';
  d.style.transform = 'translate(-50%,-50%)';
  d.style.filter = 'drop-shadow(0 6px 16px rgba(0,0,0,.55))';
  d.style.cursor = 'pointer';

  const pad = 56, W = window.innerWidth, H = window.innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left = x + 'px';
  d.style.top  = y + 'px';

  const lifeMs = Math.floor((lifeS + (isGolden?0.25:0))*1000);
  const killto = setTimeout(function(){
    try{ d.remove(); }catch(_e){}
    // GOOD ที่หมดอายุ = MISS (ถ้าไม่มี shield)
    if (isGood){
      if (shieldCount > 0){
        shieldCount--;
        // แจ้งว่าใช้ shield
        safeCall(bus, 'power', ['shield-used']);
      } else {
        safeCall(bus, 'miss', [{ kind:'timeout' }]);
        safeCall(bus, 'sfx', ['bad']); // ถ้ามี sfx.bad ให้ดัง
      }
    }
    // JUNK หมดอายุ: ไม่ถือว่า miss/bad อะไร
  }, lifeMs);

  d.addEventListener('click', function(ev){
    clearTimeout(killto);
    try{ d.remove(); }catch(_e){}

    if (isGood){
      // แต้ม: GOLD/perfect สูงกว่า
      const perfect = isGolden || Math.random() < 0.22;
      const basePts = perfect ? 200 : 100;
      const pts = basePts; // FEVER คูณ ถูกจัดการใน main ผ่าน combo แล้ว (แสดงผล)
      safeCall(bus, 'hit', [{
        kind: isGolden ? 'gold' : (perfect ? 'perfect' : 'good'),
        points: pts,
        ui: { x: ev.clientX, y: ev.clientY }
      }]);
      if (perfect) safeCall(bus, 'sfx', ['perfect']); else safeCall(bus, 'sfx', ['good']);
    } else {
      // กด JUNK = bad (reset combo) ไม่ใช่ miss
      safeCall(bus, 'bad', [{ kind:'junk', ui:{ x:ev.clientX, y:ev.clientY } }]);
      safeCall(bus, 'sfx', ['bad']);
    }
  }, { passive:true });

  host.appendChild(d);
}

function spawnPower(kind, bus){
  const d = document.createElement('button');
  d.className = 'spawn-emoji power';
  d.type = 'button';
  d.textContent = (kind === 'shield') ? '🛡️' : '⭐';

  d.style.position = 'absolute';
  d.style.border = '0';
  d.style.background = 'transparent';
  d.style.fontSize = iconSizeBase + 'px';
  d.style.transform = 'translate(-50%,-50%)';
  d.style.filter = 'drop-shadow(0 8px 18px rgba(10,120,220,.55))';
  d.style.cursor = 'pointer';

  const pad = 56, W = window.innerWidth, H = window.innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left = x + 'px';
  d.style.top  = y + 'px';

  const killto = setTimeout(function(){ try{ d.remove(); }catch(_e){}; }, Math.floor((lifeS+0.25)*1000));

  d.addEventListener('click', function(ev){
    clearTimeout(killto);
    try{ d.remove(); }catch(_e){}

    if (kind === 'shield'){
      shieldCount++;
      safeCall(bus, 'power', ['shield']);
    } else {
      // STAR = แต้ม + แจ้งว่าเป็น gold (สำหรับ Quests นับ gold capture)
      safeCall(bus, 'hit', [{
        kind: 'gold',
        points: 150,
        ui: { x: ev.clientX, y: ev.clientY }
      }]);
      safeCall(bus, 'sfx', ['power']);
    }
  }, { passive:true });

  host.appendChild(d);
}

// ---------- utils ----------
function safeCall(bus, key, args){
  try{
    const fn = bus && bus[key];
    if (typeof fn === 'function'){
      if (Array.isArray(args)) fn.apply(null, args);
      else fn(args);
    }
  }catch(_e){}
}

// สำหรับ main รุ่นเก่าที่เรียก create()
export function create(){
  return {
    start: function(cfg){ start(cfg); },
    update: function(dt, bus){ update(dt, bus); },
    cleanup: function(){ cleanup(); }
  };
}
