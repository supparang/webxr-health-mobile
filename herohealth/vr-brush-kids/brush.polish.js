/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.polish.js
 * PATCH v20260511-P34-BRUSH-KIDS-GAMEPLAY-POLISH
 *
 * Purpose:
 * - เพิ่มความสนุกแบบ child-friendly โดยไม่รื้อ core game
 * - Plaque/Germ targets เคลื่อนที่เบา ๆ
 * - Rhythm brushing bonus
 * - Combo / Sparkle / Coach micro-tip
 * - รองรับ PC / Mobile / cVR ผ่าน hha:brushTap
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH_ID = 'v20260511-P34-BRUSH-KIDS-GAMEPLAY-POLISH';

  const STATE = {
    mounted: false,
    enabled: true,
    score: 0,
    combo: 0,
    bestCombo: 0,
    cleaned: 0,
    wave: 1,
    activeTargets: [],
    targetId: 0,
    lastBrushAt: 0,
    rhythmGood: false,
    tipIndex: 0,
    timers: [],
    spawnTimer: null,
    rhythmTimer: null,
    startedAt: Date.now()
  };

  const TIPS = [
    'แปรงเบา ๆ ให้ครบทุกจุดนะ',
    'เล็งคราบฟัน แล้วแตะเพื่อแปรง',
    'อย่ารีบเกินไป แปรงให้สะอาด',
    'เก่งมาก! ครบทุกโซนแล้วฟันจะแข็งแรง',
    'เจอคราบฟันแล้ว แปรงเลย!'
  ];

  const TARGETS = [
    { icon:'🟡', label:'คราบฟัน', points:10, size:46 },
    { icon:'🦠', label:'เชื้อโรค', points:12, size:44 },
    { icon:'🍬', label:'น้ำตาลติดฟัน', points:14, size:48 },
    { icon:'✨', label:'จุดสะอาดพิเศษ', points:18, size:42 }
  ];

  function log(){
    try{ console.log('[BrushPolish]', PATCH_ID, ...arguments); }catch(_){}
  }

  function qs(){
    try{ return new URLSearchParams(WIN.location.search || ''); }
    catch(_){ return new URLSearchParams(); }
  }

  function param(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function isMainBrushPage(){
    const path = String(WIN.location.pathname || '');
    return /\/herohealth\/vr-brush-kids\/brush\.html$/i.test(path) ||
           /\/vr-brush-kids\/brush\.html$/i.test(path);
  }

  function isPlayMode(){
    const run = String(param('run','play')).toLowerCase();
    const phase = String(param('phase','')).toLowerCase();
    return run === 'play' && phase !== 'warmup' && phase !== 'cooldown';
  }

  function isCVR(){
    const view = String(param('view','')).toLowerCase();
    return view === 'cvr' || view === 'cardboard' || view === 'vr';
  }

  function clamp(n, min, max){
    return Math.max(min, Math.min(max, n));
  }

  function rand(min, max){
    return min + Math.random() * (max - min);
  }

  function pick(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-brush-polish-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-brush-polish-style';
    style.textContent = `
      :root{
        --hha-brush-polish-z: 99990;
      }

      #hha-brush-polish-layer{
        position:fixed;
        inset:0;
        z-index:var(--hha-brush-polish-z);
        pointer-events:none;
        overflow:hidden;
      }

      #hha-brush-polish-hud{
        position:fixed;
        top:calc(12px + env(safe-area-inset-top,0px));
        left:50%;
        transform:translateX(-50%);
        z-index:99991;
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        align-items:center;
        gap:8px;
        max-width:min(94vw,760px);
        pointer-events:none;
      }

      .hha-brush-pill{
        min-height:34px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 11px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        border:2px solid rgba(189,244,255,.95);
        box-shadow:0 10px 22px rgba(23,56,79,.12);
        color:#17384f;
        font-weight:1000;
        font-size:12px;
        line-height:1;
        white-space:nowrap;
      }

      #hha-brush-coach-tip{
        position:fixed;
        left:50%;
        bottom:calc(16px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:99991;
        width:min(92vw,560px);
        min-height:44px;
        display:flex;
        align-items:center;
        justify-content:center;
        text-align:center;
        padding:10px 14px;
        border-radius:22px;
        background:rgba(255,255,255,.94);
        border:2px solid rgba(255,217,93,.92);
        box-shadow:0 14px 34px rgba(23,56,79,.14);
        color:#17384f;
        font-size:14px;
        font-weight:1000;
        pointer-events:none;
      }

      .hha-brush-target{
        position:fixed;
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        border-radius:999px;
        background:radial-gradient(circle at 35% 28%,#fff,rgba(255,255,255,.82));
        border:3px solid rgba(255,217,93,.95);
        box-shadow:
          0 12px 28px rgba(23,56,79,.18),
          0 0 0 7px rgba(255,217,93,.22);
        font-size:26px;
        z-index:99992;
        cursor:pointer;
        pointer-events:auto;
        user-select:none;
        -webkit-user-select:none;
        touch-action:manipulation;
        animation:hhaBrushFloat 1.7s ease-in-out infinite;
        transform:translate(-50%,-50%);
      }

      .hha-brush-target::after{
        content:attr(data-label);
        position:absolute;
        left:50%;
        top:100%;
        transform:translateX(-50%);
        margin-top:5px;
        padding:4px 7px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        border:1px solid rgba(189,244,255,.92);
        color:#37566e;
        font-size:10px;
        font-weight:1000;
        white-space:nowrap;
        box-shadow:0 6px 14px rgba(23,56,79,.10);
      }

      .hha-brush-target.is-bonus{
        border-color:#8bffcf;
        box-shadow:
          0 12px 28px rgba(23,56,79,.18),
          0 0 0 8px rgba(139,255,207,.28);
      }

      .hha-brush-target.is-danger{
        border-color:#ffb4c6;
        box-shadow:
          0 12px 28px rgba(23,56,79,.18),
          0 0 0 8px rgba(255,180,198,.28);
      }

      .hha-brush-pop{
        position:fixed;
        z-index:99993;
        pointer-events:none;
        transform:translate(-50%,-50%);
        color:#17384f;
        font-size:22px;
        font-weight:1000;
        text-shadow:0 3px 0 rgba(255,255,255,.9);
        animation:hhaBrushPop .72s ease-out forwards;
      }

      .hha-brush-sparkle{
        position:fixed;
        width:12px;
        height:12px;
        border-radius:999px;
        z-index:99993;
        pointer-events:none;
        background:#fff176;
        box-shadow:0 0 0 4px rgba(255,241,118,.28);
        animation:hhaBrushSpark .58s ease-out forwards;
      }

      #hha-brush-rhythm-ring{
        position:fixed;
        left:50%;
        top:50%;
        width:86px;
        height:86px;
        margin-left:-43px;
        margin-top:-43px;
        border-radius:999px;
        z-index:99989;
        pointer-events:none;
        border:4px solid rgba(255,255,255,.72);
        box-shadow:0 0 0 8px rgba(139,232,255,.14);
        opacity:.0;
        transform:scale(.72);
      }

      #hha-brush-rhythm-ring.is-on{
        opacity:.9;
        animation:hhaBrushRhythm .92s ease-out forwards;
      }

      @keyframes hhaBrushFloat{
        0%,100%{ margin-top:0; }
        50%{ margin-top:-8px; }
      }

      @keyframes hhaBrushPop{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.75); }
        18%{ opacity:1; transform:translate(-50%,-70%) scale(1.14); }
        100%{ opacity:0; transform:translate(-50%,-118%) scale(.96); }
      }

      @keyframes hhaBrushSpark{
        0%{ opacity:1; transform:translate(-50%,-50%) scale(.5); }
        100%{ opacity:0; transform:translate(var(--dx),var(--dy)) scale(1.15); }
      }

      @keyframes hhaBrushRhythm{
        0%{ opacity:.05; transform:scale(.72); }
        18%{ opacity:.96; transform:scale(1); }
        100%{ opacity:0; transform:scale(1.7); }
      }

      @media (max-width:640px){
        #hha-brush-polish-hud{
          top:calc(8px + env(safe-area-inset-top,0px));
          gap:6px;
        }

        .hha-brush-pill{
          min-height:30px;
          padding:6px 9px;
          font-size:11px;
        }

        #hha-brush-coach-tip{
          bottom:calc(10px + env(safe-area-inset-bottom,0px));
          font-size:12px;
          min-height:38px;
        }

        .hha-brush-target{
          width:44px;
          height:44px;
          font-size:24px;
        }
      }
    `;
    DOC.head.appendChild(style);
  }

  function ensureLayer(){
    if(DOC.getElementById('hha-brush-polish-layer')) return;

    const layer = DOC.createElement('div');
    layer.id = 'hha-brush-polish-layer';
    layer.setAttribute('aria-hidden','true');

    const hud = DOC.createElement('div');
    hud.id = 'hha-brush-polish-hud';
    hud.innerHTML = [
      '<div class="hha-brush-pill">✨ Clean <span id="hha-brush-polish-clean">0</span></div>',
      '<div class="hha-brush-pill">🔥 Combo <span id="hha-brush-polish-combo">0</span></div>',
      '<div class="hha-brush-pill">🎵 Rhythm <span id="hha-brush-polish-rhythm">Ready</span></div>',
      '<div class="hha-brush-pill">🌊 Wave <span id="hha-brush-polish-wave">1</span></div>'
    ].join('');

    const tip = DOC.createElement('div');
    tip.id = 'hha-brush-coach-tip';
    tip.textContent = '🪥 พร้อมแล้ว! แปรงคราบฟันที่เห็นให้สะอาด';

    const ring = DOC.createElement('div');
    ring.id = 'hha-brush-rhythm-ring';

    layer.appendChild(hud);
    layer.appendChild(tip);
    layer.appendChild(ring);
    DOC.body.appendChild(layer);

    STATE.mounted = true;
  }

  function hudSet(id, text){
    const el = DOC.getElementById(id);
    if(el) el.textContent = String(text);
  }

  function updateHud(){
    hudSet('hha-brush-polish-clean', STATE.cleaned);
    hudSet('hha-brush-polish-combo', STATE.combo);
    hudSet('hha-brush-polish-rhythm', STATE.rhythmGood ? 'Good!' : 'Ready');
    hudSet('hha-brush-polish-wave', STATE.wave);
  }

  function setTip(text){
    const el = DOC.getElementById('hha-brush-coach-tip');
    if(!el) return;
    el.textContent = text;
  }

  function rotateTip(){
    STATE.tipIndex = (STATE.tipIndex + 1) % TIPS.length;
    setTip('🪥 ' + TIPS[STATE.tipIndex]);
  }

  function safeAreaRect(){
    const w = Math.max(320, WIN.innerWidth || 360);
    const h = Math.max(460, WIN.innerHeight || 640);

    return {
      minX: Math.round(w * 0.16),
      maxX: Math.round(w * 0.84),
      minY: Math.round(h * 0.24),
      maxY: Math.round(h * 0.72)
    };
  }

  function spawnTarget(forceType){
    if(!STATE.enabled || !STATE.mounted) return;

    const maxTargets = isCVR() ? 2 : 3;
    if(STATE.activeTargets.length >= maxTargets) return;

    const area = safeAreaRect();
    const data = forceType || pick(TARGETS);
    const id = ++STATE.targetId;

    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'hha-brush-target';
    el.id = 'hha-brush-target-' + id;
    el.dataset.id = String(id);
    el.dataset.label = data.label;
    el.dataset.points = String(data.points);
    el.textContent = data.icon;

    const size = Number(data.size || 46);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    const x = rand(area.minX, area.maxX);
    const y = rand(area.minY, area.maxY);

    el.style.left = x + 'px';
    el.style.top = y + 'px';

    if(data.icon === '✨') el.classList.add('is-bonus');
    if(data.icon === '🦠') el.classList.add('is-danger');

    const target = {
      id,
      el,
      x,
      y,
      vx: rand(-0.28, 0.28),
      vy: rand(-0.18, 0.18),
      points: data.points,
      born: Date.now(),
      life: rand(5200, 8200)
    };

    STATE.activeTargets.push(target);

    el.addEventListener('pointerdown', ev => {
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      hitTarget(target, 'pointer');
    }, { passive:false });

    el.addEventListener('click', ev => {
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      hitTarget(target, 'click');
    }, true);

    DOC.getElementById('hha-brush-polish-layer').appendChild(el);
  }

  function removeTarget(target){
    if(!target) return;
    STATE.activeTargets = STATE.activeTargets.filter(t => t.id !== target.id);
    try{ target.el.remove(); }catch(_){}
  }

  function moveTargets(){
    if(!STATE.enabled) return;

    const area = safeAreaRect();
    const now = Date.now();

    STATE.activeTargets.slice().forEach(target => {
      if(now - target.born > target.life){
        missTarget(target);
        return;
      }

      target.x += target.vx * 16;
      target.y += target.vy * 16;

      if(target.x < area.minX || target.x > area.maxX) target.vx *= -1;
      if(target.y < area.minY || target.y > area.maxY) target.vy *= -1;

      target.x = clamp(target.x, area.minX, area.maxX);
      target.y = clamp(target.y, area.minY, area.maxY);

      try{
        target.el.style.left = target.x + 'px';
        target.el.style.top = target.y + 'px';
      }catch(_){}
    });

    WIN.requestAnimationFrame(moveTargets);
  }

  function missTarget(target){
    STATE.combo = 0;
    pop(target.x, target.y, 'ยังไม่ทัน!', false);
    setTip('ลองเล็งช้า ๆ แล้วแตะคราบฟันอีกครั้งนะ');
    removeTarget(target);
    updateHud();
  }

  function hitTarget(target, source){
    if(!target || !target.el) return;

    const now = Date.now();
    const delta = now - STATE.lastBrushAt;
    STATE.lastBrushAt = now;

    const rhythmBonus = STATE.rhythmGood || (delta > 280 && delta < 1100);
    const points = Number(target.points || 10) + (rhythmBonus ? 5 : 0);

    STATE.score += points;
    STATE.cleaned += 1;
    STATE.combo += 1;
    STATE.bestCombo = Math.max(STATE.bestCombo, STATE.combo);

    pop(target.x, target.y, rhythmBonus ? `+${points} ดีมาก!` : `+${points}`);
    sparkleBurst(target.x, target.y);

    setTip(STATE.combo >= 5 ? 'สุดยอด! แปรงต่อเนื่องได้ดีมาก' : 'ดีมาก! คราบฟันหายไปแล้ว');

    dispatchGameSignal('hha:brush-polish-hit', {
      source,
      score: STATE.score,
      combo: STATE.combo,
      bestCombo: STATE.bestCombo,
      cleaned: STATE.cleaned,
      wave: STATE.wave,
      points,
      rhythmBonus,
      patch: PATCH_ID
    });

    forwardBrushToCore(target.x, target.y);

    removeTarget(target);

    if(STATE.cleaned > 0 && STATE.cleaned % 8 === 0){
      nextWave();
    }

    updateHud();
  }

  function nextWave(){
    STATE.wave += 1;
    setTip('🌊 Wave ใหม่! คราบฟันมาเร็วขึ้นนิดหน่อย');
    for(let i=0; i<Math.min(3, STATE.wave); i++){
      setTimeout(() => spawnTarget(), 180 * i);
    }

    dispatchGameSignal('hha:brush-polish-wave', {
      wave: STATE.wave,
      cleaned: STATE.cleaned,
      score: STATE.score,
      patch: PATCH_ID
    });
  }

  function pop(x, y, text, good){
    const el = DOC.createElement('div');
    el.className = 'hha-brush-pop';
    el.textContent = text || 'Clean!';
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    if(good === false){
      el.style.color = '#ef4444';
    }

    DOC.body.appendChild(el);
    setTimeout(() => {
      try{ el.remove(); }catch(_){}
    }, 800);
  }

  function sparkleBurst(x, y){
    for(let i=0; i<10; i++){
      const s = DOC.createElement('div');
      s.className = 'hha-brush-sparkle';
      s.style.left = x + 'px';
      s.style.top = y + 'px';

      const dx = rand(-72, 72).toFixed(0) + 'px';
      const dy = rand(-82, 42).toFixed(0) + 'px';
      s.style.setProperty('--dx', dx);
      s.style.setProperty('--dy', dy);

      DOC.body.appendChild(s);
      setTimeout(() => {
        try{ s.remove(); }catch(_){}
      }, 650);
    }
  }

  function triggerRhythm(){
    STATE.rhythmGood = true;
    updateHud();

    const ring = DOC.getElementById('hha-brush-rhythm-ring');
    if(ring){
      ring.classList.remove('is-on');
      void ring.offsetWidth;
      ring.classList.add('is-on');
    }

    setTimeout(() => {
      STATE.rhythmGood = false;
      updateHud();
    }, 780);
  }

  function dispatchGameSignal(name, detail){
    try{
      WIN.dispatchEvent(new CustomEvent(name, { detail }));
    }catch(_){}
    try{
      DOC.dispatchEvent(new CustomEvent(name, { bubbles:true, detail }));
    }catch(_){}
  }

  function makePointerEvent(type, x, y){
    try{
      return new PointerEvent(type, {
        bubbles:true,
        cancelable:true,
        pointerId:9,
        pointerType:'touch',
        isPrimary:true,
        clientX:x,
        clientY:y,
        pageX:x,
        pageY:y,
        screenX:x,
        screenY:y,
        buttons:type === 'pointerup' ? 0 : 1,
        button:0
      });
    }catch(_){
      try{
        const ev = DOC.createEvent('MouseEvents');
        ev.initMouseEvent(
          type.replace('pointer','mouse'),
          true,
          true,
          WIN,
          1,
          x,
          y,
          x,
          y,
          false,
          false,
          false,
          false,
          0,
          null
        );
        return ev;
      }catch(__){
        return null;
      }
    }
  }

  function forwardBrushToCore(x, y){
    // ซ่อน overlay ชั่วคราวเพื่อให้ elementFromPoint หา core game ด้านล่างได้
    const layer = DOC.getElementById('hha-brush-polish-layer');
    const oldDisplay = layer ? layer.style.display : '';

    try{
      if(layer) layer.style.display = 'none';

      const el = DOC.elementFromPoint(x, y) || DOC.body;

      ['pointerdown','pointermove','pointerup','click'].forEach(type => {
        const ev = makePointerEvent(type, x, y);
        try{ if(ev) el.dispatchEvent(ev); }catch(_){}
      });
    }catch(_){
    }finally{
      try{
        if(layer) layer.style.display = oldDisplay;
      }catch(_){}
    }

    const hooks = [
      'brushAt',
      'HHA_brushAt',
      'HHA_BRUSH_AT',
      'onBrushAt',
      'handleBrushAt'
    ];

    hooks.forEach(name => {
      try{
        if(typeof WIN[name] === 'function'){
          WIN[name](x, y, {
            source:'brush-polish',
            patch:PATCH_ID
          });
        }
      }catch(_){}
    });

    try{
      if(WIN.BrushGame && typeof WIN.BrushGame.brushAt === 'function'){
        WIN.BrushGame.brushAt(x, y, {
          source:'brush-polish',
          patch:PATCH_ID
        });
      }
    }catch(_){}

    try{
      if(WIN.HHA_BRUSH && typeof WIN.HHA_BRUSH.brushAt === 'function'){
        WIN.HHA_BRUSH.brushAt(x, y, {
          source:'brush-polish',
          patch:PATCH_ID
        });
      }
    }catch(_){}
  }

  function findNearestTarget(x, y, radius){
    let best = null;
    let bestD = Infinity;

    STATE.activeTargets.forEach(t => {
      const dx = t.x - x;
      const dy = t.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if(d < bestD){
        best = t;
        bestD = d;
      }
    });

    if(best && bestD <= radius) return best;
    return null;
  }

  function bindCVR(){
    WIN.addEventListener('hha:brushTap', ev => {
      const detail = ev && ev.detail || {};
      const x = Number(detail.x || WIN.innerWidth / 2);
      const y = Number(detail.y || WIN.innerHeight / 2);

      const radius = isCVR() ? 96 : 68;
      const target = findNearestTarget(x, y, radius);

      if(target){
        hitTarget(target, 'hha:brushTap');
      }else{
        STATE.combo = 0;
        pop(x, y, 'เล็งใหม่อีกที', false);
        updateHud();
      }
    });
  }

  function bindKeyboardTest(){
    DOC.addEventListener('keydown', ev => {
      const key = String(ev.key || '').toLowerCase();
      if(key !== 'b') return;

      const area = safeAreaRect();
      const target = findNearestTarget(
        WIN.innerWidth / 2,
        WIN.innerHeight / 2,
        9999
      );

      if(target) hitTarget(target, 'keyboard-b');
      else spawnTarget();
    });
  }

  function bootTimers(){
    STATE.spawnTimer = setInterval(() => {
      spawnTarget();
    }, isCVR() ? 1550 : 1350);

    STATE.rhythmTimer = setInterval(() => {
      triggerRhythm();
    }, 2300);

    const tipTimer = setInterval(rotateTip, 5800);

    STATE.timers.push(STATE.spawnTimer, STATE.rhythmTimer, tipTimer);

    setTimeout(() => spawnTarget({ icon:'✨', label:'เริ่มสะอาด!', points:18, size:44 }), 650);
    setTimeout(() => spawnTarget(), 1200);
    setTimeout(() => spawnTarget(), 1900);
  }

  function expose(){
    WIN.HHA_BRUSH_POLISH = Object.assign({}, WIN.HHA_BRUSH_POLISH || {}, {
      patch: PATCH_ID,
      state: STATE,
      spawn: spawnTarget,
      clear: function(){
        STATE.activeTargets.slice().forEach(removeTarget);
      },
      stop: function(){
        STATE.enabled = false;
        STATE.timers.forEach(t => {
          try{ clearInterval(t); clearTimeout(t); }catch(_){}
        });
      },
      start: function(){
        if(!STATE.enabled){
          STATE.enabled = true;
          bootTimers();
          moveTargets();
        }
      },
      summary: function(){
        return {
          score: STATE.score,
          combo: STATE.combo,
          bestCombo: STATE.bestCombo,
          cleaned: STATE.cleaned,
          wave: STATE.wave,
          patch: PATCH_ID
        };
      }
    });
  }

  function boot(){
    expose();

    if(!isMainBrushPage() || !isPlayMode()){
      log('skip: not main play page');
      return;
    }

    if(STATE.mounted) return;

    ensureStyle();
    ensureLayer();
    updateHud();
    bindCVR();
    bindKeyboardTest();
    bootTimers();
    moveTargets();

    DOC.documentElement.setAttribute('data-brush-polish', PATCH_ID);
    if(DOC.body) DOC.body.setAttribute('data-brush-polish', PATCH_ID);

    dispatchGameSignal('hha:brush-polish-ready', {
      patch: PATCH_ID,
      view: param('view','mobile'),
      mode: param('mode','learn')
    });

    log('booted');
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
