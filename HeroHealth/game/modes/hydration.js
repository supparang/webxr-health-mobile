// === Hero Health Academy — modes/hydration.js (hardened + mini-quests) ===
export const name = 'hydration';

/* ------------------------------ Catalog ------------------------------ */
const WATER = [
  { id:'water1', labelEN:'Water', labelTH:'น้ำเปล่า', icon:'💧' },
  { id:'water2', labelEN:'Water', labelTH:'น้ำเปล่า', icon:'🫗' },
];
const SWEET = [
  { id:'soda',  labelEN:'Soda',  labelTH:'น้ำอัดลม',        icon:'🥤' },
  { id:'juice', labelEN:'Juice', labelTH:'น้ำผลไม้หวาน',   icon:'🧃'  },
];
const NEUTRAL = [
  { id:'ice',   labelEN:'Ice',   labelTH:'น้ำแข็ง',        icon:'🧊'  },
];

/* ------------------------------ Local State ------------------------------ */
const ST = {
  lang:'TH',
  level: 50,        // 0..100 (render cap), แต่อยู่จริง 0..120 เพื่อมี headroom
  safeMin: 40,
  safeMax: 60,

  // x2
  x2Until: 0,

  // Passive drift
  driftPerSec: 2,        // ดึงกลับหาค่า 50 อย่างนุ่มนวล
  lastTick: 0,

  // Mini-quests
  mq_inSafeMs: 0,        // เวลาที่อยู่ในโซนปลอดภัยต่อเนื่อง
  mq_avoidSweetMs: 0,    // เวลาเลี่ยงน้ำหวานต่อเนื่อง
  mq_lastWasSweet: false,

  // HUD refs
  $wrap:null, $bar:null, $label:null
};

/* ------------------------------ Safe FX Import ------------------------------ */
let FX = { add3DTilt: ()=>{}, shatter3D: ()=>{} };
(async () => {
  try {
    const m = await import('../game/core/fx.js').catch(()=>null);
    if (m) FX = { add3DTilt: m.add3DTilt||(()=>{}), shatter3D: m.shatter3D||(()=>{}) };
  } catch {}
  if (!FX.add3DTilt || !FX.shatter3D) {
    try {
      const m2 = await import('/webxr-health-mobile/HeroHealth/game/core/fx.js').catch(()=>null);
      if (m2) FX = { add3DTilt: m2.add3DTilt||(()=>{}), shatter3D: m2.shatter3D||(()=>{}) };
    } catch {}
  }
})();

/* ------------------------------ Lifecycle ------------------------------ */
export function init(gameState={}, hud=null, diff={}){
  ST.lang = (localStorage.getItem('hha_lang') || gameState.lang || 'TH').toUpperCase();
  ST.level = 50;
  ST.safeMin = 40;
  ST.safeMax = 60;
  ST.x2Until = 0;

  ST.driftPerSec = Number(diff?.driftPerSec) > 0 ? Number(diff.driftPerSec) : 2;
  ST.lastTick = performance.now();

  ST.mq_inSafeMs = 0;
  ST.mq_avoidSweetMs = 0;
  ST.mq_lastWasSweet = false;

  ensureHydroHUD(); // สร้าง HUD ถ้าไม่มี
  if (ST.$wrap) ST.$wrap.style.display = 'block';
  renderBar();

  // โชว์เป้า mini-quests (ถ้า HUD มี mission API)
  try {
    hud?.mission?.setPrimary?.(t('รักษาระดับน้ำให้อยู่ในโซนพอดี 10 วินาที',
                                 'Keep hydration in the safe zone for 10s', ST.lang));
    hud?.mission?.setSecondary?.(t('หลีกเลี่ยงน้ำหวาน 8 วินาที',
                                   'Avoid sweet drinks for 8s', ST.lang));
  } catch {}
}

export function cleanup(){
  if (ST.$wrap) ST.$wrap.style.display = 'none';
}

