/* === /herohealth/vr-groups/groups.banner.js ===
GroupsVR Big Banner + Juicy Feedback (Kid-friendly)
✅ Uses existing .bigBanner / .bigBannerText from groups-vr.css
✅ Listens: groups:progress + hha:judge (fallback)
✅ Adds: haptics (vibrate), micro-SFX (WebAudio), confetti (Particles if available)
✅ Safety:
   - OFF in run=research or runMode=practice
   - Rate-limited so it won't spam
*/

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;
  if(!DOC || WIN.__GROUPS_BANNER__) return;
  WIN.__GROUPS_BANNER__ = true;

  // -------- params / gating --------
  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function isPlayMode(){
    const run = String(qs('run','play')||'play').toLowerCase();
    return (run !== 'research'); // practice ถูกส่งเป็น runMode ภายใน engine แต่ URL ปกติไม่ใช่ research
  }

  // -------- banner DOM --------
  function ensureBanner(){
    let wrap = DOC.querySelector('.bigBanner');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'bigBanner';
    wrap.innerHTML = '<div class="bigBannerText"></div>';
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function setVariant(wrap, variant){
    wrap.classList.remove('b-focus','b-boss','b-storm','b-mini','b-good','b-bad');
    if (variant) wrap.classList.add('b-' + variant);
  }

  let hideTmr = 0;
  let lastShowAt = 0;

  function show(text, ms, variant){
    const t = Date.now();
    // กันเด้งถี่เกิน (UI ไม่รก)
    if (t - lastShowAt < 180) return;
    lastShowAt = t;

    try{
      const wrap = ensureBanner();
      const el = wrap.querySelector('.bigBannerText');
      if(!el) return;

      el.textContent = String(text || '');
      setVariant(wrap, variant || '');

      wrap.classList.remove('show');
      void wrap.offsetWidth; // reflow to restart anim
      wrap.classList.add('show');

      clearTimeout(hideTmr);
      hideTmr = setTimeout(()=>{ try{ wrap.classList.remove('show'); }catch(_){} }, ms ?? 900);
    }catch(_){}
  }

  // -------- juicy: haptics --------
  function vibrate(pattern){
    try{
      if (!isPlayMode()) return;
      if (!navigator.vibrate) return;
      navigator.vibrate(pattern);
    }catch(_){}
  }

  // -------- juicy: micro-SFX (WebAudio) --------
  let audioCtx = null;
  let lastSfxAt = 0;

  function sfx(type){
    try{
      if (!isPlayMode()) return;

      // rate-limit กันเสียงถี่
      const t = Date.now();
      if (t - lastSfxAt < 120) return;
      lastSfxAt = t;

      const AC = (WIN.AudioContext || WIN.webkitAudioContext);
      if (!AC) return;

      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') { audioCtx.resume().catch(()=>{}); }

      // preset โทน
      const map = {
        focus:  { f1: 740, f2: 980, dur: 0.08 },
        boss:   { f1: 180, f2: 120, dur: 0.10 },
        storm:  { f1: 320, f2: 460, dur: 0.10 },
        mini:   { f1: 520, f2: 740, dur: 0.09 },
        good:   { f1: 880, f2: 1320, dur: 0.08 },
        bad:    { f1: 220, f2: 160, dur: 0.10 },
      };
      const p = map[type] || map.good;

      const now = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();

      o.type = 'triangle';
      o.frequency.setValueAtTime(p.f1, now);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, p.f2), now + p.dur);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);

      o.connect(g);
      g.connect(audioCtx.destination);

      o.start(now);
      o.stop(now + p.dur + 0.02);
    }catch(_){}
  }

  // -------- juicy: confetti (Particles if available) --------
  let lastFxAt = 0;
  function confetti(tag){
    try{
      if (!isPlayMode()) return;
      const t = Date.now();
      if (t - lastFxAt < 220) return;
      lastFxAt = t;

      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      if (!P) return;

      // ปล่อย confetti บริเวณแบนเนอร์ (กลางบน)
      const x = (WIN.innerWidth || 360) * 0.5;
      const y = (WIN.innerHeight || 640) * 0.18;

      // ถ้ามี burst() ก็ยิง burst, ถ้าไม่มีใช้ popText แทน
      if (typeof P.burst === 'function') {
        P.burst(x, y, (tag || '✨'));
      } else if (typeof P.popText === 'function') {
        P.popText(x, y, String(tag || '✨'), 'fx-pop');
      }
    }catch(_){}
  }

  // -------- helper: mini CSS pulse --------
  function flashMiniPulse(on){
    try{
      DOC.body.classList.toggle('fx-mini', !!on);
      if (on) setTimeout(()=>{ try{ DOC.body.classList.remove('fx-mini'); }catch(_){} }, 650);
    }catch(_){}
  }

  // -------- Primary: groups:progress --------
  WIN.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail || {};
    const k = String(d.kind || '');

    // Focus / Switch
    if (k === 'focus_start'){
      show('⚡ FOCUS!', 900, 'focus');
      vibrate([20,30,20]);
      sfx('focus');
      return;
    }
    if (k === 'focus_end_switch'){
      show('🔁 SWITCH!', 900, 'focus');
      vibrate([25,20,25]);
      sfx('focus');
      confetti('🔁');
      return;
    }

    // Boss
    if (k === 'boss_spawn'){
      show('👾 BOSS!', 1000, 'boss');
      vibrate([30,30,30,30,30]);
      sfx('boss');
      return;
    }
    if (k === 'boss_down'){
      show('💥 BOSS DOWN!', 950, 'boss');
      vibrate([35,25,35,25,45]);
      sfx('good');
      confetti('💥');
      return;
    }

    // Storm
    if (k === 'storm_on'){
      show('🌪️ STORM!', 900, 'storm');
      vibrate([20,20,20,20,20]);
      sfx('storm');
      return;
    }
    if (k === 'storm_off'){
      show('✨ CLEAR!', 800, 'storm');
      vibrate(18);
      sfx('good');
      return;
    }

    // Mini
    if (k === 'mini_start'){
      show('⏱️ MINI!', 900, 'mini');
      flashMiniPulse(true);
      vibrate([15,25,15]);
      sfx('mini');
      return;
    }
    if (k === 'mini_clear'){
      show('🎉 MINI CLEAR!', 950, 'mini');
      vibrate([25,20,35]);
      sfx('good');
      confetti('🎉');
      return;
    }
    if (k === 'mini_fail'){
      show('😤 MINI FAIL!', 950, 'mini');
      vibrate([40,30,40]);
      sfx('bad');
      return;
    }

  }, { passive:true });

  // -------- Fallback: hha:judge --------
  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    const kind = String(d.kind || '');
    const text = String(d.text || '');

    // กันเด้งถี่จาก judge (บางที spam)
    if (!kind) return;

    if (kind === 'boss' && /BOSS/i.test(text)){
      show('👾 BOSS!', 900, 'boss');
      sfx('boss'); vibrate([30,30,30]);
      return;
    }
    if (kind === 'storm'){
      show('🌪️ STORM!', 900, 'storm');
      sfx('storm'); vibrate([20,20,20]);
      return;
    }
    if (kind === 'perfect' && /FOCUS/i.test(text)){
      show('⚡ FOCUS!', 850, 'focus');
      sfx('focus'); vibrate([18,30,18]);
      return;
    }
    if (kind === 'perfect' && /SWITCH/i.test(text)){
      show('🔁 SWITCH!', 850, 'focus');
      sfx('focus'); vibrate([22,20,22]); confetti('🔁');
      return;
    }
    if (kind === 'good' && /GOAL CLEAR/i.test(text)){
      show('✅ GOAL!', 900, 'good');
      sfx('good'); vibrate([25,20,35]); confetti('✅');
      return;
    }
  }, { passive:true });

})();