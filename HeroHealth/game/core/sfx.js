// === Hero Health Academy — core/sfx.js (unified, hardened, legacy-safe) ===
// Features:
// • Toggle on/off (persist to localStorage 'hha_sound')
// • Mobile unlock on first user gesture
// • Works with existing <audio id="sfx-*"> elements (HTMLAudio fallback)
// • Tiny API: sfx.good(), sfx.bad(), sfx.perfect(), sfx.tick(), sfx.power(), sfx.play(id)
// • Back-compat: window.SFX is a ready-to-use singleton (like old stub)

export class SFX {
  constructor(opts = {}) {
    this.enabled = (localStorage.getItem('hha_sound') !== '0');
    this._unlocked = false;
    this._ids = opts.ids || ['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup'];
    this._els = new Map();   // id -> HTMLAudioElement
    this._vol = Math.max(0, Math.min(1, Number(opts.volume ?? 1)));
    this._boundUnlock = null;
    this._ensureEls();
    this._autoBindUnlock();
  }

  /* ========== Public API ========== */
  setEnabled(on) {
    this.enabled = !!on;
    try { localStorage.setItem('hha_sound', this.enabled ? '1' : '0'); } catch {}
  }
  isEnabled(){ return !!this.enabled; }

  setVolume(v=1){
    this._vol = Math.max(0, Math.min(1, Number(v)||0));
    this._els.forEach(a => { try{ a.volume = this._vol; }catch{} });
  }

  loadIds(ids = []) {
    this._ids = Array.isArray(ids) && ids.length ? ids.slice() : this._ids;
    this._ensureEls(true);
  }

  /** Manual unlock (optional). Usually handled by first user gesture automatically. */
  unlock() {
    if (this._unlocked) return;
    this._unlocked = true;
    // Prime all audio tags so subsequent .play() is allowed on iOS/Android
    for (const id of this._ids) {
      const el = this._getEl(id);
      if (!el) continue;
      try {
        // play → immediate pause resets to start without sound spam
        const p = el.play();
        if (p && typeof p.then === 'function') {
          p.then(()=>{ try{ el.pause(); el.currentTime = 0; }catch{}; })
           .catch(()=>{}); // ignore user-gesture errors
        } else {
          el.pause(); el.currentTime = 0;
        }
      } catch {}
    }
    // unbind gesture listeners after unlock
    this._autoUnbindUnlock();
  }

  play(id) {
    if (!this.enabled) return;
    const el = this._getEl(id);
    if (!el) return;
    try {
      el.volume = this._vol;
      el.currentTime = 0;
      // Note: on locked mobile, this may reject until unlocked
      el.play()?.catch(()=>{ /* ignore */ });
    } catch {}
  }

  // Shorthands
  good()    { this.play('sfx-good'); }
  bad()     { this.play('sfx-bad'); }
  perfect() { this.play('sfx-perfect'); }
  tick()    { this.play('sfx-tick'); }
  power()   { this.play('sfx-powerup'); }

  /* ========== Internals ========== */
  _getEl(id) {
    let el = this._els.get(id);
    if (el && document.body.contains(el)) return el;
    el = document.getElementById(id);
    if (el && el.tagName && el.tagName.toLowerCase() === 'audio') {
      try { el.preload = el.preload || 'auto'; el.volume = this._vol; } catch {}
      this._els.set(id, el);
      return el;
    }
    return null;
  }

  _ensureEls(clear = false) {
    if (clear) this._els.clear();
    for (const id of this._ids) this._getEl(id);
  }

  _autoBindUnlock() {
    if (this._boundUnlock) return;
    const once = () => this.unlock();
    this._boundUnlock = once;
    try {
      // Bind to common user gestures (first interaction)
      window.addEventListener('pointerdown', once, { passive:true, once:true });
      window.addEventListener('keydown',     once, { passive:true, once:true });
      window.addEventListener('touchstart',  once, { passive:true, once:true });
    } catch {}
  }
  _autoUnbindUnlock() {
    if (!this._boundUnlock) return;
    const once = this._boundUnlock;
    try {
      window.removeEventListener('pointerdown', once, { passive:true, once:true });
      window.removeEventListener('keydown',     once, { passive:true, once:true });
      window.removeEventListener('touchstart',  once, { passive:true, once:true });
    } catch {}
    this._boundUnlock = null;
  }
}

/* ===== Singleton (legacy-safe) ===== */
export const sfx = new SFX();
try { window.SFX = sfx; } catch {}
