// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { attachTouchLook } from './touch-look-goodjunk.js';
import { initCloudLogger } from '../vr/hha-cloud-logger.js';

import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

(function () {
  'use strict';

  // bfcache fix
  window.addEventListener('pageshow', (e)=>{
    if (e.persisted) window.location.reload();
  });

  const $ = (id)=>document.getElementById(id);
  const safeText = (el, txt)=>{ try{ if (el) el.textContent = (txt ?? ''); }catch(_){} };
  const safeStyleWidth = (el, w)=>{ try{ if (el) el.style.width = w; }catch(_){} };
  const clamp = (v,min,max)=>{ v=Number(v)||0; if(v<min) return min; if(v>max) return max; return v; };

  // HUD elements
  const elScore = $('hud-score');
  const elCombo = $('hud-combo');
  const elMiss  = $('hud-miss');
  const elDiff  = $('hud-diff-label');
  const elChal  = $('hud-challenge-label');
  const elTime  = $('hud-time-label');
  const elJudge = $('hud-judge');

  const elRunLabel = $('hud-run-label');
  const elPill = $('hud-pill');
  const startSub = $('start-sub');

  const elQuestMain = $('hud-quest-main');
  const elQuestMini = $('hud-quest-mini');
  const elQuestMainBar = $('hud-quest-main-bar');
  const elQuestMiniBar = $('hud-quest-mini-bar');
  const elQuestMainCap = $('hud-quest-main-caption');
  const elQuestMiniCap = $('hud-quest-mini-caption');
  const elQuestHint = $('hud-quest-hint');
  const elMiniCount = $('hud-mini-count');

  const elCoachBubble = $('coach-bubble');
  const elCoachText   = $('coach-text');
  const elCoachEmoji  = $('coach-emoji');

  const elTouchHint = $('touch-hint');
  const btnVR      = $('btn-vr');
  const elCountdown = $('start-countdown');

  const startOverlay = $('start-overlay');
  const btnStart2D = $('btn-start-2d');
  const btnStartVR = $('btn-start-vr');
  const selDiff = $('sel-diff');
  const selChallenge = $('sel-challenge');

  const logDot  = $('logdot');
  const logText = $('logtext');

  // Fever/Shield (HTML นี้มีอยู่แล้ว)
  const elFeverFill  = $('fever-fill');
  const elFeverPct   = $('fever-pct');
  const elShieldCount= $('shield-count');

  // URL params from hub
  const pageUrl = new window.URL(window.location.href);
  const URL_RUN = (pageUrl.searchParams.get('run') || 'play').toLowerCase();                 // play | research
  const URL_DIFF = (pageUrl.searchParams.get('diff') || 'normal').toLowerCase();            // easy | normal | hard
  const URL_CH = (pageUrl.searchParams.get('ch') || pageUrl.searchParams.get('challenge') || 'rush').toLowerCase(); // rush|boss|survival
  const URL_TIME_RAW = parseInt(pageUrl.searchParams.get('time') || '', 10);

  const DEFAULT_TIME = { easy:80, normal:60, hard:50 };
  function normDiff(v){ v=String(v||'normal').toLowerCase(); return (v==='easy'||v==='hard'||v==='normal') ? v : 'normal'; }
  function normCh(v){ v=String(v||'rush').toLowerCase(); return (v==='rush'||v==='boss'||v==='survival') ? v : 'rush'; }
  function normRun(v){ v=String(v||'play').toLowerCase(); return (v==='research') ? 'research' : 'play'; }

  const RUN_MODE = normRun(URL_RUN);
  const DIFF_INIT = normDiff(URL_DIFF);
  const CH_INIT = normCh(URL_CH);
  const DUR_INIT = clamp(
    (Number.isFinite(URL_TIME_RAW) ? URL_TIME_RAW : (DEFAULT_TIME[DIFF_INIT] || 60)),
    20, 180
  );

  // ✅ Coach images (HTML root: /herohealth/ → ใช้ ./img/...)
  const COACH_IMG = {
    neutral: './img/coach-neutral.png',
    happy:   './img/coach-happy.png',
    sad:     './img/coach-sad.png',
    fever:   './img/coach-fever.png'
  };

  let lastCoachTimeout = null;
  function setCoachFace(mood){
    const m = COACH_IMG[mood] ? mood : 'neutral';
    if (elCoachEmoji) elCoachEmoji.style.backgroundImage = `url('${COACH_IMG[m]}')`;
  }
  function setCoach(text, mood='neutral'){
    if (elCoachBubble) elCoachBubble.classList.add('show');
    safeText(elCoachText, text || '');
    setCoachFace(mood);
    if (lastCoachTimeout) clearTimeout(lastCoachTimeout);
    lastCoachTimeout = setTimeout(()=> elCoachBubble && elCoachBubble.classList.remove('show'), 4200);
  }

  // ---------- FX helper ----------
  function getParticles(){
    return (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
  }

  // fallback FX (ถ้า particles.js ไม่ขึ้น/ไม่มีฟังก์ชัน)
  function ensureFallbackFxStyle(){
    if (document.getElementById('hha-fx-fallback-style')) return;
    const st = document.createElement('style');
    st.id = 'hha-fx-fallback-style';
    st.textContent = `
      .hha-pop{
        position:fixed; z-index:9999; pointer-events:none;
        font-weight:950; font-size:14px; letter-spacing:.06em;
        text-shadow:0 10px 24px rgba(0,0,0,.65);
        transform:translate(-50%,-50%);
        animation:hha-pop 650ms ease-out forwards;
      }
      @keyframes hha-pop{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.85); }
        15%{ opacity:1; transform:translate(-50%,-60%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-120%) scale(.95); }
      }
      .hha-shard{
        position:fixed; z-index:9998; pointer-events:none;
        width:8px; height:8px; border-radius:3px;
        transform:translate(-50%,-50%);
        opacity:.95;
        animation:hha-shard 520ms ease-out forwards;
      }
      @keyframes hha-shard{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.7); }
        10%{ opacity:1; }
        100%{ opacity:0; transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.6); }
      }
    `;
    document.head.appendChild(st);
  }

  function fxBurst(detail, good=true, count=14){
    const P = getParticles();
    const x = (detail && typeof detail.x === 'number') ? detail.x : (window.innerWidth * 0.5);
    const y = (detail && typeof detail.y === 'number') ? detail.y : (window.innerHeight * 0.55);

    if (P && P.burstAt){
      try{ P.burstAt(x, y, { count, good: !!good }); return; }catch(_){}
    }

    // fallback
    ensureFallbackFxStyle();
    for (let i=0;i<count;i++){
      const s = document.createElement('div');
      s.className = 'hha-shard';
      const ang = Math.random()*Math.PI*2;
      const r = 20 + Math.random()*46;
      const dx = Math.cos(ang)*r;
      const dy = Math.sin(ang)*r;
      s.style.left = x+'px';
      s.style.top  = y+'px';
      s.style.setProperty('--dx', dx+'px');
      s.style.setProperty('--dy', dy+'px');
      s.style.background = good ? 'rgba(34,197,94,.95)' : 'rgba(249,115,22,.95)';
      document.body.appendChild(s);
      setTimeout(()=>{ try{s.remove();}catch(_){ } }, 620);
    }
  }

  function fxPop(detail, label){
    const P = getParticles();
    const x = (detail && typeof detail.x === 'number') ? detail.x : (window.innerWidth * 0.5);
    const y = (detail && typeof detail.y === 'number') ? detail.y : (window.innerHeight * 0.55);

    if (P && P.scorePop){
      try{ P.scorePop(x, y, '', String(label||''), { plain:true }); return; }catch(_){}
    }

    // fallback
    ensureFallbackFxStyle();
    const el = document.createElement('div');
    el.className = 'hha-pop';
    el.style.left = x+'px';
    el.style.top  = y+'px';
    el.style.color = String(label||'').toUpperCase().includes('JUNK') ? '#fb923c' : '#86efac';
    el.textContent = String(label||'');
    document.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
  }

  function fxCelebrate(kind){
    const P = getParticles();
    if (P && P.celebrate){
      try{
        P.celebrate(kind, {
          title: kind === 'goal' ? '🎉 GOAL CLEARED!' : '✨ MINI CLEARED!',
          sub: 'ไปต่อเลย! 🌟'
        });
        return;
      }catch(_){}
    }
    // fallback: pop ใหญ่กลางจอ
    fxPop({ x: window.innerWidth*0.5, y: window.innerHeight*0.35 }, kind === 'goal' ? 'GOAL CLEAR!' : 'MINI CLEAR!');
    fxBurst({ x: window.innerWidth*0.5, y: window.innerHeight*0.35 }, true, 22);
  }

  function runCountdown(onDone){
    if (!elCountdown){ onDone && onDone(); return; }
    const steps = ['3','2','1','Go!'];
    let idx = 0;
    elCountdown.classList.remove('countdown-hidden');
    safeText(elCountdown, steps[0]);
    const t = setInterval(()=>{
      idx++;
      if (idx >= steps.length){
        clearInterval(t);
        elCountdown.classList.add('countdown-hidden');
        onDone && onDone();
      }else{
        safeText(elCountdown, steps[idx]);
      }
    }, 650);
  }

  function waitSceneReady(cb){
    const scene = document.querySelector('a-scene');
    if (!scene) { cb(); return; }
    const tryReady = ()=>{
      if (scene.hasLoaded && scene.camera){ cb(); return true; }
      return false;
    };
    if (tryReady()) return;
    scene.addEventListener('loaded', ()=>{
      let tries=0;
      const it = setInterval(()=>{
        tries++;
        if (tryReady() || tries>80){ clearInterval(it); cb(); }
      }, 50);
    }, { once:true });
  }

  async function tryEnterVR(){
    const scene = document.querySelector('a-scene');
    if (!scene) return false;
    try{ await scene.enterVR(); return true; }
    catch(err){ console.warn('[GoodJunkVR] enterVR blocked:', err); return false; }
  }

  function initVRButton(){
    if (!btnVR) return;
    const scene = document.querySelector('a-scene');
    if (!scene) return;
    btnVR.addEventListener('click', async ()=>{
      try{ await scene.enterVR(); }
      catch(err){ console.warn('[GoodJunkVR] enterVR error:', err); }
    });
  }

  // ✅ FIX สำคัญ: ผูก touch-look กับ #gj-layer (เลเยอร์เป้าทับเต็มจอ)
  function fallbackTouchLook(cameraEl, areaEl, sensitivity=0.0032){
    if (!cameraEl || !cameraEl.object3D || !areaEl) return;
    let down = false;
    let lastX=0, lastY=0;

    const rot = cameraEl.object3D.rotation;

    function onDown(ev){
      // ถ้าแตะบน HUD/ปุ่ม ไม่ต้องหมุน
      const t = ev.target;
      if (t && (t.closest?.('.hud-card') || t.closest?.('#start-overlay') || t.closest?.('.vr-btn'))) return;

      down = true;
      lastX = (ev.clientX ?? ev.touches?.[0]?.clientX ?? 0);
      lastY = (ev.clientY ?? ev.touches?.[0]?.clientY ?? 0);
      try{ areaEl.setPointerCapture?.(ev.pointerId); }catch(_){}
      ev.preventDefault?.();
    }

    function onMove(ev){
      if (!down) return;
      const x = (ev.clientX ?? ev.touches?.[0]?.clientX ?? lastX);
      const y = (ev.clientY ?? ev.touches?.[0]?.clientY ?? lastY);
      const dx = x - lastX;
      const dy = y - lastY;
      lastX = x; lastY = y;

      rot.y -= dx * sensitivity;              // yaw
      rot.x -= dy * (sensitivity * 0.85);     // pitch
      rot.x = clamp(rot.x, -1.2, 1.2);

      elTouchHint && elTouchHint.classList.add('show');
      clearTimeout(fallbackTouchLook._t);
      fallbackTouchLook._t = setTimeout(()=> elTouchHint && elTouchHint.classList.remove('show'), 900);

      ev.preventDefault?.();
    }

    function onUp(){
      down = false;
    }

    areaEl.style.touchAction = 'none';
    areaEl.addEventListener('pointerdown', onDown, { passive:false });
    areaEl.addEventListener('pointermove', onMove, { passive:false });
    window.addEventListener('pointerup', onUp, { passive:true });

    areaEl.addEventListener('touchstart', onDown, { passive:false });
    areaEl.addEventListener('touchmove', onMove, { passive:false });
    window.addEventListener('touchend', onUp, { passive:true });
  }

  function attachTouch(cameraEl){
    if (!cameraEl) return;
    const layer = document.getElementById('gj-layer') || document.body;

    // ให้ drag จับที่เลเยอร์เป้าชัวร์ ๆ
    try{ layer.style.touchAction = 'none'; }catch(_){}

    // ถ้ามี attachTouchLook ให้ใช้ แต่เปลี่ยน areaEl จาก body → layer
    try{
      if (typeof attachTouchLook === 'function'){
        attachTouchLook(cameraEl, {
          sensitivity: 0.30,
          areaEl: layer,
          onActiveChange(active){
            if (active){
              elTouchHint && elTouchHint.classList.add('show');
              setTimeout(()=> elTouchHint && elTouchHint.classList.remove('show'), 1800);
            }
          }
        });
        return;
      }
    }catch(_){}

    // fallback แน่นอน
    fallbackTouchLook(cameraEl, layer, 0.0033);
  }

  // Logger badge
  const loggerState = { pending:true, ok:false, message:'' };
  function setLogBadge(state, text){
    if (!logDot || !logText) return;
    logDot.classList.remove('ok','bad');
    if (state === 'ok') logDot.classList.add('ok');
    else if (state === 'bad') logDot.classList.add('bad');
    safeText(logText, text || (state==='ok' ? 'logger: ok' : state==='bad' ? 'logger: error' : 'logger: pending…'));
  }
  window.addEventListener('hha:logger', (e)=>{
    const d = e.detail || {};
    loggerState.pending = false;
    loggerState.ok = !!d.ok;
    loggerState.message = d.msg || '';
    setLogBadge(d.ok ? 'ok' : 'bad', d.msg || '');
  });

  // ✅ บังคับอัปเดต Fever/Shield บน HUD (ไม่พึ่ง ui-fever.js)
  window.addEventListener('hha:fever', (e)=>{
    const d = e.detail || {};
    const f = clamp(d.fever ?? 0, 0, 100);
    const sh = clamp(d.shield ?? 0, 0, 99);
    if (elFeverFill) elFeverFill.style.width = f + '%';
    if (elFeverPct) safeText(elFeverPct, f + '%');
    if (elShieldCount) safeText(elShieldCount, String(sh));
  });

  function getProfile(){
    let studentProfile = null;
    let studentKey = null;
    try{
      const raw = sessionStorage.getItem('HHA_STUDENT_PROFILE');
      if (raw){
        studentProfile = JSON.parse(raw);
        studentKey = studentProfile.studentKey || null;
      }
    }catch(_){}
    return { studentProfile, studentKey };
  }
  function hasProfile(p){
    if (!p || typeof p !== 'object') return false;
    return !!(p.studentId || p.name || p.nickName || p.studentNo);
  }

  // Quest state shared with QuestDirector
  const qState = {
    score:0, goodHits:0, miss:0, comboMax:0, timeLeft:0,

    // ✅ สำคัญสำหรับ mini
    streakGood:0,
    goldHitsThisMini:false,
    blocks:0,
    usedMagnet:false,
    timePlus:0,
    safeNoJunkSeconds:0,
    bossCleared:false,
    challenge: CH_INIT,
    runMode: RUN_MODE,
    final8Good: 0
  };

  // mini reset
  window.addEventListener('quest:miniStart', ()=>{
    qState.goldHitsThisMini = false;
    qState.usedMagnet = false;
    qState.timePlus = 0;
    qState.blocks = 0;
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    qState.final8Good = 0; // reset เฉพาะ mini (ถ้าอยากให้สะสมทั้งเกม เอาบรรทัดนี้ออก)
  });

  // safeNoJunkSeconds tick (นับเฉพาะ "ไม่โดน junk" ตามที่นิยามไว้)
  let started = false;
  setInterval(()=>{
    if (!started) return;
    qState.safeNoJunkSeconds = (qState.safeNoJunkSeconds|0) + 1;
  }, 1000);

  let Q = null;

  // --------- เอฟเฟกต์: ฟัง event แล้วยิง FX + ✅ซิงก์ค่าสำหรับ mini ---------
  window.addEventListener('quest:goodHit', (e)=>{
    const d = e.detail || {};
    const judgment = String(d.judgment||'').toLowerCase();
    const kind = String(d.kind||'good').toLowerCase();

    const isPerfect = judgment.includes('perfect');
    fxBurst(d, true, isPerfect ? 18 : 14);
    fxPop(d, isPerfect ? 'PERFECT!' : (kind==='gold' ? 'GOLD!' : 'GOOD!'));

    // ✅ streakGood นับเฉพาะของดี (รวม GOLD) / ถ้าอยากให้ power ไม่นับ streak ก็ไม่เพิ่ม
    if (kind === 'good' || kind === 'gold'){
      qState.streakGood = (qState.streakGood|0) + 1;
      if ((qState.timeLeft|0) <= 8) qState.final8Good = (qState.final8Good|0) + 1;
    }

    if (kind === 'gold') qState.goldHitsThisMini = true;

    if (Q){
      Q.onEvent(isPerfect ? 'perfectHit' : 'goodHit', qState);
    }
  });

  window.addEventListener('quest:badHit', (e)=>{
    const d = e.detail || {};
    fxBurst(d, false, 14);
    fxPop(d, 'JUNK!');

    // ✅ mini rules
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;

    if (Q) Q.onEvent('junkHit', qState);
  });

  window.addEventListener('quest:block', (e)=>{
    const d = e.detail || {};
    qState.blocks = (qState.blocks|0) + 1;
    fxBurst(d, true, 10);
    fxPop(d, 'BLOCK!');
    if (Q) Q.onEvent('shieldBlock', qState);
  });

  window.addEventListener('quest:power', (e)=>{
    const d = e.detail || {};
    const p = String(d.power||'');
    if (p === 'magnet') qState.usedMagnet = true;
    if (p === 'time')   qState.timePlus = (qState.timePlus|0) + 1;

    fxBurst(d, true, 12);
    fxPop(d, (p||'POWER').toUpperCase() + '!');

    if (Q) Q.onEvent('power', qState);
  });

  window.addEventListener('quest:bossClear', ()=>{
    qState.bossCleared = true;
    fxPop({ x: window.innerWidth*0.5, y: window.innerHeight*0.35 }, 'BOSS CLEAR!');
    fxBurst({ x: window.innerWidth*0.5, y: window.innerHeight*0.35 }, true, 22);
    if (Q) Q.onEvent('bossClear', qState);
  });

  window.addEventListener('quest:cleared', (e)=>{
    const d = e.detail || {};
    const kind = String(d.kind||'').toLowerCase();
    if (kind.includes('goal')) fxCelebrate('goal');
    else fxCelebrate('mini');
    setCoach('เยี่ยม! ผ่านภารกิจแล้ว ไปต่อเลย! 🌟', 'happy');
  });

  // HUD listeners
  window.addEventListener('hha:judge', (e)=>{
    const label = String((e.detail||{}).label || '').trim();
    safeText(elJudge, label || '\u00A0');

    // ✅ ถ้าเป็น MISS ให้รีเซ็ต streak (เพราะ good หมดอายุจะยิง MISS)
    if (label.toUpperCase().includes('MISS')){
      qState.streakGood = 0;
    }
  });

  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail||{}).sec;
    if (typeof sec === 'number' && sec >= 0){
      safeText(elTime, sec + 's');
      qState.timeLeft = sec|0;

      if (Q) Q.tick(qState);
    }
  });

  window.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    if (typeof d.score === 'number'){ qState.score = d.score|0; safeText(elScore, String(qState.score)); }
    if (typeof d.goodHits === 'number'){ qState.goodHits = d.goodHits|0; }
    if (typeof d.misses === 'number'){ qState.miss = d.misses|0; safeText(elMiss, String(qState.miss)); }
    if (typeof d.comboMax === 'number'){ qState.comboMax = d.comboMax|0; safeText(elCombo, String(qState.comboMax)); }
    if (typeof d.challenge === 'string'){ qState.challenge = normCh(d.challenge); }
    if (Q) Q.tick(qState);
  });

  // quest:update (schema ใหม่)
  window.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    const goal = d.goal || null;
    const mini = d.mini || null;
    const meta = d.meta || {};

    // goal
    if (goal){
      const cur = (goal.cur|0);
      const max = (goal.max|0);
      const pct = Math.max(0, Math.min(1, Number(goal.pct ?? (max>0?cur/max:0))));
      safeText(elQuestMain, goal.title || 'ภารกิจหลัก');
      safeStyleWidth(elQuestMainBar, Math.round(pct*100) + '%');
      safeText(elQuestMainCap, `${cur} / ${max}`);
    } else {
      safeText(elQuestMain, 'ภารกิจหลัก (ครบ) ✅');
      safeStyleWidth(elQuestMainBar, '100%');
      safeText(elQuestMainCap, '');
    }

    // mini
    if (mini){
      const cur = (mini.cur|0);
      const max = (mini.max|0);
      const pct = Math.max(0, Math.min(1, Number(mini.pct ?? (max>0?cur/max:0))));
      safeText(elQuestMini, 'Mini: ' + (mini.title || ''));
      safeStyleWidth(elQuestMiniBar, Math.round(pct*100) + '%');
      safeText(elQuestMiniCap, `${cur} / ${max}`);
    } else {
      safeText(elQuestMini, 'Mini quest (ครบ) ✅');
      safeStyleWidth(elQuestMiniBar, '100%');
      safeText(elQuestMiniCap, '');
    }

    // hint
    let hint = '';
    if (goal && String(goal.state||'').toLowerCase().includes('clear')) hint = 'GOAL CLEAR! 🎉';
    else if (mini && String(mini.state||'').toLowerCase().includes('clear')) hint = 'MINI CLEAR! ✨';
    else if (goal && Number(goal.pct||0) >= 0.8) hint = 'ใกล้แล้ว! 🔥';
    else if (mini && Number(mini.pct||0) >= 0.8) hint = 'อีกนิดเดียว! ⚡';
    safeText(elQuestHint, hint);

    const miniCount = (meta.miniCount|0);
    const minisCleared = (Q && Q.getState) ? (Q.getState().minisCleared|0) : 0;
    safeText(elMiniCount, `mini ผ่าน ${minisCleared} • เล่นอยู่ ${miniCount+1}`);
  });

  function applyRunPill(){
    const runTxt = RUN_MODE.toUpperCase();
    safeText(elRunLabel, runTxt);
    if (elPill) elPill.classList.toggle('research', RUN_MODE === 'research');

    if (startSub){
      safeText(startSub, (RUN_MODE === 'research')
        ? 'โหมดวิจัย: ต้องมี Student ID หรือชื่อเล่นจาก Hub แล้วค่อยกดเริ่ม ✅'
        : 'ลากนิ้วเพื่อหมุนมุมมอง (เหมือน VR) แล้วแตะเป้าให้ทัน! ✅'
      );
    }
  }

  function prefillFromHub(){
    try{ selDiff.value = DIFF_INIT; }catch(_){}
    try{ selChallenge.value = CH_INIT; }catch(_){}

    applyRunPill();

    safeText(elDiff, DIFF_INIT.toUpperCase());
    safeText(elChal, CH_INIT.toUpperCase());
    safeText(elTime, DUR_INIT + 's');

    setCoachFace('neutral');

    const endpoint = sessionStorage.getItem('HHA_LOG_ENDPOINT');
    if (endpoint) setLogBadge(null, 'logger: endpoint set ✓');
    else setLogBadge(null, 'logger: endpoint missing (hub?)');
  }

  async function bootOnce({ wantVR }){
    if (started) return;

    // research gate
    if (RUN_MODE === 'research'){
      const { studentProfile } = getProfile();
      if (!hasProfile(studentProfile)){
        alert('โหมดวิจัย: กรุณากรอก "รหัสนักเรียน" หรือ "ชื่อเล่น" ที่ Hub ก่อน แล้วกลับมาเริ่มใหม่');
        window.location.href = './hub.html';
        return;
      }
    }

    started = true;
    if (startOverlay) startOverlay.style.display = 'none';

    const diff = normDiff(selDiff?.value || DIFF_INIT);
    const chal = normCh(selChallenge?.value || CH_INIT);
    const durationSec = clamp(DUR_INIT, 20, 180);

    qState.challenge = chal;
    qState.runMode = RUN_MODE;

    safeText(elDiff, diff.toUpperCase());
    safeText(elChal, chal.toUpperCase());
    safeText(elTime, durationSec + 's');

    safeText(elScore, '0');
    safeText(elCombo, '0');
    safeText(elMiss,  '0');
    safeText(elJudge, '\u00A0');

    setCoach('ลากนิ้วเพื่อหมุนมุมมอง แล้วแตะของดี! หลบ junk! ⚡', 'neutral');

    // profile from hub
    const { studentProfile, studentKey } = getProfile();

    // logger endpoint + fallback
    const endpoint =
      sessionStorage.getItem('HHA_LOG_ENDPOINT') ||
      'https://script.google.com/macros/s/AKfycby7IBVmpmEydNDp5BR3CMaSAjvF7ljptaDwvow_L781iDLsbtpuiFmKviGUnugFerDtQg/exec';

    loggerState.pending = true;
    loggerState.ok = false;
    loggerState.message = '';
    setLogBadge(null, 'logger: init…');

    initCloudLogger({
      endpoint,
      projectTag: 'HeroHealth-GoodJunkVR',
      mode: 'GoodJunkVR',
      runMode: RUN_MODE,
      diff,
      challenge: chal,
      durationPlannedSec: durationSec,
      studentKey,
      profile: studentProfile,
      debug: true
    });

    // ✅ touch + VR button
    const cam = document.querySelector('#gj-camera');
    attachTouch(cam);
    initVRButton();

    // QuestDirector
    Q = makeQuestDirector({
      diff,
      goalDefs: GOODJUNK_GOALS,
      miniDefs: GOODJUNK_MINIS,
      maxGoals: 2,
      maxMini: 999,
      challenge: chal
    });
    Q.start(qState);

    runCountdown(()=>{
      waitSceneReady(async ()=>{
        try{
          if (wantVR) await tryEnterVR();

          const ENGINE = goodjunkBoot({
            diff,
            run: RUN_MODE,
            challenge: chal,
            time: durationSec,
            layerEl: document.getElementById('gj-layer')
          });

          if (!ENGINE) throw new Error('ENGINE is null (goodjunkBoot failed)');
          window.__GJ_ENGINE__ = ENGINE;

          // ปลุก HUD
          try{ Q && Q.tick && Q.tick(qState); }catch(_){}
        }catch(err){
          console.error('[GoodJunkVR] boot failed:', err);
          alert('กด Start แล้วเข้าเกมไม่สำเร็จ\nดู Console: error บรรทัดแรก');
        }
      });
    });
  }

  btnStart2D && btnStart2D.addEventListener('click', ()=> bootOnce({ wantVR:false }));
  btnStartVR && btnStartVR.addEventListener('click', ()=> bootOnce({ wantVR:true }));

  prefillFromHub();
})();
