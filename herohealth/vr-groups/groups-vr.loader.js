// === /herohealth/vr-groups/groups-vr.loader.js ===
// GroupsVR Loader — PRODUCTION (Pack 13 + 13.95 + 14 + 15)
// ✅ View: respects ?view (NO override), else auto pc/mobile best-effort
// ✅ PACK 13: Calibration helper (cVR) 2-step (recenter + 3 test shots)
// ✅ PACK 14: Practice 15s (cVR) then auto start real run
// ✅ PACK 13.95: Telemetry lite/full/off + throttle + flush-hardened + auto downgrade by FPS
// ✅ Research/Practice: force telemetry OFF + AI OFF (deterministic)
// ✅ Bind HUD + Quest + Power + Coach + End overlay helpers (minimal, safe)
// ✅ Works with groups.safe.js (window.GroupsVR.GameEngine)
// Notes:
// - This loader expects DOM elements IDs exist in groups-vr.html
// - Optional modules: research-ctx.js, flush-log.js, view-helper.js, telemetry.js, ai-hooks.js

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const $ = (id)=>DOC.getElementById(id);

  // ---------- query helpers ----------
  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function qbool(k){
    const v = String(qs(k,'')||'').toLowerCase();
    return (v==='1'||v==='true'||v==='yes'||v==='on');
  }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function nowMs(){ try{ return performance.now(); }catch{ return Date.now(); } }

  // ---------- view ----------
  function detectAutoView(){
    // best-effort pc/mobile (do NOT guess vr/cvr here; launcher handles it)
    const coarse = WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches;
    const small = Math.min(WIN.innerWidth||360, WIN.innerHeight||640) <= 520;
    return (coarse || small) ? 'mobile' : 'pc';
  }
  function getView(){
    const explicit = String(qs('view','')||'').toLowerCase();
    if (explicit) return explicit; // ✅ no override
    return detectAutoView();
  }
  function setBodyView(view){
    DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    DOC.body.classList.add('view-' + (view||'mobile'));
  }

  // ---------- run config ----------
  const runMode = String(qs('run','play')||'play').toLowerCase(); // play|research|practice
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const style = String(qs('style','mix')||'mix').toLowerCase();
  const timeSec = clamp(qs('time', 90), 30, 180);
  const seed = String(qs('seed', Date.now()) || Date.now());

  const view = getView();
  setBodyView(view);

  // practice config:
  function getPracticeSec(){
    const p = String(qs('practice','0')||'0');
    let sec = Number(p)||0;
    if (p === '1') sec = 15;
    sec = clamp(sec, 0, 30);
    if (view !== 'cvr') sec = 0;
    return sec;
  }

  // AI gating:
  function aiEnabled(){
    // AI only in play
    if (runMode !== 'play') return false;
    const on = String(qs('ai','0')||'0').toLowerCase();
    return (on==='1'||on==='true');
  }

  // Telemetry mode:
  // ?tele=off|lite|full  (default: lite on play, off on research/practice)
  function teleModeDefault(){
    if (runMode !== 'play') return 'off';
    return 'lite';
  }
  function getTeleMode(){
    const v = String(qs('tele', '')||'').toLowerCase();
    if (v==='off'||v==='lite'||v==='full') return v;
    return teleModeDefault();
  }

  // endpoint for logging (optional)
  const logEndpoint = String(qs('log','')||''); // Apps Script URL later

  // ---------- elements (must exist in groups-vr.html) ----------
  const elTime  = $('vTime');
  const elScore = $('vScore');
  const elCombo = $('vCombo');
  const elMiss  = $('vMiss');
  const elRank  = $('vRank');
  const elAcc   = $('vAcc');
  const elMode  = $('vMode');

  const goalFill = $('goalFill');
  const goalTitle= $('goalTitle');
  const goalCount= $('goalCount');
  const goalSub  = $('goalSub');

  const miniFill = $('miniFill');
  const miniTitle= $('miniTitle');
  const miniSub  = $('miniSub');
  const miniTime = $('miniTime');

  const pFill = $('pFill');
  const pCur  = $('pCur');
  const pThr  = $('pThr');

  const coachText = $('coachText');
  const coachImg  = $('coachImg');

  const bigBanner = $('bigBanner');
  const bigBannerText = $('bigBannerText');

  const calOverlay = $('calOverlay');
  const calSub = $('calSub');
  const calStep = $('calStep');
  const calShots= $('calShots');
  const btnCalNext = $('btnCalNext');
  const btnCalSkip = $('btnCalSkip');

  const endOverlay = $('endOverlay');
  const endLine = $('endLine');
  const endScore = $('endScore');
  const endRank  = $('endRank');
  const endAcc   = $('endAcc');
  const endMiss  = $('endMiss');
  const btnRestart = $('btnRestart');
  const btnCopy = $('btnCopy');
  const btnBackLauncher = $('btnBackLauncher');
  const btnHub = $('btnHub');

  // ---------- helpers ----------
  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  async function copyText(text){
    try { await navigator.clipboard.writeText(String(text||'')); return true; }
    catch {
      try{
        const ta = DOC.createElement('textarea');
        ta.value = String(text||'');
        DOC.body.appendChild(ta);
        ta.select();
        DOC.execCommand('copy');
        ta.remove();
        return true;
      }catch{ return false; }
    }
  }

  // ---------- Big Banner ----------
  let bannerTmr = 0;
  function showBanner(text, tone='neutral', ms=1200){
    if (!bigBanner || !bigBannerText) return;
    bigBannerText.textContent = String(text||'');
    bigBanner.classList.remove('hidden');
    bigBanner.classList.remove('tone-neutral','tone-good','tone-warn','tone-bad');
    bigBanner.classList.add('show');
    bigBanner.classList.add('tone-' + tone);

    clearTimeout(bannerTmr);
    bannerTmr = setTimeout(()=>{
      try{
        bigBanner.classList.remove('show');
        bigBanner.classList.add('hidden');
      }catch(_){}
    }, clamp(ms, 600, 2500));
  }

  function setCoachMood(mood){
    if (!coachImg) return;
    const m = String(mood||'neutral');
    coachImg.src =
      (m==='happy') ? '../img/coach-happy.png' :
      (m==='sad')   ? '../img/coach-sad.png' :
      (m==='fever') ? '../img/coach-fever.png' :
                      '../img/coach-neutral.png';
  }

  function coachSay(text, mood='neutral'){
    if (coachText) coachText.textContent = String(text||'');
    setCoachMood(mood);
    emit('hha:coach', { text, mood });
  }

  // ---------- Engine wait ----------
  function waitForEngine(cb){
    const t0 = Date.now();
    const it = setInterval(()=>{
      const E = WIN.GroupsVR && WIN.GroupsVR.GameEngine;
      if (E && typeof E.start==='function' && typeof E.setLayerEl==='function'){
        clearInterval(it);
        cb(E);
        return;
      }
      if (Date.now() - t0 > 7000){
        clearInterval(it);
        coachSay('โหลดเอนจินไม่ขึ้น (groups.safe.js). เช็ค path/ชื่อไฟล์ แล้วรีเฟรชอีกครั้ง', 'sad');
      }
    }, 60);
  }

  function getLayerEl(){
    return $('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
  }

  function initViewHelper(){
    try{
      const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
      H && H.init && H.init({ view });
    }catch(_){}
  }

  // ---------- PACK 13.95: Telemetry init ----------
  function initTelemetry(runModeLocal){
    // force OFF in research/practice
    const mode = (runModeLocal !== 'play') ? 'off' : getTeleMode();

    try{
      const T = WIN.GroupsVR && WIN.GroupsVR.Telemetry;
      if (!T || !T.init) return;

      T.init({
        mode,                 // off|lite|full
        runMode: runModeLocal,// play|research|practice
        endpoint: logEndpoint,
        seed,
        diff,
        style,
        view,

        flushEveryMs: 2000,
        maxEventsPerBatch: 60,
        maxQueueBatches: 16,
        statusEveryMs: 850,

        // auto downgrade guard
        autoDowngrade: true,
        fpsWindowMs: 1800,
        fpsLiteBelow: 34,
        fpsOffBelow: 24
      });
    }catch(_){}
  }

  // show banner when telemetry auto-switch happens
  WIN.addEventListener('groups:telemetry_auto', (ev)=>{
    const d = ev.detail || {};
    if (d.kind !== 'switch') return;

    const msg =
      (d.to === 'lite') ? `📡 TELE ลดเป็น LITE (FPS ${d.fps})` :
      (d.to === 'off')  ? `📡 TELE ปิดชั่วคราว (FPS ${d.fps})` :
                          `📡 TELE → ${String(d.to||'')}`;

    showBanner(msg, 'warn', 1300);
    coachSay(`เครื่องเริ่มหน่วง (FPS ${d.fps}) เลยลดการเก็บ log เพื่อให้เล่นลื่นขึ้น ✅`, 'neutral');
  }, { passive:true });

  // ---------- PACK 13: Calibration ----------
  const CAL = { on:false, step:1, shots:0, done:false };

  function showCal(on){
    if (!calOverlay) return;
    calOverlay.classList.toggle('hidden', !on);
    DOC.body.classList.toggle('calibration', !!on);
  }

  function setCalUI(){
    if (calStep) calStep.textContent = `${CAL.step}/2`;
    if (calShots) calShots.textContent = `${CAL.shots}/3`;

    if (calSub){
      if (CAL.step === 1){
        calSub.innerHTML = `Step 1/2: กด <b>RECENTER</b> แล้วถือมือถือให้นิ่งตรงหน้า`;
      }else{
        calSub.innerHTML = `Step 2/2: ลองยิง <b>3 ครั้ง</b> (แตะจอ) เพื่อทดสอบ crosshair`;
      }
    }

    if (btnCalNext){
      if (CAL.step === 1){
        btnCalNext.textContent = '✅ ต่อไป';
        btnCalNext.disabled = false;
      }else{
        btnCalNext.textContent = (CAL.shots>=3) ? '🚀 เริ่มเลย' : 'ยิงให้ครบ 3 ครั้ง';
        btnCalNext.disabled = (CAL.shots < 3);
      }
    }
  }

  function startCalibrationIfNeeded(){
    if (view !== 'cvr') return false;

    CAL.on = true;
    CAL.done = false;
    CAL.step = 1;
    CAL.shots = 0;

    showCal(true);
    setCalUI();
    coachSay('Calibration: กด RECENTER ก่อน แล้วกด “ต่อไป” ✅', 'neutral');
    return true;
  }

  function finishCalibration(){
    CAL.on = false;
    CAL.done = true;
    showCal(false);
  }

  WIN.addEventListener('hha:shoot', ()=>{
    if (!CAL.on) return;
    if (CAL.step !== 2) return;
    CAL.shots = Math.min(3, (CAL.shots|0) + 1);
    setCalUI();
  }, { passive:true });

  btnCalNext && btnCalNext.addEventListener('click', ()=>{
    if (!CAL.on) return;
    if (CAL.step === 1){
      CAL.step = 2;
      setCalUI();
      return;
    }
    if (CAL.step === 2 && CAL.shots >= 3){
      finishCalibration();
      waitForEngine((E)=> startAfterGates(E));
    }
  });

  btnCalSkip && btnCalSkip.addEventListener('click', ()=>{
    if (!CAL.on) return;
    finishCalibration();
    waitForEngine((E)=> startAfterGates(E));
  });

  // ---------- HUD bindings ----------
  WIN.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    if (elScore) elScore.textContent = String(d.score ?? 0);
    if (elCombo) elCombo.textContent = String(d.combo ?? 0);
    if (elMiss)  elMiss.textContent  = String(d.misses ?? 0);
  }, {passive:true});

  WIN.addEventListener('hha:time', (ev)=>{
    const d = ev.detail||{};
    const left = Math.max(0, Math.round(d.left ?? timeSec));
    if (elTime) elTime.textContent = String(left);
  }, {passive:true});

  WIN.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail||{};
    if (elRank) elRank.textContent = String(d.grade ?? 'C');
    if (elAcc)  elAcc.textContent  = String((d.accuracy ?? 0) + '%');
  }, {passive:true});

  WIN.addEventListener('hha:coach', (ev)=>{
    const d = ev.detail||{};
    if (coachText) coachText.textContent = String(d.text||'');
    setCoachMood(d.mood);
  }, {passive:true});

  WIN.addEventListener('groups:power', (ev)=>{
    const d = ev.detail||{};
    const cur = Number(d.charge||0);
    const thr = Math.max(1, Number(d.threshold||8));
    if (pCur) pCur.textContent = String(cur|0);
    if (pThr) pThr.textContent = String(thr|0);
    if (pFill) pFill.style.width = Math.round((cur/thr)*100) + '%';
  }, {passive:true});

  let lastGroupKey = '';
  WIN.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};

    // goal
    const gTitle = String(d.goalTitle||'—');
    const gNow = Number(d.goalNow||0);
    const gTot = Math.max(1, Number(d.goalTotal||1));
    const gPct = clamp(d.goalPct ?? (gNow/gTot*100), 0, 100);

    if (goalTitle) goalTitle.textContent = '🎯 GOAL';
    if (goalCount) goalCount.textContent = `${gNow}/${gTot}`;
    if (goalFill) goalFill.style.width = Math.round(gPct) + '%';
    if (goalSub) goalSub.textContent = gTitle;

    // mini
    const mTitle = String(d.miniTitle||'—');
    const mNow = Number(d.miniNow||0);
    const mTot = Math.max(1, Number(d.miniTotal||1));
    const mPct = clamp(d.miniPct ?? (mNow/mTot*100), 0, 100);
    const mLeft = Number(d.miniTimeLeftSec||0);

    if (miniTitle) miniTitle.textContent = '⚡ MINI';
    if (miniFill) miniFill.style.width = Math.round(mPct) + '%';
    if (miniSub) miniSub.textContent = mTitle;
    if (miniTime) miniTime.textContent = (mLeft>0) ? `${mLeft}s` : '—';

    DOC.body.classList.toggle('mini-urgent', (mLeft>0 && mLeft<=3));

    // big banner on group switch
    const gKey = String(d.groupKey||'');
    const gName= String(d.groupName||'');
    if (gKey && gKey !== lastGroupKey){
      lastGroupKey = gKey;
      showBanner('หมู่ตอนนี้: ' + (gName||'—'), 'good', 1200);
    }
  }, {passive:true});

  WIN.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'');
    if (k === 'storm_on') showBanner('🌪️ STORM! เป้าถี่ขึ้น', 'warn', 1400);
    if (k === 'storm_off') showBanner('✨ พายุจบ! เก็บแต้มต่อ', 'good', 1100);
    if (k === 'boss_spawn') showBanner('👊 BOSS มาแล้ว!', 'warn', 1200);
    if (k === 'boss_down') showBanner('💥 BOSS แตก!', 'good', 1100);
    if (k === 'perfect_switch') showBanner('🔄 สลับหมู่!', 'neutral', 1000);
  }, {passive:true});

  // ---------- Summary / flush-hardened hook ----------
  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';
  let lastSummary = null;
  let startIso = new Date().toISOString();

  function saveSummary(sum){
    try{ localStorage.setItem(LS_LAST, JSON.stringify(sum)); }catch{}
    try{
      const hist = JSON.parse(localStorage.getItem(LS_HIST)||'[]');
      hist.unshift(sum);
      localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0, 50)));
    }catch{}
  }

  function buildSummary(detail, endIso){
    const ctx = (WIN.GroupsVR && WIN.GroupsVR.getResearchCtx) ? WIN.GroupsVR.getResearchCtx() : {};
    return Object.assign({
      timestampIso: endIso,
      projectTag: 'HeroHealth',
      gameTag: 'GroupsVR',
      runMode,
      diff,
      style,
      view,
      durationPlannedSec: timeSec,
      startTimeIso: startIso,
      endTimeIso: endIso,
      seed
    }, ctx, (detail||{}));
  }

  // bind flush log if module exists
  try{
    const B = WIN.GroupsVR && WIN.GroupsVR.bindFlushOnLeave;
    B && B(()=>lastSummary);
  }catch(_){}

  // ---------- End overlay ----------
  WIN.addEventListener('hha:end', (ev)=>{
    const d = ev.detail||{};
    const endIso = new Date().toISOString();
    lastSummary = buildSummary(d, endIso);
    saveSummary(lastSummary);

    if (endOverlay) endOverlay.classList.remove('hidden');
    if (endLine) endLine.textContent = 'เหตุผล: ' + String(d.reason || 'end');
    if (endScore) endScore.textContent = String(d.scoreFinal ?? 0);
    if (endRank) endRank.textContent  = String(d.grade ?? 'C');
    if (endAcc)  endAcc.textContent   = String((d.accuracyGoodPct ?? 0) + '%');
    if (endMiss) endMiss.textContent  = String(d.misses ?? 0);

    const hub = String(qs('hub','')||'');
    if (btnHub) btnHub.style.display = hub ? 'inline-flex' : 'none';
  }, {passive:true});

  btnRestart && btnRestart.addEventListener('click', ()=>location.reload());

  btnCopy && btnCopy.addEventListener('click', async ()=>{
    if (!lastSummary){ alert('ยังไม่มีผลให้คัดลอก'); return; }
    const ok = await copyText(JSON.stringify(lastSummary, null, 2));
    alert(ok ? 'คัดลอก JSON แล้ว ✅' : 'Copy ไม่สำเร็จ');
  });

  btnBackLauncher && btnBackLauncher.addEventListener('click', ()=>{
    const hub = String(qs('hub','')||'');
    const u = new URL('../groups-vr.html', location.href);
    if (hub) u.searchParams.set('hub', hub);

    const sp = new URL(location.href).searchParams;
    sp.forEach((v,k)=>{
      if (k==='hub') return;
      u.searchParams.set(k,v);
    });
    location.href = u.toString();
  });

  btnHub && btnHub.addEventListener('click', ()=>{
    const hub = String(qs('hub','')||'');
    if (!hub){ alert('ไม่มีพารามิเตอร์ hub=...'); return; }
    location.href = hub;
  });

  // ---------- PACK 14: Practice chain ----------
  let practiceActive = false;
  let practiceDone = false;

  function startPractice(E, sec){
    practiceActive = true;
    practiceDone = false;

    if (elMode) elMode.textContent = 'PRACTICE';
    showBanner(`PRACTICE ${sec}s`, 'neutral', 900);

    startIso = new Date().toISOString();

    initTelemetry('practice');
    initViewHelper();

    E.setLayerEl(getLayerEl());
    E.start(diff, { runMode:'practice', diff, style, time: sec, seed: seed + '-practice', view });

    // try immersive for cVR if helper exists
    try{
      const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
      H && H.tryImmersiveForCVR && H.tryImmersiveForCVR();
    }catch(_){}
  }

  function startReal(E){
    if (elMode) elMode.textContent = (runMode==='research') ? 'RESEARCH' : 'PLAY';
    showBanner((runMode==='research') ? 'RESEARCH' : 'GO!', (runMode==='research')?'violet':'good', 900);

    startIso = new Date().toISOString();

    initTelemetry(runMode==='research' ? 'research' : 'play');
    initViewHelper();

    E.setLayerEl(getLayerEl());
    E.start(diff, { runMode, diff, style, time: timeSec, seed, view });

    // AI attach point (PACK 15)
    try{
      const AI = WIN.GroupsVR && WIN.GroupsVR.AIHooks;
      if (AI && AI.attach){
        AI.attach({ runMode, seed, enabled: aiEnabled() });
      }
    }catch(_){}
  }

  // auto start real run after practice ends
  WIN.addEventListener('hha:end', (ev)=>{
    const d = ev.detail||{};
    if (!practiceActive || practiceDone) return;
    if (String(d.reason||'') !== 'practice') return;

    practiceDone = true;
    practiceActive = false;

    waitForEngine((E)=> setTimeout(()=> startReal(E), 180));
  }, {passive:true});

  // ---------- gates chain ----------
  function startAfterGates(E){
    // research/practice: no practice chain (start directly)
    if (runMode === 'research'){
      coachSay('โหมดวิจัย: ล็อกเงื่อนไข + ปิด AI/Telemetry ✅', 'neutral');
      startReal(E);
      return;
    }
    if (runMode === 'practice'){
      const sec = Math.min(30, timeSec);
      coachSay('โหมดฝึก: เริ่มฝึกทันที ✅', 'neutral');
      startPractice(E, sec);
      return;
    }

    // play: if cVR and practiceSec>0
    const p = getPracticeSec();
    if (view === 'cvr' && p > 0){
      coachSay(`Cardboard: ฝึก ${p} วิ แล้วเข้าเกมจริงอัตโนมัติ 🎯`, 'neutral');
      startPractice(E, p);
      return;
    }

    coachSay('เริ่มเกม! เล็งให้ตรงหมู่ 🎯', 'neutral');
    startReal(E);
  }

  // ---------- boot ----------
  (function boot(){
    // initial HUD
    if (elTime) elTime.textContent = String(timeSec);
    if (elMode) elMode.textContent = (runMode==='research') ? 'RESEARCH' : (runMode==='practice' ? 'PRACTICE' : 'PLAY');

    // hint text
    if (view === 'cvr') coachSay('โหมด Cardboard: กด ENTER VR แล้วเล็งด้วย crosshair 🎯', 'neutral');
    else coachSay('แตะ/คลิกเป้าให้ถูกหมู่ แล้วคุมคอมโบให้ดี! 🔥', 'neutral');

    const gated = startCalibrationIfNeeded();
    if (gated) return;

    waitForEngine((E)=> startAfterGates(E));
  })();

})();