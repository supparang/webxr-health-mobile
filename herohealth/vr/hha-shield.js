// === /herohealth/vr/hha-shield.js ===
// HHA Shield — Anti-injection / Anti-overlay / Quiet-noise (WebXR-safe)
// v20260227-hha-shield-1
// ✅ Hide/neutralize common extension overlays (Ginger/Grammarly/LanguageTool/AI sidebars)
// ✅ Optional: quiet known noisy promise errors (Apollo 401/403 etc.) without breaking game
// ✅ Touch/scroll protection for fullscreen game UIs
// ⚠️ Note: extensions can bypass JS; CSP is strongest. This shield is best-effort runtime hardening.

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // --- Heuristics: common injected nodes ---
  const INJECT_SELECTORS = [
    // Grammarly
    '[data-grammarly-part]', 'grammarly-extension', 'grammarly-desktop-integration',
    // Ginger
    '#ginger__widget', '[id^="ginger__"]', '[class*="ginger"]', 'ginger-extension',
    // LanguageTool
    '[class*="languagetool"]', '[id*="languagetool"]',
    // Generic AI/assistant overlays (best-effort)
    '[class*="assistant"]', '[id*="assistant"]', '[class*="sidebar"]', '[id*="sidebar"]',
    // Some translation overlays
    '[class*="translate"]', '[id*="translate"]'
  ];

  function safeQueryAll(sel){
    try{ return Array.from(DOC.querySelectorAll(sel)); }catch{ return []; }
  }

  function isLikelyInjected(el){
    if(!el || el === DOC.body || el === DOC.documentElement) return false;
    const id = String(el.id || '').toLowerCase();
    const cls= String(el.className || '').toLowerCase();
    const tag= String(el.tagName || '').toLowerCase();

    // Strong signals
    if(tag.includes('grammarly') || tag.includes('ginger')) return true;
    if(id.includes('grammarly') || id.includes('ginger') || id.includes('languagetool')) return true;
    if(cls.includes('grammarly') || cls.includes('ginger') || cls.includes('languagetool')) return true;

    // If it's a fixed-position overlay that sits on top and captures clicks
    try{
      const cs = getComputedStyle(el);
      if(cs.position === 'fixed' && cs.zIndex && Number(cs.zIndex) >= 9999){
        return true;
      }
    }catch{}
    return false;
  }

  function neutralizeNode(el){
    try{
      // Don't remove outright (extensions may re-add and cause churn). Hide & disable hit-testing.
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.style.setProperty('opacity', '0', 'important');
    }catch{}
  }

  function sweepInjected(){
    // 1) explicit selectors
    for(const sel of INJECT_SELECTORS){
      const nodes = safeQueryAll(sel);
      for(const el of nodes) neutralizeNode(el);
    }
    // 2) heuristic sweep for high z-index fixed overlays
    const all = safeQueryAll('body *');
    // cap work: only check a slice to avoid perf hit
    const step = Math.max(1, Math.floor(all.length / 600));
    for(let i=0;i<all.length;i+=step){
      const el = all[i];
      if(isLikelyInjected(el)) neutralizeNode(el);
    }
  }

  function installStylePatch(){
    // Hard CSS override to keep game playable even if overlays appear.
    const css = `
      /* HHA Shield CSS (best-effort) */
      grammarly-extension, grammarly-desktop-integration,
      [data-grammarly-part],
      #ginger__widget, [id^="ginger__"], ginger-extension,
      [class*="languagetool"], [id*="languagetool"]{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
        opacity:0 !important;
      }
      /* Prevent accidental page scroll bounce during gameplay */
      html.hha-noscr, body.hha-noscr{ overscroll-behavior: none; }
    `;
    const st = DOC.createElement('style');
    st.id = 'hha-shield-style';
    st.textContent = css;
    DOC.head.appendChild(st);
  }

  function installNoiseFilters(opts){
    const quietApollo = !!opts.quietApollo403;
    const quietNet = !!opts.quietNetworkNoise;

    // Keep originals in case you want to restore later
    const prevOnErr = WIN.onerror;
    const prevOnRej = WIN.onunhandledrejection;

    function looksLikeApollo403(err){
      const msg = String(err?.message || err || '');
      return (
        msg.includes('ApolloError') &&
        (msg.includes('status code 403') || msg.includes('status code 401'))
      );
    }
    function looksLikeForbiddenFetch(err){
      const msg = String(err?.message || err || '');
      return msg.includes('403') && (msg.includes('Forbidden') || msg.includes('Received status code 403'));
    }

    WIN.onerror = function(message, source, lineno, colno, error){
      try{
        if(quietNet && looksLikeForbiddenFetch(error || message)) return true; // swallow
      }catch{}
      return prevOnErr ? prevOnErr.apply(this, arguments) : false;
    };

    WIN.onunhandledrejection = function(ev){
      try{
        const reason = ev?.reason;
        if(quietApollo && looksLikeApollo403(reason)) {
          try{ ev.preventDefault?.(); }catch{}
          return;
        }
        if(quietNet && looksLikeForbiddenFetch(reason)) {
          try{ ev.preventDefault?.(); }catch{}
          return;
        }
      }catch{}
      return prevOnRej ? prevOnRej.apply(this, arguments) : undefined;
    };
  }

  function installScrollLock(opts){
    if(!opts.lockScroll) return;
    try{
      DOC.documentElement.classList.add('hha-noscr');
      DOC.body.classList.add('hha-noscr');

      // Prevent touch-scroll rubber band on mobile
      const preventer = (e)=>{
        // allow form fields if any (rare in game)
        const t = e.target;
        const tag = String(t?.tagName||'').toLowerCase();
        if(tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
      };
      DOC.addEventListener('touchmove', preventer, { passive:false });
      WIN.__HHA_SHIELD_TOUCHMOVE = preventer;
    }catch{}
  }

  function installMutationWatcher(opts){
    if(!opts.watchDOM) return;
    try{
      const mo = new MutationObserver((muts)=>{
        // Quick sweep on any added nodes
        let touched = false;
        for(const m of muts){
          if(m.addedNodes && m.addedNodes.length){ touched = true; break; }
        }
        if(touched) sweepInjected();
      });
      mo.observe(DOC.documentElement, { childList:true, subtree:true });
      WIN.__HHA_SHIELD_MO = mo;
    }catch{}
  }

  function install(opts = {}){
    const cfg = {
      watchDOM: opts.watchDOM !== false,
      lockScroll: opts.lockScroll !== false,
      quietApollo403: opts.quietApollo403 !== false,
      quietNetworkNoise: opts.quietNetworkNoise !== false
    };

    installStylePatch();
    sweepInjected();
    installNoiseFilters(cfg);
    installScrollLock(cfg);
    installMutationWatcher(cfg);

    // Re-sweep a few times during boot (extensions often inject late)
    let n = 0;
    const t = setInterval(()=>{
      n++;
      sweepInjected();
      if(n >= 6) clearInterval(t);
    }, 800);

    return { ok:true, cfg };
  }

  // expose global (non-module safe)
  WIN.HHA_Shield = { install };
})();
