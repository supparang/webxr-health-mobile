// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder (PRODUCTION)
// ✅ Listen: hha:score / quest:update / hha:coach / hha:judge / hha:end / hha:celebrate / hha:adaptive
// ✅ UI polish: Judge toast + quick sfx + combo glow + perfect pop + fever-high body class + grade glow
// ✅ cVR: handle hha:shoot (from /vr/vr-ui.js) -> hit target at screen center
// ✅ Safe: no-crash if missing elements, no double bind

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // prevent double bind
  if (root.__HHA_PLATE_HUD_BOUND) return;
  root.__HHA_PLATE_HUD_BOUND = true;

  const qs = (id) => doc.getElementById(id);

  function clamp(v, a, b){ v = Number(v)||0; return v<a?a : (v>b?b:v); }
  function fmtPct(x){ x = Number(x)||0; return `${Math.round(x)}%`; }
  function setText(id, val){
    const el = qs(id);
    if (el) el.textContent = String(val);
  }
  function setWidth(id, pct){
    const el = qs(id);
    if (el) el.style.width = `${clamp(pct,0,100)}%`;
  }

  // ---------- Tiny sound (safe, optional) ----------
  function beep(freq, ms, gain){
    try{
      const AC = root.AudioContext || root.webkitAudioContext;
      if(!AC) return;
      const ctx = beep._ctx || (beep._ctx = new AC());
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = Number(freq)||880;
      g.gain.value = Number(gain)||0.03;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + (Number(ms)||50)/1000);
    }catch(e){}
  }

  // ---------- Toast / Judge ----------
  function ensureToast(){
    let el = doc.querySelector('.hha-judge-toast');
    if(el) return el;
    el = doc.createElement('div');
    el.className = 'hha-judge-toast';
    el.style.cssText = `
      position:fixed;
      left:50%;
      top:calc(env(safe-area-inset-top, 0px) + 92px);
      transform:translateX(-50%);
      z-index:140;
      min-width:220px;
      max-width:min(92vw, 560px);
      padding:10px 12px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.72);
      color:rgba(229,231,235,.95);
      font: 1000 13px/1.2 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
      box-shadow:0 22px 70px rgba(0,0,0,.45);
      backdrop-filter: blur(10px);
      opacity:0;
      pointer-events:none;
      transition: opacity .14s ease, transform .14s ease, filter .14s ease;
      text-align:center;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    `;
    doc.body.appendChild(el);
    return el;
  }

  function showJudge(text, kind){
    const el = ensureToast();
    const k = String(kind||'info').toLowerCase();
    el.textContent = String(text||'');
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(-2px)';

    // tint
    el.style.filter = 'none';
    el.style.borderColor = 'rgba(148,163,184,.18)';
    if(k === 'good'){
      el.style.borderColor = 'rgba(34,197,94,.30)';
      el.style.filter = 'brightness(1.05)';
      beep(1040, 40, 0.028);
    }else if(k === 'warn'){
      el.style.borderColor = 'rgba(250,204,21,.30)';
      beep(860, 38, 0.022);
    }else if(k === 'bad'){
      el.style.borderColor = 'rgba(239,68,68,.30)';
      beep(220, 55, 0.030);
    }else{
      beep(700, 25, 0.015);
    }

    clearTimeout(showJudge._t);
    showJudge._t = setTimeout(()=>{
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(0px)';
    }, 950);
  }

  // ---------- Perfect pop (uses particles.js if present) ----------
  function popPerfect(){
    const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles) || null;
    if(P && typeof P.popText === 'function'){
      P.popText(root.innerWidth/2, root.innerHeight/2, 'PERFECT!', 'pfxPerfect');
      return;
    }
    // fallback: quick DOM pop
    let el = doc.querySelector('.hha-perfect-pop');
    if(!el){
      el = doc.createElement('div');
      el.className = 'hha-perfect-pop';
      el.style.cssText = `
        position:fixed; left:50%; top:50%;
        transform:translate(-50%,-50%) scale(.92);
        z-index:130;
        font: 1200 22px/1 system-ui;
        color:#fff;
        text-shadow:0 10px 28px rgba(0,0,0,.55), 0 2px 0 rgba(0,0,0,.25);
        opacity:0;
        pointer-events:none;
        transition: opacity .12s ease, transform .12s ease;
      `;
      doc.body.appendChild(el);
    }
    el.textContent = 'PERFECT!';
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1)';
    clearTimeout(popPerfect._t);
    popPerfect._t = setTimeout(()=>{
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-50%) scale(.92)';
    }, 420);
  }

  // ---------- Combo glow ----------
  function comboGlow(n){
    const top = qs('hudTop');
    if(!top) return;
    top.classList.remove('hha-combo-glow');
    if(Number(n||0) >= 10){
      void top.offsetWidth;
      top.classList.add('hha-combo-glow');
      clearTimeout(comboGlow._t);
      comboGlow._t = setTimeout(()=>top.classList.remove('hha-combo-glow'), 420);
    }
  }

  // inject CSS for glow + grade tags + fever high
  (function ensureHudCss(){
    if(doc.getElementById('plate-hud-css')) return;
    const st = doc.createElement('style');
    st.id = 'plate-hud-css';
    st.textContent = `
      #hudTop.hha-combo-glow{
        box-shadow: 0 0 0 6px rgba(34,197,94,.08), 0 22px 70px rgba(0,0,0,.35) !important;
      }
      body.fever-high #hudTop{
        box-shadow: 0 0 0 6px rgba(239,68,68,.08), 0 22px 70px rgba(0,0,0,.35) !important;
      }
      /* grade chip tint */
      .gradeChip.is-SSS, .gradeChip.is-SS, .gradeChip.is-S, .gradeChip.is-A{
        border-color: rgba(34,197,94,.30) !important;
        box-shadow: 0 0 0 6px rgba(34,197,94,.08) !important;
      }
      .gradeChip.is-B{
        border-color: rgba(250,204,21,.30) !important;
        box-shadow: 0 0 0 6px rgba(250,204,21,.08) !important;
      }
      .gradeChip.is-C{
        border-color: rgba(239,68,68,.26) !important;
        box-shadow: 0 0 0 6px rgba(239,68,68,.06) !important;
      }
      /* optional adaptive debug */
      .hha-adapt-debug{
        position:fixed; left:10px; bottom:10px;
        z-index:150;
        background:rgba(2,6,23,.60);
        border:1px solid rgba(148,163,184,.16);
        color:rgba(229,231,235,.92);
        border-radius:14px;
        padding:8px 10px;
        font: 900 11px/1.2 system-ui;
        backdrop-filter: blur(10px);
        box-shadow:0 22px 70px rgba(0,0,0,.35);
        display:none;
        pointer-events:none;
        white-space:nowrap;
      }
      body.debug-view .hha-adapt-debug{ display:block; }
    `;
    doc.head.appendChild(st);
  })();

  function gradeClassify(g){
    g = String(g||'C').toUpperCase();
    if(g === 'SSS') return 'SSS';
    if(g === 'SS') return 'SS';
    if(g === 'S') return 'S';
    if(g === 'A') return 'A';
    if(g === 'B') return 'B';
    return 'C';
  }

  function applyGradeChip(grade){
    const chip = doc.querySelector('.gradeChip');
    if(!chip) return;
    const cls = gradeClassify(grade);
    chip.classList.remove('is-SSS','is-SS','is-S','is-A','is-B','is-C');
    chip.classList.add('is-' + cls);
  }

  function setFeverClass(fever){
    const f = Number(fever)||0;
    doc.body.classList.toggle('fever-high', f >= 70);
  }

  // ---------- Quest update binder (safe.js already writes, but this ensures consistency) ----------
  function onQuestUpdate(detail){
    if(!detail || detail.game !== 'plate') return;

    const g = detail.goal || null;
    if(g){
      setText('uiGoalTitle', g.title || '—');
      setText('uiGoalCount', `${g.cur ?? 0}/${g.target ?? 0}`);
      const pct = (g.target ? (Number(g.cur||0)/Number(g.target||1))*100 : 0);
      setWidth('uiGoalFill', pct);
    }

    const m = detail.mini || null;
    if(m){
      setText('uiMiniTitle', m.title || '—');
      // uiMiniCount: we show cleared/total if present; else keep text
      // (Plate.safe.js uses miniCleared tracker; here we keep minimal)
      const tl = (m.timeLeft == null ? null : Number(m.timeLeft));
      setText('uiMiniTime', (tl == null) ? '--' : `${Math.ceil(Math.max(0, tl))}s`);
      const pct = (m.target ? ((Number(m.target) - Math.max(0, tl||0)) / Number(m.target))*100 : 0);
      setWidth('uiMiniFill', pct);
    }
  }

  // ---------- Score update binder ----------
  let lastGoodHits = 0;
  let lastPerfectRateBucket = 0;

  function onScore(detail){
    if(!detail || detail.game !== 'plate') return;

    // mirrors (safe.js already updates, but keep robust)
    if(detail.score != null) setText('uiScore', detail.score);
    if(detail.combo != null) setText('uiCombo', detail.combo);
    if(detail.comboMax != null) setText('uiComboMax', detail.comboMax);
    if(detail.miss != null) setText('uiMiss', detail.miss);
    if(detail.timeLeftSec != null) setText('uiTime', Math.ceil(Number(detail.timeLeftSec)||0));

    if(detail.plateHave != null) setText('uiPlateHave', detail.plateHave);

    if(Array.isArray(detail.gCount) && detail.gCount.length >= 5){
      setText('uiG1', detail.gCount[0]);
      setText('uiG2', detail.gCount[1]);
      setText('uiG3', detail.gCount[2]);
      setText('uiG4', detail.gCount[3]);
      setText('uiG5', detail.gCount[4]);
    }

    const acc = Number(detail.accuracyGoodPct)||0;
    setText('uiAcc', fmtPct(acc));
    if(detail.grade != null){
      setText('uiGrade', String(detail.grade).toUpperCase());
      applyGradeChip(detail.grade);
    }

    if(detail.fever != null){
      const f = clamp(detail.fever, 0, 100);
      setFeverClass(f);
      setWidth('uiFeverFill', f);
    }
    if(detail.shield != null){
      setText('uiShieldN', detail.shield);
    }

    comboGlow(detail.combo);

    // heuristic PERFECT pop:
    // we don't get per-hit RT from event; so we approximate using rising combo + acc buckets
    // (still feels great in play)
    const goodHits = Number(detail.nHitGood||0);
    if(goodHits > lastGoodHits){
      // if combo jumps and acc high -> pop
      const combo = Number(detail.combo||0);
      if(combo > 0 && combo % 6 === 0 && acc >= 82){
        popPerfect();
      }
      lastGoodHits = goodHits;
    }

    // also pop when accuracy crosses a bucket (gives feedback)
    const bucket = Math.floor(acc/10);
    if(bucket > lastPerfectRateBucket && bucket >= 8){
      lastPerfectRateBucket = bucket;
      showJudge(`ความแม่นยำ ${fmtPct(acc)} 🎯`, 'good');
    }
  }

  // ---------- Coach update ----------
  function onCoach(detail){
    if(!detail || detail.game !== 'plate') return;
    if(detail.msg) setText('coachMsg', detail.msg);

    const img = qs('coachImg');
    if(img && detail.mood){
      const m = String(detail.mood||'neutral').toLowerCase();
      const map = {
        happy: './img/coach-happy.png',
        neutral:'./img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      img.src = map[m] || map.neutral;
    }
  }

  // ---------- Celebrate ----------
  function onCelebrate(detail){
    if(!detail || detail.game !== 'plate') return;
    const kind = String(detail.kind||'').toLowerCase();

    const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles) || null;
    if(P && typeof P.celebrate === 'function'){
      P.celebrate(kind || 'generic');
    }else if(P && typeof P.burst === 'function'){
      P.burst(root.innerWidth/2, root.innerHeight/2, kind || 'ok');
    }

    if(kind === 'goal') beep(990, 60, 0.03);
    if(kind === 'mini') beep(1220, 70, 0.03);
    if(kind === 'end')  beep(740, 110, 0.03);
  }

  // ---------- End ----------
  function onEnd(ev){
    const detail = ev && ev.detail;
    if(!detail || detail.game !== 'plate') return;
    const s = detail.summary || null;
    if(!s) return;
    // reinforce grade chip + little toast
    applyGradeChip(s.grade);
    showJudge(`จบเกม • GRADE ${String(s.grade||'C').toUpperCase()} 🏁`, (s.grade==='C'?'bad':'good'));
  }

  // ---------- Adaptive debug ----------
  function ensureAdaptDebug(){
    let el = doc.querySelector('.hha-adapt-debug');
    if(el) return el;
    el = doc.createElement('div');
    el.className = 'hha-adapt-debug';
    el.textContent = 'adapt: —';
    doc.body.appendChild(el);
    return el;
  }

  function onAdaptive(detail){
    if(!detail || detail.game !== 'plate') return;
    const el = ensureAdaptDebug();
    const a = detail.adapt || {};
    const acc = Number(detail.acc||0);
    const rt = Number(detail.rtAvg||0);
    el.textContent = `adapt size×${(a.sizeMul||1).toFixed(2)} spawn×${(a.spawnMul||1).toFixed(2)} junk×${(a.junkMul||1).toFixed(2)} | acc ${Math.round(acc)}% | rt ${Math.round(rt)}ms`;
  }

  // ---------- cVR shoot bridge (center hit) ----------
  function findClickableTargetAtCenter(){
    const x = Math.round((root.innerWidth || 360) / 2);
    const y = Math.round((root.innerHeight || 640) / 2);

    let el = null;
    try{ el = doc.elementFromPoint(x, y); }catch(e){ el = null; }
    if(!el) return null;

    // climb up to plate target button
    let n = el;
    for(let i=0;i<6 && n;i++){
      if(n.matches && (n.matches('button.plateTarget[data-id]') || n.matches('button[data-id][data-kind]'))){
        return { el:n, x, y };
      }
      n = n.parentElement;
    }
    return null;
  }

  function firePointerDown(target, x, y){
    if(!target) return false;
    try{
      const ev = new PointerEvent('pointerdown', {
        bubbles:true,
        cancelable:true,
        clientX:x, clientY:y,
        pointerId:1,
        pointerType:'mouse',
        isPrimary:true
      });
      target.dispatchEvent(ev);
      return true;
    }catch(e){
      try{
        // fallback click
        target.click();
        return true;
      }catch(err){
        return false;
      }
    }
  }

  function onShoot(ev){
    const info = findClickableTargetAtCenter();
    if(!info) return;
    // only shoot when in cVR view OR when user uses crosshair shooting
    // (safe to always allow; game checks running/paused itself)
    firePointerDown(info.el, info.x, info.y);
  }

  // ---------- Wire events ----------
  root.addEventListener('hha:score', (e)=>onScore(e.detail), { passive:true });
  root.addEventListener('quest:update', (e)=>onQuestUpdate(e.detail), { passive:true });
  root.addEventListener('hha:coach', (e)=>onCoach(e.detail), { passive:true });
  root.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    if(d.game && d.game !== 'plate') return;
    showJudge(d.text || d.msg || '', d.kind || 'info');
  }, { passive:true });
  root.addEventListener('hha:celebrate', (e)=>onCelebrate(e.detail), { passive:true });
  root.addEventListener('hha:end', onEnd, { passive:true });
  root.addEventListener('hha:adaptive', (e)=>onAdaptive(e.detail), { passive:true });

  // from /vr/vr-ui.js
  root.addEventListener('hha:shoot', onShoot, { passive:true });

  // ---------- Init: show a tiny hint if debug=1 ----------
  (function init(){
    try{
      const u = new URL(location.href);
      if(u.searchParams.get('debug') === '1') doc.body.classList.add('debug-view');
    }catch(e){}
  })();

})(window);