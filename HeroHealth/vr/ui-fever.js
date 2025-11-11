// === /HeroHealth/vr/ui-fever.js (2025-11-10 Flame Edition) ===
// HUD: Fever bar + Shield + Flame overlay (DOM-only, no THREE)

function $(s){ return document.querySelector(s); }

let flameRoot = null;
let cssInjected = false;

function injectCSS(){
  if (cssInjected) return;
  cssInjected = true;
  const st = document.createElement('style');
  st.id = 'fever-css';
  st.textContent = `
    #feverWrap{ position:fixed; left:50%; top:56px; transform:translateX(-50%);
      width:min(540px,86vw); height:12px; background:#0b1222;
      border:1px solid #334155; border-radius:999px; overflow:hidden; z-index:910 }
    #feverFill{ height:100%; width:0%;
      transition:width .15s ease-out;
      background:linear-gradient(90deg,#37d67a,#06d6a0) }

    #shieldChip{ position:fixed; right:16px; top:16px; background:#0f172acc;
      border:1px solid #334155; border-radius:12px; padding:8px 12px;
      font-weight:800; color:#e8eefc; z-index:910 }

    /* Flame overlay (absolute, pointer-events:none) */
    #feverFlame{
      position:fixed; left:50%; top:52px; transform:translateX(-50%);
      width:min(560px,90vw); height:36px; pointer-events:none; z-index:909; opacity:0;
      filter:drop-shadow(0 4px 12px rgba(255,140,0,.55));
      transition:opacity .18s ease;
    }
    #feverFlame .fl{
      position:absolute; bottom:0; width:18px; height:26px; border-radius:12px 12px 8px 8px;
      background:radial-gradient(ellipse at 50% 70%, #ffd166 0%, #ff7a00 55%, rgba(255,0,0,.75) 100%);
      transform-origin:50% 100%;
      animation:flameUp var(--flDur,900ms) ease-in infinite;
      mix-blend-mode:screen; opacity:.88;
      will-change:transform, opacity, filter;
    }
    @keyframes flameUp{
      0%   { transform:translateY(0) scale(1) rotate(var(--flRot,0deg)); opacity:.95; }
      70%  { opacity:.8; }
      100% { transform:translateY(-22px) scale(1.1) rotate(calc(var(--flRot,0deg) + 4deg)); opacity:0; }
    }

    /* Sparks (tiny dots) */
    #feverFlame .sp{
      position:absolute; bottom:6px; width:4px; height:4px; border-radius:999px;
      background:linear-gradient(90deg,#fff2,#ffe6); opacity:.9;
      animation:sparkUp 900ms ease-out infinite;
    }
    @keyframes sparkUp{
      0%   { transform:translateY(0) scale(1); opacity:.95; }
      100% { transform:translateY(-26px) scale(0.6); opacity:0; }
    }

    /* Glow when fever active (wrap + score pill ถ้ามี) */
    .fever-on{ box-shadow:0 0 0 3px #ffd16655, 0 0 22px #ffb703aa; }
  `;
  document.head.appendChild(st);
}

export function ensureFeverBar(){
  injectCSS();

  let wrap = $('#feverWrap');
  if (!wrap){
    wrap = document.createElement('div');
    wrap.id = 'feverWrap';
    const fill = document.createElement('div');
    fill.id = 'feverFill';
    wrap.appendChild(fill);
    document.body.appendChild(wrap);
  }

  if (!$('#shieldChip')){
    const chip = document.createElement('div');
    chip.id = 'shieldChip';
    chip.textContent = '🛡️ x0';
    document.body.appendChild(chip);
  }

  // Flame root
  if (!$('#feverFlame')){
    flameRoot = document.createElement('div');
    flameRoot.id = 'feverFlame';
    document.body.appendChild(flameRoot);
    buildFlameChildren(); // initial populate
  } else {
    flameRoot = $('#feverFlame');
  }
  return wrap;
}

function buildFlameChildren(){
  if (!flameRoot) return;
  flameRoot.innerHTML = '';
  const W = flameRoot.getBoundingClientRect().width || 520;
  const cols = Math.max(10, Math.floor(W / 28)); // จำนวนเปลวไฟแนวนอน

  for (let i=0;i<cols;i++){
    const x = (i+0.5) * (W/cols);
    // fire core
    const fl = document.createElement('div');
    fl.className = 'fl';
    fl.style.left = (x - 9) + 'px';
    fl.style.setProperty('--flRot', ((Math.random()*10)-5)+'deg');
    fl.style.setProperty('--flDur', (800 + Math.random()*300)+'ms');
    flameRoot.appendChild(fl);

    // spark (บางจุด)
    if (Math.random() < 0.6){
      const sp = document.createElement('div');
      sp.className = 'sp';
      sp.style.left = (x - 2) + 'px';
      sp.style.animationDuration = (600 + Math.random()*500)+'ms';
      flameRoot.appendChild(sp);
    }
  }
}

/** 0..100 */
export function setFever(pct){
  ensureFeverBar();
  const p = Math.max(0, Math.min(100, Math.round(pct||0)));
  const fill = $('#feverFill'); if (fill) fill.style.width = p + '%';

  // ความแรงของไฟ: map เป็น opacity + พารามิเตอร์ไฟ
  if (flameRoot){
    const alpha = p <= 0 ? 0 : (p < 100 ? (0.25 + p/150) : 1);
    flameRoot.style.opacity = String(alpha);
    // เพิ่ม/ลดความเร็วด้วยการปรับ --flDur บางส่วน (คร่าว ๆ)
    flameRoot.querySelectorAll('.fl').forEach(el=>{
      const base = 900 - p*3; // มากขึ้น → เร็วขึ้น
      el.style.setProperty('--flDur', Math.max(500, base) + 'ms');
    });
  }
}

export function setShield(n){
  ensureFeverBar();
  const chip = $('#shieldChip'); if (!chip) return;
  chip.textContent = '🛡️ x' + (n|0);
  chip.style.opacity = n>0 ? '1' : '.55';
}

/** เปิด/ปิดภาวะ Fever (glow + ไฟลุก) */
export function setFeverActive(on){
  ensureFeverBar();
  const scorePill = $('#score');
  const wrap = $('#feverWrap');
  const flame = $('#feverFlame');
  if (on){
    if (wrap) wrap.classList.add('fever-on');
    if (scorePill) scorePill.classList.add('fever-on');
    if (flame){ flame.style.opacity = '1'; }
  }else{
    if (wrap) wrap.classList.remove('fever-on');
    if (scorePill) scorePill.classList.remove('fever-on');
    if (flame){
      // ไม่ดับทันที ให้ลดตามค่าเฟเวอร์ที่ setFever() คุมอยู่
      // ถ้าอยากปิดทันที ให้ตั้ง opacity=0 ตรงนี้ได้
    }
  }
}

// alias (ตามที่โหมดบางไฟล์เรียก)
export const setFlame = setFeverActive;

export default { ensureFeverBar, setFever, setFeverActive, setFlame, setShield };
