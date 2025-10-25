// game/modes/hydration.js
// โหมด: สมดุลน้ำ 💧 ช่วงเหมาะสม 45–65%
// ใช้ HUD เดิมจาก index.html: #hydroWrap, #hydroBar, #hydroLabel
// onHit จะ return 'good' | 'ok' | 'bad' เพื่อให้ main.js จัดการคะแนน/คอมโบ/ฟีเวอร์

export function init(state, hud, diff){
  state.ctx = state.ctx || {};
  state.ctx.hyd    = 55;  // เริ่มที่ 55%
  state.ctx.hydMin = 45;  // ช่วงเหมาะสม
  state.ctx.hydMax = 65;

  // โชว์ HUD น้ำ (ใช้ของเดิม)
  try{ hud?.showHydration?.(); }catch{}
  updateBar(state.ctx.hyd);
  setHydroLabel(state.lang, state.ctx.hyd);
}

export function pickMeta(diff, state){
  // สุ่มเครื่องดื่ม (น้ำ/นม = บวก, น้ำหวาน/กาแฟ = ลบ)
  const drinks = [
    { char:'💧', effect:+10 }, // น้ำเปล่า
    { char:'🥛', effect:+8  }, // นม
    { char:'🥤', effect:-15 }, // น้ำหวาน/โซดา
    { char:'☕', effect:-10 }  // กาแฟเข้ม/หวาน
  ];
  const meta = drinks[(Math.random()*drinks.length)|0];
  meta.life = diff?.life ?? 3000; // TTL เคารพ diff
  return meta;
}

export function onHit(meta, sys, state, hud){
  const { sfx } = sys || {};
  const ctx = state.ctx || {};
  const before = ctx.hyd ?? 55;

  // ปรับ hydration และ clamp 0–100
  ctx.hyd = Math.max(0, Math.min(100, before + (meta.effect||0)));
  updateBar(ctx.hyd);
  setHydroLabel(state.lang, ctx.hyd);

  // ตัดสินผลลัพธ์ให้ระบบกลาง:
  // - ดื่มดี (effect>0): ถ้า "หลังดื่ม" อยู่ในโซน → 'good' ไม่งั้น 'ok'
  // - ดื่มแย่ (effect<=0): ถ้า "หลังดื่ม" ยังอยู่ในโซน → 'ok' ไม่งั้น 'bad'
  const inZoneAfter = (ctx.hyd >= ctx.hydMin && ctx.hyd <= ctx.hydMax);
  if ((meta.effect||0) > 0){
    try{ sfx?.good?.(); }catch{}
    return inZoneAfter ? 'good' : 'ok';
  } else {
    try{ sfx?.bad?.(); }catch{}
    return inZoneAfter ? 'ok' : 'bad';
  }
}

export function tick(state, sys, hud){
  // ลดช้า ๆ ตามเวลา
  const ctx = state.ctx || {};
  ctx.hyd = Math.max(0, (ctx.hyd ?? 55) - 0.4);
  updateBar(ctx.hyd);
  setHydroLabel(state.lang, ctx.hyd);
}

// ---------- Helpers ----------
function updateBar(val){
  const bar = document.getElementById('hydroBar');
  if (!bar) return;
  const p = Math.round(val);
  bar.style.width = p + '%';
  // สีตามระดับ
  let color = '#4FC3F7';          // ปกติ
  if (p < 45) color = '#E53935';  // ต่ำไป = แดง
  else if (p > 65) color = '#FFB300'; // สูงไป = เหลือง
  bar.style.background = color;
}

function setHydroLabel(lang='TH', val){
  const el = document.getElementById('hydroLabel');
  if (!el) return;
  const p = Math.round(val);
  el.textContent = (lang==='EN') ? `Hydration ${p}%` : `สมดุลน้ำ ${p}%`;
  const wrap = document.getElementById('hydroWrap');
  if (wrap) wrap.style.display = 'block';
}

// ทำความสะอาดเมื่อออกจากโหมด
export function cleanup(state, hud){
  try{ hud?.hideHydration?.(); }catch{}
  const bar = document.getElementById('hydroBar');
  const lb  = document.getElementById('hydroLabel');
  if (bar) bar.style.width = '0%';
  if (lb)  lb.textContent  = '—';
  if (state?.ctx){
    state.ctx.hyd = undefined;
    state.ctx.hydMin = undefined;
    state.ctx.hydMax = undefined;
  }
}
