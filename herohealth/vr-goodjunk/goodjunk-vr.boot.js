// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { attachTouchLook } from './touch-look-goodjunk.js';
import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

export default function bootGoodJunkVR(){
  'use strict';
  if (window.__GJ_BOOTED__) return;
  window.__GJ_BOOTED__ = true;

  const $ = (id)=>document.getElementById(id);
  const scene = document.querySelector('a-scene');
  const camEl = document.querySelector('#gj-camera');
  const layerEl = $('gj-layer');

  // HUD
  const elScore = $('hud-score');
  const elCombo = $('hud-combo');
  const elMiss  = $('hud-miss');
  const elTime  = $('hud-time-label');
  const elJudge = $('hud-judge');
  const elDiff  = $('hud-diff-label');
  const elChal  = $('hud-challenge-label');
  const elRunLabel = $('hud-run-label');
  const elPill = $('hud-pill');

  const elQuestMain = $('hud-quest-main');
  const elQuestMini = $('hud-quest-mini');
  const elQuestMainBar = $('hud-quest-main-bar');
  const elQuestMiniBar = $('hud-quest-mini-bar');
  const elQuestMainCap = $('hud-quest-main-caption');
  const elQuestMiniCap = $('hud-quest-mini-caption');
  const elQuestHint = $('hud-quest-hint');
  const elMiniCount = $('hud-mini-count');
  const elMiniWhy = $('hud-mini-why');

  // Fever HUD bits
  const feverFill = $('fever-fill');
  const feverPct  = $('fever-pct');
  const shieldCount = $('shield-count');
  const stunRow = $('stun-row');
  const stunFill = $('stun-fill');
  const stunPct  = $('stun-pct');
  const stunPill = $('hud-stun-pill');

  const coachBubble = $('coach-bubble');
  const coachEmoji  = $('coach-emoji');
  const coachText   = $('coach-text');

  const hint = $('touch-hint');
  const startOverlay = $('start-overlay');
  const btnStart2D = $('btn-start-2d');
  const btnStartVR = $('btn-start-vr');
  const selDiff = $('sel-diff');
  const selChallenge = $('sel-challenge');
  const countdown = $('start-countdown');

  const btnVR = $('btn-vr');

  // params from hub
  const url = new URL(location.href);
  const RUN_MODE = (url.searchParams.get('run') || 'play').toLowerCase(); // play|research
  const DIFF_URL = (url.searchParams.get('diff') || '').toLowerCase();
  const CH_URL   = (url.searchParams.get('ch') || url.searchParams.get('challenge') || '').toLowerCase();
  const TIME_URL = parseInt(url.searchParams.get('time') || '', 10);

  const DEFAULT_TIME = { easy:80, normal:60, hard:50 };
  const clamp=(v,min,max)=>{ v=Number(v)||0; if(v<min) return min; if(v>max) return max; return v; };
  const normDiff=(v)=>['easy','normal','hard'].includes(v)?v:'normal';
  const normCh=(v)=>['rush','boss','survival'].includes(v)?v:'rush';
  const normRun=(v)=> (v==='research'?'research':'play');

  const initDiff = normDiff(DIFF_URL || 'normal');
  const initCh   = normCh(CH_URL || 'rush');
  const initTime = clamp(Number.isFinite(TIME_URL)?TIME_URL:(DEFAULT_TIME[initDiff]||60), 20, 180);

  if (selDiff) selDiff.value = initDiff;
  if (selChallenge) selChallenge.value = initCh;

  function celebrate(kind){
    try{
      const P = (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
      P?.celebrate?.(kind, { title: kind==='goal'?'🎉 GOAL CLEARED!':'✨ MINI CLEARED!', sub:'ไปต่อเลย!' });
    }catch(_){}
  }

  // coach
  const COACH = {
    neutral:'./img/coach-neutral.png',
    happy:'./img/coach-happy.png',
    sad:'./img/coach-sad.png',
    fever:'./img/coach-fever.png'
  };
  let coachTimer = 0;
  function say(text, mood='neutral'){
    if (coachBubble) coachBubble.classList.add('show');
    if (coachText) coachText.textContent = text || '';
    if (coachEmoji) coachEmoji.style.backgroundImage = `url('${COACH[mood] || COACH.neutral}')`;
    if (coachTimer) clearTimeout(coachTimer);
    coachTimer = setTimeout(()=> coachBubble && coachBubble.classList.remove('show'), 3600);
  }

  function runCountdown(done){
    if (!countdown){ done(); return; }
    const steps = ['3','2','1','Go!'];
    let i=0;
    countdown.classList.remove('countdown-hidden');
    countdown.textContent = steps[i];
    const t = setInterval(()=>{
      i++;
      if (i>=steps.length){
        clearInterval(t);
        countdown.classList.add('countdown-hidden');
        done();
      }else countdown.textContent = steps[i];
    }, 650);
  }

  if (btnVR && scene){
    btnVR.addEventListener('click', async ()=>{
      try{ await scene.enterVR(); }catch(_){}
    });
  }

  // state for QuestDirector
  const qState = {
    score:0, goodHits:0, miss:0, comboMax:0,
    timeLeft:initTime,
    streakGood:0,
    goldHitsThisMini:false,
    blocks:0,
    usedMagnet:false,
    timePlus:0,
    safeNoJunkSeconds:0,
    bossCleared:false,
    challenge:initCh,
    runMode:normRun(RUN_MODE),
    final8Good:0
  };

  let lastMiss = 0;
  let running = false;
  let engine = null;
  let lookCtl = null;

  // safeNoJunkSeconds tick (รีเซ็ตเมื่อโดน junk)
  setInterval(()=>{
    if (!running) return;
    if ((qState.timeLeft|0) <= 0) return;
    qState.safeNoJunkSeconds = (qState.safeNoJunkSeconds|0) + 1;
  }, 1000);

  // QuestDirector
  let Q = makeQuestDirector({
    diff: initDiff,
    challenge: initCh,
    goalDefs: GOODJUNK_GOALS,
    miniDefs: GOODJUNK_MINIS,
    maxGoals: 2,
    maxMini: 999
  });
  Q.start(qState);

  // WHY helper
  function setWhy(txt){ if (elMiniWhy) elMiniWhy.textContent = txt || ''; }
  function miniWhy(m){
    if (!m || m.state === 'clear') return '✅ ผ่านแล้ว';
    const cur = Number(m.cur||0);
    const max = Number(m.max||0);
    const left = Math.max(0, max - cur);
    switch(String(m.id||'')){
      case 'm1': return `เหลืออีก ${left} ชิ้น (ห้ามพลาด/หมดอายุ)`;
      case 'm2': return qState.goldHitsThisMini ? '✅ ได้ GOLD แล้ว' : 'ยังไม่ได้ GOLD ในมินินี้';
      case 'm3': return `รอดอีก ${left} วิ (โดน junk/fake = รีเซ็ต)`;
      case 'm4': return `BLOCK อีก ${left} ครั้ง`;
      case 'm5': return qState.usedMagnet ? `หลังใช้ 🧲 เหลืออีก ${left} ชิ้น` : 'ยังไม่ได้ใช้ 🧲';
      case 'm6': return `ใช้ ⏳ อีก ${left} ครั้ง`;
      case 'm7': return qState.bossCleared ? '✅ เคลียร์บอสแล้ว' : 'ยังไม่เคลียร์บอส';
      case 'm8': return `ช่วง 8 วิท้าย เหลืออีก ${left} ชิ้น`;
      default:   return `เหลืออีก ${left}`;
    }
  }

  // Quest HUD update
  window.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    const g = d.goal || null;
    const m = d.mini || null;
    const meta = d.meta || {};
    if (g){
      if (elQuestMain) elQuestMain.textContent = g.title || 'Goal';
      if (elQuestHint) elQuestHint.textContent = g.hint || '';
      if (elQuestMainCap) elQuestMainCap.textContent = `${g.cur|0} / ${g.max|0}`;
      if (elQuestMainBar) elQuestMainBar.style.width = `${Math.round((g.pct||0)*100)}%`;
    }
    if (m){
      if (elQuestMini) elQuestMini.textContent = `Mini: ${m.title || '—'}`;
      if (elQuestMiniCap) elQuestMiniCap.textContent = `${m.cur|0} / ${m.max|0}`;
      if (elQuestMiniBar) elQuestMiniBar.style.width = `${Math.round((m.pct||0)*100)}%`;
      setWhy(miniWhy(m));
    }else{
      setWhy('');
    }
    if (elMiniCount){
      elMiniCount.textContent = `mini ผ่าน ${meta.minisCleared|0} • เล่นอยู่ ${(meta.miniCount|0)+1}`;
    }
  });

  window.addEventListener('quest:cleared', (e)=>{
    const d = e.detail || {};
    celebrate(d.kind || 'mini');
    say(d.kind==='goal' ? 'ภารกิจหลักผ่าน! เก่งมาก! 🎉' : 'มินิเควสต์ผ่าน! ไปต่อ! ⚡', 'happy');
  });

  window.addEventListener('quest:miniStart', ()=>{
    qState.goldHitsThisMini = false;
    qState.usedMagnet = false;
    qState.timePlus = 0;
    qState.blocks = 0;
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    setWhy('');
  });

  // hit events
  window.addEventListener('quest:goodHit', (e)=>{
    const kind = String(e.detail?.kind || 'good');
    if (kind === 'gold') qState.goldHitsThisMini = true;
    qState.streakGood = (qState.streakGood|0) + 1;
    if ((qState.timeLeft|0) <= 8) qState.final8Good = (qState.final8Good|0) + 1;
    Q.tick(qState);
  });

  window.addEventListener('quest:badHit', ()=>{
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    Q.tick(qState);
  });

  window.addEventListener('quest:block', ()=>{
    qState.blocks = (qState.blocks|0) + 1;
    Q.tick(qState);
  });

  window.addEventListener('quest:power', (e)=>{
    const p = String(e.detail?.power || '');
    if (p === 'magnet') qState.usedMagnet = true;
    if (p === 'time') qState.timePlus = (qState.timePlus|0) + 1;
    Q.tick(qState);
  });

  window.addEventListener('quest:bossClear', ()=>{
    qState.bossCleared = true;
    say('บอสแตกแล้ววว! 👑🔥', 'happy');
    Q.tick(qState);
  });

  // score/time/judge
  window.addEventListener('hha:judge', (e)=>{
    if (elJudge) elJudge.textContent = String(e.detail?.label || '').trim() || ' ';
  });

  window.addEventListener('hha:time', (e)=>{
    qState.timeLeft = e.detail?.sec ?? 0;
    if (elTime) elTime.textContent = `${qState.timeLeft|0}s`;
    if ((qState.timeLeft|0) <= 0){
      running = false;
      say('หมดเวลา! สรุปคะแนนด้านบนเลย ✅', 'neutral');
    }
    Q.tick(qState);
  });

  window.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    qState.score = d.score|0;
    qState.goodHits = d.goodHits|0;
    qState.miss = d.misses|0;
    qState.comboMax = d.comboMax|0;

    if (elScore) elScore.textContent = String(qState.score|0);
    if (elCombo) elCombo.textContent = String(qState.comboMax|0);
    if (elMiss)  elMiss.textContent  = String(qState.miss|0);

    if ((qState.miss|0) > (lastMiss|0)){
      qState.streakGood = 0;
      lastMiss = qState.miss|0;
    }
    Q.tick(qState);
  });

  // ✅ Step 4: FEVER HUD + fire overlay
  window.addEventListener('hha:fever', (e)=>{
    const d = e.detail || {};
    const fever = Math.max(0, Math.min(100, Number(d.fever)||0));
    const shield = Math.max(0, Number(d.shield)||0);
    const active = !!d.active;

    if (feverFill) feverFill.style.width = `${Math.round(fever)}%`;
    if (feverPct) feverPct.textContent = `${Math.round(fever)}%`;
    if (shieldCount) shieldCount.textContent = String(shield|0);

    document.body.classList.toggle('fever-on', active);
    if (stunRow) stunRow.style.display = active ? '' : 'none';
    if (stunPill) stunPill.style.display = active ? '' : 'none';
  });

  // ✅ Step 4: STUN bar update (left ms)
  window.addEventListener('hha:stun', (e)=>{
    const d = e.detail || {};
    const active = !!d.active;
    const leftMs = Math.max(0, Number(d.leftMs)||0);
    const durMs  = Math.max(1, Number(d.durMs)||1);
    const pct = Math.max(0, Math.min(1, leftMs / durMs));

    if (stunFill) stunFill.style.width = `${Math.round(pct*100)}%`;
    if (stunPct)  stunPct.textContent = `${(leftMs/1000).toFixed(1)}s`;
    if (stunRow)  stunRow.style.display = active ? '' : 'none';
    if (stunPill) stunPill.style.display = active ? '' : 'none';
  });

  function startGame({ diff, challenge, time, wantVR }){
    if (!layerEl) return;

    qState.challenge = challenge;
    qState.timeLeft = time;
    running = true;
    lastMiss = 0;

    if (elDiff) elDiff.textContent = diff.toUpperCase();
    if (elChal) elChal.textContent = challenge.toUpperCase();
    if (elRunLabel) elRunLabel.textContent = (qState.runMode==='research' ? 'RESEARCH' : 'PLAY');
    if (elPill) elPill.classList.toggle('research', qState.runMode==='research');

    if (!lookCtl && camEl){
      lookCtl = attachTouchLook(camEl, {
        areaEl: layerEl,
        sensitivity: 1.0,
        inertia: 0.92,
        gyroSmoothing: 0.12,
        pitchLimit: 1.15,
        showHint: (on)=>{ if (!hint) return; hint.classList.toggle('show', !!on); }
      });
      window.__GJ_LOOK__ = lookCtl;
    }

    try{ engine?.stop?.(); }catch(_){}
    engine = goodjunkBoot({ diff, run: qState.runMode, challenge, time, layerEl });

    Q = makeQuestDirector({
      diff, challenge,
      goalDefs: GOODJUNK_GOALS,
      miniDefs: GOODJUNK_MINIS,
      maxGoals: 2,
      maxMini: 999
    });
    Q.start(qState);

    say('เริ่มแล้ว! ลากเพื่อหมุนมุมมอง แล้วแตะเป้าเลย ⚡', 'neutral');
    if (wantVR && scene){ try{ scene.enterVR(); }catch(_){} }
  }

  function onStart(wantVR){
    const diff = normDiff(selDiff?.value || initDiff);
    const ch   = normCh(selChallenge?.value || initCh);
    const time = clamp(initTime, 20, 180);

    try{ lookCtl?.requestGyroPermission?.(); }catch(_){}

    if (startOverlay) startOverlay.style.display = 'none';
    runCountdown(()=> startGame({ diff, challenge: ch, time, wantVR }));
  }

  if (btnStart2D) btnStart2D.addEventListener('click', ()=> onStart(false));
  if (btnStartVR) btnStartVR.addEventListener('click', ()=> onStart(true));

  document.addEventListener('pointerdown', ()=>{
    try{ lookCtl?.requestGyroPermission?.(); }catch(_){}
  }, { once:true, passive:true });

  setTimeout(()=>{ if (hint) hint.classList.add('show'); setTimeout(()=> hint && hint.classList.remove('show'), 1800); }, 900);
}
