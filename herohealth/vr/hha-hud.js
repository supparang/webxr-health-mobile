// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR) — PRO PACK
// ✅ Updates: score/combo/miss/time/grade + quest + coach
// ✅ Adds: COUNTER badge, PULSE ring, toast, tick beeps (safe unlock)
// ✅ Listens: hha:score, hha:time, hha:rank, quest:update, hha:coach, hha:end
// ✅ Boss UI: hha:counter, hha:bossPulse, hha:bossAtk, hha:tick
// ✅ Safe if elements missing, safe re-init, no double DOM.

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  if (root.__HHA_HUD_BOUND__) return;
  root.__HHA_HUD_BOUND__ = true;

  const $ = (id)=> doc.getElementById(id);

  // --- Audio (safe unlock) ---
  let audioCtx = null;
  let audioUnlocked = false;
  function unlockAudioOnce(){
    if (audioUnlocked) return;
    audioUnlocked = true;
    try{
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume?.();
    }catch(_){}
    root.removeEventListener('pointerdown', unlockAudioOnce, true);
    root.removeEventListener('touchstart', unlockAudioOnce, true);
  }
  root.addEventListener('pointerdown', unlockAudioOnce, true);
  root.addEventListener('touchstart', unlockAudioOnce, true);

  function beep(freq=720, ms=55, gain=0.06){
    try{
      if (!audioCtx) return;
      const t0 = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (ms/1000));
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0);
      o.stop(t0 + (ms/1000) + 0.02);
    }catch(_){}
  }

  // --- CSS injection ---
  function injectCSS(){
    if (doc.getElementById('hha-hud-pro-css')) return;
    const s = doc.createElement('style');
    s.id = 'hha-hud-pro-css';
    s.textContent = `
      .hha-toast-layer{
        position:fixed; inset:0;
        z-index: 9998;
        pointer-events:none;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
      }
      .hha-toast{
        position:fixed;
        left:50%;
        top: calc(10px + 64px);
        transform: translate(-50%,-10px);
        padding: 10px 12px;
        border-radius: 999px;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(148,163,184,.22);
        box-shadow: 0 18px 50px rgba(0,0,0,.45);
        backdrop-filter: blur(10px);
        font-weight: 950;
        font-size: 12px;
        opacity: 0;
        transition: opacity .12s ease, transform .12s ease;
        white-space:nowrap;
      }
      .hha-toast.show{
        opacity: .98;
        transform: translate(-50%,0px);
      }

      .hha-counter{
        position:fixed;
        left:50%;
        top: 52%;
        transform: translate(-50%,-50%) scale(.98);
        z-index: 9997;
        pointer-events:none;
        opacity: 0;
        transition: opacity .10s ease, transform .10s ease;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
        text-align:center;
      }
      .hha-counter.show{
        opacity: 1;
        transform: translate(-50%,-50%) scale(1);
      }
      .hha-counter .badge{
        display:inline-flex;
        align-items:center;
        gap:10px;
        padding: 12px 14px;
        border-radius: 999px;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(148,163,184,.22);
        box-shadow:
          0 18px 50px rgba(0,0,0,.45),
          0 0 40px rgba(245,158,11,.10);
        backdrop-filter: blur(10px);
        font-weight: 1000;
        letter-spacing:.2px;
        font-size: 13px;
      }
      .hha-counter .bar{
        margin-top:10px;
        height:10px;
        border-radius:999px;
        overflow:hidden;
        background: rgba(255,255,255,.10);
        border: 1px solid rgba(255,255,255,.14);
        width: min(280px, 64vw);
      }
      .hha-counter .fill{
        height:100%;
        width: 0%;
        border-radius:999px;
        background: linear-gradient(90deg, rgba(245,158,11,.92), rgba(239,68,68,.92));
        transition: width .06s linear;
      }
      .hha-counter.ok .badge{
        border-color: rgba(34,197,94,.30);
        box-shadow:
          0 18px 50px rgba(0,0,0,.45),
          0 0 40px rgba(34,197,94,.12);
      }
      .hha-counter.fail .badge{
        border-color: rgba(239,68,68,.30);
        box-shadow:
          0 18px 50px rgba(0,0,0,.45),
          0 0 40px rgba(239,68,68,.14);
      }

      .hha-pulse-ring{
        position:fixed;
        width: 280px;
        height: 280px;
        border-radius: 999px;
        left:50%;
        top:50%;
        transform: translate(-50%,-50%);
        z-index: 9996;
        pointer-events:none;
        opacity: 0;
        transition: opacity .10s ease, transform .10s ease;
        border: 3px solid rgba(245,158,11,.75);
        box-shadow:
          0 0 0 10px rgba(245,158,11,.08),
          0 20px 70px rgba(0,0,0,.35);
        mix-blend-mode: screen;
      }
      .hha-pulse-ring.show{
        opacity: .95;
        transform: translate(-50%,-50%) scale(1.02);
      }
      .hha-pulse-ring:after{
        content:'PULSE';
        position:absolute;
        left:50%;
        top:50%;
        transform: translate(-50%,-50%);
        font-weight: 1000;
        letter-spacing:.3px;
        color: rgba(255,255,255,.92);
        text-shadow: 0 10px 30px rgba(0,0,0,.6);
      }

      @media (max-height:640px){
        .hha-toast{ top: calc(10px + 56px); }
      }
    `;
    doc.head.appendChild(s);
  }

  // --- Overlays ensure ---
  let toastLayer=null, toastEl=null;
  let counterEl=null, counterFill=null, counterLabel=null;
  let pulseEl=null;

  function ensureOverlays(){
    injectCSS();
    if (!toastLayer){
      toastLayer = doc.querySelector('.hha-toast-layer');
      if (!toastLayer){
        toastLayer = doc.createElement('div');
        toastLayer.className = 'hha-toast-layer';
        doc.body.appendChild(toastLayer);
      }
    }
    if (!toastEl){
      toastEl = doc.createElement('div');
      toastEl.className = 'hha-toast';
      toastEl.textContent = '—';
      toastLayer.appendChild(toastEl);
    }
    if (!counterEl){
      counterEl = doc.createElement('div');
      counterEl.className = 'hha-counter';
      counterEl.innerHTML = `
        <div class="badge"><span>⚡</span><span id="hhaCounterTxt">COUNTER!</span></div>
        <div class="bar"><div class="fill" id="hhaCounterFill"></div></div>
      `;
      doc.body.appendChild(counterEl);
      counterFill = counterEl.querySelector('#hhaCounterFill');
      counterLabel = counterEl.querySelector('#hhaCounterTxt');
    }
    if (!pulseEl){
      pulseEl = doc.createElement('div');
      pulseEl.className = 'hha-pulse-ring';
      doc.body.appendChild(pulseEl);
    }
  }

  // --- Toast ---
  let toastT = 0;
  function toast(msg, ms=850){
    ensureOverlays();
    if (!toastEl) return;
    toastEl.textContent = String(msg||'');
    toastEl.classList.add('show');
    const t = Date.now();
    toastT = t;
    setTimeout(()=>{
      if (toastT !== t) return;
      toastEl.classList.remove('show');
    }, Math.max(250, ms|0));
  }

  // --- Counter badge ---
  let counterUntil = 0;
  let counterDur = 0;
  let counterRAF = 0;

  function showCounter(msLeft=180){
    ensureOverlays();
    counterDur = Math.max(60, msLeft|0);
    counterUntil = Date.now() + counterDur;
    counterEl.classList.remove('ok','fail');
    counterEl.classList.add('show');
    if (counterLabel) counterLabel.textContent = 'COUNTER!';
    tickCounter();
  }

  function counterResult(ok){
    ensureOverlays();
    if (!counterEl) return;
    counterEl.classList.remove('ok','fail');
    counterEl.classList.add(ok ? 'ok' : 'fail');
    if (counterLabel) counterLabel.textContent = ok ? 'COUNTER ✅' : 'LATE ❌';
    setTimeout(()=> counterEl.classList.remove('show'), 420);
  }

  function tickCounter(){
    if (!counterEl || !counterFill) return;
    cancelAnimationFrame(counterRAF);
    const now = Date.now();
    const left = Math.max(0, counterUntil - now);
    const pct = counterDur > 0 ? (left / counterDur) : 0;
    counterFill.style.width = Math.round(pct * 100) + '%';
    if (left <= 0){
      counterEl.classList.remove('show');
      return;
    }
    counterRAF = requestAnimationFrame(tickCounter);
  }

  // --- Pulse ring ---
  let pulseHideT = 0;
  function showPulse(x,y, ttlMs=1200, radiusPx=140){
    ensureOverlays();
    if (!pulseEl) return;
    const r = Math.max(80, radiusPx|0);
    pulseEl.style.width = (r*2)+'px';
    pulseEl.style.height = (r*2)+'px';
    pulseEl.style.left = (x|0)+'px';
    pulseEl.style.top  = (y|0)+'px';
    pulseEl.classList.add('show');

    const t = Date.now();
    pulseHideT = t;
    setTimeout(()=>{
      if (pulseHideT !== t) return;
      pulseEl.classList.remove('show');
    }, Math.max(250, ttlMs|0));
  }

  // --- Helpers ---
  function setText(id, val){
    const el = $(id);
    if (el) el.textContent = String(val);
  }
  function setFill(idFill, cur, max){
    const el = $(idFill);
    const c = Math.max(0, (Number(cur)||0));
    const m = Math.max(1, (Number(max)||1));
    if (el) el.style.width = Math.round((c/m)*100) + '%';
  }

  // --- Score + time + rank ---
  root.addEventListener('hha:score', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.score != null) setText('hhaScore', d.score|0);
    if (d.combo != null) setText('hhaCombo', d.combo|0);
    if (d.misses != null) setText('hhaMiss', d.misses|0);

    // compat time (some engines put in score)
    if (d.timeLeft != null) setText('hhaTime', d.timeLeft|0);
    if (d.shield != null && root.FeverUI?.setShield) root.FeverUI.setShield(d.shield|0);
    if (d.fever != null && root.FeverUI?.setFever) root.FeverUI.setFever(d.fever);

  }, { passive:true });

  root.addEventListener('hha:time', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.sec != null) setText('hhaTime', d.sec|0);
  }, { passive:true });

  root.addEventListener('hha:rank', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.grade != null) setText('hhaGrade', d.grade);
  }, { passive:true });

  // --- Quest update ---
  root.addEventListener('quest:update', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};

    const g = d.goal || null;
    const m = d.mini || null;

    const goalTitle = g ? (g.title || 'Goal') : (d.goalTitle || 'Goal');
    const goalCur = g ? (g.cur ?? 0) : (d.goalCur ?? 0);
    const goalMax = g ? (g.target ?? 0) : (d.goalTarget ?? 0);

    const miniTitle = m ? (m.title || 'Mini') : (d.miniTitle || 'Mini');
    const miniCur = m ? (m.cur ?? 0) : (d.miniCur ?? 0);
    const miniMax = m ? (m.target ?? 0) : (d.miniTarget ?? 0);

    setText('qGoalTitle', `Goal: ${goalTitle}`);
    setText('qGoalCur', goalCur|0);
    setText('qGoalMax', goalMax|0);
    setFill('qGoalFill', goalCur, goalMax);

    setText('qMiniTitle', `Mini: ${miniTitle}`);
    setText('qMiniCur', miniCur|0);
    setText('qMiniMax', miniMax|0);
    setFill('qMiniFill', miniCur, miniMax);

    // mini timer
    const tLeft = (m && (m.tLeft != null)) ? m.tLeft : (d.miniTLeft != null ? d.miniTLeft : null);
    if (tLeft != null) setText('qMiniTLeft', tLeft);
  }, { passive:true });

  // --- Coach ---
  function coachImgByMood(m){
    const mood = String(m||'').toLowerCase();
    if (mood.includes('fever') || mood.includes('stun')) return './img/coach-fever.png';
    if (mood.includes('happy') || mood.includes('win') || mood.includes('good')) return './img/coach-happy.png';
    if (mood.includes('sad') || mood.includes('warn') || mood.includes('bad')) return './img/coach-sad.png';
    return './img/coach-neutral.png';
  }
  root.addEventListener('hha:coach', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.line != null) setText('hhaCoachLine', d.line);
    if (d.sub != null) setText('hhaCoachSub', d.sub);
    if (d.mood != null){
      const img = $('hhaCoachImg');
      if (img) img.src = coachImgByMood(d.mood);
    }
  }, { passive:true });

  // --- Counter / Boss pulse / boss atk / tick ---
  root.addEventListener('hha:counter', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const kind = String(d.kind || d.state || 'open').toLowerCase();
    const msLeft = (d.msLeft != null) ? d.msLeft : (d.windowMs != null ? d.windowMs : 180);

    if (kind === 'open'){
      showCounter(msLeft|0);
      beep(880, 40, 0.05);
      toast('⚡ COUNTER WINDOW!', 650);
    } else if (kind === 'success' || kind === 'ok'){
      counterResult(true);
      beep(1040, 55, 0.06);
      beep(1320, 45, 0.05);
      toast('✅ COUNTER!', 650);
    } else if (kind === 'fail' || kind === 'late'){
      counterResult(false);
      beep(240, 90, 0.05);
      toast('❌ LATE!', 650);
    }
  }, { passive:true });

  root.addEventListener('hha:bossPulse', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const x = d.x != null ? d.x : (innerWidth*0.5);
    const y = d.y != null ? d.y : (innerHeight*0.55);
    const ttl = d.ttlMs != null ? d.ttlMs : 1200;
    const r = d.radiusPx != null ? d.radiusPx : 140;
    showPulse(x, y, ttl, r);
    beep(760, 45, 0.05);
  }, { passive:true });

  root.addEventListener('hha:bossAtk', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const name = String(d.name||'').toLowerCase();
    if (name) toast(`👹 BOSS: ${name.toUpperCase()}!`, 850);
  }, { passive:true });

  root.addEventListener('hha:tick', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const kind = String(d.kind||'tick').toLowerCase();
    const intensity = Number(d.intensity||1);

    if (kind.includes('laser')) beep(980, 35, 0.03 + 0.02*intensity);
    else if (kind.includes('ring')) beep(760, 35, 0.03 + 0.02*intensity);
    else if (kind.includes('final')) beep(1200, 30, 0.03 + 0.02*intensity);
    else beep(720, 28, 0.025 + 0.02*intensity);
  }, { passive:true });

  // --- End summary (fills #hhaEnd if exists) ---
  root.addEventListener('hha:end', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    // fill (if your end overlay exists)
    if ($('endGrade')) setText('endGrade', d.grade ?? '—');
    if ($('endScore')) setText('endScore', d.scoreFinal ?? d.score ?? 0);
    if ($('endComboMax')) setText('endComboMax', d.comboMax ?? 0);
    if ($('endMiss')) setText('endMiss', d.misses ?? 0);

    if ($('endGoals')) setText('endGoals', d.goalsCleared ?? 0);
    if ($('endGoalsTotal')) setText('endGoalsTotal', d.goalsTotal ?? 0);

    if ($('endMinis')) setText('endMinis', d.miniCleared ?? d.minisCleared ?? 0);
    if ($('endMinisTotal')) setText('endMinisTotal', d.miniTotal ?? d.minisTotal ?? 0);

    if ($('endAcc')) setText('endAcc', d.accuracy ?? 0);

    const endBox = $('hhaEnd');
    if (endBox) endBox.style.display = 'flex';

    toast('🎉 FINISH!', 900);
    beep(880, 60, 0.05);
    beep(1040, 60, 0.05);
  }, { passive:true });

  // init overlays early (safe)
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ensureOverlays, { once:true });
  else ensureOverlays();

})(window);