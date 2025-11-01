// === core/sfx.js ===
// ควบคุมเสียงผ่าน <audio id="..."> บนหน้า index.html
function el(id){ return document.getElementById(id); }

export class SFX {
  constructor(){
    this.enabled = true;
    this.map = {
      good:    el('sfx-good'),
      bad:     el('sfx-bad'),
      perfect: el('sfx-perfect'),
      tick:    el('sfx-tick'),
      powerup: el('sfx-powerup'),
    };
  }
  setEnabled(v){
    this.enabled = !!v;
    const muted = !this.enabled;
    Object.values(this.map).forEach(a=>{ try{ if(a) a.muted = muted; }catch{} });
  }
  isEnabled(){ return !!this.enabled; }
  _play(key){
    if (!this.enabled) return;
    const a = this.map[key];
    try{
      if (!a) return;
      a.currentTime = 0;
      a.play();
    }catch{}
  }
  play(key){ this._play(key); }
  good(){ this._play('good'); }
  bad(){ this._play('bad'); }
  perfect(){ this._play('perfect'); }
  tick(){ this._play('tick'); }
  power(){ this._play('powerup'); }
}
export default SFX;
