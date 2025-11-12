// === /HeroHealth/vr/hub.js (2025-11-12 stable) ===
console.log('[Hub] initializing');

export class GameHub{
  constructor(){
    const p = new URLSearchParams(location.search);
    this.mode = (p.get('mode')||'goodjunk').toLowerCase();
    this.diff = (p.get('diff')||'normal').toLowerCase();

    this.$ = s=>document.querySelector(s);
    this.vrBtn = this.$('#vrStartBtn');
    this.domBtn= this.$('#btnStart');
    this.startLbl = this.$('#startLbl');

    if(this.startLbl){
      try{ this.startLbl.setAttribute('troika-text', `value: เริ่ม: ${this.mode.toUpperCase()}`);}catch(_){}
    }

    // ปุ่ม “เริ่มเกม”
    const start = ()=> this.startGame();
    this.vrBtn && this.vrBtn.addEventListener('click', e=>{ e.preventDefault(); start(); });
    this.domBtn&& this.domBtn.addEventListener('click', start);

    // ถ้ามีพารามิเตอร์ mode/diff → auto-start
    if (p.has('mode')) start();

    window.dispatchEvent(new CustomEvent('hha:hud-ready'));
    console.log('[Hub] ready', {mode:this.mode, diff:this.diff});
  }

  async startGame(){
    const modePath = `./modes/${this.mode}.safe.js`;   // ✅ พาธโหมด
    const { boot } = await import(modePath);           // โหลดโหมดแบบ dynamic
    const ctrl = await boot({
      difficulty: this.diff,
      duration:   60
    });
    // เริ่มสปอนเป้า
    ctrl.start();
  }
}

window.addEventListener('DOMContentLoaded', ()=> new GameHub());
