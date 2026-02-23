// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR Boot — STABILIZE + HHA PATCH v20260223c
// ✅ Fix: end overlay immediate (ignore premature end until started)
// ✅ Fix: scroll drifting + touchmove/wheel prevention during play/end (mobile-like only)
// ✅ Add: auto-start support (?autoStart=1 | ?start=1) for play flow
// ✅ Add: Warmup Gate handshake passthrough -> dispatch brush:gate-handshake
// ✅ Add: end overlay hub navigation helpers (hub param)
// ✅ Safe with brush.safe.js exposing window.BrushVR.start/reset/showHow/togglePause (optional)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }
  function byId(id){ return DOC.getElementById(id); }

  function isMobileLike(){
    const v = String(qs('view','') || DOC.body?.dataset?.view || '').toLowerCase();
    return v === 'mobile' || v === 'cvr' || v === 'vr' || v === 'cardboard' || /android|iphone|ipad/i.test(navigator.userAgent || '');
  }
  function isVRLike(){
    const v = String(qs('view','') || '').toLowerCase();
    return v === 'vr' || v === 'cvr' || v === 'cardboard';
  }

  // -------- scroll lock (mobile only) --------
  let __scrollY = 0;
  function setScrollLock(lock){
    // lock only on mobile-like to avoid breaking desktop scroll
    if(!isMobileLike()) return;

    try{
      const html = DOC.documentElement;
      const body = DOC.body;
      if(!html || !body) return;

      if(lock){
        __scrollY = WIN.scrollY || WIN.pageYOffset || 0;
        html.dataset.brScroll = 'lock';
        body.style.position = 'fixed';
        body.style.top = `-${__scrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
        body.style.overflow = 'hidden';
      }else{
        html.dataset.brScroll = 'unlock';
        const y = Math.abs(parseInt(body.style.top || '0', 10)) || __scrollY || 0;
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.width = '';
        body.style.overflow = '';
        try{ WIN.scrollTo(0, y); }catch(_){}
      }
    }catch(_){}
  }

  // -------- UI mode sync --------
  function setUiMode(mode){
    // mode: menu | play | end
    try{ DOC.documentElement.dataset.brUi = mode; }catch(_){}
    const menu = byId('br-menu');
    const end  = byId('br-end');
    const tap  = byId('tapStart');

    if(menu){
      const show = mode === 'menu';
      menu.style.display = show ? '' : 'none';
      menu.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    if(end){
      const show = mode === 'end';
      end.hidden = !show;
      end.style.display = show ? '' : 'none';
    }

    if(tap && mode !== 'menu'){
      tap.style.display = 'none';
    }

    // lock scroll in play/end (mobile only)
    if(mode === 'play' || mode === 'end'){
      setScrollLock(true);
      try{ WIN.scrollTo(0,0); }catch(_){}
    }else{
      setScrollLock(false);
    }

    // hide VR UI outside play (if present)
    try{
      ['hha-vrui','hha-crosshair','hha-vrui-hint'].forEach((id)=>{
        const el = byId(id);
        if(!el) return;
        const show = (mode === 'play');
        el.style.opacity = show ? '1' : '0';
        el.style.pointerEvents = show ? '' : 'none';
      });
    }catch(_){}
  }

  // -------- toast + fatal --------
  function toast(msg){
    const t = byId('toast');
    if(!t) return;
    t.textContent = String(msg || '');
    t.classList.add('show');
    clearTimeout(t.__tm);
    t.__tm = setTimeout(()=> t.classList.remove('show'), 1300);
  }
  function showFatal(msg){
    const box = byId('fatal');
    if(!box) return;
    box.textContent = 'JS ERROR:\n' + String(msg || 'Unknown error');
    box.classList.remove('br-hidden');
  }

  // -------- prevent scroll during play/end (mobile only) --------
  function bindNoScrollWhilePlay(){
    if(!isMobileLike()) return;

    DOC.addEventListener('touchmove', function(ev){
      const mode = DOC.documentElement?.dataset?.brUi || '';
      if(mode === 'play' || mode === 'end'){
        ev.preventDefault();
      }
    }, { passive:false });

    DOC.addEventListener('wheel', function(ev){
      const mode = DOC.documentElement?.dataset?.brUi || '';
      if(mode === 'play' || mode === 'end'){
        ev.preventDefault();
      }
    }, { passive:false });

    WIN.addEventListener('pagehide', ()=> setScrollLock(false), { passive:true });
    WIN.addEventListener('beforeunload', ()=> setScrollLock(false), { passive:true });

    // if app goes background during play/end -> unlock to avoid stuck body fixed
    WIN.addEventListener('visibilitychange', ()=>{
      if(DOC.hidden) setScrollLock(false);
    }, { passive:true });
  }

  // -------- safe API calls --------
  function safeCall(fnName, ...args){
    try{
      const API = WIN.BrushVR || WIN.brushGame || WIN.BRUSH || {};
      const fn = API && API[fnName];
      if(typeof fn === 'function') return fn.apply(API, args);
    }catch(err){
      console.error('[BrushVR boot] call failed:', fnName, err);
      showFatal(err && err.stack || err && err.message || String(err));
    }
    return undefined;
  }

  // -------- Warmup Gate Handshake -> dispatch to safe.js --------
  function readGateHandshake(){
    // gateSR/gateTier/gateAssist/gateSpeed/gateFocus/gateDiffHint etc.
    // If present, dispatch once at boot so safe.js can consume.
    try{
      const sp = new URL(location.href).searchParams;
      const gateSR = sp.get('gateSR');
      const gateAssist = sp.get('gateAssist');
      const gateSpeed = sp.get('gateSpeed');
      const gateTier = sp.get('gateTier');
      const gateFocus = sp.get('gateFocus');
      const gateDiffHint = sp.get('gateDiffHint');

      const has = (gateSR!=null) || (gateAssist!=null) || (gateSpeed!=null) || (gateTier!=null) || (gateDiffHint!=null);
      if(!has) return null;

      const hs = {
        gateVer: sp.get('gateVer') || '',
        gateSR: Number(gateSR || 0),
        gateTier: String(gateTier || ''),
        gateAssist: String(gateAssist || ''),
        gateSpeed: Number(gateSpeed || 1),
        gateFocus: String(gateFocus || ''),
        gateDiffHint: Number(gateDiffHint || 0),
        gateAcc: Number(sp.get('gateAcc') || 0),
        gateHitRate: Number(sp.get('gateHitRate') || 0),
        gateStreak: Number(sp.get('gateStreak') || 0),
        gateSeed: String(sp.get('gateSeed') || ''),
      };

      // notify engine layer (safe.js) if it wants it
      try{
        WIN.dispatchEvent(new CustomEvent('brush:gate-handshake', { detail: hs }));
      }catch(_){}

      return hs;
    }catch(_){}
    return null;
  }

  // -------- state guard: prevent premature end overlay --------
  let __startedOnce = false;
  let __inPlay = false;
  let __startToken = 0; // increases each start

  function resetBeforeStart(){
    const end  = byId('br-end');
    const menu = byId('br-menu');
    const tap  = byId('tapStart');
    if(end){ end.hidden = true; end.style.display = 'none'; }
    if(menu){ menu.style.display = 'none'; menu.setAttribute('aria-hidden','true'); }
    if(tap){ tap.style.display = 'none'; }

    // notify safe.js round reset
    try{
      WIN.dispatchEvent(new CustomEvent('brush:prestart-reset', { detail:{ ts: Date.now() } }));
    }catch(_){}
  }

  function startFlow(){
    __startToken++;
    const myToken = __startToken;

    resetBeforeStart();
    setUiMode('play');
    __startedOnce = true;
    __inPlay = true;

    try{ WIN.scrollTo(0,0); }catch(_){}

    // call engine start
    const res = safeCall('start');

    // if engine returns false -> back to menu
    if(res === false){
      __inPlay = false;
      if(myToken === __startToken){
        setUiMode('menu');
        toast('เริ่มเกมไม่สำเร็จ');
      }
      return;
    }

    toast('เริ่มเกม!');
    // optional: notify start in case engine doesn’t
    try{ WIN.dispatchEvent(new CustomEvent('brush:start', { detail:{ ts: Date.now(), source:'boot' } })); }catch(_){}
  }

  function retryFlow(){
    __startToken++;
    const myToken = __startToken;

    resetBeforeStart();
    safeCall('reset');
    setUiMode('play');
    __startedOnce = true;
    __inPlay = true;

    try{ WIN.scrollTo(0,0); }catch(_){}

    const res = safeCall('start');
    if(res === false){
      __inPlay = false;
      if(myToken === __startToken){
        setUiMode('menu');
        toast('เริ่มใหม่ไม่สำเร็จ');
      }
      return;
    }
    toast('เริ่มใหม่!');
    try{ WIN.dispatchEvent(new CustomEvent('brush:start', { detail:{ ts: Date.now(), source:'boot-retry' } })); }catch(_){}
  }

  function openHow(){
    // avoid alert inside VR (annoying in headset); use toast instead
    const how = [
      'วิธีเล่น BrushVR',
      '• แตะ/ยิง 🦠 ให้ทัน',
      '• ใกล้หมดเวลา = PERFECT โบนัส',
      '• บอส 💎 ต้องยิงหลายครั้ง (จุดอ่อนจะเด้ง)',
      '• โหมด cVR ยิงจากกากบาทกลางจอ'
    ].join('\n');

    if(isVRLike()){
      toast('How: แตะ/ยิง 🦠 ให้ทัน • บอส 💎 ต้องยิงหลายครั้ง');
      return;
    }
    alert(how);
  }

  // -------- hub navigation helpers --------
  function absUrlMaybe(url){
    if(!url) return '';
    try{ return new URL(url, location.href).toString(); }catch(_){ return url; }
  }
  function getHubUrl(){
    return absUrlMaybe(qs('hub','../hub.html')) || '../hub.html';
  }
  function goHub(){
    location.href = getHubUrl();
  }

  function wireButtons(){
    const btnStart   = byId('btnStart');
    const btnRetry   = byId('btnRetry');
    const btnPause   = byId('btnPause');
    const btnHow     = byId('btnHow');
    const btnRecenter= byId('btnRecenter');
    const tapBtn     = byId('tapBtn');

    const btnHubEnd  = byId('btnToHub');      // optional end overlay buttons
    const btnContEnd = byId('btnContinue');   // optional

    if(btnStart) btnStart.addEventListener('click', startFlow, { passive:true });
    if(btnRetry) btnRetry.addEventListener('click', retryFlow, { passive:true });

    if(btnPause){
      btnPause.addEventListener('click', function(){
        const API = WIN.BrushVR || WIN.brushGame || WIN.BRUSH || {};
        if(typeof API.togglePause === 'function'){
          API.togglePause();
          return;
        }
        try{ WIN.dispatchEvent(new CustomEvent('brush:toggle-pause')); }catch(_){}
      }, { passive:true });
    }

    if(btnHow) btnHow.addEventListener('click', function(){
      safeCall('showHow');
      openHow();
    }, { passive:true });

    if(btnRecenter){
      btnRecenter.addEventListener('click', function(){
        try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'brush-boot' } })); }catch(_){}
        toast('Recenter');
      }, { passive:true });
    }

    if(tapBtn){
      tapBtn.addEventListener('click', function(){
        const tap = byId('tapStart');
        if(tap) tap.style.display = 'none';
        startFlow();
      }, { passive:true });
    }

    // optional end overlay nav
    if(btnHubEnd) btnHubEnd.addEventListener('click', goHub, { passive:true });

    if(btnContEnd){
      btnContEnd.addEventListener('click', function(){
        // If you want "continue" meaning "retry" for brush, do retry
        // If you want pass-through to next (like warmup gate), support ?next
        const next = absUrlMaybe(qs('next',''));
        if(next){
          location.replace(next);
        }else{
          retryFlow();
        }
      }, { passive:true });
    }
  }

  function wireEngineEvents(){
    // engine -> end
    WIN.addEventListener('brush:end', function(ev){
      const d = (ev && ev.detail) || {};

      // IMPORTANT: ignore premature end signals before we actually started a round
      // (fixes "end overlay immediately" if safe.js fires end due to init/reset)
      if(!__startedOnce || !__inPlay){
        // keep end hidden; stay in menu
        try{
          const end = byId('br-end');
          if(end){ end.hidden = true; end.style.display = 'none'; }
        }catch(_){}
        return;
      }

      __inPlay = false;

      const end = byId('br-end');
      if(end){
        end.hidden = false;
        end.style.display = '';
      }
      setUiMode('end');

      // note
      const endNote = byId('endNote');
      if(endNote && d.note) endNote.textContent = String(d.note);

      // summary fields
      const map = { sScore:'score', sMiss:'miss', sCombo:'maxCombo', sClean:'cleanPct', sTime:'timeText' };
      Object.keys(map).forEach((id)=>{
        const el = byId(id);
        const k = map[id];
        if(el && d[k] != null) el.textContent = String(d[k]);
      });
      if(byId('sAcc') && d.accPct != null) byId('sAcc').textContent = String(d.accPct) + '%';
      if(byId('endGrade') && d.grade != null) byId('endGrade').textContent = String(d.grade);

    }, { passive:true });

    // engine -> start
    WIN.addEventListener('brush:start', function(){
      resetBeforeStart();
      setUiMode('play');
      __startedOnce = true;
      __inPlay = true;
    }, { passive:true });

    // engine -> ui override
    WIN.addEventListener('brush:ui', function(ev){
      const mode = ev && ev.detail && ev.detail.mode;
      if(mode === 'menu' || mode === 'play' || mode === 'end'){
        if(mode === 'menu'){ __inPlay = false; }
        if(mode === 'play'){ __startedOnce = true; __inPlay = true; }
        setUiMode(mode);
      }
    }, { passive:true });
  }

  function setupInitialView(){
    // default: menu
    setUiMode('menu');

    // always hide end (avoid markup residue)
    const end = byId('br-end');
    if(end){
      end.hidden = true;
      end.style.display = 'none';
    }

    // mobile-like + run=play => show tapStart overlay
    const tap = byId('tapStart');
    const run = String(qs('run','play')).toLowerCase();
    if(tap){
      tap.style.display = (isMobileLike() && run === 'play') ? '' : 'none';
    }
    if(!isMobileLike() && tap){
      tap.style.display = 'none';
    }

    // reset guards
    __startedOnce = false;
    __inPlay = false;
  }

  function maybeAutoStart(){
    // conditions:
    // - run=play
    // - autoStart=1 OR start=1
    // - for mobile-like: if tapStart exists -> require user tap (don’t force)
    const run = String(qs('run','play')).toLowerCase();
    if(run !== 'play') return;

    const auto = String(qs('autoStart','') || qs('start','') || '').trim();
    if(auto !== '1' && auto.toLowerCase() !== 'true') return;

    const tap = byId('tapStart');
    if(isMobileLike() && tap){
      // keep tapStart visible; user must tap for gesture/audio
      return;
    }

    // desktop or no tapStart: safe to auto-start
    startFlow();
  }

  function init(){
    bindNoScrollWhilePlay();
    wireButtons();
    wireEngineEvents();
    setupInitialView();

    // warmup gate handshake (dispatch once at boot)
    const hs = readGateHandshake();
    if(hs){
      // also expose for debug
      WIN.__BR_GATE_HANDSHAKE__ = hs;
    }

    // optional debug hook
    WIN.BrushVRBoot = {
      setUiMode, setScrollLock, startFlow, retryFlow, resetBeforeStart
    };

    maybeAutoStart();
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }

  // global error
  WIN.addEventListener('error', function(ev){
    try{
      const msg = (ev && (ev.error && ev.error.stack || ev.message)) || 'Script error.';
      showFatal(msg);
    }catch(_){}
  });

})();