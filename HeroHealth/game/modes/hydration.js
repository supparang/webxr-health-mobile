// === Hero Health Academy — game/modes/hydration.js (Hydration Bar + Flames) ===
// …(โค้ดเดิมของไฟล์นี้คงไว้ทั้งหมด)…
// แก้เฉพาะส่วน init() และ updateHydroBar()

export function init(gameState, hud, diff){
  ST.lang = localStorage.getItem('hha_lang') || 'TH';
  ST.difficulty = gameState?.difficulty || 'Normal';

  ST.level = 55;
  ST.lastZone = zoneOf(ST.level);
  ST.midStreakSec = 0;
  ST.needRecover = false;

  // แสดง HUD น้ำ
  const wrap = document.getElementById('hydroWrap');
  if (wrap) {
    wrap.style.display = 'block';
    wrap.classList.remove('hydro-low','hydro-mid','hydro-high');

    // ทำให้แท่งน้ำมีตำแหน่งตั้งต้น
    const barEl = wrap.querySelector('.bar');
    if (barEl) barEl.classList.add('hydroBarHost');

    // สร้างเปลวไฟครั้งเดียว (ซ่อนไว้ก่อน)
    if (!wrap.querySelector('.hydroFlame')){
      const flame = document.createElement('div');
      flame.className = 'hydroFlame';   // แค่สร้าง ทิ้งให้ CSS คุมการแสดงผล
      barEl?.appendChild(flame);
    }
  }

  updateHydroBar();

  // … ส่วนตั้งค่าเควสของไฟล์นี้ (เหมือนเดิม) …
}

function updateHydroBar(){
  const wrap = document.getElementById('hydroWrap');
  const bar = document.getElementById('hydroBar');
  const lab = document.getElementById('hydroLabel');
  if (!wrap || !bar) return;

  const lvl = Math.round(ST.level);
  const z = zoneOf(lvl);

  // ความกว้างแท่ง
  bar.style.width = `${lvl}%`;

  // สลับคลาสสถานะ
  wrap.classList.remove('hydro-low','hydro-mid','hydro-high');
  if (z===Z.LOW)  wrap.classList.add('hydro-low');
  if (z===Z.MID)  wrap.classList.add('hydro-mid');
  if (z===Z.HIGH) wrap.classList.add('hydro-high');

  // ป้ายข้อความ
  if (lab){
    if (ST.lang==='EN'){
      lab.textContent = z===Z.LOW?'Low': z===Z.MID?'Optimal':'High';
    }else{
      lab.textContent = z===Z.LOW?'ต่ำ': z===Z.MID?'พอดี':'สูง';
    }
  }
}
