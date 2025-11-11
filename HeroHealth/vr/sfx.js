// minimal safe SFX (เงียบไว้ก่อน — พร้อมต่อยอด)
export class SFX{
  constructor(base){ this.base = base || ''; this.enabled = true; }
  unlock(){ /* noop for compatibility */ }
  attachPageVisibilityAutoMute(){
    var self=this;
    document.addEventListener('visibilitychange', function(){
      self.enabled = !document.hidden;
    });
  }
  playCoach(_name){ /* noop */ }
  popGood(){ /* noop */ }
  popBad(){ /* noop */ }
}
export default { SFX };