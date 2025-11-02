// === game/main.js (ส่วนเสริมให้ Quests นับ gold/power + penalty + Result summary) ===
// ... (โค้ดเดิมด้านบนของไฟล์คุณคงไว้) ...

// ---------- Bus ----------
function busFor(){
  return {
    sfx:R.sys.sfx,
    hit:function(e){
      const pts=(e && e.points)|0;
      if(pts){
        R.sys.score.add(pts);
        R.sys.score.combo=(R.sys.score.combo|0)+1;
        if((R.sys.score.combo|0)>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo|0;
      }

      // แจ้ง combo ปัจจุบันให้ Quests
      try{ Quests.event('combo', { now: (R.sys.score.combo|0) }); }catch{}

      // แจ้ง Hit (รวม gold/power ผ่าน kind:'gold' หรือ meta.golden)
      try{
        Quests.event('hit',{
          kind: (e && e.kind) || 'good',
          points: pts,
          meta: e && e.meta ? e.meta : {}
        });
      }catch{}

      // UI
      if(e && e.ui) hud?.showFloatingText(e.ui.x, e.ui.y, '+'+pts);
      setBadges();
      // stars HUD
      try{ const snap = Quests.getStatSnapshot(); hud?.setStars?.(snap.stars|0); }catch{}
    },
    // MISS = สำหรับ good ที่หมดเวลา (goodjunk จะเรียก miss เฉพาะกรณีนี้)
    miss:function(info){
      R.sys.score.combo=0;
      try{ Quests.event('miss', info||{}); Quests.event('combo', { now: 0 }); }catch{}
      setBadges();
    },
    // โทษจากการคลิก junk
    penalty:function(info){
      R.sys.score.combo=0;
      try{ Quests.event('penalty', info||{ kind:'junk' }); Quests.event('combo', { now: 0 }); }catch{}
      setBadges();
    },
    power:function(k){ try{ Quests.event('power',{kind:k}); }catch{} }
  };
}

// ---------- Loop ----------
function gameTick(){
  if(!R.playing) return;
  const tNow=performance.now();

  const secGone=Math.floor((tNow-R._secMark)/1000);
  if(secGone>=1){
    R.remain=Math.max(0,(R.remain|0)-secGone);
    R._secMark=tNow;

    // HUD timer
    try{ hud?.setTimer?.(R.remain); }catch{}
    setBadges();

    if(R.remain===10) R.coach?.onTimeLow?.();

    // feed Quests tick
    try{ Quests.tick({ score:(R.sys.score.get ? R.sys.score.get() : 0), dt:secGone, fever:R.feverActive }); }catch{}
  }

  try{
    const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
    if(R.modeAPI && typeof R.modeAPI.update==='function'){ R.modeAPI.update(dt,busFor()); }
    else if(R.modeInst && typeof R.modeInst.update==='function'){ R.modeInst.update(dt,busFor()); }
    else if(R.modeAPI && typeof R.modeAPI.tick==='function'){ R.modeAPI.tick(R.state||{}, R.sys, hud||{}); }
  }catch(e){ console.warn('[mode.update] error',e); }

  if(R.remain<=0) { endGame(); return; }
  R.raf=requestAnimationFrame(gameTick);
}

// ---------- Fever toggle helper ----------
function setFever(on){
  R.feverActive = !!on;
  try{ Quests.event('fever', { on: R.feverActive }); }catch{}
  try{ hud?.showFever?.(R.feverActive); }catch{}
  // (ถ้าต้องมี BGM/ธีมสั้น ๆ ให้เติมที่นี่)
}

// ---------- End game ----------
function endGame(){
  if(!R.playing) return;
  R.playing=false; cancelAnimationFrame(R.raf);
  const score=(R.sys && R.sys.score && R.sys.score.get)?R.sys.score.get():0;
  const bestC=(R.sys && R.sys.score && R.sys.score.bestCombo)|0;

  try{ if(R.modeInst && R.modeInst.cleanup) R.modeInst.cleanup(); if(R.modeAPI && R.modeAPI.cleanup) R.modeAPI.cleanup(R.state,hud); }catch{}
  // ✅ ขอ summary จาก Quests (รวม gold/stars/quests)
  let qSum=null;
  try{ qSum = Quests.endRun({ score }); }catch{}

  try{ R.coach?.onEnd?.(score); }catch{}
  try{ Progress.endRun({ score:score, bestCombo:bestC }); }catch{}

  document.body.removeAttribute('data-playing');
  const mb = document.getElementById('menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }

  // ✅ แสดง Result พร้อม Stat + Quest Summary
  const stats = [
    'Score: '+score,
    'Best Combo: '+bestC,
    'Time: '+(R.matchTime|0)+'s'
  ];
  const extra = [];
  if(qSum){
    stats.push('Quests done: '+qSum.totalDone+'/3');
    extra.push('Stars: '+(qSum.stars|0));
    extra.push('Gold taps: '+(qSum.hitsGold|0));
    extra.push('Penalties: '+(qSum.penalties|0));
    extra.push('Misses: '+(qSum.misses|0));
    if(Array.isArray(qSum.selected)){
      qSum.selected.forEach(q=>{
        extra.push(`${q.done?'✅':'❌'} ${q.label} (${q.progress}/${q.need})`);
      });
    }
  }

  try{
    hud?.showResult({
      title:'Result',
      desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
      stats, extra
    });
    hud.onHome = ()=>{ hud.hideResult(); const m2=document.getElementById('menuBar'); if(m2){ m2.removeAttribute('data-hidden'); m2.style.display='flex'; } };
    hud.onRetry = ()=>{ hud.hideResult(); startGame(); };
  }catch{}

  window.HHA._busy=false;
}

// ---------- Start game ----------
async function startGame(){
  if(window.HHA && window.HHA._busy) return;
  if(!window.HHA) window.HHA = {};
  window.HHA._busy=true;

  await loadCore();
  try{ Progress.init(); }catch{}

  R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
  R.diff    = document.body.getAttribute('data-diff') || 'Normal';

  R.matchTime = getMatchTime(R.modeKey,R.diff);
  R.remain    = R.matchTime|0;

  if(!hud) hud = new HUDClass();
  hud.hideResult?.();
  hud.setTop?.({ mode:R.modeKey, diff:R.diff });
  hud.setTimer?.(R.remain);
  hud.updateHUD?.(0,0);
  hud.setStars?.(0);
  hud.resetBars?.();

  // โหลดโหมด
  let api=null;
  try { api = await loadMode(R.modeKey); }
  catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
  R.modeAPI = api;

  // systems
  R.sys.score = new (ScoreSystem||function(){})();
  R.sys.score.reset?.();
  R.sys.sfx   = new (SFXClass||function(){})();
  R.sys.score.combo=0; R.sys.score.bestCombo=0;
  R.feverActive=false; R.feverBreaks=0;

  // HUD countdown
  try{ await hud.showCountdown?.(['3','2','1','GO']); }catch{}

  // coach / quests
  R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
  R.coach?.onStart?.();

  try { Quests.bindToMain({ hud, coach:R.coach }); }catch{}
  try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch{}

  // สร้าง/เริ่มโหมด
  R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
  if(api && typeof api.create==='function'){
    R.modeInst = api.create({ engine:{}, hud, coach:R.coach });
    R.modeInst.start?.({ time:R.matchTime, difficulty:R.diff });
  } else if(api && typeof api.init==='function'){
    api.init(R.state, hud, { time:R.matchTime, life:1600 });
  } else if(api && typeof api.start==='function'){
    api.start({ time:R.matchTime, difficulty:R.diff });
  }

  // RUN
  R.playing=true;
  R.startedAt=performance.now();
  R._secMark =performance.now();
  R._dtMark  =performance.now();

  // ปิดเมนู
  const mb = document.getElementById('menuBar');
  if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  requestAnimationFrame(gameTick);
}

// expose
window.HHA = window.HHA || {};
window.HHA.startGame = startGame;
window.HHA.endGame   = endGame;

// ... (โค้ดส่วนอื่นคงเดิม) ...
