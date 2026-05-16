/* =========================================================
   HeroHealth Hydration Mode Patch
   File: /herohealth/hydration-vr/hydration-vr.mode-patch.js
   Version: v20260515-pack14
   Purpose:
   - view class: pc / mobile / cvr
   - mode class: solo / duet / race / battle / coop
   - Cardboard VR hha:shoot + fallback crosshair
   - target safe zone / spacing
   - summary action dedupe
   - latest summary save
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260515-hydration-mode-patch-pack14';

  function getUrl(){
    try{ return new URL(location.href); }
    catch(e){ return new URL('./run.html', location.origin); }
  }

  function getParam(k, d){
    try{ return getUrl().searchParams.get(k) || d; }
    catch(e){ return d; }
  }

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function getView(){
    var v = getParam('view', document.body.dataset.view || 'mobile');
    return ['pc','mobile','cvr'].includes(v) ? v : 'mobile';
  }

  function getMode(){
    var m = getParam('mode', document.body.dataset.mode || 'solo');
    return ['solo','duet','race','battle','coop'].includes(m) ? m : 'solo';
  }

  function setViewModeClass(){
    var view = getView();
    var mode = getMode();

    document.body.dataset.view = view;
    document.body.dataset.mode = mode;

    document.body.classList.remove('hha-view-pc','hha-view-mobile','hha-view-cvr');
    document.body.classList.remove('hha-mode-solo','hha-mode-duet','hha-mode-race','hha-mode-battle','hha-mode-coop');

    document.body.classList.add('hha-view-' + view);
    document.body.classList.add('hha-mode-' + mode);

    if(view === 'cvr'){
      document.body.classList.add('hha-cardboard-ready');
    }
  }

  function ensureModeBadge(){
    var mode = getMode();
    if(mode === 'solo') return;

    var old = document.getElementById('hha-mode-badge');
    if(old) return;

    var room = getParam('room','');
    var label = {
      duet:'🤝 Duet',
      race:'🏁 Race',
      battle:'⚔️ Battle',
      coop:'🌈 Coop'
    }[mode] || mode;

    var badge = document.createElement('div');
    badge.id = 'hha-mode-badge';
    badge.className = 'hha-mode-badge';
    badge.textContent = label + (room ? ' • ' + room : ' • multiplayer');
    document.body.appendChild(badge);
  }

  /* =========================================================
     cVR crosshair + shoot support
     ========================================================= */

  function ensureFallbackCrosshair(){
    if(getView() !== 'cvr') return;

    var old = document.getElementById('hha-cvr-fallback-crosshair');
    if(old) return;

    var c = document.createElement('div');
    c.id = 'hha-cvr-fallback-crosshair';
    c.className = 'hha-cvr-fallback-crosshair';
    c.innerHTML = '<i></i>';
    document.body.appendChild(c);
  }

  function centerPoint(){
    return {
      x: Math.round((window.innerWidth || document.documentElement.clientWidth || 0) / 2),
      y: Math.round((window.innerHeight || document.documentElement.clientHeight || 0) / 2)
    };
  }

  function rectCenterDistance(rect, x, y){
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var dx = cx - x;
    var dy = cy - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function findTargetAtCenter(){
    var p = centerPoint();

    var targets = qa('.hha-hydration-target')
      .filter(function(t){
        if(!t || !t.isConnected) return false;

        var r = t.getBoundingClientRect();
        if(r.width <= 0 || r.height <= 0) return false;

        var pad = 28;

        return (
          p.x >= r.left - pad &&
          p.x <= r.right + pad &&
          p.y >= r.top - pad &&
          p.y <= r.bottom + pad
        );
      })
      .sort(function(a,b){
        return rectCenterDistance(a.getBoundingClientRect(), p.x, p.y) -
               rectCenterDistance(b.getBoundingClientRect(), p.x, p.y);
      });

    return targets[0] || null;
  }

  function fireClick(target){
    if(!target) return false;

    try{
      target.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles:true,
        cancelable:true,
        pointerType:'mouse'
      }));
    }catch(e){}

    try{
      target.dispatchEvent(new MouseEvent('mousedown', {
        bubbles:true,
        cancelable:true
      }));
    }catch(e){}

    try{
      target.click();
      return true;
    }catch(e){
      try{
        target.dispatchEvent(new MouseEvent('click', {
          bubbles:true,
          cancelable:true
        }));
        return true;
      }catch(_){}
    }

    return false;
  }

  function shootCenter(){
    if(getView() !== 'cvr') return false;

    var target = findTargetAtCenter();

    if(target){
      target.dataset.hhaCvrShot = PATCH;
      return fireClick(target);
    }

    return false;
  }

  function bindShoot(){
    function onShoot(ev){
      try{
        if(getView() !== 'cvr') return;

        var ok = shootCenter();

        if(!ok && ev && ev.detail && ev.detail.target){
          fireClick(ev.detail.target);
        }
      }catch(e){}
    }

    window.addEventListener('hha:shoot', onShoot);
    document.addEventListener('hha:shoot', onShoot);

    document.addEventListener('click', function(ev){
      if(getView() !== 'cvr') return;

      var t = ev.target;

      if(t && t.closest && t.closest('button, a, input, select, textarea, .hha-control-btn')){
        return;
      }

      var ok = shootCenter();

      if(ok){
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);

    document.addEventListener('touchend', function(ev){
      if(getView() !== 'cvr') return;

      var t = ev.target;

      if(t && t.closest && t.closest('button, a, input, select, textarea, .hha-control-btn')){
        return;
      }

      shootCenter();
    }, { passive:true, capture:true });
  }

  /* =========================================================
     Target safe zone + spacing
     ========================================================= */

  function safeTopPx(){
    var view = getView();
    var w = window.innerWidth || 390;
    var h = window.innerHeight || 800;

    if(view === 'cvr') return 190;
    if(w <= 520 && h >= 760) return 245;
    if(w <= 520) return 225;
    if(w <= 820) return 185;

    return 135;
  }

  function safeBottomPad(){
    var w = window.innerWidth || 390;
    if(w <= 520) return 84;
    return 48;
  }

  function minDistance(){
    var view = getView();
    var w = window.innerWidth || 390;

    if(view === 'cvr') return 96;
    if(w <= 520) return 82;
    if(w <= 820) return 90;

    return 88;
  }

  function getCenter(el){
    var left = parseFloat(el.style.left || '0');
    var top = parseFloat(el.style.top || '0');
    var w = el.offsetWidth || 68;
    var h = el.offsetHeight || 82;

    return {
      x:left + w / 2,
      y:top + h / 2
    };
  }

  function tooClose(a, b, dist){
    var ca = getCenter(a);
    var cb = getCenter(b);
    var dx = ca.x - cb.x;
    var dy = ca.y - cb.y;
    return Math.sqrt(dx * dx + dy * dy) < dist;
  }

  function randomPlace(target, playfield){
    var rect = playfield.getBoundingClientRect();
    var tw = target.offsetWidth || 68;
    var th = target.offsetHeight || 82;

    var padX = 12;
    var topMin = safeTopPx();
    var topMax = Math.max(topMin + 20, rect.height - th - safeBottomPad());

    var leftMin = padX;
    var leftMax = Math.max(leftMin, rect.width - tw - padX);

    return {
      left: leftMin + Math.random() * Math.max(1, leftMax - leftMin),
      top: topMin + Math.random() * Math.max(1, topMax - topMin)
    };
  }

  function fixTarget(target){
    if(!target || !target.isConnected) return;

    requestAnimationFrame(function(){
      try{
        var playfield = document.getElementById('hha-hydration-playfield');
        if(!playfield || !target.isConnected) return;

        var rect = playfield.getBoundingClientRect();
        var tw = target.offsetWidth || 68;
        var th = target.offsetHeight || 82;

        var padX = 12;
        var topMin = safeTopPx();
        var topMax = Math.max(topMin + 20, rect.height - th - safeBottomPad());
        var leftMin = padX;
        var leftMax = Math.max(leftMin, rect.width - tw - padX);

        var left = parseFloat(target.style.left || '0');
        var top = parseFloat(target.style.top || '0');

        if(!Number.isFinite(left)){
          left = leftMin + Math.random() * Math.max(1, leftMax - leftMin);
        }

        if(!Number.isFinite(top) || top < topMin || top > topMax){
          top = topMin + Math.random() * Math.max(1, topMax - topMin);
        }

        target.style.left = Math.round(clamp(left, leftMin, leftMax)) + 'px';
        target.style.top = Math.round(clamp(top, topMin, topMax)) + 'px';

        var all = qa('.hha-hydration-target', playfield)
          .filter(function(t){
            return t !== target && t.isConnected;
          });

        if(all.length){
          var dist = minDistance();
          var overlaps = all.some(function(other){
            return tooClose(target, other, dist);
          });

          if(overlaps){
            var tries = 0;
            var ok = false;
            var pos;

            while(tries < 12 && !ok){
              tries++;
              pos = randomPlace(target, playfield);

              target.style.left = Math.round(pos.left) + 'px';
              target.style.top = Math.round(pos.top) + 'px';

              ok = !all.some(function(other){
                return tooClose(target, other, dist);
              });
            }
          }
        }

        target.dataset.hhaModePatch = PATCH;
      }catch(e){}
    });
  }

  function observeTargets(){
    var playfield = document.getElementById('hha-hydration-playfield');
    if(!playfield) return;

    qa('.hha-hydration-target', playfield).forEach(fixTarget);

    var mo = new MutationObserver(function(records){
      records.forEach(function(record){
        Array.from(record.addedNodes || []).forEach(function(node){
          if(!node || node.nodeType !== 1) return;

          if(node.classList && node.classList.contains('hha-hydration-target')){
            fixTarget(node);
          }

          if(node.querySelectorAll){
            node.querySelectorAll('.hha-hydration-target').forEach(fixTarget);
          }
        });
      });
    });

    mo.observe(playfield, {
      childList:true,
      subtree:true
    });

    window.addEventListener('resize', function(){
      qa('.hha-hydration-target', playfield).forEach(fixTarget);
    }, { passive:true });
  }

  /* =========================================================
     Summary clean + save
     ========================================================= */

  function findSummary(){
    var selectors = [
      '#hha-hydration-summary',
      '.hha-hydration-summary',
      '#hydration-summary',
      '.hha-summary-panel',
      '.hha-summary',
      '.hha-summary-card',
      '[data-hha-summary]'
    ];

    for(var i=0; i<selectors.length; i++){
      var el = q(selectors[i]);
      if(el) return el;
    }

    return null;
  }

  function nutritionZoneUrl(){
    var rawHub = getParam('hub', '');

    try{
      var decoded = decodeURIComponent(rawHub || '');
      if(decoded && decoded.indexOf('nutrition-zone.html') !== -1){
        return decoded;
      }
    }catch(e){}

    return new URL('../nutrition-zone.html', location.href).toString();
  }

  function cooldownUrl(){
    var returnUrl = nutritionZoneUrl();
    var url = new URL('../warmup-gate.html', location.href);

    var current = getUrl();

    [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'mode',
      'room',
      'log',
      'api',
      'studyId',
      'conditionGroup'
    ].forEach(function(k){
      var v = current.searchParams.get(k);
      if(v !== null && v !== ''){
        url.searchParams.set(k, v);
      }
    });

    url.searchParams.set('zone','nutrition');
    url.searchParams.set('game','hydration');
    url.searchParams.set('phase','cooldown');
    url.searchParams.set('studyPhase','cooldown');
    url.searchParams.set('next', returnUrl);
    url.searchParams.set('hub', returnUrl);

    return url.toString();
  }

  function saveLastSummary(summaryEl){
    try{
      var text = summaryEl ? String(summaryEl.textContent || '') : '';

      var data = {
        game:'hydration',
        zone:'nutrition',
        mode:getMode(),
        view:getView(),
        savedAt:new Date().toISOString(),
        pid:getParam('pid','anon'),
        name:getParam('name', getParam('nick','Hero')),
        diff:getParam('diff','normal'),
        time:getParam('time','150'),
        room:getParam('room',''),
        text:text.slice(0,1600),
        url:location.href
      };

      localStorage.setItem('HHA_LAST_SUMMARY_HYDRATION', JSON.stringify(data));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(data));
    }catch(e){}
  }

  function textHasAction(text, key){
    text = String(text || '').toLowerCase();

    if(key === 'cooldown'){
      return text.indexOf('cooldown') !== -1 || text.indexOf('คูลดาวน์') !== -1 || text.indexOf('ทำ cooldown') !== -1;
    }

    if(key === 'zone'){
      return text.indexOf('nutrition') !== -1 || text.indexOf('zone') !== -1 || text.indexOf('กลับ') !== -1;
    }

    if(key === 'replay'){
      return text.indexOf('เล่นใหม่') !== -1 || text.indexOf('เล่นอีกครั้ง') !== -1 || text.indexOf('replay') !== -1;
    }

    return false;
  }

  function injectSummaryActions(summary){
    if(!summary || !summary.isConnected) return;

    saveLastSummary(summary);

    var buttons = qa('button, a', summary);
    var hasCooldown = buttons.some(function(b){ return textHasAction(b.textContent, 'cooldown'); });
    var hasZone = buttons.some(function(b){ return textHasAction(b.textContent, 'zone'); });
    var hasReplay = buttons.some(function(b){ return textHasAction(b.textContent, 'replay'); });

    var existing = qa('.hha-hydration-final-actions', summary);

    if(hasCooldown && hasZone && hasReplay && existing.length){
      existing.forEach(function(box){
        try{ box.remove(); }catch(e){}
      });
      return;
    }

    if(existing.length > 1){
      existing.slice(1).forEach(function(box){
        try{ box.remove(); }catch(e){}
      });
    }

    if(hasCooldown && hasZone && hasReplay) return;

    var actions = existing[0];

    if(!actions){
      actions = document.createElement('div');
      actions.className = 'hha-hydration-final-actions';
      summary.appendChild(actions);
    }

    actions.innerHTML = [
      '<button type="button" class="hha-final-cooldown">🧘 ทำ Cooldown</button>',
      '<button type="button" class="hha-final-zone">🥗 กลับ Nutrition Zone</button>',
      '<button type="button" class="hha-final-replay">🔁 เล่นใหม่</button>'
    ].join('');

    var c = q('.hha-final-cooldown', actions);
    var z = q('.hha-final-zone', actions);
    var r = q('.hha-final-replay', actions);

    if(c) c.addEventListener('click', function(){
      try{
        if(typeof window.goHydrationCooldownThenHub === 'function'){
          window.goHydrationCooldownThenHub();
          return;
        }
      }catch(e){}

      location.href = cooldownUrl();
    });

    if(z) z.addEventListener('click', function(){
      location.href = nutritionZoneUrl();
    });

    if(r) r.addEventListener('click', function(){
      try{
        if(typeof window.restartHydrationSameChallenge === 'function'){
          window.restartHydrationSameChallenge();
          return;
        }
      }catch(e){}

      var u = getUrl();
      u.searchParams.set('seed', String(Date.now()));
      u.searchParams.set('run','play');
      location.href = u.toString();
    });
  }

  function scanSummary(){
    var summary = findSummary();
    if(summary) injectSummaryActions(summary);
  }

  /* =========================================================
     Final boot
     ========================================================= */

  function boot(){
    setViewModeClass();
    ensureModeBadge();
    ensureFallbackCrosshair();
    bindShoot();
    observeTargets();

    scanSummary();

    var mo = new MutationObserver(function(){
      scanSummary();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true
    });

    setInterval(scanSummary, 900);

    window.HHA = window.HHA || {};
    window.HHA.HydrationModePatch = {
      version:PATCH,
      getView:getView,
      getMode:getMode,
      shootCenter:shootCenter,
      nutritionZoneUrl:nutritionZoneUrl,
      cooldownUrl:cooldownUrl
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
/* =========================================================
   PATCH v20260516-hydration-cvr-movable-aim-real-pack17
   Fix cVR aim ขยับไม่ได้:
   - mouse move / pointer move
   - touch move / touch end
   - keyboard arrow / WASD
   - deviceorientation for Cardboard phone
   - override old fixed-center hha:shoot
   Append at end of /herohealth/hydration-vr/hydration-vr.mode-patch.js
   ========================================================= */

(function(){
  'use strict';

  if(window.HHA_HYDRATION_CVR_AIM_PACK17_LOADED) return;
  window.HHA_HYDRATION_CVR_AIM_PACK17_LOADED = true;

  var PATCH = 'v20260516-hydration-cvr-movable-aim-real-pack17';

  var aim = {
    x: 0,
    y: 0,
    ready: false,
    firing: false,
    orientationBase: null,
    motionEnabled: false
  };

  function getUrl(){
    try{ return new URL(location.href); }
    catch(e){ return new URL('./run.html', location.origin); }
  }

  function getView(){
    try{
      return getUrl().searchParams.get('view') || document.body.dataset.view || 'mobile';
    }catch(e){
      return document.body.dataset.view || 'mobile';
    }
  }

  function isCvr(){
    return getView() === 'cvr' || document.body.classList.contains('hha-view-cvr');
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function viewport(){
    return {
      w: window.innerWidth || document.documentElement.clientWidth || 390,
      h: window.innerHeight || document.documentElement.clientHeight || 800
    };
  }

  function ensureReticle(){
    if(!isCvr()) return null;

    var el = document.getElementById('hha-cvr-aim-reticle');
    if(el) return el;

    el = document.createElement('div');
    el.id = 'hha-cvr-aim-reticle';
    el.className = 'hha-cvr-aim-reticle';
    el.innerHTML = '<i></i>';
    document.body.appendChild(el);

    return el;
  }

  function ensureHint(){
    var el = document.getElementById('hha-cvr-aim-hint');
    if(el) return el;

    el = document.createElement('div');
    el.id = 'hha-cvr-aim-hint';
    el.className = 'hha-cvr-aim-hint';
    el.textContent = '🥽 ขยับเมาส์/เอียงเครื่องเพื่อเล็ง • แตะเพื่อยิง';
    document.body.appendChild(el);

    return el;
  }

  function showHint(text){
    if(!isCvr()) return;

    var el = ensureHint();
    el.textContent = text || '🥽 ขยับเมาส์/เอียงเครื่องเพื่อเล็ง • แตะเพื่อยิง';
    el.classList.add('show');

    clearTimeout(el._hhaT);
    el._hhaT = setTimeout(function(){
      el.classList.remove('show');
    }, 1800);
  }

  function ensureMotionButton(){
    if(!isCvr()) return null;

    var btn = document.getElementById('hha-cvr-motion-btn');
    if(btn) return btn;

    btn = document.createElement('button');
    btn.id = 'hha-cvr-motion-btn';
    btn.className = 'hha-cvr-motion-btn';
    btn.type = 'button';
    btn.textContent = '📱 เปิดการเอียงเครื่องเพื่อเล็ง';

    btn.addEventListener('click', requestMotionPermission);

    document.body.appendChild(btn);

    /*
      iOS ต้องขอ permission ส่วน Android/PC ไม่จำเป็น
    */
    if(window.DeviceOrientationEvent &&
       typeof window.DeviceOrientationEvent.requestPermission === 'function'){
      btn.classList.add('show');
    }

    return btn;
  }

  function initAim(){
    var v = viewport();

    aim.x = Math.round(v.w / 2);
    aim.y = Math.round(v.h / 2);
    aim.ready = true;

    renderAim();
  }

  function setAim(x, y){
    var v = viewport();
    var pad = 22;

    aim.x = clamp(x, pad, v.w - pad);
    aim.y = clamp(y, pad, v.h - pad);

    renderAim();
  }

  function renderAim(){
    if(!isCvr()) return;

    ensureReticle();

    document.documentElement.style.setProperty('--hha-cvr-aim-x', Math.round(aim.x) + 'px');
    document.documentElement.style.setProperty('--hha-cvr-aim-y', Math.round(aim.y) + 'px');

    var reticle = document.getElementById('hha-cvr-aim-reticle');
    var target = findTargetAtAim();

    if(reticle){
      reticle.classList.toggle('is-hit', !!target);
    }
  }

  function rectCenterDistance(rect, x, y){
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var dx = cx - x;
    var dy = cy - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function findTargetAtAim(){
    if(!isCvr()) return null;

    var targets = qa('.hha-hydration-target')
      .filter(function(t){
        if(!t || !t.isConnected) return false;

        var r = t.getBoundingClientRect();
        if(r.width <= 0 || r.height <= 0) return false;

        var pad = 36;

        return (
          aim.x >= r.left - pad &&
          aim.x <= r.right + pad &&
          aim.y >= r.top - pad &&
          aim.y <= r.bottom + pad
        );
      })
      .sort(function(a,b){
        return rectCenterDistance(a.getBoundingClientRect(), aim.x, aim.y) -
               rectCenterDistance(b.getBoundingClientRect(), aim.x, aim.y);
      });

    return targets[0] || null;
  }

  function fireClick(target){
    if(!target) return false;

    aim.firing = true;

    try{
      target.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles:true,
        cancelable:true,
        pointerType:'mouse',
        clientX:aim.x,
        clientY:aim.y
      }));
    }catch(e){}

    try{
      target.dispatchEvent(new MouseEvent('mousedown', {
        bubbles:true,
        cancelable:true,
        clientX:aim.x,
        clientY:aim.y
      }));
    }catch(e){}

    try{
      target.click();
    }catch(e){
      try{
        target.dispatchEvent(new MouseEvent('click', {
          bubbles:true,
          cancelable:true,
          clientX:aim.x,
          clientY:aim.y
        }));
      }catch(_){}
    }

    setTimeout(function(){
      aim.firing = false;
    }, 0);

    return true;
  }

  function shootAim(){
    if(!isCvr()) return false;

    var target = findTargetAtAim();

    if(target){
      target.dataset.hhaCvrAimShot = PATCH;
      return fireClick(target);
    }

    showHint('ยังไม่ตรงเป้า • ขยับ crosshair ไปหาเป้าก่อน');
    return false;
  }

  function shouldIgnoreControl(target){
    return !!(
      target &&
      target.closest &&
      target.closest('button, a, input, select, textarea, .hha-control-btn, #hha-cvr-motion-btn')
    );
  }

  function bindPointerAim(){
    document.addEventListener('mousemove', function(ev){
      if(!isCvr()) return;
      setAim(ev.clientX, ev.clientY);
    }, { passive:true });

    document.addEventListener('pointermove', function(ev){
      if(!isCvr()) return;
      setAim(ev.clientX, ev.clientY);
    }, { passive:true });

    document.addEventListener('touchmove', function(ev){
      if(!isCvr()) return;
      var t = ev.touches && ev.touches[0];
      if(!t) return;
      setAim(t.clientX, t.clientY);
    }, { passive:true });
  }

  function bindKeyboardAim(){
    document.addEventListener('keydown', function(ev){
      if(!isCvr()) return;

      var key = String(ev.key || '').toLowerCase();
      var step = ev.shiftKey ? 42 : 22;
      var x = aim.x;
      var y = aim.y;
      var used = true;

      if(key === 'arrowleft' || key === 'a') x -= step;
      else if(key === 'arrowright' || key === 'd') x += step;
      else if(key === 'arrowup' || key === 'w') y -= step;
      else if(key === 'arrowdown' || key === 's') y += step;
      else if(key === ' ' || key === 'enter') shootAim();
      else used = false;

      if(used){
        setAim(x, y);
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);
  }

  async function requestMotionPermission(){
    try{
      if(window.DeviceOrientationEvent &&
         typeof window.DeviceOrientationEvent.requestPermission === 'function'){

        var res = await window.DeviceOrientationEvent.requestPermission();

        if(res !== 'granted'){
          showHint('ยังไม่ได้อนุญาตการเอียงเครื่อง ใช้แตะ/เมาส์เล็งแทนได้');
          return;
        }
      }

      aim.motionEnabled = true;
      aim.orientationBase = null;

      var btn = document.getElementById('hha-cvr-motion-btn');
      if(btn) btn.classList.remove('show');

      showHint('เปิดการเอียงเครื่องแล้ว • เอียงเพื่อเล็ง');
    }catch(e){
      showHint('เปิด motion ไม่สำเร็จ ใช้เมาส์/แตะลากเพื่อเล็งแทน');
    }
  }

  function bindOrientationAim(){
    window.addEventListener('deviceorientation', function(ev){
      if(!isCvr()) return;

      /*
        Android มักใช้ได้ทันที
        iOS ต้องกดปุ่ม permission ก่อน
      */
      if(window.DeviceOrientationEvent &&
         typeof window.DeviceOrientationEvent.requestPermission === 'function' &&
         !aim.motionEnabled){
        return;
      }

      var gamma = Number(ev.gamma || 0); // left/right
      var beta = Number(ev.beta || 0);   // up/down

      if(!Number.isFinite(gamma) || !Number.isFinite(beta)) return;

      if(!aim.orientationBase){
        aim.orientationBase = { gamma:gamma, beta:beta };
      }

      var dx = gamma - aim.orientationBase.gamma;
      var dy = beta - aim.orientationBase.beta;

      var v = viewport();

      var x = (v.w / 2) + clamp(dx * 16, -v.w * .44, v.w * .44);
      var y = (v.h / 2) + clamp(dy * 11, -v.h * .38, v.h * .38);

      setAim(x, y);
    }, { passive:true });
  }

  function bindShootOverride(){
    function onShoot(ev){
      if(!isCvr()) return;

      var ok = shootAim();

      try{
        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }catch(e){}

      return ok;
    }

    window.addEventListener('hha:shoot', onShoot, true);
    document.addEventListener('hha:shoot', onShoot, true);

    document.addEventListener('click', function(ev){
      if(!isCvr()) return;
      if(aim.firing) return;

      if(shouldIgnoreControl(ev.target)) return;

      shootAim();

      ev.preventDefault();
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }, true);

    document.addEventListener('touchend', function(ev){
      if(!isCvr()) return;
      if(aim.firing) return;

      if(shouldIgnoreControl(ev.target)) return;

      var t = ev.changedTouches && ev.changedTouches[0];
      if(t){
        setAim(t.clientX, t.clientY);
      }

      shootAim();
    }, { passive:false, capture:true });
  }

  function observeTargets(){
    var playfield = document.getElementById('hha-hydration-playfield');
    if(!playfield) return;

    var mo = new MutationObserver(function(){
      renderAim();
    });

    mo.observe(playfield, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['style','class']
    });
  }

  function boot(){
    if(!isCvr()) return;

    document.body.classList.add('hha-view-cvr');
    document.body.dataset.view = 'cvr';

    initAim();
    ensureReticle();
    ensureHint();
    ensureMotionButton();

    bindPointerAim();
    bindKeyboardAim();
    bindOrientationAim();
    bindShootOverride();
    observeTargets();

    showHint('🥽 cVR พร้อมแล้ว: ขยับเมาส์/เอียงเครื่องเพื่อเล็ง');

    window.addEventListener('resize', function(){
      initAim();
    }, { passive:true });

    setInterval(renderAim, 160);

    window.HHA = window.HHA || {};
    window.HHA.HydrationCvrAim = {
      version: PATCH,
      setAim: setAim,
      shootAim: shootAim,
      findTargetAtAim: findTargetAtAim
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
/* =========================================================
   PATCH v20260516-hydration-cvr-world-pan-pack18
   cVR real behavior:
   - crosshair fixed at center
   - playfield/world moves with mouse / touch drag / keyboard / device tilt
   - tap/click shoots target at center
   Append at end of /herohealth/hydration-vr/hydration-vr.mode-patch.js
   ========================================================= */

(function(){
  'use strict';

  if(window.HHA_HYDRATION_CVR_WORLD_PAN_PACK18_LOADED) return;
  window.HHA_HYDRATION_CVR_WORLD_PAN_PACK18_LOADED = true;

  var PATCH = 'v20260516-hydration-cvr-world-pan-pack18';

  var pan = {
    x:0,
    y:0,
    maxX:210,
    maxY:140,
    drag:false,
    dragStartX:0,
    dragStartY:0,
    startPanX:0,
    startPanY:0,
    orientationBase:null,
    motionEnabled:false,
    firing:false
  };

  function getUrl(){
    try{ return new URL(location.href); }
    catch(e){ return new URL('./run.html', location.origin); }
  }

  function getView(){
    try{
      return getUrl().searchParams.get('view') || document.body.dataset.view || 'mobile';
    }catch(e){
      return document.body.dataset.view || 'mobile';
    }
  }

  function isCvr(){
    return getView() === 'cvr' || document.body.classList.contains('hha-view-cvr');
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) n = 0;
    return Math.max(min, Math.min(max, n));
  }

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function viewport(){
    return {
      w: window.innerWidth || document.documentElement.clientWidth || 390,
      h: window.innerHeight || document.documentElement.clientHeight || 800
    };
  }

  function refreshLimits(){
    var v = viewport();
    pan.maxX = Math.max(120, Math.min(260, v.w * 0.18));
    pan.maxY = Math.max(90, Math.min(180, v.h * 0.16));
  }

  function setPan(x, y){
    refreshLimits();

    pan.x = clamp(x, -pan.maxX, pan.maxX);
    pan.y = clamp(y, -pan.maxY, pan.maxY);

    renderPan();
  }

  function renderPan(){
    if(!isCvr()) return;

    document.body.classList.add('hha-cvr-world-pan');

    document.documentElement.style.setProperty('--hha-cvr-pan-x', Math.round(pan.x) + 'px');
    document.documentElement.style.setProperty('--hha-cvr-pan-y', Math.round(pan.y) + 'px');

    document.documentElement.style.setProperty('--hha-cvr-bg-pan-x', Math.round(pan.x * 0.18) + 'px');
    document.documentElement.style.setProperty('--hha-cvr-bg-pan-y', Math.round(pan.y * 0.14) + 'px');

    var reticle = ensureReticle();
    var target = findTargetAtCenter();

    if(reticle){
      reticle.classList.toggle('is-hit', !!target);
    }
  }

  function ensureReticle(){
    if(!isCvr()) return null;

    var el = document.getElementById('hha-cvr-center-reticle');
    if(el) return el;

    el = document.createElement('div');
    el.id = 'hha-cvr-center-reticle';
    el.className = 'hha-cvr-center-reticle';
    el.innerHTML = '<i></i>';
    document.body.appendChild(el);

    return el;
  }

  function ensureHint(){
    var el = document.getElementById('hha-cvr-world-hint');
    if(el) return el;

    el = document.createElement('div');
    el.id = 'hha-cvr-world-hint';
    el.className = 'hha-cvr-world-hint';
    el.textContent = '🥽 crosshair อยู่กลางจอ • ขยับฉากเพื่อเล็ง';
    document.body.appendChild(el);

    return el;
  }

  function showHint(text){
    if(!isCvr()) return;

    var el = ensureHint();
    el.textContent = text || '🥽 crosshair อยู่กลางจอ • ขยับฉากเพื่อเล็ง';
    el.classList.add('show');

    clearTimeout(el._hhaT);
    el._hhaT = setTimeout(function(){
      el.classList.remove('show');
    }, 1800);
  }

  function ensureMotionButton(){
    if(!isCvr()) return null;

    var btn = document.getElementById('hha-cvr-motion-btn');
    if(btn) return btn;

    btn = document.createElement('button');
    btn.id = 'hha-cvr-motion-btn';
    btn.className = 'hha-cvr-motion-btn';
    btn.type = 'button';
    btn.textContent = '📱 เปิดการเอียงเครื่องเพื่อเล็ง';

    btn.addEventListener('click', requestMotionPermission);
    document.body.appendChild(btn);

    if(window.DeviceOrientationEvent &&
       typeof window.DeviceOrientationEvent.requestPermission === 'function'){
      btn.classList.add('show');
    }

    return btn;
  }

  function centerPoint(){
    var v = viewport();

    return {
      x: Math.round(v.w / 2),
      y: Math.round(v.h / 2)
    };
  }

  function rectCenterDistance(rect, x, y){
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var dx = cx - x;
    var dy = cy - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function findTargetAtCenter(){
    if(!isCvr()) return null;

    var p = centerPoint();

    var targets = qa('.hha-hydration-target')
      .filter(function(t){
        if(!t || !t.isConnected) return false;

        var r = t.getBoundingClientRect();
        if(r.width <= 0 || r.height <= 0) return false;

        var pad = 34;

        return (
          p.x >= r.left - pad &&
          p.x <= r.right + pad &&
          p.y >= r.top - pad &&
          p.y <= r.bottom + pad
        );
      })
      .sort(function(a,b){
        return rectCenterDistance(a.getBoundingClientRect(), p.x, p.y) -
               rectCenterDistance(b.getBoundingClientRect(), p.x, p.y);
      });

    return targets[0] || null;
  }

  function fireClick(target){
    if(!target) return false;

    var p = centerPoint();
    pan.firing = true;

    try{
      target.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles:true,
        cancelable:true,
        pointerType:'mouse',
        clientX:p.x,
        clientY:p.y
      }));
    }catch(e){}

    try{
      target.dispatchEvent(new MouseEvent('mousedown', {
        bubbles:true,
        cancelable:true,
        clientX:p.x,
        clientY:p.y
      }));
    }catch(e){}

    try{
      target.click();
    }catch(e){
      try{
        target.dispatchEvent(new MouseEvent('click', {
          bubbles:true,
          cancelable:true,
          clientX:p.x,
          clientY:p.y
        }));
      }catch(_){}
    }

    setTimeout(function(){
      pan.firing = false;
    }, 0);

    return true;
  }

  function shootCenter(){
    if(!isCvr()) return false;

    var target = findTargetAtCenter();

    if(target){
      target.dataset.hhaCvrWorldShot = PATCH;
      return fireClick(target);
    }

    showHint('ยังไม่มีเป้าอยู่กลางจอ • ขยับฉากให้เป้ามาอยู่ตรง crosshair');
    return false;
  }

  function shouldIgnoreControl(target){
    return !!(
      target &&
      target.closest &&
      target.closest('button, a, input, select, textarea, .hha-control-btn, #hha-cvr-motion-btn, #hha-cvr-world-hint')
    );
  }

  function bindMouseWorldPan(){
    document.addEventListener('mousemove', function(ev){
      if(!isCvr()) return;

      var v = viewport();
      var dx = ev.clientX - v.w / 2;
      var dy = ev.clientY - v.h / 2;

      /*
        mouse ไปขวา = เหมือนหันขวา
        ฉากต้องเลื่อนไปซ้าย
      */
      setPan(-dx * 0.42, -dy * 0.34);
    }, { passive:true });
  }

  function bindTouchWorldPan(){
    document.addEventListener('touchstart', function(ev){
      if(!isCvr()) return;
      if(shouldIgnoreControl(ev.target)) return;

      var t = ev.touches && ev.touches[0];
      if(!t) return;

      pan.drag = true;
      pan.dragStartX = t.clientX;
      pan.dragStartY = t.clientY;
      pan.startPanX = pan.x;
      pan.startPanY = pan.y;
    }, { passive:true, capture:true });

    document.addEventListener('touchmove', function(ev){
      if(!isCvr()) return;
      if(!pan.drag) return;

      var t = ev.touches && ev.touches[0];
      if(!t) return;

      var dx = t.clientX - pan.dragStartX;
      var dy = t.clientY - pan.dragStartY;

      /*
        ลากซ้าย/ขวา = ดันฉากตามนิ้ว
        ใช้สำหรับทดสอบบนมือถือ
      */
      setPan(pan.startPanX + dx, pan.startPanY + dy);
    }, { passive:true, capture:true });

    document.addEventListener('touchend', function(ev){
      if(!isCvr()) return;
      if(shouldIgnoreControl(ev.target)) return;

      pan.drag = false;

      shootCenter();

      try{
        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }catch(e){}
    }, { passive:false, capture:true });
  }

  function bindKeyboardWorldPan(){
    document.addEventListener('keydown', function(ev){
      if(!isCvr()) return;

      var key = String(ev.key || '').toLowerCase();
      var step = ev.shiftKey ? 46 : 24;
      var x = pan.x;
      var y = pan.y;
      var used = true;

      if(key === 'arrowleft' || key === 'a') x += step;
      else if(key === 'arrowright' || key === 'd') x -= step;
      else if(key === 'arrowup' || key === 'w') y += step;
      else if(key === 'arrowdown' || key === 's') y -= step;
      else if(key === ' ' || key === 'enter') shootCenter();
      else used = false;

      if(used){
        setPan(x, y);
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);
  }

  async function requestMotionPermission(){
    try{
      if(window.DeviceOrientationEvent &&
         typeof window.DeviceOrientationEvent.requestPermission === 'function'){

        var res = await window.DeviceOrientationEvent.requestPermission();

        if(res !== 'granted'){
          showHint('ยังไม่ได้อนุญาตการเอียงเครื่อง ใช้ลากนิ้ว/เมาส์แทนได้');
          return;
        }
      }

      pan.motionEnabled = true;
      pan.orientationBase = null;

      var btn = document.getElementById('hha-cvr-motion-btn');
      if(btn) btn.classList.remove('show');

      showHint('เปิดการเอียงเครื่องแล้ว • crosshair อยู่กลางจอ');
    }catch(e){
      showHint('เปิด motion ไม่สำเร็จ ใช้ลากนิ้ว/เมาส์แทนได้');
    }
  }

  function bindOrientationWorldPan(){
    window.addEventListener('deviceorientation', function(ev){
      if(!isCvr()) return;

      if(window.DeviceOrientationEvent &&
         typeof window.DeviceOrientationEvent.requestPermission === 'function' &&
         !pan.motionEnabled){
        return;
      }

      var gamma = Number(ev.gamma || 0);
      var beta = Number(ev.beta || 0);

      if(!Number.isFinite(gamma) || !Number.isFinite(beta)) return;

      if(!pan.orientationBase){
        pan.orientationBase = { gamma:gamma, beta:beta };
      }

      var dx = gamma - pan.orientationBase.gamma;
      var dy = beta - pan.orientationBase.beta;

      /*
        หันขวา = ฉากเลื่อนซ้าย
        ก้ม/เงย = ฉากเลื่อนขึ้น/ลง
      */
      setPan(-dx * 18, -dy * 12);
    }, { passive:true });
  }

  function bindShootAtWindowLevel(){
    /*
      สำคัญ:
      ใช้ window capture เพื่อกัน listener เก่าของ Pack17 ที่ยิงจาก aim-reticle
      เพราะ window capture จะมาก่อน document capture
    */
    window.addEventListener('click', function(ev){
      if(!isCvr()) return;
      if(pan.firing) return;
      if(shouldIgnoreControl(ev.target)) return;

      shootCenter();

      ev.preventDefault();
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }, true);

    window.addEventListener('touchend', function(ev){
      if(!isCvr()) return;
      if(pan.firing) return;
      if(shouldIgnoreControl(ev.target)) return;

      shootCenter();

      ev.preventDefault();
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }, { passive:false, capture:true });

    window.addEventListener('hha:shoot', function(ev){
      if(!isCvr()) return;

      shootCenter();

      try{
        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }catch(e){}
    }, true);
  }

  function bindRecenter(){
    document.addEventListener('click', function(ev){
      if(!isCvr()) return;

      var t = ev.target;
      if(!t) return;

      var text = String(t.textContent || '').toLowerCase();
      var isRecenter =
        (t.closest && t.closest('[data-hha-recenter], .hha-recenter, #hha-recenter, #hha-vr-recenter')) ||
        text.indexOf('recenter') !== -1 ||
        text.indexOf('จัดกลาง') !== -1;

      if(!isRecenter) return;

      pan.orientationBase = null;
      setPan(0, 0);
      showHint('จัดมุมมองกลับกึ่งกลางแล้ว');
    }, true);
  }

  function observeTargets(){
    var playfield = document.getElementById('hha-hydration-playfield');
    if(!playfield) return;

    var mo = new MutationObserver(function(){
      renderPan();
    });

    mo.observe(playfield, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['style','class']
    });
  }

  function boot(){
    if(!isCvr()) return;

    document.body.classList.add('hha-view-cvr');
    document.body.classList.add('hha-cvr-world-pan');
    document.body.dataset.view = 'cvr';

    refreshLimits();
    ensureReticle();
    ensureHint();
    ensureMotionButton();

    setPan(0, 0);

    bindMouseWorldPan();
    bindTouchWorldPan();
    bindKeyboardWorldPan();
    bindOrientationWorldPan();
    bindShootAtWindowLevel();
    bindRecenter();
    observeTargets();

    showHint('🥽 โหมด Cardboard: crosshair คงที่กลางจอ • ฉากจะขยับแทน');

    window.addEventListener('resize', function(){
      refreshLimits();
      setPan(0, 0);
    }, { passive:true });

    setInterval(renderPan, 180);

    window.HHA = window.HHA || {};
    window.HHA.HydrationCvrWorldPan = {
      version: PATCH,
      setPan: setPan,
      shootCenter: shootCenter,
      findTargetAtCenter: findTargetAtCenter,
      recenter: function(){
        pan.orientationBase = null;
        setPan(0, 0);
      }
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
/* =========================================================
   PATCH v20260516-hydration-summary-scroll-unlock-pack19
   Detect final summary and unlock page scroll
   Append at end of /herohealth/hydration-vr/hydration-vr.mode-patch.js
   ========================================================= */

(function(){
  'use strict';

  if(window.HHA_HYDRATION_SUMMARY_SCROLL_PACK19_LOADED) return;
  window.HHA_HYDRATION_SUMMARY_SCROLL_PACK19_LOADED = true;

  var PATCH = 'v20260516-hydration-summary-scroll-unlock-pack19';

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function isVisible(el){
    if(!el || !el.isConnected) return false;

    var r = el.getBoundingClientRect();
    var style = window.getComputedStyle(el);

    return (
      r.width > 0 &&
      r.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity || 1) !== 0
    );
  }

  function findSummary(){
    var selectors = [
      '#hha-hydration-summary',
      '.hha-hydration-summary',
      '#hydration-summary',
      '.hha-summary-panel',
      '.hha-summary',
      '.hha-summary-card',
      '[data-hha-summary]'
    ];

    for(var i=0; i<selectors.length; i++){
      var el = q(selectors[i]);
      if(el && isVisible(el)) return el;
    }

    /*
      fallback:
      ถ้าหน้ามีคำว่า คะแนนรวม / Badge / Mission / Heat Boss
      และไม่มี target แล้ว ให้ถือว่าเป็น Summary
    */
    var bodyText = String(document.body.textContent || '');
    var hasSummaryText =
      /คะแนนรวม|Badge|Mission|Heat Boss|Hydration|Combo|ภารกิจเติมน้ำสำเร็จ|ยังไม่ชนะ/i.test(bodyText);

    var hasTarget = q('.hha-hydration-target');

    if(hasSummaryText && !hasTarget){
      return document.body;
    }

    return null;
  }

  function unlockScroll(summary){
    if(!summary) return;

    document.body.classList.add('hha-hydration-summary-open');
    document.documentElement.classList.add('hha-hydration-summary-open-html');

    /*
      บังคับเปิด scroll เพราะบาง CSS เดิมล็อก body/html ไว้สำหรับ gameplay
    */
    document.documentElement.style.height = 'auto';
    document.documentElement.style.minHeight = '100svh';
    document.documentElement.style.overflowY = 'auto';
    document.documentElement.style.overflowX = 'hidden';

    document.body.style.height = 'auto';
    document.body.style.minHeight = '100svh';
    document.body.style.overflowY = 'auto';
    document.body.style.overflowX = 'hidden';
    document.body.style.touchAction = 'auto';

    var app = q('#hha-hydration-app');
    var stage = q('#hha-hydration-stage');
    var playfield = q('#hha-hydration-playfield');

    [app, stage, playfield].forEach(function(el){
      if(!el) return;

      el.style.height = 'auto';
      el.style.minHeight = '100svh';
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
      el.style.position = 'relative';
    });

    if(summary !== document.body){
      summary.style.maxHeight = 'none';
      summary.style.height = 'auto';
      summary.style.overflow = 'visible';
      summary.style.paddingBottom = '140px';
      summary.dataset.hhaScrollUnlock = PATCH;
    }
  }

  function lockGameplayIfNoSummary(){
    var summary = findSummary();

    if(summary){
      unlockScroll(summary);
      return;
    }

    /*
      อย่าล็อกกลับระหว่างเกม เพราะ engine เดิมคุมอยู่แล้ว
      แค่ไม่ทำอะไรถ้ายังไม่มี summary
    */
  }

  function boot(){
    lockGameplayIfNoSummary();

    var mo = new MutationObserver(function(){
      lockGameplayIfNoSummary();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style']
    });

    setInterval(lockGameplayIfNoSummary, 700);

    window.HHA = window.HHA || {};
    window.HHA.HydrationSummaryScrollUnlock = {
      version: PATCH,
      unlock: function(){
        unlockScroll(findSummary() || document.body);
      }
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
