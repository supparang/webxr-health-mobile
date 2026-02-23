// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR Boot — STABILIZE PATCH v20260223b
// ✅ Fix: start -> end overlay immediately
// ✅ Fix: page scroll drifting during play on mobile
// ✅ Fix: tapStart/menu/end overlay visibility sync
// ✅ Safe with brush.safe.js exposing window.BrushVR.start/reset/showHow (optional)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }

  function isMobileLike(){
    const v = String(qs('view','') || DOC.body?.dataset?.view || '').toLowerCase();
    return v === 'mobile' || v === 'cvr' || /android|iphone|ipad/i.test(navigator.userAgent || '');
  }

  function byId(id){ return DOC.getElementById(id); }

  let __scrollY = 0;
  function setScrollLock(lock){
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

  function setUiMode(mode){
    // mode: menu | play | end
    try{ DOC.documentElement.dataset.brUi = mode; }catch(_){}
    const menu = byId('br-menu');
    const end = byId('br-end');
    const tap = byId('tapStart');

    if(menu){
      const show = mode === 'menu';
      menu.style.display = show ? '' : 'none';
      menu.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
    if(end){
      if(mode === 'end'){
        end.hidden = false;
        end.style.display = '';
      }else{
        end.hidden = true;
        end.style.display = 'none';
      }
    }
    if(tap && mode !== 'menu'){
      tap.style.display = 'none';
    }

    // lock scroll ตอนเล่น/สรุปผล
    if(mode === 'play' || mode === 'end'){
      setScrollLock(true);
      try{ WIN.scrollTo(0,0); }catch(_){}
    }else{
      setScrollLock(false);
    }

    // ซ่อน VR UI ตอน menu/end
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

  function bindNoScrollWhilePlay(){
    // กันปัดหน้าจอเลื่อนตอนเล่น
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
  }

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

  function resetBeforeStart(){
    const end = byId('br-end');
    const menu = byId('br-menu');
    const tap = byId('tapStart');
    if(end){ end.hidden = true; end.style.display = 'none'; }
    if(menu){ menu.style.display = 'none'; menu.setAttribute('aria-hidden','true'); }
    if(tap){ tap.style.display = 'none'; }

    // event แจ้ง safe.js ว่าเริ่มรอบใหม่
    try{
      WIN.dispatchEvent(new CustomEvent('brush:prestart-reset', { detail:{ ts: Date.now() } }));
    }catch(_){}
  }

  function startFlow(){
    resetBeforeStart();
    setUiMode('play');
    try{ WIN.scrollTo(0,0); }catch(_){}

    // เรียก engine start ถ้ามี
    const res = safeCall('start');
    if(res === false){
      // ถ้า engine คืน false ให้กลับ menu
      setUiMode('menu');
      toast('เริ่มเกมไม่สำเร็จ');
    }else{
      toast('เริ่มเกม!');
    }
  }

  function retryFlow(){
    resetBeforeStart();
    // เรียก reset ก่อน (ถ้ามี)
    safeCall('reset');
    setUiMode('play');
    try{ WIN.scrollTo(0,0); }catch(_){}
    const res = safeCall('start');
    if(res === false){
      setUiMode('menu');
      toast('เริ่มใหม่ไม่สำเร็จ');
    }
  }

  function openHow(){
    const how = [
      'วิธีเล่น BrushVR',
      '• แตะ/ยิง 🦠 ให้ทัน',
      '• ใกล้หมดเวลา = PERFECT โบนัส',
      '• บอส 💎 ต้องยิงหลายครั้ง (จุดอ่อนจะเด้ง)',
      '• โหมด cVR ยิงจากกากบาทกลางจอ'
    ].join('\n');
    alert(how);
  }

  function wireButtons(){
    const btnStart = byId('btnStart');
    const btnRetry = byId('btnRetry');
    const btnPause = byId('btnPause');
    const btnHow = byId('btnHow');
    const btnRecenter = byId('btnRecenter');
    const tapBtn = byId('tapBtn');

    if(btnStart) btnStart.addEventListener('click', startFlow, { passive:true });
    if(btnRetry) btnRetry.addEventListener('click', retryFlow, { passive:true });

    if(btnPause){
      btnPause.addEventListener('click', function(){
        // toggle pause ผ่าน engine (ถ้ามี)
        const API = WIN.BrushVR || WIN.brushGame || WIN.BRUSH || {};
        if(typeof API.togglePause === 'function'){
          API.togglePause();
          return;
        }
        // fallback: ยิง event ให้ safe.js ฟังเอง
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
        // ปลดล็อกเสียง/gesture แล้วเริ่มเกม
        const tap = byId('tapStart');
        if(tap) tap.style.display = 'none';
        startFlow();
      }, { passive:true });
    }
  }

  function wireEngineEvents(){
    // ✅ ให้ safe.js แจ้ง boot เมื่อเกมจบ -> เปิด end overlay
    WIN.addEventListener('brush:end', function(ev){
      const d = ev && ev.detail || {};
      const end = byId('br-end');
      if(end){
        end.hidden = false;
        end.style.display = '';
      }
      setUiMode('end');

      // เติม note ถ้ามี
      const endNote = byId('endNote');
      if(endNote && d.note) endNote.textContent = String(d.note);

      // summary fields ถ้ามี detail
      const map = {
        sScore:'score', sMiss:'miss', sCombo:'maxCombo', sClean:'cleanPct', sTime:'timeText'
      };
      Object.keys(map).forEach((id)=>{
        const el = byId(id);
        const k = map[id];
        if(el && d[k] != null) el.textContent = String(d[k]);
      });
      if(byId('sAcc') && d.accPct != null) byId('sAcc').textContent = String(d.accPct) + '%';
      if(byId('endGrade') && d.grade != null) byId('endGrade').textContent = String(d.grade);
    }, { passive:true });

    // ✅ เริ่มรอบใหม่ -> ซ่อน end overlay แน่นอน
    WIN.addEventListener('brush:start', function(){
      resetBeforeStart();
      setUiMode('play');
    }, { passive:true });

    // fallback: ถ้า safe.js dispatch ui mode
    WIN.addEventListener('brush:ui', function(ev){
      const mode = ev && ev.detail && ev.detail.mode;
      if(mode === 'menu' || mode === 'play' || mode === 'end'){
        setUiMode(mode);
      }
    }, { passive:true });
  }

  function setupInitialView(){
    // ค่าเริ่มต้น: เข้าหน้าเมนู
    setUiMode('menu');

    // มือถือ + run=play แสดง tapStart
    const tap = byId('tapStart');
    const run = String(qs('run','play')).toLowerCase();
    if(tap){
      tap.style.display = (isMobileLike() && run === 'play') ? '' : 'none';
    }

    // ถ้าไม่มือถือ ให้โชว์เมนูปกติ
    if(!isMobileLike() && tap){
      tap.style.display = 'none';
    }

    // สำคัญ: ซ่อน end ทันที กัน state ค้างจาก markup/สคริปต์อื่น
    const end = byId('br-end');
    if(end){
      end.hidden = true;
      end.style.display = 'none';
    }
  }

  function init(){
    bindNoScrollWhilePlay();
    wireButtons();
    wireEngineEvents();
    setupInitialView();

    // debug hook (optional)
    WIN.BrushVRBoot = {
      setUiMode, setScrollLock, startFlow, retryFlow, resetBeforeStart
    };
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }

  // Global error panel (optional)
  WIN.addEventListener('error', function(ev){
    try{
      const msg = (ev && (ev.error && ev.error.stack || ev.message)) || 'Script error.';
      showFatal(msg);
    }catch(_){}
  });
})();