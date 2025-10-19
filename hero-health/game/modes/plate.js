export const name='จัดจานสุขภาพ';

const G={
  grains:["🍞","🍚","🥖","🥨"],
  protein:["🍗","🥚","🫘","🐟"],
  veggies:["🥦","🥕","🥬","🍅"],
  fruits:["🍎","🍌","🍇","🍊"],
  dairy:["🥛","🧀"]
};
const ORDER=['grains','veggies','protein','fruits','dairy'];
const ICON=k=> k==='grains'?'🍞':k==='protein'?'🍗':k==='veggies'?'🥦':k==='fruits'?'🍎':'🥛';

export function init(state, hud, diff){
  const base={grains:2, veggies:(diff==='Hard'?3:2), protein:1, fruits:1, dairy:1};
  state.plateTarget={...base};
  state.plateQuota={...base};
  render(hud,state);
}

function render(hud, state){
  const q=state.plateQuota||{}, t=state.plateTarget||{};
  const html=ORDER.map(k=>{
    const need=t[k]||0;
    const left=q[k]||0;
    const have=Math.max(0,need-left);
    const done=left<=0;
    return `<span class="pill ${done?'done':''}" title="${k}">
      <span>${ICON(k)}</span><span>${have}</span>/<span>${need}</span>
    </span>`;
  }).join('');
  hud.setPills(html);
}

export function pickMeta(diff){
  const g=ORDER[Math.floor(Math.random()*ORDER.length)];
  const arr=G[g];
  return {type:'plate', group:g, char: arr[Math.floor(Math.random()*arr.length)]};
}

export function onHit(meta, systems, state, hud){
  if(!state.plateQuota) return;

  // รีเซ็ต flag ผลลัพธ์ครั้งก่อน
  state.__plateLast = null;

  // ยังไม่ครบโควตา → ให้แต้มปกติ
  if(state.plateQuota[meta.group] > 0){
    state.plateQuota[meta.group] -= 1;
    render(hud,state);

    systems.score.add(6);
    systems.score.good();
    systems.fever.onGood();
    systems.fx.ding();

    state.ctx.plateFills++;
    state.ctx.currentStreak++;
    state.ctx.bestStreak=Math.max(state.ctx.bestStreak, state.ctx.currentStreak);

    // ครบทั้งจาน → โบนัส +14 และรีเฟรชโควตา
    if(Object.values(state.plateQuota).every(v=>v<=0)){
      systems.score.add(14);
      state.ctx.perfectPlates=(state.ctx.perfectPlates||0)+1;
      try{ document.getElementById('sfx-perfect').currentTime=0; document.getElementById('sfx-perfect').play(); }catch{}
      init(state, hud, 'Normal');
    }
    return;
  }

  // ==== เกินโควตา → บทลงโทษ ====
  // -2 คะแนน, คอมโบแตก, เวลา -1s, เสียงเตือน
  systems.score.add(-2);
  systems.score.bad();
  systems.fever.onBad();
  systems.fx.thud();
  state.ctx.currentStreak = 0;
  state.timeLeft = Math.max(0, (state.timeLeft||0) - 1);

  // ตั้ง flag สำหรับ HUD/เอฟเฟกต์ลอย (ให้ main.js อ่านไปแสดง −2)
  state.__plateLast = { overfill:true, delta:-2 };

  // ไม่ต้อง render ใหม่เพราะโควตาไม่เปลี่ยน
}
