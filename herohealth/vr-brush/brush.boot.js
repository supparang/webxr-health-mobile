// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR Boot — SAFE CLEAN PATCH (v20260225b)
// ✅ no auto-end on load
// ✅ start only on user action
// ✅ robust error overlay
// ✅ cache-bust friendly
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const $ = (id)=> DOC.getElementById(id);
  const qs = (k,d='') => {
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch(_) { return d; }
  };

  function fatal(msg){
    const el = $('fatal');
    if(!el){ try{ alert(String(msg)); }catch(_){} return; }
    el.textContent = String(msg);
    el.classList.remove('br-hidden');
  }

  // Better error visibility on mobile
  WIN.addEventListener('error', function(e){
    try{
      let msg = 'JS ERROR:\n' + String((e && e.message) || 'Script error.');
      const file = (e && e.filename) ? String(e.filename) : '';
      const line = (e && e.lineno != null) ? String(e.lineno) : '';
      const col  = (e && e.colno  != null) ? String(e.colno)  : '';
      if(file || line || col) msg += '\n\n' + file + ':' + line + ':' + col;
      fatal(msg);
    }catch(_){}
  });

  WIN.addEventListener('unhandledrejection', function(e){
    try{
      const r = e && e.reason;
      const msg = (r && r.message) ? r.message : String(r || 'Promise rejection');
      fatal('PROMISE REJECTION:\n' + msg);
    }catch(_){}
  });

  // Game API from brush.safe.js (expected)
  // We support any of these exports to be forgiving.
  function getGameAPI(){
    return WIN.BrushVR || WIN.brushGame || WIN.HHBrush || null;
  }

  function setText(id, v){
    const el = $(id);
    if(el) el.textContent = String(v);
  }

  function setupCtx(){
    const view = (qs('view','mobile') || 'mobile').toLowerCase();
    const seed = qs('seed', String(Date.now()));
    const time = qs('time', '80');
    const diff = qs('diff', 'normal');

    // reflect in UI
    setText('br-ctx-view', view);
    setText('br-ctx-seed', seed);
    setText('br-ctx-time', time + 's');
    setText('br-diffTag', diff);
    setText('mDiff', diff);
    setText('mTime', time);

    // reflect dataset for css/vui
    try{
      DOC.body.dataset.view = view;
      const wrap = $('br-wrap');
      if(wrap) wrap.dataset.view = view;
      DOC.documentElement.dataset.view = view;
    }catch(_){}
  }

  function wireButtons(){
    const btnHow = $('btnHow');
    const btnPause = $('btnPause');
    const btnRecenter = $('btnRecenter');
    const btnStart = $('btnStart');
    const btnRetry = $('btnRetry');
    const tapBtn = $('tapBtn');

    if(btnHow){
      btnHow.addEventListener('click', function(){
        try{
          const menu = $('br-menu');
          if(menu){
            menu.style.display = 'grid';
            menu.setAttribute('aria-hidden','false');
          }
        }catch(_){}
      });
    }

    if(btnPause){
      btnPause.addEventListener('click', function(){
        try{
          const api = getGameAPI();
          if(api && typeof api.togglePause === 'function') api.togglePause();
        }catch(e){ fatal('Pause error:\n' + (e && e.message ? e.message : e)); }
      });
    }

    if(btnRecenter){
      btnRecenter.addEventListener('click', function(){
        try{
          WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'brush-btn' } }));
        }catch(_){}
      });
    }

    if(btnStart){
      btnStart.addEventListener('click', function(){
        startGameFromUI();
      });
    }

    if(btnRetry){
      btnRetry.addEventListener('click', function(){
        try{
          hideEnd();
          showMenu(false);
          const api = getGameAPI();
          if(api && typeof api.resetAndStart === 'function') return api.resetAndStart();
          if(api && typeof api.start === 'function') return api.start({ reset:true });
          // fallback reload with same URL
          location.href = location.href;
        }catch(e){
          fatal('Retry error:\n' + (e && e.message ? e.message : e));
        }
      });
    }

    if(tapBtn){
      tapBtn.addEventListener('click', function(){
        try{
          const tap = $('tapStart');
          if(tap) tap.style.display = 'none';
        }catch(_){}
        // do not auto start here; just unlock audio/touch
      });
    }
  }

  function showMenu(on){
    const el = $('br-menu');
    if(!el) return;
    el.style.display = on ? 'grid' : 'none';
    el.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function hideEnd(){
    const el = $('br-end');
    if(!el) return;
    el.hidden = true;
    el.style.display = 'none';
  }

  function showTapIfNeeded(){
    const tap = $('tapStart');
    if(!tap) return;
    const view = (qs('view','mobile') || '').toLowerCase();
    const isMobileish = /mobile|cvr|cardboard|vr/.test(view) || ('ontouchstart' in WIN);
    tap.style.display = isMobileish ? 'grid' : 'none';
  }

  let started = false;
  function startGameFromUI(){
    if(started) return;
    started = true;

    try{
      showMenu(false);
      hideEnd();

      const api = getGameAPI();
      if(!api){
        started = false;
        throw new Error('Brush game API not found (brush.safe.js may not be loaded correctly).');
      }

      // preferred methods in order
      if(typeof api.resetAndStart === 'function'){
        api.resetAndStart();
        return;
      }
      if(typeof api.start === 'function'){
        api.start({ reset:true });
        return;
      }
      if(typeof api.begin === 'function'){
        api.begin();
        return;
      }

      started = false;
      throw new Error('No start() / resetAndStart() / begin() in Brush game API.');
    }catch(e){
      started = false;
      fatal('Start error:\n' + (e && e.message ? e.message : e));
    }
  }

  function wireGameCallbacks(){
    const api = getGameAPI();
    if(!api) return;

    // Let safe.js notify boot when ended (optional)
    // api.onEnd = fn(summary)
    try{
      api.onEnd = function(summary){
        try{
          started = false;
          const end = $('br-end');
          if(end){
            end.hidden = false;
            end.style.display = 'grid';
          }
          // Fill summary if present
          if(summary && typeof summary === 'object'){
            setText('sScore', summary.score ?? 0);
            setText('sAcc', (summary.acc != null ? summary.acc : 0) + '%');
            setText('sMiss', summary.miss ?? 0);
            setText('sCombo', summary.maxCombo ?? 0);
            setText('sClean', (summary.clean != null ? summary.clean : 0) + '%');
            setText('sTime', (summary.timeSec != null ? summary.timeSec : 0) + 's');
            setText('endGrade', summary.grade ?? 'C');
            const note = $('endNote');
            if(note){
              note.textContent = summary.note || [
                'reason=' + (summary.reason || '-'),
                'seed=' + (qs('seed','-')),
                'diff=' + (qs('diff','normal')),
                'view=' + (qs('view','mobile')),
                'pid=' + (qs('pid','anon'))
              ].join(' | ');
            }
          }
        }catch(e){
          fatal('End callback error:\n' + (e && e.message ? e.message : e));
        }
      };
    }catch(_){}
  }

  function boot(){
    setupCtx();
    wireButtons();
    showTapIfNeeded();

    // IMPORTANT: ensure not showing end on first load
    hideEnd();

    // show menu first always
    showMenu(true);

    // connect game callbacks AFTER safe.js loaded
    wireGameCallbacks();

    // back hub links
    try{
      const hub = qs('hub','../hub.html');
      const b1 = $('btnBack');
      const b2 = $('btnBackHub2');
      if(b1) b1.href = hub || '../hub.html';
      if(b2) b2.href = hub || '../hub.html';
    }catch(_){}
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();