// === game/ui.js (audio unlock & small toggles)
function once(el, ev, fn){ const h=(e)=>{ el.removeEventListener(ev,h); fn(e); }; el.addEventListener(ev,h); }

const bgm = document.getElementById('bgm-main');
const snd = {
  good: document.getElementById('sfx-good'),
  bad: document.getElementById('sfx-bad'),
  perfect: document.getElementById('sfx-perfect'),
  tick: document.getElementById('sfx-tick'),
  power: document.getElementById('sfx-powerup'),
};

// ใส่ไฟล์จริงของคุณที่นี่
if (bgm) bgm.src = '';
if (snd.good) snd.good.src = '';
if (snd.bad) snd.bad.src = '';
if (snd.perfect) snd.perfect.src = '';
if (snd.tick) snd.tick.src = '';

function unlockAudio(){
  try{ bgm?.play?.().then(()=>bgm?.pause?.()); }catch{}
  Object.values(snd).forEach(a=>{ try{ a?.play?.().then(()=>a?.pause?.()); }catch{} });
}
once(window,'pointerdown', unlockAudio);
once(window,'keydown',     unlockAudio);

// sound toggle
document.getElementById('soundToggle')?.addEventListener('click', (e)=>{
  const muted = !bgm.muted; [bgm, ...Object.values(snd)].forEach(a=>{ if(a) a.muted=muted; });
  e.currentTarget.textContent = muted ? '🔊' : '🔇';
});
