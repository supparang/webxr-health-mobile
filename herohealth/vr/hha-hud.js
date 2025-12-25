// === /herohealth/vr/hha-hud.js ===
// HeroHealth — HUD Binder (GoodJunk HTML NEW)
// FIX-ALL: new IDs mapping + quest bars + judge + fever/shield + boss HUD + summary overlay + VR stack safe
// ✅ Safe if elements missing
// ✅ Prevent double-binding
// ✅ Coach mood image names fixed: coach-fever.png, coach-happy.png, coach-neutral.png, coach-sad.png

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // Prevent double init
  if (root.__HHA_HUD_BOUND__) return;
  root.__HHA_HUD_BOUND__ = true;

  // ---------------- helpers ----------------
  const $ = (sel) => { try { return doc.querySelector(sel); } catch { return null; } };
  const setText = (el, v) => { if (!el) return; try { el.textContent = String(v ?? ''); } catch {} };
  const setStyle = (el, k, v) => { if (!el) return; try { el.style[k] = v; } catch {} };
  const clamp = (v, a, b) => { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); };
  const now = () => (root.performance && performance.now) ? performance.now() : Date.now();

  function pct(p, t){
    p = Number(p)||0; t = Number(t)||0;
    if (t <= 0) return 0;
    return clamp((p / t) * 100, 0, 100);
  }

  function fmtProg(prog, target){
    const p = Math.max(0, (Number(prog)||0)|0);
    const t = Math.max(0, (Number(target)||0)|0);
    return `${p}/${t}`;
  }

  function safeUpper(s){ return String(s||'').toUpperCase().trim(); }

  // ---------------- elements (GoodJunk NEW IDs) ----------------
  // Top KPIs
  const elScore = $('#hud-score');
  const elCombo = $('#hud-combo');     // (ใน HTML ระบุ COMBO MAX)
  const elMiss  = $('#hud-miss');

  // Fever UI (new)
  const elFeverPct  = $('#fever-pct');
  const elFeverFill = $('#fever-fill');
  const elHudStun   = $('#hud-stun');

  // Shield UI (new)
  const elShieldCount = $('#shield-count');

  // Judge label (new)
  const elJudge = $('#hud-judge');

  // Coach bubble (new)
  const elCoachTxt = $('#coach-text');
  const elCoachImg = $('#coach-emoji'); // เป็น div background-image

  // Quest HUD bottom (new)
  const elQMainTitle   = $('#hud-quest-main');
  const elQMainCap     = $('#hud-quest-main-caption');
  const elQMainBar     = $('#hud-quest-main-bar');

  const elQMiniTitle   = $('#hud-quest-mini');
  const elQMiniCap     = $('#hud-quest-mini-caption');
  const elQMiniBar     = $('#hud-quest-mini-bar');

  const elQHint        = $('#hud-quest-hint');
  const elMiniCount    = $('#hud-mini-count');

  // Meta labels
  const elRunLabel  = $('#hud-run-label');       // PLAY/RESEARCH
  const elDiffLabel = $('#hud-diff-label');
  const elChLabel   = $('#hud-challenge-label');
  const elTimeLabel = $('#hud-time-label');

  // Logger badge
  const elLogDot  = $('#logdot');
  const elLogText = $('#logtext');

  // Boss HUD (new)
  const elBossWrap  = $('#boss-wrap');
  const elBossFill  = $('#boss-fill');
  const elBossPhase = $('#boss-phase');

  // Summary overlay (new)
  const elSumOverlay = $('#sum-overlay');
  const elSumScore   = $('#sum-score');
  const elSumCombo   = $('#sum-combo');
  const elSumGood    = $('#sum-good');
  const elSumMiss    = $('#sum-miss');
  const btnExit      = $('#btn-exit');
  const btnReplay    = $('#btn-replay');

  // Optional VR helper nodes
  const elAtkRing  = $('#atk-ring');
  const elAtkLaser = $('#atk-laser');
  const elStunVortex = $('#stun-vortex');
  const elBossBeacon = $('#boss-beacon');

  // ---------------- coach mood images ----------------
  const COACH_IMG = {
    fever:  './img/coach-fever.png',
    happy:  './img/coach-happy.png',
    neutral:'./img/coach-neutral.png',
    sad:    './img/coach-sad.png'
  };

  let lastCoachMood = 'neutral';
  let coachHideT = 0;

  function setCoachMood(mood){
    const m = String(mood||'').toLowerCase();
    const pick =
      (m.includes('fever') || m.includes('fire') || m.includes('hot') || m.includes('🔥')) ? 'fever' :
      (m.includes('happy') || m.includes('win')  || m.includes('good') || m.includes('success') || m.includes('🎉') || m.includes('⭐')) ? 'happy' :
      (m.includes('sad') || m.includes('miss') || m.includes('bad') || m.includes('fail') || m.includes('😵') || m.includes('⚠️')) ? 'sad' :
      'neutral';

    if (pick === lastCoachMood) return;
    lastCoachMood = pick;

    if (elCoachImg){
      // #coach-emoji เป็น DIV → background-image
      setStyle(elCoachImg, 'backgroundImage', `url('${COACH_IMG[pick] || COACH_IMG.neutral}')`);
    }
  }

  function showCoach(text, mood){
    if (text != null && elCoachTxt) setText(elCoachTxt, String(text));
    if (mood) setCoachMood(mood);

    // ใช้ bubble show/hide (ถ้า element wrapper มี)
    const bubble = $('#coach-bubble');
    if (!bubble) return;

    try { bubble.classList.add('show'); } catch {}
    clearTimeout(coachHideT);
    coachHideT = setTimeout(()=> {
      try { bubble.classList.remove('show'); } catch {}
    }, 1800);
  }

  // ---------------- HUD state ----------------
  let sScore=0, sComboMax=0, sMiss=0, sGoodHits=0;
  let sFever=0, sShield=0;
  let sJudgeText = '';
  let judgeHideT = 0;

  // Quest state (goal/mini)
  let qGoal=null, qMini=null, qQuestOk=true;
  let qMiniCleared=0;

  // Boss state
  let boss = { show:false, hp:0, hpMax:0, phase:'P1' };

  // Meta
  let meta = { run:'PLAY', diff:'—', challenge:'—', time:'—' };

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

    // coach mood hint
    if (p >= 70) setCoachMood('fever');
  }

  function renderShield(){
    if (elShieldCount) setText(elShieldCount, sShield|0);
  }

  function flashStun(on){
    if (elHudStun){
      try { elHudStun.classList.toggle('show', !!on); } catch {}
    }
    if (elStunVortex){
      try { elStunVortex.classList.toggle('show', !!on); } catch {}
    }
  }

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
      const lab = qGoal.label || qGoal.title || 'Goal';
      setText(elQMainTitle, `Goal: ${lab}`);
      setText(elQMainCap, fmtProg(qGoal.prog, qGoal.target));
      setStyle(elQMainBar, 'width', `${pct(qGoal.prog, qGoal.target)}%`);
    } else {
      setText(elQMainTitle, 'Goal: ✅ ครบแล้ว');
      setText(elQMainCap, '✓');
      setStyle(elQMainBar, 'width', '100%');
    }

    // MINI
    if (qMini){
      const lab = qMini.label || qMini.title || 'Mini';
      setText(elQMiniTitle, `Mini: ${lab}`);

      const hasTL = (qMini.tLeft != null && qMini.windowSec != null);
      if (hasTL){
        setText(elQMiniCap, `${fmtProg(qMini.prog, qMini.target)}  ⏱ ${Math.max(0, qMini.tLeft|0)}s`);
      } else {
        setText(elQMiniCap, fmtProg(qMini.prog, qMini.target));
      }
      setStyle(elQMiniBar, 'width', `${pct(qMini.prog, qMini.target)}%`);

      // hint
      if (qMini.hint != null) setText(elQHint, String(qMini.hint));
      else setText(elQHint, '');
    } else {
      setText(elQMiniTitle, 'Mini: ✨ ครบแล้ว');
      setText(elQMiniCap, '✓');
      setStyle(elQMiniBar, 'width', '100%');
      setText(elQHint, '');
    }

    // mini counter (ถ้ามีส่งมา)
    if (qMini && qMini.cleared != null){
      qMiniCleared = Number(qMini.cleared)||0;
    }
    const total = (qMini && qMini.total != null) ? (Number(qMini.total)||0) : null;
    if (elMiniCount){
      if (total != null && total > 0) setText(elMiniCount, `Mini chain: ${qMiniCleared|0}/${total|0}`);
      else if (qMiniCleared > 0) setText(elMiniCount, `Mini chain: ${qMiniCleared|0}`);
      else setText(elMiniCount, '');
    }
  }

  function renderBoss(){
    if (!elBossWrap) return;
    const show = !!boss.show;
    try { elBossWrap.classList.toggle('show', show); } catch {}
    if (!show) return;

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

  // Summary overlay open/close
  function openSummary(d){
    if (!elSumOverlay) return;
    try { elSumOverlay.classList.add('show'); } catch {}

    if (elSumScore) setText(elSumScore, d && d.scoreFinal != null ? d.scoreFinal : (sScore|0));
    if (elSumCombo) setText(elSumCombo, d && d.comboMax != null ? d.comboMax : (sComboMax|0));
    if (elSumGood)  setText(elSumGood,  d && d.goodHits != null ? d.goodHits : (sGoodHits|0));
    if (elSumMiss)  setText(elSumMiss,  d && d.misses != null ? d.misses : (sMiss|0));

    // ให้ปุ่มใช้งานได้ แต่ไม่ไปยุ่ง engine (ปล่อยให้ boot ฟังเองได้)
    if (btnExit){
      btnExit.onclick = () => { try { elSumOverlay.classList.remove('show'); } catch {} };
    }
    if (btnReplay){
      btnReplay.onclick = () => { try { elSumOverlay.classList.remove('show'); } catch {} };
    }
  }

  // ---------------- events ----------------

  // score event (unified)
  root.addEventListener('hha:score', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};

    if (d.score != null)      sScore = d.score|0;
    if (d.comboMax != null)   sComboMax = d.comboMax|0;
    else if (d.combo != null) sComboMax = Math.max(sComboMax|0, d.combo|0); // fallback
    if (d.misses != null)     sMiss = d.misses|0;
    if (d.goodHits != null)   sGoodHits = d.goodHits|0;

    if (d.fever != null)      sFever = clamp(d.fever, 0, 100);
    if (d.shield != null)     sShield = Number(d.shield)||0;

    // optional meta echoes
    if (d.diff != null) meta.diff = String(d.diff);
    if (d.challenge != null) meta.challenge = String(d.challenge);
    if (d.run != null) meta.run = String(d.run).toUpperCase();

    renderTop();
    renderFever();
    renderShield();
    renderMeta();
  });

  // time label support (your HTML uses TIME pill; we accept either hha:time or d.timeLeft)
  root.addEventListener('hha:time', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.left != null){
      meta.time = String(Math.max(0, d.left|0));
      renderMeta();
    }
  });

  // quest update (unified)
  root.addEventListener('quest:update', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    qQuestOk = (d.questOk !== false);

    // accept either d.goal/d.mini or d.main/d.mini
    qGoal = d.goal || d.main || null;
    qMini = d.mini || null;

    // mini counter optional
    if (qMini && d.miniCleared != null) qMini.cleared = d.miniCleared;
    if (qMini && d.miniTotal != null)   qMini.total = d.miniTotal;

    renderQuest();
  });

  // coach messages
  root.addEventListener('hha:coach', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const text = (d.text != null) ? String(d.text) : '';
    if (!text && !d.mood) return;

    // infer mood if not set
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

  // fever compat (ui-fever.js might emit this)
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

  // stun / danger
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
    if (d.hpMax != null) boss.hpMax = Number(d.hpMax)||0;
    if (d.phase != null) boss.phase = String(d.phase);
    renderBoss();

    // optional ring/laser cues
    if (d.ring != null){
      // d.ring: { on:true, gapStart:deg, gapSize:deg }
      showAtkRing(!!d.ring.on, d.ring.gapStart, d.ring.gapSize);
    }
    if (d.laser != null){
      // d.laser: 'warn'|'fire'|'' 
      showLaser(d.laser);
    }
    if (d.beacon != null){
      showBossBeacon(!!d.beacon);
    }
  });

  // logger status (optional from hha-cloud-logger.js)
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

  // end summary (unified)
  root.addEventListener('hha:end', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};

    // update cached for summary
    if (d.scoreFinal != null) sScore = d.scoreFinal|0;
    if (d.comboMax != null) sComboMax = d.comboMax|0;
    if (d.misses != null) sMiss = d.misses|0;
    if (d.goodHits != null) sGoodHits = d.goodHits|0;

    // hide boss visuals
    showAtkRing(false);
    showLaser('');
    showBossBeacon(false);
    flashStun(false);

    // mood by grade if sent
    const g = safeUpper(d.grade || '');
    if (g === 'SSS' || g === 'SS' || g === 'S') setCoachMood('happy');
    else if ((d.misses|0) >= 8) setCoachMood('sad');
    else setCoachMood('neutral');

    renderTop();
    renderFever();
    renderShield();
    renderQuest();
    renderBoss();
    openSummary(d);
  });

  // ---------------- initial paint ----------------
  renderTop();
  renderMeta();
  renderFever();
  renderShield();
  renderQuest();
  renderBoss();

  // default coach
  if (elCoachImg && !elCoachImg.style.backgroundImage){
    setStyle(elCoachImg, 'backgroundImage', `url('${COACH_IMG.neutral}')`);
  }

})(window);
