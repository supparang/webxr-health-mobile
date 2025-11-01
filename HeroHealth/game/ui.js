// === Hero Health Academy — game/ui.js (2025-11-01; audio unlock + sound toggle persist) ===
function once(el, ev, fn) {
  const h = (e) => { el.removeEventListener(ev, h); fn(e); };
  el.addEventListener(ev, h, { passive: true });
}

// ---------- Map Audio Elements ----------
const bgm = document.getElementById('bgm-main');
const snd = {
  good: document.getElementById('sfx-good'),
  bad: document.getElementById('sfx-bad'),
  perfect: document.getElementById('sfx-perfect'),
  tick: document.getElementById('sfx-tick'),
  power: document.getElementById('sfx-powerup'),
};

// ---------- Optional: set your actual sound file paths ----------
if (bgm) bgm.src = 'assets/sfx/bgm.mp3';
if (snd.good) snd.good.src = 'assets/sfx/good.mp3';
if (snd.bad) snd.bad.src = 'assets/sfx/bad.mp3';
if (snd.perfect) snd.perfect.src = 'assets/sfx/perfect.mp3';
if (snd.tick) snd.tick.src = 'assets/sfx/tick.mp3';
if (snd.power) snd.power.src = 'assets/sfx/powerup.mp3';

// ---------- Unlock audio playback after user gesture ----------
function unlockAudio() {
  try { bgm?.play?.().then(()=>bgm?.pause?.()).catch(()=>{}); } catch {}
  Object.values(snd).forEach(a=>{
    try { a?.play?.().then(()=>{ a.pause(); a.currentTime=0; }).catch(()=>{}); } catch {}
  });
  console.log('[HHA UI] audio unlocked');
}

once(window, 'pointerdown', unlockAudio);
once(window, 'keydown', unlockAudio);
once(window, 'touchstart', unlockAudio);

// ---------- Sound toggle button ----------
const btn = document.getElementById('soundToggle');
if (btn) {
  // โหลดสถานะเสียงจาก localStorage
  let muted = (localStorage.getItem('hha_mute') === '1');
  [bgm, ...Object.values(snd)].forEach(a=>{ if(a) a.muted = muted; });
  btn.textContent = muted ? '🔇' : '🔊';

  btn.addEventListener('click', (e)=>{
    muted = !muted;
    [bgm, ...Object.values(snd)].forEach(a=>{ if(a) a.muted = muted; });
    localStorage.setItem('hha_mute', muted ? '1' : '0');
    e.currentTarget.textContent = muted ? '🔇' : '🔊';
  });
}
