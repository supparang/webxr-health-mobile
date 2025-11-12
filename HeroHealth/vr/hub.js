// /HeroHealth/vr/hub.js  (PATCH)
console.log('[Hub] ready');

function buildModeUrl(modeName){
  // base = โฟลเดอร์ปัจจุบันของ index.vr.html
  const base = new URL('.', window.location.href);
  // ต่อพาธแบบ URL API จะกัน “//” ให้เอง และเคารพตัวพิมพ์เล็กใหญ่
  return new URL(`modes/${modeName}.safe.js`, base).href;
}

export class GameHub{
  constructor(){
    this.mode = (new URLSearchParams(location.search).get('mode')) || 'goodjunk';
    this.diff = (new URLSearchParams(location.search).get('diff')) || 'normal';
    this.bindUI();
    window.dispatchEvent(new CustomEvent('hha:hub-ready'));
  }

  bindUI(){
    const vrBtn  = document.getElementById('vrStartBtn');
    const domBtn = document.getElementById('btnStart');
    const start  = () => this.startGame();
    vrBtn && vrBtn.addEventListener('click', start);
    domBtn && domBtn.addEventListener('click', start);
  }

  async startGame(){
    try{
      const modeUrl = buildModeUrl(this.mode);          // ✅ พาธถูกแน่
      console.log('[Hub] loading', modeUrl);
      const mod = await import(/* @vite-ignore */ modeUrl);
      const boot = (mod && (mod.boot || mod.default?.boot));
      if(!boot) throw new Error('Mode has no boot()');

      // เริ่มโหมด
      const ctrl = await boot({ difficulty: this.diff, duration: 60 });
      ctrl?.start();
    }catch(err){
      console.error('[Hub] load/start failed:', err);
      alert('โหลดโหมดเกมไม่สำเร็จ: ' + err.message);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => new GameHub());
