// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder + Layout Fix (PRODUCTION)
// ✅ Ensures layers cover full screen + correct z-index (anti "target bottom-right" + anti "blink")
// ✅ Hides A-Frame default EnterVR button (use our UI buttons)
// ✅ Binds HHA events: hha:score, quest:update, hha:coach, hha:judge, hha:end
// ✅ Judge toast + tiny HUD animations
// ✅ Mobile viewport fix (--vh)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const $ = (id) => doc.getElementById(id);

  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  // ---------- Viewport height fix (mobile) ----------
  function setVh(){
    try{
      const vh = (root.innerHeight || 720) * 0.01;
      doc.documentElement.style.setProperty('--vh', `${vh}px`);
    }catch(e){}
  }

  // ---------- Layer + z-index hardening (fallback) ----------
  function hardenLayers(){
    const scene = $('scene') || doc.querySelector('a-scene');
    const layer = $('plate-layer');
    const hitFx = $('hitFx');
    const hudTop = $('hudTop');
    const miniPanel = $('miniPanel');
    const coachPanel = $('coachPanel');
    const hudBtns = $('hudBtns');
    const startOverlay = $('startOverlay');
    const resultBackdrop = $('resultBackdrop');
    const hudPaused = $('hudPaused');

    // Ensure scene stays behind DOM
    if(scene && scene.style){
      scene.style.position = 'fixed';
      scene.style.inset = '0';
      scene.style.zIndex = '1';
    }

    // Ensure plate layer covers full screen & is click-ready
    if(layer && layer.style){
      layer.style.position = 'fixed';
      layer.style.inset = '0';
      layer.style.zIndex = '20';
      layer.style.pointerEvents = 'auto';
      layer.style.touchAction = 'none';
      layer.style.overflow = 'hidden';
      layer.style.transform = layer.style.transform || 'translate(0,0)';
      layer.style.willChange = 'transform';
    }

    // Hit FX between targets and HUD
    if(hitFx && hitFx.style){
      hitFx.style.position = 'fixed';
      hitFx.style.inset = '0';
      hitFx.style.zIndex = '25';
      hitFx.style.pointerEvents = 'none';
      hitFx.style.opacity = hitFx.style.opacity || '0';
      hitFx.style.transition = 'opacity .12s ease';
    }

    // HUD on top
    const huds = [hudTop, miniPanel, coachPanel, hudBtns].filter(Boolean);
    huds.forEach((el)=>{
      if(!el.style) return;
      el.style.position = el.style.position || 'fixed';
      el.style.zIndex = '40';
      el.style.pointerEvents = 'auto';
    });

    if(hudPaused && hudPaused.style){
      hudPaused.style.zIndex = '60';
      hudPaused.style.pointerEvents = 'auto';
    }
    if(startOverlay && startOverlay.style){
      startOverlay.style.zIndex = '65';
      startOverlay.style.pointerEvents = 'auto';
    }
    if(resultBackdrop && resultBackdrop.style){
      resultBackdrop.style.zIndex = '70';
      resultBackdrop.style.pointerEvents = 'auto';
    }
  }

  // ---------- Hide A-Frame default EnterVR UI ----------
  function hideAframeEnterVr(){
    try{
      const scene = doc.querySelector('a-scene');
      // disable built-in UI (we use our own buttons)
      if(scene && scene.setAttribute){
        scene.setAttribute('vr-mode-ui', 'enabled: false');
      }

      // hide any injected button containers if still appear
      const kill = () => {
        const btns = doc.querySelectorAll('.a-enter-vr, .a-enter-vr-button, .a-enter-ar');
        btns.forEach((b)=>{ b.style.display = 'none'; b.style.opacity='0'; b.style.pointerEvents='none'; });
      };
      kill();
      setTimeout(kill, 250);
      setTimeout(kill, 900);
    }catch(e){}
  }

  // ---------- Mini toast for judge ----------
  let toastEl = null;
  function ensureToast(){
    if(toastEl) return toastEl;
    toastEl = doc.createElement('div');
    toastEl.className = 'plate-judge-toast';
    toastEl.style.cssText = `
      position:fixed;
      left:50%;
      bottom:calc(88px + env(safe-area-inset-bottom, 0px));
      transform:translateX(-50%) translateY(8px);
      z-index:80;
      padding:10px 12px;
      border-radius:999px;
      font: 1000 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans Thai",sans-serif;
      background:rgba(2,6,23,.82);
      border:1px solid rgba(148,163,184,.18);
      color:rgba(229,231,235,.96);
      box-shadow:0 22px 70px rgba(0,0,0,.45);
      backdrop-filter: blur(10px);
      opacity:0;
      pointer-events:none;
      transition: opacity .14s ease, transform .14s ease;
      white-space:nowrap;
      max-width:min(92vw, 760px);
      overflow:hidden;
      text-overflow:ellipsis;
    `;
    doc.body.appendChild(toastEl);
    return toastEl;
  }

  function toast(text, kind){
    const el = ensureToast();
    el.textContent = String(text || '');
    const k = (kind || 'info').toLowerCase();

    // tint by kind (no fixed palette, just subtle)
    el.style.borderColor =
      (k === 'good') ? 'rgba(34,197,94,.28)' :
      (k === 'warn') ? 'rgba(250,204,21,.28)' :
      (k === 'bad')  ? 'rgba(239,68,68,.26)' :
      'rgba(148,163,184,.18)';

    el.style.background =
      (k === 'good') ? 'rgba(34,197,94,.10)' :
      (k === 'warn') ? 'rgba(250,204,21,.10)' :
      (k === 'bad')  ? 'rgba(239,68,68,.10)' :
      'rgba(2,6,23,.82)';

    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0px)';
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>{
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(8px)';
    }, 900);
  }

  // ---------- Grade class helper ----------
  function gradeClass(g){
    g = String(g||'C').toUpperCase();
    if(g === 'SSS' || g === 'SS' || g === 'S') return 'good';
    if(g === 'A' || g === 'B') return 'warn';
    return 'bad';
  }
  function setGradeChip(grade){
    const chip = doc.querySelector('.gradeChip') || $('uiGrade')?.closest?.('.hudStat');
    const elGrade = $('uiGrade');
    if(elGrade) elGrade.textContent = String(grade||'C').toUpperCase();

    if(chip){
      chip.classList.remove('good','warn','bad');
      chip.classList.add(gradeClass(grade));
    }
  }

  // ---------- Quest bar helpers (safe) ----------
  function setBar(idFill, pct){
    const el = $(idFill);
    if(el) el.style.width = `${clamp(pct,0,100)}%`;
  }

  // ---------- Event handlers ----------
  function onScore(e){
    const d = (e && e.detail) ? e.detail : null;
    if(!d) return;

    // Make sure grade chip looks alive even if game script already set texts
    setGradeChip(d.grade);

    // Fever fill hardening
    const ff = $('uiFeverFill');
    if(ff && isFinite(d.fever)) ff.style.width = `${clamp(d.fever,0,100)}%`;

    // Shield number
    if($('uiShieldN') && isFinite(d.shield)) $('uiShieldN').textContent = String(d.shield);

    // Time
    if($('uiTime') && isFinite(d.timeLeftSec)) $('uiTime').textContent = String(Math.ceil(d.timeLeftSec));
  }

  function onQuest(e){
    const d = (e && e.detail) ? e.detail : null;
    if(!d) return;

    // Goal
    if(d.goal){
      const cur = Number(d.goal.cur)||0;
      const tar = Number(d.goal.target)||0;
      $('uiGoalTitle') && ($('uiGoalTitle').textContent = d.goal.title || '—');
      $('uiGoalCount') && ($('uiGoalCount').textContent = `${cur}/${tar}`);
      setBar('uiGoalFill', (tar>0) ? (cur/tar*100) : 0);
    }

    // Mini
    if(d.mini){
      const tl = d.mini.timeLeft;
      $('uiMiniTitle') && ($('uiMiniTitle').textContent = d.mini.title || '—');
      $('uiMiniTime')  && ($('uiMiniTime').textContent = (tl==null) ? '--' : `${Math.ceil(tl)}s`);

      const tar = Number(d.mini.target)||0;
      const cur = (tl==null || tar<=0) ? 0 : (tar - Number(tl));
      setBar('uiMiniFill', (tar>0) ? (cur/tar*100) : 0);
    }
  }

  function onCoach(e){
    const d = (e && e.detail) ? e.detail : null;
    if(!d) return;

    // Text
    if($('coachMsg') && d.msg) $('coachMsg').textContent = String(d.msg);

    // Mood image (plate.safe.js already changes; we keep as backup)
    const img = $('coachImg');
    if(img){
      const mood = String(d.mood || 'neutral');
      const map = {
        happy: './img/coach-happy.png',
        neutral:'./img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      img.src = map[mood] || map.neutral;
    }
  }

  function onJudge(e){
    const d = (e && e.detail) ? e.detail : null;
    if(!d) return;
    toast(d.text || '', d.kind || 'info');
  }

  function onEnd(e){
    const d = (e && e.detail) ? e.detail : null;
    const summary = d ? d.summary : null;
    if(!summary) return;

    // Make sure result fields exist + filled (safe)
    const set = (id, v)=>{ const el=$(id); if(el) el.textContent = String(v); };

    set('rMode', summary.runMode || 'play');
    set('rGrade', summary.grade || 'C');
    set('rScore', summary.scoreFinal ?? 0);
    set('rMaxCombo', summary.comboMax ?? 0);
    set('rMiss', summary.misses ?? 0);
    set('rPerfect', Math.round(summary.fastHitRatePct ?? 0) + '%');
    set('rGoals', `${summary.goalsCleared ?? 0}/${summary.goalsTotal ?? 0}`);
    set('rMinis', `${summary.miniCleared ?? 0}/${summary.miniTotal ?? 0}`);

    try{
      const counts = (summary.plate && summary.plate.counts) ? summary.plate.counts : [0,0,0,0,0];
      set('rG1', counts[0]||0);
      set('rG2', counts[1]||0);
      set('rG3', counts[2]||0);
      set('rG4', counts[3]||0);
      set('rG5', counts[4]||0);
      set('rGTotal', (summary.plate && summary.plate.total) ? summary.plate.total : counts.reduce((a,b)=>a+(b||0),0));
    }catch(_){}
  }

  // ---------- Init ----------
  function init(){
    setVh();
    hardenLayers();
    hideAframeEnterVr();

    // Re-harden on resize/orientation (mobile)
    root.addEventListener('resize', ()=>{
      setVh();
      hardenLayers();
    }, { passive:true });

    root.addEventListener('orientationchange', ()=>{
      setTimeout(()=>{
        setVh();
        hardenLayers();
      }, 150);
    }, { passive:true });

    // Bind events (safe: will work even if other games emit)
    root.addEventListener('hha:score', onScore);
    root.addEventListener('quest:update', onQuest);
    root.addEventListener('hha:coach', onCoach);
    root.addEventListener('hha:judge', onJudge);
    root.addEventListener('hha:end', onEnd);

    // First paint fallback
    try{
      const g = $('uiGrade');
      if(g) setGradeChip(g.textContent || 'C');
    }catch(_){}
  }

  if(doc.readyState === 'loading'){
    doc.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }

})(typeof window !== 'undefined' ? window : globalThis);