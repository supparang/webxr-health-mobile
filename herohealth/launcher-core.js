// === /herohealth/launcher-core.js ===
// HeroHealth Launcher Core — PRODUCTION (AUTO-DETECT, NO-OVERRIDE)
// ✅ Detect view: pc / mobile / cvr / vr (best-effort)
// ✅ Never override if ?view= exists
// ✅ Tap-to-start + safe redirect
// ✅ Pass-through standard params + preserve unknown params
// ✅ Optional: remember last choices (only used if param missing)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if(WIN.HHA_LauncherCore) return;

  const LS = {
    last: 'HHA_LAUNCH_LAST_V1'
  };

  function safeJsonParse(s, d){ try{ return JSON.parse(s); }catch{ return d; } }
  function safeJsonStr(o, d){ try{ return JSON.stringify(o); }catch{ return d; } }

  function readLast(){
    return safeJsonParse(localStorage.getItem(LS.last)||'{}', {});
  }
  function writeLast(patch){
    const cur = readLast();
    const next = Object.assign({}, cur, patch || {});
    try{ localStorage.setItem(LS.last, safeJsonStr(next,'{}')); }catch(_){}
    return next;
  }

  function isTouch(){
    try{
      return ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
    }catch{ return false; }
  }

  function isLikelyVR(){
    // very soft check (cannot force)
    // If WebXR available & immersive-vr supported, will still need user gesture in run page
    return false;
  }

  function detectView(){
    // RULE: do not override if user already passed ?view=
    const url = new URL(location.href);
    const qpView = url.searchParams.get('view');
    if(qpView) return String(qpView).toLowerCase();

    // heuristic: if in iframe / small screen -> mobile
    const w = Math.min(WIN.innerWidth||0, DOC.documentElement.clientWidth||0);
    const h = Math.min(WIN.innerHeight||0, DOC.documentElement.clientHeight||0);
    const small = (Math.min(w,h) <= 520);

    // if touch and small => cvr (cardboard style) by default
    // else if touch => mobile
    // else => pc
    if(isTouch() && small) return 'cvr';
    if(isTouch()) return 'mobile';
    return 'pc';
  }

  // Keep common HHA params; also preserve unknown params automatically
  const KEEP = [
    'hub','run','diff','time','seed','style',
    'log','endpoint',
    'studyId','study_id',
    'conditionGroup','condition_group',
    'studentId','student_id',
    'group','site','grade','school','note','phase'
  ];

  function mergeParams({targetUrl, remember=true}){
    const src = new URL(location.href);
    const dst = new URL(targetUrl, location.href);

    // Start with dst params (if any), then overlay src params (preserve user intent)
    // Also preserve unknown params from src
    src.searchParams.forEach((v,k)=>{
      // always preserve
      dst.searchParams.set(k, v);
    });

    // ensure view exists unless already present (NO override rule handled by detectView)
    if(!dst.searchParams.get('view')){
      dst.searchParams.set('view', detectView());
    }

    // remember choices ONLY if they exist in src (never invent)
    if(remember){
      const patch = {};
      KEEP.forEach(k=>{
        const v = src.searchParams.get(k);
        if(v !== null && v !== '') patch[k] = v;
      });
      // also remember view
      patch.view = dst.searchParams.get('view') || '';
      writeLast(patch);
    }

    // If some key missing, optionally fill from last (but ONLY when not provided in src)
    const last = readLast();
    KEEP.forEach(k=>{
      const hasSrc = src.searchParams.has(k);
      const hasDst = dst.searchParams.has(k);
      if(!hasSrc && !hasDst && last[k]){
        dst.searchParams.set(k, last[k]);
      }
    });

    // seed default if missing
    if(!dst.searchParams.get('seed')){
      dst.searchParams.set('seed', String(Date.now()));
    }

    return dst.toString();
  }

  function setText(sel, text){
    const el = DOC.querySelector(sel);
    if(el) el.textContent = text;
  }

  function mountAutoUI({gameName='Game', desc='', targetUrl='' }){
    // optional minimal UI, if launcher page uses these ids
    setText('#hha-game-name', gameName);
    setText('#hha-game-desc', desc);

    // show view
    const v = detectView();
    setText('#hha-view', v.toUpperCase());

    // show run/diff/time
    const u = new URL(location.href);
    setText('#hha-run', (u.searchParams.get('run')||readLast().run||'play'));
    setText('#hha-diff', (u.searchParams.get('diff')||readLast().diff||'normal'));
    setText('#hha-time', (u.searchParams.get('time')||readLast().time||'90'));

    // button
    const btn = DOC.getElementById('hha-start');
    if(btn){
      btn.addEventListener('click', (ev)=>{
        ev.preventDefault();
        const href = mergeParams({targetUrl});
        location.href = href;
      }, {passive:false});
    }
  }

  WIN.HHA_LauncherCore = {
    detectView,
    mergeParams,
    mountAutoUI
  };
})();