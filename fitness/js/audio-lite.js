// === /fitness/js/audio-lite.js ===
// AudioLite: tiny beep/click using WebAudio (optional)
// Safe: if blocked by autoplay, it silently fails until user interaction.

'use strict';

export class AudioLite{
  constructor(){
    this.ctx = null;
    this.enabled = true;
    this.unlocked = false;

    const unlock = ()=>{ this.unlock(); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock, { passive:true });
  }

  unlock(){
    if (!this.enabled) return;
    try{
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.unlocked = true;
    }catch(_){}
  }

  blip(freq=440, ms=70, gain=0.045){
    if (!this.enabled) return;
    try{
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms/1000);

      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + ms/1000 + 0.02);
    }catch(_){}
  }
}