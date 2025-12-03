// === /herohealth/vr-groups/fx.js ===
// Food Groups VR — Visual FX (2025-12-04)
// เอฟเฟกต์เป้าแตก + คะแนนเด้ง เหมือน GoodJunk

'use strict';

window.GAME_MODULES = window.GAME_MODULES || {};
const ns = window.GAME_MODULES;

const FX = {
  host: null
};

// -------------------------------------------
// สร้าง container สำหรับ FX ทั้งหมด
// -------------------------------------------
function ensureHost() {
  if (FX.host && FX.host.isConnected) return FX.host;

  const div = document.createElement('div');
  div.id = 'fg-fx-host';
  div.style.position = 'fixed';
  div.style.left = '0';
  div.style.top = '0';
  div.style.width = '100vw';
  div.style.height = '100vh';
  div.style.pointerEvents = 'none';
  div.style.zIndex = '700';
  document.body.appendChild(div);

  FX.host = div;
  return div;
}

// -------------------------------------------
// ฟังก์ชันระเบิดแตกกระจาย (particle)
// -------------------------------------------
function spawnBurst(x, y, color = '#34d399') {
  const host = ensureHost();
  const n = 12;

  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'fg-frag';
    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = '6px';
    el.style.height = '6px';
    el.style.borderRadius = '50%';
    el.style.background = color;
    el.style.opacity = '0.9';

    const ang = (i / n) * Math.PI * 2;
    const dist = 40 + Math.random() * 25;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist;

    el.animate([
      { transform: `translate(0,0) scale(1)`, opacity: 0.9 },
      { transform: `translate(${dx}px,${dy}px) scale(0.2)`, opacity: 0 }
    ], {
      duration: 450,
      easing: 'ease-out',
      fill: 'forwards'
    });

    host.appendChild(el);
    setTimeout(() => el.remove(), 500);
  }
}

// -------------------------------------------
// คะแนนเด้งลอยขึ้น (Perfect / Good / Miss)
// -------------------------------------------
function spawnScoreText(x, y, text = '+1', color = '#ffffff') {
  const host = ensureHost();

  const el = document.createElement('div');
  el.className = 'fg-score-fx';
  el.textContent = text;
  el.style.position = 'absolute';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.fontSize = '20px';
  el.style.fontWeight = '700';
  el.style.color = color;
  el.style.textShadow = '0 0 6px rgba(255,255,255,0.8)';
  el.style.opacity = '1';

  const anim = el.animate([
    { transform: 'translate(-50%,-20px)', opacity: 1 },
    { transform: 'translate(-50%,-60px)', opacity: 0 }
  ], {
    duration: 700,
    easing: 'ease-out',
    fill: 'forwards'
  });

  host.appendChild(el);
  anim.onfinish = () => el.remove();
}

// -------------------------------------------
// API หลัก: ยิงเอฟเฟกต์ที่ตำแหน่ง DOM (2D)
// -------------------------------------------
function hitEffect(domX, domY, isGood) {
  const color = isGood ? '#4ade80' : '#f87171';
  spawnBurst(domX, domY, color);
  spawnScoreText(domX, domY, isGood ? '+1' : '-1', color);
}

// -------------------------------------------
// miss effect
// -------------------------------------------
function missEffect(domX, domY) {
  spawnScoreText(domX, domY, 'MISS', '#f97316');
}

// -------------------------------------------
// ส่งออก API
// -------------------------------------------
ns.foodGroupsFX = {
  hitEffect,
  missEffect,
  spawnBurst,
  spawnScoreText
};