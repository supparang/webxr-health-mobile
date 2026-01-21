// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR — PACK 2 (Story + Waves + Badges + FX) on top of ULTRA
// ✅ Story overlay (run=story) + skip
// ✅ Waves 1–3 (spawn intensity ramps) + boss last 10s
// ✅ Badges/Stickers persist to localStorage (HHA_BADGES)
// ✅ FX hooks (window.Particles if present) + simple fallback
// ✅ Keeps: hha:shoot, HHA_CHAL updates, last summary/history, end overlay

export function createHygieneGame(opts){
  'use strict';
  const DOC = document;
  const WIN = window;

  const targetsEl = opts.targetsEl;
  const ui = opts.ui || {};
  const P = opts.params || {};

  const GAME_ID = 'hygiene';
  const VERSION = '1.3.0-pack2-story-waves-badges-fx';

  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';
  const LS_BADGES = 'HHA_BADGES';

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const nowMs = ()=> (performance.now ? performance.now() : Date.now());

  // --- RNG deterministic-ish
  const rnd = (()=> {
    let s = 0;
    const raw = String(P.seed||'').trim();
    if(raw){
      let n = 0;
      for(let i=0;i<raw.length;i++) n = (n*131 + raw.charCodeAt(i))>>>0;
      s = (n || 123456789)>>>0;
    }else{
      s = (Date.now() ^ (Math.random()*1e9))>>>0;
    }
    return {
      f(){ s=(1664525*s + 1013904223)>>>0; return (s/4294967296); },
      i(a,b){ return a + Math.floor(this.f()*(b-a+1)); }
    };
  })();

  // ---- FX wrapper (uses /herohealth/vr/particles.js if loaded)
  const FX = {
    pop(x,y,text,cls=''){
      try{
        if(WIN.Particles?.popText) return WIN.Particles.popText(x,y,text,cls);
      }catch(_){}
      // fallback: tiny floating text
      try{
        const el = DOC.createElement('div');
        el.textContent = text;
        el.style.cssText = `
          position:fixed; left:${x}px; top:${y}px;
          transform:translate(-50%,-50%);
          font: 900 16px/1 system-ui;
          color: rgba(229,231,235,.95);
          text-shadow: 0 2px 0 rgba(0,0,0,.35);
          z-index:9997;
          pointer-events:none;
          opacity:0;
          transition: transform .45s ease, opacity .45s ease;
        `;
        DOC.body.appendChild(el);
        requestAnimationFrame(()=>{
          el.style.opacity='1';
          el.style.transform='translate(-50%,-70%)';
        });
        setTimeout(()=>el.remove(), 520);
      }catch(_){}
    },
    celebrate(){
      try{ if(WIN.Particles?.celebrate) return WIN.Particles.celebrate(); }catch(_){}
      // fallback: small shake
      try{
        DOC.body.animate([
          { transform:'translateX(0px)' },
          { transform:'translateX(-3px)' },
          { transform:'translateX(3px)' },
          { transform:'translateX(0px)' }
        ], { duration:260 });
      }catch(_){}
    }
  };

  // ---- UI refs (optional)
  const bossWrap = DOC.getElementById('bossWrap');
  const bossBar  = DOC.getElementById('bossBar');
  const bossTxt  = DOC.getElementById('bossTxt');

  const coachBubble = DOC.getElementById('coachBubble');
  const coachText   = DOC.getElementById('coachText');

  const storyOv   = DOC.getElementById('storyOv');
  const storyText = DOC.getElementById('storyText');
  const storyStart= DOC.getElementById('storyStart');
  const storySkip = DOC.getElementById('storySkip');

  const endBadgesEl = DOC.getElementById('endBadges');

  // ---- state
  let running=false, startedCore=false;
  let tStart=0, tEndAt=0, lastTick=0;
  let score=0, combo=0, comboMax=0, misses=0;
  let goalsCleared=0, goalsTotal=2;
  let miniCleared=0, miniTotal=2;
  let goodHits=0, badHits=0;

  // powerups
  let shield=0, magnetUntil=0, slowUntil=0, slowFactor=1.0, powerPickups=0;

  // boss
  let bossActive=false, bossClears=0, bossHp=0, bossMaxHp=12, bossId=null;
  let bossCleanedByGood=0;
  let bossPerfectStreak=0, bossPerfectBest=0;

  // waves
  let wave=1, waveTotal=3;
  let waveCut1=0, waveCut2=0; // ms boundaries
  let lastWave=1;

  // minis (seeded rotation)
  const MINI_PATTERNS = ['combo8','safe6s','power2','boss_clean'];
  let miniPatternOrder = [];
  let activeMiniKey = null;

  let safeStreakMs=0, lastBadAt=0;

  let spawnTimer=0;

  // coach (rate limit)
  let lastCoachAt=0;
  const COACH_COOLDOWN_MS = 3200;

  // spawn rect
  const spawnRect = { x0:64, y0:160, x1:0, y1:0 };
  function computeSpawnRect(){
    const w=WIN.innerWidth, h=WIN.innerHeight;
    spawnRect.x0=64;
    spawnRect.y0=160;
    spawnRect.x1=Math.max(spawnRect.x0+80, w-64);
    spawnRect.y1=Math.max(spawnRect.y0+120, h-150);
  }

  // ---- util
  function setText(el,s){ if(el) el.textContent=String(s); }
  function fmtTime(sec){
    sec=Math.max(0,Math.floor(sec));
    const m=Math.floor(sec/60), s=sec%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }
  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail: detail||{} })); }catch(_){}
  }

  function coachSay(msg){
    const t=nowMs();
    if(t-lastCoachAt < COACH_COOLDOWN_MS) return;
    lastCoachAt=t;
    if(coachBubble && coachText){
      coachText.textContent = msg;
      coachBubble.style.display='block';
      clearTimeout(coachSay._t);
      coachSay._t = setTimeout(()=>{ coachBubble.style.display='none'; }, 2600);
    }
    emit('hha:coach', { msg });
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
    if(!bossActive){ bossWrap.style.display='none'; return; }
    bossWrap.style.display='block';
    bossTxt.textContent = `HP ${bossHp}/${bossMaxHp} • Perfect ${bossPerfectStreak}`;
    const pct = Math.max(0, Math.min(1, bossHp/Math.max(1,bossMaxHp)));
    bossBar.style.width = `${(pct*100).toFixed(1)}%`;
    bossWrap.style.borderColor = (pct<=0.25) ? 'rgba(239,68,68,.45)' : 'rgba(148,163,184,.16)';
  }

  function setQuest(text, hint=''){
    setText(ui.questText, text);
    setText(ui.questHint, hint);
    if(ui.questHint) ui.questHint.dataset.base = hint;
  }

  function updateHUD(){
    const left = Math.max(0, Math.ceil((tEndAt-nowMs())/1000));
    setText(ui.kTime, fmtTime(left));
    setText(ui.kScore, score|0);
    setText(ui.kCombo, combo|0);
    setText(ui.kMiss, misses|0);

    setText(ui.bGoal, `Wave ${wave}/${waveTotal} • Goal ${goalsCleared}/${goalsTotal}${bossActive?` • BOSS ${bossHp}/${bossMaxHp}`:''}`);
    setText(ui.bMini, `Mini ${miniCleared}/${miniTotal} (${activeMiniKey||'-'})`);
    setText(ui.bMode, `Survival • ${String(P.diff||'normal')}`);

    if(ui.questHint){
      const base = ui.questHint.dataset.base || ui.questHint.textContent || '';
      ui.questHint.dataset.base = base;
      ui.questHint.textContent = `${base} • Power: ${powerText()}`;
    }

    updateBossUI();
    WIN.HHA_CHAL?.onState?.({ misses, comboMax, goalsCleared, miniCleared });
  }

  // ---- targets
  let nextId=1;
  const live = new Map(); // id -> {id,kind,subtype,x,y,born,ttlMs,el}

  function makeTarget(kind, subtype=null, fixedXY=null){
    const id=nextId++;
    const el=DOC.createElement('div');

    let cls='t';
    if(kind==='good') cls+=' good';
    else cls+=' bad';

    el.className=cls;

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
    if(kind==='bad') s=0.95+rnd.f()*0.40;
    if(kind==='power') s=0.92+rnd.f()*0.25;
    if(kind==='boss') s=1.55;

    el.style.setProperty('--x', x);
    el.style.setProperty('--y', y);
    el.style.setProperty('--s', s.toFixed(3));

    // TTL tuned by difficulty + wave + slowmo
    let ttlMs=1400;
    if(kind==='bad') ttlMs=1600;
    if(kind==='power') ttlMs=2200;
    if(kind==='boss') ttlMs=999999;

    const diffMul=(P.diff==='easy')?1.18:(P.diff==='hard')?0.85:1.0;
    ttlMs = Math.floor(ttlMs*diffMul);

    // waves: later waves shorten TTL a bit (more tense)
    const waveMul = (wave===1)?1.06:(wave===2)?1.0:0.92;
    ttlMs = Math.floor(ttlMs*waveMul);

    if(nowMs() < slowUntil) ttlMs += 450;

    const obj={ id,kind,subtype,x,y,born:nowMs(),ttlMs,el };
    live.set(id,obj);

    el.addEventListener('click', (e)=>{
      e.preventDefault();
      onHit(id,'tap', e);
    }, { passive:false });

    return obj;
  }

  function removeTarget(id, reason=''){
    const t=live.get(id);
    if(!t) return;
    if(t.kind==='boss') bossId=null;

    live.delete(id);
    try{ t.el.style.opacity='0'; }catch(_){}
    try{ setTimeout(()=>t.el.remove(), 80); }catch(_){}

    if(reason==='expire' && t.kind==='good'){
      if(shield>0){
        shield--;
        coachSay('🛡️ กันพลาดให้แล้ว! ระวัง 🫧 หายเร็วขึ้น');
      }else{
        misses++; combo=0;
        coachSay('😵 พลาด! ลองเล็งให้ชัวร์ก่อนแตะ/ยิง');
      }
      WIN.HHA_CHAL?.onState?.({ misses, comboMax });
    }
  }

  // ---- minis
  function buildMiniOrder(){
    const arr=MINI_PATTERNS.slice();
    for(let i=arr.length-1;i>0;i--){
      const j=rnd.i(0,i);
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    miniPatternOrder=arr;
    activeMiniKey=miniPatternOrder[0]||'combo8';
  }
  function miniDescribe(k){
    switch(k){
      case 'combo8': return 'ทำ ComboMax ให้ถึง 8';
      case 'safe6s': return 'หลบ 🦠 ให้ได้ 6 วินาทีติด';
      case 'power2': return 'เก็บ Power-up ให้ได้ 2 ครั้ง';
      case 'boss_clean': return 'ตอน Boss: Perfect 5 เพื่อโบนัส';
      default: return 'ภารกิจพิเศษ';
    }
  }
  function tryAdvanceMini(){
    if(miniCleared >= miniTotal) return;
    const k=activeMiniKey;
    let ok=false;
    if(k==='combo8') ok = comboMax>=8;
    if(k==='safe6s') ok = safeStreakMs>=6000;
    if(k==='power2') ok = powerPickups>=2;
    if(k==='boss_clean') ok = bossPerfectBest>=5;

    if(ok){
      miniCleared++;
      FX.pop(WIN.innerWidth/2, 160, '✅ MINI CLEAR!', 'good');
      coachSay(`✅ ผ่าน Mini: ${miniDescribe(k)}!`);
      const next = miniPatternOrder[miniCleared] || null;
      activeMiniKey = next;
      if(next){
        setQuest(`Mini ใหม่: ${miniDescribe(next)}`, 'ทำให้สำเร็จก่อนเวลาหมด!');
      }else{
        setQuest('Mini ครบแล้ว! เน้นทำคะแนน + อยู่รอด', 'สุดท้ายมี Boss 😈');
      }
    }
  }

  // ---- powerups
  function applyPower(subtype){
    powerPickups++;
    if(subtype==='shield'){
      shield = Math.min(3, shield+1);
      coachSay('🛡️ ได้ Shield! กันพลาดได้ 1 ครั้ง');
      FX.pop(WIN.innerWidth/2, 190, '+SHIELD', 'good');
      setQuest('🛡️ ได้ Shield!', 'กัน Miss/กันโดน 🦠 ได้ 1 ครั้ง');
    }
    if(subtype==='magnet'){
      magnetUntil = nowMs()+9000;
      coachSay('🧲 Magnet ON! ใกล้กลางจอจะเก็บ 🫧 ออโต้');
      FX.pop(WIN.innerWidth/2, 190, '+MAGNET', 'good');
      setQuest('🧲 Magnet ON!', '🫧 ใกล้กลางจอจะถูกดูดเก็บเอง');
    }
    if(subtype==='slow'){
      slowUntil = nowMs()+7000;
      coachSay('⏳ Slow-mo! เป้าจะอยู่ได้นานขึ้น');
      FX.pop(WIN.innerWidth/2, 190, '+SLOW', 'good');
      setQuest('⏳ Slow-mo!', 'เป้าจะอยู่ได้นานขึ้น + spawn ช้าลงชั่วคราว');
    }
    tryAdvanceMini();
    updateHUD();
  }

  // ---- boss
  function bossStart(){
    if(bossActive) return;
    bossActive=true;
    bossHp=bossMaxHp;
    bossCleanedByGood=0;
    bossPerfectStreak=0;

    const cx=Math.round(WIN.innerWidth/2);
    const cy=Math.round(WIN.innerHeight/2);
    const b=makeTarget('boss', null, {x:cx, y:cy});
    bossId=b.id;

    setQuest('👾 BOSS มาแล้ว! ล้างให้ทัน!', 'เก็บ 🫧 ต่อเนื่อง = Perfect (โบนัส)');
    coachSay('👾 Boss มาแล้ว! โฟกัส 🫧 อย่างเดียว!');
    FX.pop(cx, cy-90, 'BOSS!', 'warn');
    updateHUD();
  }

  function bossHitProgress(hitX, hitY){
    if(!bossActive) return;

    bossHp=Math.max(0, bossHp-1);
    bossCleanedByGood++;

    bossPerfectStreak++;
    bossPerfectBest=Math.max(bossPerfectBest, bossPerfectStreak);

    // perfect milestone
    if(bossPerfectStreak>0 && bossPerfectStreak%5===0){
      score += 40;
      FX.pop(hitX, hitY-40, '✨ PERFECT +40', 'good');
      coachSay('✨ PERFECT CLEAN! โบนัส +40');
    }

    if(bossHp<=0){
      bossClears++;
      score += 180;
      combo += 3;
      comboMax=Math.max(comboMax, combo);

      if(bossId!=null) removeTarget(bossId,'');
      bossActive=false;

      FX.celebrate();
      coachSay('🏆 ล้าง Boss สำเร็จ!');
      setQuest('🏆 ล้าง Boss สำเร็จ!', 'อยู่รอดต่อจนจบเวลา');
    }
    updateBossUI();
  }

  function onBadHitPenalty(){
    bossPerfectStreak = 0;

    if(shield>0){
      shield--;
      coachSay(`🛡️ กันโดนให้แล้ว! Shield เหลือ ${shield}`);
      updateHUD();
      return true;
    }
    badHits++;
    misses++;
    combo=0;
    score=Math.max(0, score-10);
    coachSay('😵 โดน 🦠 แล้ว! ลองช้าลงนิดนึง เล็งให้ตรง 🫧');
    updateHUD();
    return false;
  }

  // ---- hit
  function onHit(id, source='tap', ev=null){
    const t=live.get(id);
    if(!t || !running) return;

    const px = ev?.clientX ?? t.x ?? (WIN.innerWidth/2);
    const py = ev?.clientY ?? t.y ?? (WIN.innerHeight/2);

    if(t.kind==='power'){
      removeTarget(id,'');
      applyPower(t.subtype);
      emit('hha:score',{score,combo,comboMax});
      return;
    }

    if(t.kind==='boss'){
      // hitting boss directly is a mistake
      FX.pop(px, py-30, '❌', 'bad');
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
      // slight reward while perfect streak built in boss
      if(bossActive && bossPerfectStreak>=5) add = Math.round(add*1.25);

      score += add;
      FX.pop(px, py-34, `+${add}`, 'good');

      // goals
      if(goalsCleared===0 && goodHits>=10){
        goalsCleared=1;
        setQuest('🎯 Goal สำเร็จ! ต่อไป: เก็บ 🫧 ให้ครบ 20', 'Wave ต่อไปจะเร็วขึ้น!');
        coachSay('ดีมาก! เป้าหมายต่อไป: 20!');
      }
      if(goalsCleared===1 && goodHits>=20){
        goalsCleared=2;
        setQuest('🏁 Goal ครบแล้ว! เน้น Mini + อยู่รอด', 'ช่วงท้ายจะมี Boss 😈');
        coachSay('สุดยอด! ลองเก็บ Mini ให้ครบ');
      }

      if(bossActive) bossHitProgress(px,py);

      emit('hha:score',{score,combo,comboMax});
      tryAdvanceMini();
      updateHUD();
      return;
    }

    if(t.kind==='bad'){
      removeTarget(id,'');
      FX.pop(px, py-30, '-10', 'bad');
      lastBadAt = nowMs();
      onBadHitPenalty();
      emit('hha:score',{score,combo,comboMax});
      return;
    }
  }

  // ---- shoot
  function onShoot(ev){
    if(!running) return;
    const d=ev?.detail||{};
    const x=Number(d.x), y=Number(d.y);
    if(!isFinite(x)||!isFinite(y)) return;

    let lockPx=Math.max(12, Number(d.lockPx||28));
    if(nowMs() < magnetUntil) lockPx += 18;

    let best=null, bestDist=1e9;
    for(const t of live.values()){
      const dist=Math.hypot((t.x-x),(t.y-y));
      if(dist<bestDist){ bestDist=dist; best=t; }
    }

    if(best && bestDist<=lockPx){
      // synth event coords for FX feel
      onHit(best.id,'shoot',{ clientX:x, clientY:y });
    }else{
      if(P.diff==='hard'){
        bossPerfectStreak=0;
        if(shield>0){
          shield--;
          coachSay(`🛡️ กันพลาดยิงแล้ว! Shield เหลือ ${shield}`);
        }else{
          misses++; combo=0;
          coachSay('พลาดยิง! ค่อย ๆ เล็งกลางเป้า');
        }
        WIN.HHA_CHAL?.onState?.({ misses, comboMax });
        updateHUD();
      }
    }
  }

  // ---- magnet auto collect
  function magnetAutoCollect(){
    if(nowMs() >= magnetUntil) return;
    const cx=WIN.innerWidth/2, cy=WIN.innerHeight/2;
    const R=140;
    for(const t of live.values()){
      if(t.kind!=='good') continue;
      const dist=Math.hypot(t.x-cx,t.y-cy);
      if(dist<=R){
        onHit(t.id,'magnet',{clientX:cx, clientY:cy});
        break;
      }
    }
  }

  // ---- waves
  function setupWaves(){
    const totalMs = Math.max(10, Number(P.time||70))*1000;
    // split into 3 waves (boss is still last 10s overall)
    waveCut1 = tStart + Math.floor(totalMs * 0.34);
    waveCut2 = tStart + Math.floor(totalMs * 0.68);
    wave = 1; lastWave=1;
  }

  function updateWave(){
    const t=nowMs();
    let w=1;
    if(t >= waveCut2) w=3;
    else if(t >= waveCut1) w=2;

    if(w !== lastWave){
      lastWave = w;
      wave = w;
      if(w===2){
        setQuest('🌊 Wave 2: Soap Rush!', 'เร็วขึ้นนิดนึง—อย่าตกใจ!');
        coachSay('Wave 2! เร็วขึ้นแล้วนะ ลองหายใจลึก ๆ แล้วเล็ง');
      }else if(w===3){
        setQuest('🌊 Wave 3: Final Clean!', 'ใกล้เจอ Boss แล้ว!');
        coachSay('Wave 3! อีกนิดเดียวจะเจอ Boss 😈');
      }
      FX.pop(WIN.innerWidth/2, 140, `WAVE ${w}`, 'warn');
    }
  }

  // ---- tick
  function tick(){
    if(!running) return;
    const t=nowMs();

    const slowOn = t < slowUntil;
    slowFactor = slowOn ? 0.62 : 1.0;

    if(t >= tEndAt){ endGame('timeup'); return; }

    updateWave();

    const leftSec=(tEndAt-t)/1000;
    if(leftSec <= 10 && !bossActive) bossStart();

    const dtRaw=Math.min(60, Math.max(0, t-lastTick));
    const dt=dtRaw * slowFactor;
    lastTick=t;

    // expire
    for(const [id,obj] of live){
      if(obj.kind==='boss') continue;
      if(t - obj.born >= obj.ttlMs) removeTarget(id,'expire');
    }

    magnetAutoCollect();

    // safe streak
    safeStreakMs = (badHits===0) ? (t-tStart) : (t-lastBadAt);

    // spawn
    spawnTimer -= dt;
    if(spawnTimer <= 0){
      const intensity = leftSec < 15 ? 1.35 : leftSec < 30 ? 1.15 : 1.0;

      // wave intensity multiplier
      const waveMul = (wave===1)?0.98:(wave===2)?1.12:1.25;

      const baseGood = (P.diff==='easy')?1:(P.diff==='hard')?2:1;
      const baseBad  = (P.diff==='easy')?1:(P.diff==='hard')?2:1;

      const bossMulGood = bossActive ? 1.25 : 1.0;
      const bossMulBad  = bossActive ? 0.85 : 1.0;

      const nGood = clamp(Math.round(baseGood*intensity*waveMul*bossMulGood), 1, 3);
      const nBad  = clamp(Math.round(baseBad *(intensity*0.9)*waveMul*bossMulBad), 1, 3);

      for(let i=0;i<nGood;i++) makeTarget('good');
      for(let i=0;i<nBad;i++)  makeTarget('bad');

      // power chance
      const powerChance = bossActive ? 0.14 : 0.10;
      if(rnd.f() < powerChance){
        const pick=rnd.f();
        const subtype=(pick<0.34)?'shield':(pick<0.68)?'magnet':'slow';
        makeTarget('power',subtype);
      }

      const baseGap=(P.diff==='easy')?720:(P.diff==='hard')?520:620;
      const gap = (baseGap/intensity) / waveMul * (bossActive ? 0.92 : 1.0);
      spawnTimer = Math.max(320, gap);
    }

    // time emit 1s + coach reminders
    if(t - (tick._lastEmit||0) >= 1000){
      tick._lastEmit = t;
      emit('hha:time',{ leftSec: Math.max(0, Math.ceil((tEndAt-t)/1000)) });

      if(leftSec <= 12 && leftSec > 9) coachSay('ใกล้หมดเวลา! เตรียมรับ Boss!');
      if(bossActive && bossHp <= 3) coachSay('อีกนิดเดียว! ล้าง Boss ให้หมด!');
    }

    tryAdvanceMini();
    updateHUD();
    requestAnimationFrame(tick);
  }

  // ---- badges/stickers
  function loadBadges(){
    try{
      const s = localStorage.getItem(LS_BADGES);
      const arr = s ? JSON.parse(s) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }
  function saveBadges(arr){
    try{ localStorage.setItem(LS_BADGES, JSON.stringify(arr)); }catch(_){}
  }
  function awardBadges(){
    const earned = [];
    const add = (id, emoji, name, desc)=>{
      earned.push({ id, emoji, name, desc, game:GAME_ID, at: new Date().toISOString() });
    };

    if(badHits === 0) add('hyg_no_germ','🧼','Clean Master','จบเกมโดยไม่โดน 🦠 เลย');
    if(misses <= 1)   add('hyg_low_miss','🎯','Sharp Aim','Miss ไม่เกิน 1');
    if(comboMax >= 12) add('hyg_combo12','🔥','Combo Star','ComboMax ≥ 12');
    if(powerPickups >= 3) add('hyg_power3','🎁','Power Collector','เก็บ Power-up ≥ 3');
    if(bossClears >= 1) add('hyg_boss','🏆','Boss Cleaner','ล้าง Boss สำเร็จ');
    if(bossPerfectBest >= 5) add('hyg_perfect5','✨','Perfect Cleaner','Perfect ระหว่าง Boss ≥ 5');

    // persist unique by id
    const cur = loadBadges();
    const ids = new Set(cur.map(b=>b.id));
    const merged = cur.slice();
    for(const b of earned){
      if(!ids.has(b.id)){
        merged.unshift(b);
        ids.add(b.id);
      }
    }
    while(merged.length > 80) merged.pop();
    saveBadges(merged);

    return earned;
  }

  function renderEndBadges(earned){
    if(!endBadgesEl) return;
    endBadgesEl.innerHTML = '';
    if(!earned || !earned.length){
      endBadgesEl.innerHTML = `<div style="font-weight:900; color:#94a3b8;">No badge this run — ลองอีกครั้งได้!</div>`;
      return;
    }
    earned.forEach(b=>{
      const pill = DOC.createElement('div');
      pill.style.cssText = `
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.55);
        border-radius:999px;
        padding:8px 10px;
        font-weight:1000;
        display:flex; gap:8px; align-items:center;
      `;
      pill.innerHTML = `<span style="font-size:16px">${b.emoji}</span>
                        <span>${b.name}</span>`;
      endBadgesEl.appendChild(pill);
    });
  }

  // ---- summary/history
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

  function gradeFromScore(){
    if(score >= 420) return 'S';
    if(score >= 300) return 'A';
    if(score >= 210) return 'B';
    if(score >= 140) return 'C';
    return 'D';
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

    const earnedBadges = awardBadges();
    renderEndBadges(earnedBadges);

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

      // extras
      wave,
      bossClears,
      bossMaxHp,
      bossCleanedByGood,
      bossPerfectBest,
      powerPickups,
      shieldLeft: shield,
      activeMiniKey,

      badgesEarned: earnedBadges.map(b=>b.id),

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

    FX.celebrate();
    updateHUD();
  }

  function flush(){ emit('hha:flush',{reason:'flush'}); }
  function onVis(){ if(DOC.visibilityState==='hidden') flush(); }

  // ---- core start (no story)
  function startCore(){
    if(startedCore) return;
    startedCore = true;

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

    setupWaves();

    WIN.addEventListener('hha:shoot', onShoot);
    WIN.addEventListener('pagehide', flush);
    DOC.addEventListener('visibilitychange', onVis);

    emit('hha:start', { game:GAME_ID, diff:P.diff, run:P.run, time:P.time, seed:P.seed||null, chal:P.chal||null });

    updateHUD();
    requestAnimationFrame(tick);
  }

  // ---- story mode gate
  function start(){
    const runMode = String(P.run||'play').toLowerCase();
    if(runMode === 'story' && storyOv && storyText && storyStart && storySkip){
      // show story
      storyText.textContent =
        `🏫 โรงเรียนกำลังเสี่ยงติดเชื้อ!\n`+
        `ภารกิจของคุณคือ "ฮีโร่อนามัย" ต้องล้างมือให้ทันก่อนเชื้อแพร่กระจาย\n\n`+
        `🌊 Wave 1: Warm-up (ค่อย ๆ เล็ง)\n`+
        `🌊 Wave 2: Soap Rush (เร็วขึ้น)\n`+
        `🌊 Wave 3: Final Clean + 👾 Boss 10 วิท้าย\n\n`+
        `ทำ Mini ให้ครบเพื่อได้ "Badge" ติดตัว!`;
      storyOv.style.display='grid';

      storyStart.onclick = ()=>{
        storyOv.style.display='none';
        startCore();
      };
      storySkip.onclick = ()=>{
        storyOv.style.display='none';
        startCore();
      };
      return;
    }

    // normal play/research
    startCore();
  }

  function stop(reason='stop'){ endGame(reason); }

  return { start, stop };
}