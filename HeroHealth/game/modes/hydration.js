// game/modes/hydration.js
// ระบบโหมดสมดุลน้ำ 💧 45–65%

export function init(state, hud, diff) {
  // สร้าง hydration bar ถ้ายังไม่มี
  let wrap = document.getElementById('hydrationWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'hydrationWrap';
    wrap.style.position = 'fixed';
    wrap.style.top = '12px';
    wrap.style.right = '12px';
    wrap.style.width = '200px';
    wrap.style.height = '20px';
    wrap.style.background = 'rgba(255,255,255,0.15)';
    wrap.style.border = '1px solid rgba(255,255,255,0.3)';
    wrap.style.borderRadius = '10px';
    wrap.style.zIndex = '150';
    wrap.innerHTML = `
      <div id="hydrationBar" style="
        width:55%;
        height:100%;
        background:linear-gradient(90deg,#4FC3F7,#0288D1);
        border-radius:10px;
        transition:width .25s;
      "></div>
      <div id="hydrationLabel" style="
        position:absolute;left:0;right:0;top:0;bottom:0;
        text-align:center;font-weight:900;font-size:14px;
        line-height:20px;color:white;text-shadow:0 1px 4px #000;
      ">💧 55%</div>
    `;
    document.body.appendChild(wrap);
  }

  state.hydration = 55;
  updateBar(state.hydration);
}

export function pickMeta(diff, state) {
  // สุ่มเครื่องดื่ม: น้ำ / น้ำหวาน / กาแฟ
  const drinks = [
    { char: '💧', effect: +10 },
    { char: '🥤', effect: -15 },
    { char: '☕', effect: -10 },
    { char: '🥛', effect: +8 }
  ];
  const meta = drinks[Math.floor(Math.random() * drinks.length)];
  meta.life = diff.life;
  return meta;
}

export function onHit(meta, sys, state) {
  const { score, sfx } = sys;
  const wrap = document.getElementById('hydrationWrap');
  if (!wrap) return;

  // ปรับ hydration ตาม effect
  state.hydration = Math.max(0, Math.min(100, state.hydration + meta.effect));
  updateBar(state.hydration);

  // เงื่อนไขคะแนนตาม hydration
  if (meta.char === '🥤') {
    if (state.hydration > 65) score.add(10);
    else if (state.hydration < 45) score.add(-10);
    else score.add(-2);
  } else {
    score.add(5);
  }

  sfx.good();
}

export function tick(state, sys) {
  // ค่อยๆ ลด hydration ทุกวินาทีเล็กน้อย
  state.hydration = Math.max(0, state.hydration - 0.4);
  updateBar(state.hydration);
}

// helper
function updateBar(val) {
  const bar = document.getElementById('hydrationBar');
  const label = document.getElementById('hydrationLabel');
  if (!bar || !label) return;

  const percent = Math.round(val);
  bar.style.width = percent + '%';

  // สีตามระดับน้ำ
  let color = '#4FC3F7';
  if (percent < 45) color = '#E53935';
  else if (percent > 65) color = '#FFB300';
  bar.style.background = color;

  label.textContent = `💧 ${percent}%`;
}
