/* =========================================================
   HeroHealth Hydration Mode Patch
   File: /herohealth/hydration-vr/hydration-vr.mode-patch.js
   Version: v20260516-pack21-clean-full

   Purpose:
   - view class: pc / mobile / cvr
   - mode class: solo / duet / race / battle / coop
   - target safe zone / spacing
   - summary action dedupe
   - latest summary save
   - cVR Cardboard behavior:
       crosshair fixed center + world/playfield moves
   - unlock scroll when final summary is shown
   - rescue start button if overlay/pointer state blocks it

   IMPORTANT:
   - Pack17 movable aim is intentionally removed.
   - Cardboard VR should NOT move the crosshair.
   - Cardboard VR should keep crosshair fixed and move the world/targets.
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260516-pack21-clean-full';

  if(window.HHA_HYDRATION_MODE_PATCH_PACK21_LOADED){
    return;
  }
  window.HHA_HYDRATION_MODE_PATCH_PACK21_LOADED = true;

  /* =========================================================
     Basic helpers
     ========================================================= */

  function getUrl(){
    try{
      return new URL(location.href);
    }catch(e){
      return new URL('./run.html', location.origin);
    }
  }

  function getParam(k, d){
    try{
      return getUrl().searchParams.get(k) || d;
    }catch(e){
      return d;
    }
  }

  function q(sel, root){
    try{
      return (root || document).querySelector(sel);
    }catch(e){
      return null;
    }
  }

  function qa(sel, root){
    try{
      return Array.from((root || document).querySelectorAll(sel));
    }catch(e){
      return [];
    }
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function esc(s){
    return String(s || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  function viewport(){
    return {
      w: window.innerWidth || document.documentElement.clientWidth || 390,
      h: window.innerHeight || document.documentElement.clientHeight || 800
    };
  }

  function getView(){
    var v = getParam('view', document.body.dataset.view || document.body.dataset.hhaView || 'mobile');
    return ['pc','mobile','cvr'].includes(v) ? v : 'mobile';
  }

  function getMode(){
    var m = getParam('mode', document.body.dataset.mode || 'solo');
    return ['solo','duet','race','battle','coop'].includes(m) ? m : 'solo';
  }

  function isCvr(){
    return getView() === 'cvr' || document.body.classList.contains('hha-view-cvr');
  }

  function isStartScreenOpen(){
    return !!(
      q('.hha-hydration-start') ||
      q('.hha-start') ||
      q('[data-hha-hydration-start]') ||
      q('.hha-start-btn')
    );
  }

  function isGameRunning(){
    try{
      return !!(
        window.HHA &&
        window.HHA.Hydration &&
        window.HHA.Hydration.started &&
        !window.HHA.Hydration.destroyed
      );
    }catch(e){
      return false;
    }
  }

  /* =========================================================
     View / Mode classes
     ========================================================= */

  function setViewModeClass(){
    var view = getView();
    var mode = getMode();

    document.body.dataset.view = view;
    document.body.dataset.mode = mode;
    document.body.dataset.hhaView = view;

    document.body.classList.remove(
      'hha-view-pc',
      'hha-view-mobile',
      'hha-view-cvr'
    );

    document.body.classList.remove(
      'hha-mode-solo',
      'hha-mode-duet',
      'hha-mode-race',
      'hha-mode-battle',
      'hha-mode-coop'
    );

    document.body.classList.add('hha-view-' + view);
    document.body.classList.add('hha-mode-' + mode);

    document.body.classList.toggle('hha-multiplayer', mode !== 'solo');

    if(view === 'cvr'){
      document.body.classList.add('hha-cardboard-ready');
    }
  }

  function ensureModeBadge(){
    var mode = getMode();

    if(mode === 'solo'){
      var oldSolo = document.getElementById('hha-mode-badge');
      if(oldSolo){
        try{ oldSolo.remove(); }catch(e){}
      }
      return;
    }

    var old = document.getElementById('hha-mode-badge');
    if(old) return;

    var room = getParam('room', getParam('roomId',''));

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
     Target safe zone + spacing
     ========================================================= */

  function safeTopPx(){
    var view = getView();
    var v = viewport();

    if(view === 'cvr') return 190;
    if(v.w <= 520 && v.h >= 760) return 245;
    if(v.w <= 520) return 225;
    if(v.w <= 820) return 185;

    return 135;
  }

  function safeBottomPad(){
    var v = viewport();

    if(v.w <= 520) return 84;
    return 48;
  }

  function minDistance(){
    var view = getView();
    var v = viewport();

    if(view === 'cvr') return 96;
    if(v.w <= 520) return 82;
    if(v.w <= 820) return 90;

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
      left:leftMin + Math.random() * Math.max(1, leftMax - leftMin),
      top:topMin + Math.random() * Math.max(1, topMax - topMin)
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

        var all = qa('.hha-hydration-target', playfield).filter(function(t){
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
     Summary actions + latest summary
     ========================================================= */

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
      'roomId',
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
        room:getParam('room', getParam('roomId','')),
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
      return (
        text.indexOf('cooldown') !== -1 ||
        text.indexOf('คูลดาวน์') !== -1 ||
        text.indexOf('ทำ cooldown') !== -1
      );
    }

    if(key === 'zone'){
      return (
        text.indexOf('nutrition') !== -1 ||
        text.indexOf('zone') !== -1 ||
        text.indexOf('กลับ') !== -1
      );
    }

    if(key === 'replay'){
      return (
        text.indexOf('เล่นใหม่') !== -1 ||
        text.indexOf('เล่นอีกครั้ง') !== -1 ||
        text.indexOf('replay') !== -1
      );
    }

    return false;
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
    /*
      สำคัญ:
      ถ้ายังเป็นหน้า Start Overlay ห้าม detect เป็น Summary
      เพราะ start card มีคำว่า Hydration / Mission / Combo อยู่เหมือนกัน
    */
    if(isStartScreenOpen()){
      return null;
    }

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

    var bodyText = String(document.body.textContent || '');

    var hasSummaryText =
      /คะแนนรวม|Badge|Mission|Heat Boss|Hydration|Combo|ภารกิจเติมน้ำสำเร็จ|ยังไม่ชนะ|Gold|Silver|Bronze/i.test(bodyText);

    var hasTarget = q('.hha-hydration-target');
    var hasStart = isStartScreenOpen();

    if(hasSummaryText && !hasTarget && !hasStart && !isGameRunning()){
      return document.body;
    }

    return null;
  }

  function injectSummaryActions(summary){
    if(!summary || !summary.isConnected) return;

    saveLastSummary(summary);

    var buttons = qa('button, a', summary);

    var hasCooldown = buttons.some(function(b){
      return textHasAction(b.textContent, 'cooldown');
    });

    var hasZone = buttons.some(function(b){
      return textHasAction(b.textContent, 'zone');
    });

    var hasReplay = buttons.some(function(b){
      return textHasAction(b.textContent, 'replay');
    });

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

    if(c){
      c.addEventListener('click', function(){
        try{
          if(typeof window.goHydrationCooldownThenHub === 'function'){
            window.goHydrationCooldownThenHub();
            return;
          }
        }catch(e){}

        location.href = cooldownUrl();
      });
    }

    if(z){
      z.addEventListener('click', function(){
        location.href = nutritionZoneUrl();
      });
    }

    if(r){
      r.addEventListener('click', function(){
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
  }

  function scanSummary(){
    var summary = findSummary();

    if(summary){
      injectSummaryActions(summary);
      unlockSummaryScroll(summary);
    }
  }

  /* =========================================================
     Pack18: cVR World Pan
     - crosshair fixed center
     - world/playfield moves
     ========================================================= */

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

  function refreshPanLimits(){
    var v = viewport();

    pan.maxX = Math.max(120, Math.min(260, v.w * 0.18));
    pan.maxY = Math.max(90, Math.min(180, v.h * 0.16));
  }

  function setPan(x, y){
    refreshPanLimits();

    pan.x = clamp(x, -pan.maxX, pan.maxX);
    pan.y = clamp(y, -pan.maxY, pan.maxY);

    renderPan();
  }

  function ensureCenterReticle(){
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

  function ensureWorldHint(){
    var el = document.getElementById('hha-cvr-world-hint');
    if(el) return el;

    el = document.createElement('div');
    el.id = 'hha-cvr-world-hint';
    el.className = 'hha-cvr-world-hint';
    el.textContent = '🥽 crosshair อยู่กลางจอ • ขยับฉากเพื่อเล็ง';

    document.body.appendChild(el);

    return el;
  }

  function showWorldHint(text){
    if(!isCvr()) return;

    var el = ensureWorldHint();

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
      x:Math.round(v.w / 2),
      y:Math.round(v.h / 2)
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

  function renderPan(){
    if(!isCvr()) return;

    document.body.classList.add('hha-cvr-world-pan');

    document.documentElement.style.setProperty('--hha-cvr-pan-x', Math.round(pan.x) + 'px');
    document.documentElement.style.setProperty('--hha-cvr-pan-y', Math.round(pan.y) + 'px');

    document.documentElement.style.setProperty('--hha-cvr-bg-pan-x', Math.round(pan.x * 0.18) + 'px');
    document.documentElement.style.setProperty('--hha-cvr-bg-pan-y', Math.round(pan.y * 0.14) + 'px');

    var reticle = ensureCenterReticle();
    var target = findTargetAtCenter();

    if(reticle){
      reticle.classList.toggle('is-hit', !!target);
    }
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

    showWorldHint('ยังไม่มีเป้าอยู่กลางจอ • ขยับฉากให้เป้ามาอยู่ตรง crosshair');
    return false;
  }

  function shouldIgnoreControl(target){
    return !!(
      target &&
      target.closest &&
      target.closest(
        'button, a, input, select, textarea, .hha-control-btn, #hha-cvr-motion-btn, #hha-cvr-world-hint'
      )
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
          showWorldHint('ยังไม่ได้อนุญาตการเอียงเครื่อง ใช้ลากนิ้ว/เมาส์แทนได้');
          return;
        }
      }

      pan.motionEnabled = true;
      pan.orientationBase = null;

      var btn = document.getElementById('hha-cvr-motion-btn');
      if(btn) btn.classList.remove('show');

      showWorldHint('เปิดการเอียงเครื่องแล้ว • crosshair อยู่กลางจอ');
    }catch(e){
      showWorldHint('เปิด motion ไม่สำเร็จ ใช้ลากนิ้ว/เมาส์แทนได้');
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
        pan.orientationBase = {
          gamma:gamma,
          beta:beta
        };
      }

      var dx = gamma - pan.orientationBase.gamma;
      var dy = beta - pan.orientationBase.beta;

      setPan(-dx * 18, -dy * 12);
    }, { passive:true });
  }

  function bindShootAtWindowLevel(){
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
      showWorldHint('จัดมุมมองกลับกึ่งกลางแล้ว');
    }, true);
  }

  function observeTargetsForPan(){
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

  function bootCvrWorldPan(){
    if(!isCvr()) return;

    document.body.classList.add('hha-view-cvr');
    document.body.classList.add('hha-cvr-world-pan');
    document.body.dataset.view = 'cvr';
    document.body.dataset.hhaView = 'cvr';

    /*
      ลบ reticle แบบ Pack17 ถ้ายังมีค้างจาก cache
    */
    var oldAim = document.getElementById('hha-cvr-aim-reticle');
    if(oldAim){
      try{ oldAim.remove(); }catch(e){}
    }

    refreshPanLimits();
    ensureCenterReticle();
    ensureWorldHint();
    ensureMotionButton();

    setPan(0, 0);

    bindMouseWorldPan();
    bindTouchWorldPan();
    bindKeyboardWorldPan();
    bindOrientationWorldPan();
    bindShootAtWindowLevel();
    bindRecenter();
    observeTargetsForPan();

    showWorldHint('🥽 Cardboard: crosshair คงที่กลางจอ • ฉากขยับแทน');

    window.addEventListener('resize', function(){
      refreshPanLimits();
      setPan(0, 0);
    }, { passive:true });

    setInterval(renderPan, 180);

    window.HHA = window.HHA || {};
    window.HHA.HydrationCvrWorldPan = {
      version:PATCH,
      setPan:setPan,
      shootCenter:shootCenter,
      findTargetAtCenter:findTargetAtCenter,
      recenter:function(){
        pan.orientationBase = null;
        setPan(0, 0);
      }
    };
  }

  /* =========================================================
     Pack19: Summary Scroll Unlock
     ========================================================= */

  function unlockSummaryScroll(summary){
    if(!summary) return;
    if(isStartScreenOpen()) return;

    document.body.classList.add('hha-hydration-summary-open');
    document.documentElement.classList.add('hha-hydration-summary-open-html');

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

  function clearSummaryMode(){
    document.body.classList.remove('hha-hydration-summary-open');
    document.documentElement.classList.remove('hha-hydration-summary-open-html');

    document.documentElement.style.overflowY = '';
    document.documentElement.style.overflowX = '';
    document.documentElement.style.height = '';
    document.documentElement.style.minHeight = '';

    document.body.style.overflowY = '';
    document.body.style.overflowX = '';
    document.body.style.height = '';
    document.body.style.minHeight = '';
    document.body.style.touchAction = '';

    var app = q('#hha-hydration-app');
    var stage = q('#hha-hydration-stage');
    var playfield = q('#hha-hydration-playfield');

    [app, stage, playfield].forEach(function(el){
      if(!el) return;

      el.style.overflow = '';
      el.style.height = '';
      el.style.minHeight = '';
      el.style.maxHeight = '';
      el.style.position = '';
    });
  }

  function checkSummaryScroll(){
    if(isStartScreenOpen()){
      clearSummaryMode();
      return;
    }

    var summary = findSummary();
    if(summary){
      unlockSummaryScroll(summary);
    }
  }

  /* =========================================================
     Pack20: Start Button Rescue
     ========================================================= */

  function forceStartHydration(){
    if(!isStartScreenOpen()) return false;

    clearSummaryMode();

    try{
      if(window.HHA && window.HHA.Hydration){
        window.HHA.Hydration.started = false;
        window.HHA.Hydration.destroyed = false;
      }
    }catch(e){}

    if(typeof window.beginHydrationFromOverlay === 'function'){
      try{
        window.beginHydrationFromOverlay();
        return true;
      }catch(err){
        try{
          console.warn('[Hydration Start Rescue] beginHydrationFromOverlay failed:', err);
        }catch(e){}
      }
    }

    var btn = q('.hha-start-btn');
    if(btn && typeof btn.onclick === 'function'){
      try{
        btn.onclick();
        return true;
      }catch(e){}
    }

    return false;
  }

  function bindStartButtons(){
    qa('.hha-start-btn, [data-hha-start], [data-hha-hydration-start-btn]').forEach(function(btn){
      if(btn.dataset.hhaStartRescue === PATCH) return;

      btn.dataset.hhaStartRescue = PATCH;

      btn.addEventListener('pointerdown', function(){
        clearSummaryMode();
      }, true);

      btn.addEventListener('touchstart', function(){
        clearSummaryMode();
      }, { passive:true, capture:true });

      btn.addEventListener('click', function(ev){
        var ok = forceStartHydration();

        if(ok){
          ev.preventDefault();
          ev.stopPropagation();
          if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        }
      }, true);
    });
  }

  function bindGlobalStartRescue(){
    document.addEventListener('click', function(ev){
      var t = ev.target;
      if(!t || !t.closest) return;

      var btn = t.closest('.hha-start-btn, [data-hha-start], [data-hha-hydration-start-btn]');
      if(!btn) return;

      var ok = forceStartHydration();

      if(ok){
        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }
    }, true);
  }

  function preventFalseSummaryUnlock(){
    if(!isStartScreenOpen()) return;

    clearSummaryMode();
  }

  /* =========================================================
     Boot
     ========================================================= */

  function boot(){
    setViewModeClass();
    ensureModeBadge();

    observeTargets();

    bootCvrWorldPan();

    bindStartButtons();
    bindGlobalStartRescue();

    scanSummary();
    checkSummaryScroll();
    preventFalseSummaryUnlock();

    var mo = new MutationObserver(function(){
      setViewModeClass();
      bindStartButtons();
      scanSummary();
      checkSummaryScroll();
      preventFalseSummaryUnlock();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style']
    });

    setInterval(function(){
      setViewModeClass();
      bindStartButtons();
      scanSummary();
      checkSummaryScroll();
      preventFalseSummaryUnlock();
    }, 700);

    window.HHA = window.HHA || {};
    window.HHA.HydrationModePatch = {
      version:PATCH,
      getView:getView,
      getMode:getMode,
      nutritionZoneUrl:nutritionZoneUrl,
      cooldownUrl:cooldownUrl,
      summaryUnlock:function(){
        unlockSummaryScroll(findSummary() || document.body);
      },
      clearSummaryMode:clearSummaryMode,
      start:function(){
        return forceStartHydration();
      },
      cvrWorldPan:window.HHA.HydrationCvrWorldPan || null
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