export function tick(gameState={}, systems={}, hud=null){
  const now = performance.now();
  let dt = now - (ST.lastTick || now);
  ST.lastTick = now;
  if (dt <= 0) dt = 0;

  // ปิด x2 เมื่อหมดเวลา
  if (ST.x2Until && now > ST.x2Until) ST.x2Until = 0;

  // Passive drift: ดึง ST.level เข้าหา 50 เมื่อไม่มีการกด (รู้สึกเป็นธรรมชาติ)
  // ไม่ดึงขณะ freeze (ให้ main.js ตั้ง state.freezeUntil)
  if (!(gameState?.freezeUntil && now < gameState.freezeUntil)) {
    const center = 50;
    const dir = (ST.level > center) ? -1 : (ST.level < center ? 1 : 0);
    ST.level = clamp(ST.level + dir * ST.driftPerSec * (dt/1000), 0, 120);
  }

  // Mini-quests evaluator (ทุกเฟรม)
  const inSafe = (ST.level >= ST.safeMin && ST.level <= ST.safeMax);
  ST.mq_inSafeMs     = inSafe ? (ST.mq_inSafeMs + dt) : 0;
  ST.mq_avoidSweetMs = (!ST.mq_lastWasSweet) ? (ST.mq_avoidSweetMs + dt) : 0;
  ST.mq_lastWasSweet = false; // reset flag; จะถูกตั้งกลับใน onHit ถ้าเพิ่งดื่มหวาน

  // แจ้งความคืบหน้าบน HUD (ถ้ามี)
  try {
    hud?.mission?.setProgressPrimary?.(Math.min(1, ST.mq_inSafeMs / 10000));   // เป้า 10s
    hud?.mission?.setProgressSecondary?.(Math.min(1, ST.mq_avoidSweetMs / 8000)); // เป้า 8s
  } catch {}

  renderBar();
}

/* ------------------------------ Spawner ------------------------------ */
// น้ำเปล่าเยอะสุด (สนุกแต่มีเสี่ยงถ้าสูงเกิน)
export function pickMeta(diff={}){
  const r = Math.random();
  const pool = r < 0.6 ? WATER : (r < 0.85 ? SWEET : NEUTRAL);
  const it = pool[(Math.random()*pool.length)|0];

  const golden = performance.now() < ST.x2Until;
  const mult = golden ? 2 : 1;

  const lifeBase = Number(diff?.life) > 0 ? Number(diff.life) : 3000;
  const life = clamp(lifeBase, 700, 4500);

  // คำนวณ type แบบชัดเจน (ไม่พึ่ง .includes กับออปเจ็กต์จาก array อื่น)
  const type = (pool === WATER) ? 'water' : (pool === SWEET ? 'sweet' : 'neutral');

  return {
    id: it.id,
    type,                // 'water' | 'sweet' | 'neutral'
    char: it.icon,
    life,
    mult,
    golden
  };
}

/* ------------------------------ Hit Logic (Rules) ------------------------------ */
/*
กฎ:
- ถ้า ST.level > safeMax (สูงเกิน):
    - water => bad
    - sweet => good
- ถ้า ST.level < safeMin (ต่ำ):
    - sweet => bad
    - water => good
- ถ้าอยู่ในโซนพอดี:
    - water => good
    - sweet => ok
- neutral => ok เสมอ
หมายเหตุ: เราปรับระดับน้ำก่อนตัดสินผล เพื่อสะท้อนผลจากการดื่มทันที
*/
export function onHit(meta={}, systems={}, gameState={}, hud=null){
  let res = 'ok';

  // ปรับระดับน้ำจากสิ่งที่ดื่ม
  if (meta.type === 'water') {
    ST.level = clamp(ST.level + 8, 0, 120);
  } else if (meta.type === 'sweet') {
    ST.level = clamp(ST.level + 4, 0, 120);
    ST.mq_lastWasSweet = true;  // รีเซ็ต quest เลี่ยงหวานใน tick ถัดไป
  } // neutral ไม่เปลี่ยน

  // ช่วงคะแนนคูณ (คูณจริงอยู่ที่ main.js)
  const inX2 = (performance.now() < ST.x2Until);

  // ตัดสินผลหลังอัปเดตระดับน้ำ
  if (ST.level > ST.safeMax){
    res = (meta.type==='water') ? 'bad' : (meta.type==='sweet' ? 'good' : 'ok');
  } else if (ST.level < ST.safeMin){
    res = (meta.type==='sweet') ? 'bad' : (meta.type==='water' ? 'good' : 'ok');
  } else {
    res = (meta.type==='water') ? 'good' : (meta.type==='sweet' ? 'ok' : 'ok');
  }

  // โค้ชพูด
  if (res==='good') systems.coach?.say?.(t('ดีมาก! ระดับน้ำกำลังดี', 'Nice! Hydration on track', ST.lang));
  if (res==='bad')  systems.coach?.say?.(t('ยังไม่เหมาะนะ', 'Not ideal yet', ST.lang));

  // แจ้งมิชชั่นผ่าน event (หาก engine ฟัง)
  try {
    systems.mission?.emit?.('hydration-hit', {
      type: meta.type, result: res, level: ST.level, inX2
    });
  } catch {}

  renderBar();
  return res; // 'good' | 'bad' | 'ok'
}

