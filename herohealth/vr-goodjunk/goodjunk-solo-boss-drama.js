// === /herohealth/vr-goodjunk/goodjunk-solo-boss-drama.js ===
// GoodJunk Solo Boss Drama Addon
// PATCH v8.40.2-BOSS-VISUAL-ATTACK-HP-DRAMA
// ✅ Boss HP bar
// ✅ Rage meter
// ✅ visual warning before attack
// ✅ boss attack animation
// ✅ near defeat frenzy
// ✅ victory burst
// ✅ works with v8.40.1 ultimate addon
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const CFG = {
    diff: String(QS.get('diff') || 'normal').toLowerCase(),
    seed: Number(QS.get('seed')) || Date.now(),
    enabled: true
  };

  const DIFF = {
    easy: {
      hpMax: 760,
      attackEvery: 18,
      rageGain: 8,
      goodDamage: 18,
      comboDamage: 78,
      missionDamage: 120,
      counterDamage: 100
    },
    normal: {
      hpMax: 920,
      attackEvery: 15,
      rageGain: 10,
      goodDamage: 16,
      comboDamage: 70,
      missionDamage: 110,
      counterDamage: 92
    },
    hard: {
      hpMax: 1120,
      attackEvery: 12,
      rageGain: 13,
      goodDamage: 14,
      comboDamage: 64,
      missionDamage: 100,
      counterDamage: 84
    },
    challenge: {
      hpMax: 1320,
      attackEvery: 10,
      rageGain: 16,
      goodDamage: 12,
      comboDamage: 58,
      missionDamage: 92,
      counterDamage: 78
    }
  };

  const D = DIFF[CFG.diff] || DIFF.normal;

  let rngState = CFG.seed >>> 0;
  function rand(){
    rngState += 0x6D2B79F5;
    let t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function pick(arr){
    return arr[Math.floor(rand() * arr.length)];
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function pct(v, max){
    max = Math.max(1, Number(max) || 1);
    return clamp((Number(v) || 0) / max * 100, 0, 100);
  }

  const ATTACKS = [
    {
      id:'sugarBomb',
      icon:'💣',
      name:'Sugar Bomb',
      warn:'บอสจะปล่อยระเบิดน้ำตาล!',
      desc:'หลบของหวานและน้ำอัดลม',
      face:'😈',
      effect:'sugar'
    },
    {
      id:'oilWave',
      icon:'🌊',
      name:'Oil Wave',
      warn:'คลื่นของทอดกำลังมา!',
      desc:'อย่าแตะของทอด',
      face:'🔥',
      effect:'oil'
    },
    {
      id:'junkLaser',
      icon:'⚡',
      name:'Junk Laser',
      warn:'เลเซอร์อาหารขยะ!',
      desc:'เก็บอาหารดีเพื่อสวนกลับ',
      face:'👾',
      effect:'laser'
    },
    {
      id:'fakeTrap',
      icon:'🧃',
      name:'Fake Healthy Trap',
      warn:'อาหารหลอกตากำลังมา!',
      desc:'ดูให้ดี อาจมีน้ำตาลแฝง',
      face:'🧃',
      effect:'fake'
    }
  ];

  const state = {
    started:false,
    ended:false,
    hpMax:D.hpMax,
    hp:D.hpMax,
    rage:0,
    lastAttackAt:0,
    nextAttackAt:D.attackEvery,
    warning:false,
    attacking:false,
    frenzy:false,
    defeated:false,
    attackCount:0,
    hitCount:0,
    totalDamage:0,
    lastAttack:null,
    phaseTitle:'Boss Ready'
  };

  function ensureLayer(){
    let root = DOC.getElementById('gjBossDramaLayer');
    if(root) return root;

    root = DOC.createElement('div');
    root.id = 'gjBossDramaLayer';
    root.innerHTML = `
      <div class="gjd-card" id="gjdCard">
        <div class="gjd-head">
          <div class="gjd-face" id="gjdFace">👾</div>
          <div class="gjd-info">
            <div class="gjd-title-row">
              <b id="gjdBossName">Junk Boss</b>
              <span id="gjdBossStatus">HP เต็ม</span>
            </div>
            <div class="gjd-hp-wrap">
              <div class="gjd-hp-fill" id="gjdHpFill"></div>
              <div class="gjd-hp-shine"></div>
            </div>
            <div class="gjd-rage-row">
              <span>RAGE</span>
              <div class="gjd-rage-wrap">
                <div class="gjd-rage-fill" id="gjdRageFill"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gjd-warning" id="gjdWarning">
        <div class="gjd-warning-icon" id="gjdWarnIcon">⚠️</div>
        <b id="gjdWarnTitle">Boss Attack!</b>
        <span id="gjdWarnDesc">เตรียมหลบ!</span>
      </div>

      <div class="gjd-victory" id="gjdVictory">
        <div class="gjd-victory-burst">🎉</div>
        <b>ชนะบอสแล้ว!</b>
        <span>เลือกอาหารดี ชนะอาหารขยะได้</span>
      </div>

      <div class="gjd-hit-pop-root" id="gjdHitPopRoot"></div>
    `;

    DOC.body.appendChild(root);

    if(!DOC.getElementById('gjBossDramaStyle')){
      const css = DOC.createElement('style');
      css.id = 'gjBossDramaStyle';
      css.textContent = `
        #gjBossDramaLayer{
          position:fixed;
          inset:0;
          pointer-events:none;
          z-index:99980;
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }

        .gjd-card{
          position:absolute;
          left:50%;
          bottom:calc(12px + env(safe-area-inset-bottom));
          transform:translateX(-50%);
          width:min(560px, calc(100vw - 20px));
          border-radius:24px;
          border:2px solid rgba(255,255,255,.78);
          background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(255,237,213,.93));
          box-shadow:0 18px 42px rgba(15,23,42,.22);
          padding:10px;
          backdrop-filter:blur(10px);
          transition:transform .18s ease, filter .18s ease;
        }

        .gjd-card.hit{
          transform:translateX(-50%) scale(1.035);
          filter:brightness(1.08);
        }

        .gjd-card.attack{
          animation:gjdAttackShake .34s ease;
        }

        .gjd-card.frenzy{
          background:linear-gradient(135deg,rgba(255,237,213,.98),rgba(254,202,202,.94));
          border-color:rgba(248,113,113,.95);
          box-shadow:0 18px 46px rgba(239,68,68,.32);
        }

        .gjd-head{
          display:flex;
          align-items:center;
          gap:10px;
        }

        .gjd-face{
          width:58px;
          height:58px;
          border-radius:20px;
          display:grid;
          place-items:center;
          font-size:34px;
          background:linear-gradient(180deg,#fff7ed,#fed7aa);
          box-shadow:inset 0 -5px 0 rgba(0,0,0,.08), 0 8px 18px rgba(15,23,42,.12);
          transition:transform .18s ease;
        }

        .gjd-face.attack{
          animation:gjdBossBounce .45s ease;
        }

        .gjd-info{
          flex:1;
          min-width:0;
        }

        .gjd-title-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          margin-bottom:5px;
        }

        .gjd-title-row b{
          color:#0f172a;
          font-size:16px;
          line-height:1.15;
        }

        .gjd-title-row span{
          color:#475569;
          font-size:12px;
          font-weight:800;
          white-space:nowrap;
        }

        .gjd-hp-wrap{
          position:relative;
          height:18px;
          overflow:hidden;
          border-radius:999px;
          background:rgba(148,163,184,.22);
          box-shadow:inset 0 2px 5px rgba(15,23,42,.16);
        }

        .gjd-hp-fill{
          width:100%;
          height:100%;
          border-radius:999px;
          background:linear-gradient(90deg,#22c55e,#facc15,#fb7185);
          transition:width .24s ease;
        }

        .gjd-hp-shine{
          position:absolute;
          inset:0;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);
          transform:translateX(-110%);
          animation:gjdShine 2.1s ease-in-out infinite;
        }

        .gjd-rage-row{
          margin-top:7px;
          display:grid;
          grid-template-columns:46px 1fr;
          gap:8px;
          align-items:center;
        }

        .gjd-rage-row span{
          color:#991b1b;
          font-size:11px;
          font-weight:1000;
          letter-spacing:.08em;
        }

        .gjd-rage-wrap{
          height:8px;
          border-radius:999px;
          background:rgba(254,202,202,.62);
          overflow:hidden;
        }

        .gjd-rage-fill{
          height:100%;
          width:0%;
          border-radius:999px;
          background:linear-gradient(90deg,#fb7185,#ef4444,#7f1d1d);
          transition:width .2s ease;
        }

        .gjd-warning{
          position:absolute;
          left:50%;
          top:38%;
          transform:translate(-50%,-50%) scale(.92);
          width:min(440px, calc(100vw - 28px));
          border-radius:28px;
          background:rgba(127,29,29,.92);
          color:#fff;
          box-shadow:0 20px 46px rgba(127,29,29,.38);
          border:2px solid rgba(254,226,226,.86);
          padding:18px 16px;
          text-align:center;
          opacity:0;
          transition:opacity .16s ease, transform .16s ease;
        }

        .gjd-warning.show{
          opacity:1;
          transform:translate(-50%,-50%) scale(1);
          animation:gjdWarningPulse .7s ease infinite alternate;
        }

        .gjd-warning-icon{
          font-size:42px;
          margin-bottom:4px;
        }

        .gjd-warning b{
          display:block;
          font-size:24px;
          line-height:1.12;
        }

        .gjd-warning span{
          display:block;
          margin-top:6px;
          font-size:15px;
          font-weight:800;
          color:#fde68a;
        }

        .gjd-victory{
          position:absolute;
          left:50%;
          top:45%;
          transform:translate(-50%,-50%) scale(.8);
          width:min(440px, calc(100vw - 28px));
          border-radius:30px;
          background:linear-gradient(135deg,rgba(236,253,245,.98),rgba(219,234,254,.96));
          border:2px solid rgba(255,255,255,.9);
          box-shadow:0 24px 56px rgba(15,23,42,.24);
          color:#0f172a;
          padding:22px 18px;
          text-align:center;
          opacity:0;
          transition:opacity .18s ease, transform .18s ease;
        }

        .gjd-victory.show{
          opacity:1;
          transform:translate(-50%,-50%) scale(1);
        }

        .gjd-victory-burst{
          font-size:56px;
          animation:gjdVictoryBurst .72s ease infinite alternate;
        }

        .gjd-victory b{
          display:block;
          font-size:28px;
          line-height:1.15;
          margin-top:4px;
        }

        .gjd-victory span{
          display:block;
          margin-top:8px;
          font-size:15px;
          font-weight:800;
          color:#2563eb;
        }

        .gjd-hit-pop-root{
          position:absolute;
          inset:0;
        }

        .gjd-hit-pop{
          position:absolute;
          transform:translate(-50%,-50%);
          color:#fff;
          font-weight:1000;
          font-size:26px;
          text-shadow:0 4px 12px rgba(0,0,0,.42);
          animation:gjdHitPop .82s ease forwards;
        }

        .gjd-screen-flash{
          position:fixed;
          inset:0;
          z-index:99970;
          pointer-events:none;
          background:rgba(248,113,113,.20);
          animation:gjdFlash .32s ease forwards;
        }

        @keyframes gjdHitPop{
          0%{ opacity:0; transform:translate(-50%,-20%) scale(.68); }
          18%{ opacity:1; transform:translate(-50%,-55%) scale(1.22); }
          100%{ opacity:0; transform:translate(-50%,-120%) scale(.92); }
        }

        @keyframes gjdAttackShake{
          0%,100%{ transform:translateX(-50%) translateY(0); }
          20%{ transform:translateX(calc(-50% - 6px)) translateY(2px); }
          40%{ transform:translateX(calc(-50% + 6px)) translateY(-2px); }
          60%{ transform:translateX(calc(-50% - 5px)) translateY(1px); }
          80%{ transform:translateX(calc(-50% + 5px)) translateY(-1px); }
        }

        @keyframes gjdBossBounce{
          0%,100%{ transform:scale(1); }
          35%{ transform:scale(1.22) rotate(-5deg); }
          70%{ transform:scale(.96) rotate(4deg); }
        }

        @keyframes gjdShine{
          0%{ transform:translateX(-110%); }
          45%,100%{ transform:translateX(120%); }
        }

        @keyframes gjdWarningPulse{
          from{ filter:brightness(1); }
          to{ filter:brightness(1.22); }
        }

        @keyframes gjdVictoryBurst{
          from{ transform:scale(1) rotate(-4deg); }
          to{ transform:scale(1.16) rotate(4deg); }
        }

        @keyframes gjdFlash{
          from{ opacity:1; }
          to{ opacity:0; }
        }

        @media (max-width:640px){
          .gjd-card{
            bottom:calc(8px + env(safe-area-inset-bottom));
            border-radius:20px;
            padding:8px;
          }

          .gjd-face{
            width:48px;
            height:48px;
            font-size:28px;
            border-radius:16px;
          }

          .gjd-title-row b{
            font-size:14px;
          }

          .gjd-title-row span{
            font-size:11px;
          }

          .gjd-hp-wrap{
            height:15px;
          }

          .gjd-warning{
            top:42%;
            padding:15px 14px;
          }

          .gjd-warning-icon{
            font-size:36px;
          }

          .gjd-warning b{
            font-size:21px;
          }

          .gjd-warning span{
            font-size:13px;
          }

          .gjd-victory b{
            font-size:24px;
          }
        }
      `;
      DOC.head.appendChild(css);
    }

    updateUI();
    return root;
  }

  function setText(id, value){
    const el = DOC.getElementById(id);
    if(el) el.textContent = String(value ?? '');
  }

  function setFace(face){
    const el = DOC.getElementById('gjdFace');
    if(el) el.textContent = face || '👾';
  }

  function updateUI(){
    ensureLayer();

    const hpPercent = pct(state.hp, state.hpMax);
    const ragePercent = clamp(state.rage, 0, 100);

    const hpFill = DOC.getElementById('gjdHpFill');
    const rageFill = DOC.getElementById('gjdRageFill');
    const card = DOC.getElementById('gjdCard');

    if(hpFill) hpFill.style.width = hpPercent + '%';
    if(rageFill) rageFill.style.width = ragePercent + '%';

    if(card){
      card.classList.toggle('frenzy', state.frenzy);
    }

    let status = `HP ${Math.ceil(state.hp)}/${state.hpMax}`;
    if(state.frenzy && !state.defeated) status = 'บอสใกล้แพ้แล้ว!';
    if(state.defeated) status = 'Boss Defeated!';

    setText('gjdBossStatus', status);

    const name = state.frenzy ? 'Junk Boss คลั่ง!' : 'Junk Boss';
    setText('gjdBossName', name);
  }

  function pop(text, x, y){
    ensureLayer();

    const root = DOC.getElementById('gjdHitPopRoot');
    if(!root) return;

    const el = DOC.createElement('div');
    el.className = 'gjd-hit-pop';
    el.textContent = text;

    const px = clamp(Number(x) || 50, 8, 92);
    const py = clamp(Number(y) || 50, 12, 82);

    el.style.left = px + '%';
    el.style.top = py + '%';

    root.appendChild(el);
    setTimeout(()=>el.remove(), 900);
  }

  function flash(){
    const f = DOC.createElement('div');
    f.className = 'gjd-screen-flash';
    DOC.body.appendChild(f);
    setTimeout(()=>f.remove(), 360);
  }

  function pulseCard(kind){
    const card = DOC.getElementById('gjdCard');
    const face = DOC.getElementById('gjdFace');

    if(card){
      card.classList.remove('hit', 'attack');
      void card.offsetWidth;
      card.classList.add(kind === 'attack' ? 'attack' : 'hit');
      setTimeout(()=>card.classList.remove('hit', 'attack'), 430);
    }

    if(face){
      face.classList.remove('attack');
      void face.offsetWidth;
      face.classList.add('attack');
      setTimeout(()=>face.classList.remove('attack'), 480);
    }
  }

  function hitBoss(amount, reason, xy){
    if(state.ended || state.defeated) return;

    amount = Math.max(0, Number(amount) || 0);
    if(amount <= 0) return;

    if(state.frenzy){
      amount = Math.round(amount * 0.92);
    }

    state.hp = clamp(state.hp - amount, 0, state.hpMax);
    state.hitCount += 1;
    state.totalDamage += amount;

    pop(`-${Math.round(amount)} HP`, xy && xy.x, xy && xy.y);
    pulseCard('hit');

    if(state.hp <= state.hpMax * 0.25 && !state.frenzy && state.hp > 0){
      enterFrenzy();
    }

    updateUI();

    WIN.dispatchEvent(new CustomEvent('gj:boss-hp-change', {
      detail:{
        hp:state.hp,
        hpMax:state.hpMax,
        hpPercent:pct(state.hp, state.hpMax),
        damage:amount,
        reason:reason || 'hit'
      }
    }));

    if(state.hp <= 0){
      defeatBoss(reason);
    }
  }

  function healBoss(amount, reason){
    if(state.ended || state.defeated) return;

    amount = Math.max(0, Number(amount) || 0);
    if(amount <= 0) return;

    state.hp = clamp(state.hp + amount, 0, state.hpMax);
    pop(`+${Math.round(amount)} HP`, 52, 58);
    updateUI();

    WIN.dispatchEvent(new CustomEvent('gj:boss-heal', {
      detail:{
        hp:state.hp,
        hpMax:state.hpMax,
        amount,
        reason:reason || 'heal'
      }
    }));
  }

  function gainRage(amount, reason){
    if(state.ended || state.defeated) return;

    amount = Math.max(0, Number(amount) || 0);
    state.rage = clamp(state.rage + amount, 0, 100);

    updateUI();

    if(state.rage >= 100){
      state.rage = 0;
      updateUI();
      executeAttack(pick(ATTACKS), 'rage-full');
    }

    WIN.dispatchEvent(new CustomEvent('gj:boss-rage-change', {
      detail:{
        rage:state.rage,
        amount,
        reason:reason || 'rage'
      }
    }));
  }

  function enterFrenzy(){
    state.frenzy = true;
    setFace('😡');
    showWarning({
      icon:'🔥',
      name:'บอสคลั่งแล้ว!',
      desc:'เลือดต่ำกว่า 25% รีบทำคอมโบปิดฉาก!'
    }, 1600);

    WIN.dispatchEvent(new CustomEvent('gj:boss-frenzy', {
      detail:{
        hp:state.hp,
        hpMax:state.hpMax
      }
    }));
  }

  function showWarning(attack, duration){
    ensureLayer();

    const box = DOC.getElementById('gjdWarning');
    if(!box) return;

    setText('gjdWarnIcon', attack.icon || '⚠️');
    setText('gjdWarnTitle', attack.name || 'Boss Attack!');
    setText('gjdWarnDesc', attack.desc || 'เตรียมหลบ!');

    box.classList.add('show');
    state.warning = true;

    setTimeout(()=>{
      box.classList.remove('show');
      state.warning = false;
    }, Math.max(500, Number(duration) || 1200));
  }

  function warnAttack(){
    if(state.ended || state.defeated || state.warning || state.attacking) return;

    const attack = pick(ATTACKS);
    state.lastAttack = attack;

    setFace(attack.face);
    showWarning({
      icon:attack.icon,
      name:attack.warn,
      desc:attack.desc
    }, 1400);

    WIN.dispatchEvent(new CustomEvent('gj:boss-attack-warning', {
      detail:{
        attackId:attack.id,
        name:attack.name,
        effect:attack.effect,
        rage:state.rage
      }
    }));

    setTimeout(()=>{
      executeAttack(attack, 'timer');
    }, 1450);
  }

  function executeAttack(attack, trigger){
    if(state.ended || state.defeated) return;

    state.attacking = true;
    state.attackCount += 1;

    setFace(attack.face || '👾');
    pulseCard('attack');
    flash();
    pop(`${attack.icon} ${attack.name}!`, 50, 44);

    const rageGain = state.frenzy ? D.rageGain + 4 : D.rageGain;
    state.rage = clamp(state.rage + rageGain, 0, 100);

    updateUI();

    WIN.dispatchEvent(new CustomEvent('gj:boss-visual-attack', {
      detail:{
        attackId:attack.id,
        name:attack.name,
        effect:attack.effect,
        trigger:trigger || 'timer',
        frenzy:state.frenzy,
        attackCount:state.attackCount
      }
    }));

    setTimeout(()=>{
      state.attacking = false;
      if(!state.defeated){
        setFace(state.frenzy ? '😡' : '👾');
      }
    }, 720);
  }

  function defeatBoss(reason){
    if(state.defeated) return;

    state.defeated = true;
    state.ended = true;
    state.hp = 0;
    state.rage = 0;

    updateUI();
    setFace('💫');

    const victory = DOC.getElementById('gjdVictory');
    if(victory){
      victory.classList.add('show');
    }

    try{
      localStorage.setItem('GJ_SOLO_BOSS_DRAMA_LAST', JSON.stringify({
        patch:'v8.40.2-BOSS-VISUAL-ATTACK-HP-DRAMA',
        defeated:true,
        hpMax:state.hpMax,
        totalDamage:state.totalDamage,
        hitCount:state.hitCount,
        attackCount:state.attackCount,
        frenzy:state.frenzy,
        reason:reason || 'boss-defeated',
        savedAt:new Date().toISOString()
      }));
    }catch(e){}

    WIN.dispatchEvent(new CustomEvent('gj:boss-defeated', {
      detail:{
        patch:'v8.40.2-BOSS-VISUAL-ATTACK-HP-DRAMA',
        hpMax:state.hpMax,
        totalDamage:state.totalDamage,
        hitCount:state.hitCount,
        attackCount:state.attackCount,
        reason:reason || 'boss-defeated'
      }
    }));
  }

  function start(){
    if(state.started) return;

    state.started = true;
    state.ended = false;
    state.defeated = false;
    state.hpMax = D.hpMax;
    state.hp = D.hpMax;
    state.rage = 0;
    state.lastAttackAt = 0;
    state.nextAttackAt = D.attackEvery;
    state.warning = false;
    state.attacking = false;
    state.frenzy = false;
    state.attackCount = 0;
    state.hitCount = 0;
    state.totalDamage = 0;

    ensureLayer();
    updateUI();
    setFace('👾');

    WIN.dispatchEvent(new CustomEvent('gj:boss-drama-start', {
      detail:{
        hpMax:state.hpMax,
        diff:CFG.diff
      }
    }));
  }

  function end(extra){
    state.ended = true;

    const summary = {
      patch:'v8.40.2-BOSS-VISUAL-ATTACK-HP-DRAMA',
      defeated:state.defeated,
      hp:state.hp,
      hpMax:state.hpMax,
      rage:state.rage,
      attackCount:state.attackCount,
      hitCount:state.hitCount,
      totalDamage:state.totalDamage,
      frenzy:state.frenzy,
      ...(extra || {})
    };

    WIN.dispatchEvent(new CustomEvent('gj:boss-drama-summary', {
      detail:summary
    }));

    return summary;
  }

  function goodHit(payload){
    payload = payload || {};
    const combo = Number(payload.combo || payload.comboCount || 0) || 0;
    const amount = D.goodDamage + Math.min(18, combo * 2);
    hitBoss(amount, 'good-hit', payload.xy || { x:payload.x, y:payload.y });
  }

  function junkHit(payload){
    payload = payload || {};
    gainRage(D.rageGain, 'junk-hit');

    if(state.frenzy){
      healBoss(18, 'junk-hit-frenzy');
    }else{
      healBoss(10, 'junk-hit');
    }
  }

  function fakeHit(payload){
    payload = payload || {};
    gainRage(D.rageGain + 5, 'fake-hit');
    healBoss(16, 'fake-hit');
  }

  function missGood(payload){
    payload = payload || {};
    gainRage(Math.max(4, Math.round(D.rageGain * 0.55)), 'miss-good');
  }

  function bridgeItemHit(detail){
    detail = detail || {};
    const item = detail.food || detail.item || detail;
    const type = String(detail.type || item.type || item.kind || '').toLowerCase();

    if(type === 'good') goodHit(detail);
    else if(type === 'junk' || type === 'bad') junkHit(detail);
    else if(type === 'fake' || type === 'trap' || type === 'fakehealthy') fakeHit(detail);
  }

  function tick(dt){
    if(!state.started || state.ended || state.defeated) return;

    dt = Number(dt);
    if(!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;

    state.lastAttackAt += dt;

    const interval = state.frenzy
      ? Math.max(6.5, D.attackEvery * 0.62)
      : D.attackEvery;

    if(state.lastAttackAt >= interval){
      state.lastAttackAt = 0;
      warnAttack();
    }
  }

  WIN.GoodJunkSoloBossDrama = {
    version:'v8.40.2-BOSS-VISUAL-ATTACK-HP-DRAMA',
    start,
    end,
    tick,
    hitBoss,
    gainRage,
    healBoss,
    goodHit,
    junkHit,
    fakeHit,
    missGood,
    warnAttack,
    executeAttack,
    getState:()=>JSON.parse(JSON.stringify(state))
  };

  WIN.addEventListener('gj:game-start', start);
  WIN.addEventListener('gj:boss-start', start);
  WIN.addEventListener('gj:solo-boss-start', start);

  WIN.addEventListener('gj:game-end', e => end(e.detail || {}));
  WIN.addEventListener('gj:boss-end', e => end(e.detail || {}));

  WIN.addEventListener('gj:item-hit', e => bridgeItemHit(e.detail || {}));
  WIN.addEventListener('gj:hit-good', e => goodHit(e.detail || {}));
  WIN.addEventListener('gj:hit-junk', e => junkHit(e.detail || {}));
  WIN.addEventListener('gj:hit-fake', e => fakeHit(e.detail || {}));
  WIN.addEventListener('gj:miss-good', e => missGood(e.detail || {}));

  WIN.addEventListener('gj:ultimate-combo-strike', e => {
    const combo = Number(e.detail && e.detail.combo) || 5;
    hitBoss(D.comboDamage + Math.min(50, combo * 4), 'combo-strike', { x:50, y:44 });
  });

  WIN.addEventListener('gj:ultimate-mission-complete', () => {
    hitBoss(D.missionDamage, 'mission-complete', { x:50, y:40 });
  });

  WIN.addEventListener('gj:ultimate-counter-strike', e => {
    const combo = Number(e.detail && e.detail.combo) || 6;
    hitBoss(D.counterDamage + Math.min(45, combo * 3), 'counter-strike', { x:50, y:46 });
  });

  DOC.addEventListener('DOMContentLoaded', ensureLayer);

  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.08, (now - last) / 1000);
    last = now;
    tick(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
