// === vr/fever.js — simple fever meter + HUD events ===
export function createFever(opts={}){
  let lvl = 0;            // 0..100
  let on = false;
  const gainGood   = opts.gainGood ?? 9;   // แต้มเพิ่มต่อ 1 hit ดี
  const gainStar   = opts.gainStar ?? 15;
  const decayIdle  = opts.decayIdle ?? 10; // ลดต่อวินาทีเมื่อไม่ได้กด
  const durationMs = opts.durationMs ?? 6500;

  function emit(state, level){ 
    window.dispatchEvent(new CustomEvent('hha:fever',{ detail:{ state, level } }));
  }
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

  function add(n){
    if (on) return;
    lvl = clamp(lvl + n, 0, 100);
    emit('change', lvl);
    if (lvl >= 100){
      on = true;
      emit('start', 100);
      setTimeout(()=>{ on=false; lvl=0; emit('end', 0); }, durationMs);
    }
  }
  function tickIdle(){ if (!on){ lvl = clamp(lvl - decayIdle, 0, 100); emit('change', lvl); } }

  return {
    isOn(){ return on; },
    addGood(){ add(gainGood); },
    addStar(){ add(gainStar); },
    addDiamond(){ add(gainStar+5); },
    idleSecond(){ tickIdle(); },
  };
}
export default { createFever };