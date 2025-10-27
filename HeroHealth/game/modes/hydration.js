// === Hero Health Academy — modes/hydration.js (hydration bar + rules + mini-quests ready) ===
export const name = 'hydration';

// ไอคอน (น้ำเปล่า/น้ำหวาน/ไอเท็มกลาง ๆ)
const WATER = [
  { id:'water1', labelEN:'Water', labelTH:'น้ำเปล่า', icon:'💧' },
  { id:'water2', labelEN:'Water', labelTH:'น้ำเปล่า', icon:'🫗' },
];
const SWEET = [
  { id:'soda',   labelEN:'Soda',   labelTH:'น้ำอัดลม', icon:'🥤' },
  { id:'juice',  labelEN:'Juice',  labelTH:'น้ำผลไม้หวาน', icon:'🧃' },
];
const NEUTRAL = [
  { id:'ice', labelEN:'Ice', labelTH:'น้ำแข็ง', icon:'🧊' },
];

const ST = {
  lang:'TH',
  level: 50,        // 0..120 (เรา clamp 0..120)
  safeMin: 40,
  safeMax: 60,
  x2Until: 0,
  // HUD refs
  $wrap:null, $bar:null, $label:null
};

// โซนช่วยเหลือเควสต์
const zoneOf = (v, min, max)=> v>max ? 'HIGH' : v<min ? 'LOW' : 'OK';
let _lastZone = 'OK';

export function init(gameState, hud, diff){
  ST.lang = localStorage.getItem('hha_lang') || 'TH';
  ST.level = 50;
  ST.safeMin = 40;
  ST.safeMax = 60;

  ST.$wrap  = document.getElementById('hydroWrap');
  ST.$bar   = document.getElementById('hydroBar');
  ST.$label = document.getElementById('hydroLabel');

  if (ST.$wrap){ ST.$wrap.style.display = 'block'; }
  _lastZone = zoneOf(ST.level, ST.safeMin, ST.safeMax);
  renderBar();
}
export function cleanup(){
  if (ST.$wrap) ST.$wrap.style.display = 'none';
}
export function tick(){
  // อัปเดตสถานะโซนทุกวินาทีให้ Quests
  const z = zoneOf(ST.level, ST.safeMin, ST.safeMax);
  window.HHA_QUESTS?.event?.('hydro_tick', { level: ST.level, zone: z });
}

// สุ่มชิ้น: เน้นน้ำเปล่าเป็นหลัก (สนุกและมีเสี่ยง)
export function pickMeta(diff){
  const r = Math.random();
  const pool = r < 0.6 ? WATER : (r < 0.85 ? SWEET : NEUTRAL);
  const it = pool[(Math.random()*pool.length)|0];

  const golden = performance.now() < ST.x2Until;
  const mult = golden ? 2 : 1;

  const lifeBase = diff?.life || 3000;
  const life = Math.min(4500, Math.max(700, lifeBase));

  return {
    id: it.id,
    type: (WATER.includes(it)?'water':(SWEET.includes(it)?'sweet':'neutral')),
    char: it.icon,
    life,
    mult,
    golden
  };
}

// กฎ:
// - หากระดับน้ำ “สูงเกิน” (ST.level > safeMax):
//     - คลิกน้ำเปล่า => หักคะแนนและคอมโบ (bad)
//     - คลิกน้ำหวาน => ให้คะแนน และไม่หักคอมโบ (good)
// - หากระดับน้ำ “ต่ำ” (ST.level < safeMin):
//     - คลิกน้ำหวาน => หักคะแนนและคอมโบ (bad)
//     - คลิกน้ำเปล่า => ให้คะแนน (good)
// - หากอยู่ในโซนพอดี => น้ำเปล่าดี (good) น้ำหวาน ok
export function onHit(meta, systems, gameState, hud){
  let res = 'ok';
  const before = zoneOf(ST.level, ST.safeMin, ST.safeMax);

  if (meta.type==='water'){
    ST.level = clamp(ST.level + 8, 0, 120);
  }else if (meta.type==='sweet'){
    ST.level = clamp(ST.level + 4, 0, 120);
  }else{
    ST.level = clamp(ST.level + 0, 0, 120);
  }

  // แจ้งการคลิกให้เควสต์ (smart_sips / treat_time)
  window.HHA_QUESTS?.event?.('hydro_click', { zoneBefore: before, kind: meta.type });

  const after = zoneOf(ST.level, ST.safeMin, ST.safeMax);
  if (before !== after){
    window.HHA_QUESTS?.event?.('hydro_cross', { from: before, to: after });
    _lastZone = after;
  }

  if (ST.level > ST.safeMax){             // “สูงเกิน”
    if (meta.type==='water'){ res='bad'; }
    else if (meta.type==='sweet'){ res='good'; }
    else { res='ok'; }
  } else if (ST.level < ST.safeMin){      // “ต่ำ”
    if (meta.type==='sweet'){ res='bad'; }
    else if (meta.type==='water'){ res='good'; }
    else { res='ok'; }
  } else {                                // “พอดี”
    if (meta.type==='water'){ res='good'; }
    else if (meta.type==='sweet'){ res='ok'; }
    else { res='ok'; }
  }

  if (res==='good') systems.coach?.say?.(t('ดีมาก! ระดับน้ำกำลังดี', 'Nice! Hydration on track', ST.lang));
  if (res==='bad')  systems.coach?.say?.(t('ยังไม่เหมาะนะ', 'Not ideal yet', ST.lang));

  renderBar();
  return res;
}

// Power durations ให้สอดคล้อง UI (แม่เหล็กไม่ใช้ในโหมดนี้)
export function getPowerDurations(){ return { x2:8, freeze:3, magnet:0 }; }
export const powers = {
  x2Target(){ ST.x2Until = performance.now() + 8000; },
  freezeTarget(){ /* main.js จัดการหยุด spawn */ },
  magnetNext(){ /* ไม่ใช้ */ }
};

// ----- HUD: Hydration bar -----
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

// utils
function t(th,en,lang){ return lang==='EN'?en:th; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function shade(hex, amt=-10){
  const c = hex.replace('#','');
  let r = parseInt(c.substring(0,2),16), g = parseInt(c.substring(2,4),16), b = parseInt(c.substring(4,6),16);
  r = Math.max(0,Math.min(255,r+amt)); g = Math.max(0,Math.min(255,g+amt)); b = Math.max(0,Math.min(255,b+amt));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
import { add3DTilt, shatter3D } from '/webxr-health-mobile/HeroHealth/game/core/fx.js';

export const fx = {
  onSpawn(el/*, state*/){
    add3DTilt(el);
  },
  onHit(x, y/*, meta, state*/){
    shatter3D(x, y);
  }
};
