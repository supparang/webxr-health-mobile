// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR Engine — ULTRA (DOM) + Boss + Power-ups + Coach + Pattern Minis
// ✅ Boss bar UI (#bossWrap/#bossBar/#bossTxt)
// ✅ Perfect Clean streak in boss phase => x2 bonus
// ✅ AI Coach micro-tips (rate-limited, explainable)
// ✅ Mini pattern rotator (seeded): COMBO / SAFE / POWER / BOSS

export function createHygieneGame(opts){
  'use strict';
  const DOC = document;
  const WIN = window;

  const stage = opts.stage;
  const targetsEl = opts.targetsEl;
  const ui = opts.ui || {};
  const P = opts.params || {};

  const GAME_ID = 'hygiene';
  const VERSION = '1.2.0-ultra';

  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const nowMs = ()=> performance.now ? performance.now() : Date.now();

  // deterministic-ish RNG
  const rnd = (()=> {
    let s = 0;
    const raw = String(P.seed||'').trim();
    if(raw) {
      let n = 0;
      for(let i=0;i<raw.length;i++) n = (n*131 + raw.charCodeAt(i)) >>> 0;
      s = (n || 123456789) >>> 0;
    } else {
      s = (Date.now() ^ (Math.random()*1e9)) >>> 0;
    }
    return {
      f(){ s = (1664525*s + 1013904223) >>> 0; return (s / 4294967296); },
      i(a,b){ return (a + Math.floor(this.f()*(b-a+1))); }
    };
  })();

  // ---- state ----
  let running=false, tStart=0, tEndAt=0, lastTick=0;
  let score=0, combo=0, comboMax=0, misses=0;
  let goalsCleared=0, goalsTotal=2;
  let miniCleared=0, miniTotal=2;
  let goodHits=0, badHits=0;

  // powerups
  let shield=0, magnetUntil=0, slowUntil=0, slowFactor=1.0, powerPickups=0;

  // boss
  let bossActive=false, bossClears=0, bossHp=0, bossMaxHp=12, bossId=null;
  let bossCleanedByGood=0;
  let bossPerfectStreak=0; // ULTRA: counts consecutive good hits during boss
  let bossPerfectBest=0;

  let spawnTimer=0;

  // ULTRA: coach (rate limit)
  let lastCoachAt=0;
  const COACH_COOLDOWN_MS = 3200;

  // ULTRA: mini pattern rotator (seeded)
  const MINI_PATTERNS = ['combo8','safe6s','power2','boss_clean'];
  let miniPatternOrder = [];
  let activeMiniKey = null;
  let safeStreakMs=0, lastBadAt=0;

  const spawnRect = { x0: 64, y0: 160, x1: 0, y1: 0 };
  function computeSpawnRect(){
    const w=WIN.innerWidth, h=WIN.innerHeight;
    spawnRect.x0=64;
    spawnRect.y0=160;            // leave HUD space
    spawnRect.x1=Math.max(spawnRect.x0+80, w-64);
    spawnRect.y1=Math.max(spawnRect.y0+120, h-150); // leave quest
  }

  // ---- UI helpers ----
  function setText(el,s){ if(el) el.textContent=String(s); }
  function fmtTime(sec){
    sec=Math.max(0,Math.floor(sec));
    const m=Math.floor(sec/60), s=sec%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  // ULTRA: bind boss bar elements if exist
  const bossWrap = DOC.getElementById('bossWrap');
  const bossBar  = DOC.getElementById('bossBar');
  const bossTxt  = DOC.getElementById('bossTxt');

  const coachBubble = DOC.getElementById('coachBubble');
  const coachText   = DOC.getElementById('coachText');

  function coachSay(msg){
    const t=nowMs();
    if(t-lastCoachAt < COACH_COOLDOWN_MS) return;
    lastCoachAt = t;

    if(coachBubble && coachText){
      coachText.textContent = msg;
      coachBubble.style.display = 'block';
      // auto-hide
      clearTimeout(coachSay._t);
      coachSay._t = setTimeout(()=>{ coachBubble.style.display='none'; }, 2600);
    }

    // also emit for research hooks if needed later
    try{ WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ msg } })); }catch(_){}
  }

  function powerText(){
    const t=nowMs();
    const mag=Math.max(0,Math.ceil((magnetUntil-t)/1000));
    const slo=Math.max(0,Math.ceil((slowUntil-t)/1000));
    const parts=[];
    if(shield>0) parts.push(`🛡️${shield}`);
    if(mag>0) parts.push(`🧲${mag}s`);
    if(slo>0) parts.push(`⏳${slo}s`);
    return parts.length ? parts.join(' • ') : '—';
  }

  function updateBossUI(){
    if(!bossWrap || !bossBar || !bossTxt) return;

    if(!bossActive){
      bossWrap.style.display = 'none';
      return;
    }
    bossWrap.style.display = 'block';
    bossTxt.textContent = `HP ${bossHp}/${bossMaxHp} • Perfect ${bossPerfectStreak}`;
    const pct = Math.max(0, Math.min(1, bossHp / Math.max(1,bossMaxHp)));
    bossBar.style.width = `${(pct*100).toFixed(1)}%`;

    // warning shake feel (simple)
    if(pct <= 0.25){
      bossWrap.style.borderColor = 'rgba(239,68,68,.45)';
    }else{
      bossWrap.style.borderColor = 'rgba(148,163,184,.16)';
    }
  }

  function updateHUD(){
    const left = Math.max(0, Math.ceil((tEndAt-nowMs())/1000));
    setText(ui.kTime, fmtTime(left));
    setText(ui.kScore, score|0);
    setText(ui.kCombo, combo|0);
    setText(ui.kMiss, misses|0);
    setText(ui.bGoal, `Goal ${goalsCleared}/${goalsTotal}${bossActive?` • BOSS ${bossHp}/${bossMaxHp}`:''}`);
    setText(ui.bMini, `Mini ${miniCleared}/${miniTotal}`);
    setText(ui.bMode, `Survival • ${String(P.diff||'normal')}`);

    // keep questHint showing power state (อ่านง่าย)
    if(ui.questHint){
      const base = ui.questHint.dataset.base || ui.questHint.textContent || '';
      ui.questHint.dataset.base = base;
      ui.questHint.textContent = `${base} • Power: ${powerText()}`;
    }

    updateBossUI();

    // Challenge HUD realtime
    WIN.HHA_CHAL?.onState?.({ misses, comboMax, goalsCleared, miniCleared });
  }

  function setQuest(text, hint=''){
    setText(ui.questText, text);
    setText(ui.questHint, hint);
    if(ui.questHint) ui.questHint.dataset.base = hint;
  }

  // ---- live targets ----
  let nextId=1;
  const live = new Map(); // id -> {id, kind, subtype, x,y, born, ttlMs, el}

  function makeTarget(kind, subtype=null, fixedXY=null){
    const id = nextId++;
    const el = DOC.createElement('div');

    let cls='t';
    if(kind==='good') cls+=' good';
    else cls+=' bad';

    el.className = cls;

    let emoji='🫧';
    if(kind==='bad') emoji='🦠';
    if(kind==='boss') emoji='☣️';
    if(kind==='power'){
      emoji = (subtype==='shield')?'🛡️':(subtype==='magnet')?'🧲':'⏳';
    }

    el.innerHTML = `<div class="ring"></div><div class="emoji">${emoji}</div>`;
    el.dataset.id = String(id);
    targetsEl.appendChild(el);

    let x,y;
    if(fixedXY){ x=fixedXY.x; y=fixedXY.y; }
    else { x=rnd.i(spawnRect.x0, spawnRect.x1); y=rnd.i(spawnRect.y0, spawnRect.y1); }

    let s=1.0;
    if(kind==='good') s=0.95+rnd.f()*0.35;
    if(kind==='bad')  s=0.95+rnd.f()*0.40;
    if(kind==='power') s=0.92+rnd.f()*0.25;
    if(kind==='boss') s=1.55;

    el.style.setProperty('--x', x);
    el.style.setProperty('--y', y);
    el.style.setProperty('--s', s.toFixed(3));

    let ttlMs=1400;
    if(kind==='bad') ttlMs=1600;
    if(kind==='power') ttlMs=2200;
    if(kind==='boss') ttlMs=999999;

    const diffMul = (P.diff==='easy')?1.18:(P.diff==='hard')?0.85:1.0;
    ttlMs = Math.floor(ttlMs * diffMul);

    if(nowMs() < slowUntil) ttlMs += 450;

    const obj={ id, kind, subtype, x, y, born: nowMs(), ttlMs, el };
    live.set(id,obj);

    el.addEventListener('click', (e)=>{
      e.preventDefault();
      onHit(id,'tap');
    }, { passive:false });

    return obj;
  }

  function removeTarget(id, reason=''){
    const t = live.get(id);
    if(!t) return;

    if(t.kind==='boss') bossId=null;

    live.delete(id);
    try{ t.el.style.opacity='0'; }catch(_){}
    try{ setTimeout(()=>t.el.remove(), 80); }catch(_){}

    if(reason==='expire' && t.kind==='good'){
      if(shield>0){
        shield--;
        coachSay('🛡️ กันพลาดให้แล้ว! ระวังตอน 🫧 จะหายไว ๆ');
      }else{
        misses++; combo=0;
        coachSay('😵 พลาด! ลองเล็งให้ชัวร์ก่อนแตะ/ยิงนะ');
      }
      WIN.HHA_CHAL?.onState?.({ misses, comboMax });
    }
  }

  // ---- minis (ULTRA pattern) ----
  function buildMiniOrder(){
    // seeded shuffle
    const arr = MINI_PATTERNS.slice();
    for(let i=arr.length-1;i>0;i--){
      const j = rnd.i(0,i);
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    miniPatternOrder = arr;
    activeMiniKey = miniPatternOrder[0] || 'combo8';
  }

  function miniDescribe(key){
    switch(key){
      case 'combo8': return 'ทำ ComboMax ให้ถึง 8';
      case 'safe6s': return 'หลบ 🦠 ให้ได้ 6 วินาทีติด';
      case 'power2': return 'เก็บ Power-up ให้ได้ 2 ครั้ง';
      case 'boss_clean': return 'ตอน Boss: ทำ Perfect 5 เพื่อรับ x2';
      default: return 'ภารกิจพิเศษ';
    }
  }

  function tryAdvanceMini(){
    // if current mini satisfied => miniCleared++ and next
    if(miniCleared >= miniTotal) return;

    const key = activeMiniKey;
    let ok=false;

    if(key==='combo8') ok = (comboMax >= 8);
    if(key==='safe6s') ok = (safeStreakMs >= 6000);
    if(key==='power2') ok = (powerPickups >= 2);
    if(key==='boss_clean') ok = (bossPerfectBest >= 5);

    if(ok){
      miniCleared++;
      coachSay(`✅ ผ่าน Mini: ${miniDescribe(key)}!`);
      const next = miniPatternOrder[miniCleared] || null;
      activeMiniKey = next;
      if(next){
        setQuest(`Mini ใหม่: ${miniDescribe(next)}`, 'ทำให้สำเร็จก่อนเวลาหมด!');
      }else{
        setQuest('Mini ครบแล้ว! เน้นทำคะแนน + อยู่รอด', 'สุดท้ายมี Boss มาท้าทาย 😈');
      }
    }
  }

  // ---- boss ----
  function bossStart(){
    if(bossActive) return;
    bossActive=true;
    bossHp=bossMaxHp;
    bossCleanedByGood=0;
    bossPerfectStreak=0;

    const cx = Math.round(WIN.innerWidth/2);
    const cy = Math.round(WIN.innerHeight/2);
    const b = makeTarget('boss', null, {x:cx, y:cy});
    bossId = b.id;

    setQuest('👾 BOSS มาแล้ว! ล้างให้ทัน!', 'เก็บ 🫧 ต่อเนื่อง = Perfect (โบนัส x2)');
    coachSay('👾 Boss มาแล้ว! โฟกัส 🫧 อย่างเดียว ห้ามจิ้มมั่ว!');
    updateHUD();
  }

  function bossHitProgress(){
    if(!bossActive) return;

    bossHp = Math.max(0, bossHp - 1);
    bossCleanedByGood++;

    // ULTRA: perfect streak grows with consecutive GOOD hits during boss
    bossPerfectStreak++;
    bossPerfectBest = Math.max(bossPerfectBest, bossPerfectStreak);

    // Perfect bonus every 5 streaks (kid-feel reward)
    if(bossPerfectStreak > 0 && bossPerfectStreak % 5 === 0){
      score += 40;
      coachSay('✨ PERFECT CLEAN x2! (โบนัส +40)');
    }

    if(bossHp <= 0){
      bossClears++;
      score += 180;
      combo += 3;
      comboMax = Math.max(comboMax, combo);

      if(bossId!=null) removeTarget(bossId,'');
      bossActive=false;

      coachSay('🏆 ล้าง Boss สำเร็จ! เก่งมาก!');
      setQuest('🏆 ล้าง Boss สำเร็จ!', 'อยู่รอดต่อจนจบเวลา');
    }

    updateBossUI();
  }

  function onBadHitPenalty(){
    // shield blocks
    if(shield>0){
      shield--;
      bossPerfectStreak = 0; // boss perfect breaks when you make a mistake (even if blocked)
      coachSay(`🛡️ กันโดนให้แล้ว! Shield เหลือ ${shield}`);
      updateHUD();
      return true;
    }

    badHits++;
    misses++;
    combo=0;
    score=Math.max(0, score-10);

    bossPerfectStreak = 0;

    coachSay('😵 โดน 🦠 แล้ว! ลองช้าลงนิดนึง เล็งให้ตรง 🫧');
    updateHUD();
    return false;
  }

  // ---- powerups ----
  function applyPower(subtype){
    powerPickups++;
    if(subtype==='shield'){
      shield = Math.min(3, shield+1);
      coachSay('🛡️ ได้ Shield! กันพลาดได้ 1 ครั้ง');
      setQuest('🛡️ ได้ Shield!', 'กัน Miss/กันโดน 🦠 ได้ 1 ครั้ง');
    }
    if(subtype==='magnet'){
      magnetUntil = nowMs()+9000;
      coachSay('🧲 Magnet ON! ใกล้กลางจอจะเก็บ 🫧 ออโต้');
      setQuest('🧲 Magnet ON!', '🫧 ใกล้กลางจอจะถูกดูดเก็บเอง');
    }
    if(subtype==='slow'){
      slowUntil = nowMs()+7000;
      coachSay('⏳ Slow-mo! เป้าจะอยู่ได้นานขึ้น');
      setQuest('⏳ Slow-mo!', 'เป้าจะอยู่ได้นานขึ้น + spawn ช้าลงชั่วคราว');
    }
    tryAdvanceMini();
    updateHUD();
  }

  // ---- hit logic ----
  function onHit(id, source=''){
    const t = live.get(id);
    if(!t || !running) return;

    if(t.kind==='power'){
      removeTarget(id,'');
      applyPower(t.subtype);
      emit('hha:score',{score,combo,comboMax});
      return;
    }

    if(t.kind==='boss'){
      // hitting boss directly = mistake (เด็กจะได้เรียนรู้ “อย่าจิ้มมั่ว”)
      bossPerfectStreak = 0;
      onBadHitPenalty();
      emit('hha:score',{score,combo,comboMax});
      return;
    }

    if(t.kind==='good'){
      removeTarget(id,'');
      goodHits++;
      combo++;
      comboMax=Math.max(comboMax, combo);

      let add = 10 + Math.min(18, combo);

      // ULTRA: if bossActive and perfect streak >=5 => x2 feel (apply small multiplier)
      if(bossActive && bossPerfectStreak >= 5){
        add = Math.round(add * 1.25);
      }

      score += add;

      if(bossActive) bossHitProgress();

      // goals
      if(goalsCleared===0 && goodHits>=10){
        goalsCleared=1;
        setQuest('🎯 Goal สำเร็จ! ต่อไป: เก็บ 🫧 ให้ครบ 20', 'ระวัง 🦠 โผล่ถี่ขึ้น!');
        coachSay('ดีมาก! เป้าหมายต่อไป เก็บให้ครบ 20!');
      }
      if(goalsCleared===1 && goodHits>=20){
        goalsCleared=2;
        setQuest('🏁 Goal ครบแล้ว! ต่อไปเน้น Mini + อยู่รอด', 'ช่วงท้ายจะมี Boss โผล่ 😈');
        coachSay('สุดยอด! ตอนนี้ลองทำ Mini ให้ครบดู');
      }

      emit('hha:score',{score,combo,comboMax});
      tryAdvanceMini();
      updateHUD();
      return;
    }

    if(t.kind==='bad'){
      removeTarget(id,'');
      onBadHitPenalty();
      emit('hha:score',{score,combo,comboMax});
      return;
    }
  }

  // ---- shoot support ----
  function onShoot(ev){
    if(!running) return;
    const d = ev?.detail || {};
    const x = Number(d.x), y = Number(d.y);
    if(!isFinite(x)||!isFinite(y)) return;

    let lockPx = Math.max(12, Number(d.lockPx||28));
    if(nowMs() < magnetUntil) lockPx += 18;

    let best=null, bestDist=1e9;
    for(const t of live.values()){
      const dist = Math.hypot(t.x-x, t.y-y);
      if(dist < bestDist){ bestDist=dist; best=t; }
    }

    if(best && bestDist <= lockPx){
      onHit(best.id,'shoot');
    }else{
      if(P.diff==='hard'){
        if(shield>0){
          shield--;
          bossPerfectStreak=0;
          coachSay(`🛡️ กันพลาดยิงแล้ว! Shield เหลือ ${shield}`);
        }else{
          misses++; combo=0;
          coachSay('พลาดยิง! ลองค่อย ๆ เล็งกลางเป้า');
        }
        WIN.HHA_CHAL?.onState?.({ misses, comboMax });
        updateHUD();
      }
    }
  }

  // ---- magnet auto collect ----
  function magnetAutoCollect(){
    if(nowMs() >= magnetUntil) return;
    const cx=WIN.innerWidth/2, cy=WIN.innerHeight/2;
    const R=140;
    for(const t of live.values()){
      if(t.kind!=='good') continue;
      const dist=Math.hypot(t.x-cx,t.y-cy);
      if(dist <= R){
        onHit(t.id,'magnet');
        break;
      }
    }
  }

  // ---- tick ----
  function tick(){
    if(!running) return;
    const t=nowMs();

    const slowOn = t < slowUntil;
    slowFactor = slowOn ? 0.62 : 1.0;

    if(t >= tEndAt){ endGame('timeup'); return; }

    const leftSec=(tEndAt-t)/1000;
    if(leftSec <= 10 && !bossActive) bossStart();

    const dtRaw = Math.min(60, Math.max(0, t-lastTick));
    const dt = dtRaw * slowFactor;
    lastTick = t;

    // expire
    for(const [id,obj] of live){
      if(obj.kind==='boss') continue;
      if(t - obj.born >= obj.ttlMs) removeTarget(id,'expire');
    }

    magnetAutoCollect();

    // spawn
    spawnTimer -= dt;
    if(spawnTimer <= 0){
      const intensity = leftSec < 15 ? 1.35 : leftSec < 30 ? 1.15 : 1.0;

      const baseGood = (P.diff==='easy')?1:(P.diff==='hard')?2:1;
      const baseBad  = (P.diff==='easy')?1:(P.diff==='hard')?2:1;

      const bossMulGood = bossActive ? 1.25 : 1.0;
      const bossMulBad  = bossActive ? 0.85 : 1.0;

      const nGood = clamp(Math.round(baseGood*intensity*bossMulGood), 1, 3);
      const nBad  = clamp(Math.round(baseBad *(intensity*0.9)*bossMulBad), 1, 3);

      for(let i=0;i<nGood;i++) makeTarget('good');
      for(let i=0;i<nBad;i++)  makeTarget('bad');

      // powerup chance
      const powerChance = bossActive ? 0.14 : 0.10;
      if(rnd.f() < powerChance){
        const pick=rnd.f();
        const subtype = (pick<0.34)?'shield':(pick<0.68)?'magnet':'slow';
        makeTarget('power',subtype);
      }

      const baseGap = (P.diff==='easy')?720:(P.diff==='hard')?520:620;
      spawnTimer = (baseGap / intensity) * (bossActive ? 0.92 : 1.0);
    }

    // safe streak mini (pattern uses it)
    if(lastBadAt===0) lastBadAt=t;
    safeStreakMs = (badHits===0) ? (t-tStart) : (t-lastBadAt);

    // time emit 1s
    if(t - (tick._lastEmit||0) >= 1000){
      tick._lastEmit = t;
      emit('hha:time',{ leftSec: Math.max(0, Math.ceil((tEndAt-t)/1000)) });
      // coach gentle reminders
      if(leftSec <= 12 && leftSec > 9) coachSay('ใกล้หมดเวลา! เตรียมรับ Boss!');
      if(bossActive && bossHp <= 3) coachSay('อีกนิดเดียว! ล้าง Boss ให้หมด!');
    }

    tryAdvanceMini();
    updateHUD();
    requestAnimationFrame(tick);
  }

  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail: detail||{} })); }catch(_){}
  }

  function gradeFromScore(){
    if(score >= 420) return 'S';
    if(score >= 300) return 'A';
    if(score >= 210) return 'B';
    if(score >= 140) return 'C';
    return 'D';
  }

  function pushHistory(summary){
    try{
      const arr = JSON.parse(localStorage.getItem(LS_HIST)||'[]');
      const list = Array.isArray(arr)?arr:[];
      list.unshift(summary);
      while(list.length>50) list.pop();
      localStorage.setItem(LS_HIST, JSON.stringify(list));
    }catch(_){}
  }

  function saveLast(summary){
    try{ localStorage.setItem(LS_LAST, JSON.stringify(summary)); }catch(_){}
  }

  function endGame(reason=''){
    if(!running) return;
    running=false;

    for(const id of Array.from(live.keys())) removeTarget(id,'');
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    try{ WIN.removeEventListener('pagehide', flush); }catch(_){}
    try{ DOC.removeEventListener('visibilitychange', onVis); }catch(_){}

    const durationPlayedSec = Math.max(0, Math.round((nowMs()-tStart)/1000));
    const grade = gradeFromScore();
    const sessionId = `HYG-${Date.now()}-${Math.floor(Math.random()*1e6)}`;

    const summary = {
      projectTag:'HeroHealth',
      game: GAME_ID,
      gameMode:'hygiene',
      version: VERSION,

      sessionId,
      timestampIso: new Date().toISOString(),

      runMode: P.run||'play',
      diff: P.diff||'normal',
      time: P.time||70,
      seed: String(P.seed||'')||null,
      chal: String(P.chal||'')||null,

      scoreFinal: score|0,
      comboMax: comboMax|0,
      misses: misses|0,

      goodHits, badHits,
      goalsCleared, goalsTotal,
      miniCleared, miniTotal,

      // ULTRA extras
      bossClears,
      bossMaxHp,
      bossCleanedByGood,
      bossPerfectBest,
      powerPickups,
      shieldLeft: shield,
      activeMiniKey,

      durationPlayedSec,
      endReason: reason||'ended',

      studyId: P.studyId||'',
      phase: P.phase||'',
      conditionGroup: P.conditionGroup||''
    };

    saveLast(summary);
    pushHistory(summary);

    WIN.HHA_CHAL?.onState?.({ grade });

    emit('hha:end', summary);
    emit('hha:flush', { reason:'end' });

    if(ui.ovEnd) ui.ovEnd.style.display='grid';
    setText(ui.endLine, `Score ${summary.scoreFinal} • ComboMax ${summary.comboMax} • Miss ${summary.misses} • BossClear ${bossClears} • Grade ${grade}`);
    if(ui.endJson) ui.endJson.textContent = JSON.stringify(summary, null, 2);

    updateHUD();
  }

  function flush(){ emit('hha:flush',{reason:'flush'}); }
  function onVis(){ if(DOC.visibilityState==='hidden') flush(); }

  // ---- start/stop ----
  function start(){
    computeSpawnRect();
    WIN.addEventListener('resize', computeSpawnRect);

    score=0; combo=0; comboMax=0; misses=0;
    goalsCleared=0; miniCleared=0;
    goodHits=0; badHits=0;

    shield=0; magnetUntil=0; slowUntil=0; powerPickups=0;

    bossActive=false; bossClears=0; bossHp=0; bossId=null;
    bossCleanedByGood=0; bossPerfectStreak=0; bossPerfectBest=0;

    lastCoachAt=0;

    buildMiniOrder();
    setQuest(`Mini: ${miniDescribe(activeMiniKey)}`, 'ทำให้สำเร็จก่อนเวลาหมด!');
    coachSay('เริ่มเลย! โฟกัส 🫧 และอย่าโดน 🦠');

    spawnTimer=200;

    running=true;
    tStart=nowMs();
    tEndAt=tStart + Math.max(10, Number(P.time||70))*1000;
    lastTick=tStart;
    lastBadAt=tStart;

    WIN.addEventListener('hha:shoot', onShoot);
    WIN.addEventListener('pagehide', flush);
    DOC.addEventListener('visibilitychange', onVis);

    emit('hha:start', { game:GAME_ID, diff:P.diff, run:P.run, time:P.time, seed:P.seed||null, chal:P.chal||null });

    updateHUD();
    requestAnimationFrame(tick);
  }

  function stop(reason='stop'){ endGame(reason); }

  return { start, stop };
}