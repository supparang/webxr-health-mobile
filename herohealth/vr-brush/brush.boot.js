// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR Boot — SAFE CLEAN PATCH (v20260225c)
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const $ = (id)=> DOC.getElementById(id);

  function qs(k,d=''){
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch(_) { return d; }
  }

  function fatal(msg){
    const el = $('fatal');
    if (!el) { try{ alert(String(msg)); }catch(_){} return; }
    el.textContent = String(msg);
    el.classList.remove('br-hidden');
  }

  // --- Global error overlay ---
  WIN.addEventListener('error', function(e){
    try{
      let msg = 'JS ERROR:\n' + String(e?.message || 'Script error.');
      const file = e?.filename ? String(e.filename) : '';
      const line = e?.lineno != null ? String(e.lineno) : '';
      const col  = e?.colno  != null ? String(e.colno)  : '';
      if (file || line || col) msg += '\n\n' + file + ':' + line + ':' + col;
      if (e?.error?.stack) msg += '\n\n' + e.error.stack;
      fatal(msg);
    }catch(_){}
  });

  WIN.addEventListener('unhandledrejection', function(e){
    try{
      const r = e?.reason;
      fatal('PROMISE REJECTION:\n' + (r?.stack || r?.message || String(r || 'Unknown rejection')));
    }catch(_){}
  });

  function setText(id, v){
    const el = $(id);
    if (el) el.textContent = String(v);
  }

  function getGameAPI(){
    // รองรับหลายชื่อ
    return WIN.BrushVR || WIN.brushGame || WIN.HHBrush || null;
  }

  function hide(el){
    if (!el) return;
    el.hidden = true;
    el.style.display = 'none';
  }

  function showGrid(el){
    if (!el) return;
    el.hidden = false;
    el.style.display = 'grid';
  }

  function showMenu(on){
    const menu = $('br-menu');
    if (!menu) return;
    if (on) showGrid(menu); else hide(menu);
    menu.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function showEnd(on){
    const end = $('br-end');
    if (!end) return;
    if (on) showGrid(end); else hide(end);
  }

  function showTap(on){
    const tap = $('tapStart');
    if (!tap) return;
    tap.style.display = on ? 'grid' : 'none';
  }

  function setPlayScrollLock(on){
    try{
      DOC.body.classList.toggle('br-no-scroll', !!on);
      DOC.documentElement.classList.toggle('br-no-scroll', !!on);
      if (on) WIN.scrollTo(0,0);
    }catch(_){}
  }

  function syncContextUI(){
    const view = (qs('view','mobile') || 'mobile').toLowerCase();
    const diff = qs('diff','normal');
    const time = Number(qs('time','80')) || 80;
    const seed = qs('seed', String(Date.now()));

    setText('br-ctx-view', view);
    setText('br-ctx-seed', seed);
    setText('br-ctx-time', time + 's');
    setText('br-diffTag', diff);
    setText('mDiff', diff);
    setText('mTime', time);

    try{
      DOC.body.dataset.view = view;
      DOC.documentElement.dataset.view = view;
      const wrap = $('br-wrap');
      if (wrap) wrap.dataset.view = view;
    }catch(_){}
  }

  function wireBackLinks(){
    const hub = qs('hub','../hub.html') || '../hub.html';
    const b1 = $('btnBack');
    const b2 = $('btnBackHub2');
    if (b1) b1.href = hub;
    if (b2) b2.href = hub;
  }

  let started = false;

  function fillSummary(summary){
    const s = summary || {};
    const score = Number(s.score ?? 0);
    const miss = Number(s.miss ?? 0);
    const maxCombo = Number(s.maxCombo ?? 0);
    const clean = Number(s.clean ?? 0);
    const acc = Number(s.acc ?? 0);
    const timeSec = Number(s.timeSec ?? 0);

    setText('sScore', score);
    setText('sAcc', Math.round(acc) + '%');
    setText('sMiss', miss);
    setText('sCombo', maxCombo);
    setText('sClean', Math.round(clean) + '%');
    setText('sTime', (Math.round(timeSec * 10) / 10) + 's');
    setText('endGrade', s.grade || 'C');

    const note = $('endNote');
    if (note){
      note.textContent = (s.note && String(s.note).trim()) || [
        (s.reason ? String(s.reason).toUpperCase() + '!' : 'ALMOST!'),
        'reason=' + (s.reason || '-'),
        'seed=' + qs('seed','-'),
        'diff=' + qs('diff','normal'),
        'view=' + qs('view','mobile'),
        'pid=' + qs('pid','anon')
      ].join(' | ');
    }
  }

  function startGameFromUI(){
    if (started) return;
    started = true;

    try{
      setPlayScrollLock(true);
      showEnd(false);
      showMenu(false);

      const api = getGameAPI();
      if (!api){
        started = false;
        setPlayScrollLock(false);
        throw new Error('Brush game API not found. Check brush.safe.js path/load order.');
      }

      // reset/start priority
      if (typeof api.resetAndStart === 'function') { api.resetAndStart(); return; }
      if (typeof api.start === 'function') { api.start({ reset:true }); return; }
      if (typeof api.begin === 'function') { api.begin(); return; }

      started = false;
      setPlayScrollLock(false);
      throw new Error('No start/resetAndStart/begin found in Brush game API.');
    }catch(e){
      started = false;
      setPlayScrollLock(false);
      fatal('Start error:\n' + (e?.stack || e?.message || String(e)));
    }
  }

  function wireButtons(){
    $('btnStart')?.addEventListener('click', startGameFromUI);

    $('btnRetry')?.addEventListener('click', ()=>{
      try{
        showEnd(false);
        startGameFromUI();
      }catch(e){
        fatal('Retry error:\n' + (e?.stack || e?.message || String(e)));
      }
    });

    $('btnHow')?.addEventListener('click', ()=>{
      setPlayScrollLock(false);
      showMenu(true);
    });

    $('btnPause')?.addEventListener('click', ()=>{
      try{
        const api = getGameAPI();
        if (api?.togglePause) api.togglePause();
      }catch(e){
        fatal('Pause error:\n' + (e?.stack || e?.message || String(e)));
      }
    });

    $('btnRecenter')?.addEventListener('click', ()=>{
      try{
        WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'brush-btn' } }));
      }catch(_){}
    });

    $('tapBtn')?.addEventListener('click', ()=>{
      // แค่ปลดล็อกเสียง/gesture ยังไม่ start เกม
      showTap(false);
      try{
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if (AC){
          const ac = new AC();
          if (ac.state === 'suspended') ac.resume();
          // แตะแล้วปิดทิ้ง
          setTimeout(()=>{ try{ ac.close(); }catch(_){} }, 50);
        }
      }catch(_){}
    });
  }

  function wireGameCallbacks(){
    const api = getGameAPI();
    if (!api) return;

    try{
      api.onEnd = function(summary){
        started = false;
        setPlayScrollLock(false);
        fillSummary(summary);
        showEnd(true);
      };
    }catch(_){}

    // optional callbacks
    try{
      api.onPauseChange = function(paused){
        const b = $('btnPause');
        if (b) b.textContent = paused ? 'Resume' : 'Pause';
      };
    }catch(_){}
  }

  function firstLoadUIState(){
    // สำคัญ: ห้ามโชว์สรุปทันทีตอนเข้า
    showEnd(false);
    showMenu(true);

    // มือถือ/cVR ให้มี tap unlock
    const view = (qs('view','mobile') || '').toLowerCase();
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
    const needTap = isTouch || /mobile|cvr|cardboard|vr/.test(view);
    showTap(!!needTap);

    setPlayScrollLock(false);
  }

  function boot(){
    syncContextUI();
    wireBackLinks();
    wireButtons();

    // ให้ safe.js โหลดและสร้าง API ก่อน
    wireGameCallbacks();

    firstLoadUIState();

    // retry bind API ถ้า safe.js โหลดช้ากว่า
    let tries = 0;
    const tm = setInterval(()=>{
      tries++;
      if (getGameAPI()){
        wireGameCallbacks();
        clearInterval(tm);
      } else if (tries > 20){
        clearInterval(tm);
      }
    }, 200);
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();