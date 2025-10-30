// === Hero Health Academy — game/ui.js (audio unlock + mute toggle, 2025-10-30) ===
function once(el, ev, fn){
  const h=(e)=>{ el.removeEventListener(ev,h); fn(e); };
  el.addEventListener(ev,h,{passive:true});
}

// ---------- Audio Elements ----------
const bgm = document.getElementById('bgm-main');
const snd = {
  good:    document.getElementById('sfx-good'),
  bad:     document.getElementById('sfx-bad'),
  perfect: document.getElementById('sfx-perfect'),
  tick:    document.getElementById('sfx-tick'),
  power:   document.getElementById('sfx-powerup'),
};

// ---------- ใส่ไฟล์เสียงจริงของคุณที่นี่ ----------
if (bgm)         bgm.src        = './assets/audio/bgm_main.mp3';
if (snd.good)    snd.good.src   = './assets/audio/sfx_good.wav';
if (snd.bad)     snd.bad.src    = './assets/audio/sfx_bad.wav';
if (snd.perfect) snd.perfect.src= './assets/audio/sfx_perfect.wav';
if (snd.tick)    snd.tick.src   = './assets/audio/sfx_tick.wav';
if (snd.power)   snd.power.src  = './assets/audio/sfx_powerup.wav';

// ---------- Unlock Audio (mobile policy) ----------
let _audioUnlocked = false;
function unlockAudio(){
  if (_audioUnlocked) return;
  _audioUnlocked = true;

  try { bgm?.play?.().then(()=>bgm?.pause?.()); } catch{}
  Object.values(snd).forEach(a=>{
    try { a?.play?.().then(()=>a?.pause?.()); } catch{}
  });
  console.log('[audio] unlocked');
}

once(window,'pointerdown', unlockAudio);
once(window,'keydown', unlockAudio);

// ---------- Mute / Unmute toggle ----------
document.getElementById('soundToggle')?.addEventListener('click',(e)=>{
  const btn = e.currentTarget;
  const newMuted = !bgm?.muted;
  [bgm, ...Object.values(snd)].forEach(a=>{ if(a) a.muted=newMuted; });
  btn.textContent = newMuted ? '🔇' : '🔊';
  console.log(`[audio] ${newMuted?'muted':'unmuted'}`);
});

// ---------- Optional: Auto BGM Play when Start ----------
window.addEventListener('game:start', ()=>{
  try{ bgm?.currentTime=0; bgm?.play?.(); }catch{}
});
window.addEventListener('game:end', ()=>{
  try{ bgm?.pause?.(); }catch{}
});
