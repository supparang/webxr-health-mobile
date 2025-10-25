// game/modes/hydration.js
// โหมด: สมดุลน้ำ 💧 ช่วงเหมาะสม 45–65%

// ใช้ HUD เดิมจาก index.html: #hydroWrap, #hydroBar, #hydroLabel
// ไม่สร้าง DOM ใหม่ เพื่อเลี่ยงซ้ำและทำงานร่วมกับ hud.show/hide

export function init(state, hud, diff){
  state.ctx = state.ctx || {};
  // ใช้ตัวแปรใน ctx เพื่อไม่ชนกับโหมดอื่น
  state.ctx.hyd = 55;              // เริ่มที่ 55%
  state.ctx.hydMin = 45;           // ช่วงเหมาะสม
  state.ctx.hydMax = 65;

  // แสดง HUD น้ำ
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
  meta.life = diff?.life ?? 3000; // เคารพ TTL จาก diff
  return meta;
}

export function onHit(meta, sys, state, hud){
  const { score, sfx, fx } = sys || {};
  const ctx = state.ctx || {};
  const before = ctx.hyd ?? 55;

  // ปรับค่า hydration และ clamp 0–100
  ctx.hyd = Math.max(0, Math.min(100, before + (meta.effect||0)));
  updateBar(ctx.hyd);
  setHydroLabel(state.lang, ctx.hyd);

  // ให้คะแนน:
  // - ดื่มดี (บวก) ได้ +5 (+7 ถ้าหลังดื่มเข้าโซน 45–65)
  // - ดื่มไม่ดี (ลบ) ได้ -3 (-5 ถ้าหลังดื่มออกนอกโซน)
  const inZoneAfter = (ctx.hyd >= ctx.hydMin && ctx.hyd <= ctx.hydMax);
  if ((meta.effect||0) > 0){
    const add = inZoneAfter ? 7 : 5;
    score?.add?.(add);
    fx?.popText?.(`+${add}`, { color: inZoneAfter ? '#7fffd4' : '#bde0ff' });
    sfx?.good?.();
  }else{
    const add = inZoneAfter ? -3 : -5;
    score?.add?.(add);
    fx?.popText?.(`${add}`, { color:'#ff9b9b' });
    sfx?.bad?.();
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
  let color = '#4FC3F7';     // ปกติ
  if (p < 45) color = '#E53935';     // ต่ำไป = แดง
  else if (p > 65) color = '#FFB300';// สูงไป = เหลือง
  bar.style.background = color;
}

function setHydroLabel(lang='TH', val){
  const el = document.getElementById('hydroLabel');
  if (!el) return;
  const p = Math.round(val);
  const text = lang==='EN' ? `Hydration ${p}%` : `สมดุลน้ำ ${p}%`;
  el.textContent = text;
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
