// === sfx.js — minimal safe SFX (2025-11-07) ===
export class SFX{
  constructor(base){ this.base = base || ''; this.enabled = true; }
  unlock(){ /* noop for compatibility */ }
  attachPageVisibilityAutoMute(){
    var self=this;
    document.addEventListener('visibilitychange', function(){
      self.enabled = !document.hidden;
    });
  }
  playCoach(name){ /* noop */ }
  popGood(){ /* could play small click */ }
  popBad(){ /* could play buzz */ }
}