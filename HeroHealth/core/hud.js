// === /HeroHealth/core/hud.js
// Minimal, safe HUD with score/combo/timer + fires "hha:hud-ready" once mounted.
// - No optional chaining
// - Auto-mounts under .game-wrap (fallback: document.body)

export class HUD {
  constructor(opts){
    this.opts = opts || {};
    this.root = null;
    this.top  = null;   // #hudTop
    this.scoreBox = null; // .score-box
    this.scoreEl  = null;
    this.comboEl  = null;
    this.timerEl  = null;
    this._readyFired = false;
  }

  // ---- DOM build ----
  _build(){
    // wrapper
    var root = document.createElement('div');
    root.id = 'hudRoot';
    root.style.position = 'absolute';
    root.style.left = '0'; root.style.top = '0';
    root.style.right = '0'; root.style.pointerEvents = 'none';
    root.style.zIndex = '40';         // ต่ำกว่า fx-layer (9999) แต่สูงกว่พื้นหลัง

    // top bar
    var top = document.createElement('div');
    top.id = 'hudTop';
    top.className = 'hud-top';
    top.style.display = 'flex';
    top.style.alignItems = 'center';
    top.style.justifyContent = 'space-between';
    top.style.gap = '12px';
    top.style.padding = '10px 12px';

    // score box (⭐ anchor for fever bar)
    var box = document.createElement('div');
    box.className = 'score-box';
    box.setAttribute('data-hud', 'scorebox');
    box.style.position = 'relative';           // ให้ fever bar ไปผูก (top:100%)
    box.style.minWidth = '220px';
    box.style.pointerEvents = 'none';
    box.style.display = 'grid';
    box.style.gridTemplateColumns = '1fr 1fr 1fr';
    box.style.gap = '8px';
    box.style.alignItems = 'center';

    // score
    var score = document.createElement('div');
    score.className = 'hud-score';
    score.style.fontWeight = '900';
    score.style.fontSize = '18px';
    score.textContent = 'SCORE: 0';

    // combo
    var combo = document.createElement('div');
    combo.className = 'hud-combo';
    combo.style.fontWeight = '900';
    combo.style.fontSize = '18px';
    combo.textContent = 'COMBO: 0';

    // timer
    var timer = document.createElement('div');
    timer.className = 'hud-timer';
    timer.style.fontWeight = '900';
    timer.style.fontSize = '18px';
    timer.textContent = 'TIME: 60';

    box.appendChild(score);
    box.appendChild(combo);
    box.appendChild(timer);

    top.appendChild(box);
    root.appendChild(top);

    this.root = root;
    this.top = top;
    this.scoreBox = box;
    this.scoreEl = score;
    this.comboEl = combo;
    this.timerEl = timer;
  }

  // ---- Mount into container ----
  mount(container){
    if (!this.root) this._build();

    var host = null;
    // priority: explicit container → .game-wrap → body
    if (container && container.appendChild) host = container;
    if (!host) host = document.querySelector('.game-wrap');
    if (!host) host = document.body;

    // ensure host can position children absolutely if needed
    var hostStyle = window.getComputedStyle(host);
    if (hostStyle.position === 'static') host.style.position = 'relative';

    // stretch HUD root
    this.root.style.width = host.clientWidth ? host.clientWidth+'px' : '100%';

    host.appendChild(this.root);

    // announce when ready (next frame to ensure layout)
    var self = this;
    window.requestAnimationFrame(function(){ self._announceReady(); });

    // re-announce on resize (help fever bar remount)
    function onResize(){
      try {
        self.root.style.width = host.clientWidth ? (host.clientWidth+'px') : '100%';
        self._announceReady(true); // force re-announce
      } catch(_) {}
    }
    window.addEventListener('resize', onResize);

    // keep refs to cleanup if needed
    this._onResize = onResize;
  }

  // ---- Announce to ui-fever.js that HUD exists & anchor is ready ----
  _announceReady(force){
    if (this._readyFired && !force) return;
    // guard: ensure elements exist
    if (!this.top || !this.scoreBox) return;

    try {
      var detail = { anchorId:'hudTop', scoreBox:true };
      var ev = new CustomEvent('hha:hud-ready', { detail: detail });
      window.dispatchEvent(ev);
      this._readyFired = true;
    } catch(_) {}
  }

  // ---- Simple setters (compatible with existing calls) ----
  setTop(txt){
    // kept for backward compatibility if you used it to place hints
    // You can extend to show wave/hints here if wanted.
  }

  setScore(n){
    n = Math.max(0, Number(n)||0);
    if (this.scoreEl) this.scoreEl.textContent = 'SCORE: ' + n;
  }

  setCombo(n){
    n = Math.max(0, Number(n)||0);
    if (this.comboEl) this.comboEl.textContent = 'COMBO: ' + n;
  }

  setTimer(sec){
    sec = Math.max(0, Number(sec)||0);
    if (this.timerEl) this.timerEl.textContent = 'TIME: ' + sec;
  }

  dispose(){
    try {
      if (this._onResize) window.removeEventListener('resize', this._onResize);
    } catch(_) {}
    if (this.root && this.root.parentNode){
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this.top = null;
    this.scoreBox = null;
    this.scoreEl = null;
    this.comboEl = null;
    this.timerEl = null;
    this._readyFired = false;
  }
}

// ---- Tiny helper for quick boot (optional) ----
export function bootHUD(container){
  var hud = new HUD();
  hud.mount(container);
  return hud;
}
