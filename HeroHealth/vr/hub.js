// /HeroHealth/vr/hub.js  — LATEST (fix dynamic import path)
console.log('[Hub] ready');

function modeUrl(modeName){
  // hub.js อยู่ที่ /HeroHealth/vr/  → ../modes/ จะได้ /HeroHealth/modes/
  return new URL(`../modes/${modeName}.safe.js`, import.meta.url).href;
}

export class GameHub {
  constructor(){
    const q = new URLSearchParams(location.search);
    this.mode = q.get('mode') || 'goodjunk';
    this.diff = q.get('diff') || 'normal';

    this.bindUI();
    window.dispatchEvent(new CustomEvent('hha:hub-ready'));
  }

  bindUI(){
    const vrBtn  = document.getElementById('vrStartBtn');
    const domBtn = document.getElementById('btnStart');
    const start  = () => this.startGame();
    vrBtn && vrBtn.addEventListener('click', start);
    domBtn && domBtn.addEventListener('click', start);

    // อัปเดตป้ายชื่อบนแผงเริ่ม
    const lbl = document.getElementById('startLbl');
    if (lbl) try { lbl.setAttribute('troika-text', `value: เริ่ม: ${this.mode.toUpperCase()}`); } catch(_){}
  }

  async startGame(){
    try{
      const url = modeUrl(this.mode);       // ✅ พาธถูก: /HeroHealth/modes/xxx.safe.js
      console.log('[Hub] loading', url);

      const mod  = await import(/* no-bundle */ url);
      const boot = (mod && (mod.boot || mod.default?.boot));
      if (!boot) throw new Error('mode has no boot()');

      const ctrl = await boot({ difficulty: this.diff, duration: 60 });
      ctrl?.start();

      // ซ่อนแผงเริ่มหลังเริ่มเกม
      const sp = document.getElementById('startPanel');
      sp && sp.setAttribute('visible', false);
    }catch(err){
      console.error('[Hub] load/start failed:', err);
      alert('โหลดโหมดเกมไม่สำเร็จ: ' + (err?.message||err));
    }
  }
}

window.addEventListener('DOMContentLoaded', () => new GameHub());
