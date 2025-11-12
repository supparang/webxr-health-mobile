// === /HeroHealth/hub.js (2025-11-12 with Start button binding) ===
export class GameHub{
  constructor(){
    this.mode = (new URLSearchParams(location.search).get('mode')||'goodjunk').toLowerCase();
    this.diff = (new URLSearchParams(location.search).get('diff')||'normal').toLowerCase();
    this.bindUI();
    window.dispatchEvent(new CustomEvent('hha:hub-ready'));
  }
  bindUI(){
    const modeMenu = document.getElementById('modeMenu');
    const startLbl = document.getElementById('startLbl');
    const vrBtn    = document.getElementById('vrStartBtn');
    const domBtn   = document.getElementById('btnStart');

    // select mode
    if(modeMenu){
      modeMenu.querySelectorAll('[data-mode]').forEach(el=>{
        el.addEventListener('click',()=>{
          this.mode = el.dataset.mode;
          try{ startLbl?.setAttribute('troika-text', `value: เริ่ม: ${this.mode.toUpperCase()}`);}catch(_){}
        });
      });
    }
    const go = ()=>this.startGame();
    vrBtn?.addEventListener('click', (e)=>{ e.preventDefault(); go(); });
    domBtn?.addEventListener('click', (e)=>{ e.preventDefault(); go(); });
  }
  startGame(){
    const url = `index.vr.html?mode=${this.mode}&diff=${this.diff}&autostart=1`;
    console.log('[Hub] start', url);
    location.href = url;
  }
}
window.GameHub = GameHub;
