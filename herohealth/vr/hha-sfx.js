// === /herohealth/vr/hha-sfx.js ===
// HHA SFX — PRODUCTION (oscillator, no mp3)
// - Safe rate-limit
// - Combo tiers 5/10/15/20/25/30
// - Listens to window event: 'hha:sfx'

(function(){
  'use strict';
  const ROOT = window;
  if(ROOT.HHA_SFX) return;

  let AC = null;
  let lastAt = 0;

  function ctx(){
    if(AC) return AC;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return null;
    AC = new Ctx();
    return AC;
  }

  function canPlay(){
    const now = Date.now();
    if(now - lastAt < 45) return false; // hard throttle
    lastAt = now;
    return true;
  }

  function beep(freq=440, dur=0.06, type='sine', gain=0.05){
    const ac = ctx();
    if(!ac) return;
    if(ac.state === 'suspended'){ ac.resume().catch(()=>{}); }
    if(!canPlay()) return;

    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;

    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ac.destination);

    const t0 = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function seq(list){
    let t = 0;
    for(const it of list){
      setTimeout(()=>beep(it.f, it.d, it.w, it.g), t);
      t += Math.max(12, Math.floor((it.d||0.06)*1000) + 12);
    }
  }

  function play(name, detail={}){
    name = String(name||'').toLowerCase();

    if(name === 'good')  return beep(680, 0.05, 'triangle', 0.045);
    if(name === 'bad')   return beep(150, 0.07, 'sawtooth', 0.060);
    if(name === 'miss')  return seq([{f:180,d:0.06,w:'sawtooth',g:0.06},{f:140,d:0.07,w:'sawtooth',g:0.06}]);
    if(name === 'block') return beep(420, 0.05, 'square', 0.040);

    if(name === 'star')   return seq([{f:880,d:0.05,w:'triangle',g:0.05},{f:1220,d:0.05,w:'triangle',g:0.05}]);
    if(name === 'shield') return seq([{f:520,d:0.05,w:'triangle',g:0.045},{f:620,d:0.06,w:'triangle',g:0.045}]);
    if(name === 'perfect')return seq([{f:980,d:0.05,w:'triangle',g:0.055},{f:1320,d:0.06,w:'triangle',g:0.055}]);

    if(name === 'combo5')  return beep(760, 0.06, 'triangle', 0.050);
    if(name === 'combo10') return seq([{f:760,d:0.05,w:'triangle',g:0.05},{f:1020,d:0.06,w:'triangle',g:0.05}]);
    if(name === 'combo15') return seq([{f:760,d:0.05,w:'triangle',g:0.05},{f:1020,d:0.05,w:'triangle',g:0.05},{f:1240,d:0.06,w:'triangle',g:0.05}]);
    if(name === 'combo20') return seq([{f:840,d:0.05,w:'square',g:0.05},{f:1080,d:0.05,w:'square',g:0.05},{f:1320,d:0.07,w:'square',g:0.05}]);

    // 🔥 extra tiers
    if(name === 'combo25') return seq([
      {f:900,d:0.05,w:'square',g:0.055},
      {f:1120,d:0.05,w:'square',g:0.055},
      {f:1400,d:0.08,w:'square',g:0.055},
    ]);

    if(name === 'combo30') return seq([
      {f:980,d:0.05,w:'sawtooth',g:0.055},
      {f:1220,d:0.05,w:'sawtooth',g:0.055},
      {f:1480,d:0.05,w:'sawtooth',g:0.055},
      {f:1760,d:0.09,w:'triangle',g:0.060},
    ]);

    if(name === 'grade'){
      const g = String(detail.grade||'').toUpperCase();
      if(g === 'SSS') return seq([{f:880,d:0.06,w:'triangle',g:0.06},{f:1180,d:0.06,w:'triangle',g:0.06},{f:1560,d:0.08,w:'triangle',g:0.06}]);
      if(g === 'SS')  return seq([{f:880,d:0.06,w:'triangle',g:0.055},{f:1180,d:0.08,w:'triangle',g:0.055}]);
      if(g === 'S')   return seq([{f:880,d:0.08,w:'triangle',g:0.05}]);
      return beep(520, 0.08, 'triangle', 0.045);
    }

    if(name === 'end') return beep(520, 0.08, 'triangle', 0.04);
    if(name === 'celebrate') return seq([{f:760,d:0.05,w:'triangle',g:0.05},{f:1020,d:0.05,w:'triangle',g:0.05}]);

    // fallback
    beep(520, 0.05, 'triangle', 0.035);
  }

  ROOT.HHA_SFX = { play };

  ROOT.addEventListener('hha:sfx', (ev)=>{
    const d = ev?.detail || {};
    play(d.name, d);
  }, { passive:true });

})();
