/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.flying-target-rules.js
 * PATCH v20260515-P53-BRUSH-KIDS-FLYING-TARGET-RULES
 *
 * Purpose:
 * - จำกัด “ของว่อน/เป้าพิเศษ” ให้โผล่เฉพาะตอน Brush/Boss
 * - ไม่ให้โผล่ตอน Prep/Summary
 * - ให้เป้าอยู่ใกล้โซนที่กำลังแปรง
 * - ใช้แปรงชนเป้า ไม่ใช่ระบบยิงแยก
 * - คุมจำนวนเป้าพร้อมกันตาม difficulty
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH_ID = 'v20260515-P53-BRUSH-KIDS-FLYING-TARGET-RULES';

  const TARGET_TYPES = [
    {
      id: 'plaque-monster',
      icon: '🦠',
      label: 'Plaque Monster',
      hits: 2,
      reward: 120,
      className: 'monster',
      message: 'กำจัด Plaque Monster!'
    },
    {
      id: 'sugar-drop',
      icon: '🍬',
      label: 'Sugar Drop',
      hits: 1,
      reward: 70,
      className: 'sugar',
      message: 'ปัดคราบน้ำตาลทันเวลา!'
    },
    {
      id: 'tooth-pet',
      icon: '🐰',
      label: 'Tooth Pet',
      hits: 2,
      reward: 150,
      className: 'pet',
      message: 'ช่วย Tooth Pet สำเร็จ!'
    },
    {
      id: 'spark-bubble',
      icon: '✨',
      label: 'Spark Bubble',
      hits: 1,
      reward: 90,
      className: 'spark',
      message: 'ได้ Spark Bonus!'
    }
  ];

  const ZONE_POS = {
    'upper-left':  { x: .28, y: .34 },
    'upper-front': { x: .50, y: .30 },
    'upper-right': { x: .72, y: .34 },
    'lower-left':  { x: .28, y: .66 },
    'lower-front': { x: .50, y: .70 },
    'lower-right': { x: .72, y: .66 }
  };

  let activeTargets = [];
  let spawnTimer = null;
  let lastSpawnAt = 0;
  let lastPointer = { x: 0, y: 0, at: 0 };

  let stats = {
    spawned: 0,
    hit: 0,
    missed: 0,
    plaqueMonster: 0,
    sugarDrop: 0,
    toothPet: 0,
    sparkBubble: 0,
    bonusScore: 0
  };

  function $(id){
    return DOC.getElementById(id);
  }

  function stage(){
    const s =
      DOC.body && DOC.body.getAttribute('data-brush-flow-stage') ||
      DOC.documentElement && DOC.documentElement.getAttribute('data-brush-flow-stage') ||
      '';

    return String(s || '').toLowerCase();
  }

  function isAllowedStage(){
    const s = stage();
    return s === 'brush' || s === 'mini-event' || s === 'boss';
  }

  function isBlockedStage(){
    const s = stage();
    return s === 'prep' || s === 'summary' || s === '';
  }

  function difficulty(){
    try{
      const p = new URLSearchParams(WIN.location.search || '');
      const d = String(p.get('diff') || 'normal').toLowerCase();
      if(['easy','normal','hard','challenge'].includes(d)) return d;
    }catch(_){}
    return 'normal';
  }

  function maxTargets(){
    const diff = difficulty();
    const s = stage();

    if(s === 'boss'){
      if(diff === 'easy') return 1;
      if(diff === 'normal') return 2;
      if(diff === 'hard') return 2;
      return 3;
    }

    if(diff === 'easy') return 1;
    if(diff === 'normal') return 2;
    if(diff === 'hard') return 2;
    return 3;
  }

  function spawnIntervalMs(){
    const diff = difficulty();
    const s = stage();

    if(s === 'boss'){
      if(diff === 'easy') return 3600;
      if(diff === 'normal') return 3000;
      if(diff === 'hard') return 2500;
      return 2200;
    }

    if(diff === 'easy') return 4600;
    if(diff === 'normal') return 3800;
    if(diff === 'hard') return 3200;
    return 2700;
  }

  function lifetimeMs(){
    const diff = difficulty();

    if(diff === 'easy') return 5200;
    if(diff === 'normal') return 4600;
    if(diff === 'hard') return 4000;
    return 3600;
  }

  function rand(min, max){
    return min + Math.random() * (max - min);
  }

  function clamp(v, min, max){
    return Math.max(min, Math.min(max, v));
  }

  function sceneRect(){
    const scene = $('sceneStage');
    if(!scene || !scene.getBoundingClientRect){
      return null;
    }

    const r = scene.getBoundingClientRect();
    if(!r || r.width < 20 || r.height < 20) return null;
    return r;
  }

  function activeZone(){
    const z =
      DOC.body && DOC.body.getAttribute('data-brush-active-zone') ||
      DOC.documentElement && DOC.documentElement.getAttribute('data-brush-active-zone') ||
      '';

    if(ZONE_POS[z]) return z;

    const active =
      DOC.querySelector('[data-zone].active,[data-zone].is-zone-active,[data-zone][data-state="active"]') ||
      DOC.querySelector('[data-ring-zone].is-zone-active,[data-ring-zone].is-scene-focus');

    if(active){
      const z2 = active.getAttribute('data-zone') || active.getAttribute('data-ring-zone');
      if(ZONE_POS[z2]) return z2;
    }

    return 'upper-front';
  }

  function targetLayer(){
    let layer = $('hhaFlyingTargetLayer');

    if(!layer){
      const scene = $('sceneStage');
      if(!scene) return null;

      layer = DOC.createElement('div');
      layer.id = 'hhaFlyingTargetLayer';
      layer.setAttribute('aria-hidden', 'true');
      scene.appendChild(layer);
    }

    return layer;
  }

  function ensureStyle(){
    if($('hha-flying-target-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-flying-target-style';
    style.textContent = `
      #hhaFlyingTargetLayer{
        position:absolute;
        inset:0;
        z-index:38;
        pointer-events:none;
      }

      .hha-flying-target{
        position:absolute;
        width:58px;
        height:58px;
        border-radius:999px;
        display:grid;
        place-items:center;
        font-size:30px;
        font-weight:1000;
        background:rgba(255,255,255,.94);
        border:4px solid rgba(189,244,255,.95);
        box-shadow:
          0 0 0 8px rgba(189,244,255,.15),
          0 16px 32px rgba(23,56,79,.16);
        transform:translate(-50%,-50%) scale(1);
        transition:
          transform .12s ease,
          opacity .18s ease,
          filter .18s ease;
        will-change:transform,left,top,opacity;
      }

      .hha-flying-target.monster{
        border-color:#c4b5fd;
        background:linear-gradient(180deg,#fff,#f3e8ff);
      }

      .hha-flying-target.sugar{
        border-color:#fecaca;
        background:linear-gradient(180deg,#fff,#fff1f2);
      }

      .hha-flying-target.pet{
        border-color:#bbf7d0;
        background:linear-gradient(180deg,#fff,#f0fdf4);
      }

      .hha-flying-target.spark{
        border-color:#fde68a;
        background:linear-gradient(180deg,#fff,#fffbeb);
      }

      .hha-flying-target.is-hit{
        transform:translate(-50%,-50%) scale(1.18);
        filter:brightness(1.08) saturate(1.2);
      }

      .hha-flying-target.is-done{
        opacity:0;
        transform:translate(-50%,-50%) scale(.36);
      }

      .hha-flying-target.is-danger{
        animation:hhaTargetPulse .7s ease-in-out infinite alternate;
      }

      @keyframes hhaTargetPulse{
        from{ transform:translate(-50%,-50%) scale(.96); }
        to{ transform:translate(-50%,-50%) scale(1.08); }
      }

      #hhaFlyingTargetHud{
        position:absolute;
        left:50%;
        top:10px;
        transform:translateX(-50%);
        z-index:58;
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        align-items:center;
        justify-content:center;
        pointer-events:none;
      }

      .hha-ft-chip{
        min-height:32px;
        padding:6px 10px;
        border-radius:999px;
        border:2px solid #bdf4ff;
        background:rgba(255,255,255,.92);
        color:#17384f;
        font-size:12px;
        font-weight:1000;
        box-shadow:0 8px 20px rgba(23,56,79,.10);
      }

      body[data-brush-flow-stage="prep"] #hhaFlyingTargetLayer,
      body[data-brush-flow-stage="summary"] #hhaFlyingTargetLayer,
      body[data-brush-flow-stage="prep"] #hhaFlyingTargetHud,
      body[data-brush-flow-stage="summary"] #hhaFlyingTargetHud{
        display:none !important;
      }

      @media (max-width:640px){
        .hha-flying-target{
          width:50px;
          height:50px;
          font-size:26px;
        }

        #hhaFlyingTargetHud{
          top:8px;
          gap:5px;
        }

        .hha-ft-chip{
          min-height:28px;
          padding:5px 8px;
          font-size:11px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureHud(){
    const scene = $('sceneStage');
    if(!scene) return null;

    let hud = $('hhaFlyingTargetHud');
    if(!hud){
      hud = DOC.createElement('div');
      hud.id = 'hhaFlyingTargetHud';
      hud.innerHTML = `
        <span class="hha-ft-chip" id="hhaFtCleanChip">✨ Special 0</span>
        <span class="hha-ft-chip" id="hhaFtComboChip">🦠 Monster 0</span>
        <span class="hha-ft-chip" id="hhaFtPetChip">🐾 Pet 0</span>
      `;
      scene.appendChild(hud);
    }

    updateHud();
    return hud;
  }

  function updateHud(){
    const clean = $('hhaFtCleanChip');
    const monster = $('hhaFtComboChip');
    const pet = $('hhaFtPetChip');

    if(clean) clean.textContent = `✨ Special ${stats.hit}`;
    if(monster) monster.textContent = `🦠 Monster ${stats.plaqueMonster}`;
    if(pet) pet.textContent = `🐾 Pet ${stats.toothPet}`;
  }

  function coach(message){
    const line = $('coachLine');
    if(line && message){
      line.textContent = message;
    }
  }

  function popup(message, x, y){
    const layer = $('scorePopupLayer') || $('fxLayer') || targetLayer();
    if(!layer) return;

    const p = DOC.createElement('div');
    p.textContent = message;
    p.style.position = 'absolute';
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.transform = 'translate(-50%,-50%)';
    p.style.zIndex = '999';
    p.style.padding = '7px 10px';
    p.style.borderRadius = '999px';
    p.style.border = '2px solid #bdf4ff';
    p.style.background = 'rgba(255,255,255,.95)';
    p.style.color = '#17384f';
    p.style.fontWeight = '1000';
    p.style.fontSize = '13px';
    p.style.boxShadow = '0 10px 24px rgba(23,56,79,.14)';
    p.style.pointerEvents = 'none';
    p.style.opacity = '1';
    p.style.transition = 'transform .7s ease, opacity .7s ease';

    layer.appendChild(p);

    requestAnimationFrame(() => {
      p.style.transform = 'translate(-50%,-110%) scale(1.04)';
      p.style.opacity = '0';
    });

    setTimeout(() => {
      try{ p.remove(); }catch(_){}
    }, 800);
  }

  function chooseType(){
    const s = stage();

    if(s === 'boss'){
      const pool = [
        'plaque-monster',
        'plaque-monster',
        'sugar-drop',
        'spark-bubble',
        'tooth-pet'
      ];
      return TARGET_TYPES.find(t => t.id === pool[Math.floor(Math.random() * pool.length)]);
    }

    const pool = [
      'plaque-monster',
      'sugar-drop',
      'spark-bubble',
      'tooth-pet'
    ];
    return TARGET_TYPES.find(t => t.id === pool[Math.floor(Math.random() * pool.length)]);
  }

  function positionNearZone(zoneId){
    const r = sceneRect();
    if(!r) return null;

    const base = ZONE_POS[zoneId] || ZONE_POS['upper-front'];

    const x = clamp((base.x + rand(-.10, .10)) * r.width, 42, r.width - 42);
    const y = clamp((base.y + rand(-.09, .09)) * r.height, 56, r.height - 56);

    return { x, y };
  }

  function makeTarget(){
    if(!isAllowedStage()) return null;

    const layer = targetLayer();
    if(!layer) return null;

    const type = chooseType();
    if(!type) return null;

    const zone = activeZone();
    const pos = positionNearZone(zone);
    if(!pos) return null;

    const el = DOC.createElement('div');
    const id = `ft_${Date.now()}_${Math.floor(Math.random() * 99999)}`;

    el.id = id;
    el.className = `hha-flying-target ${type.className}`;
    el.textContent = type.icon;
    el.setAttribute('data-flying-target', type.id);
    el.setAttribute('data-zone', zone);
    el.setAttribute('data-hits-left', String(type.hits));
    el.setAttribute('title', type.label);

    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;

    if(type.id === 'sugar-drop' || type.id === 'plaque-monster'){
      el.classList.add('is-danger');
    }

    layer.appendChild(el);

    const target = {
      id,
      el,
      type,
      zone,
      x: pos.x,
      y: pos.y,
      vx: rand(-.32, .32),
      vy: rand(-.18, .18),
      hitsLeft: type.hits,
      bornAt: Date.now(),
      expiresAt: Date.now() + lifetimeMs(),
      done: false
    };

    activeTargets.push(target);
    stats.spawned += 1;

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-flying-target-spawn', {
        detail: {
          patch: PATCH_ID,
          target: {
            id: target.id,
            type: type.id,
            zone
          }
        }
      }));
    }catch(_){}

    return target;
  }

  function removeTarget(target, reason){
    if(!target || target.done) return;

    target.done = true;

    if(reason === 'miss'){
      stats.missed += 1;
    }

    if(target.el){
      target.el.classList.add('is-done');
      setTimeout(() => {
        try{ target.el.remove(); }catch(_){}
      }, 220);
    }

    activeTargets = activeTargets.filter(t => t !== target);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-flying-target-remove', {
        detail: {
          patch: PATCH_ID,
          id: target.id,
          type: target.type.id,
          reason: reason || 'remove',
          stats: Object.assign({}, stats)
        }
      }));
    }catch(_){}
  }

  function hitTarget(target, pointer){
    if(!target || target.done) return;

    target.hitsLeft -= 1;

    if(target.el){
      target.el.setAttribute('data-hits-left', String(target.hitsLeft));
      target.el.classList.add('is-hit');
      setTimeout(() => {
        try{ target.el.classList.remove('is-hit'); }catch(_){}
      }, 130);
    }

    if(target.hitsLeft > 0){
      popup(`${target.type.icon} อีก ${target.hitsLeft}`, target.x, target.y);
      return;
    }

    stats.hit += 1;
    stats.bonusScore += target.type.reward;

    if(target.type.id === 'plaque-monster') stats.plaqueMonster += 1;
    if(target.type.id === 'sugar-drop') stats.sugarDrop += 1;
    if(target.type.id === 'tooth-pet') stats.toothPet += 1;
    if(target.type.id === 'spark-bubble') stats.sparkBubble += 1;

    updateHud();
    popup(`+${target.type.reward} ${target.type.icon}`, target.x, target.y);
    coach(target.type.message);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-special-hit', {
        detail: {
          patch: PATCH_ID,
          type: target.type.id,
          zone: target.zone,
          reward: target.type.reward,
          stats: Object.assign({}, stats),
          pointer: pointer || null
        }
      }));
    }catch(_){}

    removeTarget(target, 'hit');
  }

  function syncScoreBonusSoft(){
    const scoreText = $('scoreText');
    if(!scoreText || stats.bonusScore <= 0) return;

    const raw = String(scoreText.textContent || '0').replace(/[^\d.-]/g, '');
    const base = Number(raw || 0);

    if(!Number.isFinite(base)) return;

    const lastApplied = Number(scoreText.getAttribute('data-ft-bonus-applied') || '0');

    if(stats.bonusScore <= lastApplied) return;

    const delta = stats.bonusScore - lastApplied;
    scoreText.textContent = String(Math.max(0, Math.round(base + delta)));
    scoreText.setAttribute('data-ft-bonus-applied', String(stats.bonusScore));
  }

  function checkPointerCollision(clientX, clientY){
    if(!isAllowedStage()) return;

    const r = sceneRect();
    if(!r) return;

    const x = clientX - r.left;
    const y = clientY - r.top;

    lastPointer = { x, y, at: Date.now() };

    const hitRadius = stage() === 'boss' ? 52 : 46;

    activeTargets.slice().forEach(target => {
      if(target.done) return;

      const dx = target.x - x;
      const dy = target.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if(dist <= hitRadius){
        hitTarget(target, { x, y, clientX, clientY });
      }
    });
  }

  function bindBrushPointer(){
    const scene = $('sceneStage') || DOC;

    ['pointerdown','pointermove','click'].forEach(type => {
      scene.addEventListener(type, function(ev){
        if(!isAllowedStage()) return;

        const x = Number(ev.clientX || 0);
        const y = Number(ev.clientY || 0);
        if(!x && !y) return;

        checkPointerCollision(x, y);
      }, true);
    });

    WIN.addEventListener('hha:shoot', function(){
      if(!isAllowedStage()) return;

      const r = sceneRect();
      if(!r) return;

      checkPointerCollision(r.left + r.width / 2, r.top + r.height / 2);
    }, true);
  }

  function tickTargets(){
    if(isBlockedStage()){
      clearAllTargets('blocked-stage');
      return;
    }

    const r = sceneRect();
    if(!r) return;

    const now = Date.now();

    activeTargets.slice().forEach(target => {
      if(target.done) return;

      if(now >= target.expiresAt){
        removeTarget(target, 'miss');
        return;
      }

      const age = now - target.bornAt;
      const drift = Math.sin(age / 360) * 0.7;

      target.x += target.vx + drift * 0.12;
      target.y += target.vy;

      target.x = clamp(target.x, 42, r.width - 42);
      target.y = clamp(target.y, 56, r.height - 56);

      if(target.el){
        target.el.style.left = `${target.x}px`;
        target.el.style.top = `${target.y}px`;
      }
    });
  }

  function maybeSpawn(){
    if(!isAllowedStage()) return;

    const now = Date.now();
    const max = maxTargets();

    if(activeTargets.length >= max) return;
    if(now - lastSpawnAt < spawnIntervalMs()) return;

    lastSpawnAt = now;
    makeTarget();
  }

  function clearAllTargets(reason){
    activeTargets.slice().forEach(target => removeTarget(target, reason || 'clear'));

    const layer = $('hhaFlyingTargetLayer');
    if(layer){
      layer.innerHTML = '';
    }

    activeTargets = [];
  }

  function loop(){
    tickTargets();
    maybeSpawn();
    syncScoreBonusSoft();
  }

  function startLoop(){
    if(spawnTimer) return;

    spawnTimer = setInterval(loop, 180);
  }

  function stopLoop(){
    if(spawnTimer){
      clearInterval(spawnTimer);
      spawnTimer = null;
    }
  }

  function handleStageChange(){
    const s = stage();

    if(s === 'prep' || s === 'summary' || s === ''){
      clearAllTargets(`stage-${s || 'none'}`);
      stopLoop();
      return;
    }

    ensureStyle();
    ensureHud();
    startLoop();
  }

  function observeStage(){
    let last = '';

    setInterval(() => {
      const s = stage();
      if(s !== last){
        last = s;
        handleStageChange();
      }
    }, 220);

    WIN.addEventListener('hha:brush-flow-stage-change', handleStageChange, true);
  }

  function observeDomCleanup(){
    try{
      const mo = new MutationObserver(() => {
        if(isBlockedStage()){
          clearAllTargets('dom-observe-blocked');
        }else{
          ensureHud();
        }
      });

      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        attributes:true
      });
    }catch(_){}
  }

  function resetStats(){
    stats = {
      spawned: 0,
      hit: 0,
      missed: 0,
      plaqueMonster: 0,
      sugarDrop: 0,
      toothPet: 0,
      sparkBubble: 0,
      bonusScore: 0
    };
    updateHud();
  }

  function expose(){
    WIN.HHA_BRUSH_FLYING_TARGETS = {
      patch: PATCH_ID,
      stats(){
        return Object.assign({}, stats, {
          active: activeTargets.length,
          stage: stage(),
          pointer: Object.assign({}, lastPointer)
        });
      },
      spawn: makeTarget,
      clear: clearAllTargets,
      reset: resetStats,
      allowed: isAllowedStage,
      activeTargets(){
        return activeTargets.map(t => ({
          id: t.id,
          type: t.type.id,
          zone: t.zone,
          x: t.x,
          y: t.y,
          hitsLeft: t.hitsLeft,
          done: t.done
        }));
      }
    };
  }

  function boot(){
    ensureStyle();
    ensureHud();
    bindBrushPointer();
    observeStage();
    observeDomCleanup();
    expose();
    handleStageChange();

    try{
      console.log('[BrushFlyingTargets]', PATCH_ID, 'booted');
    }catch(_){}
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();