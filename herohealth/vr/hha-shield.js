// === /herohealth/vr/hha-shield.js ===
// HHA Shield — Universal Guard (scroll lock + quiet 401/403 + banner + retry latch)
// FULL v20260228-shield-uni
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const KEY = 'HHA_API_DISABLED';
  const TTL_MS = 15 * 60 * 1000; // 15 minutes

  const state = {
    installed: false,
    opts: null,
    bannerEl: null,
    locked: false,
  };

  function now(){ return Date.now(); }

  function disableRemote(code, reason){
    try{
      const payload = { code: Number(code)||403, reason: String(reason||''), ts: now() };
      sessionStorage.setItem(KEY, JSON.stringify(payload));
    }catch(e){}
    try{
      WIN.dispatchEvent(new CustomEvent('hha:remote-disabled', { detail: disabledInfo() }));
    }catch(e){}
  }

  function clearDisable(){
    try{ sessionStorage.removeItem(KEY); }catch(e){}
    try{
      WIN.dispatchEvent(new CustomEvent('hha:remote-enabled', { detail: { ok:true } }));
    }catch(e){}
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
    return !!disabledInfo().disabled;
  }

  // ---------- Scroll lock ----------
  function preventDefaultIfNeeded(ev){
    try{
      if(!ev) return;
      const t = ev.target;
      const tag = (t && t.tagName) ? t.tagName.toLowerCase() : '';
      if(tag === 'input' || tag === 'textarea' || tag === 'select') return;
      ev.preventDefault();
    }catch(e){}
  }

  function lockScrollOn(){
    if(state.locked) return;
    state.locked = true;
    try{
      const html = DOC.documentElement;
      const body = DOC.body;
      html.style.height = '100%';
      body.style.height = '100%';
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
      body.style.touchAction = 'manipulation';
      body.addEventListener('touchmove', preventDefaultIfNeeded, { passive:false });
    }catch(e){}
  }

  function lockScrollOff(){
    state.locked = false;
    try{
      const body = DOC.body;
      body.style.overflow = '';
      body.style.overscrollBehavior = '';
      body.style.touchAction = '';
      body.removeEventListener('touchmove', preventDefaultIfNeeded, { passive:false });
    }catch(e){}
  }

  // ---------- Banner ----------
  function ensureBanner(){
    if(state.bannerEl) return state.bannerEl;
    const el = DOC.createElement('div');
    el.id = 'hha-shield-banner';
    el.style.position = 'fixed';
    el.style.left = '10px';
    el.style.right = '10px';
    el.style.top = 'calc(env(safe-area-inset-top, 0px) + 10px)';
    el.style.zIndex = '9999';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '14px';
    el.style.border = '1px solid rgba(148,163,184,.20)';
    el.style.background = 'rgba(2,6,23,.76)';
    el.style.color = 'rgba(229,231,235,.96)';
    el.style.font = '800 13px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial';
    el.style.boxShadow = '0 18px 55px rgba(0,0,0,.35)';
    el.style.backdropFilter = 'blur(10px)';
    el.style.webkitBackdropFilter = 'blur(10px)';
    el.style.display = 'none';
    el.style.pointerEvents = 'auto';
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div>
          <span style="opacity:.9">🛡️ Shield:</span>
          <span id="hha-shield-msg" style="font-weight:900">—</span>
        </div>
        <button id="hha-shield-btn" type="button" style="
          border:1px solid rgba(148,163,184,.20);
          background: rgba(15,23,42,.65);
          color: rgba(229,231,235,.96);
          border-radius: 12px;
          padding: 8px 10px;
          font-weight: 900;
          cursor: pointer;
        ">Dismiss</button>
      </div>
      <div id="hha-shield-sub" style="margin-top:6px;font-size:12px;opacity:.85">—</div>
    `;
    DOC.body.appendChild(el);

    const btn = el.querySelector('#hha-shield-btn');
    btn?.addEventListener('click', ()=>{ el.style.display='none'; });

    state.bannerEl = el;
    return el;
  }

  function showBanner(msg, sub){
    if(!state.opts?.showBanner) return;
    const el = ensureBanner();
    const m = el.querySelector('#hha-shield-msg');
    const s = el.querySelector('#hha-shield-sub');
    if(m) m.textContent = String(msg||'');
    if(s) s.textContent = String(sub||'');
    el.style.display = 'block';
  }

  // ---------- Quiet fetch/XHR ----------
  function wrapFetch(){
    if(!WIN.fetch || WIN.__HHA_FETCH_WRAPPED__) return;
    WIN.__HHA_FETCH_WRAPPED__ = 1;

    const orig = WIN.fetch.bind(WIN);

    WIN.fetch = function(input, init){
      try{
        if(state.opts?.quietNetworkNoise && isRemoteDisabled()){
          return Promise.resolve(new Response('', { status: 403, statusText: 'Forbidden (HHA Shield latch)' }));
        }
      }catch(e){}

      return orig(input, init).then(res=>{
        try{
          if(res && (res.status===401 || res.status===403)){
            if(state.opts?.quietApollo403){
              disableRemote(res.status, 'fetch forbidden');
              showBanner('Remote ถูกปิดชั่วคราว (401/403)', 'กัน spam retry / Apollo error ชั่วคราว ~15 นาที');
            }
          }
        }catch(e){}
        return res;
      }).catch(err=>{
        if(state.opts?.quietNetworkNoise){
          try{
            disableRemote(403, 'fetch error');
            showBanner('Remote error -> ปิดชั่วคราว', 'กัน network spam (ในแท็บนี้) ~15 นาที');
          }catch(e){}
        }
        throw err;
      });
    };
  }

  function wrapXHR(){
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
        if(state.opts?.quietNetworkNoise && isRemoteDisabled()){
          try{ this.abort(); }catch(e){}
          return;
        }
      }catch(e){}

      this.addEventListener('load', ()=>{
        try{
          const st = this.status|0;
          if(st===401 || st===403){
            if(state.opts?.quietApollo403){
              disableRemote(st, 'xhr forbidden');
              showBanner('Remote ถูกปิดชั่วคราว (401/403)', 'กัน spam retry / Apollo error ชั่วคราว ~15 นาที');
            }
          }
        }catch(e){}
      });

      return origSend.apply(this, arguments);
    };
  }

  // ---------- Quiet unhandled promise rejection ----------
  function installGlobalQuiet(){
    if(WIN.__HHA_QUIET_INSTALLED__) return;
    WIN.__HHA_QUIET_INSTALLED__ = 1;

    WIN.addEventListener('unhandledrejection', (ev)=>{
      try{
        if(!state.opts?.quietApollo403) return;
        const r = ev && ev.reason;
        const msg = (r && (r.message || r.toString())) ? String(r.message || r.toString()) : '';
        if(/status code 403|Received status code 403|403 \(Forbidden\)|Forbidden/i.test(msg)){
          ev.preventDefault();
          disableRemote(403, 'unhandledrejection 403');
        }
      }catch(e){}
    });

    WIN.addEventListener('error', (ev)=>{
      try{
        if(!state.opts?.quietApollo403) return;
        const msg = String(ev?.message || '');
        if(/status code 403|403 \(Forbidden\)|Forbidden/i.test(msg)){
          ev.preventDefault?.();
          disableRemote(403, 'window.error 403');
        }
      }catch(e){}
    }, true);
  }

  // ---------- Public API ----------
  const API = {
    install(options){
      state.opts = Object.assign({
        lockScroll: true,
        quietApollo403: true,
        quietNetworkNoise: true,
        showBanner: true
      }, options||{});

      if(state.opts.lockScroll){
        if(DOC.body) lockScrollOn();
        else DOC.addEventListener('DOMContentLoaded', ()=>lockScrollOn(), { once:true });
      }

      wrapFetch();
      wrapXHR();
      installGlobalQuiet();

      state.installed = true;

      try{
        const info = disabledInfo();
        if(info.disabled){
          showBanner('Remote ถูกปิดอยู่', `code=${info.code} • อายุ ${Math.round(info.ageMs/1000)}s`);
        }
      }catch(e){}

      return API;
    },
    disabledInfo,
    isRemoteDisabled,
    disableRemote,
    clearDisable,
    lockScrollOff
  };

  WIN.HHA_Shield = API;
})();