/* ------------------------------ Powers ------------------------------ */
export function getPowerDurations(){ return { x2:8, freeze:3, magnet:0 }; }
export const powers = {
  x2Target(){ ST.x2Until = performance.now() + 8000; },
  freezeTarget(){ /* main.js จะจัดการหยุด spawn ผ่าน state.freezeUntil */ },
  magnetNext(){ /* ไม่ใช้ในโหมดนี้ */ }
};

/* ------------------------------ HUD (Hydration bar) ------------------------------ */
function ensureHydroHUD(){
  ST.$wrap  = document.getElementById('hydroWrap');
  ST.$bar   = document.getElementById('hydroBar');
  ST.$label = document.getElementById('hydroLabel');

  // ถ้าไม่มี ให้สร้าง DOM อย่างง่าย ๆ เพื่อกันพัง
  if (!ST.$wrap) {
    const wrap = document.createElement('div');
    wrap.id = 'hydroWrap';
    wrap.style.cssText = 'position:fixed;left:12px;top:72px;width:220px;display:block;z-index:10;font:14px/1.2 system-ui,Segoe UI,Arial;';
    const label = document.createElement('div');
    label.id = 'hydroLabel';
    label.style.cssText = 'margin-bottom:6px;font-weight:600';
    const rail = document.createElement('div');
    rail.style.cssText = 'width:100%;height:12px;background:#1115;border-radius:8px;overflow:hidden;box-shadow:inset 0 0 0 1px #0007';
    const bar = document.createElement('div');
    bar.id = 'hydroBar';
    bar.style.cssText = 'height:100%;width:50%;background:#22c55e;border-radius:8px;transition:width .18s linear, box-shadow .18s linear;';
    rail.appendChild(bar);
    wrap.appendChild(label);
    wrap.appendChild(rail);
    document.body.appendChild(wrap);

    ST.$wrap = wrap; ST.$bar = bar; ST.$label = label;
  }
}

function renderBar(){
  if (!ST.$bar || !ST.$label) return;

  const pct = Math.max(0, Math.min(100, ST.level));
  ST.$bar.style.width = pct + '%';

  let color = '#22c55e', txt = t('พอดี', 'OK', ST.lang);
  let glow = '';
  if (ST.level > ST.safeMax){
    color = '#ef4444'; txt = t('สูงเกิน', 'Too High', ST.lang);
    glow = '0 0 18px rgba(239,68,68,.65), 0 0 6px rgba(239,68,68,.45)';
  } else if (ST.level < ST.safeMin){
    color = '#3b82f6'; txt = t('ต่ำ', 'Low', ST.lang);
    glow = '0 0 18px rgba(59,130,246,.65), 0 0 6px rgba(59,130,246,.45)';
  }
  ST.$bar.style.background = `linear-gradient(90deg, ${color}, ${shade(color, -12)})`;
  ST.$bar.style.boxShadow = glow;
  ST.$label.textContent = `${txt} (${pct|0})`;
}

/* ------------------------------ FX hooks ------------------------------ */
export const fx = {
  onSpawn(el/*, state*/){ try { FX.add3DTilt?.(el); } catch {} },
  onHit(x, y/*, meta, state*/){ try { FX.shatter3D?.(x, y); } catch {} }
};

/* ------------------------------ Utils ------------------------------ */
function t(th,en,lang){ return lang==='EN'?en:th; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function shade(hex, amt=-10){
  const c = hex.replace('#','');
  let r = parseInt(c.substring(0,2),16), g = parseInt(c.substring(2,4),16), b = parseInt(c.substring(4,6),16);
  r = Math.max(0,Math.min(255,r+amt)); g = Math.max(0,Math.min(255,g+amt)); b = Math.max(0,Math.min(255,b+amt));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
