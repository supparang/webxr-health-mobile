// === /herohealth/hygiene-vr/hygiene.sfx.js ===
// Tiny SFX (no external assets) using WebAudio
// Exposes: window.HHA_SFX.play(name, opts)

'use strict';

(function(){
  const WIN = window;

  function make(){
    let ctx = null;

    function getCtx(){
      if(ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      ctx = new AC();
      return ctx;
    }

    function beep({ freq=440, dur=0.06, type='sine', gain=0.08 } = {}){
      const c = getCtx();
      if(!c) return;
      const t0 = c.currentTime;

      const o = c.createOscillator();
      const g = c.createGain();

      o.type = type;
      o.frequency.setValueAtTime(freq, t0);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      o.connect(g);
      g.connect(c.destination);

      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }

    function noise({ dur=0.08, gain=0.05 } = {}){
      const c = getCtx();
      if(!c) return;
      const rate = c.sampleRate;
      const len = Math.floor(rate * dur);
      const buf = c.createBuffer(1, len, rate);
      const data = buf.getChannelData(0);
      for(let i=0;i<len;i++){
        data[i] = (Math.random()*2-1) * (1 - i/len);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(c.destination);
      src.start();
    }

    function play(name, opts={}){
      const n = String(name||'').toLowerCase();
      // attempt resume (mobile) on first play
      try{ const c = getCtx(); if(c && c.state==='suspended') c.resume(); }catch{}

      if(n==='beat'){
        beep({ freq: 180, dur: 0.03, type:'sine', gain:0.05 });
        return;
      }
      if(n==='good'){
        beep({ freq: 660, dur: 0.05, type:'triangle', gain:0.08 });
        return;
      }
      if(n==='perfect'){
        beep({ freq: 880, dur: 0.045, type:'triangle', gain:0.10 });
        beep({ freq: 1200, dur: 0.05, type:'sine', gain:0.06 });
        return;
      }
      if(n==='wrong'){
        beep({ freq: 220, dur: 0.08, type:'square', gain:0.06 });
        return;
      }
      if(n==='haz'){
        noise({ dur: 0.08, gain:0.06 });
        beep({ freq: 140, dur: 0.10, type:'sawtooth', gain:0.04 });
        return;
      }
      if(n==='boss_enter'){
        beep({ freq: 280, dur: 0.09, type:'sawtooth', gain:0.06 });
        beep({ freq: 220, dur: 0.12, type:'square', gain:0.05 });
        return;
      }
      if(n==='boss_hit'){
        beep({ freq: 520, dur: 0.06, type:'sawtooth', gain:0.07 });
        return;
      }
      if(n==='boss_clear'){
        beep({ freq: 740, dur: 0.05, type:'triangle', gain:0.09 });
        beep({ freq: 980, dur: 0.06, type:'triangle', gain:0.08 });
        beep({ freq: 1240, dur: 0.06, type:'sine', gain:0.06 });
        return;
      }
      if(n==='miniboss'){
        beep({ freq: 360, dur: 0.07, type:'sawtooth', gain:0.06 });
        return;
      }
      if(n==='reward'){
        beep({ freq: 900, dur: 0.04, type:'sine', gain:0.08 });
        beep({ freq: 1100, dur: 0.05, type:'sine', gain:0.07 });
        return;
      }
    }

    return { play };
  }

  WIN.HHA_SFX = WIN.HHA_SFX || make();
})();