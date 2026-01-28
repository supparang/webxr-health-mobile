// === /fitness/js/juice-fx.js ===
// JuiceFX: tiny DOM FX (shake, flash, announcer text)
// No canvas, no libs. Safe on mobile.

'use strict';

function qs(sel){ return document.querySelector(sel); }

export class JuiceFX{
  constructor(){
    this.layer = null;
    this.toast = null;
    this.ensure();
  }

  ensure(){
    if (this.layer) return;
    const el = document.createElement('div');
    el.id = 'sb-juice';
    el.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:9999;
    `;
    const toast = document.createElement('div');
    toast.id = 'sb-juice-toast';
    toast.style.cssText = `
      position:absolute; left:50%; top:10%;
      transform:translate(-50%,0);
      padding:10px 14px; border-radius:999px;
      background:rgba(2,6,23,.75);
      border:1px solid rgba(148,163,184,.35);
      color:#e5e7eb; font:600 14px system-ui;
      opacity:0; transition:opacity .18s, transform .18s;
      box-shadow:0 16px 40px rgba(0,0,0,.65);
      backdrop-filter: blur(10px);
      white-space:nowrap;
    `;
    el.appendChild(toast);
    document.body.appendChild(el);
    this.layer = el;
    this.toast = toast;
  }

  toastMsg(text, tone=''){
    if (!this.toast) return;
    this.toast.textContent = text;
    this.toast.style.opacity = '1';
    this.toast.style.transform = 'translate(-50%,0) scale(1)';
    if (tone === 'warn') this.toast.style.borderColor = 'rgba(251,113,133,.55)';
    else if (tone === 'good') this.toast.style.borderColor = 'rgba(34,197,94,.55)';
    else this.toast.style.borderColor = 'rgba(148,163,184,.35)';

    clearTimeout(this._t);
    this._t = setTimeout(()=>{
      this.toast.style.opacity = '0';
      this.toast.style.transform = 'translate(-50%,-6px) scale(.98)';
    }, 900);
  }

  shake(intensity=1){
    const wrap = qs('#sb-wrap');
    if (!wrap) return;
    const px = Math.round(2 * intensity);
    wrap.animate([
      { transform:`translate(0,0)` },
      { transform:`translate(${px}px,0)` },
      { transform:`translate(-${px}px,0)` },
      { transform:`translate(${px}px,0)` },
      { transform:`translate(0,0)` }
    ], { duration: 220, iterations: 1, easing:'ease-out' });
  }

  flash(){
    if (!this.layer) return;
    const f = document.createElement('div');
    f.style.cssText = `
      position:absolute; inset:0; background:rgba(255,255,255,.10);
      opacity:0; transition:opacity .14s;
    `;
    this.layer.appendChild(f);
    requestAnimationFrame(()=>{ f.style.opacity='1'; });
    setTimeout(()=>{ f.style.opacity='0'; }, 90);
    setTimeout(()=>{ f.remove(); }, 260);
  }
}