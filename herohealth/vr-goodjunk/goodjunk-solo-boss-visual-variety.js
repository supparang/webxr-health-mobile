// === /herohealth/vr-goodjunk/goodjunk-solo-boss-visual-variety.js ===
// GoodJunk Solo Boss Pattern Visual Variety
// PATCH v8.41.4-BOSS-PATTERN-VISUAL-VARIETY
// ✅ Junk Rain event
// ✅ Sugar Fog event
// ✅ Fake Trap Parade event
// ✅ Healthy Beam event
// ✅ Final Strike event
// ✅ background mood changes by boss phase
// ✅ particle / banner / screen effect
// ✅ works with v8.40.x + v8.41.x
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.41.4-BOSS-PATTERN-VISUAL-VARIETY';

  const CFG = {
    debug: QS.get('debugBoss') === '1',
    enabled: QS.get('visualBoss') !== '0',
    view: String(QS.get('view') || 'mobile').toLowerCase()
  };

  const state = {
    started:false,
    ended:false,
    currentPattern:'ready',
    currentPhase:'opening',
    hpPercent:100,
    pressure:0,
    assist:false,
    eventCount:0,
    lastEventAt:0,
    bannerTimer:null,
    patternTimer:null,
    particlesTimer:null,
    debugBox:null
  };

  const PATTERNS = {
    ready: {
      id:'ready',
      icon:'🥗',
      title:'Healthy Battle!',
      desc:'เลือกอาหารดีเพื่อสู้บอส',
      cls:'gjvv-ready'
    },
    junkRain: {
      id:'junkRain',
      icon:'🌧️',
      title:'Junk Rain!',
      desc:'อาหารขยะกำลังถล่มลงมา ระวังให้ดี',
      cls:'gjvv-junk-rain'
    },
    sugarFog: {
      id:'sugarFog',
      icon:'🍬',
      title:'Sugar Fog!',
      desc:'หมอกน้ำตาลทำให้อาหารหลอกตาเด่นขึ้น',
      cls:'gjvv-sugar-fog'
    },
    fakeParade: {
      id:'fakeParade',
      icon:'🧃',
      title:'Fake Trap Parade!',
      desc:'ของที่ดูเหมือนดี อาจมีน้ำตาลหรือน้ำมันแฝง',
      cls:'gjvv-fake-parade'
    },
    healthyBeam: {
      id:'healthyBeam',
      icon:'💚',
      title:'Healthy Beam!',
      desc:'เก็บอาหารดีต่อเนื่องเพื่อยิงพลังใส่บอส',
      cls:'gjvv-healthy-beam'
    },
    finalStrike: {
      id:'finalStrike',
      icon:'⚡',
      title:'Final Strike!',
      desc:'บอสใกล้แพ้แล้ว ทำคอมโบปิดฉาก!',
      cls:'gjvv-final-strike'
    },
    victory: {
      id:'victory',
      icon:'🏆',
      title:'Victory Burst!',
      desc:'ชนะบอสอาหารขยะแล้ว',
      cls:'gjvv-victory'
    }
  };

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }

  function ensureLayer(){
    let root = DOC.getElementById('gjVisualVarietyLayer');
    if(root) return root;

    root = DOC.createElement('div');
    root.id = 'gjVisualVarietyLayer';
    root.innerHTML = `
      <div class="gjvv-bg" id="gjvvBg"></div>

      <div class="gjvv-banner" id="gjvvBanner">
        <div class="gjvv-icon" id="gjvvIcon">🥗</div>
        <div>
          <b id="gjvvTitle">Healthy Battle!</b>
          <span id="gjvvDesc">เลือกอาหารดีเพื่อสู้บอส</span>
        </div>
      </div>

      <div class="gjvv-particles" id="gjvvParticles"></div>
      <div class="gjvv-beam" id="gjvvBeam"></div>
    `;

    DOC.body.appendChild(root);

    if(!DOC.getElementById('gjVisualVarietyStyle')){
      const css = DOC.createElement('style');
      css.id = 'gjVisualVarietyStyle';
      css.textContent = `
        #gjVisualVarietyLayer{
          position:fixed;
          inset:0;
          z-index:18;
          pointer-events:none;
          overflow:hidden;
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }

        .gjvv-bg{
          position:absolute;
          inset:0;
          opacity:0;
          transition:opacity .45s ease, background .45s ease;
          pointer-events:none;
        }

        html.gjvv-ready .gjvv-bg{
          opacity:.28;
          background:
            radial-gradient(circle at 20% 18%,rgba(34,197,94,.28),transparent 34%),
            radial-gradient(circle at 80% 26%,rgba(59,130,246,.22),transparent 35%);
        }

        html.gjvv-junk-rain .gjvv-bg{
          opacity:.45;
          background:
            radial-gradient(circle at 50% 10%,rgba(249,115,22,.35),transparent 38%),
            linear-gradient(180deg,rgba(127,29,29,.12),rgba(251,146,60,.08),transparent);
        }

        html.gjvv-sugar-fog .gjvv-bg{
          opacity:.52;
          background:
            radial-gradient(circle at 25% 30%,rgba(244,114,182,.26),transparent 34%),
            radial-gradient(circle at 75% 45%,rgba(253,224,71,.25),transparent 38%),
            rgba(255,237,213,.16);
          backdrop-filter:blur(1.2px);
        }

        html.gjvv-fake-parade .gjvv-bg{
          opacity:.48;
          background:
            repeating-linear-gradient(
              115deg,
              rgba(249,115,22,.12) 0px,
              rgba(249,115,22,.12) 18px,
              rgba(250,204,21,.10) 18px,
              rgba(250,204,21,.10) 36px
            );
        }

        html.gjvv-healthy-beam .gjvv-bg{
          opacity:.46;
          background:
            radial-gradient(circle at 50% 58%,rgba(34,197,94,.36),transparent 32%),
            radial-gradient(circle at 50% 15%,rgba(255,255,255,.42),transparent 30%);
        }

        html.gjvv-final-strike .gjvv-bg{
          opacity:.62;
          background:
            radial-gradient(circle at 50% 48%,rgba(250,204,21,.38),transparent 30%),
            radial-gradient(circle at 50% 20%,rgba(239,68,68,.22),transparent 36%),
            rgba(15,23,42,.08);
          animation:gjvvFinalPulse .62s ease-in-out infinite alternate;
        }

        html.gjvv-victory .gjvv-bg{
          opacity:.70;
          background:
            radial-gradient(circle at 50% 42%,rgba(255,255,255,.62),transparent 24%),
            radial-gradient(circle at 28% 20%,rgba(34,197,94,.32),transparent 35%),
            radial-gradient(circle at 78% 22%,rgba(250,204,21,.34),transparent 35%);
        }

        .gjvv-banner{
          position:absolute;
          left:50%;
          top:calc(210px + env(safe-area-inset-top));
          transform:translateX(-50%) translateY(-12px) scale(.94);
          width:min(520px, calc(100vw - 24px));
          display:flex;
          align-items:center;
          gap:12px;
          border-radius:26px;
          padding:13px 15px;
          background:rgba(15,23,42,.86);
          color:#fff;
          border:2px solid rgba(255,255,255,.78);
          box-shadow:0 18px 44px rgba(15,23,42,.26);
          opacity:0;
          transition:opacity .18s ease, transform .18s ease;
          backdrop-filter:blur(10px);
        }

        .gjvv-banner.show{
          opacity:1;
          transform:translateX(-50%) translateY(0) scale(1);
        }

        .gjvv-icon{
          width:52px;
          height:52px;
          border-radius:20px;
          display:grid;
          place-items:center;
          font-size:32px;
          background:linear-gradient(180deg,#fff7ed,#fde68a);
          box-shadow:inset 0 -5px 0 rgba(0,0,0,.10);
          color:#0f172a;
        }

        .gjvv-banner b{
          display:block;
          font-size:20px;
          line-height:1.08;
          letter-spacing:.01em;
        }

        .gjvv-banner span{
          display:block;
          margin-top:5px;
          color:#fde68a;
          font-size:13px;
          font-weight:850;
          line-height:1.25;
        }

        .gjvv-particles{
          position:absolute;
          inset:0;
          pointer-events:none;
          overflow:hidden;
        }

        .gjvv-p{
          position:absolute;
          top:-40px;
          font-size:28px;
          animation:gjvvParticleFall var(--dur, 3.2s) linear forwards;
          filter:drop-shadow(0 6px 10px rgba(15,23,42,.22));
          opacity:.96;
        }

        .gjvv-p.good{
          animation-name:gjvvParticleFloat;
        }

        .gjvv-beam{
          position:absolute;
          left:50%;
          top:50%;
          width:20px;
          height:20px;
          border-radius:999px;
          background:rgba(34,197,94,.0);
          transform:translate(-50%,-50%) scale(.2);
          opacity:0;
          pointer-events:none;
        }

        .gjvv-beam.show{
          animation:gjvvBeam .72s ease-out forwards;
        }

        html.gjvv-final-strike .gjm-food[data-food-type="good"],
        html.gjvv-final-strike .goodjunk-food[data-food-type="good"]{
          box-shadow:
            0 16px 34px rgba(15,23,42,.18),
            0 0 0 4px rgba(250,204,21,.42),
            0 0 22px rgba(250,204,21,.46) !important;
        }

        html.gjvv-fake-parade .gjm-food[data-food-type="fake"],
        html.gjvv-fake-parade .goodjunk-food[data-food-type="fake"]{
          box-shadow:
            0 16px 34px rgba(15,23,42,.20),
            0 0 0 4px rgba(249,115,22,.44),
            0 0 24px rgba(249,115,22,.48) !important;
        }

        html.gjvv-healthy-beam .gjm-food[data-food-type="good"],
        html.gjvv-healthy-beam .goodjunk-food[data-food-type="good"]{
          filter:drop-shadow(0 0 16px rgba(34,197,94,.46));
        }

        .gjvv-debug{
          position:fixed;
          left:10px;
          bottom:calc(250px + env(safe-area-inset-bottom));
          z-index:100090;
          width:min(280px, calc(100vw - 20px));
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

        @keyframes gjvvParticleFall{
          from{
            transform:translateY(-50px) rotate(-12deg) scale(.9);
            opacity:0;
          }
          12%{ opacity:1; }
          to{
            transform:translateY(calc(100dvh + 80px)) rotate(18deg) scale(1.05);
            opacity:0;
          }
        }

        @keyframes gjvvParticleFloat{
          from{
            transform:translateY(40px) scale(.78) rotate(-8deg);
            opacity:0;
          }
          20%{ opacity:1; }
          to{
            transform:translateY(-150px) scale(1.15) rotate(8deg);
            opacity:0;
          }
        }

        @keyframes gjvvBeam{
          0%{
            opacity:0;
            transform:translate(-50%,-50%) scale(.15);
            box-shadow:0 0 0 0 rgba(34,197,94,.0);
          }
          25%{
            opacity:1;
            transform:translate(-50%,-50%) scale(1);
            box-shadow:
              0 0 0 24px rgba(34,197,94,.22),
              0 0 0 52px rgba(34,197,94,.12),
              0 0 50px rgba(34,197,94,.50);
          }
          100%{
            opacity:0;
            transform:translate(-50%,-50%) scale(2.4);
            box-shadow:
              0 0 0 80px rgba(34,197,94,.0),
              0 0 0 130px rgba(34,197,94,.0);
          }
        }

        @keyframes gjvvFinalPulse{
          from{ filter:brightness(1); }
          to{ filter:brightness(1.18); }
        }

        @media (max-width:720px){
          .gjvv-banner{
            top:calc(185px + env(safe-area-inset-top));
            padding:11px 12px;
            border-radius:22px;
          }

          .gjvv-icon{
            width:44px;
            height:44px;
            border-radius:16px;
            font-size:27px;
          }

          .gjvv-banner b{
            font-size:17px;
          }

          .gjvv-banner span{
            font-size:12px;
          }

          .gjvv-p{
            font-size:24px;
          }
        }

        @media (max-width:430px){
          .gjvv-banner{
            top:calc(168px + env(safe-area-inset-top));
          }
        }
      `;

      DOC.head.appendChild(css);
    }

    return root;
  }

  function setText(id, txt){
    const el = DOC.getElementById(id);
    if(el) el.textContent = String(txt ?? '');
  }

  function clearPatternClasses(){
    Object.keys(PATTERNS).forEach(k => {
      DOC.documentElement.classList.remove(PATTERNS[k].cls);
    });
  }

  function setPattern(patternId, options){
    if(!CFG.enabled) return;

    ensureLayer();

    const p = PATTERNS[patternId] || PATTERNS.ready;

    state.currentPattern = p.id;
    state.eventCount += 1;
    state.lastEventAt = performance.now();

    clearPatternClasses();
    DOC.documentElement.classList.add(p.cls);

    if(options && options.banner !== false){
      showBanner(p.icon, p.title, p.desc, options.duration || 2300);
    }

    WIN.dispatchEvent(new CustomEvent('gj:visual-pattern', {
      detail:{
        patch:PATCH,
        patternId:p.id,
        title:p.title,
        desc:p.desc,
        phase:state.currentPhase,
        hpPercent:state.hpPercent,
        pressure:state.pressure,
        assist:state.assist
      }
    }));

    renderDebug();
  }

  function showBanner(icon, title, desc, ms){
    const box = DOC.getElementById('gjvvBanner');
    if(!box) return;

    setText('gjvvIcon', icon || '🥗');
    setText('gjvvTitle', title || '');
    setText('gjvvDesc', desc || '');

    box.classList.add('show');

    clearTimeout(state.bannerTimer);
    state.bannerTimer = setTimeout(() => {
      box.classList.remove('show');
    }, ms || 2200);
  }

  function spawnParticle(icon, cls, duration){
    const root = DOC.getElementById('gjvvParticles');
    if(!root) return;

    const p = DOC.createElement('i');
    p.className = `gjvv-p ${cls || ''}`;
    p.textContent = icon;

    p.style.left = `${4 + Math.random() * 92}%`;
    p.style.setProperty('--dur', `${duration || (2600 + Math.random() * 1700)}ms`);

    root.appendChild(p);

    setTimeout(() => p.remove(), duration || 4600);
  }

  function burstParticles(patternId, count){
    ensureLayer();

    const icons = patternId === 'junkRain'
      ? ['🍟','🍩','🥤','🍔','🍭']
      : patternId === 'sugarFog'
        ? ['🍬','🍭','🧃','🥤','🍰']
        : patternId === 'fakeParade'
          ? ['🧃','🥗','🥣','🍌','🍵']
          : patternId === 'healthyBeam' || patternId === 'finalStrike'
            ? ['🥦','🍎','🥚','🐟','💚','⭐']
            : ['✨','⭐','💚','🏆'];

    const cls = patternId === 'healthyBeam' || patternId === 'finalStrike' || patternId === 'victory'
      ? 'good'
      : '';

    for(let i = 0; i < (count || 10); i++){
      setTimeout(() => {
        spawnParticle(icons[Math.floor(Math.random() * icons.length)], cls);
      }, i * 90);
    }
  }

  function beam(){
    ensureLayer();

    const el = DOC.getElementById('gjvvBeam');
    if(!el) return;

    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');

    setTimeout(() => el.classList.remove('show'), 780);
  }

  function patternFromPhase(phaseId){
    if(phaseId === 'junkGate') return 'junkRain';
    if(phaseId === 'fakeParade') return 'fakeParade';
    if(phaseId === 'finalClean') return 'finalStrike';
    if(phaseId === 'lastBite') return 'finalStrike';
    return 'healthyBeam';
  }

  function startAmbient(){
    clearInterval(state.particlesTimer);

    state.particlesTimer = setInterval(() => {
      if(!state.started || state.ended || !CFG.enabled) return;

      if(state.currentPattern === 'junkRain'){
        burstParticles('junkRain', 3);
      }else if(state.currentPattern === 'sugarFog'){
        burstParticles('sugarFog', 2);
      }else if(state.currentPattern === 'fakeParade'){
        burstParticles('fakeParade', 2);
      }else if(state.currentPattern === 'healthyBeam'){
        if(Math.random() < .45) burstParticles('healthyBeam', 2);
      }else if(state.currentPattern === 'finalStrike'){
        burstParticles('finalStrike', 3);
      }
    }, 1800);
  }

  function startPatternLoop(){
    clearInterval(state.patternTimer);

    state.patternTimer = setInterval(() => {
      if(!state.started || state.ended || !CFG.enabled) return;

      const elapsedSinceEvent = performance.now() - state.lastEventAt;
      if(elapsedSinceEvent < 6500) return;

      let next = 'healthyBeam';

      if(state.hpPercent <= 15){
        next = 'finalStrike';
      }else if(state.hpPercent <= 35){
        next = Math.random() < .62 ? 'finalStrike' : 'fakeParade';
      }else if(state.hpPercent <= 55){
        next = Math.random() < .58 ? 'fakeParade' : 'sugarFog';
      }else if(state.hpPercent <= 75){
        next = Math.random() < .55 ? 'junkRain' : 'healthyBeam';
      }else{
        next = Math.random() < .50 ? 'healthyBeam' : 'junkRain';
      }

      if(state.assist && (next === 'junkRain' || next === 'sugarFog')){
        next = 'healthyBeam';
      }

      setPattern(next, { duration:1900 });
      burstParticles(next, 7);
    }, 2500);
  }

  function onStart(){
    state.started = true;
    state.ended = false;
    state.currentPhase = 'opening';
    state.hpPercent = 100;
    state.pressure = 0;
    state.assist = false;
    state.eventCount = 0;

    ensureLayer();
    setPattern('ready', { duration:1900 });
    burstParticles('healthyBeam', 8);
    startAmbient();
    startPatternLoop();
  }

  function onEnd(){
    state.ended = true;

    clearInterval(state.patternTimer);
    clearInterval(state.particlesTimer);

    setTimeout(() => {
      if(!state.ended) return;
      clearPatternClasses();
    }, 1800);

    saveSummary();
  }

  function onBossHp(e){
    const d = e.detail || {};
    const hp = n(d.hp, 0);
    const hpMax = Math.max(1, n(d.hpMax, 1));
    const damage = n(d.damage, 0);

    state.hpPercent = clamp((hp / hpMax) * 100, 0, 100);

    if(damage >= 80){
      setPattern('healthyBeam', { duration:1200 });
      beam();
      burstParticles('healthyBeam', 8);
    }

    if(state.hpPercent <= 25 && state.currentPattern !== 'finalStrike'){
      setPattern('finalStrike', { duration:2300 });
      burstParticles('finalStrike', 12);
    }

    renderDebug();
  }

  function onDirectorPhase(e){
    const d = e.detail || {};
    if(d.phaseId) state.currentPhase = d.phaseId;
    if(d.hpPercent !== undefined) state.hpPercent = n(d.hpPercent, state.hpPercent);

    const next = patternFromPhase(state.currentPhase);
    setPattern(next, { duration:2300 });
    burstParticles(next, 10);
  }

  function onDirectorPressure(e){
    const d = e.detail || {};
    state.pressure = n(d.pressure, state.pressure);
    state.assist = Boolean(d.assist);

    if(d.phaseId) state.currentPhase = d.phaseId;
    if(d.hpPercent !== undefined) state.hpPercent = n(d.hpPercent, state.hpPercent);

    renderDebug();
  }

  function onBossAttack(e){
    const d = e.detail || {};
    const effect = String(d.effect || d.attackId || '').toLowerCase();

    let pattern = 'junkRain';

    if(effect.includes('sugar')) pattern = 'sugarFog';
    else if(effect.includes('fake')) pattern = 'fakeParade';
    else if(effect.includes('oil') || effect.includes('junk')) pattern = 'junkRain';
    else if(effect.includes('laser')) pattern = 'finalStrike';

    setPattern(pattern, { duration:2100 });
    burstParticles(pattern, 12);
  }

  function onComboStrike(e){
    const combo = n(e.detail && e.detail.combo, 5);

    setPattern(combo >= 10 ? 'finalStrike' : 'healthyBeam', { duration:1300 });
    beam();
    burstParticles('healthyBeam', combo >= 10 ? 14 : 9);
  }

  function onMissionComplete(){
    setPattern('healthyBeam', { duration:1700 });
    beam();
    burstParticles('healthyBeam', 12);
  }

  function onFrenzy(){
    setPattern('finalStrike', { duration:2600 });
    burstParticles('finalStrike', 16);
  }

  function onDefeated(){
    state.ended = true;
    setPattern('victory', { duration:2600 });
    beam();
    burstParticles('victory', 22);
    saveSummary();
  }

  function saveSummary(){
    const summary = {
      patch:PATCH,
      pattern:state.currentPattern,
      phase:state.currentPhase,
      eventCount:state.eventCount,
      hpPercent:state.hpPercent,
      pressure:state.pressure,
      assist:state.assist,
      savedAt:new Date().toISOString()
    };

    try{
      localStorage.setItem('GJ_SOLO_BOSS_VISUAL_VARIETY_LAST', JSON.stringify(summary));
    }catch(e){}

    WIN.dispatchEvent(new CustomEvent('gj:visual-variety-summary', {
      detail:summary
    }));
  }

  function renderDebug(){
    if(!CFG.debug) return;

    ensureLayer();

    let box = DOC.getElementById('gjVisualVarietyDebug');
    if(!box){
      box = DOC.createElement('pre');
      box.id = 'gjVisualVarietyDebug';
      box.className = 'gjvv-debug';
      DOC.body.appendChild(box);
      state.debugBox = box;
    }

    box.textContent =
`GoodJunk Visual Variety
${PATCH}

started: ${state.started}
ended: ${state.ended}

pattern: ${state.currentPattern}
phase: ${state.currentPhase}
hp: ${Math.round(state.hpPercent)}%
pressure: ${state.pressure}
assist: ${state.assist}
events: ${state.eventCount}`;
  }

  function boot(){
    if(!CFG.enabled) return;

    ensureLayer();

    WIN.addEventListener('gj:solo-boss-start', onStart);
    WIN.addEventListener('gj:game-start', onStart);
    WIN.addEventListener('gj:boss-start', onStart);

    WIN.addEventListener('gj:game-end', onEnd);
    WIN.addEventListener('gj:boss-end', onEnd);

    WIN.addEventListener('gj:boss-hp-change', onBossHp);
    WIN.addEventListener('gj:director-finale-phase', onDirectorPhase);
    WIN.addEventListener('gj:director-pressure', onDirectorPressure);

    WIN.addEventListener('gj:boss-visual-attack', onBossAttack);
    WIN.addEventListener('gj:boss-attack-warning', onBossAttack);
    WIN.addEventListener('gj:ultimate-boss-attack', onBossAttack);

    WIN.addEventListener('gj:ultimate-combo-strike', onComboStrike);
    WIN.addEventListener('gj:ultimate-counter-strike', onComboStrike);
    WIN.addEventListener('gj:ultimate-mission-complete', onMissionComplete);

    WIN.addEventListener('gj:boss-frenzy', onFrenzy);
    WIN.addEventListener('gj:boss-defeated', onDefeated);

    renderDebug();

    WIN.dispatchEvent(new CustomEvent('gj:visual-variety-ready', {
      detail:{
        patch:PATCH,
        enabled:CFG.enabled
      }
    }));
  }

  WIN.GoodJunkSoloBossVisualVariety = {
    version:PATCH,
    setPattern,
    burstParticles,
    beam,
    getState:()=>({
      patch:PATCH,
      started:state.started,
      ended:state.ended,
      currentPattern:state.currentPattern,
      currentPhase:state.currentPhase,
      hpPercent:state.hpPercent,
      pressure:state.pressure,
      assist:state.assist,
      eventCount:state.eventCount
    })
  };

  WIN.GJVV = WIN.GoodJunkSoloBossVisualVariety;

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();
