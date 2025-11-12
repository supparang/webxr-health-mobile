// === Hero Health Hub (A-Frame 1.4.2 stable) ===
// จัดการเมนู เลือกโหมด และเริ่มเกม
console.log('[Hub] initializing');

export class GameHub {
  constructor() {
    this.mode = 'goodjunk';
    this.diff = 'normal';
    this.bindUI();
    window.dispatchEvent(new CustomEvent('hha:hub-ready'));
  }

  bindUI() {
    const startPanel = document.getElementById('startPanel');
    const vrBtn = document.getElementById('vrStartBtn');
    const domBtn = document.getElementById('btnStart');
    const modeMenu = document.getElementById('modeMenu');

    // toggle เมนูโหมด
    if (modeMenu) {
      modeMenu.querySelectorAll('[data-mode]').forEach(el => {
        el.addEventListener('click', e => {
          const m = el.dataset.mode;
          this.mode = m;
          document.getElementById('startLbl')
            ?.setAttribute('troika-text', `value: เริ่ม: ${m.toUpperCase()}`);
          modeMenu.setAttribute('visible', false);
          console.log('[Hub] select mode', m);
        });
      });
    }

    // เริ่มเกม
    const start = () => this.startGame();
    vrBtn?.addEventListener('click', start);
    domBtn?.addEventListener('click', start);
  }

  startGame() {
    const url = `index.vr.html?mode=${this.mode}&diff=${this.diff}`;
    console.log('[Hub] start', url);
    window.location.href = url;
  }
}

window.addEventListener('DOMContentLoaded', () => new GameHub());
