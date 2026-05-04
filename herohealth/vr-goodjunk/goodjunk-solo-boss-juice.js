// === /herohealth/vr-goodjunk/goodjunk-solo-boss-juice.js ===
// GoodJunk Solo Boss Juice + Sound Addon
// PATCH v8.40.3-SOUND-JUICE-PACK
// ✅ WebAudio SFX no external mp3
// ✅ combo / mission / shield / boss / victory cues
// ✅ screen flash + hit pulse + floating juice text
// ✅ mobile vibration when available
// ✅ small mute toggle
// ✅ works with v8.40.1 ultimate + v8.40.2 drama
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const STORE_KEY = 'GJ_SOLO_BOSS_JUICE_SOUND_ON';

  const state = {
    started:false,
    unlocked:false,
    soundOn:true,
    combo:0,
    lastGoodAt:0,
    lastHitAt:0,
    frenzy:false,
    defeated:false,
    audio:null,
    master:null
  };

  try{
    const saved = localStorage.getItem(STORE_KEY);
    if(saved === '0') state.soundOn = false;
  }catch(e){}

  function now(){
    return performance.now();
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function ensureLayer(){
    let root = DOC.getElementById('gjJuiceLayer');
    if(root) return root;

    root = DOC.createElement('div');
    root.id = 'gjJuiceLayer';
    root.innerHTML = `
      <button class="gjj-mute" id="gjjMuteBtn" type="button" aria-label="toggle sound">
        ${state.soundOn ? '🔊' : '🔇'}
      </button>

      <div class="gjj-combo" id="gjjCombo">
        <b id="gjjComboMain">COMBO!</b>
        <span id="gjjComboSub">เลือกอาหารดีต่อเนื่อง</span>
      </div>

      <div class="gjj-center" id="gjjCenter">
        <div class="gjj-center-icon" id="gjjCenterIcon">⭐</div>
        <b id="gjjCenterMain">Nice!</b>
        <span id="gjjCenterSub">ทำได้ดีมาก</span>
      </div>

      <div class="gjj-pop-root" id="gjjPopRoot"></div>
    `;

    DOC.body.appendChild(root);

    if(!DOC.getElementById('gjJuiceStyle')){
      const css = DOC.createElement('style');
      css.id = 'gjJuiceStyle';
      css.textContent = `
        #gjJuiceLayer{
          position:fixed;
          inset:0;
          z-index:99995;
          pointer-events:none;
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }

        .gjj-mute{
          position:absolute;
          right:calc(12px + env(safe-area-inset-right));
          bottom:calc(96px + env(safe-area-inset-bottom));
          z-index:2;
          width:46px;
          height:46px;
          border-radius:999px;
          border:2px solid rgba(255,255,255,.9);
          background:rgba(15,23,42,.76);
          color:#fff;
          font-size:22px;
          box-shadow:0 10px 24px rgba(15,23,42,.25);
          pointer-events:auto;
          cursor:pointer;
          backdrop-filter:blur(8px);
        }

        .gjj-mute:active{
          transform:scale(.94);
        }

        .gjj-combo{
          position:absolute;
          left:50%;
          top:calc(92px + env(safe-area-inset-top));
          transform:translateX(-50%) translateY(-14px) scale(.9);
          min-width:190px;
          max-width:min(88vw,420px);
          text-align:center;
          border-radius:999px;
          padding:10px 16px;
          background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(254,243,199,.94));
          border:2px solid rgba(255,255,255,.9);
          box-shadow:0 16px 34px rgba(15,23,42,.22);
          color:#0f172a;
          opacity:0;
          transition:opacity .16s ease, transform .16s ease;
        }

        .gjj-combo.show{
          opacity:1;
          transform:translateX(-50%) translateY(0) scale(1);
        }

        .gjj-combo b{
          display:block;
          font-size:22px;
          line-height:1;
          letter-spacing:.03em;
        }

        .gjj-combo span{
          display:block;
          margin-top:4px;
          font-size:12px;
          font-weight:800;
          color:#2563eb;
        }

        .gjj-center{
          position:absolute;
          left:50%;
          top:45%;
          transform:translate(-50%,-50%) scale(.78);
          width:min(430px, calc(100vw - 30px));
          text-align:center;
          border-radius:30px;
          padding:18px 16px;
          background:rgba(15,23,42,.86);
          border:2px solid rgba(255,255,255,.82);
          box-shadow:0 24px 58px rgba(15,23,42,.34);
          color:#fff;
          opacity:0;
          transition:opacity .15s ease, transform .15s ease;
        }

        .gjj-center.show{
          opacity:1;
          transform:translate(-50%,-50%) scale(1);
        }

        .gjj-center-icon{
          font-size:48px;
          line-height:1;
          animation:gjjIconBob .64s ease infinite alternate;
        }

        .gjj-center b{
          display:block;
          margin-top:6px;
          font-size:26px;
          line-height:1.12;
        }

        .gjj-center span{
          display:block;
          margin-top:7px;
          font-size:14px;
          font-weight:800;
          color:#fde68a;
        }

        .gjj-pop-root{
          position:absolute;
          inset:0;
        }

        .gjj-pop{
          position:absolute;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%);
          font-weight:1000;
          font-size:25px;
          color:#fff;
          text-shadow:0 5px 16px rgba(0,0,0,.46);
          animation:gjjPop .82s ease forwards;
          white-space:nowrap;
        }

        .gjj-ring{
          position:absolute;
          left:50%;
          top:50%;
          width:30px;
          height:30px;
          border-radius:999px;
          border:4px solid rgba(255,255,255,.92);
          transform:translate(-50%,-50%) scale(.2);
          opacity:.95;
          animation:gjjRing .58s ease-out forwards;
        }

        .gjj-flash{
          position:fixed;
          inset:0;
          z-index:99960;
          pointer-events:none;
          opacity:0;
          animation:gjjFlash .34s ease forwards;
        }

        .gjj-flash.good{
          background:rgba(34,197,94,.17);
        }

        .gjj-flash.bad{
          background:rgba(239,68,68,.20);
        }

        .gjj-flash.warn{
          background:rgba(250,204,21,.18);
        }

        .gjj-flash.victory{
          background:radial-gradient(circle at 50% 45%,rgba(255,255,255,.65),rgba(34,197,94,.25),transparent 68%);
        }

        body.gjj-screen-shake{
          animation:gjjShake .34s ease;
        }

        body.gjj-big-shake{
          animation:gjjBigShake .46s ease;
        }

        body.gjj-frenzy-pulse::after{
          content:"";
          position:fixed;
          inset:0;
          pointer-events:none;
          z-index:99950;
          border:10px solid rgba(239,68,68,.18);
          box-shadow:inset 0 0 60px rgba(239,68,68,.14);
          animation:gjjFrenzyPulse 1.05s ease-in-out infinite alternate;
        }

        @keyframes gjjPop{
          0%{ opacity:0; transform:translate(-50%,-20%) scale(.64); }
          16%{ opacity:1; transform:translate(-50%,-55%) scale(1.22); }
          100%{ opacity:0; transform:translate(-50%,-125%) scale(.9); }
        }

        @keyframes gjjRing{
          0%{ opacity:.95; transform:translate(-50%,-50%) scale(.15); }
          100%{ opacity:0; transform:translate(-50%,-50%) scale(3.2); }
        }

        @keyframes gjjFlash{
          0%{ opacity:1; }
          100%{ opacity:0; }
        }

        @keyframes gjjShake{
          0%,100%{ transform:translate(0,0); }
          20%{ transform:translate(-3px,1px); }
          40%{ transform:translate(3px,-1px); }
          60%{ transform:translate(-2px,1px); }
          80%{ transform:translate(2px,-1px); }
        }

        @keyframes gjjBigShake{
          0%,100%{ transform:translate(0,0); }
          15%{ transform:translate(-7px,2px); }
          30%{ transform:translate(7px,-2px); }
          45%{ transform:translate(-6px,2px); }
          60%{ transform:translate(6px,-2px); }
          80%{ transform:translate(-3px,1px); }
        }

        @keyframes gjjIconBob{
          from{ transform:scale(1) rotate(-3deg); }
          to{ transform:scale(1.14) rotate(3deg); }
        }

        @keyframes gjjFrenzyPulse{
          from{ opacity:.45; }
          to{ opacity:1; }
        }

        @media (max-width:640px){
          .gjj-mute{
            width:42px;
            height:42px;
            right:10px;
            bottom:calc(88px + env(safe-area-inset-bottom));
            font-size:20px;
          }

          .gjj-combo{
            top:calc(82px + env(safe-area-inset-top));
            padding:8px 13px;
          }

          .gjj-combo b{
            font-size:19px;
          }

          .gjj-center{
            padding:15px 14px;
            border-radius:26px;
          }

          .gjj-center-icon{
            font-size:42px;
          }

          .gjj-center b{
            font-size:23px;
          }

          .gjj-center span{
            font-size:13px;
          }

          .gjj-pop{
            font-size:22px;
          }
        }
      `;
      DOC.head.appendChild(css);
    }

    const btn = DOC.getElementById('gjjMuteBtn');
    if(btn && !btn.dataset.bound){
      btn.dataset.bound = '1';
      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        toggleSound();
      });
    }

    return root;
  }

  function setText(id, txt){
    const el = DOC.getElementById(id);
    if(el) el.textContent = String(txt ?? '');
  }

  function setMuteIcon(){
    const btn = DOC.getElementById('gjjMuteBtn');
    if(btn) btn.textContent = state.soundOn ? '🔊' : '🔇';
  }

  function toggleSound(){
    state.soundOn = !state.soundOn;
    try{
      localStorage.setItem(STORE_KEY, state.soundOn ? '1' : '0');
    }catch(e){}
    setMuteIcon();

    unlockAudio();
    if(state.soundOn) playGood();
    center(state.soundOn ? '🔊' : '🔇', state.soundOn ? 'เปิดเสียงแล้ว' : 'ปิดเสียงแล้ว', state.soundOn ? 'พร้อมลุยบอส!' : 'เล่นแบบเงียบ');
  }

  function unlockAudio(){
    if(state.unlocked && state.audio) return true;

    const AC = WIN.AudioContext || WIN.webkitAudioContext;
    if(!AC) return false;

    try{
      if(!state.audio){
        state.audio = new AC();
        state.master = state.audio.createGain();
        state.master.gain.value = 0.42;
        state.master.connect(state.audio.destination);
      }

      if(state.audio.state === 'suspended'){
        state.audio.resume();
      }

      state.unlocked = true;
      return true;
    }catch(e){
      return false;
    }
  }

  function withAudio(fn){
    if(!state.soundOn) return;
    if(!unlockAudio()) return;

    try{
      fn(state.audio, state.master);
    }catch(e){}
  }

  function tone(freq, dur, type, gain, startDelay){
    withAudio(function(ctx, out){
      const t0 = ctx.currentTime + (Number(startDelay) || 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain || 0.12), t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.04, dur || 0.12));

      osc.connect(g);
      g.connect(out);

      osc.start(t0);
      osc.stop(t0 + Math.max(0.05, dur || 0.12) + 0.03);
    });
  }

  function sweep(from, to, dur, type, gain){
    withAudio(function(ctx, out){
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = type || 'sawtooth';
      osc.frequency.setValueAtTime(from, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(g);
      g.connect(out);

      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    });
  }

  function noise(dur, gain){
    withAudio(function(ctx, out){
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for(let i = 0; i < len; i++){
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }

      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'highpass';
      filter.frequency.value = 800;

      g.gain.setValueAtTime(gain || 0.16, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);

      src.buffer = buffer;
      src.connect(filter);
      filter.connect(g);
      g.connect(out);

      src.start();
      src.stop(ctx.currentTime + dur + 0.02);
    });
  }

  function playGood(){
    tone(660, 0.08, 'sine', 0.12, 0);
    tone(880, 0.10, 'sine', 0.10, 0.055);
  }

  function playCombo(combo){
    const base = combo >= 10 ? 760 : 620;
    tone(base, 0.08, 'triangle', 0.13, 0);
    tone(base * 1.25, 0.08, 'triangle', 0.11, 0.07);
    tone(base * 1.55, 0.12, 'triangle', 0.10, 0.14);
  }

  function playBad(){
    sweep(260, 90, 0.18, 'sawtooth', 0.15);
    noise(0.12, 0.08);
  }

  function playTrap(){
    tone(520, 0.07, 'square', 0.10, 0);
    sweep(420, 120, 0.20, 'sawtooth', 0.12);
  }

  function playWarning(){
    tone(440, 0.11, 'square', 0.13, 0);
    tone(440, 0.11, 'square', 0.13, 0.19);
    tone(440, 0.11, 'square', 0.13, 0.38);
  }

  function playBossAttack(){
    noise(0.20, 0.18);
    sweep(180, 60, 0.28, 'sawtooth', 0.16);
  }

  function playMission(){
    tone(523, 0.08, 'triangle', 0.10, 0);
    tone(659, 0.09, 'triangle', 0.10, 0.08);
    tone(784, 0.13, 'triangle', 0.12, 0.17);
  }

  function playShield(){
    sweep(360, 920, 0.20, 'sine', 0.11);
    tone(1180, 0.11, 'triangle', 0.08, 0.17);
  }

  function playFrenzy(){
    tone(220, 0.13, 'sawtooth', 0.11, 0);
    tone(247, 0.13, 'sawtooth', 0.11, 0.17);
    tone(262, 0.16, 'sawtooth', 0.12, 0.34);
  }

  function playVictory(){
    tone(523, 0.11, 'triangle', 0.11, 0);
    tone(659, 0.11, 'triangle', 0.11, 0.11);
    tone(784, 0.13, 'triangle', 0.12, 0.22);
    tone(1046, 0.20, 'triangle', 0.13, 0.36);
  }

  function vibrate(pattern){
    try{
      if(navigator.vibrate) navigator.vibrate(pattern);
    }catch(e){}
  }

  function flash(kind){
    const f = DOC.createElement('div');
    f.className = `gjj-flash ${kind || 'good'}`;
    DOC.body.appendChild(f);
    setTimeout(()=>f.remove(), 380);
  }

  function shake(big){
    DOC.body.classList.remove('gjj-screen-shake', 'gjj-big-shake');
    void DOC.body.offsetWidth;
    DOC.body.classList.add(big ? 'gjj-big-shake' : 'gjj-screen-shake');
    setTimeout(()=>{
      DOC.body.classList.remove('gjj-screen-shake', 'gjj-big-shake');
    }, big ? 520 : 380);
  }

  function pop(text, x, y){
    ensureLayer();

    const root = DOC.getElementById('gjjPopRoot');
    if(!root) return;

    const p = DOC.createElement('div');
    p.className = 'gjj-pop';
    p.textContent = text;

    p.style.left = clamp(Number(x) || 50, 8, 92) + '%';
    p.style.top = clamp(Number(y) || 50, 12, 84) + '%';

    root.appendChild(p);
    setTimeout(()=>p.remove(), 880);
  }

  function ring(x, y){
    ensureLayer();

    const root = DOC.getElementById('gjjPopRoot');
    if(!root) return;

    const r = DOC.createElement('div');
    r.className = 'gjj-ring';

    r.style.left = clamp(Number(x) || 50, 8, 92) + '%';
    r.style.top = clamp(Number(y) || 50, 12, 84) + '%';

    root.appendChild(r);
    setTimeout(()=>r.remove(), 640);
  }

  let comboTimer = null;
  function showCombo(combo){
    ensureLayer();

    const box = DOC.getElementById('gjjCombo');
    if(!box) return;

    setText('gjjComboMain', `COMBO x${combo}!`);

    let sub = 'เลือกอาหารดีต่อเนื่อง';
    if(combo >= 15) sub = 'สุดยอด! บอสเจ็บหนัก';
    else if(combo >= 10) sub = 'แรงมาก! ใกล้ปิดฉากแล้ว';
    else if(combo >= 5) sub = 'ดีมาก! คอมโบกำลังมา';

    setText('gjjComboSub', sub);

    box.classList.add('show');
    clearTimeout(comboTimer);
    comboTimer = setTimeout(()=>box.classList.remove('show'), 1200);
  }

  let centerTimer = null;
  function center(icon, main, sub, ms){
    ensureLayer();

    const box = DOC.getElementById('gjjCenter');
    if(!box) return;

    setText('gjjCenterIcon', icon || '⭐');
    setText('gjjCenterMain', main || 'Nice!');
    setText('gjjCenterSub', sub || '');

    box.classList.add('show');
    clearTimeout(centerTimer);
    centerTimer = setTimeout(()=>box.classList.remove('show'), ms || 1250);
  }

  function onStart(){
    state.started = true;
    state.defeated = false;
    state.frenzy = false;
    state.combo = 0;

    ensureLayer();
    setMuteIcon();

    center('⚔️', 'Solo Boss!', 'เลือกอาหารดี หลบ junk และชนะบอส', 1500);
    flash('warn');
    vibrate(35);

    tone(392, 0.10, 'triangle', 0.09, 0);
    tone(523, 0.12, 'triangle', 0.10, 0.10);
    tone(659, 0.16, 'triangle', 0.11, 0.22);
  }

  function onGood(detail){
    const t = now();

    if(t - state.lastGoodAt < 1600){
      state.combo += 1;
    }else{
      state.combo = 1;
    }

    state.lastGoodAt = t;
    state.lastHitAt = t;

    const x = detail && (detail.x || detail.xy?.x);
    const y = detail && (detail.y || detail.xy?.y);

    playGood();
    flash('good');
    ring(x, y);
    pop(state.combo >= 5 ? `+GOOD x${state.combo}` : '+GOOD!', x, y);
    vibrate(18);

    if(state.combo >= 3){
      showCombo(state.combo);
    }

    if(state.combo > 0 && state.combo % 5 === 0){
      playCombo(state.combo);
      center('💥', `Combo x${state.combo}!`, 'บอสโดนโจมตีแรงขึ้น', 1050);
      shake(false);
    }
  }

  function onJunk(detail){
    state.combo = 0;

    const x = detail && (detail.x || detail.xy?.x);
    const y = detail && (detail.y || detail.xy?.y);

    playBad();
    flash('bad');
    shake(false);
    pop('JUNK HIT!', x, y);
    vibrate([35, 30, 35]);
  }

  function onFake(detail){
    state.combo = 0;

    const x = detail && (detail.x || detail.xy?.x);
    const y = detail && (detail.y || detail.xy?.y);

    playTrap();
    flash('bad');
    shake(false);
    pop('TRAP!', x, y);
    center('🧃', 'อาหารหลอกตา!', 'ดูน้ำตาล น้ำมัน และซอสแฝง', 1300);
    vibrate([25, 25, 45]);
  }

  function onMissGood(detail){
    state.combo = 0;

    const x = detail && (detail.x || detail.xy?.x);
    const y = detail && (detail.y || detail.xy?.y);

    tone(330, 0.10, 'sine', 0.07, 0);
    tone(220, 0.12, 'sine', 0.07, 0.08);
    pop('พลาดอาหารดี!', x, y);
    vibrate(25);
  }

  function onMissionComplete(){
    playMission();
    flash('good');
    center('🏅', 'ภารกิจสำเร็จ!', 'ได้โล่และโจมตีบอสแรงขึ้น', 1300);
    shake(false);
    vibrate([30, 20, 30]);
  }

  function onShield(){
    playShield();
    flash('warn');
    center('🛡️', 'โล่ช่วยไว้ได้!', 'ยังไม่เสียจังหวะ สู้ต่อ!', 1100);
    vibrate(30);
  }

  function onBossWarning(e){
    playWarning();
    flash('warn');

    const name = e && e.detail && e.detail.name ? e.detail.name : 'Boss Attack';
    center('⚠️', 'ระวังบอสโจมตี!', name, 1200);
    vibrate([45, 40, 45]);
  }

  function onBossAttack(e){
    playBossAttack();
    flash('bad');
    shake(true);

    const name = e && e.detail && e.detail.name ? e.detail.name : 'Boss Attack';
    pop(name, 50, 42);
    vibrate([60, 35, 60]);
  }

  function onBossHp(e){
    const d = e && e.detail ? e.detail : {};
    const damage = Math.round(Number(d.damage) || 0);

    if(damage >= 80){
      playCombo(10);
      flash('good');
      pop('BIG HIT!', 50, 44);
      shake(false);
    }
  }

  function onFrenzy(){
    state.frenzy = true;
    DOC.body.classList.add('gjj-frenzy-pulse');

    playFrenzy();
    flash('bad');
    center('🔥', 'บอสคลั่งแล้ว!', 'เลือดต่ำแล้ว รีบทำคอมโบปิดฉาก!', 1650);
    shake(true);
    vibrate([80, 40, 80]);
  }

  function onDefeated(){
    state.defeated = true;
    state.frenzy = false;
    DOC.body.classList.remove('gjj-frenzy-pulse');

    playVictory();
    flash('victory');
    center('🎉', 'ชนะบอสแล้ว!', 'เลือกอาหารดี ชนะอาหารขยะได้', 2200);

    for(let i = 0; i < 10; i++){
      setTimeout(()=>{
        const x = 18 + Math.random() * 64;
        const y = 24 + Math.random() * 38;
        pop(['⭐','🎉','🏆','💚','✨'][Math.floor(Math.random() * 5)], x, y);
        ring(x, y);
      }, i * 95);
    }

    vibrate([90, 35, 90, 35, 120]);
  }

  function onEnd(){
    DOC.body.classList.remove('gjj-frenzy-pulse');

    try{
      localStorage.setItem('GJ_SOLO_BOSS_JUICE_LAST', JSON.stringify({
        patch:'v8.40.3-SOUND-JUICE-PACK',
        combo:state.combo,
        defeated:state.defeated,
        frenzy:state.frenzy,
        soundOn:state.soundOn,
        savedAt:new Date().toISOString()
      }));
    }catch(e){}
  }

  function bridgeItemHit(e){
    const d = e && e.detail ? e.detail : {};
    const item = d.food || d.item || d;
    const type = String(d.type || item.type || item.kind || '').toLowerCase();

    if(type === 'good') onGood(d);
    else if(type === 'junk' || type === 'bad') onJunk(d);
    else if(type === 'fake' || type === 'trap' || type === 'fakehealthy') onFake(d);
  }

  WIN.GoodJunkSoloBossJuice = {
    version:'v8.40.3-SOUND-JUICE-PACK',
    unlockAudio,
    toggleSound,
    playGood,
    playBad,
    playTrap,
    playCombo,
    playWarning,
    playBossAttack,
    playMission,
    playShield,
    playVictory,
    center,
    pop,
    ring,
    flash,
    shake,
    getState:()=>({
      started:state.started,
      unlocked:state.unlocked,
      soundOn:state.soundOn,
      combo:state.combo,
      frenzy:state.frenzy,
      defeated:state.defeated
    })
  };

  WIN.addEventListener('pointerdown', unlockAudio, { passive:true });
  WIN.addEventListener('keydown', unlockAudio);

  WIN.addEventListener('gj:game-start', onStart);
  WIN.addEventListener('gj:boss-start', onStart);
  WIN.addEventListener('gj:solo-boss-start', onStart);

  WIN.addEventListener('gj:item-hit', bridgeItemHit);
  WIN.addEventListener('gj:hit-good', e => onGood(e.detail || {}));
  WIN.addEventListener('gj:hit-junk', e => onJunk(e.detail || {}));
  WIN.addEventListener('gj:hit-fake', e => onFake(e.detail || {}));
  WIN.addEventListener('gj:miss-good', e => onMissGood(e.detail || {}));

  WIN.addEventListener('gj:ultimate-combo-strike', e => {
    const combo = Number(e.detail && e.detail.combo) || 5;
    playCombo(combo);
    center('💥', `Combo Strike x${combo}!`, 'บอสโดนหนักมาก', 1000);
    flash('good');
    shake(false);
  });

  WIN.addEventListener('gj:ultimate-mission-complete', onMissionComplete);
  WIN.addEventListener('gj:ultimate-shield-block', onShield);
  WIN.addEventListener('gj:ultimate-boss-attack', function(e){
    playBossAttack();
    flash('bad');
    shake(true);
    center('👾', 'บอสสวนกลับ!', e.detail && e.detail.reason ? e.detail.reason : 'ตั้งใจใหม่อีกครั้ง', 1200);
  });

  WIN.addEventListener('gj:boss-attack-warning', onBossWarning);
  WIN.addEventListener('gj:boss-visual-attack', onBossAttack);
  WIN.addEventListener('gj:boss-hp-change', onBossHp);
  WIN.addEventListener('gj:boss-frenzy', onFrenzy);
  WIN.addEventListener('gj:boss-defeated', onDefeated);

  WIN.addEventListener('gj:game-end', onEnd);
  WIN.addEventListener('gj:boss-end', onEnd);

  DOC.addEventListener('DOMContentLoaded', function(){
    ensureLayer();
    setMuteIcon();
  });
})();
