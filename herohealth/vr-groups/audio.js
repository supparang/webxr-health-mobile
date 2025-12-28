/* === /herohealth/vr-groups/audio.js ===
Simple WebAudio SFX:
- hit good: higher blip
- hit bad / miss: lower buzz
- last 5 sec tick
*/

(function(root){
  'use strict';
  const doc = root.document;
  if (!doc) return;

  let AC = null;
  function ctx(){
    if (AC) return AC;
    const A = root.AudioContext || root.webkitAudioContext;
    if (!A) return null;
    AC = new A();
    return AC;
  }

  function beep(freq, durMs, type, gain){
    const ac = ctx();
    if (!ac) return;
    try{
      if (ac.state === 'suspended') ac.resume().catch(()=>{});
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = gain || 0.05;

      o.connect(g);
      g.connect(ac.destination);

      const t0 = ac.currentTime;
      const t1 = t0 + (durMs/1000);
      g.gain.setValueAtTime(g.gain.value, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t1);

      o.start(t0);
      o.stop(t1);
    }catch{}
  }

  function tick(){
    beep(1150, 70, 'square', 0.03);
  }
  function good(){
    beep(980, 90, 'sine', 0.06);
    setTimeout(()=>beep(1320, 70, 'sine', 0.04), 40);
  }
  function bad(){
    beep(220, 140, 'sawtooth', 0.05);
  }

  // unlock on first user gesture
  function unlock(){
    const ac = ctx();
    if (ac && ac.state === 'suspended') ac.resume().catch(()=>{});
    doc.removeEventListener('pointerdown', unlock);
    doc.removeEventListener('touchstart', unlock);
  }
  doc.addEventListener('pointerdown', unlock, { passive:true });
  doc.addEventListener('touchstart', unlock, { passive:true });

  root.addEventListener('groups:progress', (e)=>{
    const d = e.detail || {};
    if (d.type === 'hit'){
      d.correct ? good() : bad();
    }
  });

  root.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    if (d.kind === 'MISS') bad();
  });

  // tick last 5 seconds
  root.addEventListener('hha:time', (e)=>{
    const d = e.detail || {};
    const left = Number(d.left ?? 0);
    if (left > 0 && left <= 5) tick();
  });

})(typeof window !== 'undefined' ? window : globalThis);