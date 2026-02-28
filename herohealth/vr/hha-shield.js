// === /herohealth/vr/hha-shield.js ===
// HHA Shield — Universal Guard (scroll lock + quiet 401/403 + promise noise reducer)
// FULL v20260227-shield-uni
'use strict';

(function(){
  const WIN = window;

  const KEY = 'HHA_API_DISABLED';
  const TTL_MS = 15 * 60 * 1000; // 15 minutes

  function now(){ return Date.now(); }

  function disableRemote(code, reason){
    try{
      const payload = { code: Number(code)||403, reason: String(reason||''), ts: now() };
      sessionStorage.setItem(KEY, JSON.stringify(payload));
    }catch(e){}
  }

  function clearDisable(){
    try{ sessionStorage.removeItem(KEY); }catch(e){}
  }

  function disabledInfo(){
    try{
      const raw = sessionStorage.getItem(KEY);
      if(!raw) return { disabled:false };
      const d = JSON.parse(raw);
      const age = now() - (d.ts||0);
      if(age > TTL_MS){
        clearDisable();
        return { disabled:false };
      }
      return { disabled:true, code: d.code||403, reason: d.reason||'', ts: d.ts||0, ageMs: age };
    }catch(e){
      return { disabled:false };
    }
  }

  function isRemoteDisabled(){
    const info = disabledInfo();
    return !!info.disabled;
  }

  function lockScrollOn(){
    try{
      const html = document.documentElement;
      const body = document.body;
      html.style.height = '100%';
      body.style.height = '100%';
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
      body.style.touchAction = 'manipulation';
      // prevent iOS elastic scroll on some elements
      body.addEventListener('touchmove', preventDefaultIfNeeded, { passive:false });
    }catch(e){}
  }

  function lockScrollOff(){
    try{
      const body = document.body;
      body.style.overflow = '';
      body.style.overscrollBehavior = '';
      body.style.touchAction = '';
      body.removeEventListener('touchmove', preventDefaultIfNeeded, { passive:false });
    }catch(e){}
  }

  function preventDefaultIfNeeded(ev){
    // allow genuine pointer events on targets; block page scroll
    try{
      if(!ev) return;
      // if gesture started on input/textarea, allow
      const t = ev.target;
      const tag = (t && t.tagName) ? t.tagName.toLowerCase() : '';
      if(tag === 'input' || tag === 'textarea' || tag === 'select') return;
      ev.preventDefault();
    }catch(e){}
  }

  // Quiet fetch/XHR 401/403 (and optionally disable further remote attempts per tab)
  function wrapFetch(opts){
    if(!WIN.fetch || WIN.__HHA_FETCH_WRAPPED__) return;
    WIN.__HHA_FETCH_WRAPPED__ = 1;

    const orig = WIN.fetch.bind(WIN);
    WIN.fetch = function(input, init){
      try{
        if(opts && opts.quietNetworkNoise && isRemoteDisabled()){
          // Fast-fail: pretend forbidden to stop spammy retries
          return Promise.resolve(new Response('', { status: 403, statusText: 'Forbidden (HHA Shield latch)' }));
        }
      }catch(e){}

      return orig(input, init).then(res=>{
        try{
          if(res && (res.status===401 || res.status===403)){
            if(opts && opts.quietApollo403){
              disableRemote(res.status, 'fetch forbidden');
            }
          }
        }catch(e){}
        return res;
      }).catch(err=>{
        // swallow only if remote is disabled or we are quieting noise
        if(opts && opts.quietNetworkNoise){
          try{ disableRemote(403, 'fetch error'); }catch(e){}
        }
        throw err;
      });
    };
  }

  function wrapXHR(opts){
    if(!WIN.XMLHttpRequest || WIN.__HHA_XHR_WRAPPED__) return;
    WIN.__HHA_XHR_WRAPPED__ = 1;

    const XHR = WIN.XMLHttpRequest;
    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;

    XHR.prototype.open = function(method, url){
      try{ this.__hha_url = url; }catch(e){}
      return origOpen.apply(this, arguments);
    };

    XHR.prototype.send = function(){
      try{
        if(opts && opts.quietNetworkNoise && isRemoteDisabled()){
          // short-circuit: abort immediately
          try{ this.abort(); }catch(e){}
          return;
        }
      }catch(e){}
      this.addEventListener('load', ()=>{
        try{
          const st = this.status|0;
          if(st===401 || st===403){
            if(opts && opts.quietApollo403){
              disableRemote(st, 'xhr forbidden');
            }
          }
        }catch(e){}
      });
      return origSend.apply(this, arguments);
    };
  }

  // Quiet unhandled promise rejections that are clearly 401/403 Apollo noise
  function installGlobalQuiet(opts){
    if(WIN.__HHA_QUIET_INSTALLED__) return;
    WIN.__HHA_QUIET_INSTALLED__ = 1;

    WIN.addEventListener('unhandledrejection', (ev)=>{
      try{
        if(!opts || !opts.quietApollo403) return;
        const r = ev && ev.reason;
        const msg = (r && (r.message || r.toString())) ? String(r.message || r.toString()) : '';
        if(/status code 403|Received status code 403|403 \(Forbidden\)|Forbidden/i.test(msg)){
          // prevent noisy console
          ev.preventDefault();
          disableRemote(403, 'unhandledrejection 403');
        }
      }catch(e){}
    });

    WIN.addEventListener('error', (ev)=>{
      try{
        if(!opts || !opts.quietApollo403) return;
        const msg = String(ev?.message || '');
        if(/status code 403|403 \(Forbidden\)|Forbidden/i.test(msg)){
          // prevent noisy console
          ev.preventDefault?.();
          disableRemote(403, 'window.error 403');
        }
      }catch(e){}
    }, true);
  }

  const API = {
    install(options){
      const opts = Object.assign({
        watchDOM: true,
        lockScroll: true,
        quietApollo403: true,
        quietNetworkNoise: true
      }, options||{});

      if(opts.lockScroll) lockScrollOn();
      wrapFetch(opts);
      wrapXHR(opts);
      installGlobalQuiet(opts);

      return {
        disabledInfo,
        isRemoteDisabled,
        disableRemote,
        clearDisable,
        lockScrollOff
      };
    },
    disabledInfo,
    isRemoteDisabled,
    disableRemote,
    clearDisable
  };

  WIN.HHA_Shield = API;
})();