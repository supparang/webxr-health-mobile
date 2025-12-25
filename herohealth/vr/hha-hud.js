// === /herohealth/vr/hha-hud.js ===
// HeroHealth — HUD Binder (GoodJunk HTML NEW + Quest Director Dual-shape)
// ✅ Compatible with quest:update that emits BOTH shapes:
//    - nested: goal{title,cur,max,pct}, mini{title,cur,max,pct}
//    - flat: goalTitle/goalCur/goalMax/goalPct + miniTitle/miniCur/miniMax/miniPct
// ✅ GoodJunk NEW HTML IDs mapping (hud-quest-main-bar, fever-fill, shield-count, etc.)
// ✅ VR: move ALL HUD to TOP-LEFT on enter-vr (A-Frame enter-vr / exit-vr)
// ✅ Safe if elements missing + Prevent double-binding

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  if (root.__HHA_HUD_BOUND__) return;
  root.__HHA_HUD_BOUND__ = true;

  // ---------------- helpers ----------------
  const $ = (sel) => { try { return doc.querySelector(sel); } catch { return null; } };
  const setText = (el, v) => { if (!el) return; try { el.textContent = String(v ?? ''); } catch {} };
  const setStyle = (el, k, v) => { if (!el) return; try { el.style[k] = v; } catch {} };
  const clamp = (v, a, b) => { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); };
  const clamp01 = (x) => Math.max(0, Math.min(1, Number(x || 0)));
  const safeStr = (v) => String(v ?? '').trim();

  function pctFrom(prog, target){
    const p = Number(prog)||0, t = Number(target)||0;
    if (t <= 0) return 0;
    return clamp((p / t) * 100, 0, 100);
  }
  function fmtProg(prog, target){
    const p = Math.max(0, (Number(prog)||0)|0);
    const t = Math.max(0, (Number(target)||0)|0);
    return `${p}/${t}`;
  }

  // ---------------- elements (GoodJunk NEW HTML) ----------------
  // Top KPIs
  const elScore = $('#hud-score');
  const elCombo = $('#hud-combo'); // COMBO MAX
  const elMiss  = $('#hud-miss');

  // Meta labels
  const elRunLabel  = $('#hud-run-label');       // PLAY/RESEARCH
  const elDiffLabel = $('#hud-diff-label');
  const elChLabel   = $('#hud-challenge-label');
  const elTimeLabel = $('#hud-time-label');

  // Fever UI
  const elFeverPct  = $('#fever-pct');
  const elFeverFill = $('#fever-fill');
  const elHudStun   = $('#hud-stun');

  // Shield UI
  const elShieldCount = $('#shield-count');

  // Judge
  const elJudge = $('#hud-judge');

  // Coach bubble
  const elCoachTxt = $('#coach-text');
  const elCoachImg = $('#coach-emoji'); // div (background-image)
  const elCoachBubble = $('#coach-bubble');

  // Quest HUD bottom
  const elQMainTitle = $('#hud-quest-main');
  const elQMainCap   = $('#hud-quest-main-caption');
  const elQMainBar   = $('#hud-quest-main-bar');

  const elQMiniTitle = $('#hud-quest-mini');
  const elQMiniCap   = $('#hud-quest-mini-caption');
  const elQMiniBar   = $('#hud-quest-mini-bar');

  const elQHint      = $('#hud-quest-hint');
  const elMiniCount  = $('#hud-mini-count');

  // Logger badge (optional)
  const elLogDot  = $('#logdot');
  const elLogText = $('#logtext');

  // Boss HUD (optional)
  const elBossWrap  = $('#boss-wrap');
  const elBossFill  = $('#boss-fill');
  const elBossPhase = $('#boss-phase');

  // Boss overlays (optional)
  const elAtkRing    = $('#atk-ring');
  const elAtkLaser   = $('#atk-laser');
  const elStunVortex = $('#stun-vortex');
  const elBossBeacon = $('#boss-beacon');

  // Summary overlay (optional)
  const elSumOverlay = $('#sum-overlay');
  const elSumScore   = $('#sum-score');
  const elSumCombo   = $('#sum-combo');
  const elSumGood    = $('#sum-good');
  const elSumMiss    = $('#sum-miss');
  const btnExit      = $('#btn-exit');
  const btnReplay    = $('#btn-replay');

  // HUD blocks for VR reposition
  const elHudTop   = $('#hud-pill');
  const elHudMeta  = $('.hud-meta');
  const elHudRight = $('#hud-right');
  const elHudQuest = $('#hud-quest-wrap');

  // ---------------- coach mood images ----------------
  const COACH_IMG = {
    fever:   './img/coach-fever.png',
    happy:   './img/coach-happy.png',
    neutral: './img/coach-neutral.png',
    sad:     './img/coach-sad.png'
  };

  let lastCoachMood = 'neutral';
  let coachHideT = 0;

  function setCoachMood(mood){
    const m = String(mood||'').toLowerCase();
    const pick =
      (m.includes('fever') || m.includes('fire') || m.includes('hot') || m.includes('🔥')) ? 'fever' :
      (m.includes('happy') || m.includes('win')  || m.includes('good') || m.includes('success') || m.includes('🎉') || m.includes('⭐')) ? 'happy' :
      (m.includes('sad')   || m.includes('miss') || m.includes('bad')  || m.includes('fail')    || m.includes('😵') || m.includes('⚠️')) ? 'sad' :
      'neutral';

    if (pick === lastCoachMood) return;
    lastCoachMood = pick;

    if (elCoachImg){
      setStyle(elCoachImg, 'backgroundImage', `url('${COACH_IMG[pick] || COACH_IMG.neutral}')`);
    }
  }

  function showCoach(text, mood){
    if (text != null && elCoachTxt) setText(elCoachTxt, String(text));
    if (mood) setCoachMood(mood);

    if (!elCoachBubble) return;
    try { elCoachBubble.classList.add('show'); } catch {}
    clearTimeout(coachHideT);
    coachHideT = setTimeout(()=> {
      try { elCoachBubble.classList.remove('show'); } catch {}
    }, 1700);
  }

  // ---------------- HUD state ----------------
  let sScore=0, sComboMax=0, sMiss=0, sGoodHits=0;
  let sFever=0, sShield=0;

  let meta = { run:'PLAY', diff:'—', challenge:'—', time:'—' };

  // normalized quest objects: {label, prog, target, tLeft?, windowSec?, hint?}
  let qQuestOk = true;
  let qGoal = null;
  let qMini = null;

  // counters for display
  let qGoalsCleared = 0, qGoalsTotal = 0;
  let qMinisCleared = 0, qMiniCount  = 0;

  // boss
  let boss = { show:false, hp:0, hpMax:1, phase:'P1' };

  // ---------------- renderers ----------------
  function renderTop(){
    setText(elScore, sScore|0);
    setText(elCombo, sComboMax|0);
    setText(elMiss,  sMiss|0);
  }

  function renderMeta(){
    if (elRunLabel)  setText(elRunLabel, meta.run || 'PLAY');
    if (elDiffLabel) setText(elDiffLabel, meta.diff || '—');
    if (elChLabel)   setText(elChLabel, meta.challenge || '—');
    if (elTimeLabel) setText(elTimeLabel, meta.time || '—');
  }

  function renderFever(){
    const p = clamp(sFever, 0, 100);
    if (elFeverPct) setText(elFeverPct, `${p|0}%`);
    if (elFeverFill) setStyle(elFeverFill, 'width', `${p}%`);
    if (p >= 70) setCoachMood('fever');
  }

  function renderShield(){
    if (elShieldCount) setText(elShieldCount, sShield|0);
  }

  let judgeHideT = 0;
  function showJudge(txt){
    if (!elJudge) return;
    const t = String(txt||'').trim();
    if (!t) return;

    setText(elJudge, t);
    setStyle(elJudge, 'opacity', '1');
    clearTimeout(judgeHideT);
    judgeHideT = setTimeout(()=>{
      setStyle(elJudge, 'opacity', '0');
      setText(elJudge, '\u00A0');
    }, 650);
  }

  function flashStun(on){
    if (elHudStun){
      try { elHudStun.classList.toggle('show', !!on); } catch {}
    }
    if (elStunVortex){
      try { elStunVortex.classList.toggle('show', !!on); } catch {}
    }
  }

  function renderQuest(){
    if (!qQuestOk){
      setText(elQMainTitle, '⚠️ QUEST ไม่พร้อม');
      setText(elQMainCap, 'ตรวจสอบ quest modules');
      setStyle(elQMainBar, 'width', '0%');

      setText(elQMiniTitle, 'Mini: —');
      setText(elQMiniCap, '—');
      setStyle(elQMiniBar, 'width', '0%');

      setText(elQHint, '—');
      setText(elMiniCount, '');
      return;
    }

    // MAIN
    if (qGoal){
      setText(elQMainTitle, `Goal: ${qGoal.label || 'Goal'}`);
      setText(elQMainCap, fmtProg(qGoal.prog, qGoal.target));
      setStyle(elQMainBar, 'width', `${pctFrom(qGoal.prog, qGoal.target)}%`);
    } else {
      setText(elQMainTitle, 'Goal: ✅ ครบแล้ว');
      setText(elQMainCap, `(${qGoalsCleared|0}/${qGoalsTotal|0})`);
      setStyle(elQMainBar, 'width', '100%');
    }

    // MINI
    if (qMini){
      setText(elQMiniTitle, `Mini: ${qMini.label || 'Mini'}`);
      const hasTL = (qMini.tLeft != null && qMini.windowSec != null);
      if (hasTL){
        setText(elQMiniCap, `${fmtProg(qMini.prog, qMini.target)}  ⏱ ${Math.max(0, qMini.tLeft|0)}s`);
      } else {
        setText(elQMiniCap, fmtProg(qMini.prog, qMini.target));
      }
      setStyle(elQMiniBar, 'width', `${pctFrom(qMini.prog, qMini.target)}%`);
      setText(elQHint, qMini.hint != null ? String(qMini.hint) : '');
    } else {
      setText(elQMiniTitle, 'Mini: ✨ ครบแล้ว');
      setText(elQMiniCap, `(${qMinisCleared|0})`);
      setStyle(elQMiniBar, 'width', '100%');
      setText(elQHint, '');
    }

    // counts line
    if (elMiniCount){
      // goalTotal/miniTotal ไม่มีส่งมาแน่นอน (เพราะ mini เป็นวนลูป) → โชว์ cleared + started
      const parts = [];
      if (qGoalsTotal > 0) parts.push(`Goals ${qGoalsCleared|0}/${qGoalsTotal|0}`);
      if (qMiniCount > 0 || qMinisCleared > 0) parts.push(`Minis ✓${qMinisCleared|0} · started ${qMiniCount|0}`);
      setText(elMiniCount, parts.join('  •  '));
    }
  }

  function renderBoss(){
    if (!elBossWrap) return;
    try { elBossWrap.classList.toggle('show', !!boss.show); } catch {}
    if (!boss.show) return;

    const hp = Math.max(0, Number(boss.hp)||0);
    const hm = Math.max(1, Number(boss.hpMax)||1);
    const w = clamp((hp/hm)*100, 0, 100);

    if (elBossFill) setStyle(elBossFill, 'width', `${w}%`);
    if (elBossPhase) setText(elBossPhase, String(boss.phase||'P1'));
  }

  function showAtkRing(on, gapStartDeg, gapSizeDeg){
    if (!elAtkRing) return;
    try{
      elAtkRing.classList.toggle('show', !!on);
      if (gapStartDeg != null) doc.documentElement.style.setProperty('--ringGapStart', `${Number(gapStartDeg)||0}deg`);
      if (gapSizeDeg != null)  doc.documentElement.style.setProperty('--ringGapSize',  `${Number(gapSizeDeg)||60}deg`);
    }catch{}
  }

  function showLaser(state){
    if (!elAtkLaser) return;
    try{
      elAtkLaser.classList.remove('warn','fire');
      if (state === 'warn') elAtkLaser.classList.add('warn');
      else if (state === 'fire') elAtkLaser.classList.add('fire');
      else setStyle(elAtkLaser, 'opacity', '0');
    }catch{}
  }

  function showBossBeacon(on){
    if (!elBossBeacon) return;
    try{ elBossBeacon.classList.toggle('show', !!on); } catch {}
  }

  function openSummary(d){
    if (!elSumOverlay) return;
    try { elSumOverlay.classList.add('show'); } catch {}

    if (elSumScore) setText(elSumScore, d && d.scoreFinal != null ? d.scoreFinal : (sScore|0));
    if (elSumCombo) setText(elSumCombo, d && d.comboMax != null ? d.comboMax : (sComboMax|0));
    if (elSumGood)  setText(elSumGood,  d && d.goodHits != null ? d.goodHits : (sGoodHits|0));
    if (elSumMiss)  setText(elSumMiss,  d && d.misses != null ? d.misses : (sMiss|0));

    if (btnExit) btnExit.onclick = () => { try { elSumOverlay.classList.remove('show'); } catch {} };
    if (btnReplay) btnReplay.onclick = () => { try { elSumOverlay.classList.remove('show'); } catch {} };
  }

  // ---------------- normalize quest:update (THE FIX) ----------------
  function normalizeQuestObj(fromNested, flatTitle, flatCur, flatMax){
    // Accept:
    //  - nested: {title,cur,max,pct} OR {label,prog,target}
    //  - flat: title/cur/max
    const out = { label:'', prog:0, target:1 };

    if (fromNested && typeof fromNested === 'object'){
      // preferred: label/prog/target
      if (fromNested.label != null || fromNested.prog != null || fromNested.target != null){
        out.label  = safeStr(fromNested.label || fromNested.title || '');
        out.prog   = Number(fromNested.prog ?? fromNested.cur ?? 0) || 0;
        out.target = Number(fromNested.target ?? fromNested.max ?? 1) || 1;
        // pass-through extras
        if (fromNested.tLeft != null) out.tLeft = fromNested.tLeft;
        if (fromNested.windowSec != null) out.windowSec = fromNested.windowSec;
        if (fromNested.hint != null) out.hint = fromNested.hint;
        return out;
      }
      // nested quest-director shape: title/cur/max
      if (fromNested.title != null || fromNested.cur != null || fromNested.max != null){
        out.label  = safeStr(fromNested.title || '');
        out.prog   = Number(fromNested.cur ?? 0) || 0;
        out.target = Number(fromNested.max ?? 1) || 1;
        return out;
      }
    }

    // fallback flat keys
    out.label  = safeStr(flatTitle || '');
    out.prog   = Number(flatCur ?? 0) || 0;
    out.target = Number(flatMax ?? 1) || 1;
    return out;
  }

  // ---------------- VR: move ALL HUD to top-left ----------------
  const __orig = new Map();
  function stashStyle(el){
    if (!el || __orig.has(el)) return;
    __orig.set(el, el.getAttribute('style') || '');
  }
  function restoreStyle(el){
    if (!el) return;
    if (!__orig.has(el)) return;
    try { el.setAttribute('style', __orig.get(el) || ''); } catch {}
  }

  function applyVRLayout(on){
    const body = doc.body;
    if (!body) return;

    try { body.classList.toggle('hha-vr', !!on); } catch {}

    // stash originals once
    [elHudTop, elHudMeta, elHudRight, elHudQuest, elBossWrap, $('#logBadge')].forEach(stashStyle);

    if (!on){
      [elHudTop, elHudMeta, elHudRight, elHudQuest, elBossWrap, $('#logBadge')].forEach(restoreStyle);
      return;
    }

    // Stack order: hud-top -> meta -> right-panel -> boss-wrap -> quest
    const pad = '10px';
    const safeTop = 'calc(env(safe-area-inset-top, 0px) + 8px)';

    if (elHudTop){
      setStyle(elHudTop, 'left', pad);
      setStyle(elHudTop, 'right', 'auto');
      setStyle(elHudTop, 'top', safeTop);
      setStyle(elHudTop, 'width', 'min(520px, 92vw)');
      setStyle(elHudTop, 'justifyContent', 'flex-start');
      setStyle(elHudTop, 'gap', '8px');
    }

    if (elHudMeta){
      setStyle(elHudMeta, 'left', pad);
      setStyle(elHudMeta, 'right', 'auto');
      setStyle(elHudMeta, 'top', `calc(${safeTop} + 44px)`);
      setStyle(elHudMeta, 'justifyContent', 'flex-start');
      setStyle(elHudMeta, 'pointerEvents', 'none');
      setStyle(elHudMeta, 'width', 'min(520px, 92vw)');
      setStyle(elHudMeta, 'flexWrap', 'wrap');
    }

    // Right panel -> become "stack panel" left
    if (elHudRight){
      setStyle(elHudRight, 'left', pad);
      setStyle(elHudRight, 'right', 'auto');
      setStyle(elHudRight, 'top', `calc(${safeTop} + 84px)`);
      setStyle(elHudRight, 'width', 'min(320px, 88vw)');
      setStyle(elHudRight, 'transform', 'translateZ(0)');
    }

    if (elBossWrap){
      setStyle(elBossWrap, 'left', pad);
      setStyle(elBossWrap, 'right', 'auto');
      setStyle(elBossWrap, 'top', `calc(${safeTop} + 84px + 160px)`);
      setStyle(elBossWrap, 'transform', 'none');
      setStyle(elBossWrap, 'pointerEvents', 'none');
    }

    if (elHudQuest){
      setStyle(elHudQuest, 'left', pad);
      setStyle(elHudQuest, 'right', 'auto');
      setStyle(elHudQuest, 'bottom', 'auto');
      setStyle(elHudQuest, 'top', `calc(${safeTop} + 84px + 240px)`);
      setStyle(elHudQuest, 'width', 'min(520px, 92vw)');
      setStyle(elHudQuest, 'maxHeight', '130px');
    }

    const logBadge = $('#logBadge');
    if (logBadge){
      setStyle(logBadge, 'left', pad);
      setStyle(logBadge, 'right', 'auto');
      setStyle(logBadge, 'top', `calc(${safeTop} + 84px + 320px)`);
    }
  }

  // Bind A-Frame enter/exit VR if exists
  (function bindAFRAMEVR(){
    const scene = $('a-scene');
    if (!scene) return;

    // start in vr? (usually false)
    try{
      scene.addEventListener('enter-vr', ()=> applyVRLayout(true));
      scene.addEventListener('exit-vr',  ()=> applyVRLayout(false));
    }catch{}
  })();

  // ---------------- events ----------------

  // score event (unified)
  root.addEventListener('hha:score', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};

    if (d.score != null) sScore = d.score|0;

    if (d.comboMax != null) sComboMax = d.comboMax|0;
    else if (d.combo != null) sComboMax = Math.max(sComboMax|0, d.combo|0);

    if (d.misses != null) sMiss = d.misses|0;
    if (d.goodHits != null) sGoodHits = d.goodHits|0;

    if (d.fever != null)  sFever = clamp(d.fever, 0, 100);
    if (d.shield != null) sShield = Number(d.shield)||0;

    if (d.diff != null) meta.diff = String(d.diff);
    if (d.challenge != null) meta.challenge = String(d.challenge);
    if (d.run != null) meta.run = String(d.run).toUpperCase();

    renderTop();
    renderFever();
    renderShield();
    renderMeta();
  });

  // time label
  root.addEventListener('hha:time', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.left != null){
      meta.time = String(Math.max(0, d.left|0));
      renderMeta();
    }
  });

  // ✅ Quest update (dual-shape compatible)
  root.addEventListener('quest:update', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    qQuestOk = (d.questOk !== false);

    // meta counts (from flat or nested.meta)
    const metaIn = (d.meta && typeof d.meta === 'object') ? d.meta : null;
    qGoalsCleared = Number(d.goalsCleared ?? metaIn?.goalsCleared ?? 0) || 0;
    qGoalsTotal   = Number(d.goalsTotal   ?? metaIn?.goalIndex    ?? 0) || 0; // meta.goalIndex = goals.length
    qMinisCleared = Number(d.minisCleared ?? metaIn?.minisCleared ?? 0) || 0;
    qMiniCount    = Number(d.miniCount    ?? metaIn?.miniCount    ?? 0) || 0;

    // normalize goal/mini from either nested OR flat
    const goalRaw = d.goal || d.main || null;
    const miniRaw = d.mini || null;

    const gNorm = normalizeQuestObj(goalRaw, d.goalTitle, d.goalCur, d.goalMax);
    const mNorm = normalizeQuestObj(miniRaw, d.miniTitle, d.miniCur, d.miniMax);

    // if empty title => treat as null (goal cleared / mini missing)
    qGoal = (safeStr(gNorm.label) ? gNorm : null);
    qMini = (safeStr(mNorm.label) ? mNorm : null);

    renderQuest();
  });

  // coach messages
  root.addEventListener('hha:coach', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const text = (d.text != null) ? String(d.text) : '';
    if (!text && !d.mood) return;

    let mood = d.mood;
    if (!mood && text){
      const t = text.toLowerCase();
      if (t.includes('fever') || t.includes('🔥')) mood = 'fever';
      else if (t.includes('ผ่าน') || t.includes('เยี่ยม') || t.includes('สำเร็จ') || t.includes('🎉') || t.includes('⭐')) mood = 'happy';
      else if (t.includes('miss') || t.includes('โดน') || t.includes('พลาด') || t.includes('😵') || t.includes('⚠️')) mood = 'sad';
      else mood = 'neutral';
    }
    showCoach(text, mood);
  });

  // fever compat
  root.addEventListener('hha:fever', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.fever != null) sFever = clamp(d.fever, 0, 100);
    if (d.on === true) setCoachMood('fever');
    renderFever();
  });

  // shield compat
  root.addEventListener('hha:shield', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.shield != null) sShield = Number(d.shield)||0;
    renderShield();
  });

  // judge compat
  root.addEventListener('hha:judge', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const text = (d.text != null) ? d.text : (d.judge != null ? d.judge : '');
    if (text) showJudge(text);
  });

  // stun
  root.addEventListener('hha:stun', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    flashStun(d.on === true);
    if (d.on === true) setCoachMood('sad');
  });

  // boss HUD + attack cues (optional)
  root.addEventListener('hha:boss', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    boss.show = (d.show !== false);
    if (d.hp != null) boss.hp = Number(d.hp)||0;
    if (d.hpMax != null) boss.hpMax = Number(d.hpMax)||1;
    if (d.phase != null) boss.phase = String(d.phase);
    renderBoss();

    if (d.ring != null){
      showAtkRing(!!d.ring.on, d.ring.gapStart, d.ring.gapSize);
    }
    if (d.laser != null){
      showLaser(d.laser);
    }
    if (d.beacon != null){
      showBossBeacon(!!d.beacon);
    }
  });

  // logger status (optional)
  root.addEventListener('hha:logger', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (elLogText) setText(elLogText, `logger: ${d.state || '—'}`);
    if (elLogDot){
      const st = String(d.state||'').toLowerCase();
      if (st.includes('ok') || st.includes('ready')) setStyle(elLogDot, 'background', '#22c55e');
      else if (st.includes('sending')) setStyle(elLogDot, 'background', '#f59e0b');
      else setStyle(elLogDot, 'background', '#9ca3af');
    }
  });

  // end summary
  root.addEventListener('hha:end', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};

    if (d.scoreFinal != null) sScore = d.scoreFinal|0;
    if (d.comboMax != null) sComboMax = d.comboMax|0;
    if (d.misses != null) sMiss = d.misses|0;
    if (d.goodHits != null) sGoodHits = d.goodHits|0;

    showAtkRing(false);
    showLaser('');
    showBossBeacon(false);
    flashStun(false);

    const g = String(d.grade || '').toUpperCase().trim();
    if (g === 'SSS' || g === 'SS' || g === 'S') setCoachMood('happy');
    else if ((d.misses|0) >= 8) setCoachMood('sad');
    else setCoachMood('neutral');

    renderTop();
    renderFever();
    renderShield();
    renderQuest();
    renderBoss();
    openSummary(d);

    // if end -> leave VR layout as-is (บางคนอยากดูสรุปใน VR)
  });

  // ---------------- initial paint ----------------
  renderTop();
  renderMeta();
  renderFever();
  renderShield();
  renderQuest();
  renderBoss();

  if (elCoachImg && !elCoachImg.style.backgroundImage){
    setStyle(elCoachImg, 'backgroundImage', `url('${COACH_IMG.neutral}')`);
  }

})(window);
