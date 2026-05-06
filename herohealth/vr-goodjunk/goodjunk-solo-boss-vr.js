// === /herohealth/vr-goodjunk/goodjunk-solo-boss-vr.js ===
// GoodJunk Solo Boss 3D / Enter VR Prototype
// PATCH v8.42.0-GOODJUNK-SOLO-BOSS-3D-VR
// ✅ A-Frame 3D arena
// ✅ Enter VR compatible
// ✅ PC / Mobile / Cardboard/cVR / WebXR
// ✅ Crosshair shoot + tap target + hha:shoot support
// ✅ Good / Junk / Fake Healthy / Power-up Orb
// ✅ Boss HP / combo / fever / shield / summary
// ✅ Cooldown return via warmup-gate.html
// ✅ After cooldown → goodjunk-launcher.html

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.42.0-GOODJUNK-SOLO-BOSS-3D-VR';

  const ROUTES = {
    launcher: 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html',
    hub: 'https://supparang.github.io/webxr-health-mobile/herohealth/hub-v2.html',
    warmupGate: 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html'
  };

  const cfg = {
    pid: q('pid', 'anon'),
    name: q('name', q('nick', 'Hero')),
    diff: String(q('diff', 'normal')).toLowerCase(),
    time: Math.max(45, Number(q('time', '120')) || 120),
    view: String(q('view', 'mobile')).toLowerCase(),
    seed: q('seed', String(Date.now()))
  };

  const DIFF = {
    easy: {
      lives:5,
      bossHp:140,
      spawnMs:1150,
      foodSpeed:6200,
      junkRate:0.20,
      fakeRate:0.08,
      powerRate:0.10
    },
    normal: {
      lives:4,
      bossHp:170,
      spawnMs:980,
      foodSpeed:5600,
      junkRate:0.28,
      fakeRate:0.13,
      powerRate:0.10
    },
    hard: {
      lives:3,
      bossHp:210,
      spawnMs:850,
      foodSpeed:5000,
      junkRate:0.34,
      fakeRate:0.18,
      powerRate:0.09
    },
    challenge: {
      lives:3,
      bossHp:250,
      spawnMs:720,
      foodSpeed:4500,
      junkRate:0.40,
      fakeRate:0.22,
      powerRate:0.08
    }
  };

  const D = DIFF[cfg.diff] || DIFF.normal;

  const GOOD_FOODS = [
    { icon:'🥦', label:'ผัก', group:'veg', color:'#22c55e', tip:'ผักช่วยให้ร่างกายแข็งแรง' },
    { icon:'🥕', label:'ผัก', group:'veg', color:'#fb923c', tip:'ผักมีใยอาหาร' },
    { icon:'🍎', label:'ผลไม้', group:'fruit', color:'#ef4444', tip:'ผลไม้จริงดีกว่าน้ำหวาน' },
    { icon:'🍌', label:'ผลไม้', group:'fruit', color:'#facc15', tip:'ผลไม้ให้พลังงานดี' },
    { icon:'🥚', label:'โปรตีน', group:'protein', color:'#fde68a', tip:'โปรตีนช่วยซ่อมแซมร่างกาย' },
    { icon:'🐟', label:'โปรตีน', group:'protein', color:'#38bdf8', tip:'ปลาเป็นโปรตีนที่ดี' },
    { icon:'🍚', label:'ข้าว/แป้ง', group:'carb', color:'#ffffff', tip:'ข้าวให้พลังงาน' },
    { icon:'💧', label:'น้ำ', group:'water', color:'#60a5fa', tip:'น้ำเปล่าดีต่อร่างกาย' }
  ];

  const JUNK_FOODS = [
    { icon:'🍟', label:'Junk', color:'#f97316', tip:'อาหารทอดควรกินแต่น้อย' },
    { icon:'🍩', label:'Junk', color:'#f472b6', tip:'ขนมหวานน้ำตาลสูง' },
    { icon:'🥤', label:'Junk', color:'#ef4444', tip:'น้ำหวานมีน้ำตาลสูง' },
    { icon:'🍬', label:'Junk', color:'#ec4899', tip:'ลูกอมหวานจัด' },
    { icon:'🍔', label:'Junk', color:'#a16207', tip:'อาหารไขมันสูงควรระวัง' }
  ];

  const FAKE_FOODS = [
    { icon:'🧃', label:'Fake Healthy', color:'#f59e0b', tip:'น้ำผลไม้กล่องอาจมีน้ำตาลสูง' },
    { icon:'🥣', label:'Fake Healthy', color:'#c084fc', tip:'ซีเรียลบางชนิดน้ำตาลสูง' },
    { icon:'🍫', label:'Fake Healthy', color:'#92400e', tip:'energy bar บางชนิดหวานมาก' }
  ];

  const POWERUPS = [
    { id:'shield', icon:'🛡️', label:'Shield', color:'#38bdf8' },
    { id:'magnet', icon:'🧲', label:'Magnet', color:'#a855f7' },
    { id:'fever', icon:'⚡', label:'Fever', color:'#facc15' },
    { id:'heal', icon:'💚', label:'Heal', color:'#22c55e' },
    { id:'powerFood', icon:'⭐', label:'Power', color:'#f59e0b' }
  ];

  const el = {
    scene: byId('scene'),
    camera: byId('camera'),
    aimRay: byId('aimRay'),
    targetRoot: byId('targetRoot'),
    fxRoot: byId('fxRoot'),
    bossRoot: byId('bossRoot'),
    bossBody: byId('bossBody'),

    hudScore: byId('hudScore'),
    hudTime: byId('hudTime'),
    hudLives: byId('hudLives'),
    hudCombo: byId('hudCombo'),
    hudPower: byId('hudPower'),
    bossHpFill: byId('bossHpFill'),
    missionText: byId('missionText'),

    startOverlay: byId('startOverlay'),
    summaryOverlay: byId('summaryOverlay'),
    startBtn: byId('startBtn'),
    startVrHintBtn: byId('startVrHintBtn'),
    shootBtn: byId('shootBtn'),
    backBtn: byId('backBtn'),
    toast: byId('toast'),

    summaryIcon: byId('summaryIcon'),
    summaryTitle: byId('summaryTitle'),
    summaryTip: byId('summaryTip'),
    sumScore: byId('sumScore'),
    sumRank: byId('sumRank'),
    sumGood: byId('sumGood'),
    sumMiss: byId('sumMiss'),
    cooldownBtn: byId('cooldownBtn'),
    replayBtn: byId('replayBtn'),
    launcherBtn: byId('launcherBtn'),
    hubBtn: byId('hubBtn')
  };

  const state = {
    ready:false,
    started:false,
    ended:false,

    score:0,
    lives:D.lives,
    combo:0,
    bestCombo:0,
    bossHp:D.bossHp,
    bossMaxHp:D.bossHp,
    timeLeft:cfg.time,

    goodHits:0,
    junkHits:0,
    fakeHits:0,
    misses:0,
    shots:0,
    powerHits:0,

    shield:0,
    feverUntil:0,
    magnetUntil:0,
    powerFoodReady:false,

    spawnTimer:0,
    clockTimer:0,
    missionIndex:0,
    missionCount:0,

    activeTargets:new Set(),
    lastTip:'',
    startAt:0,
    endedAt:0
  };

  const MISSIONS = [
    { text:'ยิงอาหารดี 5 ชิ้น!', kind:'good', goal:5 },
    { text:'ทำ Combo x5!', kind:'combo', goal:5 },
    { text:'ระวัง fake healthy!', kind:'avoidFake', goal:1 },
    { text:'เก็บ Power-up orb!', kind:'power', goal:1 },
    { text:'ปิดฉากบอสด้วยอาหารดี!', kind:'boss', goal:1 }
  ];

  function q(key, fallback){
    const v = QS.get(key);
    return v === null || v === '' ? fallback : v;
  }

  function byId(id){
    return DOC.getElementById(id);
  }

  function clamp(v,a,b){
    return Math.max(a, Math.min(b, v));
  }

  function now(){
    return Date.now();
  }

  function isFever(){
    return state.feverUntil > now();
  }

  function isMagnet(){
    return state.magnetUntil > now();
  }

  function rand(a,b){
    return a + Math.random() * (b - a);
  }

  function pick(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, m => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[m]));
  }

  function toast(text){
    if(!el.toast) return;
    el.toast.textContent = String(text || '');
    el.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.toast.classList.remove('show'), 1500);
  }

  function updateHud(){
    if(el.hudScore) el.hudScore.textContent = String(state.score);
    if(el.hudTime) el.hudTime.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    if(el.hudLives) el.hudLives.textContent = state.lives > 0 ? '💚'.repeat(state.lives) : '💔';
    if(el.hudCombo) el.hudCombo.textContent = `x${state.combo}`;

    const powers = [];
    if(state.shield > 0) powers.push(`🛡️${state.shield}`);
    if(isFever()) powers.push(`⚡${Math.ceil((state.feverUntil - now()) / 1000)}s`);
    if(isMagnet()) powers.push(`🧲${Math.ceil((state.magnetUntil - now()) / 1000)}s`);
    if(state.powerFoodReady) powers.push('⭐');

    if(el.hudPower) el.hudPower.textContent = powers.join(' ') || '—';

    const hpPct = clamp(state.bossHp / state.bossMaxHp, 0, 1);
    if(el.bossHpFill) el.bossHpFill.style.width = `${Math.round(hpPct * 100)}%`;

    if(el.missionText){
      const m = MISSIONS[state.missionIndex] || MISSIONS[0];
      el.missionText.textContent = `${m.text} ${state.missionCount}/${m.goal}`;
    }
  }

  function setMission(kind){
    const current = MISSIONS[state.missionIndex];
    if(!current || current.kind !== kind) return;

    state.missionCount += 1;

    if(state.missionCount >= current.goal){
      state.score += 80;
      toast('⭐ Mission Clear! +80');
      state.missionIndex = Math.min(state.missionIndex + 1, MISSIONS.length - 1);
      state.missionCount = 0;
    }
  }

  function buildCooldownUrl(reason){
    const p = new URLSearchParams();

    p.set('zone', 'nutrition');
    p.set('cat', 'nutrition');
    p.set('gameId', 'goodjunk');
    p.set('game', 'goodjunk');
    p.set('mode', 'solo_boss_vr');
    p.set('phase', 'cooldown');

    p.set('pid', cfg.pid);
    p.set('name', cfg.name);
    p.set('diff', cfg.diff);
    p.set('time', String(cfg.time));
    p.set('view', cfg.view);

    p.set('hub', ROUTES.hub);
    p.set('next', ROUTES.launcher);
    p.set('back', ROUTES.launcher);
    p.set('return', ROUTES.launcher);
    p.set('cdnext', ROUTES.launcher);

    p.set('reason', reason || 'vr-summary');

    p.set('score', String(state.score));
    p.set('rank', calculateRank().rank);

    return `${ROUTES.warmupGate}?${p.toString()}`;
  }

  function goLauncher(){
    location.href = ROUTES.launcher;
  }

  function goHub(){
    location.href = ROUTES.hub;
  }

  function replay(){
    location.reload();
  }

  function goCooldown(){
    location.href = buildCooldownUrl('goodjunk-vr-cooldown');
  }

  function makeArenaDecor(){
    for(let i = 0; i < 24; i++){
      const ring = DOC.createElement('a-sphere');
      const angle = (Math.PI * 2 * i) / 24;
      const radius = 9 + (i % 3);
      ring.setAttribute('position', `${Math.cos(angle) * radius} ${rand(.4,2.8)} ${-4 + Math.sin(angle) * radius}`);
      ring.setAttribute('radius', rand(.05,.13));
      ring.setAttribute('color', i % 2 ? '#ffffff' : '#86efac');
      ring.setAttribute('opacity', '0.45');
      ring.setAttribute('material', 'transparent:true; opacity:0.45');
      el.fxRoot.appendChild(ring);
    }
  }

  function createTarget(kind, data){
    const wrap = DOC.createElement('a-entity');
    wrap.classList.add('gj-target');
    wrap.dataset.kind = kind;
    wrap.dataset.id = `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    wrap.dataset.consumed = '0';

    const x = rand(-4.2, 4.2);
    const y = rand(1.05, 3.15);
    const z = rand(-11.5, -8.0);
    wrap.setAttribute('position', `${x} ${y} ${z}`);

    const radius = kind === 'power' ? 0.38 : 0.34;

    const orb = DOC.createElement('a-sphere');
    orb.setAttribute('radius', String(radius));
    orb.setAttribute('color', data.color || '#ffffff');
    orb.setAttribute('roughness', '0.45');
    orb.setAttribute('metalness', kind === 'power' ? '0.2' : '0');
    orb.setAttribute('emissive', kind === 'power' ? data.color : '#000000');
    orb.setAttribute('emissive-intensity', kind === 'power' ? '0.25' : '0');

    const text = DOC.createElement('a-text');
    text.setAttribute('value', data.icon || '?');
    text.setAttribute('align', 'center');
    text.setAttribute('width', '2.6');
    text.setAttribute('color', '#111827');
    text.setAttribute('position', '0 0.02 0.37');

    const label = DOC.createElement('a-text');
    label.setAttribute('value', data.label || '');
    label.setAttribute('align', 'center');
    label.setAttribute('width', '2.0');
    label.setAttribute('color', '#0f172a');
    label.setAttribute('position', '0 -0.48 0.08');

    wrap.appendChild(orb);
    wrap.appendChild(text);
    wrap.appendChild(label);

    const speed = Math.max(3200, D.foodSpeed - Math.min(1800, state.combo * 75));
    const toY = y + rand(-0.25, 0.25);

    wrap.setAttribute('animation__fly', {
      property:'position',
      to:`${x * 0.25} ${toY} 0.9`,
      dur:speed,
      easing:'linear'
    });

    wrap.setAttribute('animation__spin', {
      property:'rotation',
      to:`0 ${rand(160, 360)} 0`,
      dur:1400,
      loop:true,
      easing:'linear'
    });

    wrap.addEventListener('click', function(ev){
      ev.preventDefault();
      hitTarget(wrap, kind, data);
    });

    wrap.addEventListener('animationcomplete__fly', function(){
      if(wrap.dataset.consumed === '1') return;
      expireTarget(wrap, kind, data);
    });

    el.targetRoot.appendChild(wrap);
    state.activeTargets.add(wrap);

    if(kind === 'power'){
      pulseTarget(wrap, data.color || '#facc15');
    }

    return wrap;
  }

  function pulseTarget(wrap, color){
    const ring = DOC.createElement('a-ring');
    ring.setAttribute('position', '0 0 0.05');
    ring.setAttribute('radius-inner', '0.46');
    ring.setAttribute('radius-outer', '0.54');
    ring.setAttribute('color', color);
    ring.setAttribute('opacity', '0.72');
    ring.setAttribute('animation__pulse', {
      property:'scale',
      to:'1.25 1.25 1.25',
      dir:'alternate',
      dur:520,
      loop:true,
      easing:'easeInOutSine'
    });
    wrap.appendChild(ring);
  }

  function spawn(){
    if(!state.started || state.ended) return;

    const r = Math.random();

    if(r < D.powerRate){
      createTarget('power', pick(POWERUPS));
      return;
    }

    if(r < D.powerRate + D.fakeRate){
      createTarget('fake', pick(FAKE_FOODS));
      return;
    }

    if(r < D.powerRate + D.fakeRate + D.junkRate){
      createTarget('junk', pick(JUNK_FOODS));
      return;
    }

    createTarget('good', pick(GOOD_FOODS));
  }

  function scheduleSpawn(){
    clearInterval(state.spawnTimer);

    state.spawnTimer = setInterval(function(){
      spawn();

      if(isMagnet()){
        magnetCollect();
      }
    }, Math.max(420, D.spawnMs - Math.min(240, state.combo * 12)));
  }

  function nearestTarget(){
    const ray = el.aimRay && el.aimRay.components && el.aimRay.components.raycaster;
    if(ray && ray.intersections && ray.intersections.length){
      const hit = ray.intersections.find(x => {
        const obj = x.object && x.object.el;
        return obj && obj.closest && obj.closest('.gj-target');
      });

      if(hit && hit.object && hit.object.el){
        return hit.object.el.closest('.gj-target');
      }
    }

    return null;
  }

  function shoot(){
    if(!state.started || state.ended) return;

    state.shots += 1;

    const target = nearestTarget();
    if(target){
      const kind = target.dataset.kind;
      const data = target.__gjData || {};
      hitTarget(target, kind, data);
    }else{
      state.combo = 0;
      toast('พลาดเป้า! เล็งอาหารดีอีกครั้ง');
      updateHud();
    }
  }

  function hitTarget(wrap, kind, data){
    if(!wrap || wrap.dataset.consumed === '1' || state.ended) return;

    wrap.dataset.consumed = '1';
    state.activeTargets.delete(wrap);

    if(kind === 'good'){
      hitGood(wrap, data);
    }else if(kind === 'junk'){
      hitBad(wrap, data, 'junk');
    }else if(kind === 'fake'){
      hitBad(wrap, data, 'fake');
    }else if(kind === 'power'){
      hitPower(wrap, data);
    }

    popFx(wrap, kind, data);
    setTimeout(() => {
      try{ wrap.remove(); }catch(e){}
    }, 40);

    updateHud();
  }

  function hitGood(wrap, data){
    state.goodHits += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);

    let points = 10 + Math.min(30, state.combo * 2);
    let damage = 10 + Math.min(26, state.combo * 1.5);

    if(isFever()){
      points *= 2;
      damage *= 1.6;
    }

    if(state.powerFoodReady){
      points += 80;
      damage *= 2.4;
      state.powerFoodReady = false;
      toast('⭐ Power Food Strike!');
    }else{
      toast(`ดีมาก! ${data.icon || '🥦'} Combo x${state.combo}`);
    }

    state.score += Math.round(points);
    state.bossHp = Math.max(0, state.bossHp - Math.round(damage));

    bossHitFx();
    setMission('good');

    if(state.combo >= 5) setMission('combo');

    if(state.bossHp <= 0){
      setMission('boss');
      endGame(true, 'boss-defeated');
    }
  }

  function hitBad(wrap, data, badType){
    if(state.shield > 0){
      state.shield -= 1;
      state.score += 8;
      toast('🛡️ Shield ช่วยกันพลาด!');
      return;
    }

    state.combo = 0;
    state.misses += 1;

    if(badType === 'junk') state.junkHits += 1;
    if(badType === 'fake') state.fakeHits += 1;

    state.lives -= 1;
    state.bossHp = Math.min(state.bossMaxHp, state.bossHp + 8);

    cameraShake();
    toast(badType === 'fake' ? `ระวัง Fake Healthy! ${data.icon || '🧃'}` : `โดน Junk! ${data.icon || '🍟'}`);

    if(state.lives <= 0){
      endGame(false, 'no-lives');
    }
  }

  function hitPower(wrap, data){
    state.powerHits += 1;
    state.score += 35;
    state.combo += 1;

    if(data.id === 'shield'){
      state.shield = Math.min(2, state.shield + 1);
      toast('🛡️ ได้ Shield!');
    }else if(data.id === 'magnet'){
      state.magnetUntil = now() + 5200;
      toast('🧲 Magnet ดูดอาหารดี!');
    }else if(data.id === 'fever'){
      state.feverUntil = now() + 6500;
      toast('⚡ Fever Time!');
    }else if(data.id === 'heal'){
      state.lives = Math.min(D.lives, state.lives + 1);
      toast('💚 ฟื้นพลัง +1');
    }else if(data.id === 'powerFood'){
      state.powerFoodReady = true;
      toast('⭐ Power Food พร้อมยิง!');
    }

    setMission('power');
  }

  function expireTarget(wrap, kind, data){
    if(!wrap || wrap.dataset.consumed === '1') return;

    wrap.dataset.consumed = '1';
    state.activeTargets.delete(wrap);

    if(kind === 'good'){
      state.misses += 1;
      state.combo = 0;
      toast(`พลาดอาหารดี ${data.icon || ''}`);
    }

    setTimeout(() => {
      try{ wrap.remove(); }catch(e){}
    }, 20);

    updateHud();
  }

  function magnetCollect(){
    const goods = Array.from(state.activeTargets)
      .filter(x => x && x.dataset && x.dataset.kind === 'good' && x.dataset.consumed !== '1')
      .sort((a,b) => {
        const pa = a.object3D.position;
        const pb = b.object3D.position;
        return pa.distanceTo(el.camera.object3D.position) - pb.distanceTo(el.camera.object3D.position);
      });

    const target = goods[0];
    if(target){
      const data = target.__gjData || GOOD_FOODS[0];
      hitTarget(target, 'good', data);
    }
  }

  function popFx(wrap, kind, data){
    const pos = wrap.object3D.position.clone();
    const fx = DOC.createElement('a-text');

    fx.setAttribute('value',
      kind === 'good' ? '+GOOD' :
      kind === 'power' ? data.icon || '⭐' :
      'MISS'
    );

    fx.setAttribute('align', 'center');
    fx.setAttribute('width', '3');
    fx.setAttribute('color',
      kind === 'good' ? '#16a34a' :
      kind === 'power' ? '#f59e0b' :
      '#ef4444'
    );

    fx.setAttribute('position', `${pos.x} ${pos.y + 0.32} ${pos.z}`);
    fx.setAttribute('animation__rise', {
      property:'position',
      to:`${pos.x} ${pos.y + 1.1} ${pos.z}`,
      dur:650,
      easing:'easeOutQuad'
    });
    fx.setAttribute('animation__fade', {
      property:'opacity',
      to:'0',
      dur:650,
      easing:'easeOutQuad'
    });

    el.fxRoot.appendChild(fx);
    setTimeout(() => {
      try{ fx.remove(); }catch(e){}
    }, 720);
  }

  function bossHitFx(){
    if(!el.bossRoot) return;

    el.bossRoot.setAttribute('animation__hit', {
      property:'scale',
      from:'1.15 1.15 1.15',
      to:'1 1 1',
      dur:190,
      easing:'easeOutQuad'
    });

    const beam = DOC.createElement('a-cylinder');
    beam.setAttribute('radius', '0.035');
    beam.setAttribute('height', '6.8');
    beam.setAttribute('color', isFever() ? '#facc15' : '#22c55e');
    beam.setAttribute('opacity', '0.65');
    beam.setAttribute('material', 'transparent:true; opacity:0.65');
    beam.setAttribute('position', '0 1.65 -4');
    beam.setAttribute('rotation', '90 0 0');
    beam.setAttribute('animation__fade', {
      property:'opacity',
      to:'0',
      dur:220
    });

    el.fxRoot.appendChild(beam);
    setTimeout(() => {
      try{ beam.remove(); }catch(e){}
    }, 260);
  }

  function cameraShake(){
    const rig = byId('cameraRig');
    if(!rig) return;

    rig.setAttribute('animation__shake', {
      property:'position',
      from:'0.06 1.6 0.04',
      to:'0 1.6 0',
      dur:180,
      easing:'easeOutQuad'
    });
  }

  function clearTargets(){
    Array.from(state.activeTargets).forEach(t => {
      try{ t.remove(); }catch(e){}
    });
    state.activeTargets.clear();

    if(el.targetRoot){
      el.targetRoot.innerHTML = '';
    }
  }

  function tickClock(){
    clearInterval(state.clockTimer);

    state.clockTimer = setInterval(function(){
      if(!state.started || state.ended) return;

      state.timeLeft -= 1;

      if(isFever() && el.scene){
        el.scene.setAttribute('background', 'color', '#fff7cc');
      }else if(el.scene){
        el.scene.setAttribute('background', 'color', '#dff7ec');
      }

      if(state.timeLeft <= 0){
        endGame(state.bossHp <= state.bossMaxHp * 0.25, 'time-up');
      }

      updateHud();
    }, 1000);
  }

  function startGame(){
    if(state.started && !state.ended) return;

    state.ready = true;
    state.started = true;
    state.ended = false;

    state.score = 0;
    state.lives = D.lives;
    state.combo = 0;
    state.bestCombo = 0;
    state.bossHp = D.bossHp;
    state.bossMaxHp = D.bossHp;
    state.timeLeft = cfg.time;

    state.goodHits = 0;
    state.junkHits = 0;
    state.fakeHits = 0;
    state.misses = 0;
    state.shots = 0;
    state.powerHits = 0;

    state.shield = 0;
    state.feverUntil = 0;
    state.magnetUntil = 0;
    state.powerFoodReady = false;

    state.missionIndex = 0;
    state.missionCount = 0;
    state.startAt = now();

    clearTargets();

    if(el.startOverlay) el.startOverlay.classList.add('hidden');
    if(el.summaryOverlay) el.summaryOverlay.classList.add('hidden');

    makeArenaDecor();
    updateHud();
    toast('เริ่ม! ยิงอาหารดีเพื่อโจมตีบอส');

    setTimeout(spawn, 400);
    setTimeout(spawn, 900);
    scheduleSpawn();
    tickClock();

    dispatch('gjvr:start', {
      patch:PATCH,
      cfg
    });
  }

  function calculateRank(){
    const accuracy = state.shots > 0 ? state.goodHits / Math.max(1, state.shots) : 0;
    const hpWin = state.bossHp <= 0;
    const survival = state.lives / D.lives;

    let stars = 1;
    if(hpWin) stars += 1;
    if(accuracy >= 0.55) stars += 1;
    if(state.bestCombo >= 8) stars += 1;
    if(survival >= 0.5) stars += 1;

    stars = clamp(stars, 1, 5);

    let rank = 'C';
    if(stars >= 5) rank = 'S';
    else if(stars >= 4) rank = 'A';
    else if(stars >= 3) rank = 'B';

    return { rank, stars, accuracy };
  }

  function endGame(win, reason){
    if(state.ended) return;

    state.ended = true;
    state.endedAt = now();

    clearInterval(state.spawnTimer);
    clearInterval(state.clockTimer);
    clearTargets();

    const result = calculateRank();

    if(el.summaryIcon) el.summaryIcon.textContent = win ? '🏆' : '💪';
    if(el.summaryTitle) el.summaryTitle.textContent = win ? 'Victory!' : 'Good Try!';
    if(el.summaryTip){
      el.summaryTip.textContent = state.fakeHits > 0
        ? 'วันนี้พลาด fake healthy ด้วย ระวังน้ำหวาน/ซีเรียลหวานที่ดูเหมือนสุขภาพดี'
        : 'เลือกอาหารดีได้ดีมาก ลองรักษา combo ให้สูงขึ้นในรอบหน้า';
    }

    if(el.sumScore) el.sumScore.textContent = String(state.score);
    if(el.sumRank) el.sumRank.textContent = `${result.rank} ⭐${result.stars}`;
    if(el.sumGood) el.sumGood.textContent = String(state.goodHits);
    if(el.sumMiss) el.sumMiss.textContent = String(state.misses + state.junkHits + state.fakeHits);

    if(el.summaryOverlay) el.summaryOverlay.classList.remove('hidden');

    try{
      localStorage.setItem('GJ_SOLO_BOSS_VR_LAST_SUMMARY', JSON.stringify({
        patch:PATCH,
        win,
        reason,
        score:state.score,
        rank:result.rank,
        stars:result.stars,
        goodHits:state.goodHits,
        junkHits:state.junkHits,
        fakeHits:state.fakeHits,
        misses:state.misses,
        bestCombo:state.bestCombo,
        durationSec:Math.round((state.endedAt - state.startAt) / 1000),
        cooldownUrl:buildCooldownUrl('summary'),
        launcher:ROUTES.launcher,
        savedAt:new Date().toISOString()
      }));
    }catch(e){}

    dispatch('gjvr:end', {
      patch:PATCH,
      win,
      reason,
      score:state.score,
      rank:result.rank
    });
  }

  function dispatch(name, detail){
    try{
      WIN.dispatchEvent(new CustomEvent(name, {
        detail: detail || {}
      }));
    }catch(e){}
  }

  function bind(){
    el.startBtn?.addEventListener('click', startGame);

    el.startVrHintBtn?.addEventListener('click', function(){
      toast('กดปุ่ม Enter VR ของเบราว์เซอร์ หรือใช้ปุ่มยิง 🎯 เพื่อเล่นแบบ crosshair');
    });

    el.shootBtn?.addEventListener('click', function(ev){
      ev.preventDefault();
      shoot();
    });

    DOC.addEventListener('keydown', function(ev){
      if(ev.code === 'Space' || ev.code === 'Enter'){
        ev.preventDefault();
        shoot();
      }
    });

    WIN.addEventListener('hha:shoot', function(){
      shoot();
    });

    el.backBtn?.addEventListener('click', goLauncher);
    el.cooldownBtn?.addEventListener('click', goCooldown);
    el.replayBtn?.addEventListener('click', replay);
    el.launcherBtn?.addEventListener('click', goLauncher);
    el.hubBtn?.addEventListener('click', goHub);

    DOC.addEventListener('click', function(ev){
      const target = ev.target && ev.target.closest
        ? ev.target.closest('.gj-target')
        : null;

      if(target){
        const kind = target.dataset.kind;
        const data = target.__gjData || {};
        hitTarget(target, kind, data);
      }
    }, true);
  }

  function patchTargetData(){
    const oldCreateTarget = createTarget;
    createTarget = function(kind, data){
      const target = oldCreateTarget(kind, data);
      target.__gjData = data;
      return target;
    };
  }

  function boot(){
    patchTargetData();
    bind();
    updateHud();

    dispatch('gjvr:ready', {
      patch:PATCH,
      cfg
    });

    try{
      WIN.GoodJunkSoloBossVR = {
        version:PATCH,
        startGame,
        endGame,
        shoot,
        goCooldown,
        getState:()=>({
          ...state,
          patch:PATCH
        })
      };
      WIN.GJSBVR = WIN.GoodJunkSoloBossVR;
    }catch(e){}
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();