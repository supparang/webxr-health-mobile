// === /herohealth/vr-groups/effects-pack.js ===
// GroupsVR Effects Pack (NON-MODULE) — SAFE
// ✅ No "export"
// ✅ window.GroupsVR.EffectsPack.init({ layerEl })
// ✅ Listens: groups:fx (hit/miss/switch/storm/boss) + provides helpers
// ✅ Uses window.Particles if available; fallback to small DOM FX

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  WIN.GroupsVR = WIN.GroupsVR || {};

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  // ---- fallback tiny FX layer ----
  let fxLayer = null;
  function ensureLayer(){
    if (fxLayer) return fxLayer;
    fxLayer = DOC.createElement('div');
    fxLayer.id = 'groupsFxLayer';
    fxLayer.style.cssText = [
      'position:fixed','inset:0','pointer-events:none','z-index:9998'
    ].join(';');
    DOC.body.appendChild(fxLayer);
    return fxLayer;
  }

  function popDot(x,y,kind){
    const el = DOC.createElement('div');
    el.style.cssText = [
      'position:fixed',
      'left:'+(x|0)+'px','top:'+(y|0)+'px',
      'width:10px','height:10px',
      'border-radius:999px',
      'transform:translate(-50%,-50%) scale(1)',
      'opacity:0.9',
      'box-shadow:0 0 0 10px rgba(255,255,255,.08)',
      'background:'+(kind==='bad' ? 'rgba(239,68,68,.95)' : 'rgba(34,197,94,.95)'),
      'transition: transform .32s ease, opacity .32s ease'
    ].join(';');

    ensureLayer().appendChild(el);
    requestAnimationFrame(()=>{
      el.style.transform = 'translate(-50%,-50%) scale(1.9)';
      el.style.opacity = '0';
    });
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 420);
  }

  function popText(x,y,text,cls){
    if (WIN.Particles && typeof WIN.Particles.popText === 'function'){
      WIN.Particles.popText(x,y,text,cls);
      return;
    }
    // fallback
    const el = DOC.createElement('div');
    el.textContent = String(text||'');
    el.style.cssText = [
      'position:fixed',
      'left:'+(x|0)+'px','top:'+(y|0)+'px',
      'transform:translate(-50%,-50%)',
      'font-weight:1000',
      'font-size:14px',
      'padding:6px 10px',
      'border-radius:999px',
      'background:rgba(2,6,23,.72)',
      'border:1px solid rgba(148,163,184,.24)',
      'color:rgba(229,231,235,.95)',
      'opacity:1',
      'transition: transform .42s ease, opacity .42s ease'
    ].join(';');

    ensureLayer().appendChild(el);
    requestAnimationFrame(()=>{
      el.style.transform = 'translate(-50%,-70%)';
      el.style.opacity = '0';
    });
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 520);
  }

  // ---- main pack ----
  const EffectsPack = {
    _on: false,
    _layerEl: null,
    _off: [],
    _lastFlashAt: 0,

    init(opts){
      opts = opts || {};
      this._layerEl = opts.layerEl || null;
      this._on = true;

      // clean old listeners
      this.stop();

      const on = (type, fn, opt)=>{
        WIN.addEventListener(type, fn, opt || { passive:true });
        this._off.push([type, fn, opt || { passive:true }]);
      };

      // Generic FX channel from engine (recommended)
      on('groups:fx', (ev)=>{
        const d = ev.detail || {};
        const kind = String(d.kind || '');
        const x = Number(d.x ?? d.cx ?? (WIN.innerWidth/2));
        const y = Number(d.y ?? d.cy ?? (WIN.innerHeight/2));

        if (kind === 'hit'){
          popText(x,y, d.text || '✅', 'good');
          popDot(x,y,'good');
        } else if (kind === 'miss'){
          popText(x,y, d.text || '❌', 'bad');
          popDot(x,y,'bad');
        } else if (kind === 'switch'){
          popText(WIN.innerWidth/2, WIN.innerHeight*0.45, '🔄 สลับหมู่!', 'warn');
        } else if (kind === 'storm_on'){
          popText(WIN.innerWidth/2, WIN.innerHeight*0.40, '🌪️ STORM!', 'warn');
        } else if (kind === 'storm_off'){
          popText(WIN.innerWidth/2, WIN.innerHeight*0.40, '✨ พายุจบ!', 'good');
        } else if (kind === 'boss'){
          popText(WIN.innerWidth/2, WIN.innerHeight*0.40, '👊 BOSS!', 'warn');
        }
      });

      // Optional: simple hit flash on score spike (safe)
      on('hha:score', (ev)=>{
        const d = ev.detail || {};
        const combo = Number(d.combo||0);
        if (combo >= 6){
          const t = nowMs();
          if (t - this._lastFlashAt < 650) return;
          this._lastFlashAt = t;
          // If you have a DOM flash element in future, hook here.
        }
      });

      try{
        WIN.dispatchEvent(new CustomEvent('groups:effectspack_ready', { detail:{ ok:true } }));
      }catch(_){}

      return true;
    },

    stop(){
      try{
        const off = this._off || [];
        for (let i=0;i<off.length;i++){
          const it = off[i];
          WIN.removeEventListener(it[0], it[1], it[2]);
        }
      }catch(_){}
      this._off = [];
      this._on = false;
    },

    // helpers for engine calls (if engine wants direct API)
    hit(x,y,text){ popText(x,y,text||'✅','good'); popDot(x,y,'good'); },
    miss(x,y,text){ popText(x,y,text||'❌','bad');  popDot(x,y,'bad');  },
    banner(text){ popText(WIN.innerWidth/2, WIN.innerHeight*0.42, text||'—', 'neutral'); }
  };

  WIN.GroupsVR.EffectsPack = EffectsPack;
})();