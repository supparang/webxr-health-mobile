// === /herohealth/vr-goodjunk/goodjunk-solo-boss-powerups.js ===
// GoodJunk Solo Boss Power-up Pack
// PATCH v8.41.15-POWERUP-PACK
// ✅ Shield blocks one junk/fake mistake
// ✅ Magnet auto-collects nearby good foods
// ✅ Fever gives score boost + good food glow
// ✅ Heart heals 1 life
// ✅ Power Food boosts boss hit
// ✅ child-friendly floating HUD
// ✅ works with v8.41.0 main + v8.41.2 mobile + v8.41.10 touch comfort
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.41.15-POWERUP-PACK';

  const CFG = {
    enabled: QS.get('powerups') !== '0',
    debug: QS.get('debugBoss') === '1',
    diff: String(QS.get('diff') || 'normal').toLowerCase(),
    view: String(QS.get('view') || 'mobile').toLowerCase()
  };

  const IS_MOBILE = (() => {
    try{
      return CFG.view === 'mobile' ||
        CFG.view === 'cvr' ||
        (WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches) ||
        Math.min(WIN.innerWidth || 999, WIN.innerHeight || 999) <= 760;
    }catch(e){
      return true;
    }
  })();

  const DIFF = {
    easy:      { intervalMin:10000, intervalMax:15000, feverSec:7, magnetSec:5, shieldMax:2, maxLives:5 },
    normal:    { intervalMin:12000, intervalMax:18000, feverSec:6, magnetSec:4, shieldMax:2, maxLives:4 },
    hard:      { intervalMin:14000, intervalMax:21000, feverSec:5, magnetSec:4, shieldMax:1, maxLives:3 },
    challenge: { intervalMin:16000, intervalMax:24000, feverSec:5, magnetSec:3, shieldMax:1, maxLives:3 }
  };

  const D = DIFF[CFG.diff] || DIFF.normal;

  const POWERUPS = {
    shield: {
      id:'shield',
      icon:'🛡️',
      name:'โล่ป้องกัน',
      label:'Shield',
      desc:'กัน junk หรืออาหารหลอกตาได้ 1 ครั้ง',
      cls:'gjpu-shield'
    },
    magnet: {
      id:'magnet',
      icon:'🧲',
      name:'แม่เหล็กอาหารดี',
      label:'Magnet',
      desc:'ดูดอาหารดีใกล้ ๆ อัตโนมัติ',
      cls:'gjpu-magnet'
    },
    fever: {
      id:'fever',
      icon:'⚡',
      name:'Fever Time',
      label:'Fever',
      desc:'คะแนนเพิ่ม และอาหารดีสว่างขึ้น',
      cls:'gjpu-fever'
    },
    heal: {
      id:'heal',
      icon:'💚',
      name:'หัวใจฟื้นพลัง',
      label:'Heal',
      desc:'เพิ่มชีวิต 1 ดวง',
      cls:'gjpu-heal'
    },
    powerFood: {
      id:'powerFood',
      icon:'⭐',
      name:'Power Food',
      label:'Power',
      desc:'อาหารดีพิเศษ โจมตีบอสแรงขึ้น',
      cls:'gjpu-power'
    }
  };

  const state = {
    started:false,
    ended:false,
    startAt:0,

    shield:0,
    magnetUntil:0,
    feverUntil:0,
    feverCombo:0,

    spawned:0,
    collected:0,
    shieldBlocks:0,
    magnetCollects:0,
    feverHits:0,
    heals:0,
    powerFoodHits:0,

    lastPowerAt:0,
    nextPowerDelay:0,
    timer:null,
    magnetTimer:null,

    root:null,
    hud:null,
    debugBox:null,

    patchedMain:false,
    originalHitFood:null,
    originalUpdateHUD:null
  };

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function rand(a, b){
    return a + Math.random() * (b - a);
  }

  function now(){
    return Date.now();
  }

  function active(id){
    if(id === 'magnet') return state.magnetUntil > now();
    if(id === 'fever') return state.feverUntil > now();
    return false;
  }

  function getMain(){
    return WIN.GJSBM || WIN.GoodJunkSoloBossMain || null;
  }

  function getShim(){
    return WIN.GJBS || WIN.GoodJunkSoloBossShim || null;
  }

  function getMainState(){
    try{
      return getMain()?.getState?.() || {};
    }catch(e){
      return {};
    }
  }

  function dispatch(name, detail){
    WIN.dispatchEvent(new CustomEvent(name, {
      detail:{
        patch:PATCH,
        source:'powerups',
        ...(detail || {})
      }
    }));
  }

  function ensureStyle(){
    if(DOC.getElementById('gjPowerupsStyle')) return;

    const css = DOC.createElement('style');
    css.id = 'gjPowerupsStyle';
    css.textContent = `
      .gjpu-root{
        position:fixed;
        right:calc(10px + env(safe-area-inset-right));
        top:calc(84px + env(safe-area-inset-top));
        z-index:100050;
        display:grid;
        gap:6px;
        pointer-events:none;
        width:min(176px, calc(50vw - 12px));
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .gjpu-card{
        display:grid;
        grid-template-columns:34px 1fr;
        gap:7px;
        align-items:center;
        min-height:42px;
        border-radius:17px;
        padding:7px 8px;
        background:rgba(255,255,255,.88);
        border:2px solid rgba(255,255,255,.92);
        box-shadow:0 10px 22px rgba(15,23,42,.12);
        backdrop-filter:blur(8px);
        transform:translateX(8px) scale(.96);
        opacity:.72;
        transition:opacity .16s ease, transform .16s ease, box-shadow .16s ease;
      }

      .gjpu-card.on{
        opacity:1;
        transform:translateX(0) scale(1);
        box-shadow:0 12px 28px rgba(15,23,42,.18);
      }

      .gjpu-card .ico{
        width:34px;
        height:34px;
        border-radius:14px;
        display:grid;
        place-items:center;
        font-size:22px;
        background:linear-gradient(180deg,#fff7ed,#fde68a);
        box-shadow:inset 0 -4px 0 rgba(15,23,42,.08);
      }

      .gjpu-card b{
        display:block;
        color:#0f172a;
        font-size:12px;
        line-height:1.05;
      }

      .gjpu-card span{
        display:block;
        margin-top:2px;
        color:#64748b;
        font-size:10px;
        font-weight:850;
        line-height:1.12;
      }

      .gjpu-card.shield.on{
        border-color:rgba(56,189,248,.65);
      }

      .gjpu-card.magnet.on{
        border-color:rgba(168,85,247,.65);
      }

      .gjpu-card.fever.on{
        border-color:rgba(250,204,21,.76);
        animation:gjpuPulse .58s ease-in-out infinite alternate;
      }

      .gjpu-item{
        position:absolute;
        top:calc(130px + env(safe-area-inset-top));
        width:76px;
        min-height:82px;
        border:0;
        border-radius:26px;
        padding:8px 6px;
        display:grid;
        place-items:center;
        background:linear-gradient(180deg,#ffffff,#fef3c7);
        box-shadow:
          0 16px 32px rgba(15,23,42,.20),
          0 0 0 4px rgba(250,204,21,.26),
          inset 0 -5px 0 rgba(15,23,42,.07);
        cursor:pointer;
        touch-action:manipulation;
        animation:gjpuDrop var(--dur, 5s) linear forwards, gjpuFloat .72s ease-in-out infinite alternate;
        z-index:36;
      }

      .gjpu-item::after{
        content:"";
        position:absolute;
        inset:-22px;
        border-radius:34px;
      }

      .gjpu-item b{
        display:block;
        font-size:36px;
        line-height:1;
      }

      .gjpu-item span{
        display:block;
        margin-top:3px;
        color:#334155;
        font-size:10px;
        font-weight:1000;
        line-height:1.05;
        text-align:center;
      }

      .gjpu-item.gjpu-shield{
        background:linear-gradient(180deg,#ffffff,#e0f2fe);
        box-shadow:0 16px 32px rgba(15,23,42,.20),0 0 0 4px rgba(56,189,248,.34);
      }

      .gjpu-item.gjpu-magnet{
        background:linear-gradient(180deg,#ffffff,#f3e8ff);
        box-shadow:0 16px 32px rgba(15,23,42,.20),0 0 0 4px rgba(168,85,247,.34);
      }

      .gjpu-item.gjpu-fever{
        background:linear-gradient(180deg,#ffffff,#fef9c3);
        box-shadow:0 16px 32px rgba(15,23,42,.20),0 0 0 4px rgba(250,204,21,.42);
      }

      .gjpu-item.gjpu-heal{
        background:linear-gradient(180deg,#ffffff,#dcfce7);
        box-shadow:0 16px 32px rgba(15,23,42,.20),0 0 0 4px rgba(34,197,94,.34);
      }

      .gjpu-item.gjpu-power{
        background:linear-gradient(180deg,#ffffff,#fef3c7);
        box-shadow:0 16px 32px rgba(15,23,42,.20),0 0 0 4px rgba(251,191,36,.45);
      }

      html.gjpu-fever-on .gjm-food[data-food-type="good"],
      html.gjpu-fever-on .goodjunk-food[data-food-type="good"]{
        box-shadow:
          0 16px 34px rgba(15,23,42,.18),
          0 0 0 5px rgba(250,204,21,.34),
          0 0 22px rgba(250,204,21,.48) !important;
        filter:brightness(1.09) drop-shadow(0 0 12px rgba(250,204,21,.38));
      }

      html.gjpu-magnet-on .gjm-food[data-food-type="good"],
      html.gjpu-magnet-on .goodjunk-food[data-food-type="good"]{
        outline:4px solid rgba(168,85,247,.35) !important;
        outline-offset:5px;
      }

      .gjpu-toast{
        position:fixed;
        left:50%;
        bottom:calc(132px + env(safe-area-inset-bottom));
        z-index:100060;
        transform:translateX(-50%) translateY(10px) scale(.96);
        width:min(430px, calc(100vw - 28px));
        border-radius:999px;
        padding:11px 15px;
        background:rgba(15,23,42,.86);
        color:#fff;
        border:2px solid rgba(255,255,255,.75);
        box-shadow:0 14px 36px rgba(15,23,42,.28);
        text-align:center;
        font-size:13px;
        font-weight:950;
        line-height:1.25;
        pointer-events:none;
        opacity:0;
        transition:opacity .18s ease, transform .18s ease;
        backdrop-filter:blur(8px);
      }

      .gjpu-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0) scale(1);
      }

      .gjpu-fx{
        position:fixed;
        left:50%;
        top:50%;
        z-index:100052;
        pointer-events:none;
        transform:translate(-50%,-50%);
        font-size:74px;
        opacity:0;
        animation:gjpuFx .72s ease forwards;
        filter:drop-shadow(0 10px 22px rgba(15,23,42,.22));
      }

      .gjpu-debug{
        position:fixed;
        right:10px;
        bottom:calc(410px + env(safe-area-inset-bottom));
        z-index:100140;
        width:min(285px, calc(100vw - 20px));
        border-radius:16px;
        padding:10px;
        background:rgba(15,23,42,.86);
        color:#e5e7eb;
        font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        font-size:11px;
        line-height:1.35;
        white-space:pre-wrap;
        pointer-events:none;
      }

      @keyframes gjpuDrop{
        from{ transform:translateY(0) rotate(-3deg); opacity:1; }
        to{ transform:translateY(calc(100dvh + 90px)) rotate(8deg); opacity:.98; }
      }

      @keyframes gjpuFloat{
        from{ scale:1; }
        to{ scale:1.055; }
      }

      @keyframes gjpuPulse{
        from{ transform:translateX(0) scale(1); }
        to{ transform:translateX(0) scale(1.035); }
      }

      @keyframes gjpuFx{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.35) rotate(-8deg); }
        35%{ opacity:1; transform:translate(-50%,-50%) scale(1.08) rotate(4deg); }
        100%{ opacity:0; transform:translate(-50%,-58%) scale(1.38) rotate(0); }
      }

      @media (max-width:720px){
        .gjpu-root{
          right:8px;
          top:calc(112px + env(safe-area-inset-top));
          width:min(150px, calc(48vw - 8px));
        }

        .gjpu-card{
          grid-template-columns:30px 1fr;
          min-height:38px;
          padding:6px 7px;
          border-radius:15px;
        }

        .gjpu-card .ico{
          width:30px;
          height:30px;
          border-radius:12px;
          font-size:20px;
        }

        .gjpu-card b{
          font-size:11px;
        }

        .gjpu-card span{
          font-size:9px;
        }

        .gjpu-item{
          width:72px;
          min-height:78px;
          border-radius:24px;
        }

        .gjpu-item b{
          font-size:34px;
        }
      }

      @media (max-width:420px){
        .gjpu-root{
          top:calc(116px + env(safe-area-inset-top));
          width:138px;
        }

        .gjpu-card span{
          display:none;
        }

        .gjpu-toast{
          bottom:calc(118px + env(safe-area-inset-bottom));
          font-size:12px;
        }
      }
    `;

    DOC.head.appendChild(css);
  }

  function ensureHUD(){
    ensureStyle();

    let root = DOC.getElementById('gjPowerupsRoot');
    if(root) return root;

    root = DOC.createElement('section');
    root.id = 'gjPowerupsRoot';
    root.className = 'gjpu-root';
    root.innerHTML = `
      <div class="gjpu-card shield" id="gjpuShieldCard">
        <div class="ico">🛡️</div>
        <div><b>Shield</b><span id="gjpuShieldText">ยังไม่มีโล่</span></div>
      </div>
      <div class="gjpu-card magnet" id="gjpuMagnetCard">
        <div class="ico">🧲</div>
        <div><b>Magnet</b><span id="gjpuMagnetText">ปิดอยู่</span></div>
      </div>
      <div class="gjpu-card fever" id="gjpuFeverCard">
        <div class="ico">⚡</div>
        <div><b>Fever</b><span id="gjpuFeverText">ปิดอยู่</span></div>
      </div>
    `;

    DOC.body.appendChild(root);
    state.root = root;

    updateHUD();

    return root;
  }

  function setText(id, text){
    const el = DOC.getElementById(id);
    if(el) el.textContent = String(text);
  }

  function updateHUD(){
    ensureHUD();

    const shieldCard = DOC.getElementById('gjpuShieldCard');
    const magnetCard = DOC.getElementById('gjpuMagnetCard');
    const feverCard = DOC.getElementById('gjpuFeverCard');

    if(shieldCard) shieldCard.classList.toggle('on', state.shield > 0);
    if(magnetCard) magnetCard.classList.toggle('on', active('magnet'));
    if(feverCard) feverCard.classList.toggle('on', active('fever'));

    setText('gjpuShieldText', state.shield > 0 ? `พร้อมใช้ x${state.shield}` : 'ยังไม่มีโล่');

    const magnetLeft = Math.max(0, Math.ceil((state.magnetUntil - now()) / 1000));
    setText('gjpuMagnetText', magnetLeft > 0 ? `${magnetLeft}s` : 'ปิดอยู่');

    const feverLeft = Math.max(0, Math.ceil((state.feverUntil - now()) / 1000));
    setText('gjpuFeverText', feverLeft > 0 ? `${feverLeft}s` : 'ปิดอยู่');

    DOC.documentElement.classList.toggle('gjpu-magnet-on', active('magnet'));
    DOC.documentElement.classList.toggle('gjpu-fever-on', active('fever'));
  }

  let toastTimer = null;
  function toast(text){
    ensureStyle();

    let el = DOC.getElementById('gjpuToast');
    if(!el){
      el = DOC.createElement('div');
      el.id = 'gjpuToast';
      el.className = 'gjpu-toast';
      DOC.body.appendChild(el);
    }

    el.textContent = text;
    el.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 1700);
  }

  function fx(icon){
    const el = DOC.createElement('div');
    el.className = 'gjpu-fx';
    el.textContent = icon;
    DOC.body.appendChild(el);
    setTimeout(() => el.remove(), 820);
  }

  function choosePowerup(){
    const ms = getMainState();
    const lives = n(ms.lives, D.maxLives);
    const combo = n(ms.combo, 0);
    const misses = n(ms.totalMisses || ms.misses, 0);

    const weights = [];

    weights.push(['shield', lives <= 1 ? 34 : 18]);
    weights.push(['magnet', misses >= 2 ? 30 : 18]);
    weights.push(['fever', combo >= 5 ? 32 : 18]);
    weights.push(['heal', lives < D.maxLives ? 26 : 5]);
    weights.push(['powerFood', combo >= 3 ? 28 : 22]);

    const total = weights.reduce((sum, x) => sum + x[1], 0);
    let r = Math.random() * total;

    for(const [id, w] of weights){
      r -= w;
      if(r <= 0) return id;
    }

    return 'shield';
  }

  function scheduleNext(){
    clearTimeout(state.timer);

    if(!state.started || state.ended) return;

    state.nextPowerDelay = rand(D.intervalMin, D.intervalMax);

    state.timer = setTimeout(() => {
      if(!state.started || state.ended) return;

      spawnPowerup();
      scheduleNext();
    }, state.nextPowerDelay);
  }

  function randomLeft(){
    return clamp(10 + Math.random() * 74, 10, 84);
  }

  function getGameArea(){
    return DOC.getElementById('gjSoloBossArea') ||
      DOC.querySelector('.gjm-area') ||
      DOC.body;
  }

  function spawnPowerup(forceId){
    if(!CFG.enabled || !state.started || state.ended) return null;

    ensureStyle();

    const id = forceId || choosePowerup();
    const p = POWERUPS[id] || POWERUPS.shield;

    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = `gjpu-item ${p.cls}`;
    el.dataset.powerup = p.id;
    el.style.left = `${randomLeft()}%`;
    el.style.setProperty('--dur', `${IS_MOBILE ? 5600 : 5000}ms`);
    el.innerHTML = `<b>${p.icon}</b><span>${p.label}</span>`;

    el.addEventListener('click', function(ev){
      ev.preventDefault();
      collectPowerup(p.id, el);
    }, { passive:false });

    el.addEventListener('animationend', function(){
      try{ el.remove(); }catch(e){}
    });

    getGameArea().appendChild(el);

    state.spawned += 1;
    state.lastPowerAt = now();

    dispatch('gj:powerup-spawn', {
      id:p.id,
      label:p.label,
      name:p.name
    });

    renderDebug();

    return el;
  }

  function collectPowerup(id, el){
    const p = POWERUPS[id] || POWERUPS.shield;

    if(el){
      el.dataset.consumed = '1';
      try{ el.remove(); }catch(e){}
    }

    state.collected += 1;

    if(id === 'shield'){
      state.shield = clamp(state.shield + 1, 0, D.shieldMax);
      toast('🛡️ ได้โล่! กันพลาดได้ 1 ครั้ง');
    }else if(id === 'magnet'){
      state.magnetUntil = Math.max(state.magnetUntil, now()) + D.magnetSec * 1000;
      toast('🧲 แม่เหล็กทำงาน! ดูดอาหารดีใกล้ ๆ');
      startMagnet();
    }else if(id === 'fever'){
      state.feverUntil = Math.max(state.feverUntil, now()) + D.feverSec * 1000;
      state.feverCombo += 1;
      toast('⚡ Fever! คะแนนอาหารดีเพิ่มขึ้น');
    }else if(id === 'heal'){
      healOne();
      state.heals += 1;
      toast('💚 ฟื้นพลัง +1 ชีวิต');
    }else if(id === 'powerFood'){
      triggerPowerFood();
      toast('⭐ Power Food! อาหารดีชิ้นถัดไปแรงขึ้น');
    }

    fx(p.icon);
    updateHUD();

    dispatch('gj:powerup-collect', {
      id,
      label:p.label,
      name:p.name,
      shield:state.shield,
      magnetUntil:state.magnetUntil,
      feverUntil:state.feverUntil
    });

    renderDebug();
  }

  function healOne(){
    const main = getMain();
    const ms = getMainState();
    const currentLives = n(ms.lives, D.maxLives);

    if(main && typeof main.getState === 'function'){
      // main ไม่มี public setter จึงใช้ event ให้ addon อื่นรับ และ patch updateHUD ช่วย sync เท่าที่ทำได้
      dispatch('gj:powerup-heal', {
        beforeLives:currentLives,
        add:1,
        maxLives:D.maxLives
      });
    }

    // fallback แบบ DOM-only: ถ้า main state ไม่เปิด setter อย่างน้อยแสดงผลใน HUD เดิมไม่พัง
    const livesEl = DOC.getElementById('gjmLives');
    if(livesEl){
      const next = clamp(currentLives + 1, 0, D.maxLives);
      livesEl.textContent = next > 0 ? '💚'.repeat(next) : '💔';
    }
  }

  function triggerPowerFood(){
    WIN.__GJ_POWERFOOD_NEXT = true;

    dispatch('gj:powerfood-ready', {
      nextGoodHitBoost:true
    });
  }

  function goodFoodNodes(){
    return Array.from(DOC.querySelectorAll('.gjm-food[data-food-type="good"],.goodjunk-food[data-food-type="good"]'))
      .filter(el => el && el.dataset && el.dataset.consumed !== '1' && el.dataset.gjConsumed !== '1');
  }

  function distanceToCenter(el){
    const r = el.getBoundingClientRect();
    const cx = WIN.innerWidth / 2;
    const cy = WIN.innerHeight * 0.56;
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const dx = ex - cx;
    const dy = ey - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function startMagnet(){
    clearInterval(state.magnetTimer);

    state.magnetTimer = setInterval(() => {
      if(!active('magnet') || state.ended){
        clearInterval(state.magnetTimer);
        updateHUD();
        return;
      }

      const foods = goodFoodNodes()
        .sort((a,b) => distanceToCenter(a) - distanceToCenter(b))
        .slice(0, 1);

      foods.forEach(el => {
        if(distanceToCenter(el) <= (IS_MOBILE ? 210 : 180)){
          state.magnetCollects += 1;
          try{ el.click(); }catch(e){}
        }
      });

      updateHUD();
      renderDebug();
    }, 620);
  }

  function patchMain(){
    const main = getMain();
    if(!main || state.patchedMain) return;

    if(typeof main.hitFood === 'function'){
      state.originalHitFood = main.hitFood.bind(main);

      main.hitFood = function(food, el, ev){
        food = food || {};

        const type = String(food.type || '').toLowerCase();

        // โล่กัน junk/fake 1 ครั้ง
        if((type === 'junk' || type === 'fake') && state.shield > 0){
          state.shield -= 1;
          state.shieldBlocks += 1;

          if(el){
            el.dataset.consumed = '1';
            try{ el.remove(); }catch(e){}
          }

          toast('🛡️ โล่ช่วยกันพลาด!');
          fx('🛡️');
          updateHUD();

          dispatch('gj:powerup-shield-block', {
            food,
            shieldLeft:state.shield
          });

          return;
        }

        // Fever / Power Food ปรับ food flag ก่อนเข้า main
        if(type === 'good'){
          if(active('fever')){
            food.feverFood = true;
            food.powerFood = true;
            food.goodHint = true;
            state.feverHits += 1;
          }

          if(WIN.__GJ_POWERFOOD_NEXT){
            food.powerFood = true;
            food.finalStrikeFood = true;
            food.goodHint = true;
            WIN.__GJ_POWERFOOD_NEXT = false;
            state.powerFoodHits += 1;

            dispatch('gj:powerfood-hit', {
              food
            });
          }
        }

        return state.originalHitFood(food, el, ev);
      };
    }

    if(typeof main.updateHUD === 'function'){
      state.originalUpdateHUD = main.updateHUD.bind(main);

      main.updateHUD = function(){
        const out = state.originalUpdateHUD();
        updateHUD();
        return out;
      };
    }

    state.patchedMain = true;

    dispatch('gj:powerup-main-patched', {
      hasHitPatch:Boolean(state.originalHitFood),
      hasHudPatch:Boolean(state.originalUpdateHUD)
    });

    renderDebug();
  }

  function patchShim(){
    const shim = getShim();
    if(!shim || shim.__gjPowerupShimPatched) return;

    const originalHit = typeof shim.hit === 'function'
      ? shim.hit.bind(shim)
      : null;

    if(originalHit){
      shim.hit = function(foodOrPayload, extra){
        let food = foodOrPayload && foodOrPayload.food
          ? foodOrPayload.food
          : foodOrPayload;

        food = food || {};

        const type = String(food.type || '').toLowerCase();

        if(type === 'good'){
          if(active('fever')){
            extra = extra || {};
            extra.fever = true;
            extra.scoreBoost = 2;
          }

          if(food.powerFood || food.finalStrikeFood || food.feverFood){
            extra = extra || {};
            extra.powerFood = true;
            extra.damageBoost = food.finalStrikeFood ? 1.8 : 1.4;
          }
        }

        return originalHit(foodOrPayload, extra);
      };
    }

    shim.__gjPowerupShimPatched = true;
  }

  function bindEvents(){
    WIN.addEventListener('gj:solo-boss-start', onStart);
    WIN.addEventListener('gj:game-start', onStart);
    WIN.addEventListener('gj:boss-start', onStart);

    WIN.addEventListener('gj:game-end', onEnd);
    WIN.addEventListener('gj:boss-end', onEnd);
    WIN.addEventListener('gj:boss-defeated', onEnd);

    WIN.addEventListener('gj:item-hit', function(e){
      const d = e.detail || {};
      if(d.fever || d.scoreBoost){
        dispatch('gj:powerup-fever-hit', d);
      }
      renderDebug();
    });

    WIN.addEventListener('gj:director-fair-help', function(e){
      const d = e.detail || {};
      if(d.assist && state.started && !state.ended){
        // ถ้าเกมช่วยผู้เล่นแล้ว มีโอกาสให้โล่/แม่เหล็กเร็วขึ้น
        if(now() - state.lastPowerAt > 5000 && Math.random() < 0.45){
          spawnPowerup(getLivesLow() ? 'shield' : 'magnet');
        }
      }
    });
  }

  function getLivesLow(){
    const ms = getMainState();
    return n(ms.lives, 4) <= 1;
  }

  function onStart(){
    if(state.started && !state.ended) return;

    state.started = true;
    state.ended = false;
    state.startAt = now();

    state.shield = 0;
    state.magnetUntil = 0;
    state.feverUntil = 0;
    state.feverCombo = 0;

    state.spawned = 0;
    state.collected = 0;
    state.shieldBlocks = 0;
    state.magnetCollects = 0;
    state.feverHits = 0;
    state.heals = 0;
    state.powerFoodHits = 0;
    state.lastPowerAt = now();

    ensureHUD();
    updateHUD();

    // ให้ power-up ชิ้นแรกมาค่อนข้างเร็ว เพื่อให้เด็กรู้ว่ามีระบบนี้
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if(state.started && !state.ended) spawnPowerup();
      scheduleNext();
    }, 6500);

    toast('มี Power-up แล้ว! มองหา 🛡️ 🧲 ⚡ 💚 ⭐');

    dispatch('gj:powerups-start', {
      patch:PATCH
    });

    renderDebug();
  }

  function onEnd(){
    if(state.ended) return;

    state.ended = true;

    clearTimeout(state.timer);
    clearInterval(state.magnetTimer);

    updateHUD();

    const summary = {
      patch:PATCH,
      spawned:state.spawned,
      collected:state.collected,
      shieldBlocks:state.shieldBlocks,
      magnetCollects:state.magnetCollects,
      feverHits:state.feverHits,
      heals:state.heals,
      powerFoodHits:state.powerFoodHits,
      savedAt:new Date().toISOString()
    };

    try{
      localStorage.setItem('GJ_SOLO_BOSS_POWERUPS_LAST', JSON.stringify(summary));
    }catch(e){}

    dispatch('gj:powerups-summary', summary);

    renderDebug();
  }

  function renderDebug(){
    if(!CFG.debug) return;

    ensureStyle();

    let box = DOC.getElementById('gjPowerupsDebug');
    if(!box){
      box = DOC.createElement('pre');
      box.id = 'gjPowerupsDebug';
      box.className = 'gjpu-debug';
      DOC.body.appendChild(box);
      state.debugBox = box;
    }

    box.textContent =
`GoodJunk Powerups
${PATCH}

started: ${state.started}
ended: ${state.ended}
patchedMain: ${state.patchedMain}

shield: ${state.shield}
magnet: ${Math.max(0, Math.ceil((state.magnetUntil - now()) / 1000))}s
fever: ${Math.max(0, Math.ceil((state.feverUntil - now()) / 1000))}s

spawned: ${state.spawned}
collected: ${state.collected}
shieldBlocks: ${state.shieldBlocks}
magnetCollects: ${state.magnetCollects}
feverHits: ${state.feverHits}
heals: ${state.heals}
powerHits: ${state.powerFoodHits}`;
  }

  function boot(){
    if(!CFG.enabled) return;

    ensureStyle();
    ensureHUD();
    bindEvents();

    setInterval(() => {
      patchMain();
      patchShim();
      updateHUD();
      renderDebug();
    }, CFG.debug ? 700 : 1300);

    dispatch('gj:powerups-ready', {
      patch:PATCH,
      diff:CFG.diff
    });
  }

  WIN.GoodJunkSoloBossPowerups = {
    version:PATCH,
    spawnPowerup,
    collectPowerup,
    updateHUD,
    getState:()=>({
      patch:PATCH,
      started:state.started,
      ended:state.ended,
      shield:state.shield,
      magnetLeftMs:Math.max(0, state.magnetUntil - now()),
      feverLeftMs:Math.max(0, state.feverUntil - now()),
      spawned:state.spawned,
      collected:state.collected,
      shieldBlocks:state.shieldBlocks,
      magnetCollects:state.magnetCollects,
      feverHits:state.feverHits,
      heals:state.heals,
      powerFoodHits:state.powerFoodHits
    })
  };

  WIN.GJPU = WIN.GoodJunkSoloBossPowerups;

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();
